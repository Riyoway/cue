<p align="center">
  <img src="docs/icon.png" width="120" height="120" alt="Cue" />
</p>

<h1 align="center">Cue</h1>

<p align="center">
  AIへの指示を保存し、検索してすぐ再利用できる。
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

Windows / macOS / Linux に対応しています。

## 主な機能

- **ランチャー**：ショートカットで開き、検索して、クリックでコピーできます。
- **プロジェクト**：プロンプトを分類できます。「すべて」でまとめて表示することもできます。
- **Markdown**：各プロンプトはMarkdown記法が使用でき、編集とプレビューを切り替えられます。
- **整理**：検索、ピン留め、ドラッグで並べ替え、コンテキストメニュー（名前変更・コピー・プレビュー・編集・ピン・削除）。
- **最前面に固定**：ウィンドウを他のアプリの上に表示できます。
- **バックアップと同期**：全データを1つのJSONで書き出し・読み込みできます。自分が持つプライベートGitリポジトリへ同期することもできます。
- **テーマと言語**：ライト／ダークのテーマ、アクセントカラー、文字サイズ、14言語に対応しています。
- **ローカル保存**：データはローカルのSQLiteに保存します。Git同期を設定しない限り、外部には送信されません。

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

データはOSのアプリデータ領域（Windowsなら `%APPDATA%\com.cue.app`）のSQLite（`cue.db`）に保存されます。Cue自体はネットワーク通信を行いません。Git 同期を有効にした場合のみ、**あなたが指定したプライベートリポジトリ**へ、**あなたのgit認証情報**でpushします。

## コントリビュート

歓迎します。[CONTRIBUTING.md](./CONTRIBUTING.md) を参照してください。

## ライセンス

[MIT](./LICENSE)
