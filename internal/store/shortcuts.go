package store

import (
	"encoding/json"
	"os"
	"path/filepath"
	"sync"
)

type Binding struct {
	MetaOrCtrl bool   `json:"metaOrCtrl"`
	Shift      bool   `json:"shift"`
	Alt        bool   `json:"alt"`
	Key        string `json:"key"`
}

type ShortcutsStore struct {
	mu   sync.Mutex
	path string
}

func NewShortcuts(path string) (*ShortcutsStore, error) {
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return nil, err
	}
	return &ShortcutsStore{path: path}, nil
}

func (s *ShortcutsStore) Load() (map[string]Binding, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, err := os.Stat(s.path); os.IsNotExist(err) {
		return map[string]Binding{}, nil
	}
	b, err := os.ReadFile(s.path)
	if err != nil {
		return nil, err
	}
	var m map[string]Binding
	if err := json.Unmarshal(b, &m); err != nil {
		return nil, err
	}
	if m == nil {
		m = map[string]Binding{}
	}
	return m, nil
}

func (s *ShortcutsStore) Save(m map[string]Binding) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if m == nil {
		m = map[string]Binding{}
	}
	b, err := json.MarshalIndent(m, "", "  ")
	if err != nil {
		return err
	}
	tmp := s.path + ".tmp"
	if err := os.WriteFile(tmp, b, 0o644); err != nil {
		return err
	}
	return os.Rename(tmp, s.path)
}
