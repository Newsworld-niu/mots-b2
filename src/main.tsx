import "@fontsource-variable/fraunces/opsz.css";
import "@fontsource-variable/fraunces/opsz-italic.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { DATASET_ID } from "./config";
import { migrateLegacy } from "./store/legacy";
import "./styles/app.css";

// Carry over progress from the first prototype before the store reads it.
migrateLegacy(localStorage, DATASET_ID, "word-atlas:settings", (id) => `word-atlas:v2:${id}`);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => null);
  });
}
