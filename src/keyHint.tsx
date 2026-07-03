export function KeyHints({
  keys,
  className = "",
}: {
  keys: string[];
  className?: string;
}) {
  return (
    <span className={`chrome-tip-keys${className ? ` ${className}` : ""}`}>
      {keys.map((key, index) => (
        <span key={`${key}-${index}`} className="chrome-tip-key">
          {key}
        </span>
      ))}
    </span>
  );
}

export type ChromeHintGroup = {
  label: string;
  keys: string[];
};

export function ChromeHint({
  name,
  keys,
  groups,
  className = "",
  visible,
}: {
  name?: string;
  keys?: string[];
  groups?: ChromeHintGroup[];
  className?: string;
  visible: boolean;
}) {
  return (
    <span
      className={`chrome-tip${className ? ` ${className}` : ""}${visible ? " chrome-tip-visible" : ""}`}
      aria-hidden="true"
    >
      {groups ? (
        groups.map((group, index) => (
          <span key={group.label} className="chrome-tip-group">
            {index > 0 && <span className="chrome-tip-sep">·</span>}
            <span className="chrome-tip-group-label">{group.label}</span>
            <KeyHints keys={group.keys} />
          </span>
        ))
      ) : (
        <>
          <span className="chrome-tip-name">{name}</span>
          <KeyHints keys={keys ?? []} />
        </>
      )}
    </span>
  );
}
