import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { useGrammar } from "../atlas/grammar";
import type { DiscourseExercise } from "../lib/grammar-discourse";
import { go, useLocation } from "../lib/router";
import { DiscourseSession } from "./grammar/DiscourseSession";
import { Session } from "./grammar/GrammarDrills";
import { CheatSheet, Overview, PointView } from "./grammar/GrammarViews";
import type { RunSpec, StartRound } from "./grammar/helpers";

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

export function Grammar({
  pointId,
  sheet,
  sprint,
  section: sectionProp,
}: {
  pointId?: string;
  sheet?: boolean;
  sprint?: "tcf" | "tef";
  /** Section to scroll to (r1, traps, a matrix id …); read from the address when not given. */
  section?: string;
}) {
  const { data, error } = useGrammar();
  const loc = useLocation();
  const section = sectionProp ?? (loc.route.page === "grammar" ? loc.route.section : undefined);
  const [run, setRun] = useState<(RunSpec & { key: number }) | null>(null);
  const [discourse, setDiscourse] = useState<DiscourseExercise | null>(null);
  // a new point, sheet or sprint ends the round; moving to another section of the same page does not
  useEffect(() => {
    setRun(null);
    setDiscourse(null);
  }, [pointId, sheet, sprint]);
  const start = useCallback<StartRound>((steps, opts) => {
    if (!steps.length) return;
    setRun({ steps, mode: opts?.mode ?? "round", label: opts?.label, origin: opts?.origin, again: opts?.again, key: Date.now() });
  }, []);
  const restart = useCallback((spec: RunSpec) => {
    if (spec.steps.length) setRun({ ...spec, key: Date.now() });
  }, []);
  if (error) return <div className="page"><p className="muted">{error}</p></div>;
  if (!data) return <div className="page learn-loading"><span className="spinner" /></div>;
  if (sprint === "tcf" || sprint === "tef") {
    return (
      <Suspense fallback={<div className="page learn-loading"><span className="spinner" /></div>}>
        <StructureSprint initialMode={sprint} data={data} onExit={() => go({ page: "grammar" })} />
      </Suspense>
    );
  }
  if (run) return <Session key={run.key} data={data} run={run} onRestart={restart} onExit={() => setRun(null)} />;
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
  if (sheet) return <CheatSheet data={data} section={section} />;
  const point = pointId ? data.points.find((p) => p.id === pointId) : undefined;
  if (point) return <PointView key={point.id} data={data} point={point} section={section} onStart={start} />;
  return <Overview data={data} tabs={<GrammarTabs on="grammar" />} onStart={start} onDiscourse={setDiscourse} />;
}
