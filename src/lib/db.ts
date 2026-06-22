import Database from "@tauri-apps/plugin-sql";
import {
  DEFAULT_SETTINGS,
  type Item,
  type ItemRow,
  type Project,
  type Settings,
  type Snapshot,
  type ThemeMode,
} from "../types";

let dbPromise: Promise<Database> | null = null;

function db(): Promise<Database> {
  if (!dbPromise) {
    dbPromise = Database.load("sqlite:cue.db");
  }
  return dbPromise;
}

function rowToItem(r: ItemRow): Item {
  return { ...r, pinned: r.pinned !== 0 };
}

const uuid = () => crypto.randomUUID();

// ---- アイテム ---------------------------------------------------------------

export async function listItems(): Promise<Item[]> {
  const d = await db();
  const rows = await d.select<ItemRow[]>(
    "SELECT * FROM items WHERE deleted_at IS NULL ORDER BY pinned DESC, position ASC, id DESC",
  );
  return rows.map(rowToItem);
}

export async function createItem(
  projectId: number | null,
  title: string,
  body: string,
): Promise<Item> {
  const d = await db();
  const now = Date.now();
  const uid = uuid();
  const [{ min }] = await d.select<{ min: number | null }[]>(
    "SELECT MIN(position) as min FROM items",
  );
  const position = (min ?? 0) - 1;
  const res = await d.execute(
    `INSERT INTO items (uid, title, body, pinned, position, copy_count, last_copied_at, created_at, updated_at, project_id, deleted_at)
     VALUES ($1, $2, $3, 0, $4, 0, NULL, $5, $5, $6, NULL)`,
    [uid, title, body, position, now, projectId],
  );
  return {
    id: res.lastInsertId as number,
    uid,
    title,
    body,
    pinned: false,
    position,
    copy_count: 0,
    last_copied_at: null,
    created_at: now,
    updated_at: now,
    project_id: projectId,
    deleted_at: null,
  };
}

export async function setItemProject(
  id: number,
  projectId: number | null,
): Promise<void> {
  const d = await db();
  await d.execute(
    "UPDATE items SET project_id = $1, updated_at = $2 WHERE id = $3",
    [projectId, Date.now(), id],
  );
}

export async function updateItem(
  id: number,
  title: string,
  body: string,
): Promise<void> {
  const d = await db();
  await d.execute(
    "UPDATE items SET title = $1, body = $2, updated_at = $3 WHERE id = $4",
    [title, body, Date.now(), id],
  );
}

export async function setItemTitle(id: number, title: string): Promise<void> {
  const d = await db();
  await d.execute(
    "UPDATE items SET title = $1, updated_at = $2 WHERE id = $3",
    [title, Date.now(), id],
  );
}

/** 論理削除（同期で削除を伝播させるため tombstone を残す）。 */
export async function deleteItem(id: number): Promise<void> {
  const d = await db();
  const now = Date.now();
  await d.execute(
    "UPDATE items SET deleted_at = $1, updated_at = $1 WHERE id = $2",
    [now, id],
  );
}

export async function setPinned(id: number, pinned: boolean): Promise<void> {
  const d = await db();
  await d.execute("UPDATE items SET pinned = $1, updated_at = $2 WHERE id = $3", [
    pinned ? 1 : 0,
    Date.now(),
    id,
  ]);
}

export async function setPosition(id: number, position: number): Promise<void> {
  const d = await db();
  await d.execute(
    "UPDATE items SET position = $1, updated_at = $2 WHERE id = $3",
    [position, Date.now(), id],
  );
}

export async function touchCopy(id: number): Promise<void> {
  const d = await db();
  await d.execute(
    "UPDATE items SET copy_count = copy_count + 1, last_copied_at = $1 WHERE id = $2",
    [Date.now(), id],
  );
}

// ---- プロジェクト -----------------------------------------------------------

export async function listProjects(): Promise<Project[]> {
  const d = await db();
  return d.select<Project[]>(
    "SELECT * FROM projects WHERE deleted_at IS NULL ORDER BY position ASC, id ASC",
  );
}

