import {
  Minus,
  Monitor,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Pin,
  Plus,
  Settings,
  Sun,
  X,
} from "lucide-react";
import { useStore } from "../store";
import { hideLauncher, minimizeWindow } from "../lib/tauri";
import { handleHeaderMouseDown } from "../lib/drag";
import { useT } from "../lib/i18n";
import type { ThemeMode } from "../types";
import { IconButton } from "./ui";
import iconDark from "../assets/icon.png";
import iconLight from "../assets/icon-light.png";

const THEME_CYCLE: ThemeMode[] = ["system", "light", "dark"];
const THEME_META: Record<ThemeMode, { Icon: typeof Monitor; key: string }> = {
  system: { Icon: Monitor, key: "themeSystem" },
  light: { Icon: Sun, key: "themeLight" },
  dark: { Icon: Moon, key: "themeDark" },
};

export function Header() {
  const t = useT();
  const windowPinned = useStore((s) => s.windowPinned);
  const setWindowPinned = useStore((s) => s.setWindowPinned);
  const newItem = useStore((s) => s.newItem);
  const openSettings = useStore((s) => s.openSettings);
  const updateAvailable = useStore((s) => s.updateInfo !== null);
  const theme = useStore((s) => s.settings.theme);
  const setTheme = useStore((s) => s.setTheme);
  const isDark = useStore((s) => s.isDark);
  const sidebarCollapsed = useStore((s) => s.settings.sidebar_collapsed);
  const toggleSidebar = useStore((s) => s.toggleSidebar);

  const ThemeIcon = THEME_META[theme].Icon;
  const nextTheme =
    THEME_CYCLE[(THEME_CYCLE.indexOf(theme) + 1) % THEME_CYCLE.length];

  return (
    <header
      onMouseDown={handleHeaderMouseDown}
      className="flex h-11 shrink-0 items-center gap-1 px-2.5"
    >
      <div className="flex flex-1 items-center gap-2 pl-1 select-none">
        <img
          src={isDark ? iconDark : iconLight}
          alt=""
          draggable={false}
          className="h-[26px] w-[26px] rounded-[7px] shadow-sm"
        />
        <span className="text-[15px] font-semibold tracking-wide text-zinc-600 dark:text-zinc-200">
          Cue
        </span>
      </div>

      <IconButton label={t("actSidebar")} onClick={() => toggleSidebar()}>
        {sidebarCollapsed ? (
          <PanelLeftOpen size={16} />
        ) : (
          <PanelLeftClose size={16} />
        )}
      </IconButton>

      <IconButton
        label={t("themeCycle", { name: t(THEME_META[theme].key) })}
        onClick={() => setTheme(nextTheme)}
      >
        <ThemeIcon size={16} />
      </IconButton>

      <IconButton
        label={windowPinned ? t("pinUnset") : t("pinSet")}
        aria-pressed={windowPinned}
        onClick={() => setWindowPinned(!windowPinned)}
      >
        <Pin size={16} fill={windowPinned ? "currentColor" : "none"} />
      </IconButton>

      <div className="mx-1 h-5 w-px bg-zinc-300 dark:bg-zinc-700" />

      <IconButton label={t("actNew")} onClick={newItem}>
        <Plus size={17} />
      </IconButton>

      <div className="relative">
        <IconButton
          label={
            updateAvailable
              ? `${t("actSettings")} · ${t("setUpdateBadge")}`
              : t("actSettings")
          }
          onClick={openSettings}
        >
          <Settings size={16} />
        </IconButton>
        {updateAvailable && (
          <span className="pointer-events-none absolute top-0.5 right-0.5 h-2 w-2 rounded-full bg-accent-500 ring-2 ring-zinc-100 dark:ring-zinc-950" />
        )}
      </div>

      <div className="mx-1 h-5 w-px bg-zinc-300 dark:bg-zinc-700" />

      <IconButton label={t("actMinimize")} onClick={() => void minimizeWindow()}>
        <Minus size={16} />
      </IconButton>

      <IconButton
        label={t("actHideTray")}
        variant="danger"
        onClick={() => hideLauncher()}
      >
        <X size={16} />
      </IconButton>
    </header>
  );
}
