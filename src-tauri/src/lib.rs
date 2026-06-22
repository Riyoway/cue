// Cue — 次に投げたい Prompt を即保存 / 即引き出すランチャー
//
// このファイルはデスクトップ (Windows / macOS / Linux) 向けに書いています。
// global-shortcut / single-instance / autostart / tray はデスクトップ専用プラグインです。

use std::path::{Path, PathBuf};
use std::process::Command;
use std::str::FromStr;
use std::sync::Mutex;

use tauri::{AppHandle, Emitter, Manager, State};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};
use tauri_plugin_sql::{Migration, MigrationKind};
use tauri_plugin_window_state::StateFlags;

/// 現在登録中のグローバルショートカットを保持する。
#[derive(Default)]
struct Shortcuts {
    summon: Mutex<Option<Shortcut>>,
    quicksave: Mutex<Option<Shortcut>>,
}

const DEFAULT_SUMMON: &str = "CommandOrControl+Shift+Space";
const DEFAULT_QUICKSAVE: &str = "CommandOrControl+Shift+S";

// ---- ウィンドウ操作ヘルパ ----------------------------------------------------

fn show_window(app: &AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.show();
        let _ = w.unminimize();
        let _ = w.set_focus();
        let _ = app.emit("cue://focus-search", ());
    }
}

fn hide_window(app: &AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.hide();
    }
}

fn toggle_window(app: &AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        let visible = w.is_visible().unwrap_or(false);
        let focused = w.is_focused().unwrap_or(false);
        if visible && focused {
            let _ = w.hide();
        } else {
            show_window(app);
        }
    }
}

// ---- フロントから呼ぶコマンド ------------------------------------------------

#[tauri::command]
fn show_launcher(app: AppHandle) {
    show_window(&app);
}

#[tauri::command]
fn hide_launcher(app: AppHandle) {
    hide_window(&app);
}

#[tauri::command]
fn toggle_launcher(app: AppHandle) {
    toggle_window(&app);
}

#[tauri::command]
fn set_always_on_top(app: AppHandle, value: bool) {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.set_always_on_top(value);
    }
}

#[tauri::command]
fn quit_app(app: AppHandle) {
    app.exit(0);
}

/// 設定画面から呼ばれ、2つのグローバルショートカットを再登録する。
#[tauri::command]
fn apply_shortcuts(
    app: AppHandle,
    state: State<'_, Shortcuts>,
    summon: String,
    quicksave: String,
) -> Result<(), String> {
    let gs = app.global_shortcut();
    let new_summon = Shortcut::from_str(&summon).map_err(|e| format!("Invalid summon shortcut: {e}"))?;
    let new_quicksave =
        Shortcut::from_str(&quicksave).map_err(|e| format!("Invalid save shortcut: {e}"))?;

    // 既存を全解除してから登録し直す。
    let _ = gs.unregister_all();
    gs.register(new_summon.clone())
        .map_err(|e| format!("Could not register summon shortcut: {e}"))?;
    gs.register(new_quicksave.clone())
        .map_err(|e| format!("Could not register save shortcut: {e}"))?;

    *state.summon.lock().unwrap() = Some(new_summon);
    *state.quicksave.lock().unwrap() = Some(new_quicksave);
    Ok(())
}

// ---- エクスポート / インポート -----------------------------------------------

/// 選択されたパスへ JSON 文字列を書き出す。
#[tauri::command]
fn export_data(path: String, json: String) -> Result<(), String> {
    std::fs::write(&path, json).map_err(|e| format!("Write failed: {e}"))
}

/// 選択されたパスから JSON 文字列を読み込む。
#[tauri::command]
fn import_data(path: String) -> Result<String, String> {
    std::fs::read_to_string(&path).map_err(|e| format!("Read failed: {e}"))
}

// ---- Git 同期 ----------------------------------------------------------------

fn run_git(dir: &Path, args: &[&str]) -> Result<String, String> {
    let out = Command::new("git")
        .current_dir(dir)
        .args(args)
        .output()
        .map_err(|e| format!("Failed to run git (is git installed?): {e}"))?;
    if out.status.success() {
        Ok(String::from_utf8_lossy(&out.stdout).trim().to_string())
    } else {
        Err(String::from_utf8_lossy(&out.stderr).trim().to_string())
    }
}

fn sync_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("sync");
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

