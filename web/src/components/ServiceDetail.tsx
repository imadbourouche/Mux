import { useCallback, useEffect, useRef, useState } from "react";
import type { Arg, EnvVar, Profile, Service } from "../lib/types";
import { api } from "../lib/api";
import { useStream } from "../hooks/useStream";
import { EnvEditor } from "./EnvEditor";
import { ArgsEditor } from "./ArgsEditor";
import { LogsTab } from "./LogsTab";
import { ConfirmDialog } from "./ConfirmDialog";
import { CollapsibleSection } from "./CollapsibleSection";
import { ProfileSelector } from "./ProfileSelector";

type Props = {
  service: Service;
  allServices: Service[];
  onUpdated: (svc: Service) => void;
  onDeleted: (id: string) => void;
};

type SaveStatus = "saved" | "pending" | "saving" | "error";

const SAVE_DELAY_MS = 500;

function trimArgs(args: Arg[]): Arg[] {
  return args.map((a) => ({ ...a, value: a.value.trim() }));
}
function trimEnv(env: EnvVar[]): EnvVar[] {
  return env.map((e) => ({ ...e, key: e.key.trim(), value: e.value.trim() }));
}

function snapshot(svc: { name: string; cwd: string; command: string; profiles: Profile[]; activeProfile: string }) {
  return JSON.stringify({
    name: svc.name.trim(),
    cwd: svc.cwd.trim(),
    command: svc.command.trim(),
    profiles: svc.profiles.map((p) => ({
      name: p.name,
      args: trimArgs(p.args),
      env: trimEnv(p.env),
    })),
    activeProfile: svc.activeProfile,
  });
}

