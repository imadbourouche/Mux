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
      <button
        type="button"
        className="section-header"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className={`caret ${open ? "open" : ""}`}>▶</span>
        <h3>{title}</h3>
        <span className="spacer" />
        {rightSlot}
      </button>
      {open && (
        <div className="section-body">
          {hint && <p className="hint">{hint}</p>}
          {children}
        </div>
      )}
    </div>
  );
}
