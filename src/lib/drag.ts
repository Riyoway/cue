import type { MouseEvent } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";

/** 手動ウィンドウドラッグ。 */
export async function startWindowDrag(): Promise<void> {
  try {
    await getCurrentWindow().startDragging();
  } catch {
    /* noop */
  }
}

/** 上部バーの mousedown 用。ボタン/入力以外を左ドラッグしたら窓移動。 */
export function handleHeaderMouseDown(e: MouseEvent): void {
  if (e.button !== 0) return;
  const el = e.target as HTMLElement;
  if (el.closest("button, input, textarea, select, a, [data-no-drag]")) return;
  void startWindowDrag();
}
