import { useCallback, useEffect, useState } from "react";

export type Binding = {
  metaOrCtrl: boolean;
  shift: boolean;
  alt: boolean;
  key: string;
};

export type ShortcutId =
  | "quickSwitch"
  | "shortcutsHelp"
  | "startFocused"
  | "restartFocused"
  | "stopFocused";

export type Shortcuts = Record<ShortcutId, Binding>;

export const DEFAULTS: Shortcuts = {
  quickSwitch: { metaOrCtrl: false, shift: false, alt: true, key: "p" },
  shortcutsHelp: { metaOrCtrl: false, shift: false, alt: true, key: "/" },
  startFocused: { metaOrCtrl: false, shift: false, alt: true, key: "s" },
  restartFocused: { metaOrCtrl: false, shift: false, alt: true, key: "r" },
  stopFocused: { metaOrCtrl: false, shift: false, alt: true, key: "k" },
};

export const SHORTCUT_LABELS: Record<ShortcutId, string> = {
  quickSwitch: "Quick-switch service",
  shortcutsHelp: "Open settings",
  startFocused: "Start focused service",
  restartFocused: "Restart focused service",
  stopFocused: "Stop focused service",
};

async function fetchBindings(): Promise<Shortcuts> {
  try {
    const res = await fetch("/api/shortcuts");
    if (!res.ok) return DEFAULTS;
    const stored = (await res.json()) as Partial<Shortcuts>;
    return { ...DEFAULTS, ...stored };
  } catch {
    return DEFAULTS;
  }
}

async function saveBindings(b: Shortcuts): Promise<void> {
  await fetch("/api/shortcuts", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(b),
  });
}

export function useShortcuts() {
  const [bindings, setBindings] = useState<Shortcuts>(DEFAULTS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    fetchBindings().then((b) => {
      if (alive) {
        setBindings(b);
        setLoaded(true);
      }
    });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!loaded) return;
    saveBindings(bindings).catch(() => {});
  }, [bindings, loaded]);

  const update = useCallback((id: ShortcutId, b: Binding) => {
    setBindings((prev) => ({ ...prev, [id]: b }));
  }, []);

  const reset = useCallback(() => setBindings(DEFAULTS), []);

  return { bindings, update, reset, loaded };
}

function logicalKey(e: KeyboardEvent): string {
  if (e.code.startsWith("Key")) return e.code.slice(3).toLowerCase();
  if (e.code.startsWith("Digit")) return e.code.slice(5);
  if (e.code === "Slash") return "/";
  if (e.code === "Minus") return "-";
  if (e.code === "Equal") return "=";
  if (e.code === "Comma") return ",";
  if (e.code === "Period") return ".";
  if (e.code === "Semicolon") return ";";
  if (e.code === "Quote") return "'";
  if (e.code === "Backquote") return "`";
  if (e.code === "Space") return " ";
  return e.key.toLowerCase();
}

export function matches(e: KeyboardEvent, b: Binding): boolean {
  const meta = e.metaKey || e.ctrlKey;
  if (b.metaOrCtrl !== meta) return false;
  if (b.shift !== e.shiftKey) return false;
  if (b.alt !== e.altKey) return false;
  return logicalKey(e) === b.key.toLowerCase();
}

export function formatBinding(b: Binding): string[] {
  const parts: string[] = [];
  if (b.metaOrCtrl) parts.push("⌘");
  if (b.alt) parts.push("⌥");
  if (b.shift) parts.push("⇧");
  let label = b.key;
  if (label.length === 1) label = label.toUpperCase();
  if (label === " ") label = "Space";
  parts.push(label);
  return parts;
}

export function bindingFromEvent(e: KeyboardEvent): Binding | null {
  if (["Meta", "Control", "Shift", "Alt"].includes(e.key)) return null;
  return {
    metaOrCtrl: e.metaKey || e.ctrlKey,
    shift: e.shiftKey,
    alt: e.altKey,
    key: logicalKey(e),
  };
}
