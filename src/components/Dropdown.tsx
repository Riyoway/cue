import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";

export interface DropdownOption {
  value: string;
  label: string;
}

/** 独自スタイルのドロップダウン（ネイティブ select の代替）。
 *  メニューは position: fixed なので overflow-hidden のカード内でも切れない。 */
export function Dropdown({
  value,
  options,
  onChange,
  ariaLabel,
}: {
  value: string;
  options: DropdownOption[];
  onChange: (v: string) => void;
  ariaLabel?: string;
}) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState({ left: 0, top: 0, minWidth: 0 });
  const current = options.find((o) => o.value === value);

  const openMenu = () => {
    const r = triggerRef.current?.getBoundingClientRect();
    if (!r) return;
    setCoords({ left: r.left, top: r.bottom + 6, minWidth: r.width });
    setOpen(true);
  };

  // 画面内に収まるよう補正（描画前に確定）
  useLayoutEffect(() => {
    if (!open || !menuRef.current || !triggerRef.current) return;
    const m = menuRef.current.getBoundingClientRect();
    const tr = triggerRef.current.getBoundingClientRect();
    const pad = 8;
    let left = tr.left;
    let top = tr.bottom + 6;
    if (left + m.width > window.innerWidth - pad)
      left = window.innerWidth - m.width - pad;
    if (top + m.height > window.innerHeight - pad)
      top = tr.top - m.height - 6;
    setCoords({
      left: Math.max(pad, left),
      top: Math.max(pad, top),
      minWidth: tr.width,
    });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const onDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    // 外側スクロール時はトリガーに追従して再配置（メニュー内スクロールは無視＝閉じない）
    const onScroll = (e: Event) => {
      if (menuRef.current?.contains(e.target as Node)) return;
      const r = triggerRef.current?.getBoundingClientRect();
      if (r)
        setCoords((c) => ({ ...c, left: r.left, top: r.bottom + 6, minWidth: r.width }));
    };
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => (open ? setOpen(false) : openMenu())}
        className="flex h-9 min-w-[160px] cursor-pointer items-center justify-between gap-2 rounded-lg border border-zinc-300 bg-transparent px-3 text-[13px] text-zinc-800 outline-none transition-colors duration-150 hover:border-zinc-400 focus-visible:ring-2 focus-visible:ring-accent-500/40 dark:border-zinc-700 dark:text-zinc-100 dark:hover:border-zinc-600"
      >
        <span className="truncate">{current?.label ?? value}</span>
        <ChevronDown
          size={15}
          className={`shrink-0 text-zinc-400 transition-transform duration-150 ${
            open ? "rotate-180" : ""
          }`}
          aria-hidden
        />
      </button>
      {open && (
        <div
          ref={menuRef}
          role="listbox"
          style={{
            position: "fixed",
            left: coords.left,
            top: coords.top,
            minWidth: coords.minWidth,
          }}
          className="cue-fade-in cue-scroll z-50 max-h-72 overflow-y-auto rounded-xl border border-zinc-200 bg-white py-1 shadow-xl dark:border-zinc-700 dark:bg-zinc-800"
        >
          {options.map((o) => {
            const selected = o.value === value;
            return (
              <button
                key={o.value}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => {
                  onChange(o.value);
                  setOpen(false);
                }}
                className={`flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-left text-[13px] transition-colors ${
                  selected
                    ? "bg-accent-500/10 font-medium text-accent-600 dark:text-accent-300"
                    : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-700/70"
                }`}
              >
                <span className="grid w-4 shrink-0 place-items-center">
                  {selected && <Check size={14} aria-hidden />}
                </span>
                <span className="flex-1 truncate">{o.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </>
  );
}
