// 実行中の OS を WebView の userAgent から判定（プラグイン不要）。
const ua =
  typeof navigator !== "undefined" ? navigator.userAgent : "";

export const isMac = /Mac|iPhone|iPad/.test(ua);

/** 修飾キーの表示（Mac は ⌘、その他は Ctrl）。 */
export const MOD = isMac ? "⌘" : "Ctrl";
export const ALT = isMac ? "⌥" : "Alt";
export const SHIFT = isMac ? "⇧" : "Shift";
