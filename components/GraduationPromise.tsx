"use client";

import type { Lang } from "./LangToggle";

export default function GraduationPromise({ lang }: { lang: Lang }) {
  const t =
    lang === "ja"
      ? {
          title: "卒業できるAI",
          lead:
            "HOPYは、あなたを依存させません。最終的に「もう大丈夫」と言える地点へ連れていくための道具です。",
          p1: "ゴールは、あなたが自分の力で進めること。",
          p2: "だから、いつか“課金を終わらせられる”安心を最初に渡します。",
          p3: "卒業は終わりじゃない。新しいテーマで、また成長したくなったら戻ってくればいい。",
          chips: ["安心の約束", "依存させない", "成長の証拠が残る"],
          foot: "Text fades. Structure remains.",
        }
      : {
          title: "An AI you can graduate from",
          lead:
            "HOPY won’t make you dependent. It’s a tool to help you reach a point where you can say: “I’ve got this.”",
          p1: "The goal is your independence.",
          p2: "So we give you something rare on day one: the peace of knowing you can end the subscription someday.",
          p3: "Graduation isn’t an ending. Come back only when a new season of growth calls you.",
          chips: ["A promise of safety", "No dependency", "Proof of growth"],
          foot: "Text fades. Structure remains.",
        };

  return (
    <section className="grad">
      <div className="grad-card">
        <div className="grad-top">
          <div className="grad-kicker">{t.title}</div>
          <div className="grad-chips">
            {t.chips.map((x) => (
              <span key={x} className="grad-chip">
                {x}
              </span>
            ))}
          </div>
        </div>

        <p className="grad-lead">{t.lead}</p>

        <div className="grad-body">
          <p className="grad-p">{t.p1}</p>
          <p className="grad-p">{t.p2}</p>
          <p className="grad-p">{t.p3}</p>
        </div>

        <div className="grad-foot">{t.foot}</div>
      </div>
    </section>
  );
}
