import { type KeyboardEvent, type ReactNode, useEffect, useState } from "react";
import { Check, Download, RefreshCw, Trash2, TriangleAlert, Upload, X } from "lucide-react";
import { useStore } from "../store";
import { gitAvailable, quitApp } from "../lib/tauri";
import { handleHeaderMouseDown } from "../lib/drag";
import { LANGUAGES, useT } from "../lib/i18n";
import { MOD } from "../lib/platform";
import { ACCENTS, TEXT_SCALES, type Settings as SettingsType } from "../types";
import { IconButton } from "./ui";
import { Dropdown } from "./Dropdown";

function normalizeKey(e: KeyboardEvent): string | null {
  const code = e.code;
  if (code.startsWith("Key")) return code.slice(3);
  if (code.startsWith("Digit")) return code.slice(5);
  if (code === "Space") return "Space";
  if (/^F\d{1,2}$/.test(code)) return code;
  if (code.startsWith("Arrow")) return code.slice(5);
  return null;
}

function eventToAccelerator(e: KeyboardEvent): string | null {
  const mods: string[] = [];
  if (e.ctrlKey || e.metaKey) mods.push("CommandOrControl");
  if (e.altKey) mods.push("Alt");
  if (e.shiftKey) mods.push("Shift");
  const key = normalizeKey(e);
  if (!key) return null;
  return [...mods, key].join("+");
}

function KeyChips({ accel }: { accel: string }) {
  const keys = accel.replace("CommandOrControl", MOD).split("+");
  return (
    <span className="flex items-center gap-1">
      {keys.map((k, i) => (
        <span key={i} className="cue-kbd">
          {k}
        </span>
      ))}
    </span>
  );
}

function ShortcutInput({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
}) {
  const t = useT();
  const [recording, setRecording] = useState(false);
  return (
    <button
      type="button"
      aria-label={label}
      onKeyDown={(e) => {
        if (!recording) return;
        e.preventDefault();
        const accel = eventToAccelerator(e);
        if (accel) {
          onChange(accel);
          setRecording(false);
        }
      }}
      onClick={() => setRecording((r) => !r)}
      onBlur={() => setRecording(false)}
      className={`flex h-9 min-w-[176px] cursor-pointer items-center justify-center rounded-lg border px-3 text-[12px] outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-accent-500/50 ${
        recording
          ? "border-accent-500 bg-accent-500/10 text-accent-600 dark:text-accent-300"
          : "border-zinc-300 hover:border-zinc-400 dark:border-zinc-700 dark:hover:border-zinc-600"
      }`}
    >
      {recording ? t("setPressKey") : <KeyChips accel={value} />}
    </button>
  );
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 shrink-0 cursor-pointer rounded-full outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-accent-500/50 ${
        checked ? "bg-accent-600" : "bg-zinc-300 dark:bg-zinc-700"
      }`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all duration-150 ${
          checked ? "left-[22px]" : "left-0.5"
        }`}
      />
    </button>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 px-1 text-[11px] font-semibold tracking-wider text-zinc-400 uppercase">
        {title}
      </h2>
      <div className="divide-y divide-zinc-200/70 overflow-hidden rounded-xl border border-zinc-200/80 bg-zinc-50/40 dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-800/20">
        {children}
      </div>
    </section>
  );
}

