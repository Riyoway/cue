import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import {
  readText,
  writeText,
} from "@tauri-apps/plugin-clipboard-manager";
import { open, save } from "@tauri-apps/plugin-dialog";

export const showLauncher = () => invoke("show_launcher");
export const hideLauncher = () => invoke("hide_launcher");
export const toggleLauncher = () => invoke("toggle_launcher");
export const quitApp = () => invoke("quit_app");

export const minimizeWindow = () => getCurrentWindow().minimize();

/** リサイズ時の白い余白（再描画前のネイティブ背景）を防ぐためテーマ色に合わせる。 */
export const setWindowBackground = (dark: boolean) =>
  getCurrentWindow()
    .setBackgroundColor(dark ? [24, 24, 27, 255] : [255, 255, 255, 255])
    .catch(() => {});

/** テキストサイズ（WebView のズーム倍率）。固定配置の座標も崩れない。 */
export const setWebviewZoom = (scale: number) =>
  getCurrentWebview()
    .setZoom(scale || 1)
    .catch(() => {});

export const setWindowAlwaysOnTop = (value: boolean) =>
  invoke("set_always_on_top", { value });

/** 既定ブラウザで URL を開く（https のみ）。 */
export const openUrl = (url: string) => invoke<void>("open_url", { url });

export const applyShortcuts = (summon: string, quicksave: string) =>
  invoke<void>("apply_shortcuts", { summon, quicksave });

export const copyToClipboard = (text: string) => writeText(text);
export const readClipboard = () => readText();

/** 画像を PNG でクリップボードへ（WebView 標準の Clipboard API）。
 *  ponytail: 非Chromium webview では失敗し得る→必要なら clipboard-manager の writeImage に差し替え。 */
export const copyImageToClipboard = (blob: Blob) =>
  navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);

// ---- エクスポート / インポート / Git --------------------------------------

const JSON_FILTER = [{ name: "Cue backup", extensions: ["json"] }];

export const saveDialog = (defaultPath: string) =>
  save({ defaultPath, filters: JSON_FILTER });
export const openDialog = () =>
  open({ multiple: false, directory: false, filters: JSON_FILTER });

export const exportData = (path: string, json: string) =>
  invoke<void>("export_data", { path, json });
export const importData = (path: string) =>
  invoke<string>("import_data", { path });

export const gitAvailable = () => invoke<boolean>("git_available");
export const gitRemoteSnapshot = (remote: string, branch: string) =>
  invoke<string | null>("git_remote_snapshot", { remote, branch });
export const gitCommitSnapshot = (
  remote: string,
  branch: string,
  json: string,
  message: string,
) => invoke<string>("git_commit_snapshot", { remote, branch, json, message });
