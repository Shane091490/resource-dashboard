export default function ToggleSwitch({ checked, onChange, disabled, ariaLabel }) {
  return (
    <label className={"toggle-switch" + (disabled ? " disabled" : "")}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        aria-label={ariaLabel}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="toggle-track">
        <span className="toggle-thumb" />
      </span>
    </label>
  );
}
