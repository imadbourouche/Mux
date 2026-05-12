package store

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"sync"

	"github.com/google/uuid"
)

type EnvVar struct {
	Key     string `json:"key"`
	Value   string `json:"value"`
	Enabled bool   `json:"enabled"`
}

type Arg struct {
	Value   string `json:"value"`
	Enabled bool   `json:"enabled"`
}

type Profile struct {
	Name string   `json:"name"`
	Args []Arg    `json:"args"`
	Env  []EnvVar `json:"env"`
}

type Service struct {
	ID            string    `json:"id"`
	Name          string    `json:"name"`
	Cwd           string    `json:"cwd"`
	Command       string    `json:"command"`
	Profiles      []Profile `json:"profiles"`
	ActiveProfile string    `json:"activeProfile"`
	Pinned        bool      `json:"pinned"`
	Order         int       `json:"order"`
	// legacy fields kept only for backward compatibility on read
	Args []Arg    `json:"args,omitempty"`
	Env  []EnvVar `json:"env,omitempty"`
}

type Config struct {
	Services []Service `json:"services"`
}

type Store struct {
	mu   sync.Mutex
	path string
}

func New(path string) (*Store, error) {
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return nil, err
	}
	s := &Store{path: path}
	if _, err := os.Stat(path); os.IsNotExist(err) {
		if err := s.write(Config{Services: []Service{}}); err != nil {
			return nil, err
		}
		return s, nil
	}
	b, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	var c Config
	if err := json.Unmarshal(b, &c); err != nil {
		return nil, err
	}
	if normalize(&c) {
		_ = s.write(c)
	}
	return s, nil
}

func normalize(c *Config) bool {
	if c.Services == nil {
		c.Services = []Service{}
	}
	changed := false
	maxOrder := 0
	for _, svc := range c.Services {
		if svc.Order > maxOrder {
			maxOrder = svc.Order
		}
	}
	for i := range c.Services {
		svc := &c.Services[i]
		if svc.Profiles == nil {
			svc.Profiles = []Profile{}
		}
		if len(svc.Profiles) == 0 {
			args := svc.Args
			env := svc.Env
			if args == nil {
				args = []Arg{}
			}
			if env == nil {
				env = []EnvVar{}
			}
			svc.Profiles = []Profile{{Name: "default", Args: args, Env: env}}
			svc.ActiveProfile = "default"
			svc.Args = nil
			svc.Env = nil
			changed = true
		}
		// always strip legacy fields from in-memory copy
		if svc.Args != nil || svc.Env != nil {
			svc.Args = nil
			svc.Env = nil
			changed = true
		}
		for pi := range svc.Profiles {
			p := &svc.Profiles[pi]
			if p.Args == nil {
				p.Args = []Arg{}
				changed = true
			}
			if p.Env == nil {
				p.Env = []EnvVar{}
				changed = true
			}
		}
		if findProfile(svc.Profiles, svc.ActiveProfile) == nil {
			svc.ActiveProfile = svc.Profiles[0].Name
			changed = true
		}
		if svc.Order == 0 {
			maxOrder++
			svc.Order = maxOrder
			changed = true
		}
	}
	return changed
}

func findProfile(profiles []Profile, name string) *Profile {
	for i := range profiles {
		if profiles[i].Name == name {
			return &profiles[i]
		}
	}
	return nil
}

// ActiveOrFirst returns the active profile or the first profile if active is missing.
func (s Service) ActiveOrFirst() Profile {
	if p := findProfile(s.Profiles, s.ActiveProfile); p != nil {
		return *p
	}
	if len(s.Profiles) > 0 {
		return s.Profiles[0]
	}
	return Profile{Name: "default", Args: []Arg{}, Env: []EnvVar{}}
}

func (s *Store) read() (Config, error) {
	b, err := os.ReadFile(s.path)
	if err != nil {
		return Config{}, err
	}
	var c Config
	if err := json.Unmarshal(b, &c); err != nil {
		return Config{}, err
	}
	normalize(&c)
	return c, nil
}

func (s *Store) write(c Config) error {
	b, err := json.MarshalIndent(c, "", "  ")
	if err != nil {
		return err
	}
	tmp := s.path + ".tmp"
	if err := os.WriteFile(tmp, b, 0o644); err != nil {
		return err
	}
	return os.Rename(tmp, s.path)
}

func sortServices(services []Service) {
	sort.SliceStable(services, func(i, j int) bool {
		return services[i].Order < services[j].Order
	})
}

func (s *Store) List() ([]Service, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	c, err := s.read()
	if err != nil {
		return nil, err
	}
	sortServices(c.Services)
	return c.Services, nil
}

