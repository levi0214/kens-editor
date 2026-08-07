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

export interface WindowContractionPlan {
  removedWidth: number;
  x: number;
  y: number;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(value, Math.max(minimum, maximum)));
}

export function planWindowExpansion(
  windowRect: WindowRect,
  workArea: WindowRect,
  desiredWidth: number,
): WindowExpansionPlan {
  const availableWidth = Math.max(0, workArea.width - windowRect.width);
  const addedWidth = Math.min(Math.max(0, desiredWidth), availableWidth);
  const targetWidth = windowRect.width + addedWidth;
  const rightmostX = workArea.x + workArea.width - targetWidth;
  const x = clamp(windowRect.x, workArea.x, rightmostX);

  return { addedWidth, x };
}

export function planWindowContraction(
  windowRect: WindowRect,
  workArea: WindowRect,
  addedWidth: number,
  shiftedX: number,
): WindowContractionPlan {
  const removedWidth = Math.min(
    Math.max(0, addedWidth),
    Math.max(0, windowRect.width - 1),
  );
  const targetWidth = windowRect.width - removedWidth;
  const rightmostX = workArea.x + workArea.width - targetWidth;
  const bottommostY = workArea.y + workArea.height - windowRect.height;

  return {
    removedWidth,
    x: clamp(windowRect.x + shiftedX, workArea.x, rightmostX),
    y: clamp(windowRect.y, workArea.y, bottommostY),
  };
}
