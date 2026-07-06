//! AI プロンプト最適化。8 プロバイダを 3 コマンド（モデル一覧 / 状態確認 / 最適化）に集約。
//! API プロバイダは HTTP（reqwest, CORS 無関係で全 OS 確実）、CLI プロバイダはヘッドレス spawn。
//! CLI へはプロンプトを **引数** で渡す（シェルを介さないので注入安全）。ログインだけ既定ターミナルを開く。

use std::ffi::{OsStr, OsString};
use std::path::PathBuf;
use std::process::{Command, Stdio};
use std::sync::OnceLock;

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiConfig {
    provider: String,
    #[serde(default)]
    api_key: String,
    #[serde(default)]
    model: String,
    #[serde(default)]
    host: String, // Ollama のホスト上書き
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AiStatus {
    /// CLI: バイナリを検出できたか。API: 常に true。
    installed: bool,
    /// 認証済みか。None = 安価に判定できない（例: macOS Keychain, agy のキーリング）。
    authed: Option<bool>,
    error: Option<String>,
}

const OPT_INSTRUCTION: &str = "Rewrite the following prompt to be clearer, more specific, and more effective for an AI assistant. Keep the original intent and the same language as the input. Output ONLY the improved prompt — no preamble, no explanation, no surrounding quotes.";

fn is_cli(provider: &str) -> bool {
    matches!(provider, "claude-code" | "opencode" | "antigravity")
}

fn cli_bin(provider: &str) -> &'static str {
    match provider {
        "claude-code" => "claude",
        "opencode" => "opencode",
        "antigravity" => "agy",
        _ => "",
    }
}

fn ollama_base(host: &str) -> String {
    let h = host.trim().trim_end_matches('/');
    if h.is_empty() {
        "http://localhost:11434".into()
    } else {
        h.to_string()
    }
}

// ---- HTTP ヘルパ -------------------------------------------------------------

async fn json_ok(resp: reqwest::Response) -> Result<Value, String> {
    let status = resp.status();
    let text = resp.text().await.map_err(|e| e.to_string())?;
    if !status.is_success() {
        return Err(friendly_http_error(status.as_u16(), &text));
    }
    serde_json::from_str(&text).map_err(|e| format!("Invalid response: {e}"))
}

/// プロバイダのエラー JSON から人間可読なメッセージだけ抜き出す（生 JSON を見せない）。
fn friendly_http_error(status: u16, body: &str) -> String {
    if let Ok(v) = serde_json::from_str::<Value>(body) {
        for candidate in [
            &v["error"]["message"],
            &v["error"],
            &v["message"],
            &v["detail"],
        ] {
            if let Some(s) = candidate.as_str() {
                if !s.trim().is_empty() {
                    return format!("HTTP {status}: {}", s.trim());
                }
            }
        }
    }
    let snippet: String = body.chars().take(200).collect();
    let snippet = snippet.trim();
    if snippet.is_empty() {
        format!("HTTP {status}")
    } else {
        format!("HTTP {status}: {snippet}")
    }
}

/// OpenAI 互換 `data[].id`（OpenAI / OpenRouter）。
async fn models_openai(url: &str, key: &str) -> Result<Vec<String>, String> {
    let client = reqwest::Client::new();
    let mut req = client.get(url);
    if !key.is_empty() {
        req = req.bearer_auth(key);
    }
    let v = json_ok(req.send().await.map_err(|e| e.to_string())?).await?;
    Ok(ids(&v["data"], "id"))
}

async fn models_anthropic(key: &str) -> Result<Vec<String>, String> {
    if key.is_empty() {
        return Err("API key required".into());
    }
    let client = reqwest::Client::new();
    let v = json_ok(
        client
            .get("https://api.anthropic.com/v1/models")
            .header("x-api-key", key)
            .header("anthropic-version", "2023-06-01")
            .send()
            .await
            .map_err(|e| e.to_string())?,
    )
    .await?;
    Ok(ids(&v["data"], "id"))
}

