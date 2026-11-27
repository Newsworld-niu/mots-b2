import { useRef, type Dispatch, type SetStateAction } from "react";
import { CRITERION_CHECK, CRITERION_LABEL, LEVEL_LABEL, LEVELS, totalScore } from "../../lib/essay";
import { clock, SPEAK_CRITERIA, type DebateTurn, type SpeakingFeedback, type SpeakingSubject } from "../../lib/exam";
import type { SpeakingSession } from "../../lib/exam-schema";
import type { PronResult } from "../../lib/pronunciation";
import type { Take } from "../../lib/recorder";
import type { speakingPresetOf } from "../../lib/speaking-presets";
import { Marking } from "../../ui/Marking";
import { AssessedTranscript, PronReport, sttName, TakePlayer } from "../../ui/Recording";

function DebateTurnItem({
  index,
  turn,
  take,
  pron,
  fallbackEmpty,
}: {
  index: number;
  turn: DebateTurn;
  take?: Take;
  pron?: PronResult;
  fallbackEmpty: string;
}) {
  const turnAudioRef = useRef<HTMLAudioElement | null>(null);
  return (
    <li>
      <p className="exam-q" lang="fr">
        {turn.q}
      </p>
      {pron && pron.words.length > 0 ? (
        <AssessedTranscript result={pron} audioRef={take ? turnAudioRef : undefined} compact />
      ) : (
        <p className="essay-text" lang="fr">
          {turn.a || fallbackEmpty}
        </p>
      )}
      <TakePlayer take={take} label={`听第 ${index + 1} 轮回答`} audioRef={turnAudioRef} />
    </li>
  );
}

export interface SpeakingResultProps {
  subject: SpeakingSubject;
  preset: ReturnType<typeof speakingPresetOf>;
  fb: SpeakingFeedback | null;
  pointTitle: Map<string, string>;
  retellBase: SpeakingSession | null;
  words: number;
  spoke: number;
  talkTake: Take | null;
  talkPron?: PronResult | null;
  turns: DebateTurn[];
  turnTakes: Record<number, Take>;
  turnProns: Record<number, PronResult>;
  said: string;
  combinedPron: PronResult | null;
  azurePhono: number | null;
  phono: number | null;
  gradedTyped: boolean;
  onSelectPhono: (v: number) => void;
  offlineSelf: Record<string, number | null>;
  setOfflineSelf: Dispatch<SetStateAction<Record<string, number | null>>>;
  offlineLogged: boolean;
  onSaveOffline: (sum25: number) => void;
  onRetrySubject: () => void;
}

