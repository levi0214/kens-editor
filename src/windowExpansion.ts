export interface WindowRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface WindowExpansionPlan {
  addedWidth: number;
  x: number;
}

export function planWindowExpansion(
  windowRect: WindowRect,
  workArea: WindowRect,
  desiredWidth: number,
): WindowExpansionPlan {
  const availableWidth = Math.max(0, workArea.width - windowRect.width);
  const addedWidth = Math.min(desiredWidth, availableWidth);
  const targetWidth = windowRect.width + addedWidth;
  const rightmostX = workArea.x + workArea.width - targetWidth;
  const x = Math.max(workArea.x, Math.min(windowRect.x, rightmostX));

  return { addedWidth, x };
}
