import type { Service } from "./types";

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${res.status}: ${body}`);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  list: () =>
    fetch("/api/services").then((r) => json<{ services: Service[] }>(r)).then((d) => d.services),
  create: (svc: Partial<Service>) =>
    fetch("/api/services", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(svc),
    }).then((r) => json<Service>(r)),
  update: (id: string, svc: Partial<Service>) =>
    fetch(`/api/services/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(svc),
    }).then((r) => json<Service>(r)),
  remove: (id: string) =>
    fetch(`/api/services/${id}`, { method: "DELETE" }).then((r) => json<void>(r)),
  reorder: (ids: string[]) =>
    fetch("/api/services/reorder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    }).then((r) => json<unknown>(r)),
  start: (id: string) =>
    fetch(`/api/services/${id}/start`, { method: "POST" }).then((r) => json<unknown>(r)),
  stop: (id: string) =>
    fetch(`/api/services/${id}/stop`, { method: "POST" }).then((r) => json<unknown>(r)),
  restart: (id: string) =>
    fetch(`/api/services/${id}/restart`, { method: "POST" }).then((r) => json<unknown>(r)),
  clearLogs: (id: string) =>
    fetch(`/api/services/${id}/logs`, { method: "DELETE" }).then((r) => json<unknown>(r)),
  sendInput: (id: string, data: string, newline = true) =>
    fetch(`/api/services/${id}/input`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data, newline }),
    }).then((r) => json<unknown>(r)),
  startAll: () =>
    fetch("/api/services/start-all", { method: "POST" }).then((r) => json<unknown>(r)),
  stopAll: () =>
    fetch("/api/services/stop-all", { method: "POST" }).then((r) => json<unknown>(r)),
  openInVSCode: (id: string) =>
    fetch(`/api/services/${id}/open-in-vscode`, { method: "POST" }).then((r) => json<unknown>(r)),
  openInTerminal: (id: string) =>
    fetch(`/api/services/${id}/open-in-terminal`, { method: "POST" }).then((r) => json<unknown>(r)),
  pickFolder: () =>
    fetch("/api/pick-folder", { method: "POST" }).then((r) => json<{ path: string }>(r)),
  exportUrl: () => "/api/services/export",
  importServices: (services: Service[], mode: "merge" | "replace") =>
    fetch("/api/services/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ services, mode }),
    }).then((r) => json<{ services: Service[] }>(r)),
  getSettings: () =>
    fetch("/api/settings").then((r) => json<{ terminal: string }>(r)),
  putSettings: (settings: { terminal: string }) =>
    fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    }).then((r) => json<{ terminal: string }>(r)),
  listTerminals: () =>
    fetch("/api/terminals").then((r) => json<{ installed: string[] }>(r)),
  pickApp: () =>
    fetch("/api/pick-app", { method: "POST" }).then((r) => json<{ path: string }>(r)),
  branch: (id: string) =>
    fetch(`/api/services/${id}/branch`).then((r) => json<{ branch: string }>(r)),
};
