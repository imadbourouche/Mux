import { useCallback, useEffect, useState } from "react";
import { Sidebar } from "./components/Sidebar";
import { ServiceDetail } from "./components/ServiceDetail";
import { AddServiceForm } from "./components/AddServiceForm";
import { QuickSwitch } from "./components/QuickSwitch";
import { ImportDialog } from "./components/ImportDialog";
import { ConfirmDialog } from "./components/ConfirmDialog";
import { api } from "./lib/api";
import { useTheme } from "./hooks/useTheme";
import { useNotifications } from "./hooks/useNotifications";
import type { Service } from "./lib/types";

const SIDEBAR_WIDTH_KEY = "dev-dashboard-sidebar-width";
const SIDEBAR_COLLAPSED_KEY = "dev-dashboard-sidebar-collapsed";

export function App() {
  const [services, setServices] = useState<Service[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [importing, setImporting] = useState(false);
  const [confirmExport, setConfirmExport] = useState(false);
  const [quickSwitchOpen, setQuickSwitchOpen] = useState(false);
  const [theme, setTheme] = useTheme();

  const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
    const stored = Number(localStorage.getItem(SIDEBAR_WIDTH_KEY));
    return Number.isFinite(stored) && stored >= 220 && stored <= 520 ? stored : 280;
  });
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(
    () => localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1"
  );

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, String(sidebarWidth));
  }, [sidebarWidth]);
  useEffect(() => {
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, sidebarCollapsed ? "1" : "0");
  }, [sidebarCollapsed]);

  const load = useCallback(async () => {
    const list = await api.list();
    setServices(list);
    setSelectedId((prev) => (prev && list.find((s) => s.id === prev) ? prev : list[0]?.id ?? null));
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, [load]);

  useNotifications(services);

  const selected = services.find((s) => s.id === selectedId) ?? null;

  function onUpdated(svc: Service) {
    setServices((prev) => prev.map((s) => (s.id === svc.id ? { ...s, ...svc } : s)));
  }
  function onDeleted(id: string) {
    setServices((prev) => prev.filter((s) => s.id !== id));
    setSelectedId((cur) => (cur === id ? null : cur));
  }
  async function onCreate(svc: Partial<Service>) {
    const created = await api.create(svc);
    setServices((prev) => prev.concat(created));
    setSelectedId(created.id);
    setAdding(false);
  }

  async function serviceAction(id: string, action: "start" | "restart" | "stop") {
    if (action === "start") await api.start(id);
    else if (action === "stop") await api.stop(id);
    else if (action === "restart") await api.restart(id);
    load();
  }

  async function onReorder(ids: string[]) {
    // optimistic
    setServices((prev) => {
      const map = new Map(prev.map((s) => [s.id, s] as const));
      return ids.map((id) => map.get(id)!).filter(Boolean);
    });
    try {
      await api.reorder(ids);
    } finally {
      load();
    }
  }

  function exportNow() {
    setConfirmExport(false);
    const a = document.createElement("a");
    a.href = api.exportUrl();
    a.download = "services.json";
    a.click();
  }

  async function onImport(servicesIn: Service[], mode: "merge" | "replace") {
    await api.importServices(servicesIn, mode);
    setImporting(false);
    load();
  }

  // keyboard shortcuts
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const meta = e.metaKey || e.ctrlKey;
      if (!meta) return;
      const target = e.target as HTMLElement | null;
      const inEditable =
        target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
      if (e.key.toLowerCase() === "k") {
        e.preventDefault();
        setQuickSwitchOpen((v) => !v);
        return;
      }
      if (inEditable) return;
      if (e.key.toLowerCase() === "r" && selectedId) {
        e.preventDefault();
        api.restart(selectedId).then(load);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedId, load]);

  const gridCols = sidebarCollapsed ? "40px 1fr" : `${sidebarWidth}px 1fr`;

  return (
    <div className="layout" style={{ gridTemplateColumns: gridCols }}>
      <Sidebar
        services={services}
        selectedId={selectedId}
        collapsed={sidebarCollapsed}
        width={sidebarWidth}
        onToggleCollapsed={() => setSidebarCollapsed((v) => !v)}
        onWidthChange={setSidebarWidth}
        onSelect={setSelectedId}
        onAdd={() => setAdding(true)}
        onStartAll={() => api.startAll().then(load)}
        onStopAll={() => api.stopAll().then(load)}
        onServiceAction={serviceAction}
        onReorder={onReorder}
        onExport={() => setConfirmExport(true)}
        onImport={() => setImporting(true)}
        theme={theme}
        onToggleTheme={() => setTheme(theme === "dark" ? "light" : "dark")}
      />
      {selected ? (
        <ServiceDetail
          key={selected.id}
          service={selected}
          allServices={services}
          onUpdated={onUpdated}
          onDeleted={onDeleted}
        />
      ) : (
        <section className="detail">
          <div className="empty">Select or add a service · ⌘K to switch</div>
        </section>
      )}
      {adding && <AddServiceForm onCancel={() => setAdding(false)} onCreate={onCreate} />}
      {importing && (
        <ImportDialog onCancel={() => setImporting(false)} onImport={onImport} />
      )}
      {confirmExport && (
        <ConfirmDialog
          title="Export services?"
          message="This downloads services.json with every service's commands, args, env vars, and paths. Env vars and arg values may include secrets — only save it somewhere you trust."
          confirmLabel="Download"
          onConfirm={exportNow}
          onCancel={() => setConfirmExport(false)}
        />
      )}
      {quickSwitchOpen && (
        <QuickSwitch
          services={services}
          onPick={(id) => {
            setSelectedId(id);
            setQuickSwitchOpen(false);
          }}
          onCancel={() => setQuickSwitchOpen(false)}
        />
      )}
    </div>
  );
}
