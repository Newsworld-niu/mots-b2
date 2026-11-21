import type { CompKind } from "./exam";
import type { MissCause } from "./listening";
import type { Route } from "./router";

export interface MissLink {
  label: string;
  route?: Route;
  action?: "real";
}

/**
 * Map a listening / reading miss cause to concrete follow-up training:
 * grammar rules for language traps, or intensive listening / extensive reading / compare drills.
 */
export function missLinksFor(cause: MissCause, kind: CompKind): MissLink[] {
  const realOrRead: MissLink = kind === "listen" ? { label: "打开真实材料精听", action: "real" } : { label: "去长篇精读训练", route: { page: "read" } };
  switch (cause) {
    case "paraphrase":
      return [
        { label: "练语法：逻辑连接词", route: { page: "grammar", p: "connecteurs" } },
        { label: "练语法：名词化与同义改写", route: { page: "grammar", p: "nominalisation" } },
      ];
    case "negation":
      return [
        { label: "练语法：限定 ne…que / ni…ni", route: { page: "grammar", p: "restriction" } },
        { label: "练语法：否定细节与语气", route: { page: "grammar", p: "negation-nuances" } },
      ];
    case "gist":
      return [
        { label: "练语法：逻辑连接词", route: { page: "grammar", p: "connecteurs" } },
        realOrRead,
      ];
    case "inference":
      return [
        { label: "练语法：对立和让步", route: { page: "grammar", p: "opposition-concession" } },
        { label: "练语法：虚拟式还是直陈式", route: { page: "grammar", p: "subj-indicatif" } },
      ];
    case "vocab":
      return [
        { label: "扩充话题词库", route: { page: "learn" } },
        { label: "词图总览查词", route: { page: "atlas" } },
      ];
    case "heard":
      return kind === "listen"
        ? [
            { label: "打开真实材料精听", action: "real" },
            { label: "练听写巩固连读", route: { page: "learn" } },
          ]
        : [
            { label: "去长篇精读训练", route: { page: "read" } },
            { label: "练语法：复合关系代词", route: { page: "grammar", p: "relatifs-composes" } },
          ];
    case "time":
      return [
        { label: "练语法：从句结构切分", route: { page: "grammar", p: "connecteurs" } },
        realOrRead,
      ];
    case "careless":
      return [
        { label: "练易混细节对比", route: { page: "compare" } },
        { label: "练语法：时态配合", route: { page: "grammar", p: "pc-imparfait" } },
      ];
  }
}
