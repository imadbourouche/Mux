import { useEffect, useRef, useState } from "react";
import type { LogLine } from "../lib/types";
import { renderAnsi } from "../lib/ansi";

function EyeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a19.77 19.77 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 11 8 11 8a19.86 19.86 0 0 1-3.17 4.19" />
      <path d="M14.12 14.12A3 3 0 1 1 9.88 9.88" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

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
        <button
          type="button"
          className="icon-btn mask-toggle"
          onClick={() => setMask((m) => !m)}
          title={mask ? "Show input" : "Hide input (mask for passwords)"}
          aria-label={mask ? "Show input" : "Hide input"}
          aria-pressed={mask}
        >
          {mask ? <EyeOffIcon /> : <EyeIcon />}
        </button>
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
        <button onClick={send} disabled={!running} className="primary">
          Send
        </button>
      </div>
    </div>
  );
}
