import { type DragEvent, useEffect, useRef, useState } from "react";
import { useStore } from "../store";
import type { Item } from "../types";
import { ItemRow } from "./ItemRow";
import { useT } from "../lib/i18n";
import iconDark from "../assets/icon.png";
import iconLight from "../assets/icon-light.png";

export function ItemList({
  items,
  selectedId,
  draggable,
}: {
  items: Item[];
  selectedId: number | null;
  draggable: boolean;
}) {
  const reorder = useStore((s) => s.reorder);
  const query = useStore((s) => s.query);
  const newItem = useStore((s) => s.newItem);
  const isDark = useStore((s) => s.isDark);
  const t = useT();

  const [draggedId, setDraggedId] = useState<number | null>(null);
  const [dropTarget, setDropTarget] = useState<{
    id: number;
    edge: "top" | "bottom";
  } | null>(null);

  const rowRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  useEffect(() => {
    if (selectedId == null) return;
    const el = rowRefs.current.get(selectedId);
    el?.scrollIntoView({ block: "nearest" });
  }, [selectedId]);

  if (items.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center text-zinc-400">
        {query ? (
          <p className="text-sm">{t("listNoMatch")}</p>
        ) : (
          <>
            <img
              src={isDark ? iconDark : iconLight}
              alt=""
              draggable={false}
              className="mb-1 h-12 w-12 rounded-xl opacity-80 shadow-sm"
            />
            <p className="text-sm">{t("listEmpty")}</p>
            <button
              onClick={newItem}
              className="cursor-pointer rounded-md px-2 py-0.5 text-sm text-accent-500 transition-colors hover:bg-accent-500/10 hover:underline"
            >
              {t("listAddFirst")}
            </button>
          </>
        )}
      </div>
    );
  }

  const onDragOver = (item: Item) => (e: DragEvent) => {
    if (!draggable || draggedId == null) return;
    e.preventDefault();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const edge: "top" | "bottom" =
      e.clientY < rect.top + rect.height / 2 ? "top" : "bottom";
    setDropTarget({ id: item.id, edge });
  };

  const onDrop = (item: Item) => (e: DragEvent) => {
    if (!draggable || draggedId == null) return;
    e.preventDefault();
    const edge = dropTarget?.edge ?? "top";
    reorder(draggedId, item.id, edge === "bottom");
    setDraggedId(null);
    setDropTarget(null);
  };

  return (
    <div className="cue-scroll flex-1 overflow-y-auto px-2 pt-1 pb-2">
      {items.map((item) => (
        <div
          key={item.id}
          ref={(el) => {
            if (el) rowRefs.current.set(item.id, el);
            else rowRefs.current.delete(item.id);
          }}
        >
          <ItemRow
            item={item}
            selected={item.id === selectedId}
            draggable={draggable}
            dropEdge={dropTarget?.id === item.id ? dropTarget.edge : null}
            onDragStart={() => setDraggedId(item.id)}
            onDragOver={onDragOver(item)}
            onDrop={onDrop(item)}
            onDragEnd={() => {
              setDraggedId(null);
              setDropTarget(null);
            }}
          />
        </div>
      ))}
    </div>
  );
}
