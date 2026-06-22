import { getVersion } from "@tauri-apps/api/app";

const REPO = "Riyoway/cue";
/** リリース一覧（最新リリースへのフォールバック先）。 */
export const RELEASES_URL = `https://github.com/${REPO}/releases`;

export interface UpdateInfo {
  /** 最新リリースのバージョン（先頭の "v" は除去済み）。 */
  version: string;
  /** 開くべき最新リリースページの URL。 */
  url: string;
}

/** "v1.2.3" / "1.2.3-beta" → [1, 2, 3, ...] の数値配列に分解。 */
function parts(v: string): number[] {
  return v
    .replace(/^v/i, "")
    .split(/[.-]/)
    .map((n) => parseInt(n, 10) || 0);
}

/** latest が current より新しいバージョンか（単純な数値比較）。 */
function isNewer(latest: string, current: string): boolean {
  const a = parts(latest);
  const b = parts(current);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    if (x !== y) return x > y;
  }
  return false;
}

/** 現在のアプリバージョン（取得に失敗したら空文字）。 */
export async function currentVersion(): Promise<string> {
  try {
    return await getVersion();
  } catch {
    return "";
  }
}

/**
 * GitHub の最新リリースを確認し、current より新しければ情報を返す。
 * オフライン・リリース無し(404)・レート制限などは null（黙って無視）。
 */
export async function fetchUpdate(current: string): Promise<UpdateInfo | null> {
  if (!current) return null;
  let res: Response;
  try {
    res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
      headers: { Accept: "application/vnd.github+json" },
    });
  } catch {
    return null;
  }
  if (!res.ok) return null;
  let data: { tag_name?: string; html_url?: string };
  try {
    data = await res.json();
  } catch {
    return null;
  }
  const tag = data.tag_name ?? "";
  if (!tag || !isNewer(tag, current)) return null;
  return {
    version: tag.replace(/^v/i, ""),
    url: data.html_url || `${RELEASES_URL}/latest`,
  };
}
