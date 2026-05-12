import { useEffect, useRef, useState } from "react";
import type { Service, ServiceStatus } from "../lib/types";
import type { Theme } from "../hooks/useTheme";

type Action = "start" | "restart" | "stop";

type Props = {
  services: Service[];
  selectedId: string | null;
  collapsed: boolean;
  width: number;
  onToggleCollapsed: () => void;
  onWidthChange: (w: number) => void;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onStartAll: () => void;
  onStopAll: () => void;
  onServiceAction: (id: string, action: Action) => void;
  onReorder: (orderedIds: string[]) => void;
  onExport: () => void;
  onImport: () => void;
  onShowSettings: () => void;
  theme: Theme;
  onToggleTheme: () => void;
};

const MIN_WIDTH = 220;
const MAX_WIDTH = 520;

export function Sidebar(props: Props) {
  const {
    services,
    selectedId,
    collapsed,
    width,
    onToggleCollapsed,
    onWidthChange,
    onSelect,
    onAdd,
    onStartAll,
    onStopAll,
    onServiceAction,
    onReorder,
    onExport,
    onImport,
    onShowSettings,
    theme,
    onToggleTheme,
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

  if (collapsed) {
    return (
      <aside className="sidebar collapsed">
        <button
          className="icon-btn collapse-btn"
          onClick={onToggleCollapsed}
          title="Expand sidebar"
        >
          ☰
        </button>
      </aside>
    );
  }
  void width;

  return (
    <aside className="sidebar" style={{ width }}>
      <div className="sidebar-header">
        <div className="row-between">
          <div className="brand">
            <img src="/favicon.svg" alt="" className="brand-logo" />
            <h1>Mux</h1>
          </div>
          <div style={{ display: "flex", gap: 4 }}>
            <button
              className="icon-btn settings-btn"
              onClick={onShowSettings}
              title="Settings (⌥/)"
            >
              ⚙
            </button>
            <button className="icon-btn" onClick={onToggleTheme} title="Toggle theme">
              {theme === "dark" ? "☀" : "☾"}
            </button>
            <button className="icon-btn" onClick={onToggleCollapsed} title="Collapse sidebar">
              ☰
            </button>
          </div>
        </div>
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
        <button className="primary" onClick={onAdd}>
          + Add service
        </button>
        <div className="sidebar-actions">
          <button onClick={onImport} title="Import services from a file">Import</button>
          <button onClick={onExport} title="Export current services">Export</button>
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
      <div className="sidebar-footer">v1.0.0</div>
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
