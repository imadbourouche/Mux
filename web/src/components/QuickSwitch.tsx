import { useEffect, useMemo, useRef, useState } from "react";
import type { Service } from "../lib/types";
import { useEscKey } from "../hooks/useEscKey";

type Props = {
  services: Service[];
  onPick: (id: string) => void;
  onCancel: () => void;
};

export function QuickSwitch({ services, onPick, onCancel }: Props) {
  useEscKey(onCancel);
  const [q, setQ] = useState("");
  const [idx, setIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return services;
    return services.filter((s) => s.name.toLowerCase().includes(needle));
  }, [services, q]);

  useEffect(() => {
    setIdx(0);
  }, [q]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  function onKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setIdx((i) => Math.min(filtered.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setIdx((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filtered[idx]) onPick(filtered[idx].id);
    } else if (e.key === "Escape") {
      e.preventDefault();
      onCancel();
    }
  }

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal quick-switch" onClick={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={onKey}
          placeholder="Switch to service…"
          autoFocus
        />
        <ul className="quick-switch-list">
          {filtered.map((s, i) => (
            <li
              key={s.id}
              className={`quick-switch-item ${i === idx ? "active" : ""}`}
              onMouseEnter={() => setIdx(i)}
              onClick={() => onPick(s.id)}
            >
              <span className={`status-dot ${s.state?.status ?? "stopped"}`} />
              <span style={{ flex: 1 }}>{s.name || "(unnamed)"}</span>
            </li>
          ))}
          {filtered.length === 0 && (
            <li className="quick-switch-item empty">No services match "{q}"</li>
          )}
        </ul>
      </div>
    </div>
  );
}
