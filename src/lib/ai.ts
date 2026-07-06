import { invoke } from "@tauri-apps/api/core";
import type { AiProviderConfig, AiState } from "../types";

/** 対応プロバイダ。label はブランド名なので翻訳しない。 */
export interface AiProviderMeta {
  id: string;
  label: string;
  kind: "api" | "cli";
  needsKey: boolean; // API キー入力を出すか
  needsHost: boolean; // Ollama のホスト入力を出すか
}

export const AI_PROVIDERS: AiProviderMeta[] = [
  { id: "openai", label: "OpenAI", kind: "api", needsKey: true, needsHost: false },
  { id: "anthropic", label: "Claude (API)", kind: "api", needsKey: true, needsHost: false },
  { id: "gemini", label: "Gemini", kind: "api", needsKey: true, needsHost: false },
  { id: "openrouter", label: "OpenRouter", kind: "api", needsKey: true, needsHost: false },
  { id: "ollama", label: "Ollama", kind: "api", needsKey: false, needsHost: true },
  { id: "claude-code", label: "Claude Code (CLI)", kind: "cli", needsKey: false, needsHost: false },
  { id: "opencode", label: "Opencode (CLI)", kind: "cli", needsKey: false, needsHost: false },
  { id: "antigravity", label: "Antigravity (CLI)", kind: "cli", needsKey: false, needsHost: false },
];

export function providerMeta(id: string): AiProviderMeta | undefined {
  return AI_PROVIDERS.find((p) => p.id === id);
}

export interface AiStatus {
  installed: boolean;
  authed: boolean | null;
  error: string | null;
}

/** Rust の AiConfig（camelCase）へ平坦化。 */
function flat(provider: string, c: AiProviderConfig) {
  return { provider, apiKey: c.apiKey, model: c.model, host: c.host };
}

export const aiListModels = (provider: string, c: AiProviderConfig) =>
  invoke<string[]>("ai_list_models", { config: flat(provider, c) });

export const aiCheck = (provider: string, c: AiProviderConfig) =>
  invoke<AiStatus>("ai_check", { config: flat(provider, c) });

export const aiOptimize = (provider: string, c: AiProviderConfig, prompt: string) =>
  invoke<string>("ai_optimize", { config: flat(provider, c), prompt });

export const aiOpenLoginTerminal = (provider: string) =>
  invoke<void>("ai_open_login_terminal", { provider });

/** アクティブプロバイダの設定（無ければ空）。 */
export function activeConfig(ai: AiState): AiProviderConfig {
  return ai.byProvider[ai.provider] ?? { apiKey: "", model: "", host: "" };
}
