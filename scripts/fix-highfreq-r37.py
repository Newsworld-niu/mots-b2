"""r37: content pass over the 1000 most frequent visible entries (Lexique 3.83 order).

1. Examples for the high-frequency entries that had none (hand-written, origin=supplement).
2. Topic: the core vocabulary got its topic from whichever textbook chapter listed it first
   (avoir -> 环境与气候). Top 300 words and every function/verb word in the top 1000 move to the
   new "daily" topic (日常基础).
3. Glosses: "（phrase 中文）" parentheticals are lifted out of the gloss into col ("phrase｜中文").
Idempotent. Writes data/lexicon.json and output/r37-highfreq-log.csv.
"""
import csv, json, os, re, unicodedata

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LEX = os.path.join(ROOT, "data/lexicon.json")
LOG = os.path.join(ROOT, "output/r37-highfreq-log.csv")

# id -> [(fr, zh), ...]; ids are the lexicon's (some keep OCR damage, ids never change)
EX = {
    "etre": [("Elle est étudiante à Lyon.", "她是里昂的学生。"), ("Nous sommes en retard.", "我们迟到了。")],
    "et": [("Je prends un café et un croissant.", "我要一杯咖啡和一个羊角面包。")],
    "avoir": [("J'ai deux frères et une sœur.", "我有两个兄弟和一个姐妹。"), ("Tu as faim ?", "你饿吗？")],
    "ca": [("Ça va bien, merci !", "挺好的，谢谢！")],
    "vouloir": [("Je veux apprendre le français.", "我想学法语。")],
    "voudrais": [("Je voudrais un billet pour Lyon.", "我想要一张去里昂的票。")],
    "tout-": [("Tout le monde est arrivé.", "大家都到了。"), ("Elle a tout compris.", "她全明白了。"), ("Il est tout content.", "他非常高兴。")],
    "ou": [("Où habites-tu ?", "你住在哪里？")],
    "si-conj": [("Si tu veux, on sort ce soir.", "如果你愿意，我们今晚出去。")],
    "connaltre": [("Tu connais ce restaurant ?", "你知道这家餐厅吗？")],
    "mere": [("Ma mère travaille dans un hôpital.", "我妈妈在医院工作。")],
    "sentir": [("Ça sent bon dans la cuisine.", "厨房里闻起来很香。")],
    "mom-ent": [("Un moment, s'il vous plaît.", "请稍等一下。")],
    "travai-iler": [("Il travaille dans une banque.", "他在银行工作。")],
    "beire": [("Elle boit un verre d'eau.", "她喝了一杯水。")],
    "il-faut": [("Il faut partir tout de suite.", "必须马上出发。")],
    "parattre": [("Il paraît fatigué ce matin.", "他今天早上看起来很累。")],
    "il-n-y-a-pas-de-quoi": [("Merci beaucoup ! — Il n'y a pas de quoi.", "多谢！——不客气。")],
    "valoir": [("Ce film vaut la peine d'être vu.", "这部电影值得一看。")],
    "battre": [("Mon cœur bat très vite.", "我的心跳得很快。")],
    "soeur-f": [("Ma sœur aînée habite à Paris.", "我姐姐住在巴黎。")],
    "mettre-en-avant": [("L'entreprise met en avant la qualité de ses produits.", "公司突出强调产品的质量。")],
    "reveiller": [("Je me réveille à sept heures.", "我七点醒来。")],
    "souven-r-m": [("Ce voyage reste un très beau souvenir.", "那次旅行是一段很美好的回忆。")],
    "avoir-mal-a-la-tete": [("J'ai mal à la tête depuis ce matin.", "我从今天早上起就头疼。")],
    "or": [("Cette bague est en or.", "这枚戒指是金的。"), ("Il pensait réussir ; or, il a échoué.", "他以为会成功，然而却失败了。")],
    "nu": [("Les enfants marchent pieds nus sur la plage.", "孩子们光着脚在沙滩上走。")],
    "avoir-besoin-d-argent": [("J'ai besoin d'argent pour payer le loyer.", "我需要钱付房租。")],
    "avoir-mal-au-coeur": [("En bateau, j'ai souvent mal au cœur.", "坐船时我常常想吐。")],
    "par-cceur": [("Il faut apprendre ce poème par cœur.", "这首诗要背下来。")],
    "apprendre-a": [("J'apprends à nager.", "我在学游泳。")],
    "apprendre-a-faire": [("Elle apprend à conduire.", "她在学开车。")],
    "neuf": [("Ce téléphone est tout neuf.", "这部手机是全新的。")],
    "s-il-te-plait": [("Passe-moi le sel, s'il te plaît.", "请把盐递给我。")],
    "s-il-vous-plait": [("Un café, s'il vous plaît.", "请来一杯咖啡。")],
    "diner-": [("Le dîner est prêt.", "晚饭好了。"), ("Nous dînons à huit heures.", "我们八点吃晚饭。")],
    "entrarner": [("Il s'entraîne tous les soirs.", "他每天晚上训练。")],
    "corai": [("Bon courage pour tes examens !", "考试加油！")],
    "ceuvre": [("Cette œuvre est exposée au Louvre.", "这件作品陈列在卢浮宫。")],
    "acheter-en-gros": [("Ce restaurant achète ses légumes en gros.", "这家餐厅批量采购蔬菜。")],
}

