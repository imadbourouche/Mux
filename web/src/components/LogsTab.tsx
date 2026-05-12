import { useEffect, useRef, useState } from "react";
import type { LogLine } from "../lib/types";
import { renderAnsi } from "../lib/ansi";

type Props = {
  logs: LogLine[];
  running: boolean;
  onClear: () => void;
  onSendInput: (data: string, newline: boolean) => void;
};

const MIN_FONT = 2;
const MAX_FONT = 22;
const FONT_KEY = "dev-dashboard-log-font";

export function LogsTab({ logs, running, onClear, onSendInput }: Props) {
  const [autoScroll, setAutoScroll] = useState(true);
  const [fontSize, setFontSize] = useState<number>(() => {
    const stored = Number(localStorage.getItem(FONT_KEY));
    return stored >= MIN_FONT && stored <= MAX_FONT ? stored : 12;
  });
  const [input, setInput] = useState("");
  const [mask, setMask] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    localStorage.setItem(FONT_KEY, String(fontSize));
  }, [fontSize]);

  useEffect(() => {
    if (!autoScroll) return;
    const el = ref.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [logs, autoScroll]);

  function onScroll() {
    const el = ref.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    setAutoScroll(atBottom);
  }

  function send() {
    if (!running) return;
    onSendInput(input, true);
    setInput("");
  }

  function onInputKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      send();
    }
  }

  return (
    <div className="logs-tab">
      <div className="log-toolbar">
        <span className="hint">
          {logs.length} lines {autoScroll ? "· auto-scroll on" : "· auto-scroll paused"}
        </span>
        <span className="spacer" />
        <div className="log-zoom">
          <button
            className="icon-btn"
            onClick={() => setFontSize((s) => Math.max(MIN_FONT, s - 1))}
            title="Zoom out"
            disabled={fontSize <= MIN_FONT}
          >
            −
          </button>
          <span className="hint" style={{ minWidth: 28, textAlign: "center" }}>
            {fontSize}
          </span>
          <button
            className="icon-btn"
            onClick={() => setFontSize((s) => Math.min(MAX_FONT, s + 1))}
            title="Zoom in"
            disabled={fontSize >= MAX_FONT}
          >
            +
          </button>
        </div>
        <button onClick={onClear} title="Clear logs">
          Clear logs
        </button>
      </div>
      <div
        className="log-view"
        ref={ref}
        onScroll={onScroll}
        style={{ fontSize: `${fontSize}px` }}
      >
        <table className="log-table">
          <tbody>
            {logs.map((l, i) => (
              <tr key={i} className={`log-row ${l.stream}`}>
                <td className="log-ts">{new Date(l.ts).toLocaleTimeString("en-GB")}</td>
                <td className="log-text">{renderAnsi(l.text)}</td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr>
                <td colSpan={2} className="log-empty">
                  (no logs yet)
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="input-bar">
        <input
          type={mask ? "password" : "text"}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onInputKey}
          placeholder={
            running
              ? "Send to process stdin (e.g. sudo password, Quarkus 'r'/'q')…"
              : "Service not running"
          }
          disabled={!running}
        />
        <label className="checkbox-label" title="Mask input (for passwords)">
          <input type="checkbox" checked={mask} onChange={(e) => setMask(e.target.checked)} />
          mask
        </label>
        <button onClick={send} disabled={!running} className="primary">
          Send
        </button>
      </div>
    </div>
  );
}
