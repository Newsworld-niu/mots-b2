import type { CompExercise, CompQuestion } from "./exam";
import type { RealSource } from "./listening";

export interface RealPreset extends RealSource {
  subtitle: string;
  tags: string[];
  words: number;
  pace?: "slow" | "native170";
  license?: string;
}

export const FEI_OFFICIAL_SAMPLES: { id: string; title: string; zh: string; url: string }[] = [
  {
    id: "fei-exemple-1",
    title: "FEI 官方样题 Exemple 1（新版结构：2 长 + 1 三段短听）",
    zh: "前往 FEI 官网打开「Exemples de sujets」展开 Exemple 1，保存 .mp3 与 Document candidat .pdf 后用下方本地导入即可按考场两遍限时盲听练习。",
    url: "https://www.france-education-international.fr/diplome/delf-tout-public/niveau-b2/exemples-sujets#exemples-de-sujets-dexamen",
  },
  {
    id: "fei-exemple-2",
    title: "FEI 官方样题 Exemple 2（传统大题格式）",
    zh: "保存 Exemple 2 音频（exercice1/2 .mp3）与 Document candidat / correcteur .pdf 后导入本地存储，附带参考答案对照。",
    url: "https://www.france-education-international.fr/diplome/delf-tout-public/niveau-b2/exemples-sujets#exemples-de-sujets-dexamen",
  },
];

