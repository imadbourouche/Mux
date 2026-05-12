package supervisor

import (
	"errors"
	"fmt"
	"io"
	"os"
	"os/exec"
	"strings"
	"sync"
	"syscall"
	"time"

	"github.com/creack/pty"

	"mux/internal/store"
)

type Status string

const (
	StatusStopped Status = "stopped"
	StatusRunning Status = "running"
	StatusCrashed Status = "crashed"
)

type State struct {
	Status    Status `json:"status"`
	PID       int    `json:"pid,omitempty"`
	StartedAt int64  `json:"startedAt,omitempty"`
	ExitCode  *int   `json:"exitCode,omitempty"`
	Ports     []int  `json:"ports,omitempty"`
}

type LogLine struct {
	Ts     int64  `json:"ts"`
	Stream string `json:"stream"`
	Text   string `json:"text"`
}

type Event struct {
	Type  string    `json:"type"`
	Line  *LogLine  `json:"line,omitempty"`
	State *State    `json:"state,omitempty"`
	Logs  []LogLine `json:"logs,omitempty"`
	Ports []int     `json:"ports,omitempty"`
}

const linesBufCap = 5000

type subscriber struct {
	ch chan Event
}

type slot struct {
	mu       sync.Mutex
	state    State
	ptyFile  *os.File
	cmd      *exec.Cmd
	lineBuf  []LogLine
	partial  string
	stopping bool
	ports    []int
	subs     map[*subscriber]struct{}
	subsMu   sync.RWMutex
}

type Supervisor struct {
	st    *store.Store
	mu    sync.Mutex
	slots map[string]*slot
}

func New(st *store.Store) *Supervisor {
	return &Supervisor{st: st, slots: map[string]*slot{}}
}

func (sv *Supervisor) getSlot(id string) *slot {
	sv.mu.Lock()
	defer sv.mu.Unlock()
	s, ok := sv.slots[id]
	if !ok {
		s = &slot{
			state:   State{Status: StatusStopped},
			lineBuf: []LogLine{},
			subs:    map[*subscriber]struct{}{},
		}
		sv.slots[id] = s
	}
	return s
}

func (sv *Supervisor) GetState(id string) State {
	s := sv.getSlot(id)
	s.mu.Lock()
	defer s.mu.Unlock()
	st := s.state
	st.Ports = append([]int(nil), s.ports...)
	return st
}

func (sv *Supervisor) Snapshot(id string) ([]LogLine, State) {
	s := sv.getSlot(id)
	s.mu.Lock()
	defer s.mu.Unlock()
	lines := make([]LogLine, len(s.lineBuf))
	copy(lines, s.lineBuf)
	st := s.state
	st.Ports = append([]int(nil), s.ports...)
	return lines, st
}

func (sv *Supervisor) Subscribe(id string) (<-chan Event, func()) {
	s := sv.getSlot(id)
	sub := &subscriber{ch: make(chan Event, 256)}
	s.subsMu.Lock()
	s.subs[sub] = struct{}{}
	s.subsMu.Unlock()
	return sub.ch, func() {
		s.subsMu.Lock()
		delete(s.subs, sub)
		s.subsMu.Unlock()
		close(sub.ch)
	}
}

func (s *slot) publish(ev Event) {
	s.subsMu.RLock()
	defer s.subsMu.RUnlock()
	for sub := range s.subs {
		select {
		case sub.ch <- ev:
		default:
		}
	}
}

func (s *slot) setState(state State) {
	s.state = state
	st := state
	s.publish(Event{Type: "status", State: &st})
}

func (s *slot) ingest(chunk []byte, stream string) {
	s.partial += string(chunk)
	for {
		idx := strings.IndexAny(s.partial, "\r\n")
		if idx == -1 {
			break
		}
		text := s.partial[:idx]
		if idx+1 < len(s.partial) && s.partial[idx] == '\r' && s.partial[idx+1] == '\n' {
			s.partial = s.partial[idx+2:]
		} else {
			s.partial = s.partial[idx+1:]
		}
		if text == "" {
			continue
		}
		line := LogLine{Ts: time.Now().UnixMilli(), Stream: stream, Text: text}
		s.lineBuf = append(s.lineBuf, line)
		if len(s.lineBuf) > linesBufCap {
			s.lineBuf = s.lineBuf[len(s.lineBuf)-linesBufCap:]
		}
		l := line
		s.publish(Event{Type: "log", Line: &l})
	}
}

