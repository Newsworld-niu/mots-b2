export type LexiconTab = "dict" | "atlas" | "decks" | "compare";

const TABS: { key: LexiconTab; label: string; href: string }[] = [
  { key: "dict", label: "词典", href: "#/dict" },
  { key: "atlas", label: "图鉴", href: "#/atlas" },
  { key: "decks", label: "卡组", href: "#/decks" },
  { key: "compare", label: "辨析", href: "#/compare" },
];

/** 词典 / 图鉴 / 卡组 / 辨析: unified sub-navigation inside the 词库 pillar. */
export function LexiconTabs({ on }: { on: LexiconTab }) {
  return (
    <nav className="segmented gram-tabs lexicon-tabs" aria-label="词库模块切换">
      {TABS.map((t) => (
        <a key={t.key} href={t.href} className={on === t.key ? "is-on" : ""} aria-current={on === t.key ? "page" : undefined}>
          {t.label}
        </a>
      ))}
    </nav>
  );
}
