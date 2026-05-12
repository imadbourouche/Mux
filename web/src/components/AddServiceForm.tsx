import { useState } from "react";
import type { Service } from "../lib/types";
import { api } from "../lib/api";

type Props = {
  onCancel: () => void;
  onCreate: (svc: Partial<Service>) => Promise<void>;
};

function basename(p: string): string {
  const parts = p.split("/").filter(Boolean);
  return parts[parts.length - 1] ?? "";
}

export function AddServiceForm({ onCancel, onCreate }: Props) {
  const [name, setName] = useState("");
  const [cwd, setCwd] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [picking, setPicking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pickProject() {
    setError(null);
    setPicking(true);
    try {
      const { path } = await api.pickFolder();
      if (!path) return;
      setCwd(path);
      if (!name.trim()) setName(basename(path));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setPicking(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await onCreate({
        name: name.trim(),
        cwd: cwd.trim(),
        command: "",
        profiles: [{ name: "default", args: [], env: [] }],
        activeProfile: "default",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <h2>Add service</h2>
        <button type="button" className="primary" onClick={pickProject} disabled={picking}>
          {picking ? "Opening picker…" : "Import local project…"}
        </button>
        <div className="divider">or</div>
        <div className="row">
          <label>Name</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
        </div>
        <div className="row">
          <label>Path</label>
          <input
            type="text"
            value={cwd}
            onChange={(e) => setCwd(e.target.value)}
            placeholder="/absolute/path/to/project"
          />
        </div>
        {error && <div className="error">{error}</div>}
        <div className="modal-actions">
          <button type="button" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" className="primary" disabled={submitting || !name.trim()}>
            {submitting ? "Creating…" : "Create"}
          </button>
        </div>
      </form>
    </div>
  );
}