async fn models_gemini(key: &str) -> Result<Vec<String>, String> {
    if key.is_empty() {
        return Err("API key required".into());
    }
    let url =
        format!("https://generativelanguage.googleapis.com/v1beta/models?key={key}&pageSize=1000");
    let client = reqwest::Client::new();
    let v = json_ok(client.get(url).send().await.map_err(|e| e.to_string())?).await?;
    let out = v["models"]
        .as_array()
        .map(|a| {
            a.iter()
                .filter(|m| {
                    m["supportedGenerationMethods"]
                        .as_array()
                        .is_some_and(|g| g.iter().any(|x| x.as_str() == Some("generateContent")))
                })
                .filter_map(|m| m["name"].as_str())
                .map(|n| n.strip_prefix("models/").unwrap_or(n).to_string())
                .collect()
        })
        .unwrap_or_default();
    Ok(out)
}

async fn models_ollama(base: &str) -> Result<Vec<String>, String> {
    let client = reqwest::Client::new();
    let v = json_ok(
        client
            .get(format!("{base}/api/tags"))
            .send()
            .await
            .map_err(|e| e.to_string())?,
    )
    .await?;
    Ok(ids(&v["models"], "name"))
}

fn ids(arr: &Value, key: &str) -> Vec<String> {
    arr.as_array()
        .map(|a| {
            a.iter()
                .filter_map(|m| m[key].as_str().map(String::from))
                .collect()
        })
        .unwrap_or_default()
}

// ---- CLI ヘルパ --------------------------------------------------------------

/// GUI から起動したアプリは PATH が痩せがち（macOS launchd / Linux のデスクトップ起動は
/// Homebrew・npm/nvm・bun・~/.local/bin 等を含まない）。ログインシェルの実 PATH と代表的な
/// bin を足して補強する。1 回だけ計算してキャッシュ。全 CLI 実行でこれを使う。
fn augmented_path() -> &'static OsString {
    static CACHE: OnceLock<OsString> = OnceLock::new();
    CACHE.get_or_init(compute_path)
}

fn dedup_join(dirs: Vec<PathBuf>) -> OsString {
    std::env::join_paths(&dirs).unwrap_or_else(|_| std::env::var_os("PATH").unwrap_or_default())
}

#[cfg(not(target_os = "windows"))]
fn compute_path() -> OsString {
    let mut dirs: Vec<PathBuf> = Vec::new();
    let add = |d: PathBuf, dirs: &mut Vec<PathBuf>| {
        if !dirs.contains(&d) {
            dirs.push(d);
        }
    };
    if let Some(p) = std::env::var_os("PATH") {
        for d in std::env::split_paths(&p) {
            add(d, &mut dirs);
        }
    }
    // ログインシェルの PATH（nvm/asdf/volta/独自設定も拾える）。
    for d in login_shell_path() {
        add(d, &mut dirs);
    }
    if let Some(h) = home() {
        for sub in [".local/bin", ".cargo/bin", ".bun/bin", ".deno/bin", "go/bin", ".npm-global/bin"] {
            add(h.join(sub), &mut dirs);
        }
    }
    for d in [
        "/opt/homebrew/bin",
        "/opt/homebrew/sbin",
        "/usr/local/bin",
        "/home/linuxbrew/.linuxbrew/bin",
        "/usr/bin",
        "/bin",
    ] {
        add(PathBuf::from(d), &mut dirs);
    }
    dedup_join(dirs)
}

#[cfg(target_os = "windows")]
fn compute_path() -> OsString {
    let mut dirs: Vec<PathBuf> = Vec::new();
    let add = |d: PathBuf, dirs: &mut Vec<PathBuf>| {
        if !dirs.contains(&d) {
            dirs.push(d);
        }
    };
    if let Some(p) = std::env::var_os("PATH") {
        for d in std::env::split_paths(&p) {
            add(d, &mut dirs);
        }
    }
    // インストーラが PATH に足さない場合の保険（claude / bun / scoop / go / npm / agy）。
    if let Some(h) = home() {
        for sub in [".local\\bin", ".bun\\bin", "scoop\\shims", "go\\bin"] {
            add(h.join(sub), &mut dirs);
        }
    }
    if let Some(appdata) = std::env::var_os("APPDATA") {
        add(PathBuf::from(appdata).join("npm"), &mut dirs);
    }
    if let Some(local) = std::env::var_os("LOCALAPPDATA") {
        add(PathBuf::from(local).join("agy").join("bin"), &mut dirs);
    }
    dedup_join(dirs)
}

