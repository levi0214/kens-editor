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

export function ChromeHint({
  name,
  keys,
  className = "",
  visible,
}: {
  name: string;
  keys: string[];
  className?: string;
  visible: boolean;
}) {
  return (
    <span
      className={`chrome-tip${className ? ` ${className}` : ""}${visible ? " chrome-tip-visible" : ""}`}
      aria-hidden="true"
    >
      <span className="chrome-tip-name">{name}</span>
      <KeyHints keys={keys} />
    </span>
  );
}
