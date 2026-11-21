import { useState } from "react";
import { modelEssayFor } from "../lib/essay-models";

/**
 * 静态 B2+ 范文与逐段中文点评组件（无需 AI Key 即可查看；挂载于 Essay.tsx 与四项模考 PE 复盘）。
 */
export function StaticEssayModel({ taskId, defaultOpen = false }: { taskId: string; defaultOpen?: boolean }) {
  const model = modelEssayFor(taskId);
  const [open, setOpen] = useState(defaultOpen);
  const [showNotes, setShowNotes] = useState(true);
  if (!model) return null;

  return (
    <div className="essay-box essay-model">
      <div className="panel-head">
        <p className="eyebrow">
          静态 {model.level} 参考范文（{model.wordCount} 词 · 免 AI · 待核对）
        </p>
        <div className="exam-doc-actions">
          {open && (
            <button className="link" onClick={() => setShowNotes((v) => !v)}>
              {showNotes ? "只看纯法语范文" : "展开逐段中文点评"}
            </button>
          )}
          <button className="link" onClick={() => setOpen((v) => !v)}>
            {open ? "收起范文" : "对照 B2+ 静态范文与点评"}
          </button>
        </div>
      </div>

      {open && (
        <>
          <div className="essay-model-paras">
            {model.paragraphs.map((p, i) => (
              <div key={i} className="essay-model-para">
                <p className="essay-text" lang="fr">
                  {p.fr}
                </p>
                {showNotes && (
                  <p className="muted small">
                    {p.technique && <b>[{p.technique}] </b>}
                    {p.zhNote}
                  </p>
                )}
              </div>
            ))}
          </div>
          {model.patterns.length > 0 && (
            <>
              <p className="eyebrow">可借用的高分句型</p>
              <ul className="essay-phrases">
                {model.patterns.map((p, k) => (
                  <li key={k}>
                    <span lang="fr">{p.fr}</span>
                    <small>{p.zh}</small>
                  </li>
                ))}
              </ul>
            </>
          )}
          <p className="muted small">提示：本范文及点评为站点自编示例（待核对），先独立成文再逐段对照，效果最好。</p>
        </>
      )}
    </div>
  );
}
