package store

import (
	"os"
	"path/filepath"
)

// KnownTerminals lists terminal apps Mux can launch on macOS.
// Order is the fallback preference order when no setting is configured.
var KnownTerminals = []struct {
	Name   string // user-facing label
	App    string // `open -a` name
	Bundle string // .app bundle name
}{
	{"iTerm", "iTerm", "iTerm.app"},
	{"Warp", "Warp", "Warp.app"},
	{"WezTerm", "WezTerm", "WezTerm.app"},
	{"Alacritty", "Alacritty", "Alacritty.app"},
	{"kitty", "kitty", "kitty.app"},
	{"Ghostty", "Ghostty", "Ghostty.app"},
	{"Hyper", "Hyper", "Hyper.app"},
	{"Tabby", "Tabby", "Tabby.app"},
	{"Terminal", "Terminal", "Terminal.app"},
}

// DetectInstalledTerminals returns the `open -a` names of terminal apps
// that exist in the standard macOS locations.
func DetectInstalledTerminals() []string {
	locs := []string{"/Applications", "/System/Applications"}
	if home, err := os.UserHomeDir(); err == nil {
		locs = append(locs, filepath.Join(home, "Applications"))
	}
	var found []string
	for _, t := range KnownTerminals {
		for _, loc := range locs {
			if _, err := os.Stat(filepath.Join(loc, t.Bundle)); err == nil {
				found = append(found, t.App)
				break
			}
		}
	}
	return found
}
