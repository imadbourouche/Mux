package supervisor

import (
	"bufio"
	"os/exec"
	"sort"
	"strconv"
	"strings"
	"time"
)

// StartPortWatcher polls lsof every interval and updates each running service's listening ports.
func (sv *Supervisor) StartPortWatcher(interval time.Duration) {
	go func() {
		for {
			sv.pollPorts()
			time.Sleep(interval)
		}
	}()
}

func (sv *Supervisor) pollPorts() {
	roots := sv.RunningPIDs()
	if len(roots) == 0 {
		return
	}
	all := lsofListeningPorts()
	if all == nil {
		return
	}
	for id, rootPID := range roots {
		descendants := descendantPIDs(rootPID)
		ports := []int{}
		for _, entry := range all {
			if descendants[entry.pid] {
				ports = append(ports, entry.port)
			}
		}
		sort.Ints(ports)
		ports = dedupInts(ports)
		sv.SetPorts(id, ports)
	}
}

func dedupInts(s []int) []int {
	if len(s) <= 1 {
		return s
	}
	out := s[:1]
	for i := 1; i < len(s); i++ {
		if s[i] != s[i-1] {
			out = append(out, s[i])
		}
	}
	return out
}

type portEntry struct {
	pid  int
	port int
}

// lsofListeningPorts returns all TCP listening sockets system-wide with their owning pid.
func lsofListeningPorts() []portEntry {
	cmd := exec.Command("lsof", "-nP", "-iTCP", "-sTCP:LISTEN", "-Fpn")
	out, err := cmd.Output()
	if err != nil {
		return nil
	}
	var entries []portEntry
	pid := 0
	scanner := bufio.NewScanner(strings.NewReader(string(out)))
	for scanner.Scan() {
		line := scanner.Text()
		if len(line) < 2 {
			continue
		}
		switch line[0] {
		case 'p':
			p, _ := strconv.Atoi(line[1:])
			pid = p
		case 'n':
			addr := line[1:]
			port := parseLastPort(addr)
			if port > 0 && pid > 0 {
				entries = append(entries, portEntry{pid: pid, port: port})
			}
		}
	}
	return entries
}

func parseLastPort(addr string) int {
	idx := strings.LastIndex(addr, ":")
	if idx == -1 || idx == len(addr)-1 {
		return 0
	}
	p, err := strconv.Atoi(addr[idx+1:])
	if err != nil {
		return 0
	}
	return p
}

// descendantPIDs returns the set of pids in the process tree rooted at root, including root itself.
func descendantPIDs(root int) map[int]bool {
	result := map[int]bool{root: true}
	queue := []int{root}
	for len(queue) > 0 {
		cur := queue[0]
		queue = queue[1:]
		out, err := exec.Command("pgrep", "-P", strconv.Itoa(cur)).Output()
		if err != nil {
			continue
		}
		for _, ln := range strings.Split(strings.TrimSpace(string(out)), "\n") {
			ln = strings.TrimSpace(ln)
			if ln == "" {
				continue
			}
			p, err := strconv.Atoi(ln)
			if err != nil {
				continue
			}
			if !result[p] {
				result[p] = true
				queue = append(queue, p)
			}
		}
	}
	return result
}