func (s *Store) Get(id string) (Service, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	c, err := s.read()
	if err != nil {
		return Service{}, err
	}
	for _, svc := range c.Services {
		if svc.ID == id {
			return svc, nil
		}
	}
	return Service{}, fmt.Errorf("service %s not found", id)
}

func (s *Store) Create(svc Service) (Service, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	c, err := s.read()
	if err != nil {
		return Service{}, err
	}
	svc.ID = uuid.NewString()
	if len(svc.Profiles) == 0 {
		svc.Profiles = []Profile{{Name: "default", Args: []Arg{}, Env: []EnvVar{}}}
		svc.ActiveProfile = "default"
	}
	maxOrder := 0
	for _, x := range c.Services {
		if x.Order > maxOrder {
			maxOrder = x.Order
		}
	}
	svc.Order = maxOrder + 1
	c.Services = append(c.Services, svc)
	if err := s.write(c); err != nil {
		return Service{}, err
	}
	return svc, nil
}

func (s *Store) Update(id string, patch Service) (Service, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	c, err := s.read()
	if err != nil {
		return Service{}, err
	}
	for i, svc := range c.Services {
		if svc.ID == id {
			patch.ID = svc.ID
			if patch.Order == 0 {
				patch.Order = svc.Order
			}
			if patch.Profiles == nil || len(patch.Profiles) == 0 {
				patch.Profiles = svc.Profiles
				patch.ActiveProfile = svc.ActiveProfile
			}
			if findProfile(patch.Profiles, patch.ActiveProfile) == nil {
				patch.ActiveProfile = patch.Profiles[0].Name
			}
			for pi := range patch.Profiles {
				if patch.Profiles[pi].Args == nil {
					patch.Profiles[pi].Args = []Arg{}
				}
				if patch.Profiles[pi].Env == nil {
					patch.Profiles[pi].Env = []EnvVar{}
				}
			}
			c.Services[i] = patch
			if err := s.write(c); err != nil {
				return Service{}, err
			}
			return patch, nil
		}
	}
	return Service{}, fmt.Errorf("service %s not found", id)
}

func (s *Store) Delete(id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	c, err := s.read()
	if err != nil {
		return err
	}
	out := c.Services[:0]
	found := false
	for _, svc := range c.Services {
		if svc.ID == id {
			found = true
			continue
		}
		out = append(out, svc)
	}
	if !found {
		return fmt.Errorf("service %s not found", id)
	}
	c.Services = out
	return s.write(c)
}

// Reorder sets each id's Order to its position in the slice; ids not listed keep their position relative to the listed ones.
func (s *Store) Reorder(ids []string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	c, err := s.read()
	if err != nil {
		return err
	}
	pos := map[string]int{}
	for i, id := range ids {
		pos[id] = i + 1
	}
	maxListed := len(ids)
	for i := range c.Services {
		if p, ok := pos[c.Services[i].ID]; ok {
			c.Services[i].Order = p
		} else {
			maxListed++
			c.Services[i].Order = maxListed
		}
	}
	return s.write(c)
}

// ImportServices merges or replaces. In replace mode, all current services are dropped.
func (s *Store) ImportServices(incoming []Service, replace bool) ([]Service, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	c, err := s.read()
	if err != nil {
		return nil, err
	}
	if replace {
		c.Services = []Service{}
	}
	existingIDs := map[string]bool{}
	existingNames := map[string]bool{}
	for _, sv := range c.Services {
		existingIDs[sv.ID] = true
		existingNames[sv.Name] = true
	}
	maxOrder := 0
	for _, x := range c.Services {
		if x.Order > maxOrder {
			maxOrder = x.Order
		}
	}
	for _, sv := range incoming {
		if sv.ID == "" || existingIDs[sv.ID] || existingNames[sv.Name] {
			sv.ID = uuid.NewString()
		}
		if len(sv.Profiles) == 0 {
			args := sv.Args
			env := sv.Env
			if args == nil {
				args = []Arg{}
			}
			if env == nil {
				env = []EnvVar{}
			}
			sv.Profiles = []Profile{{Name: "default", Args: args, Env: env}}
			sv.ActiveProfile = "default"
			sv.Args = nil
			sv.Env = nil
		}
		maxOrder++
		sv.Order = maxOrder
		c.Services = append(c.Services, sv)
		existingIDs[sv.ID] = true
		existingNames[sv.Name] = true
	}
	normalize(&c)
	if err := s.write(c); err != nil {
		return nil, err
	}
	sortServices(c.Services)
	return c.Services, nil
}
