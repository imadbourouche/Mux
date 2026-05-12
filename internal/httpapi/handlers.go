package httpapi

import (
	"encoding/json"
	"net/http"
	"os/exec"
	"strings"

	"github.com/go-chi/chi/v5"

	"dev-dashboard/internal/store"
	"dev-dashboard/internal/supervisor"
)

type API struct {
	Store *store.Store
	Sup   *supervisor.Supervisor
}

type serviceWithState struct {
	store.Service
	State supervisor.State `json:"state"`
}

func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}

func writeError(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}

func (a *API) listServices(w http.ResponseWriter, _ *http.Request) {
	services, err := a.Store.List()
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}
	out := make([]serviceWithState, 0, len(services))
	for _, s := range services {
		out = append(out, serviceWithState{Service: s, State: a.Sup.GetState(s.ID)})
	}
	writeJSON(w, 200, map[string]any{"services": out})
}

func (a *API) getService(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	s, err := a.Store.Get(id)
	if err != nil {
		writeError(w, 404, err.Error())
		return
	}
	writeJSON(w, 200, serviceWithState{Service: s, State: a.Sup.GetState(id)})
}

func (a *API) createService(w http.ResponseWriter, r *http.Request) {
	var body store.Service
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, 400, err.Error())
		return
	}
	if strings.TrimSpace(body.Name) == "" {
		writeError(w, 400, "name is required")
		return
	}
	created, err := a.Store.Create(body)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}
	writeJSON(w, 201, serviceWithState{Service: created, State: a.Sup.GetState(created.ID)})
}

func (a *API) updateService(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var body store.Service
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, 400, err.Error())
		return
	}
	updated, err := a.Store.Update(id, body)
	if err != nil {
		writeError(w, 404, err.Error())
		return
	}
	writeJSON(w, 200, serviceWithState{Service: updated, State: a.Sup.GetState(id)})
}

func (a *API) deleteService(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	_, _ = a.Sup.Stop(id)
	if err := a.Store.Delete(id); err != nil {
		writeError(w, 404, err.Error())
		return
	}
	a.Sup.Drop(id)
	w.WriteHeader(204)
}

func (a *API) reorderServices(w http.ResponseWriter, r *http.Request) {
	var body struct {
		IDs []string `json:"ids"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, 400, err.Error())
		return
	}
	if err := a.Store.Reorder(body.IDs); err != nil {
		writeError(w, 500, err.Error())
		return
	}
	writeJSON(w, 200, map[string]bool{"ok": true})
}

func (a *API) startService(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	state, err := a.Sup.Start(id)
	if err != nil {
		writeError(w, 400, err.Error())
		return
	}
	writeJSON(w, 200, map[string]any{"state": state})
}

func (a *API) clearLogs(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	a.Sup.ClearLogs(id)
	writeJSON(w, 200, map[string]bool{"ok": true})
}

func (a *API) inputService(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var body struct {
		Data    string `json:"data"`
		Newline bool   `json:"newline"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, 400, err.Error())
		return
	}
	data := body.Data
	if body.Newline {
		data += "\n"
	}
	if err := a.Sup.Write(id, []byte(data)); err != nil {
		writeError(w, 400, err.Error())
		return
	}
	writeJSON(w, 200, map[string]bool{"ok": true})
}

func (a *API) stopService(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	state, err := a.Sup.Stop(id)
	if err != nil {
		writeError(w, 400, err.Error())
		return
	}
	writeJSON(w, 200, map[string]any{"state": state})
}

func (a *API) restartService(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	state, err := a.Sup.Restart(id)
	if err != nil {
		writeError(w, 400, err.Error())
		return
	}
	writeJSON(w, 200, map[string]any{"state": state})
}

func (a *API) startAll(w http.ResponseWriter, _ *http.Request) {
	if err := a.Sup.StartAll(); err != nil {
		writeError(w, 500, err.Error())
		return
	}
	writeJSON(w, 200, map[string]bool{"ok": true})
}

func (a *API) stopAll(w http.ResponseWriter, _ *http.Request) {
	a.Sup.StopAll()
	writeJSON(w, 200, map[string]bool{"ok": true})
}

func (a *API) pickFolder(w http.ResponseWriter, _ *http.Request) {
	cmd := exec.Command("osascript", "-e",
		`POSIX path of (choose folder with prompt "Select project folder")`)
	out, err := cmd.Output()
	if err != nil {
		writeJSON(w, 200, map[string]string{"path": ""})
		return
	}
	path := strings.TrimRight(string(out), "\r\n")
	path = strings.TrimRight(path, "/")
	writeJSON(w, 200, map[string]string{"path": path})
}

func (a *API) openInVSCode(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	s, err := a.Store.Get(id)
	if err != nil {
		writeError(w, 404, err.Error())
		return
	}
	if s.Cwd == "" {
		writeError(w, 400, "service has no cwd configured")
		return
	}
	cmd := exec.Command("open", "-a", "Visual Studio Code", s.Cwd)
	if err := cmd.Run(); err != nil {
		writeError(w, 500, "failed to launch code: "+err.Error())
		return
	}
	writeJSON(w, 200, map[string]bool{"ok": true})
}

func (a *API) openInTerminal(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	s, err := a.Store.Get(id)
	if err != nil {
		writeError(w, 404, err.Error())
		return
	}
	if s.Cwd == "" {
		writeError(w, 400, "service has no cwd configured")
		return
	}
	safePath := strings.ReplaceAll(s.Cwd, `"`, `\"`)
	script := `tell application "Terminal" to do script "cd \"` + safePath + `\""
tell application "Terminal" to activate`
	cmd := exec.Command("osascript", "-e", script)
	if err := cmd.Run(); err != nil {
		writeError(w, 500, "failed to launch terminal: "+err.Error())
		return
	}
	writeJSON(w, 200, map[string]bool{"ok": true})
}

func (a *API) exportServices(w http.ResponseWriter, _ *http.Request) {
	services, err := a.Store.List()
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Content-Disposition", `attachment; filename="services.json"`)
	_ = json.NewEncoder(w).Encode(map[string]any{"services": services})
}

func (a *API) importServices(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Mode     string          `json:"mode"`
		Services []store.Service `json:"services"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, 400, err.Error())
		return
	}
	if body.Mode != "merge" && body.Mode != "replace" {
		body.Mode = "merge"
	}
	out, err := a.Store.ImportServices(body.Services, body.Mode == "replace")
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}
	writeJSON(w, 200, map[string]any{"services": out})
}
