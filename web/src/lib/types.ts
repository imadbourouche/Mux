export type EnvVar = { key: string; value: string; enabled: boolean };
export type Arg = { value: string; enabled: boolean };
export type Profile = { name: string; args: Arg[]; env: EnvVar[] };
export type ServiceStatus = "stopped" | "running" | "crashed";
export type ServiceState = {
  status: ServiceStatus;
  pid?: number;
  startedAt?: number;
  exitCode?: number | null;
  ports?: number[];
};
export type Service = {
  id: string;
  name: string;
  cwd: string;
  command: string;
  profiles: Profile[];
  activeProfile: string;
  pinned?: boolean;
  order?: number;
  state?: ServiceState;
};
export type LogLine = {
  ts: number;
  stream: "stdout" | "stderr" | "system";
  text: string;
};
export type StreamEvent =
  | { type: "snapshot"; logs: LogLine[]; state: ServiceState }
  | { type: "log"; line: LogLine }
  | { type: "status"; state: ServiceState }
  | { type: "ports"; ports: number[] }
  | { type: "clear" };
