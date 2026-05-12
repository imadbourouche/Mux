import { useEscKey } from "../hooks/useEscKey";

type Source<T> = { id: string; name: string; items: T[] };

type Props<T> = {
  title: string;
  itemLabel: string;
  sources: Source<T>[];
  onApply: (items: T[], mode: "append" | "replace") => void;
  onCancel: () => void;
};

export function CopyFromDialog<T>({ title, itemLabel, sources, onApply, onCancel }: Props<T>) {
  useEscKey(onCancel);
  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ width: 520 }}>
        <h2>{title}</h2>
        <p className="hint">
          Pick a source service and choose <b>Append</b> (merge, skipping duplicates) or{" "}
          <b>Replace</b> (overwrite current values).
        </p>
        <div className="copy-source-list">
          {sources.length === 0 && (
            <div className="hint" style={{ padding: 12 }}>
              No other services to copy from.
            </div>
          )}
          {sources.map((s) => (
            <div key={s.id} className="copy-source-row">
              <div className="copy-source-meta">
                <div className="copy-source-name">{s.name || "(unnamed)"}</div>
                <div className="hint">
                  {s.items.length} {itemLabel}
                </div>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button
                  onClick={() => {
                    onApply(s.items, "append");
                    onCancel();
                  }}
                  disabled={s.items.length === 0}
                >
                  Append
                </button>
                <button
                  className="danger-ghost"
                  onClick={() => {
                    onApply(s.items, "replace");
                    onCancel();
                  }}
                  disabled={s.items.length === 0}
                >
                  Replace
                </button>
              </div>
            </div>
          ))}
        </div>
        <div className="modal-actions">
          <button onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
