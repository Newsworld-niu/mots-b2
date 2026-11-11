#!/usr/bin/env python3
"""r31 supplement-example batch 1: add a natural French example + Chinese translation
to learnable entries that have none. Examples are clearly marked origin=supplement and
the entry note records that they were written for this site (not from the textbook).
Idempotent: skips entries that already have examples."""
import csv
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LEX = os.path.join(ROOT, "data/lexicon.json")
LOG = os.path.join(ROOT, "output/r31-examples-supplement-batch1.csv")

EX = {
 "achever": ("Elle achève son mémoire ce mois-ci.", "她这个月完成她的论文。"),
 "affiche": ("Il y a une affiche du concert sur le mur.", "墙上有一张音乐会的海报。"),
 "afficher": ("Le magasin affiche les nouveaux prix.", "商店张贴出新的价格。"),
 "affirmer": ("Il affirme avoir vu l'accident.", "他声称看到了那起事故。"),
 "agacer": ("Ce bruit m'agace.", "这噪音让我恼火。"),
 "aggraver": ("La pollution aggrave la maladie.", "污染使病情恶化。"),
 "admettre": ("Il admet son erreur.", "他承认了自己的错误。"),
 "accelerer": ("Il faut accélérer le rythme.", "必须加快节奏。"),
 "ajouter": ("Ajoutez un peu de sel.", "加一点盐。"),
 "annonce": ("J'ai lu une annonce pour un appartement.", "我读到了一则公寓出租广告。"),
 "arreter": ("La police arrête le suspect.", "警察逮捕了嫌疑人。"),
 "allocation": ("Elle reçoit une allocation chômage.", "她领取失业补助金。"),
 "apprecier": ("J'apprécie beaucoup ce restaurant.", "我很喜欢这家餐厅。"),
 "assemblee": ("L'Assemblée nationale vote la loi.", "国民议会表决通过这项法律。"),
 "approfondir": ("Il faut approfondir cette question.", "必须深入研究这个问题。"),
 "aptitude": ("Elle a une aptitude pour les langues.", "她有语言方面的天赋。"),
 "assurer": ("Il assure la sécurité du bâtiment.", "他负责大楼的安全。"),
 "atteindre": ("Nous atteindrons Paris à midi.", "我们中午抵达巴黎。"),
 "baisser": ("Les prix baissent en hiver.", "冬天价格下降。"),
 "attitude": ("Son attitude m'étonne.", "他的态度让我惊讶。"),
 "attribuer": ("On lui attribue le premier prix.", "人们授予他一等奖。"),
 "augmenter": ("Le salaire augmente chaque année.", "工资每年都在增长。"),
 "blessure": ("Il soigne une blessure au bras.", "他处理手臂上的伤口。"),
 "avancee": ("C'est une avancée scientifique.", "这是一项科学进展。"),
 "avancer": ("Le projet avance bien.", "项目进展顺利。"),
 "bouche": ("Il a la bouche sèche.", "他口干。"),
 "bouton": ("Appuie sur le bouton rouge.", "按一下红色按钮。"),
 "bras": ("Elle porte un sac sur le bras.", "她手臂上挎着一个包。"),
 "camera": ("Le journaliste filme avec une caméra.", "记者用摄像机拍摄。"),
 "briller": ("Les étoiles brillent dans le ciel.", "星星在天空中闪耀。"),
 "chasse": ("La chasse est interdite ici.", "这里禁止打猎。"),
 "chercheur": ("Ce chercheur travaille sur le climat.", "这位研究员研究气候。"),
 "cite": ("Il habite dans une cité en banlieue.", "他住在郊区的住宅区。"),
 "comedie": ("On regarde une comédie ce soir.", "今晚我们看一部喜剧。"),
 "cheveu": ("Elle a un cheveu blanc.", "她有一根白头发。"),
 "affaire": ("Range tes affaires.", "收拾好你的东西。"),
 "abordable": ("Ce prix est abordable.", "这个价格很实惠。"),
 "aigu": ("Il a une douleur aiguë.", "他有剧烈的疼痛。"),
 "antibiotique": ("Le médecin prescrit un antibiotique.", "医生开了抗生素。"),
 "cachet": ("Prenez un cachet après le repas.", "饭后吃一片药。"),
}


def main():
    lex = json.load(open(LEX, encoding="utf-8"))
    by_id = {e["id"]: e for e in lex["entries"]}
    log = []
    applied = 0
    for eid, (fr, zh) in EX.items():
        e = by_id.get(eid)
        if not e:
            log.append({"id": eid, "action": "skipped", "reason": "missing"}); continue
        if e.get("examples"):
            log.append({"id": eid, "action": "skipped", "reason": "already has example"}); continue
        e["examples"] = [{"fr": fr, "zh": zh, "origin": "supplement"}]
        e["note"] = ((e.get("note") or "") + ("；" if (e.get("note") or "").strip() else "") +
                     "r31 例句为本站补充（教材无对应例句），译文同为补充。").strip()
        applied += 1
        log.append({"id": eid, "action": "example-added", "reason": fr})
    json.dump(lex, open(LEX, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    with open(LOG, "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=["id", "action", "reason"]); w.writeheader(); w.writerows(log)
    print("examples added:", applied, "of", len(EX))


if __name__ == "__main__":
    main()
