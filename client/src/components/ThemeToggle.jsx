const ICONS = { light: "☀️", dark: "🌙", system: "💻" };
const LABELS = { light: "Light", dark: "Dark", system: "System default" };
const NEXT = { light: "dark", dark: "system", system: "light" };

export default function ThemeToggle({ theme, onToggle }) {
  const nextLabel = LABELS[NEXT[theme]] || LABELS.system;
  return (
    <button
      type="button"
      className="icon-btn theme-toggle"
      onClick={onToggle}
      aria-label={`Theme: ${LABELS[theme] || LABELS.system}. Click to switch to ${nextLabel}.`}
      title={`Theme: ${LABELS[theme] || LABELS.system}. Click to switch to ${nextLabel}.`}
    >
      {ICONS[theme] || ICONS.system}
    </button>
  );
}
