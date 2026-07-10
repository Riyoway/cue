import type { ReactNode } from "react";
import { create } from "zustand";
import {
  disable as disableAutostart,
  enable as enableAutostart,
  isEnabled as isAutostartEnabled,
} from "@tauri-apps/plugin-autostart";
import {
  DEFAULT_SETTINGS,
  type Item,
  type Project,
  type Settings,
  type ThemeMode,
} from "./types";
import * as dbApi from "./lib/db";
import { type Lang, detectLang, makeTranslate } from "./lib/i18n";
import { type Update, checkUpdate, currentVersion, relaunch } from "./lib/update";
import { IMAGE_COPY_MIN_CHARS, renderTextToPngBlob } from "./lib/render";
import { activeConfig, aiOptimize } from "./lib/ai";
import {
  applyShortcuts,
  copyImageToClipboard,
  copyToClipboard,
  exportData,
  gitAvailable,
  gitCommitSnapshot,
  gitRemoteSnapshot,
  importData,
  openDialog,
  readClipboard,
  saveDialog,
  setWebviewZoom,
  setWindowAlwaysOnTop,
  setWindowBackground,
} from "./lib/tauri";

export interface EditorDraft {
  id: number | null; // null = 新規
  title: string;
  body: string;
}

export interface ContextMenuItem {
  label: string;
  icon?: ReactNode;
  danger?: boolean;
  onSelect: () => void;
}

export interface ContextMenuState {
  x: number;
  y: number;
  items: ContextMenuItem[];
}

interface Toast {
  id: number;
  message: string;
  kind: "info" | "error";
}

interface CueState {
  ready: boolean;
  items: Item[];
  projects: Project[];
  activeProjectId: number | null; // null = すべて
  query: string;
  selectedId: number | null;
  editor: EditorDraft | null;
  previewMode: boolean;
  settingsOpen: boolean;
  settings: Settings;
  windowPinned: boolean;
  toasts: Toast[];
  syncing: boolean;
  lastSyncedAt: number | null;
  isDark: boolean;
  version: string;
  update: Update | null;
  updateDismissed: boolean;
  installing: boolean;
  /** ダウンロード進捗 0-100（null = 未ダウンロード）。 */
  updateProgress: number | null;
  contextMenu: ContextMenuState | null;
  renamingProjectId: number | null;
  renamingItemId: number | null;
  pendingProjectDelete: { id: number; name: string; count: number } | null;
  pendingDataErase: boolean;
  pendingImageCopy: { text: string; itemId: number | null } | null;

  init: () => Promise<void>;
  refresh: () => Promise<void>;
  reloadAll: () => Promise<void>;
  checkForUpdate: () => Promise<void>;
  dismissUpdate: () => void;
  installUpdate: () => Promise<void>;
  exportToFile: () => Promise<void>;
  importFromFile: () => Promise<void>;
  setGitConfig: (remote: string, branch: string, enabled: boolean) => Promise<void>;
  syncNow: () => Promise<void>;
  setQuery: (q: string) => void;
  select: (id: number | null) => void;

  setActiveProject: (id: number | null) => void;
  addProject: (name: string) => Promise<void>;
  renameProject: (id: number, name: string) => Promise<void>;
  removeProject: (id: number) => Promise<void>;
  confirmProjectDelete: (id?: number) => Promise<void>;
  cancelProjectDelete: () => void;
  requestDataErase: () => void;
  confirmDataErase: () => Promise<void>;
  cancelDataErase: () => void;
  reorderProject: (
    draggedId: number,
    targetId: number,
    below: boolean,
  ) => Promise<void>;

  openContextMenu: (x: number, y: number, items: ContextMenuItem[]) => void;
  closeContextMenu: () => void;
  startRenameProject: (id: number | null) => void;
  startRenameItem: (id: number | null) => void;
  renameItem: (id: number, title: string) => Promise<void>;