fn ensure_repo(dir: &Path, remote: &str, branch: &str) -> Result<(), String> {
    if !dir.join(".git").exists() {
        run_git(dir, &["init"])?;
        // 既定ブランチ名を branch に
        let _ = run_git(dir, &["checkout", "-b", branch]);
    }
    // commit にはユーザー設定が必要。未設定なら補う。
    if run_git(dir, &["config", "user.email"]).is_err() {
        let _ = run_git(dir, &["config", "user.email", "cue@localhost"]);
    }
    if run_git(dir, &["config", "user.name"]).is_err() {
        let _ = run_git(dir, &["config", "user.name", "Cue"]);
    }
    // リモート origin を設定（あれば URL 更新、なければ追加）
    if run_git(dir, &["remote", "get-url", "origin"]).is_ok() {
        run_git(dir, &["remote", "set-url", "origin", remote])?;
    } else {
        run_git(dir, &["remote", "add", "origin", remote])?;
    }
    Ok(())
}

/// git が利用可能か。
#[tauri::command]
fn git_available() -> bool {
    Command::new("git")
        .arg("--version")
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false)
}

/// 既定ブラウザで URL を開く（アップデートの手動ダウンロードへ誘導する）。
#[tauri::command]
fn open_url(url: String) -> Result<(), String> {
    // このコマンドはフロント全体から呼べるため、コマンドインジェクションを防ぐ。
    // https 限定かつ、空白・制御文字・シェル特殊文字を含む URL は拒否する。
    let allowed = url.starts_with("https://")
        && url.len() <= 2048
        && !url
            .chars()
            .any(|c| c.is_whitespace() || c.is_control() || "&|^<>\"'`$\\(){}[]".contains(c));
    if !allowed {
        return Err("invalid url".into());
    }
    // いずれもシェル(cmd.exe)を介さず、URL を引数として OS のハンドラに直接渡す。
    #[cfg(target_os = "windows")]
    let res = Command::new("rundll32")
        .arg("url.dll,FileProtocolHandler")
        .arg(&url)
        .spawn();
    #[cfg(target_os = "macos")]
    let res = Command::new("open").arg(&url).spawn();
    #[cfg(target_os = "linux")]
    let res = Command::new("xdg-open").arg(&url).spawn();
    res.map(|_| ()).map_err(|e| e.to_string())
}

/// リモートの最新 cue.json の中身を返す（なければ None）。
#[tauri::command]
fn git_remote_snapshot(
    app: AppHandle,
    remote: String,
    branch: String,
) -> Result<Option<String>, String> {
    let dir = sync_dir(&app)?;
    ensure_repo(&dir, &remote, &branch)?;
    // リモート取得（空リモート等のエラーは無視）
    let _ = run_git(&dir, &["fetch", "origin", &branch]);
    match run_git(&dir, &["show", &format!("origin/{branch}:cue.json")]) {
        Ok(content) => Ok(Some(content)),
        Err(_) => Ok(None),
    }
}

/// マージ済みのスナップショットを cue.json に書き出し、commit して push する。
#[tauri::command]
fn git_commit_snapshot(
    app: AppHandle,
    remote: String,
    branch: String,
    json: String,
    message: String,
) -> Result<String, String> {
    let dir = sync_dir(&app)?;
    ensure_repo(&dir, &remote, &branch)?;
    std::fs::write(dir.join("cue.json"), json).map_err(|e| format!("Write failed: {e}"))?;
    run_git(&dir, &["add", "-A"])?;
    // 変更が無い場合の commit 失敗は無視
    let _ = run_git(&dir, &["commit", "-m", &message]);
    // リモートが既にあるなら自分の変更を上に載せ替える（衝突は自分優先＝マージ済みのため）
    let _ = run_git(&dir, &["fetch", "origin", &branch]);
    if run_git(&dir, &["rev-parse", "--verify", &format!("origin/{branch}")]).is_ok() {
        let _ = run_git(&dir, &["rebase", "-X", "ours", &format!("origin/{branch}")]);
    }
    run_git(&dir, &["push", "-u", "origin", &branch])
        .map_err(|e| format!("Push failed (check auth / private repo settings): {e}"))?;
    Ok("ok".into())
}

// ---- セットアップ ------------------------------------------------------------

fn build_tray(app: &AppHandle) -> tauri::Result<()> {
    use tauri::menu::{Menu, MenuItem};
    use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};

    let show_i = MenuItem::with_id(app, "show", "Show Cue", true, None::<&str>)?;
    let quit_i = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&show_i, &quit_i])?;

    let mut builder = TrayIconBuilder::new()
        .menu(&menu)
        .tooltip("Cue")
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "show" => show_window(app),
            "quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                toggle_window(tray.app_handle());
            }
        });

    if let Some(icon) = app.default_window_icon() {
        builder = builder.icon(icon.clone());
    }

    builder.build(app)?;
    Ok(())
}

