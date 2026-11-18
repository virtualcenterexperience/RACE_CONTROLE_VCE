/* VCE conversational coaching and local keyword retrieval. */
(function (root) {
  'use strict';

  const normalize = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[’']/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim();
  const stopWords = new Set(('bonjour salut merci avec dans pour cette voiture quand elle sont plus moins avoir ressenti aussi mais alors depuis comme donc cela tout tous toute etre fait peux peut sur les des une aux mon mes ton tes est pas que qui par comment pourquoi quel quelle quels quelles faire dois doit encore peu du de la le et en un a au je j ai tu il ca ce me se ne d l c on ou si').split(' '));
  const words = text => normalize(text).split(' ').filter(word => word.length > 2 && !stopWords.has(word));
  const topics = [
    {
      id: 'front', issue: 'front', terms: ['sous virage', 'sous vire', 'sousvire', 'souvire', 'understeer', 'avant glisse', 'tire tout droit', 'tourne pas', 'avant elargit', 'pousse de l avant'],
      explanation: 'Quand l’avant élargit malgré le volant, il manque de l’adhérence pour la vitesse et l’angle demandés.',
      action: 'Entre un peu moins vite et braque progressivement. Si tu es déjà en train de glisser, desserre légèrement la direction pour aider les pneus avant à retrouver de l’adhérence.',
      alternative: 'Compare maintenant deux passages avec la même vitesse d’entrée et des remises de gaz différentes. Une accélération trop tôt peut aussi faire élargir la voiture.',
      question: 'L’avant commence à glisser au freinage, à la corde ou quand tu remets les gaz ?'
    },
    {
      id: 'rear', issue: 'rear', terms: ['survirage', 'survire', 'oversteer', 'arriere decroche', 'arriere glisse', 'arriere chasse', 'perds l arriere', 'tete a queue', 'gondole'],
      explanation: 'Un arrière qui décroche indique que les pneus arrière perdent leur marge d’adhérence. La correction dépend surtout du moment où cela commence.',
      action: 'Rends les mouvements de pédales et de volant plus progressifs. Au freinage, surveille le relâchement et les rétrogradages. À l’accélération, dose les gaz pendant que tu redresses la direction.',
      alternative: 'Regarde si le décrochage coïncide avec un rétrogradage, une bosse ou une intervention du TC. Compare deux passages en gardant le même rapport pour isoler la transmission.',
      question: 'L’arrière part avant la corde ou à la remise des gaz ?'
    },
    {
      id: 'lock', issue: 'lock', terms: ['blocage', 'bloque les roues', 'roues bloquent', 'roues bloquees', 'lockup', 'je bloque', 'pneus bloquent'],
      explanation: 'Une roue se bloque quand le freinage demandé dépasse son adhérence disponible.',
      action: 'Relâche progressivement la pression quand le blocage commence. Vérifie si ce sont les roues avant ou arrière et si le blocage apparaît en ligne droite ou avec du volant.',
      alternative: 'Compare un freinage avec le même repère et un pic de pression plus faible. Observe aussi si un rétrogradage trop rapide déclenche le blocage arrière.',
      question: 'Quelles roues se bloquent et est-ce que ta voiture dispose de l’ABS ?'
    },
    {
      id: 'brake_late', issue: 'braking', terms: ['freine trop tard', 'freinage trop tardif', 'rate mon freinage', 'rate le freinage', 'depasse le virage', 'distance de freinage', 'freinage trop long'],
      explanation: 'Un freinage commencé trop tard oblige souvent à garder trop de frein en tournant et compromet la sortie.',
      action: 'Choisis un repère fixe un peu plus tôt. Cherche d’abord à rejoindre la corde avec une voiture stable, puis rapproche le repère progressivement sur des passages comparables.',
      alternative: 'Vérifie la vitesse atteinte avant le repère et la pente de relâchement du frein. Une entrée plus rapide peut donner l’impression que le même repère fonctionne moins bien.',
      question: 'Tu dépasses la corde ou tu arrives à tourner mais tu ressors trop lentement ?'
    },
    {
      id: 'brake_early', terms: ['freine trop tot', 'freinage trop precoce', 'freine trop loin'],
      explanation: 'Freiner trop tôt peut te laisser longtemps en roue libre avant le virage.',
      action: 'Garde un repère reproductible et vérifie d’abord la fin du freinage. Rapproche ensuite légèrement le début du freinage, sans dégrader ta trajectoire de sortie.',
      alternative: 'Compare la durée de roue libre entre le frein et les gaz. Une meilleure transition peut faire gagner du temps avant même de déplacer le repère.',
      question: 'Tu attends avant de tourner ou tu attends avant de remettre les gaz ?'
    },
    {
      id: 'trail', issue: 'braking', terms: ['trail braking', 'trailbraking', 'freinage degressif', 'relacher le frein', 'relachement frein', 'freiner en tournant'],
      explanation: 'Le freinage dégressif consiste à réduire progressivement la pression du frein à mesure que tu demandes de la direction.',
      action: 'Commence par un freinage stable en ligne droite. À l’inscription, relâche progressivement au lieu de couper le frein d’un coup ou de garder une forte pression jusqu’à la corde.',
      alternative: 'Observe la courbe de frein et recherche un relâchement continu. Compare des passages avec le même point de freinage pour distinguer la technique du choix de repère.',
      question: 'La voiture tourne trop peu, ou l’arrière devient instable quand tu relâches ?'
    },
    {
      id: 'abs', terms: ['abs', 'antiblocage'],
      explanation: 'L’ABS module le freinage pour limiter le blocage des roues. Son intervention dépend de la voiture, des pneus et des conditions.',
      action: 'Observe quand l’ABS intervient. Compare des freinages à vitesse et trajectoire similaires en faisant varier seulement la progressivité de la pédale.',
      alternative: 'Vérifie si l’intervention augmente lorsque tu braques ou montes sur un vibreur. Sépare un essai de technique de freinage d’un essai de niveau d’ABS.',
      question: 'Tu cherches à comprendre son fonctionnement ou à réduire des interventions trop fréquentes ?'
    },
    {
      id: 'tc', terms: ['traction control', 'antipatinage', 'controle de traction', 'tc', 't c'],
      explanation: 'Le contrôle de traction réduit le patinage des roues motrices. Des interventions fréquentes peuvent signaler une forte demande de gaz avec encore beaucoup de volant.',
      action: 'Redresse progressivement la direction avant d’augmenter les gaz. Compare le moment où tu accélères et les interventions du TC, en gardant son niveau constant.',
      alternative: 'Vérifie si la sortie exige une correction de volant ou traverse un vibreur. Travaille une trajectoire qui permet de remettre les gaz sur une voiture plus droite.',
      question: 'Le TC coupe surtout à la corde, sur les vibreurs ou en sortie avec le volant presque droit ?'
    },
    {
      id: 'traction', issue: 'traction', terms: ['patinage', 'patine', 'patinent', 'motricite', 'trop de gaz', 'remise des gaz', 'reacceleration', 'wheelspin'],
      explanation: 'À la réaccélération, l’adhérence sert à la fois à tourner et à transmettre le couple.',
      action: 'Augmente les gaz progressivement pendant que tu ouvres le volant. Garde le même rapport et la même trajectoire sur plusieurs sorties pour voir si le patinage diminue.',
      alternative: 'Compare le même virage avec un rapport supérieur si le véhicule le permet. Observe la réponse du moteur et le delta après la sortie pour évaluer le compromis.',
      question: 'Les roues patinent ou c’est la voiture entière qui élargit quand tu accélères ?'
    },
    {
      id: 'curb', issue: 'curb', terms: ['vibreur', 'vibreurs', 'vibrateur', 'kerb', 'kerbs', 'bordure', 'bosse', 'saute'],
      explanation: 'Le passage sur un vibreur peut décharger une roue ou perturber la voiture, surtout avec du frein ou beaucoup de volant.',
      action: 'Compare un passage en restant sur l’asphalte avec un passage sur la partie basse du vibreur. Garde une vitesse prudente et des commandes progressives.',
      alternative: 'Repère si la réaction commence à la montée, au sommet ou à la descente du vibreur. Cela aidera le coach à distinguer trajectoire, transfert de charge et réaction de suspension.',
      question: 'La voiture pousse tout droit, l’arrière part ou les roues motrices patinent ?'
    },
    {
      id: 'tyre_hot', terms: ['pneus trop chauds', 'pneus chauffent', 'surchauffe', 'temperature pneus elevee', 'pneux chauffent'],
      explanation: 'Une surchauffe peut être amplifiée par du glissement répété ou des commandes trop brusques.',
      action: 'Identifie l’essieu concerné. Sur quelques tours plus propres, limite le braquage excessif et le patinage, puis compare l’évolution des températures et du rythme.',
      alternative: 'Vérifie si la hausse est concentrée sur une roue et si les pressions se stabilisent. Note les valeurs et les conditions pour les examiner avec le coach.',
      question: 'Ce sont les pneus avant, arrière ou les quatre qui chauffent ?'
    },
    {
      id: 'tyre_cold', terms: ['pneus froids', 'pneus trop froids', 'pneus chauffent pas', 'pneux froids', 'chauffer les pneus', 'mise en temperature'],
      explanation: 'Des pneus froids offrent une adhérence différente de celle disponible après plusieurs tours.',
      action: 'Construis progressivement ton rythme avec des freinages et accélérations contrôlés. Observe températures, pressions et stabilité avant de viser ton tour rapide.',
      alternative: 'Compare le premier tour avec les suivants dans les mêmes conditions. Note quand la voiture devient reproductible plutôt que de chercher à forcer la chauffe.',
      question: 'La difficulté concerne le départ, la sortie des stands ou tout le relais ?'
    },
    {
      id: 'tyre_wear', terms: ['usure pneus', 'pneus usent', 'use mes pneus', 'degradation', 'pneus detruits', 'fin de relais', 'pneus morts'],
      explanation: 'Le rythme peut se dégrader quand les pneus s’usent ou sortent de leur fenêtre de fonctionnement.',
      action: 'Compare le début et la fin du relais avec des conditions similaires. Cherche les glissements évitables, le patinage et les corrections de volant qui se répètent.',
      alternative: 'Observe les températures et le carburant en parallèle. Une différence de comportement ne vient pas forcément de l’usure seule.',
      question: 'Tu perds surtout de l’adhérence à l’avant ou de la motricité à l’arrière ?'
    },
    {
      id: 'pressure', terms: ['pression pneus', 'pressions pneus', 'pression a chaud', 'pression a froid', 'psi', 'kpa'],
      explanation: 'La pression cible dépend du simulateur, du modèle, du pneu et des conditions.',
      action: 'Relève les pressions après une séquence de tours propres et compare les quatre roues. Utilise les indications du jeu ou de la documentation du pneu pour définir ta cible.',
      alternative: 'Note aussi la température de piste et les valeurs de départ. Ajuste une seule variable et attends la stabilisation avant de comparer.',
      question: 'Sur quel jeu, avec quelle voiture et quelles pressions à chaud roules-tu ?'
    },
    {
      id: 'rain', terms: ['pluie', 'mouille', 'piste humide', 'wet', 'sous la pluie'],
      explanation: 'Sous la pluie, l’adhérence et la ligne la plus efficace peuvent évoluer au fil du tour.',
      action: 'Allonge tes marges de freinage et rends les commandes progressives. Observe les zones glissantes et adapte la trajectoire à l’adhérence réellement disponible.',
      alternative: 'Compare plusieurs lignes à rythme modéré, puis observe les conditions de séchage. Garde une marge près des peintures, vibreurs et flaques.',
      question: 'Tu perds la voiture au freinage ou à l’accélération, et avec quels pneus ?'
    },
    {
      id: 'aquaplaning', terms: ['aquaplaning', 'aquaplanage', 'flaque', 'flaques'],
      explanation: 'Une flaque peut réduire brutalement le contact du pneu avec la piste.',
      action: 'Réduis l’allure avant la zone et cherche une trajectoire qui limite l’eau accumulée. Garde les commandes douces pendant le passage.',
      alternative: 'Repère les zones où le phénomène revient et compare une autre ligne à vitesse prudente. Vérifie aussi que le type de pneu correspond aux conditions.',
      question: 'Le phénomène apparaît en ligne droite ou pendant un virage ?'
    },
    {
      id: 'consistency', terms: ['regularite', 'irregulier', 'irreguliers', 'chronos varient', 'constant', 'constance', 'ecart type', 'rythme', 'chronos differents'],
      explanation: 'La régularité se travaille en répétant des repères et des commandes plutôt qu’en cherchant un tour exceptionnel.',
      action: 'Fais une courte série de tours propres avec le même objectif de rythme. Compare les secteurs et repère le virage où l’écart se crée le plus souvent.',
      alternative: 'Travaille seulement ce virage sur une nouvelle série, puis compare l’amplitude des chronos. Note séparément les tours perturbés par le trafic ou une erreur.',
      question: 'Tes écarts viennent d’un virage précis ou d’erreurs différentes à chaque tour ?'
    },
    {
      id: 'pace', issue: 'pace', terms: ['perds du temps', 'perd du temps', 'lent', 'lente', 'chrono', 'delta', 'gagner du temps', 'plus rapide', 'ameliorer mon temps'],
      explanation: 'Pour gagner du temps, il faut d’abord localiser l’écart sur le tour.',
      action: 'Compare un secteur ou un virage à la fois. Regarde le freinage, la trajectoire et la vitesse après la sortie pour savoir où tester une correction.',
      alternative: 'Compare le delta avant la corde et après la sortie. Une entrée plus agressive peut déplacer la perte vers la ligne droite suivante.',
      question: 'Sur quel circuit, avec quelle voiture et à quel endroit l’écart apparaît-il ?'
    },
    {
      id: 'apex', terms: ['point de corde', 'rate la corde', 'trajectoire', 'ligne ideale', 'apex', 'placement', 'rotation trop tot', 'rotation trop tard'],
      explanation: 'La trajectoire doit préparer la sortie et le virage suivant, avec une vitesse d’entrée qui permet de la reproduire.',
      action: 'Choisis un repère de freinage, une zone de corde et une sortie. Commence avec une marge de vitesse, puis compare la fluidité et le delta après la sortie.',
      alternative: 'Teste une corde légèrement plus tardive si la sortie reste trop serrée. Observe le gain sur la portion suivante avant de retenir cette trajectoire.',
      question: 'Quel circuit et quel virage veux-tu travailler ?'
    },
    {
      id: 'steering', terms: ['corrections volant', 'trop de volant', 'braquage', 'contrebraquage', 'tourne le volant'],
      explanation: 'Beaucoup de corrections de volant peuvent signaler une vitesse excessive, une mauvaise préparation ou une voiture déjà en glissement.',
      action: 'Cherche un mouvement de direction continu et une trajectoire reproductible. Réduis légèrement la vitesse d’entrée pour vérifier si les corrections diminuent.',
      alternative: 'Regarde si tu corriges après un changement de frein ou de gaz. Travaille la transition qui précède la correction.',
      question: 'Tu corriges pour faire tourner l’avant ou pour rattraper l’arrière ?'
    },
    {
      id: 'slow_corner', terms: ['virage lent', 'virages lents', 'epingle', 'hairpin'],
      explanation: 'Dans un virage lent, la préparation de la remise des gaz peut peser fortement sur la sortie.',
      action: 'Entre avec une vitesse maîtrisée, laisse la voiture pivoter puis ouvre la direction pour accélérer progressivement.',
      alternative: 'Compare une entrée un peu plus prudente avec une sortie plus ouverte. Regarde le delta à la fin de l’accélération.',
      question: 'Quel virage et quel comportement te font perdre du temps ?'
    },
    {
      id: 'fast_corner', terms: ['virage rapide', 'virages rapides', 'courbe rapide', 'haute vitesse'],
      explanation: 'Dans une courbe rapide, la progressivité des commandes et la stabilité de la voiture sont importantes.',
      action: 'Prends une marge de vitesse et évite les corrections tardives. Compare des passages avec le même placement et une seule modification de commande.',
      alternative: 'Observe si la difficulté commence au lever de pied, au braquage ou sur une bosse. Cette chronologie aidera à choisir le prochain essai.',
      question: 'La voiture manque de rotation ou devient instable de l’arrière ?'
    },
    {
      id: 'chicane', terms: ['chicane', 'chicanes', 'enchainement', 'changement de direction'],
      explanation: 'Dans un enchaînement, le premier virage doit préparer le changement de direction et la sortie finale.',
      action: 'Évite de gagner le premier sommet au prix d’un mauvais placement pour le second. Recherche une transition fluide en limitant les vibreurs agressifs.',
      alternative: 'Compare une première partie plus prudente avec une sortie finale plus droite. Observe le delta sur la ligne droite suivante.',
      question: 'Tu perds l’équilibre pendant la transition ou tu manques de place dans la seconde partie ?'
    },
    {
      id: 'fuel', terms: ['consommation', 'carburant', 'essence', 'fuel', 'economiser', 'lift and coast', 'lift coast', 'panne seche'],
      explanation: 'La consommation doit être évaluée sur des tours représentatifs du relais.',
      action: 'Relève le carburant consommé sur plusieurs tours propres, puis calcule la moyenne par tour. Pour économiser, compare un lever de pied anticipé avant un freinage en surveillant le temps perdu.',
      alternative: 'Compare la consommation et le delta sur une séquence complète, avec une réserve adaptée aux conditions. Recalcule si le rythme ou le trafic change.',
      question: 'Tu veux estimer la quantité pour un relais ou réduire la consommation en course ?'
    },
    {
      id: 'overtake', terms: ['depassement', 'depasser', 'doubler', 'attaque', 'attaquer', 'undercut', 'overcut'],
      explanation: 'Un dépassement se prépare souvent dans le virage précédent et dépend de la place réellement disponible.',
      action: 'Travaille la sortie pour te rapprocher, observe le comportement de l’adversaire et conserve une marge au freinage. Annonce ton placement tôt et laisse de l’espace.',
      alternative: 'Compare tes sorties avant la zone de dépassement. Si tu perds le contact avant le freinage, améliore d’abord cette préparation.',
      question: 'Tu manques de vitesse pour te rapprocher ou tu n’arrives pas à finaliser la manœuvre ?'
    },
    {
      id: 'defense', terms: ['defense', 'defendre', 'protege ma position', 'proteger ma position'],
      explanation: 'Défendre demande de choisir son placement assez tôt tout en conservant une sortie exploitable.',
      action: 'Observe l’adversaire, choisis une ligne prévisible et respecte les règles du championnat. Évite de sacrifier la sortie en voulant fermer chaque ouverture.',
      alternative: 'Revois la manœuvre avec les deux points de vue. Cherche si ta ligne de défense te fait perdre la position dans le virage suivant.',
      question: 'Tu te fais dépasser au freinage ou à la réaccélération ?'
    },
    {
      id: 'traffic', terms: ['trafic', 'traffic', 'multiclasse', 'voiture devant', 'suivre un adversaire', 'aspiration', 'air sale'],
      explanation: 'Le trafic modifie tes repères et les marges disponibles. En suivant une voiture, il faut aussi anticiper sa vitesse et ses réactions.',
      action: 'Garde une vision au-delà de la voiture devant et adapte ton freinage. Prépare les dépassements dans des zones où chacun peut rester prévisible.',
      alternative: 'Compare les tours dans le trafic avec tes tours libres. Repère si la perte vient du freinage, de la sortie ou d’un temps d’attente avant une manœuvre.',
      question: 'Tu roules dans la même catégorie ou avec des voitures plus lentes ou plus rapides ?'
    },
    {
      id: 'contact', terms: ['contact', 'contacts', 'accrochage', 'accident', 'collision'],
      explanation: 'Pour comprendre un contact, il faut regarder le placement et les commandes des deux voitures avant l’impact.',
      action: 'Revois le replay depuis les deux points de vue. Note le moment où l’espace diminue et le changement de vitesse ou de ligne qui précède le contact.',
      alternative: 'Cherche une marge que tu peux contrôler lors de la prochaine situation, puis fais examiner la manœuvre par le STAFF si une décision sportive est nécessaire.',
      question: 'Le contact arrive à l’entrée, à la corde, à la sortie ou lors d’un changement de ligne ?'
    },
    {
      id: 'mental', terms: ['concentration', 'stress', 'pression', 'panique', 'fatigue', 'peur', 'enerve', 'mental'],
      explanation: 'Sous pression, des commandes plus brusques et un regard trop proche peuvent perturber le pilotage.',
      action: 'Ramène ton attention sur une tâche concrète, comme le prochain repère de freinage. Reprends un rythme que tu peux répéter et fais une pause si la fatigue s’installe.',
      alternative: 'Note ce qui déclenche la perte de concentration et prépare une routine courte pour le prochain relais.',
      question: 'Cela arrive surtout au départ, en duel ou en fin de relais ?'
    },
    {
      id: 'start', terms: ['depart', 'demarrage', 'lancement', 'embrayage', 'clutch'],
      explanation: 'La procédure de départ dépend du simulateur, de la voiture et du règlement.',
      action: 'Vérifie les commandes d’embrayage et les aides disponibles. Répète la procédure dans des conditions comparables, puis observe la réaction, le patinage et la trajectoire.',
      alternative: 'Travaille séparément la mise en mouvement et le placement dans les premiers virages, avec une marge pour le trafic.',
      question: 'Tu travailles un départ arrêté ou un départ lancé, et avec quelle voiture ?'
    },
    {
      id: 'gears', terms: ['retrogradage', 'retrogradages', 'rapport', 'rapports', 'boite', 'vitesse passe', 'regime', 'shift'],
      explanation: 'Le choix du rapport doit garder la voiture stable et permettre une accélération progressive.',
      action: 'Vérifie si la difficulté arrive au changement de rapport ou lors de la remise des gaz. Compare les mêmes passages en conservant un rapport différent si le jeu et la voiture le permettent.',
      alternative: 'Regarde le régime, les refus de rétrogradage et les pertes de motricité. Un replay ou un relevé de télémétrie aidera à distinguer un choix de rapport d’un problème de commande.',
      question: 'Tu rates les changements de rapport ou tu cherches le rapport adapté à un virage ?'
    },
    {
      id: 'bottoming', terms: ['talonne', 'talonnage', 'fond plat', 'touche le sol', 'hauteur de caisse'],
      explanation: 'Une voiture qui touche le sol peut réagir brutalement sur une compression ou un vibreur.',
      action: 'Repère la zone et les conditions exactes du contact. Compare d’abord un passage avec moins de vibreur ou moins de vitesse, puis examine les hauteurs avec le coach si elles sont réglables.',
      alternative: 'Utilise les données de hauteur ou de suspension lorsqu’elles sont disponibles. Modifie une seule variable et compare aussi l’équilibre ailleurs sur le tour.',
      question: 'Le contact arrive sur un vibreur, au freinage ou dans une compression rapide ?'
    },
    {
      id: 'bounce', terms: ['rebondit', 'rebond', 'rebonds', 'suspension', 'amortisseur', 'amortisseurs'],
      explanation: 'Un rebond peut venir du relief, du vibreur ou de la réaction des suspensions. Le ressenti seul ne permet pas de choisir un réglage précis.',
      action: 'Repère la zone et compare la trajectoire avec moins de vibreur. Observe si le rebond revient au même endroit et dans la même phase de conduite.',
      alternative: 'Note le modèle, le setup, les conditions et les données de suspension disponibles pour faire un essai isolé avec le coach.',
      question: 'La voiture rebondit sur une bosse, sur les vibreurs ou sur toute la courbe ?'
    },
    {
      id: 'pit', terms: ['stands', 'stand', 'pitstop', 'pit stop', 'pitlane', 'arret aux stands', 'ravitaillement'],
      explanation: 'Un arrêt se prépare avec le service à réaliser, la procédure d’entrée et la sortie des stands.',
      action: 'Vérifie le limiteur, les services sélectionnés et l’emplacement du box. Répète l’entrée et l’arrêt pour identifier le temps perdu dans chaque étape.',
      alternative: 'Compare le temps de traversée et le temps de service séparément, puis ajuste le plan dans l’outil Stratégie.',
      question: 'Tu perds du temps à l’entrée, au positionnement dans le box ou pendant le service ?'
    },
    {
      id: 'limits', terms: ['track limits', 'limites piste', 'limites de piste', 'penalite', 'penalites', 'cut', 'avertissement'],
      explanation: 'Les limites autorisées dépendent du jeu, du circuit et du règlement de l’épreuve.',
      action: 'Repère précisément la sortie qui déclenche les avertissements. Travaille une trajectoire reproductible avec une marge, puis consulte les consignes de l’épreuve.',
      alternative: 'Compare le replay du tour valide et du tour pénalisé pour repérer la différence de placement.',
      question: 'Quel jeu, quel circuit et quelle zone déclenchent la pénalité ?'
    },
    {
      id: 'setup', terms: ['setup', 'reglage', 'reglages', 'aileron', 'differentiel', 'carrossage', 'barre anti roulis', 'balance de frein'],
      explanation: 'Un réglage s’évalue à partir d’un comportement précis et de passages comparables.',
      action: 'Décris d’abord ce que fait la voiture et à quel moment. Garde une base enregistrée, modifie une seule variable disponible sur le modèle puis compare plusieurs tours propres.',
      alternative: 'Reviens à la base pour vérifier que le changement produit bien l’effet observé, en gardant les pneus et les conditions comparables.',
      question: 'Quel réglage veux-tu comprendre et quel comportement souhaites-tu corriger ?'
    },
    {
      id: 'telemetry', terms: ['telemetrie', 'telemetry', 'comparer des tours', 'courbe de frein', 'courbe accelerateur', 'gps', 'analyse video', 'video', 'replay'],
      explanation: 'La comparaison de tours sert à localiser l’écart et à relier ce moment aux commandes du pilote.',
      action: 'Choisis deux tours propres du même combo, avec des conditions comparables. Regarde le delta, puis la vitesse, le frein et les gaz à l’endroit où l’écart change.',
      alternative: 'Découpe la comparaison par virage et vérifie le placement. Une vidéo montre les éléments visibles à l’écran, et les fichiers de télémétrie apportent les mesures enregistrées.',
      question: 'Tu disposes d’un fichier de télémétrie, d’une vidéo ou seulement des chronos ?'
    },
    {
      id: 'tyres', terms: ['pneu', 'pneus', 'pneux', 'gomme', 'gommes'],
      explanation: 'Pour comprendre un problème de pneus, il faut distinguer température, pression et usure.',
      action: 'Note l’essieu concerné, les pressions à chaud et l’évolution du comportement pendant le relais.',
      alternative: 'Compare le même virage au début et à la fin d’une séquence propre en notant le carburant et les conditions.',
      question: 'Tes pneus sont trop froids, trop chauds ou se dégradent trop vite ?'
    },
    {
      id: 'track', terms: ['circuit', 'piste', 'virage', 'virages', 'monza', 'spa', 'interlagos', 'suzuka', 'le mans', 'silverstone'],
      explanation: 'On peut construire des repères de pilotage virage par virage à partir du tracé et du comportement de ta voiture.',
      action: 'Travaille d’abord un virage avec un repère d’entrée, une zone de corde et un objectif de sortie. Précise le modèle et le problème rencontré pour choisir une correction.',
      alternative: 'Compare deux trajectoires à rythme modéré, puis conserve celle qui donne une sortie plus stable et reproductible.',
      question: 'Quel circuit, quel virage et quelle voiture veux-tu travailler ?'
    }
  ];

  function closeWord(a, b) {
    if (a === b) return true;
    if (Math.min(a.length, b.length) < 6 || Math.abs(a.length - b.length) > 1) return false;
    let i = 0, j = 0, mistakes = 0;
    while (i < a.length && j < b.length) {
      if (a[i] === b[j]) { i++; j++; continue; }
      if (++mistakes > 1) return false;
      if (a.length >= b.length) i++;
      if (b.length >= a.length) j++;
    }
    return mistakes + (i < a.length || j < b.length ? 1 : 0) <= 1;
  }

  function matchTopic(message) {
    const normalized = normalize(message)
      .replace(/\b(?:pas de|aucun|sans) (?:sous virage|sousvirage|survirage|blocage|patinage)\b/g, '')
      .replace(/\bne (?:sous vire|sousvire|survire|patine) pas\b/g, '');
    const tokens = words(normalized);
    const scored = topics.map(topic => {
      const score = Math.max(0, ...topic.terms.map(term => {
        const clean = normalize(term);
        const exact = (' ' + normalized + ' ').includes(' ' + clean + ' ');
        const parts = words(clean);
        const fuzzy = parts.length && parts.every(word => tokens.some(token => closeWord(word, token)));
        return exact ? 5 + clean.length : fuzzy ? 2 + clean.length * .6 : 0;
      }));
      return {topic, score: ['pace','track','tyres'].includes(topic.id) ? score * .4 : score};
    }).sort((a, b) => b.score - a.score);
    return scored[0]?.score > 0 ? scored[0] : null;
  }

  const resourceCache = new WeakMap();
  function searchResources(message, context, rows) {
    if (!Array.isArray(rows)) return [];
    let index = resourceCache.get(rows);
    if (!index) {
      index = rows.filter(row => typeof row.solution === 'string' && row.solution.trim())
        .map(row => ({row, tokens: words([row.probleme, row.domaine, ...(row.mots_cles || [])].join(' '))}));
      resourceCache.set(rows, index);
    }
    const query = words(message);
    const category = normalize(context.category);
    const found = index.map(item => {
      const score = query.reduce((total, token) =>
        total + (item.tokens.some(word => word === token) ? 3 :
          item.tokens.some(word => closeWord(word, token)) ? 1 : 0), 0);
      const car = normalize(item.row.contexte || item.row.categorie);
      const compatible = !category || car === 'general' || car === category || car.includes(category);
      return {row: item.row, score: compatible && score >= 3 ? score + (category && car === category ? 2 : 0) : 0};
    }).filter(item => item.score > 0).sort((a, b) => b.score - a.score);
    const seen = new Set();
    return found.filter(({row}) => {
      const key = normalize(row.probleme || row.domaine);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 2).map(({row}) => ({
      id: row.id, title: row.probleme || row.domaine,
      solution: row.solution, exercise: row.exercice, question: row.question_suivi
    }));
  }

  function respond(message, context, data, prior = {}) {
    const text = normalize(message);
    if (/^(bonjour|salut|hello|bonsoir|coucou)( le coach| coach)?$/.test(text)) {
      return {kind:'greeting', supported:true, paragraphs:[
        'Salut ! Dis-moi ce que tu veux travailler ou ce qui te pose problème en piste.',
        'Tu peux me donner le circuit, la voiture et le virage. On cherchera une correction puis un exercice à tester.'
      ], suggestions:['Je manque de régularité', 'Comment fonctionne le freinage dégressif ?', 'Je sous-vire sur les vibreurs']};
    }
    if (/^(merci|merci beaucoup|ok merci|super merci|nickel|parfait|ok|d accord|compris)$/.test(text)) {
      return {kind:'thanks', supported:true, paragraphs:[
        'Avec plaisir ! Teste la correction sur quelques passages comparables et dis-moi ce qui change.'
      ], suggestions:['Ça va mieux', 'Le problème continue']};
    }
    const feedback = /(?:deja essaye|deja fait|toujours pareil|rien ne change|rien change|marche pas|ca continue|probleme continue|pas mieux)/.test(text);
    const improved = /(?:ca va mieux|c est mieux|plus stable|ca marche|probleme resolu)/.test(text);
    const priorTopic = topics.find(topic => topic.id === prior.topicId);
    if (improved && priorTopic) return {
      kind:'feedback', supported:true, topicId:priorTopic.id,
      paragraphs:['Garde ce repère et vérifie que le progrès se répète sur plusieurs tours propres.',
        'Compare aussi le delta après la sortie pour voir si tu gagnes sur l’ensemble du virage. Quelle différence observes-tu sur le chrono et la stabilité ?'],
      suggestions:['Comparer mes tours', 'Travailler un autre virage']
    };
    const direct = matchTopic(message);
    const briefFollowup=priorTopic&&/^(?:oui|non|en entree|au milieu|en sortie|au freinage|sur les vibreurs|sans abs|avec abs|avec tc)\b/.test(text);
    const topic = (feedback||briefFollowup) && priorTopic ? priorTopic : direct?.topic;
    const references = searchResources(message, context, data.resources);
    if (!topic && !references.length) {
      const contextual = priorTopic && /^(oui|non|en entree|au milieu|en sortie|sur les vibreurs|sans abs|avec abs|avec tc)/.test(text);
      if (contextual) return build(priorTopic, context, false);
      return {
        kind:'clarify', supported:false,
        paragraphs:['Je n’ai pas encore assez d’éléments pour choisir un conseil adapté.',
          'Décris ce qui se passe concrètement. Par exemple, est-ce que la voiture tire tout droit, perd l’arrière, bloque au freinage ou manque de rythme ?'],
        suggestions:['La voiture tire tout droit', 'Je perds l’arrière', 'Je perds du temps', 'Je veux comprendre un réglage']
      };
    }
    if (topic) {
      const step=feedback?Math.min(2,(prior.topicStep||0)+1):0;
      if(step===2)return {
        kind:'evidence',supported:true,topicId:topic.id,topicStep:step,
        paragraphs:[
          'Les deux premiers essais n’ont pas suffi. Pour choisir une nouvelle correction, comparons ce qui se passe réellement.',
          'Envoie au coach un replay ou un tour de télémétrie du passage, avec le modèle exact, les aides, les pneus et les conditions. Note le moment où le problème commence et les changements déjà testés.',
          topic.question
        ],
        suggestions:['Comparer mes tours','Comment préparer mon replay ?']
      };
      const answer = build(topic, context, feedback);
      answer.topicStep=step;
      answer.resources = references;
      return answer;
    }
    return {
      kind:'resource', supported:true, resources:references,
      paragraphs:[references[0].solution,
        references[0].exercise ? 'Pour le tester, ' + references[0].exercise.charAt(0).toLowerCase() + references[0].exercise.slice(1) : '',
        references[0].question || 'À quel endroit du tour observes-tu ce comportement ?'].filter(Boolean),
      suggestions:['Ça va mieux', 'Le problème continue']
    };
  }

  function build(topic, context, alternative) {
    const stage = context.phase && context.stages?.find(item => item.id === context.phase);
    const useStage = topic.issue && topic.issue === context.issue && stage;
    const curb = context.actions?.includes('vibreur');
    const paragraphs = [
      alternative ? 'D’accord, puisque tu as déjà essayé cette correction, vérifions un autre point.' : topic.explanation,
      alternative ? topic.alternative : useStage ? stage.correction : topic.action
    ];
    if (curb && topic.issue !== 'curb' && !useStage) {
      paragraphs.push('Sur le vibreur, compare un passage sur l’asphalte avec un passage sur sa partie basse. Évite de cumuler forte pression de frein, braquage et attaque du vibreur.');
    }
    if (context.track?.name && context.cornerNumber) {
      const name = context.corner?.nom;
      paragraphs.push('Pour ' + context.track.name + ', au T' + context.cornerNumber +
        (name ? ' (' + name + ')' : '') + ', garde les mêmes conditions et travaille ce passage avant de comparer le tour complet.');
    }
    if (context.assists && topic.issue) {
      paragraphs.push('Garde les mêmes aides (' + context.assists + ') pendant cet essai pour comparer leur effet.');
    }
    paragraphs.push(topic.question);
    return {
      kind:'topic', supported:true, topicId:topic.id, issue:topic.issue || null,
      paragraphs, suggestions:['Ça va mieux', 'Le problème continue', 'Comparer mes tours']
    };
  }

  root.VCECoachLanguage = {respond, matchTopic, searchResources, normalize, closeWord, topics};
})(typeof window === 'undefined' ? globalThis : window);