func (s *slot) appendSystemLine(text string) {
	line := LogLine{Ts: time.Now().UnixMilli(), Stream: "system", Text: text}
	s.lineBuf = append(s.lineBuf, line)
	if len(s.lineBuf) > linesBufCap {
		s.lineBuf = s.lineBuf[len(s.lineBuf)-linesBufCap:]
	}
	l := line
	s.publish(Event{Type: "log", Line: &l})
}

func buildCommand(svc store.Service) string {
	p := svc.ActiveOrFirst()
	parts := []string{svc.Command}
	for _, a := range p.Args {
		if a.Enabled && strings.TrimSpace(a.Value) != "" {
			parts = append(parts, a.Value)
		}
	}
	return strings.Join(parts, " ")
}

func buildEnv(svc store.Service) []string {
	p := svc.ActiveOrFirst()
	env := os.Environ()
	for _, e := range p.Env {
		if e.Enabled && e.Key != "" {
			env = append(env, e.Key+"="+e.Value)
		}
	}
	env = append(env, "FORCE_COLOR=1", "TERM=xterm-256color")
	return env
}

func (sv *Supervisor) Start(id string) (State, error) {
	svc, err := sv.st.Get(id)
	if err != nil {
		return State{}, err
	}
	s := sv.getSlot(id)
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.state.Status == StatusRunning {
		return s.state, nil
	}

	if svc.Cwd == "" {
		return s.state, errors.New("cwd is required")
	}
	if _, err := os.Stat(svc.Cwd); err != nil {
		s.appendSystemLine(fmt.Sprintf("error: cwd does not exist: %s", svc.Cwd))
		st := State{Status: StatusCrashed}
		s.setState(st)
		return st, nil
	}
	if strings.TrimSpace(svc.Command) == "" {
		s.appendSystemLine("error: command is empty")
		st := State{Status: StatusCrashed}
		s.setState(st)
		return st, nil
	}

	cmdline := buildCommand(svc)
	s.appendSystemLine(fmt.Sprintf("starting: %s  (cwd: %s)  (profile: %s)", cmdline, svc.Cwd, svc.ActiveProfile))

	cmd := exec.Command("/bin/sh", "-c", cmdline)
	cmd.Dir = svc.Cwd
	cmd.Env = buildEnv(svc)

	ptyFile, err := pty.Start(cmd)
	if err != nil {
		s.appendSystemLine(fmt.Sprintf("spawn error: %v", err))
		st := State{Status: StatusCrashed}
		s.setState(st)
		return st, nil
	}
	_ = pty.Setsize(ptyFile, &pty.Winsize{Rows: 40, Cols: 200})

	s.cmd = cmd
	s.ptyFile = ptyFile
	s.stopping = false
	s.ports = nil
	pid := cmd.Process.Pid
	s.setState(State{Status: StatusRunning, PID: pid, StartedAt: time.Now().UnixMilli()})

	go sv.readPTY(s, ptyFile)
	go sv.waitProcess(s, cmd)

	return s.state, nil
}

func (sv *Supervisor) readPTY(s *slot, f *os.File) {
	buf := make([]byte, 4096)
	for {
		n, err := f.Read(buf)
		if n > 0 {
			chunk := make([]byte, n)
			copy(chunk, buf[:n])
			s.mu.Lock()
			s.ingest(chunk, "stdout")
			s.mu.Unlock()
		}
		if err != nil {
			if err != io.EOF {
			}
			return
		}
	}
}

func (sv *Supervisor) waitProcess(s *slot, cmd *exec.Cmd) {
	err := cmd.Wait()
	s.mu.Lock()
	defer s.mu.Unlock()
	code := 0
	signaled := false
	if err != nil {
		if exitErr, ok := err.(*exec.ExitError); ok {
			ws, _ := exitErr.Sys().(syscall.WaitStatus)
			code = ws.ExitStatus()
			if ws.Signaled() {
				signaled = true
				code = -1
			}
		} else {
			code = -1
		}
	}
	s.appendSystemLine(fmt.Sprintf("process exited (code=%d)", code))
	intentional := s.stopping
	s.stopping = false
	status := StatusStopped
	if !intentional && !signaled && code != 0 {
		status = StatusCrashed
	}
	ec := code
	s.ports = nil
	s.setState(State{Status: status, ExitCode: &ec})
	if s.ptyFile != nil {
		_ = s.ptyFile.Close()
		s.ptyFile = nil
	}
	s.cmd = nil
}