/** Six bundled authentic RFI "Journal en français facile" episodes with full transcripts + 7-QCM B2 drills (待核对). */
export const PREBUILT_REAL_SOURCES: RealPreset[] = [
  {
    "id": "rfi-20261120",
    "presetId": "rfi-jff-20261120",
    "title": "RFI 简明法语新闻 · 2026-11-20｜乌克兰战争、欧盟关系、气候大会与社会议题",
    "subtitle": "Actualité internationale et société（约 10 分钟 · 1518 词文字稿）",
    "url": "materials/rfi/rfi-jff-20261120.mp3",
    "pdfUrl": "materials/rfi/rfi-jff-20261120.txt",
    "start": 0,
    "end": 0,
    "created": 1795190400000,
    "transcript": "Bienvenue sur RFI si vous nous rejoignez. Nous sommes le vendredi 20 novembre. Il est 17 heures à Paris, une heure de plus à Kiev.\n\nLe Journal en français facile.\n\nDiane Berger.\n\nLes enfants d'Ukraine devraient apprendre à lire ou à compter. Ils apprennent, à la place, à reconnaître le bruit des drones. C'est l'alerte lancée aujourd'hui par l'Unicef, alors que leur pays a subi, encore une fois, une série d'attaques russes meurtrières la nuit dernière.\n\nOn ira, également, dans ce journal à Bruxelles, où le Royaume-Uni et l'Union européenne célèbrent leur rapprochement. Ils viennent de conclure un nouvel accord, dix ans après le référendum du Brexit.\n\nEt puis les négociations patinent – elles traînent – à la COP31 sur le climat. Plusieurs pays africains se disent déçus du manque d'efforts des pays riches. C'est ceux qui ont le plus pollué qui doivent le plus nettoyer, disent-ils.\n\nC'est une pluie de 110 missiles et 400 drones qui est tombée sur l'Ukraine la nuit dernière. Il y a au moins neuf morts. Des ponts de Kiev – la capitale – ont, également, été touchés. La France exige, en réaction, une réunion urgente du Conseil de sécurité de l'ONU, car ça a été l'une des attaques les plus massives – les plus importantes – depuis le début de la guerre, lancée par la Russie il y a bientôt cinq ans. Des attaques qui touchent les enfants. Le nombre de victimes chez les plus jeunes est en hausse depuis le début de l'année, Jérémie Lanche.\n\nOui. D'après une porte-parole de l'Unicef, Louise Wateridge, 2026 n'est pas encore terminée que, déjà, on compte 20 % d'enfants tués en plus par rapport à l'an passé. +60 % en ce qui concerne les blessés. Un niveau de violence qu'on n'avait pas vu depuis le début de la guerre.\n\n« On n'a jamais eu autant de victimes enfants depuis presque quatre ans en Ukraine. Au moins 1 144 enfants ont été tués ou blessés entre janvier et octobre. C'est plus de trois enfants chaque jour. »\n\nPour l'Unicef, c'est la preuve que les drones et les missiles russes ciblent de plus en plus des endroits comme les écoles. La porte-parole s'exprime depuis une crèche à Kiev, réduite en cendres par une frappe ces derniers jours.\n\n« Les enfants ukrainiens devraient apprendre les lettres, les chiffres, les couleurs. À la place, ils apprennent à reconnaître le bruit des drones, à fuir dans un abri et à vivre avec la peur. »\n\nLes enfants ukrainiens de plus en plus pris pour cible, les infrastructures énergétiques aussi. Le nombre d'attaques contre les centrales électriques ou les stations de pompage [a] explosé de quasiment 80 % cette année, laissant les Ukrainiens sans courant entre quatre et 18 heures par jour désormais. Jérémie Lanche, Genève, RFI.\n\nEt pour revenir à ce qui s'est passé la nuit dernière, deux missiles russes sont tombés sur le sol polonais. Plusieurs pays d'Europe dénoncent une nouvelle « provocation » de Moscou.\n\nLa guerre entre la Russie et l'Ukraine déborde, parfois, sur le reste de l'Europe par d'autres manières. Ainsi, le Danemark annonce aujourd'hui soupçonner la Russie d'avoir planifié l'assassinat d'un rappeur ukrainien. Un assassinat qui aurait dû avoir lieu lors d'un concert près de Copenhague, la capitale danoise.\n\nToujours sur le continent européen. Ils ne s'étaient pas dit : « Rendez-vous dans dix ans. » Et, pourtant, ils viennent de se retrouver. Londres et Bruxelles viennent de signer un accord historique, dix ans après le référendum du Brexit. Le texte prévoit une série de mesures concrètes pour rendre plus faciles, par exemple, les exportations de nourriture britannique vers l'Union européenne. Le Premier ministre britannique, Andy Burnham, est très satisfait.\n\n« Il y a, donc, énormément de choses à célébrer ici. Je pense que nous travaillons ensemble dans un monde qui change autour de nous pour nous rapprocher à nouveau et, ce faisant, nous rendre plus forts, nos économies comme notre sécurité. Et c'est un plaisir. Je parle au nom de tous ceux qui sont de ce côté de la table : c'est un plaisir d'être avec vous aujourd'hui pour conclure cet accord historique. »\n\nAndy Burnham qui ne veut pas s'arrêter là. Après cet accord, il propose de lancer, l'an prochain, une nouvelle « réflexion » avec l'Union européenne sur les relations à long terme de son pays et des 27.\n\nAu Royaume-Uni, mais aussi en Espagne, au Portugal, en Grèce ou encore en France, ils disent non à la vie chère. Des syndicats et des associations organisent une vague de mobilisation simultanée – en même temps – à partir d'aujourd'hui et tout ce week-end dans sept pays d'Europe.\n\nLe Journal en français facile.\n\nVous écoutez toujours RFI.\n\nIl est maintenant 19 h 05 à Antalya, en Turquie, où la COP31 sur le climat aurait dû se terminer officiellement il y a une heure. Mais les discussions ne sont toujours pas finies. Un groupe de pays – qui inclut, notamment, le Panama, la France et la Côte d'Ivoire – demande que le texte final parle clairement d'une « transition hors des énergies fossiles ». Cette référence avait été enlevée du texte hier. Les pays africains se mobilisent, également, ensemble pour réclamer plus d'efforts de la part des pays les plus développés – les plus riches. Écoutez le ministre sénégalais de l'Environnement, Aliou Gori Diouf.\n\n« Vous venez dans une brousse, vous mettez le feu. Vous avez des tankers d'eau. Moi, je n'ai qu'un seau d'eau. Et vous me demandez de prendre mon seau d'eau pour éteindre le feu que vous avez allumé. C'est inacceptable pour les pays africains. Cette injustice climatique devrait prendre fin ici. Les pays développés ont l'obligation de fournir l'appui financier aux pays en développement. C'est consigné, c'est une obligation. »\n\nLe ministre sénégalais de l'Environnement, Aliou Gori Diouf, au micro de Jeanne Richard ; le ministre sénégalais de l'Environnement en colère, donc, contre les pays du Nord, qui ne font pas assez d'efforts à cette COP.\n\nEn France, on attend la décision du tribunal au procès de l'agression de Michel Zecler, ce producteur de musique noir et frappé violemment par trois policiers à Paris, il y a six ans. L'agression avait été filmée. Les agents de police avaient, ensuite, rédigé un faux procès-verbal, un document pour accuser leur victime d'être l'auteur de violences. Ils ont, à nouveau, présenté leurs excuses aujourd'hui. Ils risquent de la prison ferme pour cette agression qui avait profondément choqué la France.\n\nLe chanteur d'opéra Anas Séguin prend la parole. Il dénonce une « banalisation du racisme » après une critique faite par le magazine français Le Point consacrée à l'opéra Don Giovanni, de Mozart, dans lequel l'artiste joue le rôle principal. Alors, qu'est-ce qui provoque exactement sa colère ? Explications de Carlotta Morteo.\n\nLa phrase qui a fait bondir, la voici : « Le baryton a une telle prestance et une autorité si naturelle que l'on oublie totalement qu'il est noir. » Derrière le compliment, un sous-entendu lourd de préjugés. Une phrase qui a « échappé au processus de validation », s'excuse Le Point, qui a très rapidement modifié l'article, écrit par le chroniqueur Olivier Bellamy, qui a, lui aussi, fait son mea culpa. Mais cette histoire a suscité l'indignation générale dans le petit cercle de la musique classique française. Le directeur de la filiale spectacles du Château de Versailles, Laurent Brunner, a d'ailleurs immédiatement apporté son soutien au baryton, à ses côtés sur la scène de l'Opéra Royal à la fin de la représentation de Don Giovanni ce week-end.\n\n« La question n'est pas la couleur de peau du rôle-titre de cet opéra. Je t'ai proposé ce rôle mythique, cher Anas, car tu incarnes à merveille Don Giovanni. »\n\n[extrait d'un chant lyrique]\n\nÀ 36 ans, Anas Séguin est l'une des grandes voix lyriques de sa génération. Après plusieurs jours de silence, il dit son inquiétude de voir le racisme, je cite, « s'ancrer peu à peu comme une pensée acceptable ». Et il rappelle l'essentiel : « J'aspire à ce que chacun puisse exercer son art sans être [...] réduit à sa couleur de peau ou à ses origines. »\n\n[extrait d'un chant lyrique]\n\nDon Giovanni, de Mozart, et des explications signées Carlotta Morteo, du service culture de RFI.\n\nL'ancienne légende du cinéma français Gérard Depardieu à nouveau visé par des accusations graves. La justice a lancé une enquête contre lui et contre l'écrivain Michel Houellebecq. C'est une affaire révélée par Mediapart. Une comédienne les accuse de viol. Une agression qui aurait eu lieu sur le tournage d'un film, Thalasso, en décembre 2018. Le réalisateur est, lui, mis en cause pour complicité.\n\nEnfin, pas de chance pour l'équipe de France de football. Les tirages au sort viennent d'avoir lieu pour les quarts de finale de la Ligue des nations, et les Bleus de Zinédine Zidane vont affronter, dès les quarts de finale, leur plus gros rival : l'Espagne, championne du monde en titre.\n\nC'est la fin de ce Journal en français facile.\n\nMerci beaucoup de l'avoir écouté et rendez-vous sur notre site dédié : francaisfacile.rfi.fr.\n\nPoursuivez votre lecture sur les mêmes thèmes :",
    "tags": [
      "COP31 / 气候",
      "英欧外交",
      "国际新闻"
    ],
    "words": 1518
  },
  {
    "id": "rfi-20261112",
    "presetId": "rfi-jff-20261112",
    "title": "RFI 简明法语新闻 · 2026-11-12｜法语国家峰会与国际时事",
    "subtitle": "Francophonie et enjeux internationaux（约 10 分钟 · 1379 词文字稿）",
    "url": "materials/rfi/rfi-jff-20261112.mp3",
    "pdfUrl": "materials/rfi/rfi-jff-20261112.txt",
    "start": 0,
    "end": 0,
    "created": 1794499200000,
    "transcript": "16 heures temps universel.\n\nLe Journal en français facile.\n\nAdrien Delgrange.\n\nBienvenue à toutes et à tous.\n\nNous avons installé nos micros dans la capitale cambodgienne à l'occasion du 20ᵉ sommet de la Francophonie. Bonjour, Vichheka Khuon.\n\nBonjour et bienvenue au Cambodge.\n\nVous avez plusieurs responsabilités qui nous intéressent. Nous vous retrouvons juste après ce tour du monde de l'actualité de ce jeudi 12 novembre 2026.\n\nJensen Huang n'est plus le directeur général de l'entreprise américaine Nvidia. Jensen Huang a été poussé vers la sortie. L'homme de 63 ans, qui avait créé cette entreprise spécialisée dans les puces électroniques, est englué, empêtré dans un scandale de possible espionnage. L'une de ses conquêtes amoureuses est soupçonnée d'être une espionne au profit de la Chine.\n\nLa guerre en Ukraine se négocie ce soir en Irlande. Après avoir entendu le point de vue à Moscou de Vladimir Poutine, des représentants de Donald Trump vont rencontrer dans la soirée, à Dublin, Volodymyr Zelensky. Le président ukrainien est en Irlande. Il participe, en ce moment, à une réunion européenne. Le chancelier allemand est, lui aussi, à Dublin. Pour Friedrich Merz, il est très important d'amener Vladimir Poutine à la table des négociations.\n\n« Ce qui importe, ici, ce ne sont pas les personnes, mais le fait que Poutine soit prêt à engager des discussions. Et je constate avec une certaine satisfaction qu'il semble y avoir, du côté russe, une volonté croissante de reconnaître qu'on ne peut pas parler de l'Europe sans l'Europe. Et c'est avant tout une bonne nouvelle. Reste à voir si cela durera. Cela dépendra beaucoup des discussions qui auront lieu ces prochains jours. Ce qui importe, c'est que la Russie vienne à la table et soit prête à s'engager dans des discussions. Tout le reste suivra. »\n\nPendant ce temps-là, Greta Thunberg est à la conférence internationale sur le climat, qui se déroule en ce moment en Turquie. Greta Thunberg, une figure de l'engagement climatique de la jeunesse. La militante suédoise est spécialement venue à Antalya rappeler aux dirigeants du monde entier le lien qui existe entre guerre et impact sur l'environnement.\n\n« Les actions de ceux qui sont au pouvoir, ici, sont totalement déconnectées de la réalité. Pendant que nous parlons, nous perdons des vies, des écosystèmes et des espèces inestimables que nous ne récupérerons jamais. La planète ne se meurt pas. Elle est en train d'être tuée. »\n\nDes propos recueillis par notre envoyée spéciale Jeanne Richard.\n\nL'actualité internationale est aussi cambodgienne, avec le sommet de la Francophonie qui se prépare à Phnom Penh. Nous suivrons, d'ailleurs, de près l'élection du ou de la secrétaire général.e de l'Organisation internationale de la Francophonie, où rien n'est joué à quatre jours de l'élection. En attendant, les autorités locales ont mis les petits plats dans les grands pour accueillir cet événement. Témoignage de cette étudiante, Chinh Er Seng. Elle apprend le français à l'université royale de Phnom Penh et elle dit au micro de Nicolas Feldmann la fierté pour son pays d'accueillir un tel événement.\n\n« Ce sommet, pour moi, ça représente une immense fierté pour le Cambodge, parce que ça fait déjà 30 ans depuis la dernière fois que le sommet a été tenu au Vietnam. Donc, cette fois-ci, c'est une immense fierté. Et, surtout, on a aussi notre père fondateur, Sa Majesté le roi Norodom Sihanouk, qui était notre défunt roi, qui a fait partie de la francophonie. Au Cambodge, en fait, il y a beaucoup de langues étrangères que les jeunes sont en train d'étudier. Mais le français, c'est une... pour moi, c'est une bonne langue et ça donne beaucoup d'opportunités, parce qu'on a une grande communauté francophone, qui contient plus de 80 pays. Donc, bien sûr, notre opportunité de partir en Europe ou bien de partir en dehors de notre pays, voilà, c'est élevé. »\n\n« Francophonie.\n\n— Yeah, francophonie »\n\nRFI. À Phnom Penh, 23 h 05.\n\n— Retour avec vous, Vichheka Khuon. Vous êtes la dynamique présidente de l'Association des professeurs de français au Cambodge, mais aussi la porte-parole du ministère de l'Éducation et de la Jeunesse. Dites-nous, tout d'abord, pourquoi, quand vous étiez jeune, vous avez choisi d'apprendre le français ?\n\n— En fait, quand j'étais jeune, c'étaient mes parents qui a choisi la langue parce que, à l'école, on peut choisir entre anglais ou français. En fait, c'étaient mes parents qui a choisi. Dans les années 90, on a le choix entre anglais et français. Mais, pour aller à l'université et étudier certains métiers spécifiques, il faut le français. Par exemple, la faculté de médecine ou bien devenir ingénieur. Il y a beaucoup, encore, beaucoup de métiers, il faut parler français pour faire des études à l'université.\n\n— Êtes-vous allée en France pour apprendre le français ?\n\n— Oui. Après avoir terminé ma licence à l'université, j'ai obtenu la bourse du gouvernement français pour faire le master à Paris. Et puis j'ai obtenu la bourse de l'Agence universitaire de la Francophonie pour faire mon doctorat à Paris.\n\n— Pourquoi avez-vous voulu revenir au Cambodge ?\n\n— Le Cambodge est mon pays natal et j'ai bien rêvé parce que, quand j'étais petite, le Cambodge était en guerre. Et ce que j'ai appris et ce que mes parents a dit, qu'il faut que je grandis avec des connaissances suffisantes pour développer le pays et pour contribuer à notre pays. Parce que mes professeurs, aussi, ils m'ont dit tout le temps que le Cambodge était un pays très riche et, aussi, très civilisé pendant la période angkorienne. Donc, il faut, on a besoin des jeunes générations pour développer le pays. Et c'est pour ça j'ai décidé de retourner au Cambodge après terminé mes études.\n\n— Le parcours que vous avez eu et que vous avez vécu, Vichheka Khuon, est-il aujourd'hui d'actualité pour les jeunes Cambodgiens qui voudraient apprendre le français ?\n\n— Bien sûr. Je crois que le français est toujours une langue qui donne opportunités aux jeunes. Parce que, maintenant, il y a beaucoup d'universités au Cambodge. Par exemple, l'université des sciences de la santé, Institut de technologie du Cambodge et, aussi, encore beaucoup d'universités donnent encore les cours en français ou bien donnent les cours de double diplôme. Dans ce cas-là, pour moi, pour devenir chercheur ou bien succès dans l'avenir, le français est toujours un choix important.\n\n— Le français reste à la mode, même si on voit qu'il n'est pas énormément parlé au Cambodge.\n\n— Tout à fait. Même maintenant, on trouve que beaucoup des dirigeants, les ministres du Cambodge, la plupart parlent français. Et je crois que parler français appartient à notre culture. Par exemple, il y a beaucoup de mots en khmer qui a emprunté beaucoup de mots de français en langue khmer. Mais aussi...\n\n— Comme par exemple ?\n\n— Par exemple, si on va au restaurant, on dit « comment commander le plat », on dit « comment ». Et le mot commander, ça devient un mot quotidienne. Tout le monde pense que ce mot est un mot khmer, par exemple.\n\n— Aujourd'hui, le Cambodge va accueillir le sommet de la Francophonie, un rendez-vous international. Quelles sont vos attentes ?\n\n— J'espère que le sommet de la Francophonie produira des résultats concrets et durables pour le Cambodge. Pas tout simplement cet événement est un événement attendu des Cambodgiens depuis des années. Mais, aussi, ça peut montrer au monde un nouveau... un nouveau image du Cambodge. Ce n'était plus un pays en guerre, mais un pays développé, avec la civilisation et culturel attractif, et intéressant à découvrir.\n\n— Et, juste avant de se quitter, quel est votre mot ou quelle est votre expression préférée de la langue française ?\n\n— Je trouve que la langue française est une langue romantique. Quand j'étais jeune, j'aimais bien collecter des mots « je t'aime » en plusieurs langues. Et je trouve que « je t'aime » est un mot très joli et agréable.\n\nAinsi se referme ce Journal en français facile. Enregistré en direct de Phnom Penh grâce à Bertrand Haeckler. Merci, aussi, aux équipes à Paris.\n\nEt puis, si le sujet de la francophonie vous intéresse, vous pouvez poursuivre la discussion, ce soir, avec Le Débat du jour.\n\nÀ demain, pour une nouvelle édition.\n\nPoursuivez votre lecture sur les mêmes thèmes :",
    "tags": [
      "法语国家峰会",
      "AI 与科技",
      "COP31"
    ],
    "words": 1379
  },
  {
    "id": "rfi-20261111",
    "presetId": "rfi-jff-20261111",
    "title": "RFI 简明法语新闻 · 2026-11-11｜国际新闻综述：社会动荡与地缘冲突",
    "subtitle": "Actualité internationale : crises et mobilisations（约 10 分钟 · 1511 词文字稿）",
    "url": "materials/rfi/rfi-jff-20261111.mp3",
    "pdfUrl": "materials/rfi/rfi-jff-20261111.txt",
    "start": 0,
    "end": 0,
    "created": 1794412800000,
    "transcript": "Vous écoutez bien RFI. Nous sommes le mercredi 11 novembre.\n\nIl est 16 heures en temps universel, 17 heures à Paris et à Alger.\n\nLe Journal en français facile.\n\nDiane Berger.\n\n500 jours qu'il est détenu, le journaliste sportif Christophe Gleizes, arrêté en Algérie et condamné pour apologie du terrorisme. Ses proches espèrent toujours que le président Tebboune acceptera de le gracier, d'annuler sa peine de prison.\n\nC'est du jamais-vu en Espagne : un appel à la grève générale. Alors, il n'est pas suivi dans tous les secteurs avec la même intensité, mais il donne, en tout cas, la température sociale du pays à moins de trois semaines des prochaines élections législatives.\n\nEnfin, direction Jérusalem-Est. Leur terre avait déjà été annexée par Israël ; beaucoup de Palestiniens en sont désormais expulsés, chassés. Les démolitions de logements ont plus que triplé en l'espace de sept ans.\n\n500 jours. 500 jours que notre confrère, le journaliste français Christophe Gleizes, est détenu en Algérie, arrêté en mai 2024, puis condamné un an plus tard à sept ans de prison pour apologie du terrorisme. Il avait rencontré des militants kabyles pour un reportage sur le club de football de la JS Kabylie. Certains de ses contacts étaient liés à une organisation classée comme terroriste par Alger. Et, aujourd'hui, sa famille demande, à nouveau, un geste au pouvoir algérien. Son frère, Maxime Gleizes, était l'invité de Nicolas Sur, dans RFI Midi. On l'écoute.\n\n« La dernière fois que j'y suis allé, c'était en juin. Mais les nouvelles plus fraîches viennent du nouveau consul français, qui a pu lui rendre visite il y a trois jours. Écoutez, dès qu'on le voit, je pense qu'il a peu de visites, donc il essaye de montrer tout son côté solaire et sa bonhomie. Donc, il essaie de rassurer tout le monde parce que, vraiment, ce qui le peinerait le plus, c'est que la famille souffre. Et, ça, il le veut absolument pas. Et il a parlé pendant longtemps avec le consul de littérature, de géopolitique, de sport, d'échecs. Et, en ce moment, il lit Marcel Proust, et il a retrouvé son codétenu bédouin avec qui il jouait énormément aux échecs. Donc, tout va bien. En tout cas, le seul petit bémol, c'est qu'il a très mal à une dent, il a perdu une couronne et, donc, il doit se faire opérer. Et, en fait, c'est très difficile en prison. Donc, je pense qu'il souffre un peu le martyr. Mais, le problème, c'est qu'on n'est pas sur place pour gérer un peu tout ce problème-là. »\n\nMaxime Gleizes, le frère de Christophe Gleizes. Avec d'autres membres de leur famille, ils ont été reçus, aujourd'hui, par le chef de la diplomatie française, Jean-Noël Barrot. Et ils seront, dans un peu plus d'une heure, à un match de football solidaire, organisé par Reporters sans frontières avec la Ville de Paris, pour rendre hommage, justement, à Christophe Gleizes ; lui qui, dans son travail, couvrait l'actualité du ballon rond.\n\n312 écoles évacuées après des alertes à la bombe, d'après le ministre de l'Éducation italien. À ce stade, aucun « danger concret » n'a été identifié, d'après Giorgia Meloni, la Première ministre. Les autorités demandent aux habitants du pays de ne pas paniquer. Ce n'est pas le premier pays d'Europe touché par ce genre de menaces ces derniers jours. Les écoles du Royaume-Uni et d'Irlande ont, également, reçu des alertes à la bombe de ce type ces derniers temps.\n\nJournée de grève générale en Espagne. Le quart des trains à grande vitesse de la compagnie nationale Renfe a été supprimé, 85 vols au départ ou à destination de Barcelone annulés. Le mouvement est très suivi dans certains secteurs, selon les syndicats. La mobilisation totale est faible, répondent les patrons. Le mouvement, en tout cas, est inédit en quatorze ans. C'est la première grève générale en Espagne depuis 2012. Mot d'ordre : défendre l'accès au logement et le pouvoir d'achat, à moins de trois semaines des législatives anticipées, Agnieszka Kumor.\n\nSi l'objectif principal des syndicats est de mobiliser les salariés espagnols autour de la question du logement, le mécontentement social se fait de plus en plus sentir. Accidents ferroviaires à répétition, méga-panne d'électricité, gestion des incendies et des inondations meurtrières ; autant de signes qui montrent les failles de l'État, notamment dans les infrastructures publiques. Cela alors que l'économie espagnole affiche l'une des plus belles performances en Europe : 2,7 % sur un an de croissance au troisième trimestre 2026. La dette publique de l'Espagne est retombée sous le seuil symbolique des 100 % du PIB, cette année. Les recettes de l'État ont augmenté de 150 milliards d'euros depuis 2019. Mais l'investissement public ne suit pas. D'où un sentiment grandissant dans la population espagnole de la dégradation des services publics en matière de transports, mais aussi de la santé ou de l'éducation.\n\nAgnieszka Kumor, du service économie de RFI.\n\nÀ Varsovie, maintenant, c'est pour un tout autre motif que des dizaines de milliers de personnes descendent dans la rue, aujourd'hui : elles participent à la traditionnelle Marche [de] l'Indépendance. Un rendez-vous annuel des nationalistes et des militants d'extrême droite. Sous une nuée de drapeaux aux couleurs de la Pologne, on peut y entendre des slogans xénophobes – contre les étrangers –, comme, je cite un exemple : « Garder la Pologne blanche. »\n\nQue va-t-il se passer, maintenant, après les négociations qui ont eu lieu à Abou Dabi, aux Émirats [arabes unis], concernant la guerre en Ukraine ? Des discussions qui ont été organisées sous médiation des États-Unis. Le président ukrainien, Volodymyr Zelensky, annonce qu'il va rencontrer demain, jeudi, les émissaires américains à Dublin, en Irlande. Avant cela, Jared Kushner et Steve Witkoff sont attendus à Moscou pour des discussions supplémentaires avec le président russe, Vladimir Poutine.\n\nEux n'ont plus le droit de se rendre en Russie. Moscou interdit d'entrer sur son territoire deux députés français, Sacha Houlié et Arthur Delaporte, et deux journalistes, Ariane Chemin et Paul Gogo. Les journaux Le Monde et Ouest-France dénoncent une entrave – c'est-à-dire un obstacle – à la liberté d'informer. La diplomatie russe dit avoir agi en réponse à l'expulsion de France de Xenia Fedorova, la chroniqueuse russe pro-Kremlin, très présente dans plusieurs médias du milliardaire français Vincent Bolloré.\n\nLe Journal en français facile.\n\nVous écoutez toujours bien RFI.\n\nIl est 17 h 07 à Paris, 18 h 07 à Jérusalem. La ville coupée en deux. Le côté ouest est israélien, le côté est palestinien selon le droit international. Mais ça, c'est en théorie, car Israël s'est emparé de ce morceau de territoire en juin 1967, pendant la guerre des Six jours, avant d'annexer Jérusalem-Est en 1980. Et, aujourd'hui, une ONG israélienne, Ir Amim, alerte : l'État israélien s'implique de plus en plus, il agit pour expulser, chasser, les habitants palestiniens de Jérusalem-Est. Selon l'ONG, six communautés palestiniennes sont aujourd'hui menacées. Manon Chapelain, vous êtes notre correspondante à Jérusalem. Les démolitions de logements palestiniens ont augmenté ces dernières années.\n\nOui, elles ont plus que triplé. Une cinquantaine de logements palestiniens étaient démolis chaque année avant 2019, contre 181 pour la seule année 2024. Le principal enseignement de ce rapport, c'est que ces expulsions ne sont plus seulement le fait d'organisations de colons. Elles sont, selon l'organisation, directement orchestrées par les institutions de l'État israélien. Le rapport identifie 19 organismes publics impliqués. Parmi eux, le ministère de la Justice, qui facilite le transfert de propriété aux colons, celui des Finances, qui permet la saisie de biens palestiniens, ou encore la police, directement impliquée dans les expulsions et les démolitions. Sur le terrain, six communautés palestiniennes sont particulièrement menacées. À Al-Boustane, au sud de la vieille ville de Jérusalem, 115 maisons risquent d'être rasées. Ce sont 45 à Numan, village palestinien du sud-est de la ville. En parallèle, l'Autorité israélienne des terres a lancé des appels d'offres pour plus de 60 000 logements dans des colonies construites sur ces terres expropriées. Manon Chapelain à Jérusalem, RFI.\n\nPlus au nord, le Liban a subi deux guerres avec Israël en l'espace de quelques années. Le pays fait aussi face à une grave crise économique. Tout cela rend la vie très difficile pour les habitants. D'après l'ONU, plus d'un million de personnes sont confrontées, au Liban, à une insécurité alimentaire aiguë – ils manquent de nourriture.\n\nOn termine ce Journal en français facile avec un mot du voyage du pape en Amérique du Sud. Plus de deux millions de personnes se sont réunies pour la dernière messe de Léon XIV en Argentine, à Luján, dernière étape, donc, du chef des catholiques dans le pays, après l'Uruguay et le Pérou. Et, ensuite direction... Oui, ensuite direction le Pérou. Excusez-moi, je m'embrouille dans les déplacements du pape.\n\nIl est maintenant quasiment 16 h 10 en temps universel.\n\nC'est la fin de ce Journal en français facile.\n\nDemain, vous retrouverez Adrien Delgrange, votre présentateur habituel, qui sera en direct de Phnom Penh, au Cambodge, car c'est là qu'a lieu le 20ᵉ sommet de la Francophonie, qui commence samedi prochain.\n\nPoursuivez votre lecture sur les mêmes thèmes :",
    "tags": [
      "新闻自由",
      "社会罢工",
      "公民权利"
    ],
    "words": 1511
  },
  {
    "id": "rfi-20261104",
    "presetId": "rfi-jff-20261104",
    "title": "RFI 简明法语新闻 · 2026-11-04｜美国中期选举、国际冲突、网络攻击与法国文学奖",
    "subtitle": "Actualité internationale et société : élections, conflits, cyberattaque, littérature（约 10 分钟 · 1452 词文字稿）",
    "url": "materials/rfi/rfi-jff-20261104.mp3",
    "pdfUrl": "materials/rfi/rfi-jff-20261104.txt",
    "start": 0,
    "end": 0,
    "created": 1793808000000,
    "transcript": "Bonjour à toutes et à tous. Soyez les bienvenus à l'écoute de RFI Radio France Internationale. En direct de Paris, il est 17 heures.\n\nLe Journal en français facile.\n\nAdrien Delgrange.\n\n16 heures temps universel.\n\nNous sommes le mercredi 4 novembre 2026.\n\nAu sommaire de ce journal :\n\nLa défaite de Donald Trump aux élections de mi-mandat aux États-Unis. Le président américain reconnaît qu'il a perdu les élections. Côté démocrate, un résultat présenté comme historique. C'est ce que nous verrons dans un instant. Nous sommes en Géorgie et dans l'Ohio.\n\nAilleurs sur la planète. Un mort au Liban, victime d'une frappe israélienne, cet après-midi, dans le sud du pays.\n\nUne nouvelle cyberattaque, cette fois-ci contre l'Établissement français du sang. L'attaque a déréglé les installations frigorifiques qui abritaient des flacons de sang, nous explique, dans un instant, Amélie Beaucour.\n\nEt puis, enfin, littérature en France. Vous entendrez Yannick Haenel parler du métier de professeur. Ancien professeur et aujourd'hui romancier, il a remporté, avec son livre intitulé La solitude des professeurs est infinie, le prix Femina 2026.\n\nLa politique américaine pour commencer ce journal. Les démocrates ont remporté les élections de mi-mandat aux États-Unis. Les opposants à Donald Trump prennent le contrôle des deux chambres, des deux lieux de pouvoir aux États-Unis. Ce scrutin marque un coup d'arrêt dans la politique menée par l'actuel président et change l'équilibre des pouvoirs aux États-Unis. Cette large victoire des démocrates fera date. Plusieurs élus entrent dans l'histoire. Les États-Unis vont, notamment, avoir leur premier sénateur musulman ou encore leur première femme noire à être gouverneure d'un État. Parmi ces victoires emblématiques, nous sommes en Géorgie. Keisha Lance Bottoms a été élue hier gouverneure de Géorgie. Elle devient, ainsi, la première Afro-Américaine à occuper ce poste à l'échelle du pays. Une victoire porteuse d'espoir pour cette militante démocrate en Géorgie.\n\n« Je suis vraiment très enthousiaste et, aussi, très émue. Je me sens très concernée par ce qui se passe actuellement avec l'immigration, la police de l'immigration – l'ICE. Brian Kemp était très hostile à l'immigration et le candidat républicain pour cette élection était, lui aussi, très anti-immigration, avec des discours que je considère comme racistes. Alors, voir une femme noire devenir gouverneure et entrer dans l'histoire, c'est énorme. Elle a déjoué tous les pronostics. Nous avons déjoué tous les pronostics. On a fait du porte-à-porte, on est allés voter. Alors, oui, je suis enthousiaste, je suis émue et j'ai vraiment hâte de voir ce que nous réservent les quatre prochaines années. »\n\nUn témoignage recueilli par Edward Maille.\n\nParmi les États qui étaient les plus observés, l'Ohio. Nous sommes, à présent, dans le nord-est des États-Unis. C'est là que vous vous trouvez pour RFI, François-Damien Bourgery. François-Damien, les démocrates ont remporté plusieurs victoires majeures très importantes.\n\nOui. Et, tout d'abord, celle pour le poste de gouverneur. C'est Amy Acton qui l'a emporté face au milliardaire républicain Vivek Ramaswamy. Amy Acton, elle est médecin. Et, avec cette victoire, elle devient la première démocrate à devenir gouverneure de l'Ohio depuis 20 ans. Elle est aussi la première femme à être élue à ce poste dans cet État. Deux autres victoires majeures : celle de Sherrod Brown pour le Sénat et de Brian Poindexter pour la Chambre des représentants. Ils ont tous les deux remporté des sièges qui étaient occupés par des Républicains. Et ils ont donc, ainsi, permis au Parti démocrate d'obtenir la majorité au Congrès des États-Unis.\n\nPar ailleurs, François-Damien, ce succès des démocrates, comment peut-on l'expliquer ?\n\nEh bien, c'est en grande partie à cause de l'inflation. Aux États-Unis, les prix ont énormément augmenté avec la guerre en Iran, l'essence surtout. Et, les Américains, ils utilisent beaucoup leur voiture. Il y a, aussi, la manière que Donald Trump a de gouverner. Elle est brutale, autoritaire. Autant de raisons qui ont poussé les électeurs démocrates à se mobiliser hier et, peut-être, aussi, certains républicains modérés à voter pour le camp adverse.\n\nFrançois-Damien Bourgery en direct de l'Ohio, dans le Journal en français facile.\n\n« Une large victoire des démocrates est une excellente nouvelle pour la démocratie américaine », vient de déclarer le chef de la diplomatie française, Jean-Noël Barrot. Et puis cette défaite de Donald Trump, célébrée jusqu'en Iran, où des milliers d'Iraniens se sont rassemblés, cet après-midi, à Téhéran, pour crier victoire après la défaite de Donald Trump.\n\nLe Journal en français facile.\n\nUn mort au Liban. Une frappe israélienne a tué une personne, cet après-midi, dans le sud du pays. Un drone a visé une personne qui circulait à deux-roues dans le village de Qabrikha. C'est le premier décès annoncé dans une frappe de ce type depuis le mois de septembre dernier.\n\nSur le continent africain. Nous connaissons la date de l'élection présidentielle, qui vient d'être confirmée, au Burundi. Ce sera le 3 mai prochain. Le chef de l'État a signé, cet après-midi, le décret qui annonce cette élection. Un éventuel second tour est prévu le 1ᵉʳ juin. Pour l'heure, seul le président sortant a été officiellement investi. La date limite pour présenter sa candidature à l'élection présidentielle du Burundi est fixée au 22 novembre prochain.\n\nL'actualité en France, ce sont ces établissements du don du sang qui ont été victimes d'une cyberattaque, cyberattaque la nuit dernière. Amélie Beaucour, bonjour.\n\nBonjour, Adrien.\n\nCe sont les chambres froides dans lesquelles sont stockés les produits sanguins – ces flacons de sang – qui auraient été visées.\n\nOui. Ce sont trois sites régionaux de l'Établissement français du sang qui sont concernés, cette fois-ci. C'est le système de gestion de température des chambres froides qui a été visé. Une installation qui est gérée par une entreprise avec laquelle travaille l'Établissement français du sang. Les températures se sont mises à augmenter brutalement là où étaient conservées des poches de plasma – c'est un composant du sang – et qui avaient pour objectifs d'être données à des malades ou [à] fabriquer des médicaments. L'établissement assure que l'incident a pu être rapidement détecté et que les échantillons – les flacons – ont pu être transférés vers d'autres installations sans que leur qualité n'ait été modifiée. L'Établissement français du sang rejoint, donc, la liste des victimes de cette série de cyberattaques présumées qui a frappé l'Europe en début de semaine. Plusieurs supermarchés et acteurs de l'industrie alimentaire ont, eux aussi, été touchés en Belgique, en Allemagne, au Royaume-Uni ou encore en Italie. Une douzaine de pays au total sont concernés, avec un scénario qui se répète : une activation à distance du dégivrage de certains réfrigérateurs – donc, on fait monter la température – et sans que l'on en connaisse les auteurs.\n\nMerci, Amélie. Amélie Beaucour, dans le Journal en français facile.\n\nLa saison des prix littéraires en France. Après le Goncourt hier, le Femina aujourd'hui. Alors, pour information, ce prix a été créé par des femmes de lettres qui souhaitaient proposer une alternative, une chose un peu différente, au prix Goncourt, dont le jury était, alors, exclusivement masculin. Aujourd'hui, le prix [féminin] Femina a été remis au romancier Yannick Haenel pour son livre intitulé La solitude des professeurs est infinie, aux éditions Gallimard. Autrement dit, le récit de ces années d'enseignement dans des établissements scolaires de banlieue parisienne. Yannick Haenel était récemment l'invité de l'émission De vive(s) voix, sur RFI. Il explique, au micro de Pascal Paradou, pourquoi il a écrit ce livre.\n\n« Il y avait, effectivement, les attaques contre les professeurs, de toutes sortes. Il y a aussi tous les discours que la société tient sur les professeurs m'ont toujours paru insatisfaisants. Cette manière de réduire les profs à une caricature, ça m'a toujours énervé, voilà. Je trouvais ça injuste et je me disais que l'expérience que j'avais vécue, qui était une expérience à la fois passionnante, assez difficile, mais illuminante, aussi, je l'avais pas lue ailleurs. Donc, voilà. Je me suis dit : il faut que j'écrive ce que je sais faire, c'est-à-dire pas des traités, pas des essais, mais des romans, enfin, des romans autobiographiques. »\n\nYannick Haenel. Émission que vous pouvez réécouter sur notre site internet. Il s'exprimait dans l'émission De vive(s) voix. L'écrivain, qui était aujourd'hui à la remise du prix à Paris, a dédié son livre aux professeurs, aux lycéens et aux collégiens, en plein mouvement de protestation aujourd'hui en France.\n\nUn mouvement, par ailleurs, qui fait tache d'huile en Europe, où nous apprenons que plusieurs milliers de lycéens et d'étudiants ont manifesté, aujourd'hui, dans les rues de Copenhague, au Danemark, contre le projet du gouvernement de réduire les aides pour les étudiants.\n\nAinsi se referme ce Journal en français facile.\n\nOù que vous soyez sur la planète, merci de l'avoir écouté.\n\nRadio Foot Internationale est à suivre.\n\nPoursuivez votre lecture sur les mêmes thèmes :",
    "tags": [
      "网络安全与医疗",
      "选举政治",
      "文学奖项"
    ],
    "words": 1452
  },
  {
    "id": "rfi-20261103",
    "presetId": "rfi-jff-20261103",
    "title": "RFI 简明法语新闻 · 2026-11-03｜美国中期选举、英国奴隶制历史、欧洲网络攻击、法国文学大奖",
    "subtitle": "Actualité internationale et société（约 10 分钟 · 1517 词文字稿）",
    "url": "materials/rfi/rfi-jff-20261103.mp3",
    "pdfUrl": "materials/rfi/rfi-jff-20261103.txt",
    "start": 0,
    "end": 0,
    "created": 1793721600000,
    "transcript": "Bonjour à toutes et à tous. Soyez les bienvenus à l'écoute de RFI - Radio France Internationale. En direct de Paris, il est 17 heures.\n\nLe Journal en français facile.\n\nAdrien Delgrange.\n\nNous sommes le mardi 3 novembre.\n\nVoici les titres de cette édition :\n\nC'est une élection qui a valeur de test pour Donald Trump. Les élections de mi-mandat aux États-Unis. Des bureaux de vote ont commencé à ouvrir. Les Américains ont l'occasion de dire stop ou encore à la politique de l'actuel président américain. Nous sommes en direct de Washington et de Los Angeles.\n\nLe roi d'Angleterre revient, pour la première fois en public, sur les années sombres du Royaume-Uni. Charles III vient de dire son « horreur face à l'esclavage », qu'il qualifie d'« injustice monstrueuse ».\n\nNous reviendrons, aussi, dans ce journal sur cette cyberattaque en Europe, où les températures des frigos de supermarchés ont été déréglées par des pirates informatiques. Nous serons en Suède.\n\nEt puis, enfin, c'est la plus grande récompense littéraire de France. Le prix Goncourt a été remis, aujourd'hui, à Philippe Jaenada pour son livre L'inconnue du quai de Javel.\n\nNous sommes, donc, aux États-Unis pour commencer ce journal, pour parler des élections de mi-mandat. Elles ont lieu tous les quatre ans. Elles sont à mi-parcours du mandat présidentiel. Ces élections sont particulièrement importantes, car elles permettent de mesurer le soutien des Américains au président, en l'occurrence Donald Trump, qui est revenu au pouvoir il y a maintenant deux ans. Vincent Souriau, bonjour.\n\nBonjour, Adrien. Bonjour à tous.\n\nCorrespondant de RFI à Washington, où il est un petit peu plus de 11 heures du matin. Vincent, c'est la fin de mandat de Donald Trump qui se joue aujourd'hui.\n\nOui. L'enjeu de ces élections, c'est le contrôle du Congrès américain, c'est-à-dire le siège du pouvoir législatif aux États-Unis. Ce congrès est composé de deux chambres – le Sénat et la Chambre des représentants –, qui sont, pour l'instant, contrôlées par le Parti républicain, à une très courte majorité. Mais, compte tenu de l'impopularité de Donald Trump en raison de la hausse du coût de la vie, les démocrates ont de très fortes chances de l'emporter, car l'électorat de gauche va se mobiliser en masse pour sanctionner la politique de la Maison Blanche. Et, dans le camp d'en face, les Américains qui ont soutenu Donald Trump lors de la présidentielle de 2024 sont déçus, dans l'ensemble, de son début de mandat et pourraient décider de bouder ce scrutin.\n\nAlors, Vincent, cela signifie-t-il pour autant que le Parti démocrate va prendre le contrôle des deux chambres du Congrès ?\n\nEh bien, ce n'est pas du tout certain, Adrien. Pour ce qui est de la Chambre des représentants, c'est probable. En revanche, ce sera beaucoup plus serré au Sénat, parce que le Parti démocrate doit conquérir quatre sièges de sénateurs. Si les démocrates y arrivent, on pourra parler d'une véritable gifle pour le président américain, puisque cela voudra dire que la gauche sera parvenue à s'emparer de certains sièges que l'on pensait imprenables. Par exemple, dans les États du Texas ou du Kansas, qui sont historiquement des bastions républicains. Il reste deux éléments assez difficiles à mesurer à ce stade. D'abord, Donald Trump va-t-il contester le résultat de certains de ces scrutins ? On ne le sait pas encore, mais il a donné des signes en ce sens. Et, enfin, si le congrès bascule bel et bien, il va falloir que Donald Trump cohabite avec un Parlement qui lui sera hostile, et on ne sait pas à quel point le président américain est prêt à faire des concessions politiques.\n\nMerci, Vincent, à Washington.\n\nLes élections de mi-mandat ont lieu dans les 50 États américains. Nous sommes, à présent, sur la côte ouest des États-Unis. En Californie, État à la majorité démocrate. Il ne devrait pas y avoir trop de surprises. Le prochain gouverneur et la plupart des 52 députés pour la Chambre des représentants seront, très probablement, démocrates. Les Californiens vont, aussi, se prononcer sur un autre sujet : un référendum local, pour ou contre une taxe sur la fortune des milliardaires. Et là, Loïc Pialat, correspondant de RFI à Los Angeles, il est plus difficile de prédire le résultat du vote.\n\nOui. En Californie, les référendums locaux s'appellent des propositions. Et la proposition 40 – c'est le nom de ce référendum – établirait une taxe de 5 % pour les 250 milliardaires de l'État. Il ne s'agirait pas d'un impôt annuel, mais d'une taxe prélevée une seule fois. La mesure est inspirée par deux économistes français, Gabriel Zucman et Emmanuel Saez. Elle rapporterait, selon ses défenseurs, 100 milliards de dollars. L'argent récolté servira à compenser les coupes budgétaires imposées par le gouvernement de Donald Trump dans le secteur de la santé. Mais les opposants à cet impôt sur la fortune redoutent un exil des milliardaires. Sergueï Brin, le cofondateur de Google, a déjà déménagé en Floride, par exemple. Il a, aussi, dépensé des dizaines de millions de dollars en publicité pour faire campagne contre la proposition 40. Cette taxe divise même dans le Parti démocrate. L'actuel gouverneur, Gavin Newsom, votera non. Ses détracteurs l'accusent de vouloir protéger les milliardaires, parce qu'il aura besoin de leur argent quand il se lancera dans la course à la Maison Blanche. Les électeurs sont très partagés, mais les sondages les plus récents donnent le non vainqueur.\n\nLoïc Pialat à Los Angeles pour RFI. Les équipes de Radio France Internationale mobilisées pour vous informer et vous faire vivre en direct ce scrutin. Premiers résultats attendus demain matin, heure française.\n\nLes mots sont volontairement choisis tant le sujet est délicat. Le roi Charles III s'est exprimé, cet après-midi, sur le rôle du Royaume-Uni dans l'esclavage. Il a évoqué la responsabilité historique du Royaume-Uni dans la traite des esclaves, une période qu'il a qualifiée d'« injustice monstrueuse ». Il a aussi appelé « à tirer les leçons du passé, à construire un avenir différent ». Enfin, notons que plusieurs pays des Caraïbes demandent toujours au Royaume-Uni d'aller plus loin, en prononçant des excuses officielles.\n\nLa température des congélateurs est passée de -20 à plus de 50 °C en quelques heures. Hier, plusieurs pays européens ont été victimes d'une cyberattaque qui visait des supermarchés. Ont été concernés la Belgique, le Luxembourg, l'Estonie, l'Irlande ou encore la Suède. Témoignage de la responsable de ce supermarché à Stockholm.\n\n« On a dû jeter tellement de marchandises et ça nous a pris beaucoup de temps pour gérer tout ça. Et il faut du temps pour remettre les congélateurs en marche. »\n\n« Ça fait bizarre de voir ça. On se dit que c'est insensé. Mais quel est le but ? C'est très étrange et, forcément, on se demande si ce n'est pas un pays de l'Est qui aurait intérêt à semer le trouble. »\n\nTémoignages recueillis par notre correspondante à Stockholm, Ottilia Ferey.\n\nParlons de littérature. C'est un rituel français. Tous les ans, début novembre, est annoncé en haut des escaliers d'une brasserie parisienne, chez Drouant, le vainqueur du prix Goncourt.\n\n« Le 124ᵉ Goncourt a été attribué à Philippe Jaenada, pour son livre L'inconnue du quai de Javel. »\n\n« Bravo ! »\n\nL'écrivain Philippe Jaenada couronné, donc, pour son dernier roman, édité chez Flammarion. Catherine Fruchon-Toussaint, Philippe Jaenada est un auteur déjà très reconnu dans le monde de la littérature.\n\nDéjà lauréat du prix Femina en 2017, Philippe Jaenada décroche donc, aussi, le Graal avec son 17ᵉ roman. Un livre qui s'inscrit dans le processus littéraire de ses précédents, à savoir des romans-enquêtes. L'auteur de 62 ans est, en effet, passionné par les faits divers du XXᵉ siècle, particulièrement les cold cases – en bon français, des affaires classées non résolues –, comme c'est le cas ici. Il a choisi, en effet, de rouvrir le dossier du meurtre non élucidé d'une jeune femme à Paris, en septembre 1949 – pas très loin de RFI d'ailleurs –, sur le quai de Javel. Il s'est, donc, plongé dans les archives. Mais, ici, la plus-value, c'est qu'il prend pour modèle le commissaire Maigret, le célèbre policier inventé par Georges Simenon. Et, sur les traces de son héros, il avoue clairement son admiration. Il va peu à peu nous raconter qui était cette Louise Cansot. Mieux, il va dénicher le vrai coupable. Bref, un récit qui se lit comme un roman policier, pétri d'humour, documenté. Avec L'inconnue du quai de Javel, le [jury] Goncourt récompense un livre populaire et réjouissant.\n\nCatherine Fruchon-Toussaint, dans votre Journal en français facile.\n\nL'heure de passer la main à Annie Gasnier. Bonsoir, Annie.\n\nBonsoir, Adrien.\n\nRadio Foot Internationale se met à l'heure de la Ligue des champions.\n\nEh oui, puisqu'il s'agit de la quatrième journée de la compétition. Nous reviendrons, donc, sur certaines affiches du jour. Mais nous parlerons, aussi, d'un match important qu'il y a eu en Allemagne au cours du week-end, le fameux Klassiker. Et puis, aussi, nous évoquerons le décès d'un joueur espagnol après un choc contre un gardien, lors d'un match.\n\nAnnie Gasnier et ses coéquipiers vous attendent.\n\nPoursuivez votre lecture sur les mêmes thèmes :",
    "tags": [
      "网络安全",
      "选举政治",
      "龚古尔文学奖"
    ],
    "words": 1517
  },
  {
    "id": "rfi-20261029",
    "presetId": "rfi-jff-20261029",
    "title": "RFI 简明法语新闻 · 2026-10-29｜多国新闻与社会问题 · 重大事故、政治、游戏与社会反响",
    "subtitle": "Actualité internationale et société（约 10 分钟 · 1664 词文字稿）",
    "url": "materials/rfi/rfi-jff-20261029.mp3",
    "pdfUrl": "materials/rfi/rfi-jff-20261029.txt",
    "start": 0,
    "end": 0,
    "created": 1793289600000,
    "transcript": "Jeudi 29 octobre. Il est 17 heures à Madrid et à Paris, une heure de moins en temps universel. Merci d'écouter RFI.\n\nLe Journal en français facile.\n\nDiane Berger.\n\nÀ la une :\n\nL'Espagne toujours sous le choc après le grave accident de train qui a fait 69 morts, hier. C'est la troisième catastrophe de ce type depuis le début de l'année. Les pouvoirs publics espagnols n'ont pas mis assez d'argent dans le chemin de fer. Mais ce n'est pas le seul problème.\n\nPas de majorité claire en Israël après les législatives de mardi dernier. Alors, Benyamin Netanyahu ou Gadi Eisenkot ? Ça ne changera pas grand-chose, de toute façon, selon les habitants du sud du Liban, marqués par la guerre avec leurs voisins.\n\nEt puis la Corée du Nord envahit la Corée du Sud ; pas dans la vraie vie, mais dans le dernier jeu vidéo Call of Duty. C'est pris très au sérieux par les députés d'opposition en Corée du Sud. Selon eux, le pays ne serait pas prêt en cas de guerre dans le monde réel.\n\nUne minute de silence a été respectée à midi en Espagne. Trois jours de deuil national dans le pays après ce terrible accident qui a eu lieu hier matin, près d'Urda, dans la province de Tolède. Deux trains sont entrés en collision – ils se sont percutés –, ce qui a tué 69 personnes. Des dizaines d'autres sont blessées et des secouristes cherchent toujours d'autres personnes portées disparues. C'est le troisième accident de train depuis le début de l'année en Espagne, le deuxième sur cette ligne qui relie Madrid à Séville. Il y avait déjà eu 46 morts et 150 blessés au mois de janvier. Nathanaël Vittrant, c'est ce que l'on appelle une série noire, et elle pose question sur l'état des chemins de fer espagnols.\n\nC'est vrai. L'Espagne a beaucoup investi ces 30 dernières années pour développer ses lignes à grande vitesse : près de 4 000 kilomètres – aujourd'hui, deuxième plus grand réseau du monde, loin derrière la Chine et juste devant la France. Depuis la libéralisation, le trafic a explosé. Le nombre de passagers sur les lignes à grande vitesse en Espagne a doublé entre 2015 et 2024. Mais l'investissement dans les infrastructures, lui, n'a pas suivi. Les dépenses par passager ont même chuté de plus d'un quart sur la même période. Pour Arnaud Aymé, spécialiste des transports au cabinet Sia, cela ne suffit pas, pourtant, à expliquer cette série noire.\n\n« Aujourd'hui, il y a pas de consensus sur le fait que le réseau ferroviaire à grande vitesse espagnol ferait l'objet d'un sous-investissement. Quand bien même ce serait le cas, c'est pas parce qu'il y a un sous-investissement qu'il y a une sous-sécurité. Quand il y a un sous-investissement, il y a des pannes et des retards de trains. Mais le sous-investissement ne peut pas expliquer des problèmes de sécurité ni en Espagne ni ailleurs. »\n\nL'expert rappelle que les deux accidents ont des causes très différentes. Un problème mécanique en janvier, contre, a priori, une panne du réseau de signalisation et un problème de respect des procédures de sécurité cette semaine.\n\n« Après, c'est pas parce que les causes immédiates sont différentes qu'il peut pas y avoir un problème plus systémique, ce problème systémique n'étant pas forcément lié à des moyens financiers : ça peut être lié, aussi, à un problème de culture de sécurité dans ces entreprises-là. »\n\nAvant de pouvoir tirer des conclusions définitives, il faudra, de toute façon, du temps et une enquête approfondie.\n\nNathanaël Vittrant.\n\nEux sont morts alors qu'ils cherchaient à prendre le train : en Ukraine, quatorze personnes ont été tuées par une frappe de drone russe sur un quai de la gare de Dnipro. Dans ce contexte, l'Union européenne appelle, à nouveau, ses alliés à augmenter la pression sur la Russie, je cite, « jusqu'à ce qu'une paix durable et juste soit obtenue ».\n\nIl ne faut pas discréditer « tout le vote arabe ». C'est le message d'Isaac Herzog, le président israélien, après les législatives de mardi – le discréditer, c'est-à-dire le critiquer, dire qu'il n'est pas valide. Les derniers bulletins de vote sont toujours en train d'être comptés en Israël. Il en reste environ 3 %. Mais c'est maintenant quasiment certain : ni le camp du Premier ministre sortant, Benyamin Netanyahu, ni celui de l'opposition n'ont de majorité. Ils ont été perturbés par la montée surprise des partis arabes israéliens. Résultat, certains hommes politiques les accusent de fraude. Le Qatar est, également, pointé du doigt, accusé d'ingérence – de s'être mêlé de l'élection. Le royaume répond que ce n'est pas le cas.\n\nCelui qui arrivera, en tout cas, à créer une coalition pour diriger Israël pourra ensuite décider de la suite des opérations militaires dans la région, notamment au Liban. L'armée israélienne occupe toujours 6 % du territoire dans le sud du pays. Des villages entiers ont été détruits au nom de la lutte contre le Hezbollah. Notre correspondante, Sophie Guignon, est allée parler de cette élection aux habitants de Zaoutar el-Gharbiyeh, un village d'où les troupes israéliennes se sont retirées fin juillet. Reportage.\n\nÀ Zaoutar el-Gharbiyeh, la moitié du village a été complètement détruite, l'autre partiellement. Même la municipalité n'a pas été épargnée. Le maire Abed Ezzedine, élu du mouvement chiite Amal, reçoit dans un préfabriqué.\n\n« Ces élections en Israël ne nous concernent pas. Peu importe qui est élu, ça ne changera rien pour nous. Depuis notre enfance, nous avons grandi avec les mêmes problèmes. Ça a toujours été pareil avec Israël. Peu importe qui est au pouvoir, qui perd ou gagne une élection. »\n\nL'approche de Tel-Aviv sur le Liban ne devrait pas changer. Benyamin Netanyahu pourrait être tenté de lancer une nouvelle guerre pour sortir d'une impasse politique. Et Gadi Eisenkot, ancien général de l'armée, est l'artisan de la doctrine Dahiyé, qui vise à infliger des destructions disproportionnées, au mépris du droit international. Depuis la place centrale du village, Salim Zeineddine observe les zones occupées, à quelques centaines de mètres seulement.\n\n« Cela ne va rien changer pour nous. C'est la même chose. Ils ont la même mentalité. Nous ne voulons pas vivre dans un pays occupé avec un peuple réduit en esclavage. Nous voulons pouvoir vivre avec Israël, chacun de son côté, mais à condition que chacun puisse vivre dans la dignité. »\n\nUn scénario qui semble loin d'être d'actualité. Sophie Guignon, de retour de Zaoutar el-Gharbiyeh, RFI.\n\nPlus à l'est, dans la région, un quatrième pétrolier a pris feu dans le détroit d'Ormuz, selon les forces armées iraniennes, après déjà trois autres navires signalés en flammes ce jeudi. D'après les Gardiens de la Révolution, ces bateaux ont percuté des mines dans ce point de passage stratégique, au cœur de la guerre entre l'Iran et les États-Unis.\n\nUne cheminée de fée s'est effondrée en Turquie. Elle a tué trois personnes. Une cheminée de fée, c'est une grande colonne de roche haute de plusieurs mètres, creusée, formée par des siècles et des siècles de pluie. Elles sont nombreuses dans la région turque de Cappadoce, là où l'accident a eu lieu, dans un site très touristique.\n\nL'actualité en France. L'auteur de l'attentat de Trappes a été mis en examen par un juge antiterroriste. Kevin T. a reconnu avoir agi avec un mobile raciste, selon le procureur antiterroriste à la fin de sa garde à vue. Il dit avoir ciblé spécifiquement des personnes de types musulman, africain ou nord-africain. On le rappelle, cet homme a tué une personne vendredi dernier et blessé plusieurs autres, dont une fillette. Le parquet a demandé son placement derrière les barreaux.\n\nQuand le jeu vidéo s'invite dans la vie politique. En Corée du Sud, les bancs du Parlement s'enflamment, les députés s'agitent autour du dernier Call of Duty, le célèbre jeu vidéo de guerre. Le dernier volet de la série est sorti vendredi dernier et il se passe, justement, en Corée du Sud. Dans l'histoire racontée par le jeu, le pays se fait envahir par la Corée du Nord. Alors, c'est un carton auprès des joueurs sud-coréens – un grand succès, ils sont nombreux à l'acheter et à y jouer. Et les députés conservateurs s'en emparent. Ils utilisent le jeu pour dénoncer le manque de préparation militaire de leur pays. Benoît Gross.\n\nVous êtes un soldat sud-coréen en patrouille quand, soudain, les télés du monde s'affolent.\n\n« La Corée du Nord semble avoir lancé une invasion à grande échelle du territoire sud-coréen. »\n\nCe scénario, c'est celui du nouveau Call of Duty, numéro un des ventes en Corée du Sud. Un succès que l'opposition conservatrice utilise pour attaquer la politique du président Lee Jae Myung, jugée trop naïve face à la Corée du Nord. Tout cela [sur] fond de tensions entre les deux pays : la semaine dernière, trois soldats ont été blessés par l'explosion de mines dans la zone démilitarisée. À l'Assemblée, le député Kim Seok-ki interpelle le ministre de la Culture.\n\n« Le président Kim Jong-un a qualifié cet incident de mise en scène suicidaire sans que l'on puisse y répondre. Dans ce jeu, au moins on réagit avec fermeté face aux provocations et aux manœuvres militaires de la Corée du Nord. C'est ce que les jeunes apprécient. »\n\nL'opposition critique, aussi, la baisse des exercices militaires conjoints avec Washington, alors que, dans le jeu, l'armée sud-coréenne combat aux côtés des Américains. Ce n'est pas la première fois qu'un jeu Call of Duty attise les débats. Il y a six ans, une mission qui mettait en scène le gazage de civils par l'armée russe avait été censurée en Russie.\n\nBenoît Gross.\n\nC'est la fin de ce Journal en français facile.\n\nVous pouvez le retrouver sur notre site dédié francaisfacile.rfi.fr. Vous retrouverez même le script de chaque journal pour vous entraîner, revoir un mot de vocabulaire, une précision. Et il y a même des exercices concoctés – préparés – par l'équipe Langue française de RFI.\n\nPoursuivez votre lecture sur les mêmes thèmes :",
    "tags": [
      "公共交通基建",
      "电子游戏社会议题",
      "公共财政"
    ],
    "words": 1664
  }
];

