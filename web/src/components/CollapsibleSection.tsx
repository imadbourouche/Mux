import { useState, type ReactNode } from "react";

type Props = {
  title: string;
  hint?: string;
  defaultOpen?: boolean;
  children: ReactNode;
  rightSlot?: ReactNode;
};

export function CollapsibleSection({ title, hint, defaultOpen = true, children, rightSlot }: Props) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="section">
      <div className="section-header">
        <button
          type="button"
          className="section-toggle"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
        >
          <span className={`caret ${open ? "open" : ""}`}>▶</span>
          <h3>{title}</h3>
        </button>
        <span className="spacer" />
        {rightSlot && <div className="section-right" onClick={(e) => e.stopPropagation()}>{rightSlot}</div>}
      </div>
      {open && (
        <div className="section-body">
          {hint && <p className="hint">{hint}</p>}
          {children}
        </div>
      )}
    </div>
  );
}
