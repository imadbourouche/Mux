import type { Theme } from "../hooks/useTheme";

type Props = {
  onShowSettings: () => void;
  onToggleSidebar: () => void;
  theme: Theme;
  onToggleTheme: () => void;
};

export function GlobalHeader({
  onShowSettings,
  onToggleSidebar,
  theme,
  onToggleTheme,
}: Props) {
  return (
    <header className="app-header">
      <div className="app-header-brand">
        <button
          className="icon-btn header-collapse"
          onClick={onToggleSidebar}
          title="Toggle sidebar"
          aria-label="Toggle sidebar"
        >
          ☰
        </button>
        <img src="/favicon.svg" alt="" className="brand-logo" />
        <h1>Mux</h1>
      </div>
      <span className="spacer" />
      <div className="app-header-actions">
        <button
          className="icon-btn settings-btn"
          onClick={onShowSettings}
          title="Settings (⌥/)"
          aria-label="Settings"
        >
          ⚙
        </button>
        <button
          className="icon-btn"
          onClick={onToggleTheme}
          title="Toggle theme"
          aria-label="Toggle theme"
        >
          {theme === "dark" ? "☀" : "☾"}
        </button>
      </div>
    </header>
  );
}
