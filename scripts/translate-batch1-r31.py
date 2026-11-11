#!/usr/bin/env python3
"""Apply Chinese translations to existing French examples (r31 batch 1).
Keyed by (entry id, exact French text) so it is safe and idempotent. The French
sentence and its source are preserved; only `zh` is added."""
import json
import os
import csv

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LEX = os.path.join(ROOT, "data/lexicon.json")
LOG = os.path.join(ROOT, "output/r31-translations-batch1.csv")

T = {
 ("accuse", "Félix a les traits fins mais accusés (naturellement marqués)."): "费利克斯的五官清秀，但轮廓分明（天生如此）。",
 ("a-demi-mot", "- Non, pas vraiment, nous n'avons pas abordé le sujet, mais il en a parlé à demi-mot, sans vraiment le mentionner clairement."): "- 不，不完全是，我们没有谈这个话题，但他旁敲侧击地提到了，没有真正明确说出来。",
 ("a-l-improviste", "Xavier est arrivé à l'improviste, sans me prévenir."): "泽维尔突然来了，没有事先通知我。",
 ("affectif", "Manon est d'un naturel affectif, ses affections influencent ses réactions."): "玛侬天性重感情，她的情感会影响她的反应。",
 ("acier", "Pour être un bon médecin urgentiste, il faut avoir des nerfs d'acier."): "要成为一名优秀的急诊医生，必须有钢铁般的神经。",
 ("abattu", "Son père essaie de ne pas s'effondrer, il n'est pas complètement abattu (il fait des efforts pour réagir)."): "他的父亲努力不让自己崩溃，他并没有完全消沉（他在努力振作）。",
 ("acquisition", "Il gère aussi les acquisitions (les achats) d'œuvres sur le marché de l'art."): "他还负责艺术品市场上作品的收购（购买）。",
 ("acte", "» Ces actes de barbarie sont considérés comme des crimes contre l'humanité."): "» 这些野蛮行径被视为反人类罪。",
 ("affirmation", "L'affirmation du journaliste s'est révélée fausse."): "那名记者的说法被证明是假的。",
 ("actif", "Il est actif, vif, efficace."): "他积极、机敏、高效。",
 ("affolement", "Dans ce magasin, il y a eu un incendie qui a provoqué l'affolement des clients: ils se sont affolés, ils ont perdu la tête."): "这家商店发生了火灾，引起了顾客的恐慌：他们惊慌失措，失去了理智。",
 ("action", "Les Blancs mènent une action contre leurs adversaires."): "白人针对他们的对手采取行动。",
 ("affronter", "Il faut affronter les difficultés."): "必须直面困难。",
 ("activer", "Frédéric est toujours en train de s'activer: il ne peut pas rester sans rien faire."): "弗雷德里克总是在忙碌：他闲不下来。",
 ("absorbe", "Olivier, lui, est parfois distrait parce qu'il est absorbé par son travail."): "奥利维耶有时会走神，因为他专注于工作。",
 ("adequat", "En revanche, Myriam a posé une question tout à fait pertinente (intelligente et adéquate)."): "相反，米里亚姆提出了一个非常恰当的问题（聪明且贴切）。",
 ("accable", "Quand les surprises sont, hélas, tragiques, on peut être abattu, anéanti, atterré, accablé par une triste nouvelle."): "当意外消息不幸是悲剧性的时，人会被悲伤的消息压得消沉、崩溃、惊愕、不堪重负。",
 ("agite", "Le temps est très agité, il y a beaucoup de vent."): "天气非常恶劣，风很大。",
 ("admiration", "Valérie a écrit deux livres en un an: je l'admire, j'ai de l'admiration pour elle, je suis admiratif (-ive)."): "瓦莱丽一年写了两本书：我钦佩她，我对她怀有敬意，我很赞赏（她）。",
 ("accomplir", "Pour lui, ce sera un accomplissement, il va enfin accomplir son projet."): "对他来说，这将是一种成就，他终于要完成自己的计划了。",
 ("accomplissement", "Pour lui, ce sera un accomplissement, il va enfin accomplir son projet."): "对他来说，这将是一种成就，他终于要完成自己的计划了。",
 ("adn", "Les analyses de l'ADN permettront d'en savoir plus."): "DNA 分析将能揭示更多信息。",
 ("agrandissement", "L'agrandissement coûtera assez cher."): "放大照片会相当贵。",
 ("accroissement", "La population du pays s'accroît, l'accroissement de la population modifie la structure sociale du pays."): "这个国家的人口在增长，人口的增长改变了该国的社会结构。",
 ("agresseur", "L'agresseur a essayé de violer plusieurs femmes dans la région."): "袭击者试图在该地区强奸多名女性。",
 ("adverse", "Ce n'est pas facile si le gardien de but de l'équipe adverse est bon!"): "如果对方球队的守门员很出色，那可不容易！",
 ("argument", "Cependant, il faut bien reconnaître que Loïc n'a pas tort quand il avance des arguments financiers."): "然而，必须承认，卢瓦克提出财政方面的论据时并没有错。",
 ("aimer", "Remarque: Le verbe «aimer», utilisé seul, a le sens le plus fort quand on parle de relations personnelles."): "注意：动词「aimer」单独使用时，在谈个人关系时含义最强。",
 ("angoissant", "C'est vraiment angoissant."): "这真的很令人焦虑。",
 ("angoisse", "On dirait une scène de film d'angoisse."): "这像是一部惊悚片的场景。",
 ("album", "On peut classer les photos dans un album de photos, ou bien les faire agrandir."): "可以把照片放进相册里，或者放大它们。",
 ("armement", "Son nom apparaissait en effet comme intermédiaire dans des contrats d'armement et on le suspectait de corruption."): "他的名字确实作为中间人出现在军火合同中，人们怀疑他腐败。",
 ("alliance", "La bague de mariage s'appelle «une alliance», qui se porte à la main gauche."): "结婚戒指叫「une alliance」，戴在左手。",
 ("allie", "A peut s'allier avec C, C est un allié de A, C a conclu une alliance avec A."): "A 可以和 C 结盟，C 是 A 的盟友，C 与 A 缔结了联盟。",
 ("allier", "A peut s'allier avec C, C est un allié de A, C a conclu une alliance avec A."): "A 可以和 C 结盟，C 是 A 的盟友，C 与 A 缔结了联盟。",
 ("antipathie", "L'ANTIPATHIE Antoine déteste Augustin, il ne le porte pas dans son cœur."): "反感 安托万讨厌奥古斯丁，他打心底里不喜欢他。",
 ("antique", "Eve est spécialiste de l'Antiquité (égyptienne, grecque, romaine), elle s'occupe de l'art antique (égyptien, grec, romain)."): "夏娃是古代（埃及、希腊、罗马）专家，她研究古代艺术（埃及、希腊、罗马）。",
 ("allongement", "La durée de vie s'allonge, l'allongement de la durée de vie a des conséquences sur la société."): "寿命在延长，寿命的延长对社会有影响。",
 ("arrondi", "Je voudrais juste rafraîchir la coupe, raccourcir un peu les pointes: pas trop court derrière et un peu arrondi."): "我只想把发型修整一下，稍微剪短发梢：后面不要太短，稍微修圆。",
 ("anxieux", "Cet enfant a un tempérament anxieux."): "这个孩子性格焦虑。",
 ("arrosage", "Elle arrose le jardin avec un tuyau d'arrosage et les plantes en pot avec un arrosoir."): "她用浇水软管给花园浇水，用喷壶给盆栽浇水。",
 ("allure", "Un rien lui va, elle peut mettre n'importe quel vêtement, elle aura toujours de l'allure, de la classe."): "她穿什么都好看，随便哪件衣服，她总是风度翩翩、有气质。",
 ("appareil-photo", "Il emporte son appareil photo, car il prendra beaucoup de photos, bien sûr."): "他带上了相机，因为他当然会拍很多照片。",
 ("arrosoir", "Elle est avec un arrosoir."): "她拿着一个喷壶。",
 ("allusion", "Est-ce que Serge a fait allusion à son départ?"): "塞尔日提到过他离开的事吗？",
 ("amateur", "Le fils chante dans une chorale d'amateurs, mais il n'est pas chanteur professionnel."): "儿子在一个业余合唱团唱歌，但他不是职业歌手。",
 ("ambassadeur", "Un ambassadeur représente son pays."): "大使代表他的国家。",
 ("aspiration", "Il aspire à changer de travail, il a de grandes aspirations."): "他渴望换工作，他有很大的抱负。",
 ("ambigu-ite", "Il y a toujours de l'ambiguïté dans les réponses de Flore, ce n'est jamais clair."): "弗洛尔的回答总是含糊不清，从来都不明确。",
 ("assassinat", "1» dans l'assassinat de Mme Rabeau."): "……在拉博夫人被谋杀一案中。",
 ("amelioration", "La recherche scientifique contribue à l'amélioration de la santé, sa contribution est importante."): "科学研究有助于改善健康，它的贡献很重要。",
 ("ameliorer", "Les chercheurs développent des programmes pour améliorer les conditions sanitaires."): "研究人员制定项目以改善卫生条件。",
 ("apprehension", "Après cet incident, j'appréhende de conduire, j'ai des appréhensions, je ne me sens pas à l'aise."): "那次事件之后，我害怕开车，我有顾虑，感到不自在。",
 ("amener", "Gilles va amener sa femme à notre soirée et il va nous apporter le dessert."): "吉勒会带他妻子来参加我们的晚会，还会给我们带甜点。",
 ("amer", "Gaspard en veut à Benoît, il est amer et furieux contre Benoît."): "加斯帕尔对伯努瓦心怀怨恨，他既痛苦又愤怒。",
 ("apte", "Doté(e) d'un réel sens de la négociation, vous serez apte à traiter des dossiers délicats."): "具备真正的谈判意识，您将能够处理棘手的案件。",
 ("amitie", "Un(e) ami(e) m'a téléphoné (amitié)."): "一位朋友给我打了电话（友情）。",
 ("amnesique", "Je vais devenir amnésique!"): "我要失忆了！",
 ("aquarelle", "La peinture peut être à l'huile ou encore à l'eau pour faire une gouache ou une aquarelle."): "绘画可以用油画颜料，也可以用水彩，做成水粉画或水彩画。",
 ("amour", "«Je l'aime» (qui exprime l'amour) est plus fort que «je l'aime beaucoup» (grande affection) ou «je l'aime bien» (simple sympathie)."): "「Je l'aime」（表达爱）比「je l'aime beaucoup」（深厚的感情）或「je l'aime bien」（单纯的喜欢）更强烈。",
}


def main():
    lex = json.load(open(LEX, encoding="utf-8"))
    by_id = {e["id"]: e for e in lex["entries"]}
    applied = 0
    log = []
    for (eid, fr), zh in T.items():
        e = by_id.get(eid)
        if not e:
            log.append({"id": eid, "fr": fr[:40], "action": "skipped", "reason": "entry missing"})
            continue
        hit = False
        for x in e.get("examples", []):
            if x.get("fr") == fr and not x.get("zh", "").strip():
                x["zh"] = zh
                applied += 1
                hit = True
                log.append({"id": eid, "fr": fr[:40], "action": "translated", "reason": ""})
                break
        if not hit:
            log.append({"id": eid, "fr": fr[:40], "action": "skipped", "reason": "example not found or already translated"})
    json.dump(lex, open(LEX, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    with open(LOG, "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=["id", "fr", "action", "reason"])
        w.writeheader()
        w.writerows(log)
    print("translations applied:", applied, "of", len(T))


if __name__ == "__main__":
    main()