const QUIZZES: Record<string, { intro: string; title: string; zh: string; questions: CompQuestion[] }> = {
  "rfi-jff-20261120": {
    "intro": "Vous écoutez une édition authentique du « Journal en français facile » (RFI, 2026-11-20). Lisez les questions, écoutez le document deux fois, puis répondez.",
    "title": "Actualité internationale et société (RFI 2026-11-20)",
    "zh": "来源：RFI Français facile（2026-11-20）· 附带核对中文解析",
    "questions": [
      {
        "doc": 0,
        "q": "Quel est le principal message de l'Unicef concernant les enfants ukrainiens ?",
        "options": [
          "Les enfants apprennent à reconnaître les dangers de la guerre au lieu d'aller à l'école.",
          "Les enfants ukrainiens sont envoyés à l'étranger pour leur sécurité.",
          "Les enfants ukrainiens participent à la reconstruction des écoles."
        ],
        "answer": 0,
        "why": "节目中强调孩子们学会识别无人机的声音，而不是正常上学，其他选项未被提及。",
        "skill": "gist",
        "pts": 1
      },
      {
        "doc": 0,
        "q": "Qu'est-ce que la France a demandé après les attaques massives en Ukraine ?",
        "options": [
          "La fermeture de l'ambassade russe à Paris.",
          "L'envoi de troupes françaises en Ukraine.",
          "La convocation immédiate du Conseil de sécurité onusien."
        ],
        "answer": 2,
        "why": "节目中明确说法国要求联合国安理会紧急开会，其他选项没有提到。",
        "skill": "detail",
        "pts": 0.5
      },
      {
        "doc": 0,
        "q": "Quel événement marque le rapprochement entre le Royaume-Uni et l'Union européenne ?",
        "options": [
          "L'organisation d'un sommet sportif commun.",
          "La conclusion d'un traité inédit une décennie après le Brexit.",
          "La suppression des visas entre le Royaume-Uni et l'UE."
        ],
        "answer": 1,
        "why": "节目提到英欧签署新协议，其他选项未被报道。",
        "skill": "detail",
        "pts": 0.5
      },
      {
        "doc": 0,
        "q": "Pourquoi certains pays africains sont-ils déçus lors de la COP31 ?",
        "options": [
          "Ils estiment que les pays riches n'assument pas assez leur responsabilité dans la lutte contre le changement climatique.",
          "Ils n'ont pas été invités à participer aux négociations.",
          "Ils refusent toute transition énergétique."
        ],
        "answer": 0,
        "why": "节目中非洲国家批评富国努力不够，其他选项与内容不符。",
        "skill": "paraphrase",
        "pts": 2
      },
      {
        "doc": 0,
        "q": "Quelle est la réaction d'Anas Séguin face à la critique du magazine Le Point ?",
        "options": [
          "Il décide d'arrêter sa carrière d'opéra.",
          "Il remercie le magazine pour ses compliments.",
          "Il dénonce la banalisation du racisme dans le monde artistique."
        ],
        "answer": 2,
        "why": "节目中他批评种族主义被视为正常，其他选项未提及或与事实不符。",
        "skill": "opinion",
        "pts": 2.5
      },
      {
        "doc": 0,
        "q": "Quelle injustice le ministre sénégalais de l'Environnement dénonce-t-il à la COP31 ?",
        "options": [
          "Les pays africains polluent plus que les pays du Nord.",
          "Les pays développés doivent fournir plus d'aide financière aux pays en développement.",
          "Les pays développés refusent toute négociation sur le climat."
        ],
        "answer": 1,
        "why": "他强调富国有义务提供资金支持，其他选项与节目内容不符。",
        "skill": "detail",
        "pts": 1.5
      },
      {
        "doc": 0,
        "q": "Quelle conséquence la guerre en Ukraine a-t-elle sur d'autres pays européens selon le journal ?",
        "options": [
          "La chute de projectiles russes en Pologne a suscité des condamnations européennes.",
          "Les frontières entre l'Ukraine et l'Union européenne ont été fermées.",
          "L'Union européenne a suspendu tous les échanges commerciaux avec la Russie."
        ],
        "answer": 0,
        "why": "节目中提到导弹落在波兰，引发欧洲国家谴责，其他选项未被报道。",
        "skill": "detail",
        "pts": 1
      }
    ]
  },
  "rfi-jff-20261112": {
    "intro": "Vous écoutez une édition authentique du « Journal en français facile » (RFI, 2026-11-12). Lisez les questions, écoutez le document deux fois, puis répondez.",
    "title": "Francophonie et enjeux internationaux (RFI 2026-11-12)",
    "zh": "来源：RFI Français facile（2026-11-12）· 附带核对中文解析",
    "questions": [
      {
        "doc": 0,
        "q": "Pourquoi Jensen Huang a-t-il quitté la direction de Nvidia selon le journal ?",
        "options": [
          "Il a été nommé à un poste gouvernemental aux États-Unis.",
          "Il a décidé de prendre sa retraite pour raisons de santé.",
          "Il a été impliqué dans une affaire d'espionnage présumée."
        ],
        "answer": 2,
        "why": "新闻中明确提到黄仁勋因涉嫌间谍丑闻被迫离职，其他选项未被提及。",
        "skill": "detail",
        "pts": 0.5
      },
      {
        "doc": 0,
        "q": "Quel est l'objectif principal des discussions en Irlande concernant la guerre en Ukraine ?",
        "options": [
          "Obtenir un cessez-le-feu immédiat sur le terrain.",
          "Amener la Russie à participer à des négociations avec l'Europe.",
          "Organiser une aide humanitaire d'urgence pour l'Ukraine."
        ],
        "answer": 1,
        "why": "德国总理强调让俄罗斯参与谈判是重点，其他选项未在报道中作为主要目标出现。",
        "skill": "gist",
        "pts": 1
      },
      {
        "doc": 0,
        "q": "Quel message Greta Thunberg souhaite-t-elle transmettre à la conférence sur le climat ?",
        "options": [
          "Les actions des dirigeants sont déconnectées de la réalité environnementale.",
          "La planète se régénère grâce aux efforts actuels.",
          "Les jeunes ne s'intéressent plus à la question climatique."
        ],
        "answer": 0,
        "why": "她批评领导人脱离现实，强调生态损失不可逆，其他选项与她的发言不符。",
        "skill": "detail",
        "pts": 1
      },
      {
        "doc": 0,
        "q": "Pourquoi l’étudiante Chinh Er Seng considère-t-elle le sommet de la Francophonie comme important pour le Cambodge ?",
        "options": [
          "Parce que cela marque la fin de la guerre dans le pays.",
          "Parce que cela permet d'apprendre de nouvelles langues étrangères.",
          "Parce que cela offre une visibilité internationale et des opportunités pour les jeunes."
        ],
        "answer": 2,
        "why": "她提到法语带来机会和国家自豪感，其他选项未被她强调或与事实不符。",
        "skill": "inference",
        "pts": 2.5
      },
      {
        "doc": 0,
        "q": "Selon Vichheka Khuon, pourquoi a-t-elle choisi d’apprendre le français à l’école ?",
        "options": [
          "Elle voulait voyager en France dès son enfance.",
          "Ses parents ont pris cette décision pour elle.",
          "C'était la seule langue étrangère proposée à l'école."
        ],
        "answer": 1,
        "why": "她明确说是父母为她选择的，其他选项与她的经历不符。",
        "skill": "detail",
        "pts": 0.5
      },
      {
        "doc": 0,
        "q": "Quel rôle joue la langue française dans la société cambodgienne actuelle, selon l’émission ?",
        "options": [
          "Elle reste un atout culturel et professionnel pour les jeunes et les dirigeants.",
          "Elle est en train de disparaître complètement au profit de l’anglais.",
          "Elle n’a aucune influence sur la langue khmère."
        ],
        "answer": 0,
        "why": "节目中提到法语仍被许多领导人使用，并影响高棉语，其他选项与实际内容不符。",
        "skill": "gist",
        "pts": 1.5
      },
      {
        "doc": 0,
        "q": "Quelle est l’attente principale de Vichheka Khuon concernant le sommet de la Francophonie ?",
        "options": [
          "Que tous les Cambodgiens apprennent le français obligatoirement.",
          "Que le Cambodge devienne le pays le plus francophone d’Asie.",
          "Que le sommet apporte des résultats concrets et une nouvelle image du Cambodge."
        ],
        "answer": 2,
        "why": "她希望峰会带来实际成果并提升国家形象，其他选项未被提及或过于极端。",
        "skill": "opinion",
        "pts": 2
      }
    ]
  },
  "rfi-jff-20261111": {
    "intro": "Vous écoutez une édition authentique du « Journal en français facile » (RFI, 2026-11-11). Lisez les questions, écoutez le document deux fois, puis répondez.",
    "title": "Actualité internationale : crises et mobilisations (RFI 2026-11-11)",
    "zh": "来源：RFI Français facile（2026-11-11）· 附带核对中文解析",
    "questions": [
      {
        "doc": 0,
        "q": "Pourquoi la famille du journaliste Christophe Gleizes espère-t-elle une intervention du président algérien ?",
        "options": [
          "Pour qu’il soit transféré dans une autre prison",
          "Pour obtenir une grâce présidentielle et sa libération",
          "Pour qu’il puisse recevoir des soins médicaux en France"
        ],
        "answer": 1,
        "why": "家属希望总统特本能赦免克里斯托夫·格莱兹，使其获释。其他选项（转监、去法国治病）在报道中未被提及。",
        "skill": "gist",
        "pts": 0.5
      },
      {
        "doc": 0,
        "q": "Quel est le principal motif de la grève générale en Espagne selon les syndicats ?",
        "options": [
          "La défense de l’accès au logement et du pouvoir d’achat",
          "La protestation contre la réforme des retraites",
          "La demande d’augmentation des salaires dans le secteur public"
        ],
        "answer": 0,
        "why": "罢工的主要诉求是住房和购买力问题。其他选项（退休改革、工资提升）未在新闻中作为主要动因出现。",
        "skill": "detail",
        "pts": 1
      },
      {
        "doc": 0,
        "q": "Qu’est-ce qui inquiète la famille de Christophe Gleizes concernant sa santé en prison ?",
        "options": [
          "Il n’a pas accès à ses médicaments habituels",
          "Il a contracté une maladie grave en détention",
          "Il souffre d’une dent et doit subir une opération difficile à organiser"
        ],
        "answer": 2,
        "why": "家人担心他牙齿疼痛且需要手术，但在狱中很难安排。没有提及严重疾病或缺药。",
        "skill": "detail",
        "pts": 1
      },
      {
        "doc": 0,
        "q": "Comment évolue la situation des expulsions de Palestiniens à Jérusalem-Est selon l’ONG Ir Amim ?",
        "options": [
          "Elles sont principalement le fait d’organisations de colons privées",
          "Les expulsions sont de plus en plus orchestrées par l’État israélien",
          "Le nombre de démolitions a diminué depuis 2019"
        ],
        "answer": 1,
        "why": "报告指出以色列国家机构直接主导驱逐，非仅由定居者组织。拆迁数量实际上大幅增加，而不是减少。",
        "skill": "paraphrase",
        "pts": 2
      },
      {
        "doc": 0,
        "q": "Quel sentiment grandit parmi la population espagnole malgré la bonne santé économique du pays ?",
        "options": [
          "Une dégradation des services publics",
          "Une confiance accrue envers le gouvernement",
          "Un optimisme généralisé pour l’avenir"
        ],
        "answer": 0,
        "why": "尽管经济表现良好，西班牙人普遍感到公共服务恶化。其他选项（信任、乐观）与报道内容不符。",
        "skill": "inference",
        "pts": 2.5
      },
      {
        "doc": 0,
        "q": "Pourquoi certains députés et journalistes français sont-ils interdits d’entrée en Russie ?",
        "options": [
          "Suite à une demande de l’Union européenne",
          "Parce qu’ils ont critiqué la politique russe sur les réseaux sociaux",
          "En représailles à l’expulsion d’une chroniqueuse russe de France"
        ],
        "answer": 2,
        "why": "俄方称此举是回应法国驱逐亲克里姆林宫记者。没有提及社交媒体批评或欧盟要求。",
        "skill": "detail",
        "pts": 1.5
      },
      {
        "doc": 0,
        "q": "Quel événement rassemble chaque année des nationalistes à Varsovie ?",
        "options": [
          "Le Festival de la Solidarité",
          "La Marche de l’Indépendance",
          "La Journée de la Constitution"
        ],
        "answer": 1,
        "why": "每年有民族主义者参加的活动是独立游行，其他两个选项未在报道中出现。",
        "skill": "detail",
        "pts": 0.5
      }
    ]
  },
  "rfi-jff-20261104": {
    "intro": "Vous écoutez une édition authentique du « Journal en français facile » (RFI, 2026-11-04). Lisez les questions, écoutez le document deux fois, puis répondez.",
    "title": "Actualité internationale et société : élections, conflits, cyberattaque, littérature (RFI 2026-11-04)",
    "zh": "来源：RFI Français facile（2026-11-04）· 附带核对中文解析",
    "questions": [
      {
        "doc": 0,
        "q": "Quel événement politique majeur s'est produit aux États-Unis selon ce journal ?",
        "options": [
          "Donald Trump a été réélu président pour un second mandat.",
          "Les démocrates ont remporté les élections de mi-mandat et pris le contrôle du Congrès.",
          "Un nouveau parti politique a été créé par des indépendants."
        ],
        "answer": 1,
        "why": "节目明确指出民主党在中期选举中获胜并掌控国会。特朗普连任和新党成立都未被提及。",
        "skill": "gist",
        "pts": 0.5
      },
      {
        "doc": 0,
        "q": "Pourquoi la victoire démocrate en Géorgie est-elle considérée comme historique ?",
        "options": [
          "Parce qu'une femme noire devient gouverneure pour la première fois dans le pays.",
          "Parce que le candidat républicain a soutenu l'immigration.",
          "Parce que la Géorgie n'avait jamais eu de gouverneur auparavant."
        ],
        "answer": 0,
        "why": "节目强调这位女性是美国首位非裔女性州长。其他选项与事实不符。",
        "skill": "detail",
        "pts": 0.5
      },
      {
        "doc": 0,
        "q": "Selon le reportage en Ohio, quel facteur a principalement influencé le vote des Américains ?",
        "options": [
          "L'amélioration de la sécurité routière.",
          "La réforme du système de santé.",
          "La hausse des prix et le coût de l'essence."
        ],
        "answer": 2,
        "why": "记者提到通货膨胀和油价上涨是主要原因，其他选项未被提及。",
        "skill": "detail",
        "pts": 1
      },
      {
        "doc": 0,
        "q": "Comment la défaite de Donald Trump a-t-elle été perçue à l'étranger ?",
        "options": [
          "Elle a provoqué des manifestations en Russie.",
          "Elle a été célébrée en Iran par des rassemblements.",
          "Elle a été ignorée par les médias internationaux."
        ],
        "answer": 1,
        "why": "节目提到伊朗民众庆祝特朗普失败，其他选项未被报道。",
        "skill": "detail",
        "pts": 1
      },
      {
        "doc": 0,
        "q": "Quelles conséquences la cyberattaque a-t-elle eues sur l'Établissement français du sang ?",
        "options": [
          "Les systèmes de réfrigération ont été déréglés, menaçant la conservation du sang.",
          "Des données personnelles ont été volées et publiées en ligne.",
          "L'ensemble des dons de sang a été détruit de façon irréversible."
        ],
        "answer": 0,
        "why": "节目描述冷藏系统被攻击，血液保存受到威胁，但没有数据泄露或全部血液被毁的情况。",
        "skill": "detail",
        "pts": 1.5
      },
      {
        "doc": 0,
        "q": "Pourquoi Yannick Haenel a-t-il écrit son livre primé par le Femina ?",
        "options": [
          "Pour proposer une réforme du système scolaire.",
          "Pour dénoncer la corruption dans l'éducation nationale.",
          "Pour partager une expérience d'enseignant différente de l'image stéréotypée."
        ],
        "answer": 2,
        "why": "作者想表达教师真实经历，反对刻板印象。其他选项未被提及。",
        "skill": "inference",
        "pts": 2.5
      },
      {
        "doc": 0,
        "q": "Quel est le point commun entre les cyberattaques mentionnées en Europe cette semaine ?",
        "options": [
          "Elles ont toutes été revendiquées par le même groupe.",
          "Elles ont ciblé des systèmes frigorifiques dans plusieurs secteurs.",
          "Elles ont uniquement touché des établissements hospitaliers."
        ],
        "answer": 1,
        "why": "节目指出多国冷藏系统被远程激活除霜，其他选项与事实不符。",
        "skill": "gist",
        "pts": 2
      }
    ]
  },
  "rfi-jff-20261103": {
    "intro": "Vous écoutez une édition authentique du « Journal en français facile » (RFI, 2026-11-03). Lisez les questions, écoutez le document deux fois, puis répondez.",
    "title": "Actualité internationale et société (RFI 2026-11-03)",
    "zh": "来源：RFI Français facile（2026-11-03）· 附带核对中文解析",
    "questions": [
      {
        "doc": 0,
        "q": "Quel est l'enjeu principal des élections de mi-mandat aux États-Unis selon le journal ?",
        "options": [
          "Mesurer le soutien des Américains au président en place",
          "Élire un nouveau président pour le pays",
          "Changer la Constitution américaine"
        ],
        "answer": 0,
        "why": "节目中明确指出中期选举的主要目的是衡量美国民众对现任总统的支持度。其他选项（选总统、修改宪法）都不是本次选举的核心内容。",
        "skill": "gist",
        "pts": 0.5
      },
      {
        "doc": 0,
        "q": "Pourquoi les démocrates ont-ils de bonnes chances de gagner la Chambre des représentants ?",
        "options": [
          "Parce que la Chambre est déjà contrôlée par les démocrates",
          "Parce que les républicains ne présentent pas de candidats",
          "Parce que le coût de la vie a augmenté et Trump est impopulaire"
        ],
        "answer": 2,
        "why": "节目提到由于生活成本上升和特朗普不受欢迎，民主党有望获胜。其他选项与事实不符：共和党有候选人，且目前众议院由共和党控制。",
        "skill": "detail",
        "pts": 1
      },
      {
        "doc": 0,
        "q": "Quel est le principal risque pour le Parti démocrate au Sénat ?",
        "options": [
          "Ils n'ont pas assez de candidats pour se présenter",
          "Ils doivent gagner plusieurs sièges traditionnellement républicains",
          "Le Sénat n'est pas renouvelé lors de ces élections"
        ],
        "answer": 1,
        "why": "节目中指出民主党要在参议院获胜，必须赢得一些传统上属于共和党的席位。其他选项（候选人不足、参议院不选举）都不正确。",
        "skill": "paraphrase",
        "pts": 2
      },
      {
        "doc": 0,
        "q": "Quelle est la particularité de la proposition 40 en Californie ?",
        "options": [
          "Elle vise à instaurer une taxe unique sur les milliardaires",
          "Elle propose une réduction d'impôts pour les classes moyennes",
          "Elle concerne l'interdiction de la publicité politique"
        ],
        "answer": 0,
        "why": "节目介绍加州40号提案是对亿万富翁征收一次性税。其他选项（减税、禁止广告）节目未提及。",
        "skill": "detail",
        "pts": 1.5
      },
      {
        "doc": 0,
        "q": "Comment le roi Charles III a-t-il qualifié la période de l'esclavage au Royaume-Uni ?",
        "options": [
          "Un simple malentendu historique",
          "Un épisode glorieux de l'histoire",
          "Une injustice monstrueuse"
        ],
        "answer": 2,
        "why": "节目中查尔斯三世称奴隶制为“可怕的不公正”。其他选项（光荣、误会）与节目内容不符。",
        "skill": "detail",
        "pts": 0.5
      },
      {
        "doc": 0,
        "q": "Quel a été l'impact de la cyberattaque en Europe sur les supermarchés ?",
        "options": [
          "Les paiements par carte ont été suspendus",
          "Les congélateurs ont été déréglés, causant des pertes de marchandises",
          "Les magasins ont dû fermer définitivement"
        ],
        "answer": 1,
        "why": "节目描述黑客攻击导致冷冻柜温度异常，造成货物损失。其他选项（支付中断、永久关闭）节目未提及。",
        "skill": "detail",
        "pts": 1
      },
      {
        "doc": 0,
        "q": "Qu'est-ce qui distingue le roman primé de Philippe Jaenada selon le journal ?",
        "options": [
          "Il s'inspire d'une enquête policière réelle et met en avant l'humour",
          "C'est un roman de science-fiction sur le futur de Paris",
          "Il raconte l'histoire d'un roi anglais célèbre"
        ],
        "answer": 0,
        "why": "节目强调该小说以真实悬案为基础，风格幽默。其他选项（科幻、英国国王）与内容无关。",
        "skill": "inference",
        "pts": 2.5
      }
    ]
  },
  "rfi-jff-20261029": {
    "intro": "Vous écoutez une édition authentique du « Journal en français facile » (RFI, 2026-10-29). Lisez les questions, écoutez le document deux fois, puis répondez.",
    "title": "Actualité internationale et société (RFI 2026-10-29)",
    "zh": "来源：RFI Français facile（2026-10-29）· 附带核对中文解析",
    "questions": [
      {
        "doc": 0,
        "q": "Selon le spécialiste Arnaud Aymé, qu'est-ce qui pourrait expliquer de façon systémique la série d'accidents ferroviaires en Espagne ?",
        "options": [
          "Un sous-investissement financier qui réduit directement la sécurité des voies",
          "Une défaillance liée à la culture et au respect des procédures de sécurité",
          "L'absence totale de formation technique chez les nouveaux conducteurs"
        ],
        "answer": 1,
        "evidence": "le sous-investissement ne peut pas expliquer des problèmes de sécurité ni en Espagne ni ailleurs [...] ça peut être lié, aussi, à un problème de culture de sécurité dans ces entreprises-là.",
        "trapTypes": [
          "导语表象陷阱（专家明确反驳）",
          "同义改写（正确项）",
          "无中生有"
        ],
        "why": "运输专家 Arnaud Aymé 明确反驳了导语中“投入不足导致不安全”的表象推论（指出投资不足只会导致故障和晚点，绝不能解释安全事故），强调更深层的系统性问题可能出在铁路企业的安全文化与安全规程执行上。",
        "skill": "opinion",
        "pts": 2.5
      },
      {
        "doc": 0,
        "q": "Qu'est-ce qui distingue les deux derniers accidents de train en Espagne selon l'expert interrogé ?",
        "options": [
          "Ils ont tous deux été causés par une erreur humaine",
          "Ils sont survenus sur la même ligne",
          "Ils ont des causes techniques différentes"
        ],
        "answer": 2,
        "why": "专家指出一次是机械故障，一次是信号系统和安全程序问题；不是都在同一条线上，也不是都因人为失误。",
        "skill": "detail",
        "pts": 1
      },
      {
        "doc": 0,
        "q": "Pourquoi les habitants du sud du Liban pensent-ils que les élections israéliennes ne changeront pas leur situation ?",
        "options": [
          "Ils n'ont pas le droit de voter aux élections israéliennes",
          "Ils estiment que la politique envers le Liban reste la même quel que soit le dirigeant",
          "Ils pensent que la guerre va bientôt se terminer"
        ],
        "answer": 1,
        "why": "受访村民表示无论谁执政，对黎巴嫩的政策都不会变；不是因为无法投票，也不是因为战争即将结束。",
        "skill": "opinion",
        "pts": 2
      },
      {
        "doc": 0,
        "q": "Quel événement a provoqué trois jours de deuil national en Espagne ?",
        "options": [
          "Une collision mortelle entre deux trains",
          "Un attentat dans une gare",
          "Un incendie dans une usine"
        ],
        "answer": 0,
        "why": "西班牙全国哀悼三天是因为两列火车相撞造成大量死亡，而不是恐怖袭击或工厂火灾。",
        "skill": "detail",
        "pts": 0.5
      },
      {
        "doc": 0,
        "q": "Quel est le reproche principal des députés sud-coréens concernant le jeu vidéo Call of Duty ?",
        "options": [
          "Il donne une mauvaise image de la Corée du Nord",
          "Il encourage la violence chez les jeunes",
          "Il met en lumière un manque de préparation militaire du pays"
        ],
        "answer": 2,
        "why": "南韩议员主要批评游戏暴露了国家军事准备不足，而不是只关注暴力或北韩形象。",
        "skill": "gist",
        "pts": 1.5
      },
      {
        "doc": 0,
        "q": "Quel est le point commun entre les accidents de train en Espagne et l'effondrement d'une cheminée de fée en Turquie ?",
        "options": [
          "Ils sont dus à des actes terroristes",
          "Ils ont tous deux causé de nombreuses victimes",
          "Ils ont eu lieu dans des zones urbaines"
        ],
        "answer": 1,
        "why": "两起事件都造成多人死亡，但不是恐怖袭击，也不是发生在城市。",
        "skill": "inference",
        "pts": 1
      },
      {
        "doc": 0,
        "q": "Quelle est la réaction du président israélien après les élections législatives ?",
        "options": [
          "Il demande de ne pas discréditer le vote arabe",
          "Il félicite le vainqueur des élections",
          "Il annonce une nouvelle coalition gouvernementale"
        ],
        "answer": 0,
        "why": "以色列总统呼吁不要质疑阿拉伯选票的合法性，没有祝贺胜者或宣布新联盟。",
        "skill": "detail",
        "pts": 0.5
      }
    ]
  }
};

