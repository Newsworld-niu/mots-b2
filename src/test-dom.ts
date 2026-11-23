import { Window } from "happy-dom";

const win = new Window({ url: "http://127.0.0.1:5191/#/" });

const props: Record<string, unknown> = {
  window: win,
  document: win.document,
  navigator: win.navigator,
  HTMLElement: win.HTMLElement,
  Element: win.Element,
  Node: win.Node,
  Text: win.Text,
  DocumentFragment: win.DocumentFragment,
  HTMLInputElement: win.HTMLInputElement,
  HTMLButtonElement: win.HTMLButtonElement,
  Event: win.Event,
  CustomEvent: win.CustomEvent,
  MouseEvent: win.MouseEvent,
  KeyboardEvent: win.KeyboardEvent,
  MutationObserver: win.MutationObserver,
  getComputedStyle: win.getComputedStyle.bind(win),
  localStorage: win.localStorage,
  sessionStorage: win.sessionStorage,
  requestAnimationFrame: (cb: (time: number) => void) => setTimeout(() => cb(Date.now()), 0),
  cancelAnimationFrame: (id: ReturnType<typeof setTimeout>) => clearTimeout(id),
};

for (const [k, v] of Object.entries(props)) {
  Object.defineProperty(globalThis, k, {
    value: v,
    configurable: true,
    writable: true,
  });
}

export { win as testWindow };

export function resetTestDom(): void {
  win.document.body.innerHTML = "";
  win.document.head.innerHTML = "";
  win.localStorage.clear();
  win.sessionStorage.clear();
}
