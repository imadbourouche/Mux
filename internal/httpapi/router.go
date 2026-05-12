package httpapi

import (
	"io/fs"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
)

func (a *API) Router(spa fs.FS) http.Handler {
	r := chi.NewRouter()
	r.Route("/api", func(r chi.Router) {
		r.Get("/services", a.listServices)
		r.Post("/services", a.createService)
		r.Post("/services/start-all", a.startAll)
		r.Post("/services/stop-all", a.stopAll)
		r.Post("/services/reorder", a.reorderServices)
		r.Get("/services/export", a.exportServices)
		r.Post("/services/import", a.importServices)
		r.Post("/pick-folder", a.pickFolder)
		r.Route("/services/{id}", func(r chi.Router) {
			r.Get("/", a.getService)
			r.Put("/", a.updateService)
			r.Delete("/", a.deleteService)
			r.Post("/start", a.startService)
			r.Post("/stop", a.stopService)
			r.Post("/restart", a.restartService)
			r.Post("/input", a.inputService)
			r.Post("/open-in-vscode", a.openInVSCode)
			r.Post("/open-in-terminal", a.openInTerminal)
			r.Delete("/logs", a.clearLogs)
			r.Get("/stream", a.stream)
		})
	})
	if spa != nil {
		r.Handle("/*", spaHandler(spa))
	}
	return r
}

func spaHandler(spa fs.FS) http.Handler {
	fileServer := http.FileServer(http.FS(spa))
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path := strings.TrimPrefix(r.URL.Path, "/")
		if path == "" {
			path = "index.html"
		}
		if _, err := fs.Stat(spa, path); err != nil {
			r2 := r.Clone(r.Context())
			r2.URL.Path = "/"
			http.ServeFileFS(w, r2, spa, "index.html")
			return
		}
		fileServer.ServeHTTP(w, r)
	})
}
