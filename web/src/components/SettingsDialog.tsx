import { useEffect, useState } from "react";
import {
  type Binding,
  type ShortcutId,
  SHORTCUT_LABELS,
  bindingFromEvent,
  formatBinding,
} from "../hooks/useShortcuts";
import { useEscKey } from "../hooks/useEscKey";
import { api } from "../lib/api";

type Props = {
  bindings: Record<ShortcutId, Binding>;
  onChange: (id: ShortcutId, b: Binding) => void;
  onReset: () => void;
  onCancel: () => void;
};

const ORDER: ShortcutId[] = [
  "quickSwitch",
  "shortcutsHelp",
  "startFocused",
  "restartFocused",
  "stopFocused",
];

function appLabel(p: string): string {
  if (!p) return "";
  const base = p.split("/").filter(Boolean).pop() ?? p;
  return base.endsWith(".app") ? base.slice(0, -4) : base;
}

export function SettingsDialog({ bindings, onChange, onReset, onCancel }: Props) {
  const [recording, setRecording] = useState<ShortcutId | null>(null);
  const [terminal, setTerminal] = useState<string>("");
  const [picking, setPicking] = useState(false);

  useEscKey(() => {
    if (recording) setRecording(null);
    else onCancel();
  });

  useEffect(() => {
    api.getSettings().then((s) => setTerminal(s.terminal ?? "")).catch(() => {});
  }, []);

  useEffect(() => {
    if (!recording) return;
    function onKey(e: KeyboardEvent) {
      const b = bindingFromEvent(e);
      if (!b) return;
      e.preventDefault();
      e.stopPropagation();
      if (b.key === "escape") {
        setRecording(null);
        return;
      }
      onChange(recording!, b);
      setRecording(null);
    }
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [recording, onChange]);

  async function chooseTerminal() {
    setPicking(true);
    try {
      const { path } = await api.pickApp();
      if (!path) return;
      setTerminal(path);
      await api.putSettings({ terminal: path });
    } finally {
      setPicking(false);
    }
  }

  async function clearTerminal() {
    setTerminal("");
    await api.putSettings({ terminal: "" });
  }

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ width: 560 }}>
        <h2>Settings</h2>

        <div className="settings-block">
          <h3 className="settings-h3">Default terminal</h3>
          <p className="hint" style={{ marginBottom: 10 }}>
            Used by "Open in Terminal". Click <b>Choose application…</b> to browse
            <code>/Applications</code> and pick any <code>.app</code> bundle.
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ flex: 1, fontFamily: "ui-monospace, Menlo, monospace", fontSize: 12 }}>
              {terminal ? (
                <>
                  <div style={{ fontWeight: 500, fontFamily: "inherit" }}>{appLabel(terminal)}</div>
                  <div className="hint" style={{ marginTop: 2 }}>{terminal}</div>
                </>
              ) : (
                <span className="hint">Auto — first installed terminal will be used</span>
              )}
            </div>
            <button onClick={chooseTerminal} disabled={picking}>
              {picking ? "Opening picker…" : terminal ? "Change…" : "Choose application…"}
            </button>
            {terminal && (
              <button className="danger-ghost" onClick={clearTerminal} title="Reset to auto">
                Clear
              </button>
            )}
          </div>
        </div>

        <div className="settings-block">
          <h3 className="settings-h3">Keyboard shortcuts</h3>
          <p className="hint" style={{ marginBottom: 10 }}>
            Click a binding to record a new key combo. On macOS use ⌘/⌥; on Linux/Windows use Ctrl/Alt.
          </p>
          <table className="shortcuts-table">
            <tbody>
              <tr>
                <td>Close any open dialog</td>
                <td className="shortcuts-keys">
                  <kbd className="kbd">Esc</kbd>
                </td>
                <td />
              </tr>
              {ORDER.map((id) => {
                const b = bindings[id];
                const isRec = recording === id;
                return (
                  <tr key={id}>
                    <td>{SHORTCUT_LABELS[id]}</td>
                    <td className="shortcuts-keys">
                      {isRec ? (
                        <span className="hint">Press a key combo… (Esc to cancel)</span>
                      ) : (
                        formatBinding(b).map((k, i) => (
                          <span key={i}>
                            <kbd className="kbd">{k}</kbd>
                            {i < formatBinding(b).length - 1 && <span className="kbd-sep">+</span>}
                          </span>
                        ))
                      )}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <button onClick={() => setRecording(isRec ? null : id)}>
                        {isRec ? "Cancel" : "Edit"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="modal-actions">
          <button onClick={onReset}>Reset shortcuts</button>
          <span className="spacer" />
          <button onClick={onCancel} className="primary">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
