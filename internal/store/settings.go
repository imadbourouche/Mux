package store

import (
	"encoding/json"
	"os"
	"path/filepath"
	"sync"
)

type Settings struct {
	Terminal string `json:"terminal"`
}

type SettingsStore struct {
	mu   sync.Mutex
	path string
}

func NewSettings(path string) (*SettingsStore, error) {
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return nil, err
	}
	return &SettingsStore{path: path}, nil
}

func (s *SettingsStore) Load() (Settings, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, err := os.Stat(s.path); os.IsNotExist(err) {
		return Settings{}, nil
	}
	b, err := os.ReadFile(s.path)
	if err != nil {
		return Settings{}, err
	}
	var v Settings
	if err := json.Unmarshal(b, &v); err != nil {
		return Settings{}, err
	}
	return v, nil
}

func (s *SettingsStore) Save(v Settings) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	b, err := json.MarshalIndent(v, "", "  ")
	if err != nil {
		return err
	}
	tmp := s.path + ".tmp"
	if err := os.WriteFile(tmp, b, 0o644); err != nil {
		return err
	}
	return os.Rename(tmp, s.path)
}
