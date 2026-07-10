import {
  type DragEvent,
  type MouseEvent as ReactMouseEvent,
  useEffect,
  useState,
} from "react";
import {
  Download,
  FilePlus,
  Folder,
  Layers,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { useStore } from "../store";
import { openUrl } from "../lib/tauri";
import { RELEASES_URL } from "../lib/update";
import { useT } from "../lib/i18n";
import type { Project } from "../types";

export function Sidebar() {
  const t = useT();
  const projects = useStore((s) => s.projects);
  const items = useStore((s) => s.items);
  const activeProjectId = useStore((s) => s.activeProjectId);
  const setActiveProject = useStore((s) => s.setActiveProject);
  const addProject = useStore((s) => s.addProject);
  const renameProject = useStore((s) => s.renameProject);
  const removeProject = useStore((s) => s.removeProject);
  const newItem = useStore((s) => s.newItem);
  const update = useStore((s) => s.update);
  const updateDismissed = useStore((s) => s.updateDismissed);
  const dismissUpdate = useStore((s) => s.dismissUpdate);
  const installUpdate = useStore((s) => s.installUpdate);
  const installing = useStore((s) => s.installing);
  const updateProgress = useStore((s) => s.updateProgress);
  const openContextMenu = useStore((s) => s.openContextMenu);
  const startRenameProject = useStore((s) => s.startRenameProject);
  const renamingProjectId = useStore((s) => s.renamingProjectId);
  const reorderProject = useStore((s) => s.reorderProject);

  const [adding, setAdding] = useState(false);
  const [addName, setAddName] = useState("");
  const [renameName, setRenameName] = useState("");
  const [draggedId, setDraggedId] = useState<number | null>(null);
  const [dropTarget, setDropTarget] = useState<{
    id: number;
    edge: "top" | "bottom";
  } | null>(null);

  const onDragOver = (p: Project) => (e: DragEvent) => {
    if (draggedId == null) return;
    e.preventDefault();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const edge: "top" | "bottom" =
      e.clientY < rect.top + rect.height / 2 ? "top" : "bottom";
    setDropTarget({ id: p.id, edge });
  };

  const onDrop = (p: Project) => (e: DragEvent) => {
    if (draggedId == null) return;
    e.preventDefault();
    const edge = dropTarget?.edge ?? "top";
    void reorderProject(draggedId, p.id, edge === "bottom");
    setDraggedId(null);
    setDropTarget(null);
  };

  // リネーム開始時に現在名をシード
  useEffect(() => {
    if (renamingProjectId != null) {
      const p = projects.find((x) => x.id === renamingProjectId);
      setRenameName(p?.name ?? "");
    }
  }, [renamingProjectId, projects]);

  const commitAdd = async () => {
    const name = addName.trim();
    setAdding(false);
    setAddName("");
    if (name) await addProject(name);
  };

  const commitRename = async (id: number) => {
    const name = renameName.trim();
    startRenameProject(null);
    if (name) await renameProject(id, name);
  };

  const onProjectCtx = (e: ReactMouseEvent, p: Project) => {
    e.preventDefault();
    e.stopPropagation();
    setActiveProject(p.id);
    openContextMenu(e.clientX, e.clientY, [
      {
        label: t("ctxNewHere"),
        icon: <FilePlus size={14} />,
        onSelect: () => {
          setActiveProject(p.id);
          newItem();
        },
      },
      {
        label: t("ctxRename"),
        icon: <Pencil size={14} />,
        onSelect: () => startRenameProject(p.id),
      },
      {
        label: t("ctxDelete"),
        icon: <Trash2 size={14} />,
        danger: true,
        onSelect: () => removeProject(p.id),
      },
    ]);
  };

  const inputCls =
    "w-full rounded-md border border-accent-500 bg-white px-2 py-1.5 text-[13px] text-zinc-800 outline-none dark:bg-zinc-900 dark:text-zinc-100";

  const row = (active: boolean) =>
    `group flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-accent-500/50 ${
      active
        ? "bg-accent-500/15 font-medium text-accent-700 dark:text-accent-300"
        : "text-zinc-600 hover:bg-zinc-200/60 dark:text-zinc-300 dark:hover:bg-zinc-800"
    }`;

  return (
    <aside className="flex w-44 shrink-0 flex-col">
      <div className="cue-scroll flex-1 overflow-y-auto p-2">
        <button onClick={() => setActiveProject(null)} className={row(activeProjectId === null)}>
          <Layers size={15} className="shrink-0 opacity-70" aria-hidden />
          <span className="flex-1 truncate">{t("sideAll")}</span>
          <span className="text-[11px] tabular-nums text-zinc-400">{items.length}</span>
        </button>

        <div className="px-2 pt-3 pb-1">
          <span className="text-[10px] font-semibold tracking-wider text-zinc-400 uppercase">
            {t("sideProjects")}
          </span>
        </div>

        {projects.map((p) => {
          const count = items.filter((i) => i.project_id === p.id).length;
          const active = activeProjectId === p.id;
          if (renamingProjectId === p.id) {
            return (
              <input
                key={p.id}
                autoFocus
                value={renameName}
                onChange={(e) => setRenameName(e.target.value)}
                onFocus={(e) => e.target.select()}
                onBlur={() => commitRename(p.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitRename(p.id);
                  if (e.key === "Escape") startRenameProject(null);
                }}
                className={`mb-0.5 ${inputCls}`}
                aria-label={t("ctxRename")}
              />
            );
          }
          return (
            <div
              key={p.id}
              role="button"
              tabIndex={0}
              draggable
              onDragStart={() => setDraggedId(p.id)}
              onDragOver={onDragOver(p)}
              onDrop={onDrop(p)}
              onDragEnd={() => {
                setDraggedId(null);
                setDropTarget(null);
              }}
              onClick={() => setActiveProject(p.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setActiveProject(p.id);
                }
              }}
              onDoubleClick={() => startRenameProject(p.id)}
              onContextMenu={(e) => onProjectCtx(e, p)}
              className={`relative ${row(active)}`}
              title={t("projectRowTitle", { name: p.name })}
            >
              {dropTarget?.id === p.id && dropTarget.edge === "top" && (
                <span className="pointer-events-none absolute inset-x-1 -top-px h-0.5 rounded-full bg-accent-500" />
              )}
              {dropTarget?.id === p.id && dropTarget.edge === "bottom" && (
                <span className="pointer-events-none absolute inset-x-1 -bottom-px h-0.5 rounded-full bg-accent-500" />
              )}
              <Folder size={15} className="shrink-0 opacity-70" aria-hidden />
              <span className="flex-1 truncate">{p.name}</span>
              {/* 件数と削除ボタンを同じ固定幅スロットに重ね、透明度だけ切替（レイアウトを動かさない） */}
              <span className="relative flex h-5 min-w-[20px] shrink-0 items-center justify-end">
                <span className="text-[11px] tabular-nums text-zinc-400 transition-opacity duration-150 group-hover:opacity-0">
                  {count}
                </span>
                <button
                  type="button"
                  title={t("ctxDelete")}
                  aria-label={t("ctxDelete")}
                  onClick={(e) => {
                    e.stopPropagation();
                    removeProject(p.id);
                  }}
                  className="absolute inset-0 grid cursor-pointer place-items-center rounded text-zinc-400 opacity-0 outline-none transition-opacity duration-150 hover:bg-red-500/15 hover:text-red-500 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-accent-500/50 group-hover:opacity-100"
                >
                  <Trash2 size={13} />
                </button>
              </span>
            </div>
          );
        })}

        {adding ? (
          <input
            autoFocus
            value={addName}
            onChange={(e) => setAddName(e.target.value)}
            onBlur={commitAdd}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitAdd();
              if (e.key === "Escape") {
                setAdding(false);
                setAddName("");
              }
            }}
            placeholder={t("projectNamePlaceholder")}
            aria-label={t("projectNamePlaceholder")}
            className={`mt-0.5 ${inputCls}`}
          />
        ) : (
          <button
            onClick={() => setAdding(true)}
            className="mt-0.5 flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-[13px] text-zinc-400 outline-none transition-colors duration-150 hover:bg-zinc-200/60 hover:text-zinc-600 focus-visible:ring-2 focus-visible:ring-accent-500/50 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
          >
            <Plus size={15} className="shrink-0" aria-hidden />
            {t("sideAddProject")}
          </button>
        )}
      </div>

      {update && !updateDismissed && (
        <div className="shrink-0 p-2 pt-0">
          <div className="relative overflow-hidden rounded-xl border border-accent-500/30 bg-gradient-to-br from-accent-500/15 to-accent-500/[0.04] px-3 pt-3 pb-3 text-center dark:border-accent-400/25">
            {!installing && (
              <button
                type="button"
                title={t("btnCancel")}
                aria-label={t("btnCancel")}
                onClick={() => dismissUpdate()}
                className="absolute top-1.5 right-1.5 grid h-5 w-5 cursor-pointer place-items-center rounded text-zinc-400 outline-none transition-colors hover:text-zinc-600 focus-visible:ring-2 focus-visible:ring-accent-500/50 dark:hover:text-zinc-200"
              >
                <X size={13} />
              </button>
            )}
            <div className="text-[12px] font-semibold text-zinc-800 dark:text-zinc-100">
              {t("updateTitle")}
            </div>
            <p className="mt-1 text-[11px] leading-snug text-zinc-600 dark:text-zinc-300">
              {t("setUpdateAvailable", { version: update.version })}
            </p>
            {installing ? (
              <div className="mt-2.5">
                <div className="flex items-center justify-center gap-1.5 text-[11px] font-medium text-accent-600 dark:text-accent-300">
                  <Loader2 size={13} className="animate-spin" aria-hidden />
                  {t("updateDownloading", { pct: updateProgress ?? 0 })}
                </div>
                <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-accent-500/15">
                  <div
                    className="h-full rounded-full bg-accent-500 transition-all duration-150"
                    style={{ width: `${updateProgress ?? 0}%` }}
                  />
                </div>
              </div>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => installUpdate()}
                  className="mt-2.5 flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-accent-600 px-3 py-2 text-[12px] font-semibold text-white outline-none transition duration-150 hover:bg-accent-500 focus-visible:ring-2 focus-visible:ring-accent-500/60 active:scale-95"
                >
                  <Download size={14} aria-hidden />
                  {t("btnUpdateRestart")}
                </button>
                <button
                  type="button"
                  onClick={() => openUrl(`${RELEASES_URL}/latest`)}
                  className="mt-1.5 cursor-pointer text-[11px] text-accent-600 underline-offset-2 outline-none hover:underline focus-visible:underline dark:text-accent-300"
                >
                  {t("updateChangelog")}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </aside>
  );
}
