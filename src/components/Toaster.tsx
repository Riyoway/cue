import { useStore } from "../store";

export function Toaster() {
  const toasts = useStore((s) => s.toasts);

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none absolute bottom-3 left-1/2 z-40 flex -translate-x-1/2 flex-col items-center gap-1.5"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`cue-toast rounded-full px-3.5 py-1.5 text-[13px] font-medium shadow-lg ring-1 ${
            t.kind === "error"
              ? "bg-red-600 text-white ring-red-700/30"
              : "bg-zinc-900 text-white ring-black/10 dark:bg-zinc-100 dark:text-zinc-900 dark:ring-white/10"
          }`}
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}
