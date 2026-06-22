# Contributing to Cue

Thanks for your interest in contributing! 🎉

## Getting started

1. Install prerequisites: [Node.js](https://nodejs.org), [pnpm](https://pnpm.io), [Rust](https://www.rust-lang.org), and your platform's [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/).
2. Fork & clone the repo.
3. Install dependencies and run the app:

   ```bash
   pnpm install
   pnpm tauri dev
   ```

## Before opening a PR

- Keep the diff focused and small.
- Type-check & build the frontend:

  ```bash
  pnpm build
  ```

- Check the Rust side compiles:

  ```bash
  cargo build --manifest-path src-tauri/Cargo.toml
  ```

- Match the existing code style (TypeScript strict, Tailwind utility classes, lucide-react icons, the shared `IconButton`/`Dropdown` components, and the `useT()` i18n helper for user-facing strings).
- For any new user-facing text, add a key to `src/lib/i18n.ts` (at minimum `en` and `ja`; other languages fall back to English).

## Adding a language

Add a dictionary in `src/lib/i18n.ts`, register it in `DICTS`, add it to `LANGUAGES`, and map it in `detectLang`.

## Reporting bugs / requesting features

Open an issue with clear steps to reproduce (for bugs) or a concrete use case (for features). Mention your OS and app version.

## Code of conduct

Be respectful and constructive. Assume good intent.
