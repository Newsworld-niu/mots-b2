/** Encode the complete headword so punctuation cannot become a URL fragment or query. */
export function wiktionaryLinks(word: string) {
  const term = word.trim().normalize("NFC").replace(/\s+/g, " ");
  if (!term) return null;
  return {
    entry: `https://fr.wiktionary.org/wiki/${encodeURIComponent(term.replace(/ /g, "_"))}#Français`,
    search: `https://fr.wiktionary.org/w/index.php?${new URLSearchParams({ title: "Spécial:Recherche", search: term, fulltext: "1" })}`,
  };
}

export function cleanWikiSources(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [
    ...new Set(
      value.filter((v): v is string => {
        if (typeof v !== "string" || v.length > 1000) return false;
        try {
          const u = new URL(v);
          return (
            u.protocol === "https:" &&
            u.hostname === "fr.wiktionary.org" &&
            u.pathname === "/w/index.php" &&
            /^\d+$/.test(u.searchParams.get("oldid") ?? "") &&
            !!u.searchParams.get("title")
          );
        } catch {
          return false;
        }
      }),
    ),
  ].slice(0, 20);
}
