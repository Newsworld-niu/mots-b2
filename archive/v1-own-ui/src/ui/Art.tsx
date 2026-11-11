import { Briefcase, Leaf, Users, HeartPulse, GraduationCap, TrendingUp, Newspaper, Plane, Heart } from "lucide-react";
import type { TopicKey } from "../data";

const ICON: Record<TopicKey, typeof Leaf> = {
  travail: Briefcase,
  environnement: Leaf,
  societe: Users,
  sante: HeartPulse,
  education: GraduationCap,
  economie: TrendingUp,
  medias: Newspaper,
  voyage: Plane,
  emotions: Heart,
};

/**
 * Original topic illustration: a risograph-style plate in the topic's tone,
 * with a vector glyph and the headword's initial. Drawn in code, no image files.
 */
export function Art({ topic, tone, word, className = "" }: { topic: TopicKey; tone: string; word: string; className?: string }) {
  const Icon = ICON[topic];
  return (
    <div className={`art art-${tone} ${className}`} role="img" aria-label={`${word} 插画`}>
      <span className="art-dot art-dot-a" />
      <span className="art-dot art-dot-b" />
      <span className="art-glyph">
        <Icon size={44} strokeWidth={1.6} />
      </span>
      <span className="art-letter" aria-hidden="true">
        {word[0]?.toUpperCase()}
      </span>
    </div>
  );
}
