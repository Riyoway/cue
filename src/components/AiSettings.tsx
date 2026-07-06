import { type ReactNode, useEffect, useState } from "react";
import { Check, Loader2, RefreshCw, TriangleAlert } from "lucide-react";
import {
  AI_PROVIDERS,
  aiCheck,
  aiListModels,
  aiOpenLoginTerminal,
  providerMeta,
  type AiProviderMeta,
  type AiStatus,
} from "../lib/ai";
import type { AiProviderConfig, AiState } from "../types";
import { useT, type Translate } from "../lib/i18n";
import { Dropdown } from "./Dropdown";

const EMPTY: AiProviderConfig = { apiKey: "", model: "", host: "" };

const inputCls =
  "h-9 w-full rounded-lg border border-zinc-300 bg-transparent px-2.5 text-[12px] text-zinc-800 outline-none transition-colors focus-visible:border-accent-500 focus-visible:ring-2 focus-visible:ring-accent-500/40 dark:border-zinc-700 dark:text-zinc-100";
const btnCls =
  "inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border border-zinc-300 px-2.5 py-1.5 text-[12px] font-medium text-zinc-700 outline-none transition duration-150 hover:bg-zinc-100 focus-visible:ring-2 focus-visible:ring-accent-500/40 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <div className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">{label}</div>
      {children}
    </div>
  );
}

/** AI プロンプト最適化の設定。プロバイダ選択→キー/ホスト→モデル（自動取得）→状態確認/ログイン。 */
export function AiSettings({
  value,
  onChange,
}: {
  value: AiState;
  onChange: (v: AiState) => void;
}) {
  const t = useT();
  const [models, setModels] = useState<string[]>([]);
  const [status, setStatus] = useState<AiStatus | null>(null);
  const [busy, setBusy] = useState<"models" | "check" | null>(null);
  const [error, setError] = useState("");

  const provider = value.provider;
  const meta = providerMeta(provider);
  const pc = value.byProvider[provider] ?? EMPTY;

  const setProvider = (id: string) => {
    setModels([]);
    setStatus(null);
    setError("");
    onChange({ ...value, provider: id });
  };
  const patch = (partial: Partial<AiProviderConfig>) =>
    onChange({
      ...value,
      byProvider: { ...value.byProvider, [provider]: { ...pc, ...partial } },
    });

  const fetchModels = async (silent = false) => {
    setBusy("models");
    if (!silent) setError("");
    try {
      const list = await aiListModels(provider, pc);
      setModels(list);
      if (!pc.model && list.length) patch({ model: list[0] });
      if (!list.length && !silent) setError(t("aiNoModels"));
    } catch (e) {
      if (!silent) setError(String(e));
    } finally {
      setBusy(null);
    }
  };

  // プロバイダ切替時に自動取得（キー不要 or 既にキーあり）。自動時のエラーは黙る。
  useEffect(() => {
    const m = providerMeta(provider);
    if (!m) return;
    const cfg = value.byProvider[provider] ?? EMPTY;
    if (m.needsKey && !cfg.apiKey) return;
    void fetchModels(true);
    // provider が変わったら再取得。value は毎レンダー新しいので dep から除外。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider]);

  const check = async () => {
    setBusy("check");
    setError("");
    setStatus(null);
    try {
      setStatus(await aiCheck(provider, pc));
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(null);
    }
  };

  const modelOptions = Array.from(new Set([pc.model, ...models].filter(Boolean))).map(
    (m) => ({ value: m, label: m }),
  );

  return (
    <div className="space-y-3.5 px-3.5 py-3.5">
      <Field label={t("aiProvider")}>
        <Dropdown
          value={provider}
          ariaLabel={t("aiProvider")}
          onChange={setProvider}
          options={[
            { value: "", label: t("aiSelectProvider") },
            ...AI_PROVIDERS.map((p) => ({ value: p.id, label: p.label })),
          ]}
        />
      </Field>

      {meta && (
        <>
          {meta.needsKey && (
            <Field label={t("aiApiKey")}>
              <input
                type="password"
                value={pc.apiKey}
                onChange={(e) => patch({ apiKey: e.target.value })}
                onBlur={() => {
                  if (pc.apiKey) void fetchModels(true);
                }}
                placeholder="sk-…"
                aria-label={t("aiApiKey")}
                spellCheck={false}
                autoComplete="off"
                className={inputCls}
              />
            </Field>
          )}
          {meta.needsHost && (
            <Field label={t("aiHost")}>
              <input
                value={pc.host}
                onChange={(e) => patch({ host: e.target.value })}
                onBlur={() => void fetchModels(true)}
                placeholder="http://localhost:11434"
                aria-label={t("aiHost")}
                spellCheck={false}
                className={inputCls}
              />
            </Field>
          )}

          <Field label={t("aiModel")}>
            <div className="flex items-center gap-2">
              <div className="min-w-0 flex-1">
                <Dropdown
                  value={pc.model}
                  ariaLabel={t("aiModel")}
                  onChange={(v) => patch({ model: v })}
                  options={
                    modelOptions.length ? modelOptions : [{ value: "", label: t("aiModel") }]
                  }
                />
              </div>
              <button
                type="button"
                onClick={() => fetchModels(false)}
                disabled={busy !== null}
                className={btnCls}
              >
                {busy === "models" ? (
                  <Loader2 size={14} className="animate-spin" aria-hidden />
                ) : (
                  <RefreshCw size={14} aria-hidden />
                )}
                {t("aiFetchModels")}
              </button>
            </div>
          </Field>

          <div className="flex flex-wrap items-center gap-2 pt-0.5">
            <button type="button" onClick={check} disabled={busy !== null} className={btnCls}>
              {busy === "check" ? (
                <Loader2 size={14} className="animate-spin" aria-hidden />
              ) : (
                <Check size={14} aria-hidden />
              )}
              {t("aiCheck")}
            </button>
            {meta.kind === "cli" && status && status.authed !== true && (
              <button
                type="button"
                onClick={() => aiOpenLoginTerminal(provider)}
                className={btnCls}
              >
                {t("aiLogin")}
              </button>
            )}
            {status && <StatusChip meta={meta} status={status} t={t} />}
          </div>

          {error && (
            <p className="flex items-start gap-1.5 rounded-lg bg-red-500/5 px-2.5 py-2 text-[11px] leading-snug text-red-600 dark:text-red-400">
              <TriangleAlert size={13} className="mt-px shrink-0" aria-hidden />
              <span className="min-w-0 break-words">{error}</span>
            </p>
          )}
        </>
      )}
    </div>
  );
}

function StatusChip({
  meta,
  status,
  t,
}: {
  meta: AiProviderMeta;
  status: AiStatus;
  t: Translate;
}) {
  let label: string;
  let tone: "ok" | "warn" | "bad";
  if (meta.kind === "cli" && !status.installed) {
    label = t("aiNotInstalled");
    tone = "bad";
  } else if (status.authed === true) {
    label = t("aiAuthed");
    tone = "ok";
  } else if (status.authed === false) {
    label = t("aiNotAuthed");
    tone = "bad";
  } else {
    label = t("aiAuthUnknown");
    tone = "warn";
  }
  const cls =
    tone === "ok"
      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
      : tone === "warn"
        ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
        : "bg-red-500/10 text-red-600 dark:text-red-400";
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${cls}`}>{label}</span>
  );
}
