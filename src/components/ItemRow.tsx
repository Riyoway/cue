import type { DragEvent, MouseEvent as ReactMouseEvent } from "react";
import { Copy, Eye, Pencil, Pin, PinOff, SquarePen, Trash2 } from "lucide-react";
import { useStore } from "../store";
import type { Item } from "../types";
import { displayTitle, snippet } from "../lib/search";
import { useT } from "../lib/i18n";
import { IconButton } from "./ui";

export function ItemRow({
  item,
  selected,
  dropEdge,
  draggable,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: {
  item: Item;
  selected: boolean;
  dropEdge: "top" | "bottom" | null;
  draggable: boolean;
  onDragStart: (e: DragEvent) => void;
  onDragOver: (e: DragEvent) => void;
  onDrop: (e: DragEvent) => void;
  onDragEnd: (e: DragEvent) => void;
}) {
  const copyItem = useStore((s) => s.copyItem);
  const editItem = useStore((s) => s.editItem);
  const previewItem = useStore((s) => s.previewItem);
  const removeItem = useStore((s) => s.removeItem);
  const togglePin = useStore((s) => s.togglePin);
  const select = useStore((s) => s.select);
  const activeProjectId = useStore((s) => s.activeProjectId);
  const projects = useStore((s) => s.projects);
  const openContextMenu = useStore((s) => s.openContextMenu);
  const startRenameItem = useStore((s) => s.startRenameItem);
  const renameItem = useStore((s) => s.renameItem);
  const renaming = useStore((s) => s.renamingItemId === item.id);
  const t = useT();

  const title = displayTitle(item);
  const sub = snippet(item.body);
  const projectName =
    activeProjectId === null
      ? projects.find((p) => p.id === item.project_id)?.name
      : undefined;

  const onContextMenu = (e: ReactMouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    select(item.id);
    openContextMenu(e.clientX, e.clientY, [
      { label: t("ctxCopy"), icon: <Copy size={14} />, onSelect: () => copyItem(item) },
      {
        label: t("ctxRenameTitle"),
        icon: <Pencil size={14} />,
        onSelect: () => startRenameItem(item.id),
      },
      { label: t("edPreview"), icon: <Eye size={14} />, onSelect: () => previewItem(item) },
      { label: t("ctxEdit"), icon: <SquarePen size={14} />, onSelect: () => editItem(item) },
      {
        label: item.pinned ? t("ctxUnpin") : t("ctxPin"),
        icon: item.pinned ? <PinOff size={14} /> : <Pin size={14} />,
        onSelect: () => togglePin(item),
      },
      {
        label: t("ctxDelete"),
        icon: <Trash2 size={14} />,
        danger: true,
        onSelect: () => removeItem(item.id),
      },
    ]);
  };

  return (
    <div
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      onContextMenu={onContextMenu}
      onMouseEnter={() => select(item.id)}
      onClick={() => copyItem(item)}
      className={`group relative flex cursor-pointer items-start gap-2.5 rounded-lg px-2.5 py-2 transition-colors duration-150 ${
        selected
          ? "bg-zinc-100 ring-1 ring-inset ring-accent-500/50 dark:bg-zinc-800"
          : "hover:bg-zinc-100 dark:hover:bg-zinc-800"
      }`}
    >
      {dropEdge === "top" && (
        <span className="pointer-events-none absolute inset-x-1.5 -top-px h-0.5 rounded-full bg-accent-500" />
      )}
      {dropEdge === "bottom" && (
        <span className="pointer-events-none absolute inset-x-1.5 -bottom-px h-0.5 rounded-full bg-accent-500" />
      )}

      <div className="flex w-4 shrink-0 items-center justify-center self-stretch text-zinc-500 dark:text-zinc-400">
        {item.pinned && <Pin size={14} fill="currentColor" aria-label={t("ctxPin")} />}
      </div>

      <div className="min-w-0 flex-1">
        {renaming ? (
          <input
            autoFocus
            defaultValue={item.title}
            onFocus={(e) => e.target.select()}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === "Enter") renameItem(item.id, e.currentTarget.value);
              if (e.key === "Escape") startRenameItem(null);
            }}
            onBlur={(e) => renameItem(item.id, e.currentTarget.value)}
            placeholder={t("titlePlaceholder")}
            className="w-full rounded-md border border-accent-500 bg-white px-1.5 py-0.5 text-[14px] font-medium text-zinc-800 outline-none dark:bg-zinc-900 dark:text-zinc-100"
          />
        ) : (
          <div className="truncate text-[14px] leading-5 font-medium text-zinc-800 dark:text-zinc-100">
            {title}
          </div>
        )}
        {sub && (
          <div className="mt-0.5 truncate text-[12px] leading-4 text-zinc-500 dark:text-zinc-400">
            {sub}
          </div>
        )}
        {projectName && (
          <div className="mt-1 inline-flex max-w-full items-center truncate rounded-full bg-zinc-200/70 px-2 py-0.5 text-[10px] font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
            {projectName}
          </div>
        )}
      </div>

      <div className="absolute inset-y-0 right-0 flex items-center gap-0.5 rounded-r-lg bg-gradient-to-l from-zinc-100 from-65% to-transparent pr-1.5 pl-10 opacity-0 transition-opacity duration-150 group-hover:opacity-100 focus-within:opacity-100 dark:from-zinc-800">
        <IconButton
          size="sm"
          label={item.pinned ? t("ctxUnpin") : t("ctxPin")}
          onClick={(e) => {
            e.stopPropagation();
            togglePin(item);
          }}
        >
          <Pin size={14} fill={item.pinned ? "currentColor" : "none"} />
        </IconButton>
        <IconButton
          size="sm"
          label={t("ctxCopy")}
          onClick={(e) => {
            e.stopPropagation();
            copyItem(item);
          }}
        >
          <Copy size={14} />
        </IconButton>
        <IconButton
          size="sm"
          label={t("edPreview")}
          onClick={(e) => {
            e.stopPropagation();
            previewItem(item);
          }}
        >
          <Eye size={14} />
        </IconButton>
        <IconButton
          size="sm"
          label={t("ctxEdit")}
          onClick={(e) => {
            e.stopPropagation();
            editItem(item);
          }}
        >
          <SquarePen size={14} />
        </IconButton>
        <IconButton
          size="sm"
          label={t("ctxDelete")}
          variant="danger"
          onClick={(e) => {
            e.stopPropagation();
            removeItem(item.id);
          }}
        >
          <Trash2 size={14} />
        </IconButton>
      </div>
    </div>
  );
}