fn register_default_shortcuts(app: &AppHandle) {
    let gs = app.global_shortcut();
    let state = app.state::<Shortcuts>();

    if let Ok(summon) = Shortcut::from_str(DEFAULT_SUMMON) {
        if gs.register(summon.clone()).is_ok() {
            *state.summon.lock().unwrap() = Some(summon);
        }
    }
    if let Ok(quicksave) = Shortcut::from_str(DEFAULT_QUICKSAVE) {
        if gs.register(quicksave.clone()).is_ok() {
            *state.quicksave.lock().unwrap() = Some(quicksave);
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let migrations = vec![
        Migration {
            version: 1,
            description: "create_initial_tables",
            sql: "
                CREATE TABLE IF NOT EXISTS items (
                    id             INTEGER PRIMARY KEY AUTOINCREMENT,
                    title          TEXT    NOT NULL DEFAULT '',
                    body           TEXT    NOT NULL DEFAULT '',
                    pinned         INTEGER NOT NULL DEFAULT 0,
                    position       REAL    NOT NULL DEFAULT 0,
                    copy_count     INTEGER NOT NULL DEFAULT 0,
                    last_copied_at INTEGER,
                    created_at     INTEGER NOT NULL DEFAULT 0,
                    updated_at     INTEGER NOT NULL DEFAULT 0
                );
                CREATE TABLE IF NOT EXISTS settings (
                    key   TEXT PRIMARY KEY,
                    value TEXT NOT NULL
                );
            ",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "add_projects",
            sql: "
                CREATE TABLE IF NOT EXISTS projects (
                    id         INTEGER PRIMARY KEY AUTOINCREMENT,
                    name       TEXT    NOT NULL,
                    position   REAL    NOT NULL DEFAULT 0,
                    created_at INTEGER NOT NULL DEFAULT 0
                );
                ALTER TABLE items ADD COLUMN project_id INTEGER;
                INSERT INTO projects (name, position, created_at)
                    VALUES ('Inbox', 0, CAST(strftime('%s','now') AS INTEGER) * 1000);
                UPDATE items SET project_id = (SELECT id FROM projects ORDER BY id LIMIT 1)
                    WHERE project_id IS NULL;
            ",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 3,
            description: "add_uid_and_soft_delete",
            sql: "
                ALTER TABLE items ADD COLUMN uid TEXT;
                ALTER TABLE items ADD COLUMN deleted_at INTEGER;
                ALTER TABLE projects ADD COLUMN uid TEXT;
                ALTER TABLE projects ADD COLUMN deleted_at INTEGER;
                UPDATE items SET uid = lower(hex(randomblob(16))) WHERE uid IS NULL;
                UPDATE projects SET uid = lower(hex(randomblob(16))) WHERE uid IS NULL;
                CREATE UNIQUE INDEX IF NOT EXISTS idx_items_uid ON items(uid);
                CREATE UNIQUE INDEX IF NOT EXISTS idx_projects_uid ON projects(uid);
            ",
            kind: MigrationKind::Up,
        },
    ];

    tauri::Builder::default()
        // single-instance は最初に登録する必要がある。2 つ目の起動時は既存ウィンドウを前面に。
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            show_window(app);
        }))
        // ウィンドウのサイズ・位置を記憶（VISIBLE は除外：トレイ退避状態を復元しない）
        .plugin(
            tauri_plugin_window_state::Builder::default()
                .with_state_flags(StateFlags::SIZE | StateFlags::POSITION)
                .build(),
        )
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:cue.db", migrations)
                .build(),
        )
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec![]),
        ))
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, shortcut, event| {
                    if event.state() != ShortcutState::Pressed {
                        return;
                    }
                    let state = app.state::<Shortcuts>();
                    let is_summon = state
                        .summon
                        .lock()
                        .map(|g| g.as_ref() == Some(shortcut))
                        .unwrap_or(false);
                    let is_quicksave = state
                        .quicksave
                        .lock()
                        .map(|g| g.as_ref() == Some(shortcut))
                        .unwrap_or(false);

                    if is_summon {
                        toggle_window(app);
                    } else if is_quicksave {
                        show_window(app);
                        let _ = app.emit("cue://quick-save", ());
                    }
                })
                .build(),
        )
        .manage(Shortcuts::default())
        .setup(|app| {
            let handle = app.handle();
            build_tray(handle)?;
            register_default_shortcuts(handle);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            show_launcher,
            hide_launcher,
            toggle_launcher,
            set_always_on_top,
            quit_app,
            apply_shortcuts,
            export_data,
            import_data,
            git_available,
            git_remote_snapshot,
            git_commit_snapshot,
            open_url
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