  copyItem: (item: Item) => Promise<void>;
  /** 画像コピーを要求。推奨外（短い）で未黙認なら警告ダイアログを出し、それ以外は即コピー。 */
  requestImageCopy: (text: string, itemId?: number) => Promise<void>;
  confirmImageCopy: (dontAskAgain: boolean) => Promise<void>;
  cancelImageCopy: () => void;
  quickSaveFromClipboard: () => Promise<void>;

  newItem: () => void;
  editItem: (item: Item) => void;
  previewItem: (item: Item) => void;
  updateDraft: (partial: Partial<EditorDraft>) => void;
  saveDraft: () => Promise<void>;
  closeEditor: () => void;
  togglePreview: () => void;
  optimizing: boolean;
  optimizeDraft: () => Promise<void>;

  removeItem: (id: number) => Promise<void>;
  togglePin: (item: Item) => Promise<void>;
  reorder: (draggedId: number, targetId: number, below: boolean) => Promise<void>;

  openSettings: () => void;
  closeSettings: () => void;
  saveSettings: (next: Settings) => Promise<void>;
  setTheme: (theme: ThemeMode) => Promise<void>;
  setAccent: (accent: string) => Promise<void>;
  setLang: (lang: string) => Promise<void>;
  toggleSidebar: () => Promise<void>;

  setWindowPinned: (value: boolean) => Promise<void>;

  toast: (message: string, kind?: "info" | "error") => void;
  removeToast: (id: number) => void;
}

let toastSeq = 1;