/** Four original ~170 WPM (~3 min, 480–540 words) native-speed French broadcast chronicles under CC BY 4.0. */
export const PREBUILT_FAST_CHRONICLES: RealPreset[] = [
  {
    id: "s-chron-semaine4j",
    presetId: "chron-semaine-4j",
    title: "常速专题 01 · 四天工作制与真实生产率｜Semaine de quatre jours : miracle ou mirage ?",
    subtitle: "Chronique éco ~170 WPM（约 3 分钟 · 513 词 · 三人电台辩论 · CC BY 4.0）",
    url: "tts-chronicle:semaine-4j",
    start: 0,
    end: 180,
    created: 1796000100000,
    pace: "native170",
    license: "CC BY 4.0",
    transcript:
      "Claire Dumas : Sept heures quarante-huit sur Radio Méridien, bienvenue dans Le Décryptage. Travailler trente-deux heures payées trente-cinq sur quatre jours sans perdre un euro de salaire ni un point de compétitivité : depuis deux ans, plus de quatre cents PME françaises ont franchi le pas, inspirées par les essais pilotes menés au Royaume-Uni et en Belgique. Miracle social pour réconcilier enfin vie familiale et emploi industriel, ou mirage réservé aux cadres urbains du conseil et de l'informatique ? J'accueille ce matin Marc Bellanger, dirigeant d'une fonderie industrielle de cent dix salariés dans l'Ain, et Nadia Khelifi, sociologue du travail au CNRS.\n\nMarc Bellanger : Bonjour Claire. Chez nous, à Oyonnax, on n'est pas dans un cabinet de conseil parisien : on fait tourner des fours et des presses à haute température, avec des carnets clients très exigeants. Quand j'ai proposé la semaine de quatre jours pour endiguer la fuite de nos techniciens qualifiés, les syndicats craignaient une intensification brutale des cadences. On a donc supprimé les réunions intermédiaires inutiles et réorganisé la maintenance par roulement du lundi au vendredi. Nos chefs d'atelier ont également simplifié les procédures administratives internes qui faisaient perdre près de quarante minutes par équipe chaque matin. Résultat après dix-huit mois : l'absentéisme de courte durée a chuté de trente-huit pour cent, les rebuts sur chaîne ont baissé de douze pour cent et notre chiffre d'affaires est resté stable. Mieux encore, nous recevons désormais des candidatures spontanées d'outilleurs expérimentés venus de toute la région.\n\nNadia Khelifi : L'exemple de monsieur Bellanger est éclairant, mais attention à ne pas généraliser trop vite ce succès à l'ensemble du tissu économique français. Dans notre enquête longitudinale menée auprès de vingt-six entreprises pionnières, tout dépend d'un paramètre décisif : réduit-on réellement le volume horaire hebdomadaire, ou compresse-t-on trente-cinq voire trente-neuf heures sur quatre journées marathon de neuf heures quarante-cinq ? Dans ce second cas, que choisissent hélas la moitié des employeurs, la fatigue cognitive explose le jeudi soir et pénalise durement les parents isolés pour la garde d'enfants. Nous avons même relevé une augmentation sensible des erreurs d'inattention en fin de journée dans plusieurs plateformes administratives.\n\nClaire Dumas : Et qu'en est-il des secteurs déjà en forte tension de recrutement comme l'hôpital public, la logistique frigorifique, les crèches municipales ou la restauration, Nadia Khelifi ?\n\nNadia Khelifi : C'est précisément tout l'angle mort du débat médiatique. Là où la présence physique continue au guichet ou au chevet du patient est indispensable, passer à trente-deux heures sans embauches compensatoires revient mathématiquement à dégrader le service rendu ou à alourdir la charge des équipes restantes. Sans aide transitoire sur les cotisations des bas salaires, on risque de creuser une fracture nette entre les salariés autonomes et les métiers de première ligne.\n\nMarc Bellanger : Je vous rejoins sur un point : la compression sèche sur quatre longues journées est un piège, nous l'avons écartée au bout de six semaines d'essai. En revanche, n'attendons surtout pas une obligation législative uniforme imposée d'en haut à toutes les branches. Ce dispositif ne fonctionne que s'il est négocié atelier par atelier, avec un droit de réversibilité annuel si le carnet de commandes s'effondre.",
    tags: ["~170 WPM 常速", "职场与生产率", "CC BY 4.0"],
    words: 513,
  },
  {
    id: "s-chron-surtourisme",
    presetId: "chron-surtourisme-quotas",
    title: "常速专题 02 · 国家公园限流与过度旅游｜Sur-tourisme : faut-il imposer des quotas ?",
    subtitle: "Chronique société ~170 WPM（约 3 分钟 · 499 词 · 现场连线辩论 · CC BY 4.0）",
    url: "tts-chronicle:surtourisme-quotas",
    start: 0,
    end: 180,
    created: 1796000200000,
    pace: "native170",
    license: "CC BY 4.0",
    transcript:
      "Julien Vasseur : Huit heures douze, Grand Angle sur France Horizon. Réserver gratuitement un créneau horaire avec code barre sur son téléphone portable pour descendre dans une calanque marseillaise, accoster sur une île bretonne ou gravir un sentier alpin : autrefois impensable en France au nom du libre accès républicain aux espaces naturels, le quota journalier s'étend cet été à douze sites classés particulièrement fragiles. Mesure de sauvegarde écologique vitale face à l'érosion accélérée, ou sélection sociale déguisée du paysage ? Avec nous en direct, Élodie Garrel, directrice adjointe d'un parc national méditerranéen, et Bastien Maurin, président d'une fédération régionale de randonneurs.\n\nÉlodie Garrel : Bonjour Julien. Il ne s'agit aucunement de mettre la Méditerranée sous cloche, mais d'empêcher l'effondrement irréversible d'un milieu vivant très étroit. Les chiffres scientifiques parlent d'eux-mêmes : sur le seul promontoire de Sugiton, nous recevions jusqu'à deux mille huit cents visiteurs par jour en juillet, contre un seuil de régénération écologique estimé à quatre cents personnes. Les racines des pins d'Alep centenaires étaient mises à nu par le piétinement incessant, les murets de pierre sèche cédaient et le risque d'incendie devenait ingérable pour les colonnes de pompiers. Depuis l'instauration du permis journalier gratuit plafonné, la couverture végétale reprend dix-neuf pour cent de terrain dès la deuxième saison, sans que les commerçants du port aient subi la moindre baisse de fréquentation globale. Même les pêcheurs côtiers constatent un recul net des déchets plastiques dérivants.\n\nBastien Maurin : Personne de sérieux ne conteste la dégradation des sols calcaires, madame Garrel, et nos propres bénévoles balisent ces chemins toute l'année. Mais regardons lucidement l'effet pervers de vos jauges numériques sur la sociologie du public. D'abord, elles favorisent les touristes hyperconnectés capables de réserver trois semaines à l'avance, au détriment des familles locales qui décident d'une sortie le dimanche matin selon la météo. Pour beaucoup de ménages modestes des quartiers périphériques, la baignade en crique demeure l'unique respiration estivale gratuite. Ensuite, nous observons un report massif de fréquentation vers les vallons voisins non réglementés, qui ne disposent ni de gardes forestiers ni de sanitaires et se dégradent deux fois plus vite.\n\nJulien Vasseur : Élodie Garrel, comment éviter simultanément cet effet domino sur les communes limitrophes et cette barrière technologique qui heurte les habitants ?\n\nÉlodie Garrel : Nous avons entendu cette alerte légitime et ajusté le dispositif dès le mois d'avril : trente pour cent des places sont désormais débloquées seulement quarante-huit heures avant la visite, et un quota téléphonique sans internet est réservé aux offices de tourisme locaux. Nous mutualisons aussi des brigades d'accueil avec les municipalités voisines et des navettes électriques depuis la gare. Quant au report sauvage, nous coordonnons avec la région la suppression des campagnes publicitaires estivales au profit de séjours d'automne et de printemps.\n\nBastien Maurin : C'est une avancée notable sur l'équité d'accès, certes, mais ne nous trompons pas d'échelle : tant que les algorithmes des réseaux sociaux géolocaliseront les mêmes criques secrètes auprès de millions d'abonnés, plafonner trois sentiers sans réguler les navettes maritimes privées ne suffira pas à sauver le littoral.",
    tags: ["~170 WPM 常速", "生态与旅游配额", "CC BY 4.0"],
    words: 499,
  },
  {
    id: "s-chron-ia-univ",
    presetId: "chron-ia-universite",
    title: "常速专题 03 · 高校生成式 AI 与学术诚信｜IA générative à l'université : repenser l'examen",
    subtitle: "Chronique campus ~170 WPM（约 3 分钟 · 485 词 · 教务改革专访 · CC BY 4.0）",
    url: "tts-chronicle:ia-universite",
    start: 0,
    end: 180,
    created: 1796000300000,
    pace: "native170",
    license: "CC BY 4.0",
    transcript:
      "Sophie Marchand : Midi quatorze dans Campus Actu, votre magazine quotidien consacré aux mutations de l'enseignement supérieur francophone. Trois étudiants de licence sur quatre déclarent désormais utiliser chaque semaine un agent conversationnel génératif pour résumer leur bibliographie, traduire des articles scientifiques anglophones ou bâtir le plan détaillé de leurs dissertations à domicile. Face à l'échec manifeste des logiciels de détection automatique et à la multiplication des contentieux disciplinaires devant les commissions universitaires, plusieurs universités françaises réforment en profondeur leurs modalités de contrôle continu. Pour en débattre ce midi, nous recevons le professeur Henri Delmas, vice-président chargé de la pédagogie à l'université de Nantes, et Camille Rivière, représentante élue des étudiants en master d'histoire contemporaine.\n\nHenri Delmas : Bonjour Sophie. Notre commission pédagogique a pris une décision lucide dès la rentrée de septembre dernier : abandonner totalement les détecteurs algorithmiques de texte généré, dont le taux de faux positifs frôlait dix-huit pour cent, en particulier chez nos étudiants internationaux dont la syntaxe académique est plus standardisée. Accuser à tort un étudiant scrupuleux de fraude sur la foi d'une boîte noire statistique invérifiable est moralement injuste et juridiquement intenable devant un juge administratif. En contrepartie, les devoirs rédigés à domicile ne comptent plus seuls : chacun d'eux donne lieu à une soutenance orale éclair de huit minutes sans notes, durant laquelle l'enseignant interroge les choix méthodologiques du candidat et lui demande de définir ses concepts clés.\n\nCamille Rivière : Sur le principe, l'oral de vérification rétablit l'équité bien mieux qu'une interdiction hypocrite que tout le monde contourne. Les étudiants qui travaillent honnêtement en bibliothèque étaient les premiers exaspérés de voir des dossiers intégralement générés en dix secondes décrocher quatorze sur vingt sans le moindre effort de lecture personnelle. Néanmoins, dans la réalité budgétaire très tendue des facultés publiques françaises, cette réforme rapide provoque deux difficultés concrètes majeures. D'une part, dans les amphithéâtres de quatre cents inscrits en première année, les chargés de travaux dirigés n'ont matériellement pas les heures nécessaires pour interroger chaque étudiant sérieusement. Beaucoup d'enseignants vacataires précaires ne sont même pas rémunérés pour cette surcharge hebdomadaire d'auditions individuelles. D'autre part, faute de charte explicite, un même usage d'aide à la reformulation est encouragé par un enseignant de sociologie et sanctionné d'un zéro par son collègue de droit.\n\nSophie Marchand : Professeur Delmas, au-delà de ce flou disciplinaire entre départements, ne voit-on pas émerger une fracture sociale préoccupante entre les étudiants abonnés à des outils payants très performants et ceux cantonnés aux versions gratuites limitées ?\n\nHenri Delmas : Absolument, cette inégalité financière nous préoccupe directement, et c'est pourquoi notre établissement déploie désormais un portail souverain gratuit et hébergé localement pour tous les inscrits, assorti d'un barème transparent commun à toutes les facultés du campus. Nous formons aussi les étudiants à fournir en annexe leur journal de requêtes et à critiquer les sources inventées par le modèle : ce qu'on évalue désormais, ce n'est plus la compilation mécanique, mais la vérification documentaire et l'esprit critique.",
    tags: ["~170 WPM 常速", "高等教育与 AI", "CC BY 4.0"],
    words: 485,
  },
  {
    id: "s-chron-consigne",
    presetId: "chron-consigne-verre",
    title: "常速专题 04 · 玻璃瓶押金制与循环经济｜Le retour de la consigne du verre divise les communes",
    subtitle: "Chronique transition ~170 WPM（约 3 分钟 · 482 词 · 地方政策交锋 · CC BY 4.0）",
    url: "tts-chronicle:consigne-verre",
    start: 0,
    end: 180,
    created: 1796000400000,
    pace: "native170",
    license: "CC BY 4.0",
    transcript:
      "Antoine Mercier : Dix-huit heures vingt-deux sur Radio Hexagone, bienvenue dans Planète Concrète, votre chronique quotidienne de l'écologie territoriale. Laver à haute pression et réemployer une bouteille en verre jusqu'à trente fois de suite au lieu de la broyer au camion-benne et de la refondre dans un four industriel à mille cinq cents degrés : tombée dans l'oubli en France à la fin des années quatre-vingt avec l'essor du jetable, puis expérimentée depuis mai dans quatre régions de l'Ouest et du Nord, la consigne pour réemploi économise jusqu'à soixante-quinze pour cent d'énergie par emballage et réduit d'un tiers la consommation d'eau potable. Pourtant, plusieurs associations d'élus des communes rurales montent vigoureusement au créneau contre sa généralisation précipitée. Débat ce soir entre Hélène Courtois, coordinatrice d'une coopérative régionale de lavage industriel, et Gilles Aubert, maire d'une intercommunalité rurale de Moselle.\n\nHélène Courtois : Bonsoir Antoine. Il faut d'abord lever un malentendu très répandu entre le recyclage par destruction de matière et le véritable réemploi circulaire. Même si les ménages français trient honorablement leurs emballages en verre depuis trente ans, les refondre exige d'immenses volumes de gaz fossile et émet quatre cent cinquante mille tonnes de dioxyde de carbone chaque année dans l'Hexagone. Dans notre réseau pilote, l'acheteur avance vingt centimes d'euro par bouteille et les récupère aussitôt en déposant son contenant intact, sans bouchon, auprès de l'un des six cents commerces affiliés. En dix mois, le taux de retour atteint déjà soixante-huit pour cent sur les jus, bières et soupes locales, grâce à l'adoption de quatre formats standardisés adaptés à l'ensemble des embouteilleurs régionaux.\n\nGilles Aubert : Sur le bilan carbone théorique, madame Courtois, aucun maire responsable ne conteste l'intérêt écologique du lavage industriel. Mais regardez de près l'équation financière quotidienne de nos syndicats intercommunaux en milieu rural ! Aujourd'hui, la revente du calcin, c'est-à-dire le verre collecté dans nos bornes municipales, rapporte près de quarante euros la tonne à notre syndicat de traitement et permet de contenir la taxe d'enlèvement des ordures ménagères acquittée par nos administrés. Si les bouteilles les plus propres partent vers les automates des hypermarchés périphériques, nos recettes chutent tandis que nos camions continuent de tourner pour le verre cassé restant et les pots de confiture non consignés.\n\nAntoine Mercier : Sans oublier la crainte légitime exprimée par les commerçants indépendants des centres-bourgs face aux grandes surfaces, monsieur le maire ?\n\nGilles Aubert : Tout à fait, ce mécanisme risque d'aspirer encore davantage la clientèle motorisée vers les zones commerciales routières : une épicerie de village de soixante mètres carrés n'a ni la place de stocker trente caisses de bouteilles sales, ni quinze mille euros pour installer un automate de déconsignation.\n\nHélène Courtois : C'est une inquiétude légitime, et nous la traitons dans la phase deux : une compensation financière à la tonne est désormais versée aux collectivités partenaires, et des points de collecte mutualisés sur la voie publique évitent aux petits épiciers de gérer seuls la logistique retour.",
    tags: ["~170 WPM 常速", "循环经济与地方财政", "CC BY 4.0"],
    words: 482,
  },
];

