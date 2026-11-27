import { BookA, Compass, GraduationCap, Layers, User } from "lucide-react";
import type { Route } from "../lib/router";

export interface NavItem {
  page: Route["page"];
  label: string;
  href: string;
}

export interface NavGroup extends NavItem {
  icon: typeof Compass;
  /** Second-level destinations shown in the desktop sidebar under the active pillar. */
  sub: NavItem[];
}

/** Five unified pillars across desktop & mobile: 今日 / 应试 / 词库 / 语法 / 我的. */
export const MAIN_NAV: NavGroup[] = [
  {
    page: "today",
    label: "今日",
    href: "#/",
    icon: Compass,
    sub: [{ page: "lounge", label: "漫游馆", href: "#/lounge" }],
  },
  {
    page: "practice",
    label: "应试",
    href: "#/practice",
    icon: GraduationCap,
    sub: [
      { page: "mock", label: "全真模考", href: "#/mock" },
      { page: "listen", label: "听力理解", href: "#/listen" },
      { page: "examread", label: "阅读理解", href: "#/examread" },
      { page: "essay", label: "书面表达", href: "#/essay" },
      { page: "speak", label: "口语表达", href: "#/speak" },
      { page: "drill", label: "一分钟口语", href: "#/drill" },
      { page: "expr", label: "高频表达", href: "#/expr" },
      { page: "real", label: "真实电台", href: "#/real" },
      { page: "reflow", label: "错题中心", href: "#/reflow" },
    ],
  },
  {
    page: "dict",
    label: "词库",
    href: "#/dict",
    icon: BookA,
    sub: [
      { page: "atlas", label: "图鉴", href: "#/atlas" },
      { page: "decks", label: "卡组", href: "#/decks" },
      { page: "read", label: "报刊精读", href: "#/read" },
      { page: "compare", label: "易混词辨析", href: "#/compare" },
    ],
  },
  {
    page: "grammar",
    label: "语法",
    href: "#/grammar",
    icon: Layers,
    sub: [{ page: "conj", label: "动词变位", href: "#/conj" }],
  },
  { page: "me", label: "我的", href: "#/me", icon: User, sub: [] },
];

const STUDIO_ROUTES = new Set<Route["page"]>(["mock", "speak", "listen", "examread", "essay", "real", "drill", "expr", "reflow"]);
/** 阅读 (报刊精读) colours every word by how well it is known: it lives with the word tools. */
const LEXICON_ROUTES = new Set<Route["page"]>(["atlas", "decks", "compare", "read"]);

/** Whether `tab` (a pillar) should light up while `current` is shown. */
export const navOn = (current: Route["page"], tab: Route["page"]) =>
  current === tab ||
  (tab === "today" && (current === "learn" || current === "lounge")) ||
  (tab === "practice" && STUDIO_ROUTES.has(current)) ||
  (tab === "dict" && LEXICON_ROUTES.has(current)) ||
  (tab === "grammar" && current === "conj") ||
  (tab === "me" && current === "about");

/** The pillar `current` belongs to (today when none claims it). */
export const activePillar = (current: Route["page"]): Route["page"] => MAIN_NAV.find((g) => navOn(current, g.page))?.page ?? "today";

/** Apple keyboards show ⌘, the others Ctrl. */
export const isApplePlatform = () => {
  if (typeof navigator === "undefined") return false;
  const nav = navigator as Navigator & { userAgentData?: { platform?: string } };
  const platform = nav.userAgentData?.platform || nav.platform || nav.userAgent || "";
  return /mac|iphone|ipad|ipod/i.test(platform);
};

/** "⌘K" on Apple platforms, "Ctrl K" elsewhere. */
export const searchShortcutLabel = () => (isApplePlatform() ? "⌘K" : "Ctrl K");