export function ServiceDetail({ service, allServices, onUpdated, onDeleted }: Props) {
  const [name, setName] = useState(service.name);
  const [cwd, setCwd] = useState(service.cwd);
  const [command, setCommand] = useState(service.command);
  const [profiles, setProfiles] = useState<Profile[]>(service.profiles);
  const [activeProfile, setActiveProfile] = useState(service.activeProfile);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const lastSavedRef = useRef<string>(snapshot(service));
  const savingRef = useRef<boolean>(false);

  const { logs, state, ports } = useStream(service.id);

  useEffect(() => {
    setName(service.name);
    setCwd(service.cwd);
    setCommand(service.command);
    setProfiles(service.profiles);
    setActiveProfile(service.activeProfile);
    lastSavedRef.current = snapshot(service);
    setSaveStatus("saved");
  }, [service.id]);

  useEffect(() => {
    lastSavedRef.current = snapshot(service);
  }, [service.name, service.cwd, service.command, service.profiles, service.activeProfile]);

  const currentForm = snapshot({ name, cwd, command, profiles, activeProfile });
  const dirty = currentForm !== lastSavedRef.current;

  const saveNow = useCallback(async (): Promise<boolean> => {
    if (savingRef.current) return false;
    savingRef.current = true;
    setSaveStatus("saving");
    try {
      const updated = await api.update(service.id, {
        name: name.trim(),
        cwd: cwd.trim(),
        command: command.trim(),
        profiles: profiles.map((p) => ({
          name: p.name,
          args: trimArgs(p.args),
          env: trimEnv(p.env),
        })),
        activeProfile,
      });
      setName(updated.name);
      setCwd(updated.cwd);
      setCommand(updated.command);
      setProfiles(updated.profiles);
      setActiveProfile(updated.activeProfile);
      lastSavedRef.current = snapshot(updated);
      setSaveStatus("saved");
      onUpdated(updated);
      return true;
    } catch {
      setSaveStatus("error");
      return false;
    } finally {
      savingRef.current = false;
    }
  }, [service.id, name, cwd, command, profiles, activeProfile, onUpdated]);

  useEffect(() => {
    if (!dirty) return;
    setSaveStatus("pending");
    const t = window.setTimeout(() => {
      saveNow();
    }, SAVE_DELAY_MS);
    return () => window.clearTimeout(t);
  }, [dirty, currentForm, saveNow]);

  async function flushBeforeAction() {
    if (dirty) await saveNow();
  }

  const status = state?.status ?? service.state?.status ?? "stopped";
  const running = status === "running";

  async function startSvc() {
    await flushBeforeAction();
    await api.start(service.id);
  }
  async function stopSvc() {
    await api.stop(service.id);
  }
  async function restartSvc() {
    await flushBeforeAction();
    await api.restart(service.id);
  }
  async function openVSCode() {
    await flushBeforeAction();
    try {
      await api.openInVSCode(service.id);
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
    }
  }
  async function openTerminal() {
    try {
      await api.openInTerminal(service.id);
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
    }
  }
  async function del() {
    setConfirmDelete(false);
    await api.remove(service.id);
    onDeleted(service.id);
  }
  async function clearLogs() {
    await api.clearLogs(service.id);
  }
  async function sendInput(data: string, newline: boolean) {
    try {
      await api.sendInput(service.id, data, newline);
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
    }
  }

  const active = profiles.find((p) => p.name === activeProfile) ?? profiles[0];

  function setActiveArgs(args: Arg[]) {
    setProfiles(profiles.map((p) => (p.name === activeProfile ? { ...p, args } : p)));
  }
  function setActiveEnv(env: EnvVar[]) {
    setProfiles(profiles.map((p) => (p.name === activeProfile ? { ...p, env } : p)));
  }
  function onProfilesChange(next: Profile[], newActive: string) {
    setProfiles(next);
    setActiveProfile(newActive);
  }

  const argsSources = allServices
    .filter((s) => s.id !== service.id)
    .flatMap((s) =>
      s.profiles.map((p) => ({
        id: `${s.id}:${p.name}`,
        name: `${s.name} · ${p.name}`,
        items: p.args ?? [],
      }))
    );
  const envSources = allServices
    .filter((s) => s.id !== service.id)
    .flatMap((s) =>
      s.profiles.map((p) => ({
        id: `${s.id}:${p.name}`,
        name: `${s.name} · ${p.name}`,
        items: p.env ?? [],
      }))
    );

  const saveLabel: Record<SaveStatus, string> = {
    saved: "All changes saved",
    pending: "Pending save…",
    saving: "Saving…",
    error: "Save failed — retry?",
  };

  return (
    <section className="detail">
      <div className="detail-header">
        <span className={`status-dot ${status}`} />
        <h2>{service.name || "(unnamed)"}</h2>
        <span className={`status-badge ${status}`}>{status}</span>
        {state?.pid ? <span className="hint">pid {state.pid}</span> : null}
        <span className={`save-indicator ${saveStatus}`}>
          {saveStatus === "error" ? (
            <button className="link-btn" onClick={saveNow}>
              {saveLabel.error}
            </button>
          ) : (
            saveLabel[saveStatus]
          )}
        </span>
        {ports.length > 0 && (
          <div className="port-chips">
            {ports.map((p) => (
              <a
                key={p}
                href={`http://localhost:${p}`}
                target="_blank"
                rel="noopener noreferrer"
                className="port-chip"
                title={`Open http://localhost:${p}`}
              >
                :{p}
              </a>
            ))}
          </div>
        )}
        <span className="spacer" />
        <button onClick={openVSCode}>Open in VSCode</button>
        <button onClick={openTerminal}>Open Terminal</button>
        <button className="action-start" onClick={startSvc} disabled={running} title="Start">
          ▶ Start
        </button>
        <button className="action-restart" onClick={restartSvc} disabled={!running} title="Restart (Cmd+R)">
          ↻ Restart
        </button>
        <button className="action-stop" onClick={stopSvc} disabled={!running} title="Stop">
          ■ Stop
        </button>
        <button className="danger-ghost" onClick={() => setConfirmDelete(true)}>
          Delete
        </button>
      </div>
      <div className="detail-body">
        <CollapsibleSection
          title="Configuration"
          hint="Name, working directory, and the base command used to launch the service."
          defaultOpen
        >
          <div className="row">
            <label>Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="row">
            <label>Path</label>
            <input value={cwd} onChange={(e) => setCwd(e.target.value)} />
          </div>
          <div className="row">
            <label>Command</label>
            <input value={command} onChange={(e) => setCommand(e.target.value)} />
          </div>
        </CollapsibleSection>
        <div className="section">
          <div className="section-body">
            <h3 style={{ marginTop: 0 }}>Profile</h3>
            <p className="hint" style={{ marginBottom: 12 }}>
              Each profile is a named variant of arguments and environment variables. Only the
              active profile is applied at start.
            </p>
            <ProfileSelector
              profiles={profiles}
              active={activeProfile}
              onActiveChange={setActiveProfile}
              onProfilesChange={onProfilesChange}
            />
          </div>
        </div>
        <ArgsEditor value={active?.args ?? []} onChange={setActiveArgs} sources={argsSources} />
        <EnvEditor value={active?.env ?? []} onChange={setActiveEnv} sources={envSources} />
        <div className="section">
          <div className="section-body">
            <LogsTab logs={logs} running={running} onClear={clearLogs} onSendInput={sendInput} />
          </div>
        </div>
      </div>
      {confirmDelete && (
        <ConfirmDialog
          title="Delete service?"
          message={`This will permanently delete "${service.name || "(unnamed)"}" from the dashboard. Running processes will be stopped first. This action cannot be undone.`}
          confirmLabel="Delete"
          danger
          onConfirm={del}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </section>
  );
}
