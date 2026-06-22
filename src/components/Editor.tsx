import { type KeyboardEvent, useEffect, useRef } from "react";
import { Copy, Eye, SquarePen } from "lucide-react";
import { useStore } from "../store";
import { renderMarkdown } from "../lib/markdown";
import { copyToClipboard } from "../lib/tauri";
import { handleHeaderMouseDown } from "../lib/drag";
import { useT } from "../lib/i18n";
import { MOD } from "../lib/platform";
import { IconButton } from "./ui";

export function Editor() {
  const t = useT();
  const draft = useStore((s) => s.editor);
  const previewMode = useStore((s) => s.previewMode);
  const updateDraft = useStore((s) => s.updateDraft);
  const saveDraft = useStore((s) => s.saveDraft);
  const closeEditor = useStore((s) => s.closeEditor);
  const togglePreview = useStore((s) => s.togglePreview);
  const toast = useStore((s) => s.toast);

  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const mounted = useRef(false);

  // フォーカスは「開いた時」と「プレビュー解除時」のみ。
  // タイトル入力 (draft 変化) では本文へ飛ばさない。
  useEffect(() => {
    if (previewMode || !draft) return;
    // 新規アイテムの初回はタイトル (autoFocus) に任せる
    if (!mounted.current && draft.id === null) {
      mounted.current = true;
      return;
    }
    mounted.current = true;
    bodyRef.current?.focus();
  }, [previewMode]);

  if (!draft) return null;

  const onKeyDown = (e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && (e.key === "Enter" || e.key === "s")) {
      e.preventDefault();
      saveDraft();
    }
  };

  const copyBody = async () => {
    await copyToClipboard(draft.body);
    toast(t("tCopied"));
  };

  return (
    <div className="cue-overlay-in absolute inset-0 z-20 flex flex-col bg-white dark:bg-zinc-900">
      <div
        onMouseDown={handleHeaderMouseDown}
        className="flex items-center gap-1.5 border-b border-zinc-200/80 px-3 py-2 dark:border-zinc-800"
      >
        <input
          autoFocus={draft.id === null}
          value={draft.title}
          onChange={(e) => updateDraft({ title: e.target.value })}
          onKeyDown={onKeyDown}
          placeholder={t("edTitlePlaceholder")}
          aria-label={t("titlePlaceholder")}
          spellCheck={false}
          className="w-full bg-transparent text-[15px] font-medium text-zinc-800 outline-none placeholder:text-zinc-400 dark:text-zinc-100 dark:placeholder:text-zinc-500"
        />
        <IconButton
          label={previewMode ? t("edBackEdit") : t("edPreview")}
          variant={previewMode ? "active" : "default"}
          onClick={togglePreview}
        >
          {previewMode ? <SquarePen size={16} /> : <Eye size={16} />}
        </IconButton>
        <IconButton label={t("edCopyBody")} onClick={copyBody}>
          <Copy size={16} />
        </IconButton>
      </div>

      {previewMode ? (
        <div
          className="cue-md cue-selectable cue-scroll flex-1 overflow-y-auto px-4 py-3.5 text-[14px] text-zinc-800 dark:text-zinc-100"
          dangerouslySetInnerHTML={{ __html: renderMarkdown(draft.body) }}
        />
      ) : (
        <textarea
          ref={bodyRef}
          value={draft.body}
          onChange={(e) => updateDraft({ body: e.target.value })}
          onKeyDown={onKeyDown}
          placeholder={t("edBodyPlaceholder")}
          aria-label={t("edBodyPlaceholder")}
          spellCheck={false}
          className="cue-scroll flex-1 resize-none bg-transparent px-4 py-3.5 font-mono text-[13px] leading-relaxed text-zinc-800 outline-none placeholder:text-zinc-400 dark:text-zinc-100 dark:placeholder:text-zinc-500"
        />
      )}

      <div className="flex items-center justify-between gap-3 border-t border-zinc-200/80 px-3 py-2.5 dark:border-zinc-800">
        <span className="text-[11px] text-zinc-400">
          <span className="cue-kbd">{MOD}</span> + <span className="cue-kbd">Enter</span> {t("edToSave")} ·{" "}
          <span className="cue-kbd">Esc</span> {t("edToClose")}
        </span>
        <div className="flex gap-2">
          <button
            onClick={closeEditor}
            className="cursor-pointer rounded-md px-3 py-1.5 text-[13px] text-zinc-600 outline-none transition-colors duration-150 hover:bg-zinc-200/70 focus-visible:ring-2 focus-visible:ring-accent-500/50 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            {t("btnCancel")}
          </button>
          <button
            onClick={saveDraft}
            className="cursor-pointer rounded-md bg-accent-600 px-3.5 py-1.5 text-[13px] font-medium text-white outline-none transition-colors duration-150 hover:bg-accent-500 focus-visible:ring-2 focus-visible:ring-accent-500/60"
          >
            {t("btnSave")}
          </button>
        </div>
      </div>
    </div>
  );
}
