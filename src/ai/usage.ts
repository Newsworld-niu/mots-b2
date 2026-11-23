/**
 * Local AI call, token, and rough USD cost tracker.
 * Stored exclusively in this browser's localStorage and never synced or backed up.
 */
import { useSyncExternalStore } from "react";

export interface AiUsageState {
  calls: number;
  promptTokens: number;
  completionTokens: number;
  estimatedUsd: number;
  updatedAt: number;
}

const KEY = "word-atlas:ai-usage:v1";
const empty = (): AiUsageState => ({ calls: 0, promptTokens: 0, completionTokens: 0, estimatedUsd: 0, updatedAt: 0 });

/** Rough per-1M token [input, output] USD pricing rates for local learner budget visibility. */
export function estimateUsd(provider: string, model: string, promptTokens: number, completionTokens: number): number {
  const m = model.toLowerCase();
  let rate: [number, number] = [0.5, 1.5];
  if (m.includes("deepseek")) rate = [0.28, 0.42];
  else if (m.includes("gemini-2.5-flash") || m.includes("gemini-flash")) rate = [0.15, 0.6];
  else if (m.includes("gpt-4o-mini")) rate = [0.15, 0.6];
  else if (m.includes("gpt-5-mini")) rate = [0.25, 2.0];
  else if (provider === "anthropic" || m.includes("claude")) rate = [3.0, 15.0];
  else if (provider === "whisper" || m.includes("whisper")) return 0.002;
  return (promptTokens / 1_000_000) * rate[0] + (completionTokens / 1_000_000) * rate[1];
}

function read(): AiUsageState {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "null") as Partial<AiUsageState> | null;
    if (!raw || typeof raw !== "object") return empty();
    return {
      calls: typeof raw.calls === "number" && raw.calls >= 0 ? raw.calls : 0,
      promptTokens: typeof raw.promptTokens === "number" && raw.promptTokens >= 0 ? raw.promptTokens : 0,
      completionTokens: typeof raw.completionTokens === "number" && raw.completionTokens >= 0 ? raw.completionTokens : 0,
      estimatedUsd: typeof raw.estimatedUsd === "number" && raw.estimatedUsd >= 0 ? raw.estimatedUsd : 0,
      updatedAt: typeof raw.updatedAt === "number" && raw.updatedAt >= 0 ? raw.updatedAt : 0,
    };
  } catch {
    return empty();
  }
}

let usage: AiUsageState = typeof localStorage === "undefined" ? empty() : read();
const subs = new Set<() => void>();

function save(next: AiUsageState) {
  usage = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(usage));
  } catch {
    /* ignore storage quota/private mode errors */
  }
  subs.forEach((f) => f());
}

export function recordAiUsage(entry: { provider: string; model: string; promptTokens?: number; completionTokens?: number }) {
  const p = Math.max(0, Math.round(entry.promptTokens ?? 0));
  const c = Math.max(0, Math.round(entry.completionTokens ?? 0));
  const cost = estimateUsd(entry.provider, entry.model, p, c);
  save({
    calls: usage.calls + 1,
    promptTokens: usage.promptTokens + p,
    completionTokens: usage.completionTokens + c,
    estimatedUsd: usage.estimatedUsd + cost,
    updatedAt: Date.now(),
  });
}

export const getAiUsage = (): AiUsageState => usage;

export function resetAiUsage() {
  save(empty());
}

export function useAiUsage(): AiUsageState {
  return useSyncExternalStore(
    (f) => {
      subs.add(f);
      return () => subs.delete(f);
    },
    () => usage,
    () => usage,
  );
}
