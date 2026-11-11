#!/usr/bin/env python3
"""Generate current lexicon statistics from data/lexicon.json so the docs never
carry hand-copied numbers. Writes data/STATS.md and data/STATS.json."""
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LEX = os.path.join(ROOT, "data/lexicon.json")


def main():
    entries = json.load(open(LEX, encoding="utf-8"))["entries"]
    visible = [e for e in entries if not e.get("aliasOf")]

    def glossed(e):
        return any(s.get("zh", "").strip() for s in e.get("senses", []))

    learnable = [e for e in visible if glossed(e)]
    examples = [(e, x) for e in learnable for x in e.get("examples", [])]
    ex_zh = [x for _, x in examples if x.get("zh", "").strip()]
    stats = {
        "total_entries": len(entries),
        "visible_entries": len(visible),
        "aliases": len(entries) - len(visible),
        "learnable": len(learnable),
        "visible_without_gloss": sum(1 for e in visible if not glossed(e)),
        "learnable_without_example": sum(1 for e in learnable if not e.get("examples")),
        "examples_total": len(examples),
        "examples_with_zh": len(ex_zh),
        "examples_missing_zh": len(examples) - len(ex_zh),
        "learnable_pos_pending": sum(1 for e in learnable if e["pos"] == "待核实"),
        "learnable_generic_noun": sum(1 for e in learnable if e["pos"] == "n."),
        "review_unreviewed": sum(1 for e in entries if e.get("review") == "unreviewed"),
    }
    lines = ["# 词库统计（由 scripts/report-stats.py 生成，勿手工编辑）", ""]
    labels = {
        "total_entries": "总记录", "visible_entries": "可见词条", "aliases": "别名",
        "learnable": "可学习词条", "visible_without_gloss": "可见但缺释义",
        "learnable_without_example": "可学习但缺例句", "examples_total": "例句总数",
        "examples_with_zh": "例句有中文翻译", "examples_missing_zh": "例句缺中文翻译",
        "learnable_pos_pending": "可学习词性待核实", "learnable_generic_noun": "可学习名词阴阳性待核实",
        "review_unreviewed": "review=unreviewed",
    }
    for k, label in labels.items():
        lines.append(f"- {label}：{stats[k]}")
    lines.append("")
    lines.append("说明：可学习 = 有中文释义的可见词条；释义与例句的补充翻译状态仍为「补充翻译·待核对」，")
    lines.append("review=unreviewed 表示尚未逐条人工核对，自动处理不等同于人工确认。")
    open(os.path.join(ROOT, "data/STATS.md"), "w", encoding="utf-8").write("\n".join(lines) + "\n")
    json.dump(stats, open(os.path.join(ROOT, "data/STATS.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(json.dumps(stats, ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main()
