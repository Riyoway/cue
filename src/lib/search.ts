import type { Item } from "../types";

/**
 * 簡易あいまい検索。空クエリは元の並び (ピン / position) を維持。
 * スペース区切りの各トークンが title+body のどこかに含まれる項目を、
 * タイトル一致・先頭一致を優先してスコア順に返す。
 */
export function filterItems(items: Item[], query: string): Item[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;

  const tokens = q.split(/\s+/);
  const scored: { item: Item; score: number }[] = [];

  for (const item of items) {
    const title = item.title.toLowerCase();
    const body = item.body.toLowerCase();
    let score = 0;
    let matchedAll = true;

    for (const t of tokens) {
      const inTitle = title.indexOf(t);
      const inBody = body.indexOf(t);
      if (inTitle === -1 && inBody === -1) {
        matchedAll = false;
        break;
      }
      if (inTitle !== -1) {
        score += 100 - Math.min(inTitle, 50);
        if (inTitle === 0) score += 50;
      } else {
        score += 30 - Math.min(inBody, 25);
      }
    }

    if (matchedAll) {
      if (item.pinned) score += 10;
      scored.push({ item, score });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.map((s) => s.item);
}

/**
 * 一覧表示用にタイトルを決める (空なら本文1行目)。
 * タイトルも本文も空なら "" を返し、表示側で t("untitled") を当てる。
 */
export function displayTitle(item: { title: string; body: string }): string {
  if (item.title.trim()) return item.title.trim();
  const firstLine = item.body.split("\n").find((l) => l.trim());
  return firstLine ? firstLine.trim() : "";
}

/** 一覧プレビュー用の本文スニペット。 */
export function snippet(body: string, max = 120): string {
  const text = body
    .replace(/[#>*`_~\-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > max ? text.slice(0, max) + "…" : text;
}
