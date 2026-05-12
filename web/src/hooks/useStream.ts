import { useEffect, useState } from "react";
import type { LogLine, ServiceState, StreamEvent } from "../lib/types";

export type StreamHandle = {
  logs: LogLine[];
  state: ServiceState | null;
  ports: number[];
  ready: boolean;
};

export function useStream(serviceId: string | null): StreamHandle {
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [state, setState] = useState<ServiceState | null>(null);
  const [ports, setPorts] = useState<number[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!serviceId) return;
    setLogs([]);
    setState(null);
    setPorts([]);
    setReady(false);

    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    const url = `${proto}//${window.location.host}/api/services/${serviceId}/stream`;
    const ws = new WebSocket(url);

    ws.onopen = () => setReady(true);
    ws.onmessage = (e) => {
      let ev: StreamEvent;
      try {
        ev = JSON.parse(e.data) as StreamEvent;
      } catch {
        return;
      }
      switch (ev.type) {
        case "snapshot":
          setLogs(ev.logs ?? []);
          setState(ev.state);
          setPorts(ev.state?.ports ?? []);
          break;
        case "log":
          setLogs((prev) => {
            const next = prev.concat(ev.line);
            if (next.length > 5000) next.splice(0, next.length - 5000);
            return next;
          });
          break;
        case "status":
          setState(ev.state);
          if (ev.state.ports !== undefined) setPorts(ev.state.ports);
          break;
        case "ports":
          setPorts(ev.ports);
          break;
        case "clear":
          setLogs([]);
          break;
      }
    };
    ws.onclose = () => setReady(false);
    return () => {
      ws.close();
    };
  }, [serviceId]);

  return { logs, state, ports, ready };
}
