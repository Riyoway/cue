import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useStore } from "../store";

export function ContextMenu() {
  const menu = useStore((s) => s.contextMenu);
  const close = useStore((s) => s.closeContextMenu);
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });

  // 画面内に収まるよう座標を補正（描画前に確定させてちらつきを防ぐ）
  useLayoutEffect(() => {
    if (!menu || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    const pad = 8;
    let x = menu.x;
    let y = menu.y;
    if (x + r.width > window.innerWidth - pad) x = window.innerWidth - r.width - pad;
    if (y + r.height > window.innerHeight - pad) y = window.innerHeight - r.height - pad;
    setPos({ x: Math.max(pad, x), y: Math.max(pad, y) });
  }, [menu]);

  useEffect(() => {
    if (!menu) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("pointerdown", close);
    window.addEventListener("keydown", onKey);
    window.addEventListener("blur", close);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    return () => {
      window.removeEventListener("pointerdown", close);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("blur", close);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [menu, close]);

  if (!menu) return null;

  return (
    <div
      ref={ref}
      role="menu"
      onPointerDown={(e) => e.stopPropagation()}
      style={{ left: pos.x, top: pos.y }}
      className="cue-fade-in fixed z-50 min-w-[184px] overflow-hidden rounded-xl border border-zinc-200 bg-white py-1 shadow-xl dark:border-zinc-700 dark:bg-zinc-800"
    >
      {menu.items.map((item, i) => (
        <button
          key={i}
          type="button"
          role="menuitem"
          onClick={() => {
            item.onSelect();
            close();
          }}
          className={`flex w-full cursor-pointer items-center gap-2.5 px-3 py-1.5 text-left text-[13px] outline-none transition-colors ${
            item.danger
              ? "text-red-600 hover:bg-red-500/10 dark:text-red-400"
              : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-700/70"
          }`}
        >
          {item.icon && (
            <span className="grid h-4 w-4 shrink-0 place-items-center opacity-80">
              {item.icon}
            </span>
          )}
          <span className="flex-1 truncate">{item.label}</span>
        </button>
      ))}
    </div>
  );
}
