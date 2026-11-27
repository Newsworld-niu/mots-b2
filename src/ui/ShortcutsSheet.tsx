import { isApplePlatform } from "./nav";
import { Sheet } from "./Sheet";

interface Shortcut {
  keys: string[][];
  what: string;
}

function groups(apple: boolean): { title: string; items: Shortcut[] }[] {
  const mod = apple ? "⌘" : "Ctrl";
  return [
    {
      title: "全局",
      items: [
        { keys: [[mod, "K"], ["/"]], what: "全局查词与跳转" },
        { keys: [["?"]], what: "打开这份快捷键帮助" },
        { keys: [["Esc"]], what: "逐层关闭弹窗" },
        { keys: [["←"], ["→"]], what: "词条弹窗里切换上一个 / 下一个词卡" },
      ],
    },
    {
      title: "背词与练习",
      items: [
        { keys: [["1"], ["2"], ["3"], ["4"]], what: "选择对应的答案" },
        { keys: [["Enter"]], what: "确认答案 / 下一题" },
        { keys: [["Space"]], what: "翻开词卡 / 播放发音（按页面提示）" },
      ],
    },
  ];
}

/** The keyboard shortcuts of the app, opened with "?" or from the sidebar. */
export function ShortcutsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const list = groups(isApplePlatform());
  return (
    <Sheet open={open} onClose={onClose} label="键盘快捷键" className="shortcuts-sheet">
      <h2 className="sheet-title">键盘快捷键</h2>
      <p className="shortcuts-lede">输入框里不触发；背词时专注模式优先使用页面内按键。</p>
      {list.map((g) => (
        <section key={g.title} className="shortcuts-group" aria-label={g.title}>
          <h3>{g.title}</h3>
          <dl>
            {g.items.map((s) => (
              <div key={s.what} className="shortcuts-row">
                <dt>
                  {s.keys.map((combo, i) => (
                    <span key={i} className="shortcuts-combo">
                      {i > 0 && <span className="shortcuts-or">或</span>}
                      {combo.map((k, j) => (
                        <kbd key={j}>{k}</kbd>
                      ))}
                    </span>
                  ))}
                </dt>
                <dd>{s.what}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </Sheet>
  );
}