function Row({
  label,
  desc,
  children,
}: {
  label: string;
  desc?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-[52px] items-center justify-between gap-4 px-3.5 py-2.5">
      <div className="min-w-0">
        <div className="text-[13px] font-medium text-zinc-800 dark:text-zinc-100">
          {label}
        </div>
        {desc && (
          <div className="mt-0.5 text-[11px] leading-snug text-zinc-500 dark:text-zinc-400">
            {desc}
          </div>
        )}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

export function Settings() {
  const settings = useStore((s) => s.settings);
  const closeSettings = useStore((s) => s.closeSettings);
  const saveSettings = useStore((s) => s.saveSettings);
  const exportToFile = useStore((s) => s.exportToFile);
  const importFromFile = useStore((s) => s.importFromFile);
  const setGitConfig = useStore((s) => s.setGitConfig);
  const syncNow = useStore((s) => s.syncNow);
  const syncing = useStore((s) => s.syncing);
  const lastSyncedAt = useStore((s) => s.lastSyncedAt);
  const requestDataErase = useStore((s) => s.requestDataErase);
  const t = useT();

  const [draft, setDraft] = useState<SettingsType>(settings);
  const patch = (p: Partial<SettingsType>) => setDraft((d) => ({ ...d, ...p }));

  // git の有無を検出（null=確認中 / true=あり / false=なし）
  const [gitOk, setGitOk] = useState<boolean | null>(null);
  useEffect(() => {
    gitAvailable()
      .then(setGitOk)
      .catch(() => setGitOk(false));
  }, []);

  const onSyncNow = async () => {
    await setGitConfig(draft.git_remote, draft.git_branch, draft.git_enabled);
    await syncNow();
  };

  const inputCls =
    "h-9 w-full rounded-lg border border-zinc-300 bg-transparent px-2.5 text-[12px] text-zinc-800 outline-none transition-colors focus-visible:border-accent-500 focus-visible:ring-2 focus-visible:ring-accent-500/40 dark:border-zinc-700 dark:text-zinc-100";
  const secondaryBtn =
    "inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-zinc-300 px-2.5 py-1.5 text-[12px] font-medium text-zinc-700 outline-none transition duration-150 hover:bg-zinc-100 focus-visible:ring-2 focus-visible:ring-accent-500/40 active:scale-95 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800";
  const dangerBtn =
    "inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-red-300 px-2.5 py-1.5 text-[12px] font-medium text-red-600 outline-none transition duration-150 hover:bg-red-50 focus-visible:ring-2 focus-visible:ring-red-500/40 active:scale-95 dark:border-red-900/60 dark:text-red-400 dark:hover:bg-red-950/40";

  return (
    <div className="cue-overlay-in absolute inset-0 z-30 flex flex-col bg-white dark:bg-zinc-900">
      <header
        onMouseDown={handleHeaderMouseDown}
        className="flex h-12 shrink-0 items-center justify-between border-b border-zinc-200/80 px-4 dark:border-zinc-800"
      >
        <span className="text-[15px] font-semibold text-zinc-800 select-none dark:text-zinc-100">
          {t("setTitle")}
        </span>
        <IconButton label={t("actClose")} onClick={closeSettings}>
          <X size={16} />
        </IconButton>
      </header>

      <div className="cue-scroll flex-1 space-y-6 overflow-y-auto px-5 py-5">
        <Section title={t("setLanguage")}>
          <Row label={t("setLanguage")}>
            <Dropdown
              value={draft.lang}
              ariaLabel={t("setLanguage")}
              onChange={(v) => patch({ lang: v })}
              options={LANGUAGES.map((l) => ({ value: l.id, label: l.label }))}
            />
          </Row>
        </Section>

        <Section title={t("setAccent")}>
          <div className="flex items-center gap-3 px-3.5 py-3.5">
            {ACCENTS.map((a) => (
              <button
                key={a.id}
                type="button"
                title={a.id}
                aria-label={`${t("setAccent")}: ${a.id}`}
                aria-pressed={draft.accent === a.id}
                onClick={() => patch({ accent: a.id })}
                style={{ backgroundColor: a.color }}
                className={`h-7 w-7 cursor-pointer rounded-full outline-none transition-transform duration-150 active:scale-90 ${
                  draft.accent === a.id
                    ? "ring-2 ring-zinc-400 ring-offset-2 ring-offset-white dark:ring-zinc-300 dark:ring-offset-zinc-900"
                    : "hover:scale-110"
                }`}
              />
            ))}
          </div>
        </Section>

        <Section title={t("setTextSize")}>
          <div className="px-3.5 py-3.5">
            <div className="inline-flex rounded-lg bg-zinc-200/70 p-0.5 dark:bg-zinc-800">
              {TEXT_SCALES.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => patch({ text_scale: s.value })}
                  className={`cursor-pointer rounded-md px-2.5 py-1 text-[12px] font-medium outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-accent-500/50 ${
                    draft.text_scale === s.value
                      ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-100"
                      : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                  }`}
                >
                  {t(s.key)}
                </button>
              ))}
            </div>
          </div>
        </Section>

        <Section title={t("setShortcuts")}>
          <Row label={t("setSummon")} desc={t("setSummonDesc")}>
            <ShortcutInput
              label={t("setSummon")}
              value={draft.summon_shortcut}
              onChange={(v) => patch({ summon_shortcut: v })}
            />
          </Row>
          <Row label={t("setQuicksave")} desc={t("setQuicksaveDesc")}>
            <ShortcutInput
              label={t("setQuicksave")}
              value={draft.quicksave_shortcut}
              onChange={(v) => patch({ quicksave_shortcut: v })}
            />
          </Row>
        </Section>

        <Section title={t("setStartup")}>
          <Row label={t("setAutostart")}>
            <Toggle
              label={t("setAutostart")}
              checked={draft.autostart}
              onChange={(v) => patch({ autostart: v })}
            />
          </Row>
          <Row label={t("setAot")} desc={t("setAotDesc")}>
            <Toggle
              label={t("setAot")}
              checked={draft.always_on_top_default}
              onChange={(v) => patch({ always_on_top_default: v })}
            />
          </Row>
        </Section>

        <Section title={t("setBackup")}>
          <Row label={t("setFile")} desc={t("setFileDesc")}>
            <div className="flex gap-2">
              <button type="button" onClick={() => exportToFile()} className={secondaryBtn}>
                <Download size={14} aria-hidden />
                {t("btnExport")}
              </button>
              <button type="button" onClick={() => importFromFile()} className={secondaryBtn}>
                <Upload size={14} aria-hidden />
                {t("btnImport")}
              </button>
            </div>
          </Row>

          <Row label={t("setGit")} desc={t("setGitDesc")}>
            <Toggle
              label={t("setGit")}
              checked={draft.git_enabled}
              onChange={(v) => patch({ git_enabled: v })}
            />
          </Row>

          {draft.git_enabled && (
            <div className="space-y-2.5 px-3.5 py-3">
              <div className="flex items-center gap-1.5 text-[11px]">
                {gitOk === null ? (
                  <span className="text-zinc-400">{t("setGitChecking")}</span>
                ) : gitOk ? (
                  <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                    <Check size={13} aria-hidden /> {t("setGitFound")}
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                    <TriangleAlert size={13} aria-hidden /> {t("setGitMissing")}
                  </span>
                )}
              </div>
              <input
                value={draft.git_remote}
                onChange={(e) => patch({ git_remote: e.target.value })}
                placeholder="git@github.com:you/cue-private.git"
                aria-label="URL"
                spellCheck={false}
                className={inputCls}
              />
              <div className="flex items-center gap-2">
                <input
                  value={draft.git_branch}
                  onChange={(e) => patch({ git_branch: e.target.value })}
                  placeholder="main"
                  aria-label="branch"
                  spellCheck={false}
                  className="h-9 w-24 shrink-0 rounded-lg border border-zinc-300 bg-transparent px-2.5 text-[12px] text-zinc-800 outline-none transition-colors focus-visible:border-accent-500 focus-visible:ring-2 focus-visible:ring-accent-500/40 dark:border-zinc-700 dark:text-zinc-100"
                />
                <button
                  type="button"
                  onClick={onSyncNow}
                  disabled={syncing || !draft.git_remote.trim() || gitOk === false}
                  className="flex h-9 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-accent-600 px-3 text-[12px] font-medium whitespace-nowrap text-white outline-none transition duration-150 hover:bg-accent-500 focus-visible:ring-2 focus-visible:ring-accent-500/60 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <RefreshCw size={14} className={syncing ? "animate-spin" : ""} aria-hidden />
                  {syncing ? t("btnSyncing") : t("btnSyncNow")}
                </button>
              </div>
              <p className="text-[11px] leading-relaxed text-zinc-400">
                {t("setGitNote")}
                {lastSyncedAt
                  ? " " +
                    t("setLastSync", {
                      time: new Date(lastSyncedAt).toLocaleTimeString(),
                    })
                  : ""}
              </p>
            </div>
          )}
        </Section>

        <Section title={t("setData")}>
          <Row label={t("setEraseAll")} desc={t("setEraseAllDesc")}>
            <button type="button" onClick={() => requestDataErase()} className={dangerBtn}>
              <Trash2 size={14} aria-hidden />
              {t("btnErase")}
            </button>
          </Row>
        </Section>
      </div>

      <footer className="flex items-center justify-between gap-3 border-t border-zinc-200/80 px-4 py-2.5 dark:border-zinc-800">
        <button
          type="button"
          onClick={() => quitApp()}
          className="cursor-pointer rounded-md px-2.5 py-1.5 text-[12px] text-red-500 outline-none transition-colors duration-150 hover:bg-red-500/10 focus-visible:ring-2 focus-visible:ring-red-500/40"
        >
          {t("setQuit")}
        </button>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={closeSettings}
            className="cursor-pointer rounded-md px-3 py-1.5 text-[13px] text-zinc-600 outline-none transition-colors duration-150 hover:bg-zinc-200/70 focus-visible:ring-2 focus-visible:ring-accent-500/50 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            {t("btnCancel")}
          </button>
          <button
            type="button"
            onClick={() => saveSettings(draft)}
            className="cursor-pointer rounded-md bg-accent-600 px-3.5 py-1.5 text-[13px] font-medium text-white outline-none transition-colors duration-150 hover:bg-accent-500 focus-visible:ring-2 focus-visible:ring-accent-500/60"
          >
            {t("btnSave")}
          </button>
        </div>
      </footer>
    </div>
  );
}
