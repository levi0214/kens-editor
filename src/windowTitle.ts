export function fileName(path: string): string {
  const parts = path.split(/[/\\]/);
  return parts[parts.length - 1] || path;
}

export function windowTitle(path: string | null, dirty: boolean): string {
  const marker = dirty ? " •" : "";

  if (path) {
    return `${fileName(path)}${marker}`;
  }

  return `Ken's Editor${marker}`;
}
