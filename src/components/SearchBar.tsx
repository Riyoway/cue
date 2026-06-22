import type { RefObject } from "react";
import { Search } from "lucide-react";
import { useStore } from "../store";
import { useT } from "../lib/i18n";

export function SearchBar({
  inputRef,
}: {
  inputRef: RefObject<HTMLInputElement | null>;
}) {
  const t = useT();
  const query = useStore((s) => s.query);
  const setQuery = useStore((s) => s.setQuery);

  return (
    <div className="flex shrink-0 items-center gap-2.5 px-3.5 py-2.5">
      <Search size={16} className="shrink-0 text-zinc-400" aria-hidden />
      <input
        ref={inputRef}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t("searchPlaceholder")}
        aria-label={t("searchAria")}
        spellCheck={false}
        autoComplete="off"
        className="w-full bg-transparent text-[15px] text-zinc-800 outline-none placeholder:text-zinc-400 dark:text-zinc-100 dark:placeholder:text-zinc-500"
      />
    </div>
  );
}
