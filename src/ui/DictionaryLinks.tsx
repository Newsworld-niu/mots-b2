import { BookOpen, ExternalLink, Search } from "lucide-react";
import { wiktionaryLinks } from "../lib/wiktionary";
import { isNative } from "../lib/native";

/** Capacitor routes external _self links to Android's browser without navigating the app WebView. */
export function DictionaryLinks({ word }: { word: string }) {
  const urls = wiktionaryLinks(word);
  if (!urls) return null;
  const target = isNative() ? "_self" : "_blank";
  return <div className="dictionary-links" aria-label="法语在线词典">
    <a className="btn btn-ghost btn-sm" href={urls.entry} target={target} rel="noopener noreferrer" title="打开法语维基词典，保留当前卡片"><BookOpen size={15}/>查词典<ExternalLink size={13}/></a>
    <a className="link" href={urls.search} target={target} rel="noopener noreferrer" title="没有对应词条？在法语维基词典中搜索"><Search size={14}/>搜索词典</a>
    <span>Wiktionnaire · 法语维基词典</span>
  </div>;
}