func (sv *Supervisor) Stop(id string) (State, error) {
	s := sv.getSlot(id)
	s.mu.Lock()
	cmd := s.cmd
	if cmd != nil {
		s.stopping = true
	}
	s.mu.Unlock()
	if cmd == nil || cmd.Process == nil {
		return sv.GetState(id), nil
	}
	pid := cmd.Process.Pid
	if err := syscall.Kill(-pid, syscall.SIGTERM); err != nil {
		_ = cmd.Process.Signal(syscall.SIGTERM)
	}
	s.mu.Lock()
	s.appendSystemLine("stop requested (SIGTERM)")
	s.mu.Unlock()
	return sv.GetState(id), nil
}

func (sv *Supervisor) Restart(id string) (State, error) {
	if sv.GetState(id).Status == StatusRunning {
		_, _ = sv.Stop(id)
		for i := 0; i < 50; i++ {
			if sv.GetState(id).Status != StatusRunning {
				break
			}
			time.Sleep(100 * time.Millisecond)
		}
		if sv.GetState(id).Status == StatusRunning {
			s := sv.getSlot(id)
			s.mu.Lock()
			cmd := s.cmd
			s.mu.Unlock()
			if cmd != nil && cmd.Process != nil {
				_ = syscall.Kill(-cmd.Process.Pid, syscall.SIGKILL)
			}
			for i := 0; i < 50; i++ {
				if sv.GetState(id).Status != StatusRunning {
					break
				}
				time.Sleep(100 * time.Millisecond)
			}
		}
	}
	return sv.Start(id)
}

func (sv *Supervisor) StopAll() {
	sv.mu.Lock()
	ids := make([]string, 0, len(sv.slots))
	for id := range sv.slots {
		ids = append(ids, id)
	}
	sv.mu.Unlock()
	for _, id := range ids {
		_, _ = sv.Stop(id)
	}
}

func (sv *Supervisor) StartAll() error {
	services, err := sv.st.List()
	if err != nil {
		return err
	}
	for _, svc := range services {
		_, _ = sv.Start(svc.ID)
	}
	return nil
}

func (sv *Supervisor) Write(id string, data []byte) error {
	s := sv.getSlot(id)
	s.mu.Lock()
	f := s.ptyFile
	s.mu.Unlock()
	if f == nil {
		return errors.New("not running")
	}
	_, err := f.Write(data)
	return err
}

func (sv *Supervisor) ClearLogs(id string) {
	s := sv.getSlot(id)
	s.mu.Lock()
	s.lineBuf = s.lineBuf[:0]
	s.partial = ""
	s.mu.Unlock()
	s.publish(Event{Type: "clear"})
}

func (sv *Supervisor) Drop(id string) {
	sv.mu.Lock()
	delete(sv.slots, id)
	sv.mu.Unlock()
}

// RunningPIDs returns a snapshot of currently-tracked root pids per service id.
func (sv *Supervisor) RunningPIDs() map[string]int {
	out := map[string]int{}
	sv.mu.Lock()
	defer sv.mu.Unlock()
	for id, s := range sv.slots {
		s.mu.Lock()
		if s.cmd != nil && s.cmd.Process != nil && s.state.Status == StatusRunning {
			out[id] = s.cmd.Process.Pid
		}
		s.mu.Unlock()
	}
	return out
}

// SetPorts updates the detected listening ports for a service and emits an event if changed.
func (sv *Supervisor) SetPorts(id string, ports []int) {
	s := sv.getSlot(id)
	s.mu.Lock()
	prev := s.ports
	if sameInts(prev, ports) {
		s.mu.Unlock()
		return
	}
	s.ports = append([]int(nil), ports...)
	s.state.Ports = append([]int(nil), ports...)
	s.mu.Unlock()
	s.publish(Event{Type: "ports", Ports: append([]int(nil), ports...)})
}

func sameInts(a, b []int) bool {
	if len(a) != len(b) {
		return false
	}
	for i := range a {
		if a[i] != b[i] {
			return false
		}
	}
	return true
}
