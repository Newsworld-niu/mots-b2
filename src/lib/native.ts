/**
 * The Android app (Capacitor): the same pages in a system WebView, plus the few things a WebView cannot do by
 * itself: saving or sharing a file, the device's French voice, the back button. In a browser none of this runs.
 */
import { Capacitor } from "@capacitor/core";

export const isNative = () => Capacitor.isNativePlatform();

function toBase64(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).replace(/^data:[^,]*,/, ""));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

/**
 * In the app: write the file to the cache and open the system share sheet (save to files, send to another app).
 * Returns false in a browser, where the caller downloads or shares it the web way.
 */
export async function shareFileNative(blob: Blob, name: string, title?: string) {
  if (!isNative()) return false;
  const [{ Filesystem, Directory }, { Share }] = await Promise.all([import("@capacitor/filesystem"), import("@capacitor/share")]);
  const { uri } = await Filesystem.writeFile({ path: name, data: await toBase64(blob), directory: Directory.Cache });
  // closing the sheet without choosing rejects: not an error
  await Share.share({ files: [uri], title }).catch(() => null);
  return true;
}

let speaking = false;

/** The device's own voice, in the app (a WebView has no speechSynthesis). Resolves when it has finished or was stopped. */
export async function speakNative(text: string, lang: string, rate: number) {
  const { TextToSpeech } = await import("@capacitor-community/text-to-speech");
  speaking = true;
  try {
    await TextToSpeech.speak({ text, lang, rate });
    return true;
  } catch {
    return false;
  } finally {
    speaking = false;
  }
}

export function stopSpeakingNative() {
  if (!speaking) return;
  void import("@capacitor-community/text-to-speech").then(({ TextToSpeech }) => TextToSpeech.stop().catch(() => null));
}

/** Back button: one step back in the app's history; from the first screen, leave the app in the background. */
export function initNative() {
  if (!isNative()) return;
  void import("@capacitor/app").then(({ App }) =>
    App.addListener("backButton", ({ canGoBack }) => {
      if (canGoBack) window.history.back();
      else void App.minimizeApp();
    }),
  );
}
