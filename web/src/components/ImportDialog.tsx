import { useState } from "react";
import type { Service } from "../lib/types";
import { useEscKey } from "../hooks/useEscKey";

type Props = {
  onImport: (services: Service[], mode: "merge" | "replace") => Promise<void>;
  onCancel: () => void;
};

export function ImportDialog({ onImport, onCancel }: Props) {
  useEscKey(onCancel);
  const [services, setServices] = useState<Service[] | null>(null);
  const [filename, setFilename] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setError(null);
    setFilename(f.name);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        const arr: Service[] = Array.isArray(parsed) ? parsed : parsed.services;
        if (!Array.isArray(arr)) {
          setError("Invalid file: expected an array of services or { services: [...] }.");
          return;
        }
        setServices(arr);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    };
    reader.readAsText(f);
  }

  async function go(mode: "merge" | "replace") {
    if (!services) return;
    setBusy(true);
    try {
      await onImport(services, mode);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ width: 480 }}>
        <h2>Import services</h2>
        <p className="hint">
          Select a previously exported <code>services.json</code> file.
        </p>
        <input type="file" accept="application/json,.json" onChange={onFile} />
        {filename && <div className="hint">Loaded: {filename}</div>}
        {services && (
          <div className="hint">
            Detected <b>{services.length}</b> service(s).
          </div>
        )}
        {error && <div className="error">{error}</div>}
        <p className="hint" style={{ marginTop: 8 }}>
          <b>Merge</b> appends; <b>Replace</b> drops all current services and uses only the imported ones.
        </p>
        <div className="modal-actions">
          <button onClick={onCancel}>Cancel</button>
          <button onClick={() => go("merge")} disabled={!services || busy} className="primary">
            Merge
          </button>
          <button onClick={() => go("replace")} disabled={!services || busy} className="danger">
            Replace
          </button>
        </div>
      </div>
    </div>
  );
}
