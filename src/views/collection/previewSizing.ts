import type { PreviewSurface } from "./ViewConfig";

export type PeekSurface = Extract<PreviewSurface, "side-peek" | "bottom-peek">;
export type PreviewSizeClass = "compact" | "roomy";

export const DEFAULT_SIDE_PEEK_WIDTH = 440;
export const MIN_SIDE_PEEK_WIDTH = 320;
export const MAX_SIDE_PEEK_WIDTH = 720;

export const DEFAULT_BOTTOM_PEEK_HEIGHT = 280;
export const MIN_BOTTOM_PEEK_HEIGHT = 200;
export const MAX_BOTTOM_PEEK_HEIGHT = 560;

export const PREVIEW_RESIZE_KEYBOARD_STEP = 16;
export const PREVIEW_RESIZE_KEYBOARD_LARGE_STEP = 64;

export const ROOMY_SIDE_PEEK_WIDTH = 520;
export const ROOMY_BOTTOM_PEEK_HEIGHT = 360;

export function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function clampPreviewSize(surface: PeekSurface, value: number): number {
  if (surface === "side-peek") {
    return clampNumber(Math.round(value), MIN_SIDE_PEEK_WIDTH, MAX_SIDE_PEEK_WIDTH);
  }
  return clampNumber(Math.round(value), MIN_BOTTOM_PEEK_HEIGHT, MAX_BOTTOM_PEEK_HEIGHT);
}

export function defaultPreviewSize(surface: PeekSurface): number {
  return surface === "side-peek" ? DEFAULT_SIDE_PEEK_WIDTH : DEFAULT_BOTTOM_PEEK_HEIGHT;
}

export function previewSizeClass(surface: PeekSurface, size: number): PreviewSizeClass {
  if (surface === "side-peek") {
    return size >= ROOMY_SIDE_PEEK_WIDTH ? "roomy" : "compact";
  }
  return size >= ROOMY_BOTTOM_PEEK_HEIGHT ? "roomy" : "compact";
}