/// ログインシェルを 1 回起動して実 PATH を取り出す。rc の出力ノイズはマーカーで除去、
/// 変な rc で固まらないようタイムアウト付き。
#[cfg(not(target_os = "windows"))]
fn login_shell_path() -> Vec<PathBuf> {
    let shell = match std::env::var("SHELL") {
        Ok(s) if !s.is_empty() => s,
        _ => return Vec::new(),
    };
    // printenv は colon 区切りの実 PATH を出す（fish 等の配列表現差を回避）。
    let script = "printf '__CUE_PATH__'; printenv PATH; printf '__CUE_PATH__'";
    let child = Command::new(&shell)
        .args(["-i", "-l", "-c", script])
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .spawn();
    let mut child = match child {
        Ok(c) => c,
        Err(_) => return Vec::new(),
    };
    let start = std::time::Instant::now();
    let output = loop {
        match child.try_wait() {
            Ok(Some(_)) => break child.wait_with_output().ok(),
            Ok(None) => {
                if start.elapsed() > std::time::Duration::from_secs(3) {
                    let _ = child.kill();
                    break None;
                }
                std::thread::sleep(std::time::Duration::from_millis(30));
            }
            Err(_) => break None,
        }
    };
    let output = match output {
        Some(o) => o,
        None => return Vec::new(),
    };
    let stdout = String::from_utf8_lossy(&output.stdout);
    let inner = stdout.split("__CUE_PATH__").nth(1).unwrap_or("").trim();
    inner
        .split(':')
        .filter(|p| !p.is_empty())
        .map(PathBuf::from)
        .collect()
}

/// 実行プログラムを解決する。Windows は PATHEXT（.exe/.cmd/.bat）を補強 PATH 上で走査し
/// npm/bun/scoop 等のシムも見つける。unix は Command の PATH 探索に任せる（env で PATH を渡す）。
#[cfg(target_os = "windows")]
fn resolve_program(name: &str) -> OsString {
    if name.contains('\\') || name.contains('/') {
        return name.into();
    }
    for dir in std::env::split_paths(augmented_path()) {
        for ext in [".exe", ".com", ".cmd", ".bat"] {
            let cand = dir.join(format!("{name}{ext}"));
            if cand.is_file() {
                return cand.into_os_string();
            }
        }
        let bare = dir.join(name);
        if bare.is_file() {
            return bare.into_os_string();
        }
    }
    name.into()
}

#[cfg(not(target_os = "windows"))]
fn resolve_program(name: &str) -> OsString {
    name.into()
}

/// 解決先が Windows のバッチシム（.cmd/.bat）か。cmd.exe 経由になり改行入り引数が壊れる。
fn is_batch(p: &OsStr) -> bool {
    #[cfg(target_os = "windows")]
    {
        let s = p.to_string_lossy().to_ascii_lowercase();
        s.ends_with(".cmd") || s.ends_with(".bat")
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = p;
        false
    }
}

/// CLI 用 Command を作る。PATH を補強し、（Windows は）シムも解決。
/// 戻り値の bool はバッチシムか（プロンプトを stdin で渡すべきか）。
fn cli_command(name: &str) -> (Command, bool) {
    let prog = resolve_program(name);
    let batch = is_batch(&prog);
    let mut cmd = Command::new(&prog);
    cmd.env("PATH", augmented_path());
    (cmd, batch)
}

/// `<bin> <args...>` を実行して stdout の行を返す（`opencode models` / `agy models`）。
fn cli_models(bin: &str, args: &[&str]) -> Result<Vec<String>, String> {
    let (mut cmd, _) = cli_command(bin);
    let out = cmd
        .args(args)
        .output()
        .map_err(|e| format!("{bin} not found: {e}"))?;
    if !out.status.success() {
        return Err(String::from_utf8_lossy(&out.stderr).trim().to_string());
    }
    Ok(String::from_utf8_lossy(&out.stdout)
        .lines()
        .map(|l| l.trim().to_string())
        .filter(|l| !l.is_empty())
        .collect())
}

