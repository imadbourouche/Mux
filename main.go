package main

import (
	"context"
	"embed"
	"errors"
	"io/fs"
	"log"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"syscall"
	"time"

	"dev-dashboard/internal/httpapi"
	"dev-dashboard/internal/store"
	"dev-dashboard/internal/supervisor"
)

//go:embed all:web/dist
var spaFS embed.FS

func main() {
	addr := ":4000"
	if v := os.Getenv("PORT"); v != "" {
		addr = ":" + v
	}

	dataPath := os.Getenv("DATA_PATH")
	if dataPath == "" {
		cwd, _ := os.Getwd()
		dataPath = filepath.Join(cwd, "data", "services.json")
	}

	st, err := store.New(dataPath)
	if err != nil {
		log.Fatalf("store init: %v", err)
	}
	sup := supervisor.New(st)
	sup.StartPortWatcher(3 * time.Second)

	api := &httpapi.API{Store: st, Sup: sup}

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
		log.Printf("dev-dashboard listening on http://localhost%s", addr)
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
