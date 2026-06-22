import { marked } from "marked";
import DOMPurify from "dompurify";

marked.setOptions({ breaks: true, gfm: true });

/** Markdown を安全な HTML に変換する。 */
export function renderMarkdown(src: string): string {
  let html = "";
  try {
    html = marked.parse(src ?? "", { async: false }) as string;
  } catch {
    return src ?? "";
  }
  if (typeof html !== "string") return src ?? "";
  // サニタイズ（万一 DOMPurify が使えない環境でも素の HTML を返す）
  try {
    if (typeof DOMPurify?.sanitize === "function") {
      return DOMPurify.sanitize(html);
    }
  } catch {
    /* noop */
  }
  return html;
}