/// バイナリの有無（`<bin> --version` の成否）。シムも解決してから確認。
fn cli_installed(bin: &str) -> bool {
    let (mut cmd, _) = cli_command(bin);
    cmd.arg("--version")
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false)
}

/// ホームディレクトリ（依存追加を避けて env から）。
fn home() -> Option<std::path::PathBuf> {
    std::env::var_os("HOME")
        .or_else(|| std::env::var_os("USERPROFILE"))
        .map(Into::into)
}

fn claude_authed() -> Option<bool> {
    if std::env::var("ANTHROPIC_API_KEY").is_ok() || std::env::var("CLAUDE_CODE_OAUTH_TOKEN").is_ok()
    {
        return Some(true);
    }
    // macOS は Keychain 保管で安価に確認できない → None。
    #[cfg(target_os = "macos")]
    {
        None
    }
    #[cfg(not(target_os = "macos"))]
    {
        home().map(|h| h.join(".claude").join(".credentials.json").exists())
    }
}

fn opencode_authed() -> Option<bool> {
    // 非対話。設定済みプロバイダがあれば認証済みとみなす。
    let (mut cmd, _) = cli_command("opencode");
    match cmd.args(["auth", "list"]).output() {
        Ok(o) if o.status.success() => Some(!String::from_utf8_lossy(&o.stdout).trim().is_empty()),
        _ => None,
    }
}

/// 指示＋プロンプトを CLI に渡してヘッドレス実行。stdout を返す。
/// ネイティブ exe は引数で（シェル非経由・注入安全）、Windows の .cmd/.bat シムは
/// cmd.exe 経由になり改行入り引数が壊れるため **stdin** で渡す。
fn cli_optimize(
    name: &str,
    lead: &[String],
    model_flag: Option<(&str, &str)>,
    prompt: &str,
) -> Result<String, String> {
    let text = format!("{OPT_INSTRUCTION}\n\n---\n{prompt}");
    let (mut cmd, batch) = cli_command(name);
    cmd.args(lead);
    if let Some((flag, model)) = model_flag {
        if !model.is_empty() {
            cmd.arg(flag).arg(model);
        }
    }

    let out = if batch {
        // プロンプトは stdin へ（CLI は非 TTY の stdin を入力として読む）。
        cmd.stdin(Stdio::piped()).stdout(Stdio::piped()).stderr(Stdio::piped());
        let mut child = cmd
            .spawn()
            .map_err(|e| format!("{name} not found or failed: {e}"))?;
        if let Some(mut si) = child.stdin.take() {
            use std::io::Write;
            si.write_all(text.as_bytes()).map_err(|e| e.to_string())?;
        }
        child.wait_with_output().map_err(|e| e.to_string())?
    } else {
        cmd.arg(&text);
        cmd.output()
            .map_err(|e| format!("{name} not found or failed: {e}"))?
    };

    if !out.status.success() {
        let err = String::from_utf8_lossy(&out.stderr);
        return Err(if err.trim().is_empty() {
            format!("{name} exited with an error")
        } else {
            err.trim().to_string()
        });
    }
    let result = String::from_utf8_lossy(&out.stdout).trim().to_string();
    if result.is_empty() {
        return Err(format!("{name} returned nothing"));
    }
    Ok(result)
}

// ---- コマンド ---------------------------------------------------------------

/// モデル一覧。API はキーで取得、CLI は既知/一覧コマンドから。
#[tauri::command]
pub async fn ai_list_models(config: AiConfig) -> Result<Vec<String>, String> {
    match config.provider.as_str() {
        "openai" => models_openai("https://api.openai.com/v1/models", &config.api_key).await,
        "openrouter" => {
            models_openai("https://openrouter.ai/api/v1/models", &config.api_key).await
        }
        "anthropic" => models_anthropic(&config.api_key).await,
        "gemini" => models_gemini(&config.api_key).await,
        "ollama" => models_ollama(&ollama_base(&config.host)).await,
        // Claude Code はモデル一覧コマンドが無いのでエイリアス既定値。
        "claude-code" => Ok(["sonnet", "opus", "haiku", "fable"]
            .iter()
            .map(|s| s.to_string())
            .collect()),
        "opencode" => cli_models("opencode", &["models"]),
        "antigravity" => cli_models("agy", &["models"]),
        p => Err(format!("unknown provider: {p}")),
    }
}

