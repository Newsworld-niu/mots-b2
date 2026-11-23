export type LoungeMode = "chill" | "study";
export type LoungeShelf = "books" | "reads" | "videos";
export type EnergyTier = 1 | 2 | 3;

export interface BookChapterMeta {
  id: string;
  title: string;
  titleZh: string;
  words: number;
  path: string;
  audioUrl?: string;
}

export interface LoungeBookMeta {
  id: string;
  title: string;
  titleZh: string;
  author: string;
  year: number;
  level: "A2" | "B1" | "B2";
  energy: EnergyTier;
  moodTags: string[];
  summaryZh: string;
  licenseNote: string;
  librivoxUrl?: string;
  chapters: BookChapterMeta[];
}

export interface BookChapterData {
  bookId: string;
  chapterId: string;
  title: string;
  titleZh: string;
  fr: string[];
  zh: string[];
  noteZh?: string;
}

export interface RecommendedPrivateBook {
  id: string;
  title: string;
  titleZh: string;
  author: string;
  level: "A2" | "B1" | "B2";
  energy: EnergyTier;
  atlasOverlapPct: number;
  tags: string[];
  whyZh: string;
  copyrightNoteZh: string;
}

export type MicroReadCategory = "culture" | "dialogue" | "mystery" | "poetry";

export interface DialogueLine {
  speaker: string;
  gender: "f" | "m";
  fr: string;
  zh: string;
}

export interface MicroReadPoll {
  questionZh: string;
  optionsZh: string[];
  revealIndex: number;
  revealZh: string;
}

export interface LoungeMicroRead {
  id: string;
  category: MicroReadCategory;
  title: string;
  titleZh: string;
  level: "A2" | "B1" | "B2";
  energy: 1 | 2;
  minutes: number;
  authorNote: string;
  recommendedAmbience?: "rain" | "cafe" | "fire" | "forest" | "sea" | "stars";
  fr: string[];
  zh: string[];
  dialogue?: DialogueLine[];
  poll?: MicroReadPoll;
  series?: { id: string; titleZh: string; ep: number; total: number };
  b2TipZh?: string;
}

export interface SubtitleCue {
  start: number;
  end: number;
  fr: string;
  zh?: string;
}

export interface VideoKeyExpression {
  fr: string;
  zh: string;
  note?: string;
}

export interface OpenSampleVideo {
  id: string;
  kind: "open";
  title: string;
  titleZh: string;
  creator: string;
  license: string;
  durationSec: number;
  durationLabel: string;
  level: "A2" | "B1" | "B2";
  energy: EnergyTier;
  videoUrl: string;
  posterUrl?: string;
  vttPath: string;
  ttsNarration?: boolean;
  summaryZh: string;
  cultureNoteZh: string;
  keyExpressions: VideoKeyExpression[];
}

export interface CuratedYoutubeVideo {
  id: string;
  kind: "youtube";
  youtubeId: string;
  fallbackUrl: string;
  channel: string;
  title: string;
  titleZh: string;
  durationLabel: string;
  level: "A2" | "B1" | "B2";
  energy: EnergyTier;
  tags: string[];
  hasBurnedInSubs?: boolean;
  summaryZh: string;
  cultureNoteZh: string;
  keyExpressions: VideoKeyExpression[];
}

export interface StoredUserBook {
  id: string;
  title: string;
  author?: string;
  format: "epub" | "txt";
  created: number;
  byteSize: number;
  chapters: { id: string; title: string; fr: string[]; words: number }[];
}

export interface LocalLoungeVideoMeta {
  id: string;
  title: string;
  created: number;
  videoBytes: number;
  videoMime: string;
  hasSubtitles: boolean;
  cueCount: number;
}

export interface BookProgressEntry {
  ch: number;
  para: number;
  ratio: number;
  updatedAt: number;
  done?: number;
  title?: string;
}

export interface MediaProgressEntry {
  pos: number;
  dur?: number;
  updatedAt: number;
  done?: number;
  title?: string;
  shelf?: LoungeShelf;
}

export interface SavedLoungeClip {
  id: string;
  fr: string;
  zh: string;
  source: string;
  created: number;
}
