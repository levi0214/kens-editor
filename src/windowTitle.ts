export function windowTitle(path: string | null, dirty: boolean): string {
  const marker = dirty ? " •" : "";

  if (path) {
    const parts = path.split(/[/\\]/);
    const name = parts[parts.length - 1] || path;
    return `${name}${marker}`;
  }

  return `Ken's Editor${marker}`;
}