/// 利用可否の確認。CLI はバイナリ＋認証、API はモデル取得の成否。
#[tauri::command]
pub async fn ai_check(config: AiConfig) -> Result<AiStatus, String> {
    if is_cli(&config.provider) {
        let bin = cli_bin(&config.provider);
        let installed = cli_installed(bin);
        let authed = if !installed {
            None
        } else {
            match config.provider.as_str() {
                "claude-code" => claude_authed(),
                "opencode" => opencode_authed(),
                "antigravity" => None, // キーリング保管、安価に確認不可
                _ => None,
            }
        };
        return Ok(AiStatus {
            installed,
            authed,
            error: None,
        });
    }
    // API: モデル取得できれば到達＆認証 OK。
    match ai_list_models(config).await {
        Ok(_) => Ok(AiStatus {
            installed: true,
            authed: Some(true),
            error: None,
        }),
        Err(e) => Ok(AiStatus {
            installed: true,
            authed: Some(false),
            error: Some(e),
        }),
    }
}

/// プロンプトを最適化して返す。
#[tauri::command]
pub async fn ai_optimize(config: AiConfig, prompt: String) -> Result<String, String> {
    if prompt.trim().is_empty() {
        return Err("empty prompt".into());
    }
    match config.provider.as_str() {
        "openai" => {
            chat_openai(
                "https://api.openai.com/v1/chat/completions",
                &config.api_key,
                &config.model,
                &prompt,
            )
            .await
        }
        "openrouter" => {
            chat_openai(
                "https://openrouter.ai/api/v1/chat/completions",
                &config.api_key,
                &config.model,
                &prompt,
            )
            .await
        }
        "anthropic" => chat_anthropic(&config.api_key, &config.model, &prompt).await,
        "gemini" => chat_gemini(&config.api_key, &config.model, &prompt).await,
        "ollama" => chat_ollama(&ollama_base(&config.host), &config.model, &prompt).await,
        "claude-code" => cli_optimize(
            "claude",
            &["-p".to_string()],
            Some(("--model", &config.model)),
            &prompt,
        ),
        "opencode" => cli_optimize(
            "opencode",
            &["run".to_string()],
            Some(("-m", &config.model)),
            &prompt,
        ),
        "antigravity" => cli_optimize(
            "agy",
            &["-p".to_string()],
            Some(("--model", &config.model)),
            &prompt,
        ),
        p => Err(format!("unknown provider: {p}")),
    }
}

async fn chat_openai(url: &str, key: &str, model: &str, prompt: &str) -> Result<String, String> {
    if key.is_empty() {
        return Err("API key required".into());
    }
    if model.is_empty() {
        return Err("model required".into());
    }
    let body = json!({
        "model": model,
        "messages": [
            {"role": "system", "content": OPT_INSTRUCTION},
            {"role": "user", "content": prompt},
        ],
    });
    let client = reqwest::Client::new();
    let v = json_ok(
        client
            .post(url)
            .bearer_auth(key)
            .json(&body)
            .send()
            .await
            .map_err(|e| e.to_string())?,
    )
    .await?;
    v["choices"][0]["message"]["content"]
        .as_str()
        .map(str::to_string)
        .ok_or_else(|| "no content in response".into())
}

async fn chat_anthropic(key: &str, model: &str, prompt: &str) -> Result<String, String> {
    if key.is_empty() {
        return Err("API key required".into());
    }
    if model.is_empty() {
        return Err("model required".into());
    }
    let body = json!({
        "model": model,
        "max_tokens": 2048,
        "system": OPT_INSTRUCTION,
        "messages": [{"role": "user", "content": prompt}],
    });
    let client = reqwest::Client::new();
    let v = json_ok(
        client
            .post("https://api.anthropic.com/v1/messages")
            .header("x-api-key", key)
            .header("anthropic-version", "2023-06-01")
            .json(&body)
            .send()
            .await
            .map_err(|e| e.to_string())?,
    )
    .await?;
    v["content"][0]["text"]
        .as_str()
        .map(str::to_string)
        .ok_or_else(|| "no content in response".into())
}

