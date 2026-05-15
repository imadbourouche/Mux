import { useCallback, useEffect, useState } from "react";
import { Sidebar } from "./components/Sidebar";
import { GlobalHeader } from "./components/GlobalHeader";
import { ServiceDetail } from "./components/ServiceDetail";
import { AddServiceForm } from "./components/AddServiceForm";
import { QuickSwitch } from "./components/QuickSwitch";
import { ImportDialog } from "./components/ImportDialog";
import { ExportDialog } from "./components/ExportDialog";
import { SettingsDialog } from "./components/SettingsDialog";
import { api } from "./lib/api";
import { useTheme } from "./hooks/useTheme";
import { useNotifications } from "./hooks/useNotifications";
import { useShortcuts, matches } from "./hooks/useShortcuts";
import type { Service } from "./lib/types";

const SIDEBAR_WIDTH_KEY = "dev-dashboard-sidebar-width";
const SIDEBAR_COLLAPSED_KEY = "dev-dashboard-sidebar-collapsed";

export function App() {
  const [services, setServices] = useState<Service[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [importing, setImporting] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [quickSwitchOpen, setQuickSwitchOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [theme, setTheme] = useTheme();
  const { bindings, update: updateBinding, reset: resetBindings } = useShortcuts();

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

  async function onImport(servicesIn: Service[], mode: "merge" | "replace") {
    await api.importServices(servicesIn, mode);
    setImporting(false);
    load();
  }

  // global keyboard shortcuts (only when not in a record-mode flow inside ShortcutsDialog)
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // If the shortcuts dialog is recording, it owns the keyboard.
      if ((window as unknown as { __recordingShortcut?: boolean }).__recordingShortcut) return;
      if (matches(e, bindings.quickSwitch)) {
        e.preventDefault();
        setQuickSwitchOpen((v) => !v);
        return;
      }
      if (matches(e, bindings.shortcutsHelp)) {
        e.preventDefault();
        setSettingsOpen((v) => !v);
        return;
      }
      if (!selectedId) return;
      if (matches(e, bindings.startFocused)) {
        e.preventDefault();
        api.start(selectedId).then(load);
      } else if (matches(e, bindings.restartFocused)) {
        e.preventDefault();
        api.restart(selectedId).then(load);
      } else if (matches(e, bindings.stopFocused)) {
        e.preventDefault();
        api.stop(selectedId).then(load);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [bindings, selectedId, load]);

  const gridCols = sidebarCollapsed ? "1fr" : `${sidebarWidth}px 1fr`;

  return (
    <div className="app-shell">
      <GlobalHeader
        onShowSettings={() => setSettingsOpen(true)}
        onToggleSidebar={() => setSidebarCollapsed((v) => !v)}
        theme={theme}
        onToggleTheme={() => setTheme(theme === "dark" ? "light" : "dark")}
      />
      <div className="layout" style={{ gridTemplateColumns: gridCols }}>
        {!sidebarCollapsed && (
          <Sidebar
            services={services}
            selectedId={selectedId}
            width={sidebarWidth}
            onWidthChange={setSidebarWidth}
            onSelect={setSelectedId}
            onAdd={() => setAdding(true)}
            onStartAll={() => api.startAll().then(load)}
            onStopAll={() => api.stopAll().then(load)}
            onImport={() => setImporting(true)}
            onExport={() => setExportOpen(true)}
            onServiceAction={serviceAction}
            onReorder={onReorder}
          />
        )}
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
            <div className="empty">Select or add a service</div>
          </section>
        )}
      </div>
      {adding && <AddServiceForm onCancel={() => setAdding(false)} onCreate={onCreate} />}
      {importing && (
        <ImportDialog onCancel={() => setImporting(false)} onImport={onImport} />
      )}
      {exportOpen && <ExportDialog onCancel={() => setExportOpen(false)} />}
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
      {settingsOpen && (
        <SettingsDialog
          bindings={bindings}
          onChange={updateBinding}
          onReset={resetBindings}
          onCancel={() => setSettingsOpen(false)}
        />
      )}
    </div>
  );
}
