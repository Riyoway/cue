export interface Project {
  id: number;
  uid: string;
  name: string;
  position: number;
  created_at: number;
  deleted_at: number | null;
}

export interface Item {
  id: number;
  uid: string;
  title: string;
  body: string;
  pinned: boolean;
  position: number;
  copy_count: number;
  last_copied_at: number | null;
  created_at: number;
  updated_at: number;
  project_id: number | null;
  deleted_at: number | null;
}

/** DB から返ってくる生の行 (boolean は 0/1) */
export interface ItemRow {
  id: number;
  uid: string;
  title: string;
  body: string;
  pinned: number;
  position: number;
  copy_count: number;
  last_copied_at: number | null;
  created_at: number;
  updated_at: number;
  project_id: number | null;
  deleted_at: number | null;
}

export type ThemeMode = "system" | "light" | "dark";

export interface Settings {
  theme: ThemeMode;
  summon_shortcut: string;
  quicksave_shortcut: string;
  autostart: boolean;
  always_on_top_default: boolean;
  git_enabled: boolean;
  git_remote: string;
  git_branch: string;
  accent: string;
  lang: string;
  sidebar_collapsed: boolean;
  text_scale: number;
  /** 短いプロンプトでも「画像としてコピー」を表示（機能アピール用）。 */
  promote_image_copy: boolean;
  /** 推奨外（短い）プロンプトの画像コピー警告を「次回から表示しない」で無効化したか。 */
  image_copy_warn_dismissed: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  theme: "system",
  summon_shortcut: "CommandOrControl+Shift+Space",
  quicksave_shortcut: "CommandOrControl+Shift+S",
  autostart: false,
  always_on_top_default: false,
  git_enabled: false,
  git_remote: "",
  git_branch: "main",
  accent: "blue",
  lang: "en",
  sidebar_collapsed: false,
  text_scale: 1,
  promote_image_copy: true,
  image_copy_warn_dismissed: false,
};

/** テキストサイズの選択肢（WebView ズーム倍率＋i18nキー） */
export const TEXT_SCALES: { value: number; key: string }[] = [
  { value: 0.9, key: "sizeS" },
  { value: 1, key: "sizeM" },
  { value: 1.15, key: "sizeL" },
  { value: 1.35, key: "sizeXL" },
];

/** アクセントカラーの選択肢（id は styles.css の data-accent と対応） */
export const ACCENTS: { id: string; color: string }[] = [
  { id: "blue", color: "#3b82f6" },
  { id: "indigo", color: "#6366f1" },
  { id: "violet", color: "#8b5cf6" },
  { id: "emerald", color: "#10b981" },
  { id: "rose", color: "#f43f5e" },
  { id: "amber", color: "#f59e0b" },
];

export interface SnapshotProject {
  uid: string;
  name: string;
  position: number;
  created_at: number;
  deleted_at: number | null;
}

export interface SnapshotItem {
  uid: string;
  project_uid: string | null;
  title: string;
  body: string;
  pinned: boolean;
  position: number;
  copy_count: number;
  last_copied_at: number | null;
  created_at: number;
  updated_at: number;
  deleted_at: number | null;
}

export interface Snapshot {
  app: "cue";
  schema: 3;
  exported_at: number;
  projects: SnapshotProject[];
  items: SnapshotItem[];
}
