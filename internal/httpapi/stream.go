package httpapi

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/gorilla/websocket"

	"mux/internal/supervisor"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(_ *http.Request) bool { return true },
}

func (a *API) stream(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		return
	}
	defer conn.Close()

	lines, state := a.Sup.Snapshot(id)
	st := state
	if err := conn.WriteJSON(supervisor.Event{
		Type:  "snapshot",
		Logs:  lines,
		State: &st,
	}); err != nil {
		return
	}

	ch, unsub := a.Sup.Subscribe(id)
	defer unsub()

	done := make(chan struct{})
	go func() {
		defer close(done)
		for {
			if _, _, err := conn.ReadMessage(); err != nil {
				return
			}
		}
	}()

	for {
		select {
		case <-done:
			return
		case ev, ok := <-ch:
			if !ok {
				return
			}
			if err := conn.WriteJSON(ev); err != nil {
				return
			}
		}
	}
}
