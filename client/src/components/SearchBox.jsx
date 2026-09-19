export default function SearchBox({ value, onChange }) {
  return (
    <div className="search-box">
      <span className="search-icon" aria-hidden="true">
        🔍
      </span>
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search resources..."
        aria-label="Search resources by name or tag"
      />
      {value ? (
        <button type="button" className="search-clear" onClick={() => onChange("")} aria-label="Clear search">
          ✕
        </button>
      ) : null}
    </div>
  );
}