FUNC_POS = {"v.", "adv.", "prép.", "conj.", "pron.", "interj.", "loc. adv."}
PAREN = re.compile(r"^(.*?)（([A-Za-zÀ-ÿœŒ’' .\-]+?)\s+([一-鿿][^（）]*)）$")


def fold(s):
    s = unicodedata.normalize("NFD", s).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z]+", " ", s).strip()


def main():
    lex = json.load(open(LEX, encoding="utf-8"))
    entries = lex["entries"]
    by = {e["id"]: e for e in entries}
    freq = json.load(open(os.path.join(ROOT, "data/frequency.json"), encoding="utf-8"))["entries"]
    index = json.load(open(os.path.join(ROOT, "public/atlas/index.json"), encoding="utf-8"))
    visible = {w[0] for w in index["words"]}
    top = sorted((i for i in freq if i in visible and i in by), key=lambda i: -freq[i]["f"])[:1000]
    log = []

    for i, exs in EX.items():
        e = by[i]
        if e["examples"]:
            continue
        e["examples"] = [{"fr": fr, "zh": zh, "origin": "supplement"} for fr, zh in exs]
        log.append((i, "example", "", f"{len(exs)} added"))

    for rank, i in enumerate(top):
        e = by[i]
        want = "daily" if rank < 300 or e["pos"] in FUNC_POS else None
        if want and e["topic"] != want:
            log.append((i, "topic", e["topic"], want))
            e["topic"] = want
        for s in e["senses"]:
            m = PAREN.match(s.get("zh", ""))
            if not m:
                continue
            base, phrase, zh = m.group(1).rstrip(), m.group(2).strip(), m.group(3).strip()
            if not base:
                continue
            old = s["zh"]
            s["zh"] = base
            if fold(phrase) != fold(e["lemma"]):
                line = f"{phrase}｜{zh}"
                if not any(c.split("｜")[0] == phrase for c in e["col"]):
                    e["col"].append(line)
            log.append((i, "gloss", old, f"{base} | col: {phrase}｜{zh}"))

    json.dump(lex, open(LEX, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    open(LEX, "a").write("\n")
    os.makedirs(os.path.dirname(LOG), exist_ok=True)
    with open(LOG, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["id", "kind", "before", "after"])
        w.writerows(log)
    kinds = {}
    for _, k, _, _ in log:
        kinds[k] = kinds.get(k, 0) + 1
    print(kinds)


main()
