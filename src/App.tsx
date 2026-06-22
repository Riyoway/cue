import {
  type MouseEvent as ReactMouseEvent,
  useEffect,
  useMemo,
  useRef,
} from "react";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { useStore } from "./store";
import { filterItems } from "./lib/search";
import { setWindowBackground } from "./lib/tauri";
import { Header } from "./components/Header";
import { ContextMenu } from "./components/ContextMenu";
import { ConfirmDialog } from "./components/ConfirmDialog";
import { Sidebar } from "./components/Sidebar";
import { SearchBar } from "./components/SearchBar";
import { ItemList } from "./components/ItemList";
import { Editor } from "./components/Editor";
import { Settings } from "./components/Settings";
import { Toaster } from "./components/Toaster";

export default function App() {
  const ready = useStore((s) => s.ready);
  const items = useStore((s) => s.items);
  const activeProjectId = useStore((s) => s.activeProjectId);
  const query = useStore((s) => s.query);
  const selectedId = useStore((s) => s.selectedId);
  const editorOpen = useStore((s) => s.editor !== null);
  const settingsOpen = useStore((s) => s.settingsOpen);
  const sidebarCollapsed = useStore((s) => s.settings.sidebar_collapsed);

  const searchRef = useRef<HTMLInputElement>(null);

  const visible = useMemo(() => {
    const inProject =
      activeProjectId == null
        ? items
        : items.filter((i) => i.project_id === activeProjectId);
    return filterItems(inProject, query);
  }, [items, query, activeProjectId]);
  const draggable = query.trim() === "" && activeProjectId != null;

  // 初期化
  useEffect(() => {
    useStore.getState().init();
  }, []);

  // 選択が表示範囲外なら先頭へ
  useEffect(() => {
    const s = useStore.getState();
    if (visible.length && !visible.some((i) => i.id === s.selectedId)) {
      s.select(visible[0].id);
    }
  }, [visible]);

  // Tauri イベント連携（召喚時の検索フォーカス / クリップボード即保存）
  useEffect(() => {
    let active = true;
    let unlistens: UnlistenFn[] = [];
    (async () => {
      const focusSearch = await listen("cue://focus-search", () => {
        requestAnimationFrame(() => {
          searchRef.current?.focus();
          searchRef.current?.select();
        });
      });
      const quickSave = await listen("cue://quick-save", () => {
        useStore.getState().quickSaveFromClipboard();
      });
      if (!active) {
        focusSearch();
        quickSave();
        return;
      }
      unlistens = [focusSearch, quickSave];
    })();
    return () => {
      active = false;
      unlistens.forEach((u) => u());
    };
  }, []);

  // システムテーマ変更に追従 (theme === system のとき)
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      const s = useStore.getState();
      if (s.settings.theme === "system") {
        document.documentElement.classList.toggle("dark", mq.matches);
        useStore.setState({ isDark: mq.matches });
        void setWindowBackground(mq.matches);
      }
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // グローバルキー操作
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const s = useStore.getState();

      // 確認モーダル表示中はモーダル側に任せる（Escape の二重処理を防ぐ）。
      if (s.pendingProjectDelete || s.pendingDataErase) return;

      if (s.settingsOpen) {
        if (e.key === "Escape") {
          e.preventDefault();
          s.closeSettings();
        }
        return;
      }
      if (s.editor) {
        if (e.key === "Escape") {
          e.preventDefault();
          s.closeEditor();
        }
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "n") {
        e.preventDefault();
        s.newItem();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "f") {
        e.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
        return;
      }
      if (e.key === "Escape") {
        if (s.query) {
          e.preventDefault();
          s.setQuery("");
        }
        return;
      }

      const inProject =
        s.activeProjectId == null
          ? s.items
          : s.items.filter((i) => i.project_id === s.activeProjectId);
      const list = filterItems(inProject, s.query);
      if (list.length === 0) return;
      const idx = list.findIndex((i) => i.id === s.selectedId);

      if (e.key === "ArrowDown") {
        e.preventDefault();
        const next = list[Math.min(list.length - 1, (idx < 0 ? -1 : idx) + 1)];
        s.select(next.id);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        const prev = list[Math.max(0, (idx < 0 ? 0 : idx) - 1)];
        s.select(prev.id);
      } else if (e.key === "Enter") {
        e.preventDefault();
        const item = list[idx < 0 ? 0 : idx];
        if (item) s.copyItem(item);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // 入力欄以外ではネイティブの右クリックメニューを抑止（独自メニューを使う）
  const onRootContextMenu = (e: ReactMouseEvent) => {
    const t = e.target as HTMLElement;
    if (!t.closest("input, textarea, [contenteditable]")) {
      e.preventDefault();
      useStore.getState().closeContextMenu();
    }
  };

  return (
    <div
      onContextMenu={onRootContextMenu}
      className="relative flex h-full flex-col overflow-hidden border border-zinc-300 bg-zinc-100 text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
    >
      <Header />
      <div className="flex min-h-0 flex-1">
        {ready && !sidebarCollapsed && <Sidebar />}
        {/* コンテンツは上＋左に連続した枠線＋左上 rounded-tl（切り欠き/インセット）。
            サイドバー折りたたみ時は左枠線・角丸を出さず全幅フラットに。 */}
        <div
          className={`relative flex min-w-0 flex-1 flex-col overflow-hidden bg-white dark:bg-zinc-900 ${
            sidebarCollapsed
              ? "border-t border-zinc-300 dark:border-zinc-700"
              : "rounded-tl-2xl border-t border-l border-zinc-300 dark:border-zinc-700"
          }`}
        >
          <SearchBar inputRef={searchRef} />
          <div className="mx-3 h-px shrink-0 bg-zinc-200 dark:bg-zinc-800/80" />
          {ready && (
            <ItemList
              items={visible}
              selectedId={selectedId}
              draggable={draggable}
            />
          )}
        </div>
      </div>

      {editorOpen && <Editor />}
      {settingsOpen && <Settings />}
      <ContextMenu />
      <ConfirmDialog />
      <Toaster />
    </div>
  );
}
