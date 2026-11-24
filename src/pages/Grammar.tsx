import { lazy, Suspense, useEffect, useState } from "react";
import { useGrammar } from "../atlas/grammar";
import type { DiscourseExercise } from "../lib/grammar-discourse";
import { go } from "../lib/router";
import { DiscourseSession } from "./grammar/DiscourseSession";
import { Session } from "./grammar/GrammarDrills";
import { CheatSheet, Overview, PointView } from "./grammar/GrammarViews";
import type { Step } from "./grammar/helpers";

const StructureSprint = lazy(() =>
  import("./grammar/StructureSprint").then((m) => ({ default: m.StructureSprint })),
);

/** 语法点 / 动词变位: the two halves of the 语法 tab. */
export function GrammarTabs({ on }: { on: "grammar" | "conj" }) {
  return (
    <div className="segmented gram-tabs pillar-tabs" role="tablist">
      <a role="tab" aria-selected={on === "grammar"} className={on === "grammar" ? "is-on" : ""} href="#/grammar">
        语法点
      </a>
      <a role="tab" aria-selected={on === "conj"} className={on === "conj" ? "is-on" : ""} href="#/conj">
        动词变位
      </a>
    </div>
  );
}

export function Grammar({ pointId, sheet, sprint }: { pointId?: string; sheet?: boolean; sprint?: "tcf" | "tef" }) {
  const { data, error } = useGrammar();
  const [run, setRun] = useState<{ steps: Step[]; key: number } | null>(null);
  const [discourse, setDiscourse] = useState<DiscourseExercise | null>(null);
  useEffect(() => {
    setRun(null);
    setDiscourse(null);
  }, [pointId, sheet, sprint]);
  if (error) return <div className="page"><p className="muted">{error}</p></div>;
  if (!data) return <div className="page learn-loading"><span className="spinner" /></div>;
  if (sprint === "tcf" || sprint === "tef") {
    return (
      <Suspense fallback={<div className="page learn-loading"><span className="spinner" /></div>}>
        <StructureSprint initialMode={sprint} data={data} onExit={() => go({ page: "grammar" })} />
      </Suspense>
    );
  }
  if (run) return <Session key={run.key} data={data} initial={run.steps} onExit={() => setRun(null)} />;
  if (discourse) {
    return (
      <DiscourseSession
        key={discourse.id}
        data={data}
        exercise={discourse}
        onExit={() => setDiscourse(null)}
        onOpenExercise={setDiscourse}
      />
    );
  }
  const start = (steps: Step[]) => steps.length && setRun({ steps, key: Date.now() });
  if (sheet) return <CheatSheet data={data} />;
  const point = pointId ? data.points.find((p) => p.id === pointId) : undefined;
  if (point) return <PointView data={data} point={point} onStart={start} />;
  return <Overview data={data} tabs={<GrammarTabs on="grammar" />} onStart={start} onDiscourse={setDiscourse} />;
}
