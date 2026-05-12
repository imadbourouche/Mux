package main

import (
	"context"
	"embed"
	"errors"
	"fmt"
	"io/fs"
	"log"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"syscall"
	"time"

	"mux/internal/httpapi"
	"mux/internal/store"
	"mux/internal/supervisor"
)

//go:embed all:web/dist
var spaFS embed.FS

// Version is injected at build time via -ldflags "-X main.Version=..."
var Version = "dev"

func resolveDataDir() (string, error) {
	if v := os.Getenv("MUX_HOME"); v != "" {
		return v, nil
	}
	home, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(home, ".mux", "data"), nil
}

// Move ~/.servo to ~/.mux on first start so existing users don't lose their config.
func migrateServoHome() {
	home, err := os.UserHomeDir()
	if err != nil {
		return
	}
	newDir := filepath.Join(home, ".mux")
	oldDir := filepath.Join(home, ".servo")
	if _, err := os.Stat(newDir); err == nil {
		return // new already exists
	}
	if _, err := os.Stat(oldDir); err != nil {
		return // nothing to migrate
	}
	if err := os.Rename(oldDir, newDir); err != nil {
		log.Printf("mux: failed to rename %s -> %s: %v", oldDir, newDir, err)
		return
	}
	log.Printf("mux: migrated %s -> %s", oldDir, newDir)
}

// Migrate a legacy services.json sitting next to the binary (cwd/data/...) into
// the new ~/.mux/data location if the new file doesn't yet exist.
func migrateLegacyServices(newPath string) {
	if _, err := os.Stat(newPath); err == nil {
		return // already exists, nothing to do
	}
	cwd, err := os.Getwd()
	if err != nil {
		return
	}
	legacy := filepath.Join(cwd, "data", "services.json")
	data, err := os.ReadFile(legacy)
	if err != nil {
		return
	}
	if err := os.MkdirAll(filepath.Dir(newPath), 0o755); err != nil {
		return
	}
	if err := os.WriteFile(newPath, data, 0o644); err != nil {
		return
	}
	log.Printf("mux: migrated services from %s to %s", legacy, newPath)
}

func main() {
	if len(os.Args) > 1 && (os.Args[1] == "--version" || os.Args[1] == "-v") {
		fmt.Println("mux", Version)
		return
	}

	addr := ":4000"
	if v := os.Getenv("PORT"); v != "" {
		addr = ":" + v
	}

	migrateServoHome()

	dataDir, err := resolveDataDir()
	if err != nil {
		log.Fatalf("resolve data dir: %v", err)
	}
	servicesPath := filepath.Join(dataDir, "services.json")
	shortcutsPath := filepath.Join(dataDir, "shortcuts.json")
	settingsPath := filepath.Join(dataDir, "settings.json")

	migrateLegacyServices(servicesPath)

	st, err := store.New(servicesPath)
	if err != nil {
		log.Fatalf("store init: %v", err)
	}
	sc, err := store.NewShortcuts(shortcutsPath)
	if err != nil {
		log.Fatalf("shortcuts init: %v", err)
	}
	settings, err := store.NewSettings(settingsPath)
	if err != nil {
		log.Fatalf("settings init: %v", err)
	}
	sup := supervisor.New(st)
	sup.StartPortWatcher(3 * time.Second)

	api := &httpapi.API{Store: st, Shortcuts: sc, Settings: settings, Sup: sup}

	var spa fs.FS
	if sub, err := fs.Sub(spaFS, "web/dist"); err == nil {
		if _, err := fs.Stat(sub, "index.html"); err == nil {
			spa = sub
		}
	}
	if spa == nil {
		log.Println("note: SPA not embedded (web/dist missing); api-only mode")
	}

	handler := api.Router(spa)
	server := &http.Server{Addr: addr, Handler: handler}

	go func() {
		log.Printf("mux %s listening on http://localhost%s  (data: %s)", Version, addr, dataDir)
		if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Fatalf("listen: %v", err)
		}
	}()

	sigs := make(chan os.Signal, 1)
	signal.Notify(sigs, syscall.SIGINT, syscall.SIGTERM)
	<-sigs
	log.Println("shutting down: stopping all services")
	sup.StopAll()
	time.Sleep(500 * time.Millisecond)
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	_ = server.Shutdown(ctx)
}