export async function createProject(name: string): Promise<Project> {
  const d = await db();
  const now = Date.now();
  const uid = uuid();
  const [{ max }] = await d.select<{ max: number | null }[]>(
    "SELECT MAX(position) as max FROM projects",
  );
  const position = (max ?? 0) + 1;
  const res = await d.execute(
    "INSERT INTO projects (uid, name, position, created_at, deleted_at) VALUES ($1, $2, $3, $4, NULL)",
    [uid, name, position, now],
  );
  return {
    id: res.lastInsertId as number,
    uid,
    name,
    position,
    created_at: now,
    deleted_at: null,
  };
}

export async function renameProject(id: number, name: string): Promise<void> {
  const d = await db();
  await d.execute("UPDATE projects SET name = $1 WHERE id = $2", [name, id]);
}

export async function setProjectPosition(
  id: number,
  position: number,
): Promise<void> {
  const d = await db();
  await d.execute("UPDATE projects SET position = $1 WHERE id = $2", [
    position,
    id,
  ]);
}

/** プロジェクトを論理削除。中のプロンプトも一緒に論理削除する（同期用に tombstone を残す）。 */
export async function deleteProject(id: number): Promise<void> {
  const d = await db();
  const now = Date.now();
  await d.execute(
    "UPDATE items SET deleted_at = $1, updated_at = $1 WHERE project_id = $2 AND deleted_at IS NULL",
    [now, id],
  );
  await d.execute("UPDATE projects SET deleted_at = $1 WHERE id = $2", [now, id]);
}

// ---- スナップショット（エクスポート / 同期） --------------------------------

interface ProjectFullRow {
  id: number;
  uid: string;
  name: string;
  position: number;
  created_at: number;
  deleted_at: number | null;
}

export async function buildSnapshot(): Promise<Snapshot> {
  const d = await db();
  const projects = await d.select<ProjectFullRow[]>("SELECT * FROM projects");
  const items = await d.select<ItemRow[]>("SELECT * FROM items");
  const uidById = new Map(projects.map((p) => [p.id, p.uid]));
  return {
    app: "cue",
    schema: 3,
    exported_at: Date.now(),
    projects: projects.map((p) => ({
      uid: p.uid,
      name: p.name,
      position: p.position,
      created_at: p.created_at,
      deleted_at: p.deleted_at,
    })),
    items: items.map((i) => ({
      uid: i.uid,
      project_uid: i.project_id != null ? (uidById.get(i.project_id) ?? null) : null,
      title: i.title,
      body: i.body,
      pinned: i.pinned !== 0,
      position: i.position,
      copy_count: i.copy_count,
      last_copied_at: i.last_copied_at,
      created_at: i.created_at,
      updated_at: i.updated_at,
      deleted_at: i.deleted_at,
    })),
  };
}

