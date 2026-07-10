import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { getVersion } from "@tauri-apps/api/app";

const REPO = "Riyoway/cue";
/** リリース一覧（変更履歴リンク先）。 */
export const RELEASES_URL = `https://github.com/${REPO}/releases`;

export type { Update };
export { relaunch };

/** 現在のアプリバージョン（取得失敗は空文字）。 */
export async function currentVersion(): Promise<string> {
  try {
    return await getVersion();
  } catch {
    return "";
  }
}

/**
 * 更新確認。新しい署名済みリリースがあれば Update を返す。
 * オフライン・マニフェスト未公開（updater 入りリリース前）・開発中などは null（黙って無視）。
 */
export async function checkUpdate(): Promise<Update | null> {
  try {
    return await check();
  } catch {
    return null;
  }
}
