export function fileName(path: string): string {
  const parts = path.split(/[/\\]/);
  return parts[parts.length - 1] || path;
}

export function documentLabel(path: string | null, text: string): string {
  if (path === null) {
    return "Ken's Editor";
  }

  if (text.length === 0) {
    return "New document";
  }

  return fileName(path);
}

export function windowTitle(path: string | null, text: string): string {
  return documentLabel(path, text);
}
