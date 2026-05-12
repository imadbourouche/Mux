import { useState } from "react";
import type { Arg } from "../lib/types";
import { CollapsibleSection } from "./CollapsibleSection";
import { CopyFromDialog } from "./CopyFromDialog";

type Source = { id: string; name: string; items: Arg[] };

type Props = {
  value: Arg[];
  onChange: (next: Arg[]) => void;
  sources?: Source[];
};

export function ArgsEditor({ value, onChange, sources = [] }: Props) {
  const [showCopy, setShowCopy] = useState(false);

  function setRow(idx: number, patch: Partial<Arg>) {
    onChange(value.map((a, i) => (i === idx ? { ...a, ...patch } : a)));
  }
  function remove(idx: number) {
    onChange(value.filter((_, i) => i !== idx));
  }
  function add() {
    onChange([...value, { value: "", enabled: true }]);
  }
  function applyCopy(items: Arg[], mode: "append" | "replace") {
    const clones = items.map((a) => ({ ...a }));
    if (mode === "replace") {
      onChange(clones);
      return;
    }
    const have = new Set(value.map((a) => a.value));
    const merged = value.concat(clones.filter((a) => !have.has(a.value)));
    onChange(merged);
  }

  return (
    <CollapsibleSection
      title={`Command-line arguments (${value.length})`}
      hint="Appended to the command at start, space-separated."
      defaultOpen={false}
    >
      <div className="kv-table">
        {value.map((a, idx) => (
          <div key={idx} className={`kv-row ${a.enabled ? "" : "disabled"} args-row`}>
            <input
              type="checkbox"
              checked={a.enabled}
              onChange={(e) => setRow(idx, { enabled: e.target.checked })}
            />
            <input
              type="text"
              placeholder="-Dquarkus.datasource.devservices.port=5433"
              value={a.value}
              onChange={(e) => setRow(idx, { value: e.target.value })}
            />
            <button className="icon-btn" onClick={() => remove(idx)} title="Remove">
              ✕
            </button>
          </div>
        ))}
        <div className="editor-actions">
          <button onClick={add} className="add-btn">
            + Add argument
          </button>
          {sources.length > 0 && (
            <button onClick={() => setShowCopy(true)} className="add-btn">
              Copy from…
            </button>
          )}
        </div>
      </div>
      {showCopy && (
        <CopyFromDialog<Arg>
          title="Copy command-line arguments"
          itemLabel="arguments"
          sources={sources}
          onApply={applyCopy}
          onCancel={() => setShowCopy(false)}
        />
      )}
    </CollapsibleSection>
  );
}
