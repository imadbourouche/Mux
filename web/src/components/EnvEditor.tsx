import { useState } from "react";
import type { EnvVar } from "../lib/types";
import { CollapsibleSection } from "./CollapsibleSection";
import { CopyFromDialog } from "./CopyFromDialog";

type Source = { id: string; name: string; items: EnvVar[] };

type Props = {
  value: EnvVar[];
  onChange: (next: EnvVar[]) => void;
  sources?: Source[];
};

export function EnvEditor({ value, onChange, sources = [] }: Props) {
  const [showCopy, setShowCopy] = useState(false);

  function setRow(idx: number, patch: Partial<EnvVar>) {
    onChange(value.map((e, i) => (i === idx ? { ...e, ...patch } : e)));
  }
  function remove(idx: number) {
    onChange(value.filter((_, i) => i !== idx));
  }
  function add() {
    onChange([...value, { key: "", value: "", enabled: true }]);
  }
  function applyCopy(items: EnvVar[], mode: "append" | "replace") {
    const clones = items.map((e) => ({ ...e }));
    if (mode === "replace") {
      onChange(clones);
      return;
    }
    const have = new Set(value.map((e) => e.key));
    const merged = value.concat(clones.filter((e) => !have.has(e.key)));
    onChange(merged);
  }

  return (
    <CollapsibleSection
      title={`Environment variables (${value.length})`}
      hint="Injected into the service's environment at start."
      defaultOpen={false}
    >
      <div className="kv-table">
        {value.map((e, idx) => (
          <div key={idx} className={`kv-row ${e.enabled ? "" : "disabled"} env-row`}>
            <input
              type="checkbox"
              checked={e.enabled}
              onChange={(ev) => setRow(idx, { enabled: ev.target.checked })}
            />
            <input
              type="text"
              placeholder="KEY"
              value={e.key}
              onChange={(ev) => setRow(idx, { key: ev.target.value })}
            />
            <input
              type="text"
              placeholder="value"
              value={e.value}
              onChange={(ev) => setRow(idx, { value: ev.target.value })}
            />
            <button className="icon-btn" onClick={() => remove(idx)} title="Remove">
              ✕
            </button>
          </div>
        ))}
        <div className="editor-actions">
          <button onClick={add} className="add-btn">
            + Add variable
          </button>
          {sources.length > 0 && (
            <button onClick={() => setShowCopy(true)} className="add-btn">
              Copy from…
            </button>
          )}
        </div>
      </div>
      {showCopy && (
        <CopyFromDialog<EnvVar>
          title="Copy environment variables"
          itemLabel="variables"
          sources={sources}
          onApply={applyCopy}
          onCancel={() => setShowCopy(false)}
        />
      )}
    </CollapsibleSection>
  );
}
