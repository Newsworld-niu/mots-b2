import "@fontsource-variable/fraunces/opsz.css";
import "@fontsource-variable/fraunces/opsz-italic.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { DATASET_ID } from "./config";
import { initNative, isNative } from "./lib/native";
import { migrateLegacy } from "./store/legacy";
import { ErrorBoundary } from "./ui/ErrorBoundary";
import "./styles/app.css";

// Carry over progress from the first prototype before the store reads it.
migrateLegacy(localStorage, DATASET_ID, "word-atlas:settings", (id) => `word-atlas:v2:${id}`);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);

initNative();

// The app ships every file inside the package: no offline cache needed, and a stale one would outlive an update.
if (import.meta.env.PROD && !isNative() && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => null);
  });
}
