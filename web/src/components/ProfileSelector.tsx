import { useState } from "react";
import type { Profile } from "../lib/types";

type Props = {
  profiles: Profile[];
  active: string;
  onActiveChange: (name: string) => void;
  onProfilesChange: (next: Profile[], active: string) => void;
};

export function ProfileSelector({ profiles, active, onActiveChange, onProfilesChange }: Props) {
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(active);

  function newProfile() {
    const baseName = "new-profile";
    let name = baseName;
    let i = 2;
    while (profiles.find((p) => p.name === name)) {
      name = `${baseName}-${i++}`;
    }
    const current = profiles.find((p) => p.name === active);
    const next: Profile = {
      name,
      command: current?.command ?? "",
      args: current ? current.args.map((a) => ({ ...a })) : [],
      env: current ? current.env.map((e) => ({ ...e })) : [],
    };
    onProfilesChange([...profiles, next], name);
  }

  function deleteProfile() {
    if (profiles.length <= 1) return;
    if (!confirm(`Delete profile "${active}"?`)) return;
    const next = profiles.filter((p) => p.name !== active);
    onProfilesChange(next, next[0].name);
  }

  function startRename() {
    setDraft(active);
    setRenaming(true);
  }

  function applyRename() {
    const name = draft.trim();
    setRenaming(false);
    if (!name || name === active) return;
    if (profiles.find((p) => p.name === name)) {
      alert(`Profile "${name}" already exists`);
      return;
    }
    const next = profiles.map((p) => (p.name === active ? { ...p, name } : p));
    onProfilesChange(next, name);
  }

  return (
    <div className="profile-selector">
      <label className="hint" style={{ width: "auto" }}>Profile</label>
      {renaming ? (
        <input
          type="text"
          value={draft}
          autoFocus
          onChange={(e) => setDraft(e.target.value)}
          onBlur={applyRename}
          onKeyDown={(e) => {
            if (e.key === "Enter") applyRename();
            if (e.key === "Escape") setRenaming(false);
          }}
          style={{ maxWidth: 220 }}
        />
      ) : (
        <select
          value={active}
          onChange={(e) => onActiveChange(e.target.value)}
          className="profile-select"
        >
          {profiles.map((p) => (
            <option key={p.name} value={p.name}>
              {p.name}
            </option>
          ))}
        </select>
      )}
      <button className="icon-btn" onClick={newProfile} title="New profile">
        +
      </button>
      <button className="icon-btn" onClick={startRename} title="Rename profile" disabled={renaming}>
        ✎
      </button>
      <button
        className="icon-btn danger-ghost"
        onClick={deleteProfile}
        title="Delete profile"
        disabled={profiles.length <= 1}
      >
        ✕
      </button>
    </div>
  );
}
