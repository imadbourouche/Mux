import { useEffect, useRef } from "react";
import type { Service } from "../lib/types";

type PrevState = { status: string; portCount: number };

function ensurePermission(): boolean {
  if (typeof Notification === "undefined") return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  Notification.requestPermission().catch(() => {});
  return false;
}

function notify(title: string, body: string) {
  if (typeof Notification === "undefined") return;
  if (Notification.permission !== "granted") return;
  try {
    new Notification(title, { body });
  } catch {
    // ignore
  }
}

export function useNotifications(services: Service[]) {
  const prevRef = useRef<Map<string, PrevState>>(new Map());

  useEffect(() => {
    ensurePermission();
  }, []);

  useEffect(() => {
    const prev = prevRef.current;
    const next = new Map<string, PrevState>();
    for (const s of services) {
      const status = s.state?.status ?? "stopped";
      const portCount = s.state?.ports?.length ?? 0;
      const before = prev.get(s.id);
      next.set(s.id, { status, portCount });
      if (!before) continue;
      if (before.status !== "crashed" && status === "crashed") {
        notify(`${s.name} crashed`, "Open the dashboard to see logs.");
      }
      if (before.status === "running" && before.portCount === 0 && portCount > 0) {
        const port = s.state?.ports?.[0];
        notify(`${s.name} ready`, port ? `Listening on :${port}` : "Service is listening.");
      }
    }
    prevRef.current = next;
  }, [services]);
}