const CHRONICLE_QUIZZES: Record<string, { intro: string; title: string; topic: string; zh: string; questions: CompQuestion[] }> = {
  "chron-semaine-4j": {
    intro: "Vous écoutez une chronique économique à débit natif (~170 mots/min) sur l'expérimentation de la semaine de quatre jours en France (CC BY 4.0).",
    title: "Semaine de quatre jours : miracle ou mirage ?",
    topic: "travail",
    zh: "母语常速广播专题（~170 WPM · CC BY 4.0）：探讨法国中小企业试行四天工作制的真实生产率、工时压缩陷阱与一线岗位公平性。",
    questions: [
      {
        doc: 0,
        q: "Quelle motivation initiale a poussé Marc Bellanger à tester la semaine de quatre jours dans son usine ?",
        options: [
          "Répondre à une obligation légale imposée aux fonderies",
          "Freiner le départ de ses ouvriers et techniciens expérimentés",
          "Compenser une chute brutale des commandes à l'exportation",
        ],
        answer: 1,
        evidence: "Quand j'ai proposé la semaine de quatre jours pour endiguer la fuite de nos techniciens qualifiés, les syndicats craignaient une intensification brutale des cadences.",
        trapTypes: ["与末段反对统一立法相悖", "同义改写（正确项）", "无中生有"],
        why: "Marc Bellanger 明确表示提出四天工作制是为了遏制熟练技术人员流失（endiguer la fuite de nos techniciens qualifiés）。",
        skill: "detail",
        pts: 1,
      },
      {
        doc: 0,
        q: "Comment la fonderie d'Oyonnax a-t-elle maintenu son activité sans augmenter les cadences ?",
        options: [
          "En automatisant entièrement l'atelier de pressage la nuit",
          "En embauchant une équipe intérimaire dédiée au vendredi",
          "En élaguant certaines réunions et en étalant l'entretien sur cinq jours",
        ],
        answer: 2,
        evidence: "On a donc supprimé les réunions intermédiaires inutiles et réorganisé la maintenance par roulement du lundi au vendredi.",
        trapTypes: ["无中生有", "无中生有", "同义改写（正确项）"],
        why: "工厂砍掉了无用的中间会议，并将设备维护改为周一至周五轮班运行。",
        skill: "paraphrase",
        pts: 1,
      },
      {
        doc: 0,
        q: "Après un an et demi d'essai dans cette fonderie, quel bilan chiffré est constaté ?",
        options: [
          "Une hausse de douze pour cent du chiffre d'affaires annuel",
          "Un net recul des arrêts courts et des pièces défectueuses",
          "Une disparition complète des heures supplémentaires payées",
        ],
        answer: 1,
        evidence: "Résultat après dix-huit mois : l'absentéisme de courte durée a chuté de trente-huit pour cent, les rebuts sur chaîne ont baissé de douze pour cent et notre chiffre d'affaires est resté stable.",
        trapTypes: ["偷换指标（12%是废品率下降，营业额持平）", "同义改写（正确项）", "无中生有"],
        why: "短期缺勤率下降38%，产线废品率下降12%，营业额保持稳定。",
        skill: "detail",
        pts: 0.5,
      },
      {
        doc: 0,
        q: "Selon Nadia Khelifi, quelle pratique adoptée par la moitié des entreprises s'avère néfaste ?",
        options: [
          "Imposer le télétravail intégral sans indemnité d'équipement",
          "Concentrer la même durée de travail sur quatre journées très longues",
          "Diminuer les salaires proportionnellement au temps libéré",
        ],
        answer: 1,
        evidence: "Dans ce second cas, que choisissent hélas la moitié des employeurs, la fatigue cognitive explose le jeudi soir et pénalise durement les parents isolés pour la garde d'enfants.",
        trapTypes: ["无中生有", "核心论点同义改写（正确项）", "与同工同酬前提相反"],
        why: "半数雇主把35甚至39小时硬塞进四天近10小时的超长工作日，导致周四晚认知疲劳激增并冲击单亲家长育儿。",
        skill: "opinion",
        pts: 1.5,
      },
      {
        doc: 0,
        q: "Quel risque social majeur la sociologue pointe-t-elle pour les métiers de première ligne ?",
        options: [
          "Un fossé grandissant face aux postes autonomes faute de recrutements",
          "Un remplacement accéléré du personnel hospitalier par des sous-traitants",
          "Un refus massif des usagers d'accepter des horaires administratifs réduits",
        ],
        answer: 0,
        evidence: "Sans aide transitoire sur les cotisations des bas salaires, on risque de creuser une fracture nette entre les salariés autonomes et les métiers de première ligne.",
        trapTypes: ["同义改写（正确项）", "无中生有", "无中生有"],
        why: "医院、物流、餐饮等需持续在岗的行业若不补充招人或减免低薪社保，将加剧自主白领与一线岗位之间的裂痕。",
        skill: "inference",
        pts: 2,
      },
      {
        doc: 0,
        q: "Sur quel point précis l'industriel rejoint-il l'analyse de la sociologue ?",
        options: [
          "L'urgence de voter une obligation nationale identique pour tous",
          "Le danger de condenser les heures sans réduire la durée hebdomadaire",
          "La nécessité de subventionner durablement les cabinets de conseil",
        ],
        answer: 1,
        evidence: "Je vous rejoins sur un point : la compression sèche sur quatre longues journées est un piège, nous l'avons écartée au bout de six semaines d'essai.",
        trapTypes: ["与他反对统一立法的立场相反", "同义改写（正确项）", "无中生有"],
        why: "Marc Bellanger 明确赞同：单纯压缩成四个超长工作日的做法是个陷阱，他厂里试了六周就否决了。",
        skill: "opinion",
        pts: 0.5,
      },
      {
        doc: 0,
        q: "À quelle condition Marc Bellanger juge-t-il ce modèle viable dans l'industrie ?",
        options: [
          "Qu'il soit négocié localement et puisse être revu en cas de crise d'activité",
          "Qu'il soit réservé uniquement aux salariés ayant dix ans d'ancienneté",
          "Qu'il s'accompagne d'un gel pluriannuel des négociations salariales",
        ],
        answer: 0,
        evidence: "Ce dispositif ne fonctionne que s'il est négocié atelier par atelier, avec un droit de réversibilité annuel si le carnet de commandes s'effondre.",
        trapTypes: ["否定限定 ne… que 同义改写（正确项）", "无中生有", "无中生有"],
        why: "ne fonctionne que s'il est négocié atelier par atelier, avec un droit de réversibilité annuel：必须逐车间协商，并在订单骤降时保留年度可逆调整权。",
        skill: "negation",
        pts: 2.5,
      },
    ],
  },
  "chron-surtourisme-quotas": {
    intro: "Vous écoutez un débat radiophonique à débit natif (~170 mots/min) sur les quotas de fréquentation dans les parcs nationaux (CC BY 4.0).",
    title: "Sur-tourisme : faut-il imposer des quotas ?",
    topic: "environnement",
    zh: "母语常速广播专题（~170 WPM · CC BY 4.0）：聚焦法国自然保护区预约限流制度的生态修复成效、数字门槛与周边溢出效应。",
    questions: [
      {
        doc: 0,
        q: "Quel constat écologique a motivé le plafonnement des entrées à Sugiton ?",
        options: [
          "Une pollution marine causée par les bateaux de croisière géants",
          "Une affluence estivale sept fois supérieure à la capacité du milieu",
          "L'effondrement d'une falaise ayant blessé plusieurs promeneurs",
        ],
        answer: 1,
        evidence: "sur le seul promontoire de Sugiton, nous recevions jusqu'à deux mille huit cents visiteurs par jour en juillet, contre un seuil de régénération écologique estimé à quatre cents personnes.",
        trapTypes: ["偷换原因", "数值比值同义归纳（2800 vs 400）（正确项）", "无中生有"],
        why: "7月单日游客高达2800人，是生态再生承载阈值（400人）的7倍，导致阿勒颇松树根裸露且火灾救援风险失控。",
        skill: "detail",
        pts: 1,
      },
      {
        doc: 0,
        q: "Quel résultat Élodie Garrel met-elle en avant depuis la mise en place du permis gratuit ?",
        options: [
          "Une repousse notable de la flore sans pénaliser le commerce local",
          "Une augmentation des recettes fiscales grâce aux amendes dressées",
          "Une division par deux du budget consacré aux secours incendie",
        ],
        answer: 0,
        evidence: "Depuis l'instauration du permis journalier gratuit plafonné, la couverture végétale reprend dix-neuf pour cent de terrain dès la deuxième saison, sans que les commerçants du port aient subi la moindre baisse de fréquentation globale.",
        trapTypes: ["同义改写（正确项）", "无中生有（许可免费，未提罚款增收）", "无中生有"],
        why: "第二季植被覆盖率已回升19%，同时港口商户整体客流并未下降。",
        skill: "paraphrase",
        pts: 1,
      },
      {
        doc: 0,
        q: "Pourquoi Bastien Maurin estime-t-il que la réservation numérique désavantage les habitants ?",
        options: [
          "Parce que le site internet facture des frais de dossier aux résidents",
          "Parce qu'elle écarte les sorties spontanées décidées au dernier moment",
          "Parce que le réseau mobile est coupé à l'entrée des massifs",
        ],
        answer: 1,
        evidence: "elles favorisent les touristes hyperconnectés capables de réserver trois semaines à l'avance, au détriment des familles locales qui décident d'une sortie le dimanche matin selon la météo.",
        trapTypes: ["与免费预约相悖", "同义改写（正确项）", "无中生有"],
        why: "线上配额偏向提前三周抢票的游客，损害了周日早上看天气临时决定出行的本地家庭。",
        skill: "opinion",
        pts: 1.5,
      },
      {
        doc: 0,
        q: "Quel effet secondaire géographique le représentant des randonneurs dénonce-t-il ?",
        options: [
          "L'abandon complet des sentiers balisés de haute montagne",
          "Un déplacement massif des visiteurs vers des sites voisins non équipés",
          "La construction illégale de parkings privés aux portes du parc",
        ],
        answer: 1,
        evidence: "Ensuite, nous observons un report massif de fréquentation vers les vallons voisins non réglementés, qui ne disposent ni de gardes forestiers ni de sanitaires et se dégradent deux fois plus vite.",
        trapTypes: ["无中生有", "同义改写（正确项）", "无中生有"],
        why: "大量游客转而涌向周边未限流、缺乏护林员与卫生设施的山谷，导致那些地方退化速度翻倍。",
        skill: "detail",
        pts: 0.5,
      },
      {
        doc: 0,
        q: "Quel ajustement concret le parc a-t-il introduit cette année pour corriger la fracture numérique ?",
        options: [
          "L'ouverture d'un contingent de dernière minute et d'un accès par téléphone",
          "La suppression totale des réservations pour les habitants du département",
          "L'envoi postal d'une carte annuelle gratuite à chaque foyer riverain",
        ],
        answer: 0,
        evidence: "trente pour cent des places sont désormais débloquées seulement quarante-huit heures avant la visite, et un quota téléphonique sans internet est réservé aux offices de tourisme locaux.",
        trapTypes: ["同义改写（正确项）", "夸大（未完全取消预约）", "无中生有"],
        why: "今年将30%名额留到行前48小时才放票，并为当地旅游局预留免上网电话预约配额。",
        skill: "detail",
        pts: 0.5,
      },
      {
        doc: 0,
        q: "Quelle stratégie de communication régionale accompagne désormais ces quotas ?",
        options: [
          "Taxer la publicité des compagnies aériennes à bas coût",
          "Arrêter la promotion d'été pour encourager le tourisme hors saison",
          "Diffuser des messages d'alerte sur les autoroutes du Sud",
        ],
        answer: 1,
        evidence: "nous coordonnons avec la région la suppression des campagnes publicitaires estivales au profit de séjours d'automne et de printemps.",
        trapTypes: ["无中生有", "同义改写（正确项）", "无中生有"],
        why: "与大区协同取消夏季旅游广告宣传，转而引导春秋错峰出行。",
        skill: "paraphrase",
        pts: 2,
      },
      {
        doc: 0,
        q: "En conclusion, quelle limite persistante Bastien Maurin souligne-t-il ?",
        options: [
          "Le manque d'effectifs policiers pour verbaliser les campeurs nocturnes",
          "La viralité des réseaux sociaux combinée à l'absence d'encadrement des bateaux privés",
          "Le refus des municipalités côtières de financer l'entretien des chemins",
        ],
        answer: 1,
        evidence: "tant que les algorithmes des réseaux sociaux géolocaliseront les mêmes criques secrètes auprès de millions d'abonnés, plafonner trois sentiers sans réguler les navettes maritimes privées ne suffira pas à sauver le littoral.",
        trapTypes: ["无中生有", "让步与条件限定精准改写（正确项）", "无中生有"],
        why: "只要社交媒体算法仍在向数百万粉丝精准推送隐秘海湾，且私人海上摆渡船不受监管，仅限制三条陆上步道不足以保护海岸。",
        skill: "negation",
        pts: 2.5,
      },
    ],
  },
  "chron-ia-universite": {
    intro: "Vous écoutez une émission universitaire à débit natif (~170 mots/min) consacrée à l'IA générative et aux examens (CC BY 4.0).",
    title: "IA générative à l'université : repenser l'examen",
    topic: "education",
    zh: "母语常速广播专题（~170 WPM · CC BY 4.0）：探讨法国高校弃用 AI 文本检测器、引入 8 分钟无稿口头答辩与校内主权算力平台的改革争议。",
    questions: [
      {
        doc: 0,
        q: "Pourquoi l'université de Nantes a-t-elle renoncé aux logiciels détectant les textes générés par IA ?",
        options: [
          "Leur coût de licence annuel dépassait le budget informatique",
          "Ils accusaient injustement trop d'étudiants, surtout non francophones natifs",
          "La Commission européenne en a formellement interdit l'usage",
        ],
        answer: 1,
        evidence: "abandonner totalement les détecteurs algorithmiques de texte généré, dont le taux de faux positifs frôlait dix-huit pour cent, en particulier chez nos étudiants internationaux dont la syntaxe académique est plus standardisée.",
        trapTypes: ["无中生有", "同义改写（正确项）", "无中生有"],
        why: "算法检测器误判率接近18%，尤其容易误伤句式较规范的国际学生，法律上站不住脚。",
        skill: "detail",
        pts: 1.5,
      },
      {
        doc: 0,
        q: "Par quel dispositif les devoirs faits à la maison sont-ils désormais complétés à Nantes ?",
        options: [
          "Par un examen final manuscrit de quatre heures en loge fermée",
          "Par un bref entretien oral de vérification sans support écrit",
          "Par une évaluation croisée anonyme entre camarades de promotion",
        ],
        answer: 1,
        evidence: "En contrepartie, les devoirs rédigés à domicile ne comptent plus seuls : chacun d'eux donne lieu à une soutenance orale éclair de huit minutes sans notes, durant laquelle l'enseignant interroge les choix méthodologiques du candidat et lui demande de définir ses concepts clés.",
        trapTypes: ["无中生有", "同义改写（正确项）", "无中生有"],
        why: "每份课后作业都不再单独计分，必须配合8分钟脱稿快闪口头答辩（soutenance orale éclair de huit minutes sans notes）。",
        skill: "paraphrase",
        pts: 1,
      },
      {
        doc: 0,
        q: "Quelle est la position de départ de Camille Rivière sur cet oral de vérification ?",
        options: [
          "Elle le juge plus juste sur le principe qu'une interdiction inapplicable",
          "Elle demande son annulation immédiate au nom du syndicat étudiant",
          "Elle préférerait le maintien des détecteurs automatiques de plagiat",
        ],
        answer: 0,
        evidence: "Sur le principe, l'oral de vérification rétablit l'équité bien mieux qu'une interdiction hypocrite que tout le monde contourne.",
        trapTypes: ["同义改写（正确项）", "忽视让步结构（她原则上认可）", "与原文相反"],
        why: "Camille Rivière 首先肯定：原则上口头核查比人人绕过的虚伪禁令更能恢复公平。",
        skill: "opinion",
        pts: 1,
      },
      {
        doc: 0,
        q: "Quel obstacle matériel la représentante étudiante soulève-t-elle en première année ?",
        options: [
          "Le manque de salles équipées d'ordinateurs sécurisés",
          "L'impossibilité horaire de faire passer des oraux sérieux à des promotions géantes",
          "L'absence de connexion haut débit dans les résidences universitaires",
        ],
        answer: 1,
        evidence: "dans les amphithéâtres de quatre cents inscrits en première année, les chargés de travaux dirigés n'ont matériellement pas les heures nécessaires pour interroger chaque étudiant sérieusement.",
        trapTypes: ["无中生有", "同义改写（正确项）", "无中生有"],
        why: "大一400人的大课中，习题课教师根本没有足够工时逐一认真口试每位学生。",
        skill: "detail",
        pts: 0.5,
      },
      {
        doc: 0,
        q: "Quel second problème découle de l'absence de règles communes entre départements ?",
        options: [
          "Une disparité arbitraire des sanctions d'un professeur à l'autre",
          "Un retard de trois mois dans la publication des relevés de notes",
          "Une fuite massive d'étudiants vers les écoles de commerce privées",
        ],
        answer: 0,
        evidence: "faute de charte explicite, un même usage d'aide à la reformulation est encouragé par un enseignant de sociologie et sanctionné d'un zéro par son collègue de droit.",
        trapTypes: ["同义归纳（正确项）", "无中生有", "无中生有"],
        why: "由于缺乏明确章程，同样的辅助改写用法在社会学老师那里受鼓励，在法学同事那里却被判零分。",
        skill: "inference",
        pts: 2,
      },
      {
        doc: 0,
        q: "Comment l'université répond-elle à l'écart entre outils payants et versions gratuites ?",
        options: [
          "En remboursant la moitié des abonnements privés aux boursiers",
          "En mettant à disposition de tous un outil interne gratuit hébergé sur place",
          "En bloquant le réseau sans fil dans toutes les bibliothèques",
        ],
        answer: 1,
        evidence: "c'est pourquoi notre établissement déploie désormais un portail souverain gratuit et hébergé localement pour tous les inscrits, assorti d'un barème transparent commun à toutes les facultés du campus.",
        trapTypes: ["无中生有", "同义改写（正确项）", "无中生有"],
        why: "学校为全体注册学生免费部署了本地托管的主权算力门户。",
        skill: "detail",
        pts: 0.5,
      },
      {
        doc: 0,
        q: "Quelle compétence académique nouvelle est désormais au cœur de la notation ?",
        options: [
          "La mémorisation par cœur des dates et bibliographies complètes",
          "La capacité à tracer ses requêtes et à débusquer les références fictives",
          "La programmation informatique d'algorithmes linguistiques",
        ],
        answer: 1,
        evidence: "Nous formons aussi les étudiants à fournir en annexe leur journal de requêtes et à critiquer les sources inventées par le modèle : ce qu'on évalue désormais, ce n'est plus la compilation mécanique, mais la vérification documentaire et l'esprit critique.",
        trapTypes: ["与不再考机械汇编相反", "ne… plus… mais 结构精准改写（正确项）", "无中生有"],
        why: "评分核心已从机械资料汇编转向附交提示词日志、核查模型杜撰文献与批判性思维。",
        skill: "negation",
        pts: 2.5,
      },
    ],
  },
  "chron-consigne-verre": {
    intro: "Vous écoutez un magazine environnemental à débit natif (~170 mots/min) sur le retour de la consigne du verre (CC BY 4.0).",
    title: "Le retour de la consigne du verre divise les communes",
    topic: "consommation",
    zh: "母语常速广播专题（~170 WPM · CC BY 4.0）：剖析玻璃瓶押金重用制在节能减排成效之外，与基层市政回收财政及乡村小店空间成本的现实博弈。",
    questions: [
      {
        doc: 0,
        q: "Quel avantage énergétique distingue le réemploi par lavage de la refonte du verre ?",
        options: [
          "Il réduit des trois quarts l'énergie consommée par bouteille",
          "Il supprime totalement le transport routier des boissons",
          "Il permet de fabriquer du verre incassable dès le premier cycle",
        ],
        answer: 0,
        evidence: "expérimentée depuis mai dans quatre régions de l'Ouest et du Nord, la consigne pour réemploi économise jusqu'à soixante-quinze pour cent d'énergie par emballage et réduit d'un tiers la consommation d'eau potable.",
        trapTypes: ["75% = les trois quarts 数值同义改写（正确项）", "无中生有", "无中生有"],
        why: "清洗重用比1500度高温回炉重熔每个包装最高节省75%（四分之三）的能源。",
        skill: "paraphrase",
        pts: 1,
      },
      {
        doc: 0,
        q: "Qu'est-ce qui a facilité un taux de retour de 68 % dans le réseau pilote d'Hélène Courtois ?",
        options: [
          "Une consigne fixée à deux euros par bouteille achetée",
          "L'harmonisation des contenants autour de quatre modèles communs",
          "La livraison gratuite des casiers vides par la poste",
        ],
        answer: 1,
        evidence: "En dix mois, le taux de retour atteint déjà soixante-huit pour cent sur les jus, bières et soupes locales, grâce à l'adoption de quatre formats standardisés adaptés à l'ensemble des embouteilleurs régionaux.",
        trapTypes: ["偷换数字（押金为20欧分而非2欧元）", "同义改写（正确项）", "无中生有"],
        why: "十个月内回收率达68%，得益于采用了四种标准化通用瓶型（quatre formats standardisés）。",
        skill: "detail",
        pts: 0.5,
      },
      {
        doc: 0,
        q: "Pourquoi le maire Gilles Aubert redoute-t-il un déséquilibre financier pour son syndicat ?",
        options: [
          "Les communes devront payer l'électricité des usines de lavage",
          "La perte du verre entier prive la collectivité d'une recette de revente tout en laissant les tournées",
          "L'État menace de supprimer toutes les dotations rurales dès l'hiver",
        ],
        answer: 1,
        evidence: "Si les bouteilles les plus propres partent vers les automates des hypermarchés périphériques, nos recettes chutent tandis que nos camions continuent de tourner pour le verre cassé restant et les pots de confiture non consignés.",
        trapTypes: ["无中生有", "同义改写（正确项）", "无中生有"],
        why: "市政回收箱里的碎玻璃（calcin）转售每吨可创收近40欧元以平抑垃圾税；若整瓶流向郊区大超回收机，市政收入骤降而收运碎玻璃的卡车成本仍在。",
        skill: "inference",
        pts: 2,
      },
      {
        doc: 0,
        q: "À quoi sert actuellement l'argent tiré de la revente du verre collecté dans les bornes municipales ?",
        options: [
          "À financer la rénovation des écoles primaires du canton",
          "À limiter la hausse de la fiscalité locale sur les déchets ménagers",
          "À subventionner l'ouverture de brasseries artisanales",
        ],
        answer: 1,
        evidence: "la revente du calcin, c'est-à-dire le verre collecté dans nos bornes municipales, rapporte près de quarante euros la tonne à notre syndicat de traitement et permet de contenir la taxe d'enlèvement des ordures ménagères acquittée par nos administrés.",
        trapTypes: ["无中生有", "同义改写（正确项）", "无中生有"],
        why: "每吨近40欧元的碎玻璃转售收入用于抑制居民生活垃圾清运税（contenir la taxe d'enlèvement des ordures ménagères）。",
        skill: "detail",
        pts: 1,
      },
      {
        doc: 0,
        q: "Quelle double contrainte pèse sur les petites épiceries de village selon l'élu ?",
        options: [
          "Le manque de surface d'entreposage et le prix élevé des machines de reprise",
          "L'interdiction sanitaire de manipuler des bouteilles ayant contenu du lait",
          "La grève des transporteurs régionaux chaque fin de semaine",
        ],
        answer: 0,
        evidence: "une épicerie de village de soixante mètres carrés n'a ni la place de stocker trente caisses de bouteilles sales, ni quinze mille euros pour installer un automate de déconsignation.",
        trapTypes: ["ni… ni 双重否定同义改写（正确项）", "无中生有", "无中生有"],
        why: "60平米的乡村小店既没有空间堆放30箱脏空瓶，也掏不出1.5万欧元购置自动退瓶机。",
        skill: "negation",
        pts: 2.5,
      },
      {
        doc: 0,
        q: "Quel ton Hélène Courtois adopte-t-elle face aux objections du maire ?",
        options: [
          "Un ton méprisant qui rejette toute responsabilité sur les élus",
          "Un ton constructif reconnaissant le problème et présentant des correctifs",
          "Un ton fataliste annonçant l'arrêt prochain de l'expérimentation",
        ],
        answer: 1,
        evidence: "C'est une inquiétude légitime, et nous la traitons dans la phase deux : une compensation financière à la tonne est désormais versée aux collectivités partenaires, et des points de collecte mutualisés sur la voie publique évitent aux petits épiciers de gérer seuls la logistique retour.",
        trapTypes: ["与原文礼貌认可相反", "态度归纳（正确项）", "与推进二期相反"],
        why: "她首先认可市长的顾虑合理（inquiétude légitime），并介绍二期按吨财政补偿与公共共享回收点两项改进措施。",
        skill: "opinion",
        pts: 1.5,
      },
      {
        doc: 0,
        q: "Comment la phase deux soulage-t-elle concrètement les petits commerçants de bourg ?",
        options: [
          "En les dispensant de vendre toute boisson consignée",
          "En installant des bornes de retour partagées dans l'espace public",
          "En obligeant les clients à laver eux-mêmes les bouteilles à l'eau bouillante",
        ],
        answer: 1,
        evidence: "des points de collecte mutualisés sur la voie publique évitent aux petits épiciers de gérer seuls la logistique retour.",
        trapTypes: ["无中生有", "同义改写（正确项）", "无中生有"],
        why: "在公共道路设立共享回收点（points de collecte mutualisés sur la voie publique），免去小杂货店独自承担逆向物流。",
        skill: "detail",
        pts: 0.5,
      },
    ],
  },
};

/** Offline 7-question DELF B2 quiz for a bundled RFI preset or ~170 WPM chronicle (9 pts, no AI key needed). */
export function realPresetQuiz(presetId?: string): CompExercise | null {
  if (!presetId) return null;
  const cq = CHRONICLE_QUIZZES[presetId];
  if (cq) {
    const cSrc = PREBUILT_FAST_CHRONICLES.find((s) => s.presetId === presetId);
    if (!cSrc?.transcript) return null;
    return {
      intro: cq.intro,
      title: cq.title,
      topic: cq.topic,
      form: "long",
      docs: [{ text: cSrc.transcript, zh: cq.zh }],
      questions: cq.questions,
    };
  }
  const q = QUIZZES[presetId];
  const src = PREBUILT_REAL_SOURCES.find((s) => s.presetId === presetId);
  if (!q || !src?.transcript) return null;
  return {
    intro: q.intro,
    title: q.title,
    topic: "medias-presse",
    form: "long",
    docs: [{ text: src.transcript, zh: q.zh }],
    questions: q.questions,
  };
}
