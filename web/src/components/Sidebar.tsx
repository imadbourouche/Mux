import { useEffect, useRef, useState } from "react";
import type { Service, ServiceStatus } from "../lib/types";

type Action = "start" | "restart" | "stop";

type Props = {
  services: Service[];
  selectedId: string | null;
  width: number;
  onWidthChange: (w: number) => void;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onStartAll: () => void;
  onStopAll: () => void;
  onImport: () => void;
  onExport: () => void;
  onServiceAction: (id: string, action: Action) => void;
  onReorder: (orderedIds: string[]) => void;
};

function ImportIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}

function JsonIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M8 3H6a2 2 0 0 0-2 2v4a2 2 0 0 1-2 2 2 2 0 0 1 2 2v4a2 2 0 0 0 2 2h2" />
      <path d="M16 3h2a2 2 0 0 1 2 2v4a2 2 0 0 0 2 2 2 2 0 0 0-2 2v4a2 2 0 0 1-2 2h-2" />
    </svg>
  );
}

const MIN_WIDTH = 220;
const MAX_WIDTH = 520;

export function Sidebar(props: Props) {
  const {
    services,
    selectedId,
    width,
    onWidthChange,
    onSelect,
    onAdd,
    onStartAll,
    onStopAll,
    onImport,
    onExport,
    onServiceAction,
    onReorder,
  } = props;

  const draggingRef = useRef(false);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const dragIdRef = useRef<string | null>(null);
  const [armed, setArmed] = useState<null | "start" | "stop">(null);
  const armTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (armTimerRef.current) window.clearTimeout(armTimerRef.current);
    };
  }, []);

  function armConfirm(which: "start" | "stop") {
    setArmed(which);
    if (armTimerRef.current) window.clearTimeout(armTimerRef.current);
    armTimerRef.current = window.setTimeout(() => setArmed(null), 3000);
  }
  function handleStartAll() {
    if (armed === "start") {
      if (armTimerRef.current) window.clearTimeout(armTimerRef.current);
      setArmed(null);
      onStartAll();
    } else {
      armConfirm("start");
    }
  }
  function handleStopAll() {
    if (armed === "stop") {
      if (armTimerRef.current) window.clearTimeout(armTimerRef.current);
      setArmed(null);
      onStopAll();
    } else {
      armConfirm("stop");
    }
  }

  useEffect(() => {
    function onMove(e: MouseEvent) {
      if (!draggingRef.current) return;
      const next = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, e.clientX));
      onWidthChange(next);
    }
    function onUp() {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [onWidthChange]);

  function startDrag(e: React.MouseEvent) {
    e.preventDefault();
    draggingRef.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }

  function onRowDragStart(id: string, e: React.DragEvent) {
    dragIdRef.current = id;
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", id);
  }
  function onRowDragOver(id: string, e: React.DragEvent) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverId !== id) setDragOverId(id);
  }
  function onRowDragLeave() {
    setDragOverId(null);
  }
  function onRowDrop(targetId: string, e: React.DragEvent) {
    e.preventDefault();
    const srcId = dragIdRef.current ?? e.dataTransfer.getData("text/plain");
    dragIdRef.current = null;
    setDragOverId(null);
    if (!srcId || srcId === targetId) return;
    const ids = services.map((s) => s.id);
    const from = ids.indexOf(srcId);
    const to = ids.indexOf(targetId);
    if (from === -1 || to === -1) return;
    const next = ids.slice();
    next.splice(from, 1);
    next.splice(to, 0, srcId);
    onReorder(next);
  }

  void width;

  return (
    <aside className="sidebar" style={{ width }}>
      <div className="sidebar-header">
        <button className="primary" onClick={onAdd}>
          + Add service
        </button>
        <div className="sidebar-actions">
          <button
            className={`start-all ${armed === "start" ? "armed" : ""}`}
            onClick={handleStartAll}
          >
            {armed === "start" ? "Sure to start all?" : "Start all"}
          </button>
          <button
            className={`stop-all ${armed === "stop" ? "armed" : ""}`}
            onClick={handleStopAll}
          >
            {armed === "stop" ? "Sure to stop all?" : "Stop all"}
          </button>
        </div>
      </div>
      <ul className="service-list">
        {services.map((s) => (
          <ServiceRow
            key={s.id}
            svc={s}
            selected={selectedId === s.id}
            dragOver={dragOverId === s.id}
            onSelect={() => onSelect(s.id)}
            onAction={(a) => onServiceAction(s.id, a)}
            onDragStart={(e) => onRowDragStart(s.id, e)}
            onDragOver={(e) => onRowDragOver(s.id, e)}
            onDragLeave={onRowDragLeave}
            onDrop={(e) => onRowDrop(s.id, e)}
          />
        ))}
        {services.length === 0 && (
          <li className="service-item empty-item">No services. Click "Add service".</li>
        )}
      </ul>
      <div className="sidebar-footer">
        <div className="sidebar-footer-actions">
          <button
            className="icon-btn"
            onClick={onImport}
            title="Import services from a file"
            aria-label="Import services"
          >
            <ImportIcon />
          </button>
          <button
            className="icon-btn"
            onClick={onExport}
            title="Show services.json"
            aria-label="Show services.json"
          >
            <JsonIcon />
          </button>
        </div>
        <span className="sidebar-version">v1.0.0</span>
      </div>
      <div className="sidebar-resizer" onMouseDown={startDrag} title="Drag to resize" />
    </aside>
  );
}

function ServiceRow({
  svc,
  selected,
  dragOver,
  onSelect,
  onAction,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
}: {
  svc: Service;
  selected: boolean;
  dragOver: boolean;
  onSelect: () => void;
  onAction: (a: Action) => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
}) {
  const status: ServiceStatus = svc.state?.status ?? "stopped";
  const running = status === "running";
  const firstPort = svc.state?.ports?.[0];

  function act(a: Action, e: React.MouseEvent) {
    e.stopPropagation();
    onAction(a);
  }

  return (
    <li
      className={`service-item ${selected ? "active" : ""} ${dragOver ? "drag-over" : ""}`}
      onClick={onSelect}
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <span className={`status-dot ${status}`} />
      <div className="service-name-col">
        <span className="service-name">{svc.name || "(unnamed)"}</span>
        {firstPort && <span className="service-port">:{firstPort}</span>}
      </div>
      <div className="service-actions">
        <button
          className="row-action start"
          title="Start"
          disabled={running}
          onClick={(e) => act("start", e)}
        >
          ▶
        </button>
        <button
          className="row-action restart"
          title="Restart"
          disabled={!running}
          onClick={(e) => act("restart", e)}
        >
          ↻
        </button>
        <button
          className="row-action stop"
          title="Kill"
          disabled={!running}
          onClick={(e) => act("stop", e)}
        >
          ■
        </button>
      </div>
    </li>
  );
}
