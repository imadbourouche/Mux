import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { useEscKey } from "../hooks/useEscKey";

type Props = {
  onCancel: () => void;
};

export function ExportDialog({ onCancel }: Props) {
  useEscKey(onCancel);
  const [content, setContent] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(api.exportUrl())
      .then(async (r) => {
        if (!r.ok) throw new Error(`${r.status}: ${await r.text()}`);
        return r.text();
      })
      .then((text) => {
        if (cancelled) return;
        try {
          setContent(JSON.stringify(JSON.parse(text), null, 2));
        } catch {
          setContent(text);
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function download() {
    const a = document.createElement("a");
    a.href = api.exportUrl();
    a.download = "services.json";
    a.click();
  }

  async function copyAll() {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  }

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div
        className="modal export-modal"
        onClick={(e) => e.stopPropagation()}
        style={{ width: 720, maxWidth: "90vw" }}
      >
        <h2>services.json</h2>
        <p className="hint" style={{ marginBottom: 10 }}>
          Env vars and arg values may include secrets — only save it somewhere you trust.
        </p>
        {error ? (
          <div className="error">{error}</div>
        ) : (
          <pre className="json-preview">
            <code>{content || "Loading…"}</code>
          </pre>
        )}
        <div className="modal-actions">
          <button onClick={copyAll} disabled={!content}>
            {copied ? "Copied!" : "Copy"}
          </button>
          <span className="spacer" />
          <button onClick={onCancel}>Close</button>
          <button onClick={download} className="primary" disabled={!content}>
            Export
          </button>
        </div>
      </div>
    </div>
  );
}
