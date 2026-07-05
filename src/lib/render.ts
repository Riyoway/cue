// テキストを高密度PNGに描画する（「画像としてコピー」用）。
// 発想: 画像のトークン量はピクセル数で決まり文字数では決まらないので、
// 長く密なプロンプトは画像で貼るとテキストより入力トークンが安くなる。
// ponytail: ブラウザ標準の canvas で完結。グリフアトラスも依存も無し。

/** 「画像としてコピー」を勧める最小文字数。これ未満はテキストの方がトークンが安く、
 *  画像化は損＋ロスありなので出さない。
 *  ponytail: 素朴な文字数しきい値。粗ければ実トークン推定に差し替え。 */
export const IMAGE_COPY_MIN_CHARS = 2000;

const FONT_PX = 14;
const LINE_PX = 18;
const MAX_W = 1400; // 内容の最大幅(px)。広めにして縦を抑える（縦長すぎると縮小され読みにくい）。
const PAD = 16;
const FONT = `${FONT_PX}px ui-monospace, SFMono-Regular, Menlo, monospace`;

/** measureText の実幅で折り返す（等幅・比例・CJK いずれもはみ出さない）。
 *  1文字ずつ必ず前進するので無限ループしない。 */
function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const out: string[] = [];
  for (const para of text.split("\n")) {
    let line = "";
    for (const ch of para) {
      const next = line + ch;
      if (line && ctx.measureText(next).width > maxW) {
        out.push(line);
        line = ch;
      } else {
        line = next;
      }
    }
    out.push(line);
  }
  return out;
}

/** テキスト → PNG Blob。明地に暗字の高密度ページ。
 *  ponytail: 1枚に収める。極端に長いと縦長になり Anthropic 側で縮小され読みにくくなる
 *  ── その時はページ分割を足す。 */
export async function renderTextToPngBlob(text: string): Promise<Blob> {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas 2d context unavailable");

  ctx.font = FONT;
  const lines = wrap(ctx, text, MAX_W);
  canvas.width = MAX_W + PAD * 2;
  canvas.height = lines.length * LINE_PX + PAD * 2;

  // canvas のサイズ変更で描画状態がリセットされるため再設定。
  ctx.font = FONT;
  ctx.textBaseline = "top";
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#111111";
  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], PAD, PAD + i * LINE_PX);
  }

  return await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("toBlob returned null"))),
      "image/png",
    ),
  );
}