/** スナップショットを uid で upsert（アイテムは updated_at が新しい方を採用）。 */
export async function mergeSnapshot(snap: Snapshot): Promise<void> {
  if (!snap || snap.app !== "cue" || !Array.isArray(snap.items)) {
    throw new Error("Cue のバックアップ形式ではありません");
  }
  const d = await db();

  const existingProjects = await d.select<{ id: number; uid: string }[]>(
    "SELECT id, uid FROM projects",
  );
  const projIdByUid = new Map(existingProjects.map((p) => [p.uid, p.id]));
  for (const p of snap.projects ?? []) {
    if (projIdByUid.has(p.uid)) {
      await d.execute(
        "UPDATE projects SET name = $1, position = $2, deleted_at = $3 WHERE uid = $4",
        [p.name, p.position, p.deleted_at, p.uid],
      );
    } else {
      await d.execute(
        "INSERT INTO projects (uid, name, position, created_at, deleted_at) VALUES ($1, $2, $3, $4, $5)",
        [p.uid, p.name, p.position, p.created_at, p.deleted_at],
      );
    }
  }

  const allProjects = await d.select<{ id: number; uid: string }[]>(
    "SELECT id, uid FROM projects",
  );
  const idByUid = new Map(allProjects.map((p) => [p.uid, p.id]));

  const existingItems = await d.select<{ uid: string; updated_at: number }[]>(
    "SELECT uid, updated_at FROM items",
  );
  const updByUid = new Map(existingItems.map((i) => [i.uid, i.updated_at]));

  for (const it of snap.items) {
    const pid = it.project_uid ? (idByUid.get(it.project_uid) ?? null) : null;
    if (updByUid.has(it.uid)) {
      if (it.updated_at >= (updByUid.get(it.uid) ?? 0)) {
        await d.execute(
          `UPDATE items SET title=$1, body=$2, pinned=$3, position=$4, copy_count=$5,
             last_copied_at=$6, updated_at=$7, deleted_at=$8, project_id=$9 WHERE uid=$10`,
          [
            it.title,
            it.body,
            it.pinned ? 1 : 0,
            it.position,
            it.copy_count,
            it.last_copied_at,
            it.updated_at,
            it.deleted_at,
            pid,
            it.uid,
          ],
        );
      }
    } else {
      await d.execute(
        `INSERT INTO items (uid, title, body, pinned, position, copy_count, last_copied_at, created_at, updated_at, deleted_at, project_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [
          it.uid,
          it.title,
          it.body,
          it.pinned ? 1 : 0,
          it.position,
          it.copy_count,
          it.last_copied_at,
          it.created_at,
          it.updated_at,
          it.deleted_at,
          pid,
        ],
      );
    }
  }
}

// ---- 設定 -------------------------------------------------------------------

export async function getSettings(): Promise<Settings> {
  const d = await db();
  const rows = await d.select<{ key: string; value: string }[]>(
    "SELECT key, value FROM settings",
  );
  const map = new Map(rows.map((r) => [r.key, r.value]));
  return {
    theme: (map.get("theme") as ThemeMode) ?? DEFAULT_SETTINGS.theme,
    summon_shortcut: map.get("summon_shortcut") ?? DEFAULT_SETTINGS.summon_shortcut,
    quicksave_shortcut:
      map.get("quicksave_shortcut") ?? DEFAULT_SETTINGS.quicksave_shortcut,
    autostart: map.get("autostart") === "1" ? true : DEFAULT_SETTINGS.autostart,
    always_on_top_default:
      map.get("always_on_top_default") === "1"
        ? true
        : DEFAULT_SETTINGS.always_on_top_default,
    git_enabled: map.get("git_enabled") === "1",
    git_remote: map.get("git_remote") ?? DEFAULT_SETTINGS.git_remote,
    git_branch: map.get("git_branch") ?? DEFAULT_SETTINGS.git_branch,
    accent: map.get("accent") ?? DEFAULT_SETTINGS.accent,
    lang: map.get("lang") ?? "",
    sidebar_collapsed: map.get("sidebar_collapsed") === "1",
    text_scale: Number(map.get("text_scale")) || DEFAULT_SETTINGS.text_scale,
  };
}

export async function setSetting(key: string, value: string): Promise<void> {
  const d = await db();
  await d.execute(
    `INSERT INTO settings (key, value) VALUES ($1, $2)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [key, value],
  );
}

// ---- 完全リセット -----------------------------------------------------------

/**
 * 全データ（プロンプト・プロジェクト・設定）を物理削除し、初回起動と同じ
 * 既定 Inbox を作り直す。完全リセット用。論理削除ではないので tombstone は残らない
 * （設定も消えるため git 同期も無効化され、データが復活することはない）。
 */
export async function eraseAllData(): Promise<void> {
  const d = await db();
  await d.execute("DELETE FROM items");
  await d.execute("DELETE FROM projects");
  await d.execute("DELETE FROM settings");
  await d.execute(
    "INSERT INTO projects (uid, name, position, created_at, deleted_at) VALUES ($1, 'Inbox', 0, $2, NULL)",
    [uuid(), Date.now()],
  );
}
