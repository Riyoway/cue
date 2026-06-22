import { useEffect } from "react";
import { TriangleAlert } from "lucide-react";
import { useStore } from "../store";
import { useT } from "../lib/i18n";

/** プロジェクト削除など、取り消せない操作の確認モーダル。 */
export function ConfirmDialog() {
  const pending = useStore((s) => s.pendingProjectDelete);
  const confirm = useStore((s) => s.confirmProjectDelete);
  const cancel = useStore((s) => s.cancelProjectDelete);
  const t = useT();

  useEffect(() => {
    if (!pending) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") cancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pending, cancel]);

  if (!pending) return null;

  return (
    <div
      className="cue-fade-in fixed inset-0 z-50 grid place-items-center bg-black/40 p-6"
      onPointerDown={cancel}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        onPointerDown={(e) => e.stopPropagation()}
        className="w-full max-w-sm overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-700 dark:bg-zinc-800"
      >
        <div className="flex gap-3 p-5">
          <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-red-500/10 text-red-600 dark:text-red-400">
            <TriangleAlert size={18} />
          </span>
          <div className="min-w-0">
            <h2 className="text-[15px] font-semibold text-zinc-900 dark:text-zinc-100">
              {t("confirmDeleteProjectTitle")}
            </h2>
            <p className="mt-1 text-[13px] leading-relaxed text-zinc-600 dark:text-zinc-300">
              {t("confirmDeleteProjectBody", {
                name: pending.name,
                count: pending.count,
              })}
            </p>
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-zinc-100 px-5 py-3 dark:border-zinc-700/60">
          <button
            type="button"
            autoFocus
            onClick={cancel}
            className="cursor-pointer rounded-lg px-3 py-1.5 text-[13px] font-medium text-zinc-600 outline-none transition-colors hover:bg-zinc-100 focus-visible:ring-2 focus-visible:ring-accent-500/50 dark:text-zinc-300 dark:hover:bg-zinc-700/70"
          >
            {t("btnCancel")}
          </button>
          <button
            type="button"
            onClick={() => confirm()}
            className="cursor-pointer rounded-lg bg-red-600 px-3 py-1.5 text-[13px] font-medium text-white outline-none transition-colors hover:bg-red-700 focus-visible:ring-2 focus-visible:ring-red-500/50"
          >
            {t("ctxDelete")}
          </button>
        </div>
      </div>
    </div>
  );
}
