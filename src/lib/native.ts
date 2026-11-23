/**
 * Web-only platform helpers (Capacitor native runtime has been removed).
 * Callers retain clean imports while all behavior executes via standard browser APIs.
 */
export const isNative = () => false;

export async function shareFileNative(_blob: Blob, _name: string, _title?: string): Promise<boolean> {
  return false;
}

export async function speakNative(_text: string, _lang: string, _rate: number): Promise<boolean> {
  return false;
}

export function stopSpeakingNative(): void {
  // Web speech synthesis cancellation is handled directly in audio.ts
}

export function initNative(): void {
  // No-op in web runtime
}