async fn chat_gemini(key: &str, model: &str, prompt: &str) -> Result<String, String> {
    if key.is_empty() {
        return Err("API key required".into());
    }
    if model.is_empty() {
        return Err("model required".into());
    }
    let url = format!(
        "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={key}"
    );
    let body = json!({
        "systemInstruction": {"parts": [{"text": OPT_INSTRUCTION}]},
        "contents": [{"parts": [{"text": prompt}]}],
    });
    let client = reqwest::Client::new();
    let v = json_ok(
        client
            .post(url)
            .json(&body)
            .send()
            .await
            .map_err(|e| e.to_string())?,
    )
    .await?;
    v["candidates"][0]["content"]["parts"][0]["text"]
        .as_str()
        .map(str::to_string)
        .ok_or_else(|| "no content in response".into())
}

async fn chat_ollama(base: &str, model: &str, prompt: &str) -> Result<String, String> {
    if model.is_empty() {
        return Err("model required".into());
    }
    let body = json!({
        "model": model,
        "stream": false,
        "messages": [
            {"role": "system", "content": OPT_INSTRUCTION},
            {"role": "user", "content": prompt},
        ],
    });
    let client = reqwest::Client::new();
    let v = json_ok(
        client
            .post(format!("{base}/api/chat"))
            .json(&body)
            .send()
            .await
            .map_err(|e| e.to_string())?,
    )
    .await?;
    v["message"]["content"]
        .as_str()
        .map(str::to_string)
        .ok_or_else(|| "no content in response".into())
}

/// 未認証 CLI のログインを既定ターミナルで開く（対話ログイン用）。
#[tauri::command]
pub fn ai_open_login_terminal(provider: String) -> Result<(), String> {
    let login = match provider.as_str() {
        "claude-code" => "claude",
        "opencode" => "opencode auth login",
        "antigravity" => "agy",
        _ => return Err("no login for this provider".into()),
    };
    open_terminal(login)
}

#[cfg(target_os = "macos")]
fn open_terminal(cmd: &str) -> Result<(), String> {
    Command::new("osascript")
        .arg("-e")
        .arg(format!("tell application \"Terminal\" to do script \"{cmd}\""))
        .spawn()
        .map(|_| ())
        .map_err(|e| e.to_string())
}

#[cfg(target_os = "windows")]
fn open_terminal(cmd: &str) -> Result<(), String> {
    // 既定端末は多くが PowerShell。Windows Terminal があればそれで、無ければ PowerShell 窓を開く。
    if Command::new("wt")
        .args(["new-tab", "powershell", "-NoExit", "-Command", cmd])
        .spawn()
        .is_ok()
    {
        return Ok(());
    }
    // start は新規ウィンドウを出すためだけの起動役で、見える shell は PowerShell。
    Command::new("cmd")
        .args(["/c", "start", "", "powershell", "-NoExit", "-Command", cmd])
        .spawn()
        .map(|_| ())
        .map_err(|e| e.to_string())
}

#[cfg(target_os = "linux")]
fn open_terminal(cmd: &str) -> Result<(), String> {
    // 標準は無い。$TERMINAL → x-terminal-emulator → 既知の候補 → xterm。
    // ponytail: 主要エミュレータのみ対応。エキゾチックな端末は取りこぼす（xterm フォールバックあり）。
    let sh = format!("{cmd}; exec ${{SHELL:-sh}}"); // ログイン後に開いたまま
    let mut order: Vec<String> = Vec::new();
    if let Ok(t) = std::env::var("TERMINAL") {
        if !t.trim().is_empty() {
            order.push(t);
        }
    }
    for t in [
        "x-terminal-emulator",
        "gnome-terminal",
        "konsole",
        "xfce4-terminal",
        "xterm",
    ] {
        order.push(t.to_string());
    }
    for term in order {
        let mut c = Command::new(&term);
        if term.contains("gnome-terminal") {
            c.arg("--").arg("sh").arg("-c").arg(&sh);
        } else {
            c.arg("-e").arg("sh").arg("-c").arg(&sh);
        }
        if c.spawn().is_ok() {
            return Ok(());
        }
    }
    Err("no terminal emulator found".into())
}