function applyTheme(theme: ThemeMode): boolean {
  const dark =
    theme === "dark" ||
    (theme === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
  void setWindowBackground(dark);
  return dark;
}

function applyAccent(accent: string) {
  document.documentElement.setAttribute("data-accent", accent);
}

function applyTextScale(scale: number) {
  void setWebviewZoom(scale || 1);
}

/** 現在の言語に紐づく翻訳関数（store 内トースト用）。 */
const tr = (lang: string) => makeTranslate(lang as Lang);

/** テキストを画像化してクリップボードへ。推奨外の警告ゲートは呼び出し側で判定する。
 *  itemId があればコピー回数も更新（未保存の下書きは null）。 */
async function doImageCopy(text: string, itemId: number | null): Promise<void> {
  const lang = useStore.getState().settings.lang;
  try {
    await copyImageToClipboard(await renderTextToPngBlob(text));
    if (itemId != null) {
      await dbApi.touchCopy(itemId);
      useStore.setState((s) => ({
        items: s.items.map((i) =>
          i.id === itemId
            ? { ...i, copy_count: i.copy_count + 1, last_copied_at: Date.now() }
            : i,
        ),
      }));
    }
    useStore.getState().toast(tr(lang)("tCopiedImage"));
  } catch (e) {
    useStore.getState().toast(tr(lang)("tCopyImageFail", { e: String(e) }), "error");
  }
}

export const useStore = create<CueState>((set, get) => ({
  ready: false,
  items: [],
  projects: [],
  activeProjectId: null,
  query: "",
  selectedId: null,
  editor: null,
  previewMode: false,
  optimizing: false,
  settingsOpen: false,
  settings: DEFAULT_SETTINGS,
  windowPinned: false,
  toasts: [],
  syncing: false,
  lastSyncedAt: null,
  isDark: false,
  version: "",
  update: null,
  updateDismissed: false,
  installing: false,
  updateProgress: null,
  contextMenu: null,
  pendingProjectDelete: null,
  pendingDataErase: false,
  pendingImageCopy: null,
  renamingProjectId: null,
  renamingItemId: null,

  init: async () => {
    const settings = await dbApi.getSettings();
    if (!settings.lang) {
      settings.lang = detectLang();
      await dbApi.setSetting("lang", settings.lang);
    }
    const dark = applyTheme(settings.theme);
    applyAccent(settings.accent);
    applyTextScale(settings.text_scale);
    const [items, projects] = await Promise.all([
      dbApi.listItems(),
      dbApi.listProjects(),
    ]);
    const activeProjectId = projects[0]?.id ?? null;
    const firstVisible =
      items.find((i) => i.project_id === activeProjectId) ?? items[0];

    set({
      settings,
      items,
      projects,
      activeProjectId,
      selectedId: firstVisible?.id ?? null,
      windowPinned: settings.always_on_top_default,
      isDark: dark,
      ready: true,
    });

    // ウィンドウ常駐 / ショートカット / 自動起動を設定値に同期
    try {
      await setWindowAlwaysOnTop(settings.always_on_top_default);
    } catch {
      /* noop */
    }
    try {
      await applyShortcuts(
        settings.summon_shortcut,
        settings.quicksave_shortcut,
      );
    } catch (e) {
      get().toast(tr(get().settings.lang)("tShortcutFail", { e: String(e) }), "error");
    }
    try {
      const enabled = await isAutostartEnabled();
      if (enabled !== settings.autostart) {
        if (settings.autostart) await enableAutostart();
        else await disableAutostart();
      }
    } catch {
      /* noop */
    }

    // 起動を妨げないようアップデート確認はバックグラウンドで。
    void get().checkForUpdate();
  },

  checkForUpdate: async () => {
    const version = await currentVersion();
    if (version && version !== get().version) set({ version });
    const update = await checkUpdate();
    if (update) set({ update });
  },

  dismissUpdate: () => set({ updateDismissed: true }),

  installUpdate: async () => {
    const { update, installing } = get();
    if (!update || installing) return;
    const lang = get().settings.lang;
    set({ installing: true, updateProgress: 0 });
    try {
      let total = 0;
      let received = 0;
      await update.downloadAndInstall((e) => {
        if (e.event === "Started") {
          total = e.data.contentLength ?? 0;
        } else if (e.event === "Progress") {
          received += e.data.chunkLength;
          set({
            updateProgress: total ? Math.min(99, Math.round((received / total) * 100)) : null,
          });
        } else if (e.event === "Finished") {
          set({ updateProgress: 100 });
        }
      });
      await relaunch(); // 成功したら再起動（以降このプロセスは終了）
    } catch (e) {
      set({ installing: false, updateProgress: null });
      get().toast(tr(lang)("tUpdateFail", { e: String(e) }), "error");
    }
  },

  refresh: async () => {
    const items = await dbApi.listItems();
    set((s) => ({
      items,
      selectedId:
        s.selectedId && items.some((i) => i.id === s.selectedId)
          ? s.selectedId
          : (items[0]?.id ?? null),
    }));
  },

  reloadAll: async () => {
    const [items, projects] = await Promise.all([
      dbApi.listItems(),
      dbApi.listProjects(),
    ]);
    set((s) => ({
      items,
      projects,
      activeProjectId:
        s.activeProjectId === null ||
        projects.some((p) => p.id === s.activeProjectId)
          ? s.activeProjectId
          : (projects[0]?.id ?? null),
    }));
  },

  exportToFile: async () => {
    const snap = await dbApi.buildSnapshot();
    const json = JSON.stringify(snap, null, 2);
    const date = new Date().toISOString().slice(0, 10);
    const path = await saveDialog(`cue-backup-${date}.json`);
    if (!path) return;
    try {
      await exportData(path, json);
      get().toast(tr(get().settings.lang)("tExported"));
    } catch (e) {
      get().toast(tr(get().settings.lang)("tExportFail", { e: String(e) }), "error");
    }
  },

  importFromFile: async () => {
    const path = await openDialog();
    if (!path || Array.isArray(path)) return;
    try {
      const json = await importData(path);
      await dbApi.mergeSnapshot(JSON.parse(json));
      await get().reloadAll();
      get().toast(tr(get().settings.lang)("tImported"));
    } catch (e) {
      const lang = get().settings.lang;
      // 不正なバックアップ形式は専用の翻訳メッセージに、それ以外は詳細付きで表示。
      if (String(e).includes("invalid-cue-backup")) {
        get().toast(tr(lang)("tImportBadFormat"), "error");
      } else {
        get().toast(tr(lang)("tImportFail", { e: String(e) }), "error");
      }
    }
  },

  setGitConfig: async (remote, branch, enabled) => {
    const r = remote.trim();
    const b = branch.trim() || "main";
    await dbApi.setSetting("git_remote", r);
    await dbApi.setSetting("git_branch", b);
    await dbApi.setSetting("git_enabled", enabled ? "1" : "0");
    set((s) => ({
      settings: {
        ...s.settings,
        git_remote: r,
        git_branch: b,
        git_enabled: enabled,
      },
    }));
  },

  syncNow: async () => {
    const { settings, syncing } = get();
    if (syncing) return;
    const remote = settings.git_remote.trim();
    const branch = settings.git_branch.trim() || "main";
    if (!remote) {
      get().toast(tr(get().settings.lang)("tSetRepo"), "error");
      return;
    }
    if (!(await gitAvailable())) {
      get().toast(tr(get().settings.lang)("tGitMissing"), "error");
      return;
    }
    set({ syncing: true });
    try {
      // 1. リモートの最新を取り込み（マージ）
      const remoteJson = await gitRemoteSnapshot(remote, branch);
      if (remoteJson) {
        try {
          await dbApi.mergeSnapshot(JSON.parse(remoteJson));
        } catch {
          /* リモートが壊れていても自分の分は push する */
        }
      }
      // 2. マージ後のスナップショットを push
      const snap = await dbApi.buildSnapshot();
      const json = JSON.stringify(snap, null, 2);
      await gitCommitSnapshot(
        remote,
        branch,
        json,
        `cue sync ${new Date().toISOString()}`,
      );
      await get().reloadAll();
      set({ lastSyncedAt: Date.now() });
      get().toast(tr(get().settings.lang)("tSynced"));
    } catch (e) {
      get().toast(tr(get().settings.lang)("tSyncFail", { e: String(e) }), "error");
    } finally {
      set({ syncing: false });
    }
  },

  setQuery: (q) => set({ query: q }),
  select: (id) => set({ selectedId: id }),

  setActiveProject: (id) => set({ activeProjectId: id, query: "" }),

  openContextMenu: (x, y, items) => set({ contextMenu: { x, y, items } }),
  closeContextMenu: () => set({ contextMenu: null }),
  startRenameProject: (id) => set({ renamingProjectId: id, contextMenu: null }),
  startRenameItem: (id) => set({ renamingItemId: id, contextMenu: null }),
  renameItem: async (id, title) => {
    await dbApi.setItemTitle(id, title.trim());
    set({ renamingItemId: null });
    await get().refresh();
  },

  addProject: async (name) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const created = await dbApi.createProject(trimmed);
    const projects = await dbApi.listProjects();
    set({ projects, activeProjectId: created.id, query: "" });
    get().toast(tr(get().settings.lang)("tProjectCreated"));
  },

  renameProject: async (id, name) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    await dbApi.renameProject(id, trimmed);
    set({ projects: await dbApi.listProjects() });
  },

  removeProject: async (id) => {
    const projects = get().projects;
    if (projects.length <= 1) {
      get().toast(tr(get().settings.lang)("tLastProject"), "error");
      return;
    }
    const count = get().items.filter((i) => i.project_id === id).length;
    // 中にプロンプトがある場合は確認ダイアログを出す。空なら即削除。
    if (count > 0) {
      const name = projects.find((p) => p.id === id)?.name ?? "";
      set({ pendingProjectDelete: { id, name, count }, contextMenu: null });
      return;
    }
    await get().confirmProjectDelete(id);
  },

  confirmProjectDelete: async (id) => {
    const targetId = id ?? get().pendingProjectDelete?.id;
    if (targetId == null) return;
    await dbApi.deleteProject(targetId);
    const nextProjects = await dbApi.listProjects();
    set((s) => ({
      projects: nextProjects,
      activeProjectId:
        s.activeProjectId === targetId ? null : s.activeProjectId,
      pendingProjectDelete: null,
    }));
    await get().refresh();
    get().toast(tr(get().settings.lang)("tProjectDeleted"));
  },

  cancelProjectDelete: () => set({ pendingProjectDelete: null }),

  requestDataErase: () => set({ pendingDataErase: true }),
  cancelDataErase: () => set({ pendingDataErase: false }),

  confirmDataErase: async () => {
    await dbApi.eraseAllData();

    // 設定を既定値へ。言語のみ OS から再検出（初回起動と同じ挙動）。
    const lang = detectLang();
    const settings: Settings = { ...DEFAULT_SETTINGS, lang };
    await dbApi.setSetting("lang", lang);

    // ランタイム副作用（テーマ / 常駐 / ショートカット / 自動起動）も既定へ戻す。
    const dark = applyTheme(settings.theme);
    applyAccent(settings.accent);
    applyTextScale(settings.text_scale);
    try {
      await setWindowAlwaysOnTop(settings.always_on_top_default);
    } catch {
      /* noop */
    }
    try {
      await applyShortcuts(settings.summon_shortcut, settings.quicksave_shortcut);
    } catch (e) {
      get().toast(tr(lang)("tShortcutFail", { e: String(e) }), "error");
    }
    try {
      if (await isAutostartEnabled()) await disableAutostart();
    } catch {
      /* noop */
    }

    const [items, projects] = await Promise.all([
      dbApi.listItems(),
      dbApi.listProjects(),
    ]);

    set({
      settings,
      items,
      projects,
      activeProjectId: projects[0]?.id ?? null,
      selectedId: null,
      query: "",
      editor: null,
      previewMode: false,
      isDark: dark,
      windowPinned: settings.always_on_top_default,
      lastSyncedAt: null,
      pendingDataErase: false,
      pendingProjectDelete: null,
      settingsOpen: false,
    });
    get().toast(tr(lang)("tDataErased"));
  },

  reorderProject: async (draggedId, targetId, below) => {
    if (draggedId === targetId) return;
    const projects = get().projects; // position ASC で整列済み
    const target = projects.find((p) => p.id === targetId);
    if (!target) return;
    const targetIndex = projects.findIndex((p) => p.id === targetId);
    const neighborIndex = below ? targetIndex + 1 : targetIndex - 1;
    const neighbor = projects[neighborIndex];

    const newPos = neighbor
      ? (target.position + neighbor.position) / 2
      : below
        ? target.position + 1
        : target.position - 1;

    await dbApi.setProjectPosition(draggedId, newPos);
    set({ projects: await dbApi.listProjects() });
  },

  copyItem: async (item) => {
    await copyToClipboard(item.body);
    await dbApi.touchCopy(item.id);
    get().toast(tr(get().settings.lang)("tCopied"));
    set((s) => ({
      items: s.items.map((i) =>
        i.id === item.id
          ? { ...i, copy_count: i.copy_count + 1, last_copied_at: Date.now() }
          : i,
      ),
    }));
  },

  requestImageCopy: async (text, itemId) => {
    const { settings } = get();
    // 推奨外（短い）かつ未黙認なら警告ダイアログへ。それ以外は即コピー。
    if (text.length < IMAGE_COPY_MIN_CHARS && !settings.image_copy_warn_dismissed) {
      set({ pendingImageCopy: { text, itemId: itemId ?? null } });
      return;
    }
    await doImageCopy(text, itemId ?? null);
  },

  confirmImageCopy: async (dontAskAgain) => {
    const p = get().pendingImageCopy;
    set({ pendingImageCopy: null });
    if (dontAskAgain) {
      await dbApi.setSetting("image_copy_warn_dismissed", "1");
      set((s) => ({ settings: { ...s.settings, image_copy_warn_dismissed: true } }));
    }
    if (p) await doImageCopy(p.text, p.itemId);
  },

  cancelImageCopy: () => set({ pendingImageCopy: null }),

  quickSaveFromClipboard: async () => {
    let text: string | null = null;
    try {
      text = await readClipboard();
    } catch {
      text = null;
    }
    if (!text || !text.trim()) {
      get().toast(tr(get().settings.lang)("tClipboardEmpty"), "error");
      return;
    }
    const pid = get().activeProjectId ?? get().projects[0]?.id ?? null;
    const created = await dbApi.createItem(pid, "", text);
    await get().refresh();
    set({ selectedId: created.id, query: "" });
    get().toast(tr(get().settings.lang)("tSavedFromClipboard"));
  },

  newItem: () =>
    set({
      editor: { id: null, title: "", body: "" },
      previewMode: false,
    }),

  editItem: (item) =>
    set({
      editor: { id: item.id, title: item.title, body: item.body },
      previewMode: false,
    }),

  previewItem: (item) =>
    set({
      editor: { id: item.id, title: item.title, body: item.body },
      previewMode: true,
    }),

  updateDraft: (partial) =>
    set((s) => (s.editor ? { editor: { ...s.editor, ...partial } } : {})),

  saveDraft: async () => {
    const draft = get().editor;
    if (!draft) return;
    if (!draft.title.trim() && !draft.body.trim()) {
      set({ editor: null });
      return;
    }
    let selectedId: number;
    if (draft.id === null) {
      const pid = get().activeProjectId ?? get().projects[0]?.id ?? null;
      const created = await dbApi.createItem(pid, draft.title, draft.body);
      selectedId = created.id;
    } else {
      await dbApi.updateItem(draft.id, draft.title, draft.body);
      selectedId = draft.id;
    }
    await get().refresh();
    set({ editor: null, selectedId });
    get().toast(tr(get().settings.lang)("tSaved"));
  },

  closeEditor: () => set({ editor: null }),
  togglePreview: () => set((s) => ({ previewMode: !s.previewMode })),

  optimizeDraft: async () => {
    const { editor, settings, optimizing } = get();
    if (optimizing || !editor) return;
    const lang = settings.lang;
    const provider = settings.ai.provider;
    if (!provider) {
      get().toast(tr(lang)("tAiNotConfigured"), "error");
      return;
    }
    if (!editor.body.trim()) return;
    set({ optimizing: true });
    try {
      const result = await aiOptimize(provider, activeConfig(settings.ai), editor.body);
      // 最適化中に別の編集へ切り替わっていなければ結果を反映。
      set((s) => (s.editor ? { editor: { ...s.editor, body: result } } : {}));
      get().toast(tr(lang)("tOptimized"));
    } catch (e) {
      get().toast(tr(lang)("tOptimizeFail", { e: String(e) }), "error");
    } finally {
      set({ optimizing: false });
    }
  },

  removeItem: async (id) => {
    await dbApi.deleteItem(id);
    await get().refresh();
    get().toast(tr(get().settings.lang)("tDeleted"));
  },

  togglePin: async (item) => {
    await dbApi.setPinned(item.id, !item.pinned);
    await get().refresh();
  },

  reorder: async (draggedId, targetId, below) => {
    if (draggedId === targetId) return;
    const items = get().items;
    const target = items.find((i) => i.id === targetId);
    const dragged = items.find((i) => i.id === draggedId);
    if (!target || !dragged) return;

    // 同じプロジェクト内の並び (items は pinned DESC, position ASC で整列済み)
    const group = items.filter((i) => i.project_id === target.project_id);
    const targetIndex = group.findIndex((i) => i.id === targetId);
    const neighborIndex = below ? targetIndex + 1 : targetIndex - 1;
    const neighbor = group[neighborIndex];

    let newPos: number;
    if (!neighbor) {
      newPos = below ? target.position + 1 : target.position - 1;
    } else {
      newPos = (target.position + neighbor.position) / 2;
    }

    // ドロップ先のプロジェクト / ピン状態に合わせる
    if (dragged.project_id !== target.project_id) {
      await dbApi.setItemProject(draggedId, target.project_id);
    }
    if (dragged.pinned !== target.pinned) {
      await dbApi.setPinned(draggedId, target.pinned);
    }
    await dbApi.setPosition(draggedId, newPos);
    await get().refresh();
  },

  openSettings: () => set({ settingsOpen: true }),
  closeSettings: () => set({ settingsOpen: false }),

  setTheme: async (theme) => {
    await dbApi.setSetting("theme", theme);
    const dark = applyTheme(theme);
    set((s) => ({ settings: { ...s.settings, theme }, isDark: dark }));
  },

  setAccent: async (accent) => {
    await dbApi.setSetting("accent", accent);
    applyAccent(accent);
    set((s) => ({ settings: { ...s.settings, accent } }));
  },

  setLang: async (lang) => {
    await dbApi.setSetting("lang", lang);
    set((s) => ({ settings: { ...s.settings, lang } }));
  },

  toggleSidebar: async () => {
    const next = !get().settings.sidebar_collapsed;
    await dbApi.setSetting("sidebar_collapsed", next ? "1" : "0");
    set((s) => ({ settings: { ...s.settings, sidebar_collapsed: next } }));
  },

  saveSettings: async (next) => {
    const prev = get().settings;

    // テーマはヘッダーの即時切替 (setTheme) で管理するため、ここでは触らない
    await dbApi.setSetting("summon_shortcut", next.summon_shortcut);
    await dbApi.setSetting("quicksave_shortcut", next.quicksave_shortcut);
    await dbApi.setSetting("autostart", next.autostart ? "1" : "0");
    await dbApi.setSetting(
      "always_on_top_default",
      next.always_on_top_default ? "1" : "0",
    );
    await dbApi.setSetting("git_enabled", next.git_enabled ? "1" : "0");
    await dbApi.setSetting("git_remote", next.git_remote.trim());
    await dbApi.setSetting("git_branch", next.git_branch.trim() || "main");
    await dbApi.setSetting("accent", next.accent);
    await dbApi.setSetting("lang", next.lang);
    await dbApi.setSetting("text_scale", String(next.text_scale));
    await dbApi.setSetting("promote_image_copy", next.promote_image_copy ? "1" : "0");
    await dbApi.setSetting("ai_config", JSON.stringify(next.ai));
    applyAccent(next.accent);
    applyTextScale(next.text_scale);

    if (
      next.summon_shortcut !== prev.summon_shortcut ||
      next.quicksave_shortcut !== prev.quicksave_shortcut
    ) {
      try {
        await applyShortcuts(next.summon_shortcut, next.quicksave_shortcut);
      } catch (e) {
        get().toast(tr(get().settings.lang)("tShortcutFail", { e: String(e) }), "error");
      }
    }

    if (next.autostart !== prev.autostart) {
      try {
        if (next.autostart) await enableAutostart();
        else await disableAutostart();
      } catch (e) {
        get().toast(tr(get().settings.lang)("tAutostartFail", { e: String(e) }), "error");
      }
    }

    // テーマ / サイドバー開閉は即時トグルで管理するため store 側を保持。
    // アクセント / 言語は draft (next) を保存時に適用。
    set((s) => ({
      settings: {
        ...next,
        theme: s.settings.theme,
        sidebar_collapsed: s.settings.sidebar_collapsed,
        // ダイアログ側で更新される値。設定画面の古い draft で上書きしない。
        image_copy_warn_dismissed: s.settings.image_copy_warn_dismissed,
      },
      settingsOpen: false,
    }));
    get().toast(tr(get().settings.lang)("tSettingsSaved"));
  },

  setWindowPinned: async (value) => {
    try {
      await setWindowAlwaysOnTop(value);
      set({ windowPinned: value });
    } catch (e) {
      get().toast(tr(get().settings.lang)("tAotFail", { e: String(e) }), "error");
    }
  },

  toast: (message, kind = "info") => {
    const id = toastSeq++;
    set((s) => ({ toasts: [...s.toasts, { id, message, kind }] }));
    setTimeout(() => get().removeToast(id), 2200);
  },

  removeToast: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));
