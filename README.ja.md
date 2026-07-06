<p align="center">
  <img src="docs/icon.png" width="120" height="120" alt="Cue" />
</p>

<h1 align="center">Cue</h1>

<p align="center">
  AIへのプロンプトを保存・検索・最適化。
</p>

<p align="center">
  <a href="./LICENSE">
    <img alt="License: MIT" src="https://img.shields.io/badge/License-MIT-blue.svg">
  </a>
  <img alt="Windows" src="https://img.shields.io/badge/Windows-Supported-0078D6?logo=windows&logoColor=white">
  <img alt="macOS" src="https://img.shields.io/badge/macOS-Supported-000000?logo=apple&logoColor=white">
  <img alt="Linux" src="https://img.shields.io/badge/Linux-Supported-FCC624?logo=linux&logoColor=black">
  <img alt="Built with Tauri v2" src="https://img.shields.io/badge/Tauri-v2-24C8DB?logo=tauri&logoColor=white">
  <img alt="React 19" src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white">
</p>

<p align="center">
  <a href="./README.md">English</a> · <b>日本語</b>
</p>

<p align="center">
  <img src="docs/screenshot.png" width="720" alt="Cue スクリーンショット" />
</p>

---

Cueは、Claude Code / Codex / ChatGPTなどのAIに投げるプロンプトを保存して使い回すためのデスクトップアプリです。ショートカットで保存し、あとから検索して、クリックでコピーします。

特徴は2つ。編集中のプロンプトを好きなAI（OpenAI / Claude / Gemini / Ollama / OpenRouter、またはローカルの Claude Code / Opencode / Antigravity CLI）で**最適化**できること、そして長いプロンプトを**画像としてコピー**して入力トークンを大きく節約できることです。

Windows / macOS / Linux に対応しています。

## 主な機能

- **ランチャー**：ショートカットで開き、検索して、クリックでコピーできます。
- **AI プロンプト最適化**：編集中のプロンプトを、選んだAI（OpenAI / Claude / Gemini / Ollama / OpenRouter、またはローカルの Claude Code / Opencode / Antigravity CLI）でワンクリックで書き直します。プロバイダとモデルは設定で選べます。
- **画像としてコピー**：長いプロンプトはテキストではなく高密度のPNGとしてコピーできます。画像のトークン量は文字数ではなくサイズで決まるため、マルチモーダルモデルに貼ると入力トークンを大きく減らせることがあります（いま広がりつつある手法です）。
- **プロジェクト**：プロンプトを分類できます。「すべて」でまとめて表示することもできます。
- **Markdown**：各プロンプトはMarkdown記法が使用でき、編集とプレビューを切り替えられます。
- **整理**：検索、ピン留め、ドラッグで並べ替え、コンテキストメニュー（名前変更・コピー・プレビュー・編集・ピン・削除）。
- **最前面に固定**：ウィンドウを他のアプリの上に表示できます。
- **バックアップと同期**：全データを1つのJSONで書き出し・読み込みできます。自分が持つプライベートGitリポジトリへ同期することもできます。
- **テーマと言語**：ライト／ダークのテーマ、アクセントカラー、文字サイズ、14言語に対応しています。
- **ローカル優先**：プロンプトはローカルのSQLiteに保存します。外部に送るのは、最適化で選んだプロバイダへプロンプトを送るときと、起動時のリリース確認（GitHub）だけです。

## ショートカット

| 操作                                   | 既定                        |
| -------------------------------------- | --------------------------- |
| 表示 / 非表示（グローバル）            | `Ctrl/⌘ + Shift + Space` |
| クリップボードを新規保存（グローバル） | `Ctrl/⌘ + Shift + S`     |
| 選択を移動                             | `↑` / `↓`             |
| 選択をコピー                           | `Enter`                   |
| 新規作成                               | `Ctrl/⌘ + N`             |
| 検索にフォーカス                       | `Ctrl/⌘ + F`             |
| 検索クリア                             | `Esc`                     |
| 保存（編集中）                         | `Ctrl/⌘ + Enter`         |

グローバルの 2 つは設定で変更できます。

## インストール

ビルド済みのインストーラは [Releases](../../releases) ページにあります。

## 開発

前提: [Node.js](https://nodejs.org) / [pnpm](https://pnpm.io) / [Rust](https://www.rust-lang.org) と各 OS の [Tauri 前提条件](https://v2.tauri.app/start/prerequisites/)。

```bash
pnpm install        # 依存インストール
pnpm tauri dev      # 開発起動
pnpm tauri build    # リリースビルド（インストーラ生成）
pnpm build          # フロントの型チェック + ビルドのみ
```

## 技術スタック

- **Tauri v2**（Rust バックエンド）
- **React 19 + Vite + TypeScript** / **Tailwind CSS v4** / **lucide-react** / **zustand**
- **SQLite**（`tauri-plugin-sql`）
- プラグイン: `global-shortcut` / `clipboard-manager` / `autostart` / `single-instance` / `dialog` / `window-state`

## ディレクトリ構成

```
src/                  フロントエンド (React)
  components/         Header, Sidebar, SearchBar, ItemList/ItemRow, Editor, Settings, ContextMenu, Dropdown, Toaster
  lib/                db.ts (SQLite), tauri.ts, i18n.ts, search.ts, markdown.ts, drag.ts, platform.ts
  store.ts            zustand ストア（状態とアクション）
  types.ts
src-tauri/
  src/lib.rs          トレイ / グローバルホットキー / ウィンドウ制御 / SQL マイグレーション / Git 同期
  tauri.conf.json     ウィンドウ（フレームレス）とプラグイン設定
  capabilities/       権限
```

## データとプライバシー

データはOSのアプリデータ領域（Windowsなら `%APPDATA%\com.cue.app`）のSQLite（`cue.db`）に保存されます。Cueが外部と通信するのは次の場合だけです。**AI最適化**で選んだプロバイダにプロンプトを送るとき、**起動時**の最新リリース確認（GitHub）、そして**Git同期**を有効にしたとき（あなたが指定したプライベートリポジトリへ、あなたのgit認証情報でpush）。

## コントリビュート

歓迎します。[CONTRIBUTING.md](./CONTRIBUTING.md) を参照してください。

## ライセンス

[MIT](./LICENSE)
