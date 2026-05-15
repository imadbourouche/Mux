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

function VSCodeIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M23.15 2.587 18.21.21a1.494 1.494 0 0 0-1.705.29l-9.46 8.63-4.12-3.128a.999.999 0 0 0-1.276.057L.327 7.261A1 1 0 0 0 .326 8.74L3.899 12 .326 15.26a1 1 0 0 0 .001 1.479L1.65 17.94a.999.999 0 0 0 1.276.057l4.12-3.128 9.46 8.63a1.492 1.492 0 0 0 1.704.29l4.942-2.377A1.5 1.5 0 0 0 24 20.06V3.939a1.5 1.5 0 0 0-.85-1.352zm-5.146 14.861L10.826 12l7.178-5.448z" />
    </svg>
  );
}

function TerminalIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="4 17 10 11 4 5" />
      <line x1="12" y1="19" x2="20" y2="19" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
    </svg>
  );
}

function ExternalLinkIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ marginLeft: 4, verticalAlign: "middle" }}>
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  );
}

type Props = {
  service: Service;
  allServices: Service[];
  onUpdated: (svc: Service) => void;
  onDeleted: (id: string) => void;
};

type SaveStatus = "saved" | "pending" | "saving" | "error";

const SAVE_DELAY_MS = 500;
const BRANCH_TRUNCATE_AT = 15;

function trimArgs(args: Arg[]): Arg[] {
  return args.map((a) => ({ ...a, value: a.value.trim() }));
}
function trimEnv(env: EnvVar[]): EnvVar[] {
  return env.map((e) => ({ ...e, key: e.key.trim(), value: e.value.trim() }));
}

function snapshot(svc: { name: string; cwd: string; profiles: Profile[]; activeProfile: string }) {
  return JSON.stringify({
    name: svc.name.trim(),
    cwd: svc.cwd.trim(),
    profiles: svc.profiles.map((p) => ({
      name: p.name,
      command: (p.command ?? "").trim(),
      args: trimArgs(p.args),
      env: trimEnv(p.env),
    })),
    activeProfile: svc.activeProfile,
  });
}

export function ServiceDetail({ service, allServices, onUpdated, onDeleted }: Props) {
  const [name, setName] = useState(service.name);
  const [cwd, setCwd] = useState(service.cwd);
  const [profiles, setProfiles] = useState<Profile[]>(service.profiles);
  const [activeProfile, setActiveProfile] = useState(service.activeProfile);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [branch, setBranch] = useState<string>("");
  const [branchExpanded, setBranchExpanded] = useState(false);

  const lastSavedRef = useRef<string>(snapshot(service));
  const savingRef = useRef<boolean>(false);

  const { logs, state, ports } = useStream(service.id);

  useEffect(() => {
    setName(service.name);
    setCwd(service.cwd);
    setProfiles(service.profiles);
    setActiveProfile(service.activeProfile);
    lastSavedRef.current = snapshot(service);
    setSaveStatus("saved");
  }, [service.id]);

  useEffect(() => {
    let cancelled = false;
    setBranch("");
    setBranchExpanded(false);
    if (!service.cwd) return;
    api.branch(service.id)
      .then(({ branch }) => {
        if (!cancelled) setBranch(branch);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [service.id, service.cwd]);

  useEffect(() => {
    lastSavedRef.current = snapshot(service);
  }, [service.name, service.cwd, service.profiles, service.activeProfile]);

  const currentForm = snapshot({ name, cwd, profiles, activeProfile });
  const dirty = currentForm !== lastSavedRef.current;

  const saveNow = useCallback(async (): Promise<boolean> => {
    if (savingRef.current) return false;
    savingRef.current = true;
    setSaveStatus("saving");
    try {
      const updated = await api.update(service.id, {
        name: name.trim(),
        cwd: cwd.trim(),
        profiles: profiles.map((p) => ({
          name: p.name,
          command: (p.command ?? "").trim(),
          args: trimArgs(p.args),
          env: trimEnv(p.env),
        })),
        activeProfile,
      });
      setName(updated.name);
      setCwd(updated.cwd);
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
  }, [service.id, name, cwd, profiles, activeProfile, onUpdated]);

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
  function setActiveCommand(cmd: string) {
    setProfiles(profiles.map((p) => (p.name === activeProfile ? { ...p, command: cmd } : p)));
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
        <h2>
          {service.name || "(unnamed)"}
          {branch && (
            <span className="branch-tag" title="Current git branch">
              {" ("}
              {branchExpanded || branch.length <= BRANCH_TRUNCATE_AT
                ? branch
                : branch.slice(0, BRANCH_TRUNCATE_AT) + "…"}
              {branch.length > BRANCH_TRUNCATE_AT && (
                <button
                  type="button"
                  className="branch-toggle"
                  onClick={() => setBranchExpanded((v) => !v)}
                  title={branchExpanded ? "Collapse branch name" : "Show full branch name"}
                  aria-label={branchExpanded ? "Collapse branch name" : "Show full branch name"}
                >
                  {branchExpanded ? "<" : ">"}
                </button>
              )}
              {")"}
            </span>
          )}
        </h2>
        <button onClick={openVSCode} className="open-btn" title="Open project in VSCode">
          Open in <VSCodeIcon />
        </button>
        <button onClick={openTerminal} className="open-btn" title="Open Terminal.app in project folder">
          Open in <TerminalIcon />
        </button>
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
                title={`Open http://localhost:${p} in a new tab`}
              >
                :{p}
                <ExternalLinkIcon />
              </a>
            ))}
          </div>
        )}
        <span className="spacer" />
        <button className="action-start" onClick={startSvc} disabled={running} title="Start">
          ▶ Start
        </button>
        <button className="action-restart" onClick={restartSvc} disabled={!running} title="Restart">
          ↻ Restart
        </button>
        <button className="action-stop" onClick={stopSvc} disabled={!running} title="Stop">
          ■ Stop
        </button>
      </div>
      <div className="detail-body">
        <CollapsibleSection
          title="Configuration"
          hint="Name and working directory of the service."
          defaultOpen={false}
        >
          <div className="row">
            <label>Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="row">
            <label>Path</label>
            <input value={cwd} onChange={(e) => setCwd(e.target.value)} />
          </div>
        </CollapsibleSection>
        <CollapsibleSection
          title="Profile"
          hint="Each profile is a named variant of command, arguments, and environment variables. Only the active profile is applied at start."
          defaultOpen
          rightSlot={
            <ProfileSelector
              profiles={profiles}
              active={activeProfile}
              onActiveChange={setActiveProfile}
              onProfilesChange={onProfilesChange}
            />
          }
        >
          <div className="row">
            <label>Command</label>
            <input
              value={active?.command ?? ""}
              onChange={(e) => setActiveCommand(e.target.value)}
              placeholder='e.g. "yarn dev"'
            />
          </div>
          <ArgsEditor value={active?.args ?? []} onChange={setActiveArgs} sources={argsSources} />
          <EnvEditor value={active?.env ?? []} onChange={setActiveEnv} sources={envSources} />
        </CollapsibleSection>
        <div className="section">
          <div className="section-body">
            <LogsTab logs={logs} running={running} onClear={clearLogs} onSendInput={sendInput} />
          </div>
        </div>
        <CollapsibleSection
          title="Danger zone"
          hint="Permanently remove this service from the dashboard."
          defaultOpen={false}
        >
          <button
            className="danger-ghost danger-zone-btn"
            onClick={() => setConfirmDelete(true)}
            title="Delete service"
          >
            <TrashIcon /> Delete service
          </button>
        </CollapsibleSection>
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
