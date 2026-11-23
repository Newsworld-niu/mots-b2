import "../styles/lounge.css";
import { LOUNGE_MICRO_READS } from "../lib/lounge-reads";
import { CURATED_YOUTUBE_VIDEOS, OPEN_SAMPLE_VIDEOS } from "../lib/lounge-videos";
import type { Route } from "../lib/router";
import { LoungeHub } from "./lounge/LoungeHub";
import { LoungeReader } from "./lounge/LoungeReader";
import { LoungeTheater } from "./lounge/LoungeTheater";

export type LoungeRoute = Extract<Route, { page: "lounge" }>;

export function Lounge({ route }: { route: LoungeRoute }) {
  const itemId = route.item?.trim();
  if (!itemId) {
    return (
      <div className="page lounge-page">
        <LoungeHub initialShelf={route.shelf} />
      </div>
    );
  }

  const isVideo =
    route.shelf === "videos" ||
    OPEN_SAMPLE_VIDEOS.some((v) => v.id === itemId) ||
    CURATED_YOUTUBE_VIDEOS.some((v) => v.id === itemId);

  if (isVideo) {
    return (
      <div className="page lounge-page is-immersive">
        <LoungeTheater key={itemId} itemId={itemId} />
      </div>
    );
  }

  const isMicroRead =
    route.shelf === "reads" || LOUNGE_MICRO_READS.some((r) => r.id === itemId);

  return (
    <div className="page lounge-page is-immersive">
      <LoungeReader
        key={itemId}
        kind={isMicroRead ? "read" : "book"}
        itemId={itemId}
        chapterParam={route.ch}
      />
    </div>
  );
}

export default Lounge;