export function SpeakingResult({
  subject,
  preset,
  fb,
  pointTitle,
  retellBase,
  words,
  spoke,
  talkTake,
  talkPron,
  turns,
  turnTakes,
  turnProns,
  said,
  combinedPron,
  azurePhono,
  phono,
  gradedTyped,
  onSelectPhono,
  offlineSelf,
  setOfflineSelf,
  offlineLogged,
  onSaveOffline,
  onRetrySubject,
}: SpeakingResultProps) {
  const monoAudioRef = useRef<HTMLAudioElement | null>(null);

  if (fb) {
    const turnPronCount = Object.keys(turnProns).length;
    return (
      <>
        {retellBase && (
          <div className="essay-box speak-retell-diff" role="region" aria-label="同题二稿重说对比">
            <p className="eyebrow">同题迭代对比（第 {retellBase.draft ?? 1} 稿 → 本次）</p>
            <p className="small">
              总分：{retellBase.total25 ?? "—"} → <b>{(azurePhono ?? phono) !== null ? totalScore(fb) + (azurePhono ?? phono ?? 0) : `${totalScore(fb)}/20`}</b> ·
              独白词数：{retellBase.monologueWords} → <b>{words}</b> 词 ·
              用时：{clock(retellBase.monologueSec)} → <b>{clock(Math.max(spoke, talkTake?.seconds ?? 0))}</b>
            </p>
            {retellBase.pron && combinedPron && (
              <p className="small muted">
                准确度 {retellBase.pron.accuracy ?? "—"}→{combinedPron.accuracy ?? "—"} · 流利度 {retellBase.pron.fluency ?? "—"}→{combinedPron.fluency ?? "—"} · 韵律 {retellBase.pron.prosody ?? "—"}→{combinedPron.prosody ?? "—"}
              </p>
            )}
          </div>
        )}
        <Marking fb={fb} pointTitle={pointTitle} from={`口语 · ${subject.title}`} extra={{ key: "phono", score: azurePhono ?? phono }} />
        {(azurePhono ?? phono) === null && (
          <p className="muted small">
            当前为「不含发音 20 分制」（未按比例折算 25 分，也不会混入 25 分制曲线）；完成下方第 5 项发音自评后计入 25 分总分。
          </p>
        )}
        {gradedTyped && <p className="muted small">本次练习含纯键盘输入，已标记为「打字」，不计入 25 分口语成绩曲线。</p>}
        <TakePlayer take={talkTake} label="听自己的独白（点击下方任意词可跳至此播放器对应秒数）" audioRef={monoAudioRef} />
        {combinedPron && (
          <PronReport
            result={combinedPron}
            audioRef={talkTake ? monoAudioRef : undefined}
            seekResult={talkPron ?? combinedPron}
            title={
              combinedPron.phonemeSupported === false
                ? `语音流利度与逐词时间戳（${sttName()}）`
                : turnPronCount
                  ? `发音和语调（第五项，独白 + 辩论 ${turnPronCount} 轮加权）`
                  : "发音和语调（第五项，Azure 评测）"
            }
          />
        )}
        {azurePhono === null && (
          <div className="essay-box">
            <p className="eyebrow">发音和语调：自己评（第五项，AI 听不到）</p>
            <p className="muted small">{CRITERION_CHECK.phono} 官方标准：低于 B2 是「大体听得懂，语调和重音还有不自然」；B2 是「语调、重音、发音清楚，偶尔的问题不影响交流」；B2+ 是「能变化语调来表达意思，能自己纠正」。</p>
            <div className="segmented">
              {LEVELS.map((v) => (
                <button key={v} className={phono === v ? "is-on" : ""} onClick={() => onSelectPhono(v)} aria-pressed={phono === v}>
                  {v} · {LEVEL_LABEL[v]}
                </button>
              ))}
            </div>
          </div>
        )}
        {turns.some((t, idx) => t.a.trim() || !!turnTakes[idx]) && (
          <div className="essay-box">
            <p className="eyebrow">辩论逐轮回放与定位</p>
            <ol className="exam-debate">
              {turns.map((t, k) => (
                <DebateTurnItem
                  key={k}
                  index={k}
                  turn={t}
                  take={turnTakes[k]}
                  pron={turnProns[k]}
                  fallbackEmpty="（没有回答）"
                />
              ))}
            </ol>
          </div>
        )}
        <div className="essay-cols">
          <div className="essay-box">
            <p className="eyebrow">你的独白（{words} 词）</p>
            {talkPron && talkPron.words.length > 0 ? (
              <AssessedTranscript result={talkPron} audioRef={talkTake ? monoAudioRef : undefined} compact />
            ) : (
              <p className="essay-text" lang="fr">
                {said}
              </p>
            )}
          </div>
          {fb.rewrite && (
            <div className="essay-box">
              <p className="eyebrow">可以这样说</p>
              <p className="essay-text" lang="fr">
                {fb.rewrite}
              </p>
            </div>
          )}
        </div>
        <p className="muted small">AI 依据原话转写与声学指标综合评判；真正的考试由两位考官现场评分。</p>
        <div className="writing-actions">
          <button className="btn btn-primary" onClick={onRetrySubject}>
            同一题再说一遍
          </button>
        </div>
      </>
    );
  }

  const allKeys = [...SPEAK_CRITERIA, "phono"] as const;
  const resolvedSelf = Object.fromEntries(
    allKeys.map((k) => [k, k === "phono" && azurePhono !== null ? azurePhono : offlineSelf[k]]),
  ) as Record<string, number | null>;
  const complete = allKeys.every((k) => resolvedSelf[k] !== null);
  const sum25 = Math.round(allKeys.reduce((n, k) => n + (resolvedSelf[k] ?? 0), 0) * 10) / 10;
  return (
    <>
      <div className="essay-box">
        <p className="eyebrow">无 AI 离线参考 · 对照核心问题与五项自评</p>
        {preset ? (
          <>
            <p lang="fr">
              <b>Problématique（参考，待核对）：</b> {preset.problematique}
            </p>
            <ol className="essay-plan">
              {preset.outline.map((o, i) => (
                <li key={i}>
                  <b>{o.zh}</b>
                  <span lang="fr">{o.fr}</span>
                </li>
              ))}
            </ol>
          </>
        ) : (
          <p className="muted small">本题暂无预置提纲，请对照下方 DELF B2 官方五项量表自评。</p>
        )}
      </div>

      <TakePlayer take={talkTake} label="听自己的独白" audioRef={monoAudioRef} />
      {combinedPron && (
        <PronReport
          result={combinedPron}
          audioRef={talkTake ? monoAudioRef : undefined}
          seekResult={talkPron ?? combinedPron}
          title={combinedPron.phonemeSupported === false ? `语音流利度与逐词时间戳（${sttName()}）` : "发音和语调（Azure 评测）"}
        />
      )}

      {said.trim() && (
        <div className="essay-box">
          <p className="eyebrow">你的独白（{words} 词）</p>
          {talkPron && talkPron.words.length > 0 ? (
            <AssessedTranscript result={talkPron} audioRef={talkTake ? monoAudioRef : undefined} compact />
          ) : (
            <p className="essay-text" lang="fr">
              {said}
            </p>
          )}
        </div>
      )}

      {turns.some((t, idx) => t.a.trim() || !!turnTakes[idx]) && (
        <div className="essay-box">
          <p className="eyebrow">辩论记录</p>
          <ol className="exam-debate">
            {turns.map((t, k) => (
              <DebateTurnItem
                key={k}
                index={k}
                turn={t}
                take={turnTakes[k]}
                pron={turnProns[k]}
                fallbackEmpty="（已口头回答）"
              />
            ))}
          </ol>
        </div>
      )}

      <div className="essay-box">
        <p className="eyebrow">官方五项口语自评（{complete ? `合计 ${sum25}/25` : "请先逐项选择 0–5"}）</p>
        {allKeys.map((c) => {
          const lockedAzure = c === "phono" && azurePhono !== null;
          return (
            <div key={c} className="mock-rubric-row">
              <div>
                <b>{CRITERION_LABEL[c]}</b>
                <p className="muted small">
                  {CRITERION_CHECK[c]}
                  {lockedAzure ? `（已由 Azure 发音评测自动判定：${azurePhono}/5）` : ""}
                </p>
              </div>
              <div className="segmented">
                {LEVELS.map((v) => (
                  <button
                    key={v}
                    type="button"
                    disabled={lockedAzure || offlineLogged}
                    className={resolvedSelf[c] === v || (lockedAzure && Math.round(azurePhono ?? -1) === v) ? "is-on" : ""}
                    aria-pressed={resolvedSelf[c] === v}
                    onClick={() => setOfflineSelf((cur) => ({ ...cur, [c]: v }))}
                  >
                    {v} · {LEVEL_LABEL[v]}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="writing-actions">
        <button
          className="btn btn-primary btn-xl"
          disabled={!complete || offlineLogged}
          onClick={() => onSaveOffline(sum25)}
        >
          {offlineLogged ? `已记录本次成绩（${sum25}/25）` : `保存本次口语自评成绩（${complete ? `${sum25}/25` : "待选全"}）`}
        </button>
        <button className="btn btn-ghost" onClick={onRetrySubject}>
          同一题再说一遍
        </button>
      </div>
    </>
  );
}
