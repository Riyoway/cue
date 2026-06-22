import { useEffect } from "react";
import { TriangleAlert } from "lucide-react";
import { useStore } from "../store";
import { useT } from "../lib/i18n";

/** 取り消せない破壊的操作（プロジェクト削除・全データ消去）の確認モーダル。 */
export function ConfirmDialog() {
  const pendingProject = useStore((s) => s.pendingProjectDelete);
  const pendingErase = useStore((s) => s.pendingDataErase);
  const confirmProject = useStore((s) => s.confirmProjectDelete);
  const cancelProject = useStore((s) => s.cancelProjectDelete);
  const confirmErase = useStore((s) => s.confirmDataErase);
  const cancelErase = useStore((s) => s.cancelDataErase);
  const t = useT();

  // プロジェクト削除を優先。どちらも無ければ非表示。
  const active = pendingProject
    ? {
        title: t("confirmDeleteProjectTitle"),
        body: t("confirmDeleteProjectBody", {
          name: pendingProject.name,
          count: pendingProject.count,
        }),
        confirmLabel: t("ctxDelete"),
        confirm: () => confirmProject(),
        cancel: cancelProject,
      }
    : pendingErase
      ? {
          title: t("confirmEraseTitle"),
          body: t("confirmEraseBody"),
          confirmLabel: t("btnErase"),
          confirm: () => confirmErase(),
          cancel: cancelErase,
        }
      : null;

  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") active.cancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // active は pending 値から導出されるため、この 2 つで十分。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingProject, pendingErase]);

  if (!active) return null;

  return (
    <div
      className="cue-fade-in fixed inset-0 z-50 grid place-items-center bg-black/40 p-6"
      onPointerDown={active.cancel}
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
              {active.title}
            </h2>
            <p className="mt-1 text-[13px] leading-relaxed text-zinc-600 dark:text-zinc-300">
              {active.body}
            </p>
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-zinc-100 px-5 py-3 dark:border-zinc-700/60">
          <button
            type="button"
            autoFocus
            onClick={active.cancel}
            className="cursor-pointer rounded-lg px-3 py-1.5 text-[13px] font-medium text-zinc-600 outline-none transition-colors hover:bg-zinc-100 focus-visible:ring-2 focus-visible:ring-accent-500/50 dark:text-zinc-300 dark:hover:bg-zinc-700/70"
          >
            {t("btnCancel")}
          </button>
          <button
            type="button"
            onClick={active.confirm}
            className="cursor-pointer rounded-lg bg-red-600 px-3 py-1.5 text-[13px] font-medium text-white outline-none transition-colors hover:bg-red-700 focus-visible:ring-2 focus-visible:ring-red-500/50"
          >
            {active.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
