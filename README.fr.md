# Immersive Weather Dashboard

**Une carte Lovelace plein écran, animée de façon procédurale, qui affiche votre propre photo de maison avec un ciel et une météo animés en local, entièrement configurable via un éditeur graphique.**

🇬🇧 [Read this document in English](README.md)

---

## Table des matières

- [Concept](#concept)
- [Tour des fonctionnalités](#tour-des-fonctionnalités)
- [Prérequis](#prérequis)
- [Installation](#installation)
  - [HACS (recommandé)](#hacs-recommandé)
  - [Installation manuelle](#installation-manuelle)
- [Configuration visuelle, étape par étape](#configuration-visuelle-étape-par-étape)
- [Mise en page : scène et zone d'informations](#mise-en-page--scène-et-zone-dinformations)
- [Comment fonctionne la superposition d'images](#comment-fonctionne-la-superposition-dimages)
- [Référence de configuration](#référence-de-configuration)
- [Algorithme de détection automatique et remplacements manuels](#algorithme-de-détection-automatique-et-remplacements-manuels)
- [Onglet Association des entités et remplacements de la station extérieure (ex. station ESP32)](#onglet-association-des-entités-et-remplacements-de-la-station-extérieure-ex-station-esp32)
- [Tableau de référence des indicateurs / entités](#tableau-de-référence-des-indicateurs--entités)
- [Zones environnementales (pièces intérieures/extérieures illimitées et qualité de l'air)](#zones-environnementales-pièces-intérieuresextérieures-illimitées-et-qualité-de-lair)
- [Règles d'alerte / recommandation visuelle](#règles-dalerte--recommandation-visuelle)
- [Analyse confort (risque de condensation)](#analyse-confort-risque-de-condensation)
- [Prévisions](#prévisions)
- [Réactivité, performance, accessibilité, confidentialité](#réactivité-performance-accessibilité-confidentialité)
- [Dépannage](#dépannage)
- [Mise à jour et suppression de la carte](#mise-à-jour-et-suppression-de-la-carte)
- [Migration et compatibilité de la configuration](#migration-et-compatibilité-de-la-configuration)
- [Développement](#développement)
- [FAQ](#faq)
- [Limites](#limites)
- [Prompt IA pour préparer votre photo de maison](#prompt-ia-pour-préparer-votre-photo-de-maison)
- [Licence](#licence)

## Concept

Immersive Weather Dashboard transforme une simple carte Lovelace en une scène météo plein écran. Vous fournissez une photo de votre propre maison dont le ciel a été détouré (avec une véritable transparence alpha). La carte affiche derrière cette photo un ciel animé **procédural, calculé localement** : dégradés jour/nuit, soleil/lune, étoiles, nuages en mouvement, pluie, pluie battante, neige, mélange neige/pluie, grêle, brouillard, vent et orages avec éclairs. Tout est dessiné avec l'API Canvas 2D au moment de l'exécution — **aucun fichier vidéo, aucun service de rendu dans le cloud, aucun appel réseau** n'est utilisé pour produire l'animation.

Le résultat est une carte de tableau de bord/écran mural qui semble vivante et réagit à votre véritable entité météo et à vos capteurs, tout en gardant votre propre maison reconnaissable au premier plan.

## Tour des fonctionnalités

- Mise en page immersive plein écran, conçue pour smartphones, tablettes, tableaux de bord de bureau et écrans muraux. Par défaut, la **scène animée reste un viewport compact et dégagé en haut** de la carte, tandis que tous les indicateurs, zones, alertes et prévisions s'affichent naturellement en dessous — rien ne recouvre la photo de maison ni le ciel.
- **Zone d'informations responsive** — lorsque la carte dispose de largeur (par exemple étirée vers la pleine largeur dans un tableau de bord en vue **Sections**), les panneaux sous la scène se répartissent en **plusieurs colonnes (masonry)** au lieu d'une longue bande verticale, et reviennent à une seule colonne sur smartphone. Le nombre de colonnes suit la largeur réelle de la carte, pas la fenêtre du navigateur.
- Moteur météo/ciel procédural : dégradé jour/nuit, soleil, lune, étoiles scintillantes, nuages en dérive, pluie, pluie battante, neige, mélange neige/pluie, grêle, brouillard, rafales de vent, éclairs pour les orages.
- Panneaux « glassmorphism » discrets (flous, translucides) pour les conditions actuelles, la station extérieure, les zones environnementales, les alertes et les prévisions, afin que la scène reste visible en dessous et que les informations restent parfaitement lisibles.
- Configuration graphique complète — **aucune édition YAML n'est nécessaire** après l'installation via HACS. Chaque option (image, couleurs, opacité, indicateurs, zones environnementales, règles d'alerte, prévisions…) dispose d'un contrôle dans l'interface.
- Détection automatique fiable des entités grâce à un algorithme de score déterministe qui **rejette les capteurs dont la `device_class` est explicitement incompatible** avec l'indicateur (par exemple, un capteur de « puissance apparente » ne peut plus jamais être confondu avec le « ressenti » simplement parce que les deux mentionnent « apparent »), ainsi qu'un onglet dédié **Association des entités** pour les remplacements manuels — idéal pour relier une véritable station météo extérieure (par exemple à base d'ESP32) afin qu'elle remplace les données du fournisseur météo.
- **Zones environnementales illimitées** — ajoutez autant de zones intérieures et/ou extérieures que vous le souhaitez (chambres, salon, garage, serre…), chacune avec ses propres entités de température, d'humidité et de qualité de l'air (AQI, CO₂, PM2.5, PM10, COV) associées manuellement.
- **Règles d'alerte/recommandation visuelles et purement d'affichage** — construisez vos propres recommandations à conditions multiples (par exemple « Ouvrez les fenêtres ») à partir de n'importe quelles entités numériques, affichées en évidence en haut de la zone d'informations. Elles sont purement visuelles et évaluées uniquement pendant que la carte est affichée ; la carte n'appelle jamais de service Home Assistant et ne déclenche jamais de notification.
- Abonnement en direct aux prévisions via l'API WebSocket moderne `weather/subscribe_forecast` (journalières et horaires), avec gestion explicite des cas où une intégration météo ne prend pas en charge un type de prévision donné.
- Respecte le réglage système `prefers-reduced-motion`, met le rendu en pause lorsque la carte n'est plus visible à l'écran ou que l'onglet du navigateur est masqué, et plafonne la densité de pixels de l'appareil pour maîtriser le coût GPU/CPU.
- Contrôles de qualité et d'intensité d'animation pour que les tablettes murales peu puissantes et les écrans Raspberry Pi restent fluides.
- Interface en anglais et en français, suivant `hass.locale.language`, avec repli sur l'anglais.
- **Analyse confort** optionnelle — un panneau d'analyse du risque de condensation purement d'affichage (désactivé par défaut). Calcule le point de rosée (formule de Magnus), l'humidité absolue (g/m³) et la marge de condensation à partir des relevés extérieurs et de la zone intérieure sélectionnée ; affiche des niveaux de risque fixes sûr/avertissement/critique ; prend en charge un capteur de vitrage ou de surface facultatif, ou un facteur de vitrage configurable par défaut (0,15) explicitement affiché comme **estimation**. Elle s'affiche sous forme de deux tuiles (**Conditions extérieures** et **Maison et confort**) qui participent à la mise en page responsive. Les valeurs techniques disposent d'une **infobulle éducative**, révélée en survolant, en donnant le focus clavier ou en appuyant sur la valeur elle-même — sans bouton « ? » qui alourdit l'affichage.

## Prérequis

- Home Assistant **2024.8** ou plus récent (utilise le cycle de vie moderne des cartes Lovelace personnalisées et la commande WebSocket `weather/subscribe_forecast` introduite lors de la refonte des prévisions du cœur de HA).
- [HACS](https://hacs.xyz/) pour une installation et des mises à jour en un clic (l'installation manuelle est également prise en charge intégralement, voir ci-dessous).
- Au moins une entité `weather.*`. Les entités `sensor.*` sont optionnelles mais recommandées pour une station d'indicateurs complète.
- Votre propre photo de maison avec un ciel transparent (voir le [prompt IA](#prompt-ia-pour-préparer-votre-photo-de-maison) ci-dessous pour vous aider à en produire une).

## Installation

### HACS (recommandé)

[![Ouvrir le dépôt dans HACS](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=zarzak12&repository=immersive-weather-dashboard&category=plugin)

1. Dans Home Assistant, ouvrez **HACS → Frontend**.
2. Cliquez sur le menu **⋮** → **Dépôts personnalisés**.
3. Ajoutez `https://github.com/zarzak12/immersive-weather-dashboard`, catégorie **Dashboard** (plugin Lovelace). Le bouton ci-dessus permet d'ouvrir directement ce dépôt dans HACS.
4. Recherchez **Immersive Weather Dashboard** dans HACS et cliquez sur **Télécharger**.
5. Rechargez le frontend (HACS vous le proposera généralement ; sinon videz le cache de votre navigateur — voir [Dépannage](#dépannage)).
6. Ajoutez une nouvelle carte à un tableau de bord, recherchez **Immersive Weather Dashboard** dans le sélecteur de cartes, puis configurez-la via l'éditeur graphique.

HACS installe le fichier unique `dist/immersive-weather-dashboard.js` et enregistre automatiquement la ressource Lovelace.

### Installation manuelle

1. Téléchargez `immersive-weather-dashboard.js` depuis la [dernière version](https://github.com/zarzak12/immersive-weather-dashboard/releases/latest) (ou compilez-le vous-même, voir [Développement](#développement)).
2. Copiez-le dans `config/www/immersive-weather-dashboard.js` de votre installation Home Assistant.
3. Dans **Paramètres → Tableaux de bord → ⋮ → Ressources**, ajoutez une ressource :
   - URL : `/local/immersive-weather-dashboard.js`
   - Type de ressource : **Module JavaScript**
4. Rechargez le frontend puis ajoutez la carte depuis le sélecteur comme ci-dessus.

## Configuration visuelle, étape par étape

1. Préparez votre photo de maison avec un ciel transparent (PNG ou WebP, véritable canal alpha — voir le [prompt IA](#prompt-ia-pour-préparer-votre-photo-de-maison)).
2. Téléversez le fichier dans `config/www/` (par exemple `config/www/maison.png`), afin qu'il soit accessible via `/local/maison.png`, ou hébergez-le sur une URL HTTPS que vous contrôlez.
3. Ajoutez la carte à un tableau de bord, ouvrez l'éditeur de carte, et dans l'onglet **Image et scène**, collez le chemin de l'image (`/local/maison.png`) dans **URL de l'image de la maison**. Si la maison paraît zoomée, choisissez **Afficher l'image entière**, puis ajustez le zoom et les positions horizontale/verticale. Pour une photo 4:3, un ratio de scène 4/3 donnera le cadrage le plus fidèle.
4. Choisissez votre **entité météo** dans l'onglet **Source de données**, ou laissez le champ vide pour laisser la carte détecter automatiquement la meilleure entité.
5. Ajustez l'**Apparence** (opacité/flou/rayon des panneaux, couleurs d'accent/texte, hauteur minimale de la scène, ratio d'aspect de la scène, densité) pour correspondre à votre thème et à votre écran — ces réglages ne dimensionnent désormais que le **viewport de la scène**, pas toute la carte (voir [Mise en page](#mise-en-page--scène-et-zone-dinformations)).
6. Activez/désactivez les **Prévisions** et choisissez le nombre d'éléments horaires/journaliers à afficher.
7. Ouvrez **Indicateurs météo** pour réordonner, masquer, relabelliser ou recolorer chacun des dix-sept indicateurs pris en charge (dont la nouvelle **température extérieure**).
8. Ouvrez **Association des entités** pour voir, pour chaque indicateur, l'entité ou l'attribut météo exactement résolu par la carte, et pour saisir un remplacement manuel — c'est ici que vous connectez votre propre station météo extérieure (par exemple un ESP32) à la place de votre fournisseur météo (voir [Onglet Association des entités](#onglet-association-des-entités-et-remplacements-de-la-station-extérieure-ex-station-esp32)).
9. Ouvrez **Environnement** pour ajouter autant de zones intérieures/extérieures que vous le souhaitez (chambre, salon, garage…) et associer manuellement leurs entités de température/humidité/qualité de l'air.
10. Ouvrez **Alertes** pour créer vos propres règles de recommandation visuelle (par exemple « Ouvrez les fenêtres ») à partir de n'importe quelles entités numériques (voir [Règles d'alerte visuelles](#règles-dalerte--recommandation-visuelle)).
11. Cliquez éventuellement sur **Configuration automatique** une fois satisfait des détections automatiques, pour les figer dans la configuration enregistrée (voir [Détection automatique](#algorithme-de-détection-automatique-et-remplacements-manuels)).
12. Ouvrez éventuellement **Confort** pour activer le panneau : choisissez une zone intérieure de référence, associez facultativement un capteur de température de vitrage ou de surface, puis ajustez les plages de confort, les deltas de ventilation/refroidissement et le facteur de vitrage (voir [Analyse confort](#analyse-confort-risque-de-condensation)).

## Mise en page : scène et zone d'informations

Depuis la v1.0.1, la carte est divisée en deux zones clairement séparées, empilées verticalement dans le flux normal du document :

1. **La scène** — un viewport à hauteur fixe en haut de la carte, ne contenant que les canevas animés de ciel/météo, votre photo de maison, et une petite surimpression de titre/résumé des conditions actuelles. `Apparence → Hauteur minimale` et `Apparence → Ratio d'aspect` dimensionnent **uniquement ce viewport**. La scène ne s'agrandit jamais pour accueillir d'autre contenu et rien d'autre n'est dessiné par-dessus, votre photo de maison et l'animation restent donc parfaitement visibles.
2. **La zone d'informations** — une section en flux normal sous la scène, contenant dans l'ordre : les recommandations d'alerte actives, les indicateurs de la station extérieure, les cartes de zones environnementales, puis les prévisions. Cette zone n'a **aucune hauteur forcée ni découpage** : la carte s'agrandit naturellement selon la quantité d'informations configurée, et la vue Sections de Home Assistant est informée de respecter cette hauteur naturelle (plus de minimum forcé de 8 lignes). Les lignes de prévisions peuvent défiler horizontalement sur les petits écrans, mais le reste de la zone d'informations n'est jamais masqué ni tronqué.

Lorsque la carte est suffisamment large — par exemple étirée vers la pleine largeur dans un tableau de bord en vue **Sections** — la zone d'informations ne s'empile plus en une seule longue bande. Ses panneaux (la station extérieure, les deux tuiles Confort optionnelles, les zones environnementales et les prévisions) se répartissent en **plusieurs colonnes responsives (masonry)**, côte à côte. Le nombre de colonnes suit la *largeur réellement rendue* de la carte plutôt que la fenêtre du navigateur, si bien qu'il s'adapte correctement même dans un emplacement étroit sur un grand écran, et revient à une seule colonne sur smartphone et petites cartes. Les recommandations d'alerte actives et les notifications de validation occupent toujours toute la largeur.

Ceci remplace directement le comportement de la v1.0, où chaque panneau était positionné en absolu par-dessus la scène (recouvrant la majeure partie de la maison/du ciel) à l'intérieur d'un élément `.scene` à hauteur limitée. Si vous mettez à jour depuis la v1.0, attendez-vous à ce que la carte paraisse différente immédiatement après la mise à jour — plus haute globalement, mais avec une scène dégagée et des informations parfaitement lisibles en dessous — voir [Migration et compatibilité de la configuration](#migration-et-compatibilité-de-la-configuration).

## Comment fonctionne la superposition d'images

La carte compose trois couches, de l'arrière vers l'avant :

1. **Canevas d'arrière-plan** — dégradé de ciel, soleil/lune, étoiles et nuages. Il se trouve **derrière** votre photo de maison, et ne devient donc visible qu'à travers la zone de ciel transparente de votre PNG/WebP.
2. **Votre photo de maison** — le premier plan opaque (maison, sol, végétation…) peint par-dessus le canevas d'arrière-plan. Partout où la photo est opaque, l'animation du ciel est naturellement masquée ; partout où elle est transparente (le ciel détouré), l'arrière-plan animé apparaît. L'éditeur visuel peut remplir la scène (avec recadrage si les ratios diffèrent) ou conserver l'image entière, avec un zoom indépendant de 50 à 200 % et un positionnement horizontal/vertical.
3. **Canevas de premier plan** — pluie, neige, grêle, volutes de brouillard et éclairs, dessinés **au-dessus** de votre photo de maison. C'est intentionnel : la pluie et la brume qui tombent passent aussi réellement devant une maison, pas seulement derrière.

La composition reposant entièrement sur le canal alpha de votre image, la qualité du détourage détermine directement le réalisme de la scène. Un masque alpha propre et précis (sans liseré, sans pixel de ciel restant, sans antenne trop effacée) est l'ingrédient le plus important pour un bon résultat.

## Référence de configuration

Tout ce qui suit est configurable depuis l'éditeur graphique. Aucune édition YAML n'est nécessaire ni attendue. Home Assistant stocke tout de même la configuration en interne (comme pour toute carte), mais vous n'avez jamais besoin de l'ouvrir ou de la modifier à la main.

| Onglet de l'éditeur | Options |
| --- | --- |
| Source de données | Titre de la carte, entité météo (ou détection automatique) |
| Association des entités | Pour chaque indicateur de la station extérieure : type de source résolu, identifiant exact de l'entité résolue (ou attribut météo), remplacement manuel recherchable, et un contrôle pour effacer le remplacement |
| Image et scène | URL de l'image de la maison, remplissage/image entière, zoom (50–200 %), positions horizontale/verticale, réinitialisation du cadrage, mode jour/nuit, qualité et intensité d'animation |
| Apparence | Opacité des panneaux, flou des panneaux, rayon des coins des panneaux, couleur d'accent, couleur du texte, hauteur minimale de la scène, ratio d'aspect de la scène, densité (confortable/compacte) |
| Prévisions | Afficher/masquer les prévisions horaires, afficher/masquer les prévisions journalières, nombre d'éléments horaires, nombre d'éléments journaliers |
| Indicateurs météo | Par indicateur : visible, libellé personnalisé, couleur personnalisée, icône personnalisée, et un indicateur de « source » en lecture seule (manuelle / attribut météo / capteur / non disponible) — les remplacements manuels vivent désormais dans l'onglet **Association des entités** |
| Environnement | Ajouter/supprimer/réordonner un nombre illimité de zones ; par zone : nom, type intérieur/extérieur, visibilité, association manuelle d'entités pour température, humidité, AQI, CO₂, PM2.5, PM10 et COV |
| Alertes | Ajouter/supprimer des règles de recommandation visuelle ; par règle : nom, message, sévérité, logique tout/au moins un, bascule activé/désactivé, et une ou plusieurs conditions numériques (entité, opérateur, seuil(s)) |
| Confort | Activer/désactiver le panneau ; sélecteur de zone intérieure (ou première zone intérieure visible) ; capteur de température de vitrage/surface optionnel ; plages de température/humidité intérieures ; facteur de vitrage (par défaut 0,15, plage 0,0–1,0) ; delta d'humidité absolue pour la ventilation (par défaut 2,0 g/m³, plage 0,0–20,0 g/m³) ; delta de température pour le refroidissement |

Deux actions dédiées sont toujours disponibles :

- **Réinitialiser** — restaure toutes les options à leurs valeurs par défaut (conserve le type de carte).
- **Configuration automatique** — calcule un nouvel instantané de la meilleure entité météo et des meilleurs capteurs détectés et **l'enregistre** dans la configuration après une boîte de dialogue de confirmation explicite. Tant que vous ne cliquez pas dessus, la détection automatique reste purement dynamique/adaptative et rien n'est écrit dans votre configuration.

## Algorithme de détection automatique et remplacements manuels

Pour chacun des dix-sept indicateurs pris en charge, la carte résout une valeur selon cet ordre de priorité strict :

1. **Remplacement manuel** — l'entité que vous avez explicitement choisie pour cet indicateur (dans l'onglet **Association des entités**). Si elle existe mais est `unavailable`/`unknown`, l'indicateur est affiché comme non disponible plutôt que de basculer silencieusement vers une autre source ; si l'identifiant saisi n'existe pas du tout, l'éditeur affiche une notification de validation plutôt que de l'ignorer silencieusement.
2. **Attribut de l'entité météo** — si l'entité météo sélectionnée expose un attribut correspondant (par exemple `temperature`, `humidity`, `pressure`, `wind_speed`, `wind_bearing`, `wind_gust_speed`, `uv_index`, `visibility`, `dew_point`, `cloud_coverage`, `ozone`, `apparent_temperature`), il est utilisé directement.
3. **Capteur le mieux noté** — la carte note chaque entité `sensor.*` (et `air_quality.*` pour la qualité de l'air) par rapport à l'indicateur : `+10` pour une `device_class` correspondante, `+5` pour un mot-clé correspondant dans l'identifiant de l'entité, `+3` pour un mot-clé correspondant dans le nom convivial. **Une entité déclarant une `device_class` qui ne fait pas partie des classes acceptées par l'indicateur est rejetée d'emblée**, même si son identifiant ou son nom convivial contient un mot-clé correspondant — ceci empêche spécifiquement, par exemple, un capteur de « puissance apparente » (`device_class: apparent_power`, exprimé en VA) d'être choisi pour le « ressenti » simplement parce que les deux mentionnent « apparent ». Les indicateurs dont la classe est ambiguë (par exemple le point de rosée face à une température quelconque, les rafales face au vent moyen ou le lever du soleil face à n'importe quel horodatage) exigent aussi un mot-clé sémantique. Les entités `unavailable`/`unknown`, appartenant à un domaine non autorisé ou ne passant pas ces garde-fous sont rejetées afin d'éviter les associations accidentelles. L'entité la mieux notée l'emporte ; en cas d'égalité, l'ordre alphabétique de l'identifiant tranche, pour rester déterministe.
4. **Entité `sun.sun`** — utilisée uniquement pour le lever/coucher du soleil, via `next_rising`/`next_setting`, si aucun capteur n'a été trouvé.
5. **Non disponible** — si rien ne convient, l'indicateur est simplement omis de la station plutôt que d'afficher un zéro trompeur.

L'entité météo elle-même est sélectionnée de façon similaire : votre entité `weather.*` configurée est utilisée si elle existe et est disponible ; sinon, la carte choisit l'entité météo disponible qui expose le jeu d'attributs de station actuels le plus riche. Les égalités sont départagées par ordre alphabétique afin de conserver un résultat déterministe.

Cet algorithme s'exécute en direct à chaque rendu de la carte, il s'adapte donc naturellement si vous ajoutez, renommez ou remplacez des entités — sauf si vous avez explicitement utilisé **Configuration automatique**, qui fige les détections actuelles dans la configuration enregistrée.

## Onglet Association des entités et remplacements de la station extérieure (ex. station ESP32)

L'onglet d'édition **Association des entités** est l'endroit unique et évident pour voir et contrôler exactement quelle entité alimente chaque indicateur de la station extérieure. Pour chaque indicateur, il affiche :

- le libellé de l'indicateur ;
- le **type de source résolu** (remplacement manuel / attribut météo / capteur / non disponible) ;
- l'**identifiant exact de l'entité actuellement résolue** (ou le nom de l'attribut météo, quand c'est la source) ;
- un champ de texte avec une liste de suggestions recherchable et modifiable (`<datalist>`) d'entités compatibles — affichant les noms conviviaux et les unités quand ils sont disponibles — pour choisir une suggestion ou saisir n'importe quel identifiant d'entité à la main ;
- un bouton **Effacer le remplacement** pour retirer une association manuelle et revenir à la détection automatique.

Un remplacement manuel a toujours la priorité sur la détection automatique. Si vous saisissez un identifiant d'entité qui n'existe pas dans votre instance Home Assistant, l'onglet affiche une notification de validation au lieu d'ignorer silencieusement votre saisie.

**Exemple : remplacer température/humidité/pression extérieures par une véritable station météo ESP32**

1. Assurez-vous que les relevés de votre station ESP32 sont disponibles comme entités capteur Home Assistant (par exemple via ESPHome, MQTT ou Tasmota), par exemple `sensor.esp32_temperature_exterieure`, `sensor.esp32_humidite_exterieure`, `sensor.esp32_pression_exterieure`.
2. Ouvrez l'éditeur de carte → **Association des entités**.
3. Repérez **Température extérieure**, saisissez ou choisissez `sensor.esp32_temperature_exterieure` dans son champ de remplacement, puis cliquez/tabulez ailleurs pour confirmer — la ligne se met à jour pour afficher cette source résolue.
4. Répétez l'opération pour **Humidité extérieure** et **Pression** avec vos capteurs d'humidité/pression ESP32.
5. Le résumé des conditions actuelles en haut de la scène et l'indicateur de la station extérieure reflètent immédiatement les relevés de votre ESP32 au lieu des données de votre fournisseur météo ; si votre capteur ESP32 devient indisponible, la carte revient automatiquement à la valeur du fournisseur météo.

Les champs de remplacement d'entité se mettent à jour au changement/à la perte de focus, pas à chaque frappe, afin que vous puissiez saisir un identifiant d'entité complet sans que la carte ne gêne votre saisie.

## Tableau de référence des indicateurs / entités

| Indicateur | Attribut météo utilisé | `device_class` du capteur | Mots-clés typiques |
| --- | --- | --- | --- |
| Température extérieure | `temperature` | `temperature` | outdoor, exterieur, dehors, temperature |
| Ressenti (température apparente) | `apparent_temperature` | `temperature` | feels_like, apparent, ressenti |
| Humidité extérieure | `humidity` | `humidity` | humidity, humidite |
| Pression | `pressure` | `pressure`, `atmospheric_pressure` | pressure, pression |
| Vitesse du vent | `wind_speed` | `wind_speed` | wind_speed, vitesse_vent |
| Direction du vent | `wind_bearing` | — | wind_bearing, wind_direction |
| Rafales | `wind_gust_speed` | `wind_speed` | gust, rafale |
| Précipitations | — | `precipitation` | precipitation, rain, pluie |
| Probabilité de pluie | — | `precipitation_probability` | pop, chance_of_rain |
| Indice UV | `uv_index` | — | uv_index, uv |
| Visibilité | `visibility` | — | visibility, visibilite |
| Point de rosée | `dew_point` | `temperature` | dew_point, point_de_rosee |
| Couverture nuageuse | `cloud_coverage` | — | cloud_coverage, nuage |
| Ozone | `ozone` | `ozone` | ozone |
| Qualité de l'air | — | `aqi` | air_quality, aqi |
| Lever du soleil | `sun.sun` `next_rising` (repli) | `timestamp` | sunrise, lever_soleil |
| Coucher du soleil | `sun.sun` `next_setting` (repli) | `timestamp` | sunset, coucher_soleil |

## Zones environnementales (pièces intérieures/extérieures illimitées et qualité de l'air)

Au-delà de la seule station extérieure, l'onglet **Environnement** vous permet de définir **un nombre illimité de zones environnementales** — par exemple « Chambre », « Salon », « Garage », « Serre » ou un second emplacement extérieur. Chaque zone est entièrement configurée manuellement (aucune détection automatique n'est tentée pour l'attribution des pièces, car vous seul savez quel capteur appartient à quelle pièce) :

- un nom stable que vous choisissez ;
- un type : **intérieur** ou **extérieur** ;
- une bascule de visibilité (masquer une zone du rendu de la carte sans supprimer sa configuration) ;
- des associations d'entités manuelles, chacune avec un champ recherchable/modifiable, pour : **température**, **humidité**, **AQI**, **CO₂**, **PM2.5**, **PM10** et **COV** — n'associez que celles pertinentes pour cette zone, les autres sont simplement omises.

Les zones visibles s'affichent sous forme de cartes réactives sous la station extérieure, chacune montrant le nom et le type de la zone ainsi que chaque valeur configurée avec un libellé, une icône et une unité localisés. Si une entité configurée est manquante ou indisponible, sa ligne affiche visiblement un tiret cadratin (`—`) et une notification de validation, plutôt que de disparaître silencieusement — une mauvaise configuration reste ainsi toujours visible, jamais masquée.

C'est ainsi que la carte prend en charge, par exemple, le suivi simultané du CO₂/AQI intérieur d'une chambre et de l'AQI/PM2.5 extérieur, ou la comparaison de la température/humidité entre plusieurs pièces.

## Règles d'alerte / recommandation visuelle

L'onglet **Alertes** vous permet de créer vos propres **recommandations visuelles, purement d'affichage**, évaluées en direct à partir de n'importe quelles entités numériques de votre système — par exemple un rappel pour ouvrir les fenêtres lorsque la qualité de l'air intérieur en bénéficierait. Chaque règle comporte :

- un nom et un message de recommandation affiché lorsque la règle est active ;
- une sévérité : **info**, **avertissement** ou **critique** (chacune rendue avec une couleur/icône distincte) ;
- une logique : **toutes** les conditions doivent être remplies, ou **au moins une** d'entre elles ;
- une bascule activée/désactivée ;
- une ou plusieurs conditions numériques, chacune avec un identifiant d'entité, un opérateur (`>`, `≥`, `<`, `≤`, `=`, **entre**, **en dehors**) et une ou deux valeurs de seuil.

**Exemple : « Ouvrir les fenêtres »**

| Condition | Entité | Opérateur | Seuil(s) |
| --- | --- | --- | --- |
| Le CO₂ intérieur est élevé | `sensor.co2_chambre` | supérieur à (`gt`) | 1000 ppm |
| La qualité de l'air extérieur est bonne | `sensor.aqi_exterieur` | inférieur à (`lt`) | 50 |
| La température extérieure est agréable | `sensor.esp32_temperature_exterieure` | entre | 12 et 28 |

Avec la logique réglée sur **toutes**, cette règle ne devient active — et n'affiche une recommandation en évidence en haut de la zone d'informations — que lorsque ces trois conditions sont simultanément vraies. Cet exemple est **documenté ici uniquement** ; la carte ne l'active pas par défaut, car les identifiants d'entités sont propres à chaque installation. Construisez vos propres règles à partir de vos propres entités dans l'onglet **Alertes**.

**Limites importantes, par conception :**

- Les alertes sont des **recommandations purement visuelles** rendues à l'intérieur de la carte. Elles n'appellent jamais un service Home Assistant, ne déclenchent jamais de notification et n'exécutent jamais d'automatisation.
- Une règle n'est évaluée que **pendant que cette carte Lovelace est réellement affichée à l'écran** (tableau de bord ouvert, onglet visible). Une carte Lovelace n'a aucun processus en arrière-plan, elle ne peut donc jamais vous prévenir lorsqu'elle n'est pas affichée — utilisez une véritable automatisation/notification Home Assistant si vous avez besoin d'être alerté ailleurs que sur le tableau de bord.
- Une règle référençant une entité manquante, indisponible ou non numérique, ou sans condition, ou désactivée, est toujours considérée comme inactive plutôt que de provoquer une erreur ou d'afficher une donnée périmée.
- **Entre** est inclusif des deux seuils ; **en dehors** est strictement exclusif de la plage entre eux.

Les prévisions n'étant plus exposées comme attributs d'état des entités météo dans les versions récentes de Home Assistant, la carte s'abonne aux mises à jour de prévisions en direct via la commande WebSocket `weather/subscribe_forecast`, séparément pour les types `daily` et `hourly`. Si votre intégration météo ne prend pas en charge un type de prévision donné, la tentative d'abonnement est gérée explicitement (pas silencieusement ignorée) et la section correspondante est simplement masquée — vous ne verrez pas de chargement bloqué indéfiniment. Les abonnements sont automatiquement renouvelés si vous changez d'entité météo ou de réglages de prévisions, et proprement résiliés lorsque la carte est retirée ou quitte le tableau de bord.

## Analyse confort (risque de condensation)

L'onglet **Confort** ajoute une analyse optionnelle, purement d'affichage, du risque de condensation. Elle est **désactivée par défaut** (`comfort.enabled: false`) et ne produit aucun affichage tant qu'elle n'est pas explicitement activée — aucune édition YAML n'est nécessaire. Une fois activée, elle s'affiche sous forme de deux tuiles indépendantes — **Conditions extérieures** et **Maison et confort** — qui participent à la mise en page responsive en plusieurs colonnes : sur une carte large elles peuvent se placer côte à côte, sur une carte étroite elles s'empilent.

### Données d'entrée

Deux paires de relevés sont nécessaires :

- **Température et humidité relative extérieures** — résolues depuis les mêmes sources que les indicateurs de la station extérieure (détection automatique ou remplacement manuel dans l'onglet **Association des entités**).
- **Température et humidité relative intérieures** — issues de la zone explicitement sélectionnée dans l'onglet **Confort**, ou, à défaut, de la première zone environnementale intérieure visible. Les relevés manquants sont signalés comme indisponibles plutôt que déduits.

### Valeurs calculées

Tous les calculs s'exécutent localement dans le navigateur à partir des relevés courants :

- **Point de rosée (°C / °F)** — calculé à partir de la température et de l'humidité relative extérieures à l'aide de la formule de Magnus.
- **Humidité absolue (g/m³)** — calculée pour l'air intérieur et extérieur à partir de leurs températures et humidités relatives respectives.
- **Distance de saturation extérieure (°C / °F)** — `température_ext − point_de_rosée` ; une valeur positive élevée indique que l'air extérieur est loin de la saturation.

### Évaluation de la ventilation

La ventilation est évaluée à partir de l'**humidité absolue** (et non de l'humidité relative), car elle représente la masse réelle de vapeur d'eau quelle que soit la température de l'air. La ventilation est considérée comme bénéfique lorsque l'humidité absolue extérieure est inférieure à la valeur intérieure d'au moins un delta configurable (par défaut : **2,0 g/m³**, réglable de 0,0 à 20,0 g/m³).

### Évaluation du refroidissement

Une vérification séparée évalue si l'ouverture des fenêtres permettrait de rafraîchir l'espace, sur la base de seuils de température intérieure et extérieure configurables.

### Température de vitrage / de surface (capteur optionnel ou estimation)

Vous pouvez éventuellement associer un **capteur de température de vitrage ou de surface** (par exemple un thermomètre à contact sur une vitre) dans l'onglet Confort. Lorsqu'il est associé et disponible, ce relevé est utilisé directement comme température de surface pour le calcul de la marge de condensation.

Lorsqu'aucun capteur n'est associé ou que le capteur associé est indisponible, la carte calcule une **température de surface estimée** : `temp_intérieure + (temp_extérieure − temp_intérieure) × facteur_vitrage`, où le facteur de vitrage vaut par défaut **0,15** et est configurable (plage : 0,0–1,0). Les facteurs indicatifs au centre du vitrage sont de 0,08–0,12 pour un vitrage haute performance, 0,14–0,20 pour un double vitrage moderne, 0,25–0,40 pour un ancien double vitrage et 0,60–0,75 pour un simple vitrage. Les cadres, bords de vitre, le vent et la pose peuvent fortement varier. Il s'agit d'un modèle thermique simplifié — le résultat est explicitement affiché comme une **estimation, et non une mesure** ; utilisez un capteur de surface pour une évaluation fiable.

### Marge de condensation et niveaux de risque

La **marge de condensation** est égale à `temp_surface − point_de_rosée`. Trois niveaux fixes sont appliqués :

| Marge | Niveau |
| --- | --- |
| ≤ 0 °C | 🔴 Critique — condensation probable |
| > 0 °C et ≤ 3 °C | 🟡 Avertissement — surface proche du point de rosée |
| > 3 °C | 🟢 Sûr — marge de condensation positive |

### Support °F et comportement en cas d'indisponibilité

Toutes les températures affichées sont converties en °F lorsque vos paramètres régionaux Home Assistant utilisent le système impérial ; les calculs internes utilisent toujours des °C. Lorsqu'un relevé requis est indisponible, la carte le signale clairement et masque uniquement les calculs qui en dépendent.

Les cartes compactes de température, d'humidité et de pression affichent également un état compréhensible. Les niveaux de pression utilisent la valeur convertie en hPa (`< 1000` basse, `1000–1025` normale, `> 1025` haute). Ces niveaux météorologiques ne sont pertinents qu'avec une **pression corrigée au niveau de la mer** ; la pression brute de la station dépend fortement de l'altitude.

### Infobulles éducatives

Chaque indicateur de station, chaque relevé de zone environnementale et chaque valeur de confort calculée dispose d'une infobulle éducative expliquant sa signification et, si nécessaire, son calcul. Il n'y a **aucun bouton « ? » séparé** : c'est la tuile/ligne de la valeur elle-même qui déclenche l'infobulle, ce qui garde l'affichage épuré. Un discret soulignement pointillé sous le libellé indique les valeurs qui possèdent une explication. Les infobulles sont déclenchées par :

- **Survol** — pointeur de la souris sur la valeur
- **Focus clavier** — Tab jusqu'à la valeur (chacune peut recevoir le focus) ; l'explication apparaît au focus
- **Toucher / appui** — appui sur la valeur sur les écrans tactiles

Les infobulles ne contiennent que des informations explicatives. L'analyse confort ne formule **aucune affirmation de précision scientifique ou de sécurité** — c'est un outil d'affichage informatif, et non un instrument certifié ni un conseil professionnel de quelque nature que ce soit.

## Réactivité, performance, accessibilité, confidentialité

- **Réactivité** — le viewport de la scène remplit son conteneur et s'adapte aux smartphones, tablettes, cartes de bureau et écrans muraux ; sur les petits écrans/mobiles, toute la scène est affichée en premier, suivie de l'intégralité de la zone d'informations — rien n'est masqué, seules les lignes de prévisions peuvent défiler horizontalement. La densité des panneaux et la taille des polices s'ajustent sur les petites largeurs. Sur une carte suffisamment large (par exemple étirée dans un tableau de bord en vue Sections), les panneaux d'informations se disposent en **colonnes responsives (masonry)** au lieu d'une longue bande ; le nombre de colonnes suit la largeur réellement rendue de la carte (pas la fenêtre), donc cela fonctionne même dans un emplacement étroit sur un grand écran et revient à une seule colonne sur les petites cartes.
- **Performance** — la qualité et l'intensité de l'animation sont configurables ; la densité de pixels de l'appareil utilisée pour les canevas est plafonnée à 2 pour éviter une charge GPU/CPU excessive sur les écrans haute densité ; le rendu est automatiquement mis en pause lorsque la carte défile hors de l'écran (`IntersectionObserver`) ou que l'onglet du navigateur est masqué (`visibilitychange`). Le `ResizeObserver` du moteur de rendu reste attaché au viewport de la scène, si bien que redimensionner/reconnecter la carte (par exemple en changeant de tableau de bord) conserve une animation correctement dimensionnée.
- **Accessibilité** — le moteur de rendu respecte le réglage système `prefers-reduced-motion` : une seule image statique est dessinée au lieu d'une boucle d'animation continue. Les infobulles éducatives des panneaux station, environnement et confort sont entièrement accessibles au clavier — chaque valeur peut recevoir le focus via Tab et révèle son explication au focus (`aria-describedby`) — et répondent au toucher/clic, sans aucune interaction réservée au pointeur.
- **Confidentialité** — la carte n'effectue **aucun appel réseau propre** au moment de l'exécution, en dehors de ce que votre frontend Home Assistant fait déjà (charger l'image de maison configurée et dialoguer avec votre propre instance Home Assistant). Aucune télémétrie, aucun outil d'analyse, aucun service tiers n'intervient dans le rendu de la scène météo. Les règles d'alerte sont évaluées **entièrement en local dans le navigateur**, uniquement pendant que la carte est affichée — rien n'est envoyé nulle part et aucun service/notification Home Assistant n'est jamais déclenché par elles.

## Dépannage

- **La carte n'apparaît pas dans le sélecteur** — vérifiez que la ressource Lovelace a bien été enregistrée (HACS le fait automatiquement ; pour une installation manuelle, vérifiez **Paramètres → Tableaux de bord → Ressources**), puis rechargez complètement l'onglet du navigateur (Ctrl/Cmd+Maj+R) pour contourner le cache.
- **« Aucune entité météo trouvée »** — choisissez-en une explicitement dans l'éditeur, ou assurez-vous qu'au moins une entité `weather.*` est disponible (ni `unavailable`, ni `unknown`).
- **Un indicateur n'affiche rien** — ouvrez l'onglet **Association des entités** : il indique, pour chaque indicateur, l'entité/attribut exactement résolu et la source de résolution (remplacement manuel / attribut météo / capteur / non disponible).
- **Un indicateur s'est associé automatiquement à la mauvaise entité** (par exemple un capteur de puissance/énergie choisi pour un indicateur de type température car son nom contient un mot-clé correspondant) — cette catégorie de bug est désormais spécifiquement bloquée : une entité dont la `device_class` est définie et ne correspond pas aux classes acceptées par l'indicateur est toujours rejetée, quels que soient les mots-clés correspondants dans son identifiant ou son nom convivial. Si vous voyez encore une association automatique incorrecte, ouvrez **Association des entités**, vérifiez l'identifiant d'entité affiché comme « résolu », et définissez-y un remplacement manuel explicite — les remplacements manuels l'emportent toujours sur la détection automatique.
- **Une ligne de zone environnementale affiche un tiret cadratin (—)** — l'entité associée à cette ligne dans l'onglet **Environnement** est manquante ou indisponible ; vérifiez la notification de validation de la zone et corrigez l'identifiant d'entité ou le capteur lui-même.
- **Une alerte n'apparaît jamais** — vérifiez que la règle est activée, qu'elle possède au moins une condition, et que chaque entité référencée est disponible et rapporte un état numérique ; pour la logique **toutes**, chaque condition doit être vraie simultanément, pour la logique **au moins une**, une seule suffit. N'oubliez pas que les alertes ne sont évaluées que pendant que la carte est réellement affichée à l'écran.
- **Les prévisions n'apparaissent pas** — votre intégration météo ne prend peut-être pas en charge le type de prévision `hourly` ou `daily` ; ceci est signalé en interne comme « non pris en charge » plutôt que comme une erreur, et la ligne de prévision correspondante est masquée.
- **Ancienne configuration après une mise à jour** — les configurations sont fusionnées avec les valeurs par défaut actuelles au chargement, donc les configurations anciennes ou partielles continuent de fonctionner ; si un champ semble incorrect, ouvrez l'éditeur, il affichera les valeurs effectives. Voir [Migration et compatibilité de la configuration](#migration-et-compatibilité-de-la-configuration).
- **Scène vide/noire** — vérifiez que l'URL de votre image est accessible (ouvrez-la directement dans un onglet du navigateur) ; si l'URL est incorrecte, l'animation du ciel continue de s'afficher, mais sans votre photo de maison.
- **La carte paraît plus haute qu'avant après la mise à jour** — c'est normal : depuis la v1.0.1, la zone d'informations s'agrandit naturellement sous la scène au lieu d'être découpée par-dessus. Voir [Mise en page](#mise-en-page--scène-et-zone-dinformations).

## Mise à jour et suppression de la carte

- **Mise à jour** — HACS vous informera des nouvelles versions ; cliquez sur « Mettre à jour » puis rechargez le frontend ensuite.
- **Suppression** — retirez la carte de vos tableaux de bord, puis supprimez le dépôt de HACS (ou supprimez la ressource et le fichier pour une installation manuelle). Cette carte ne crée aucune entité, automatisation ni service en arrière-plan persistant, la suppression est donc immédiate et propre.

## Migration et compatibilité de la configuration

La mise à jour depuis la v1.0.0 est **sûre et ne nécessite aucune modification manuelle de configuration** :

- Les configurations existantes continuent de fonctionner telles quelles ; chaque nouveau champ (`environment_zones`, `alerts`, l'indicateur de température extérieure, l'association manuelle par indicateur) est fusionné avec des valeurs par défaut sûres (`[]` pour les zones/alertes) s'il est absent de votre configuration/YAML enregistrée.
- L'indicateur `humidity` existant et son remplacement manuel sont préservés sans changement — il est désormais libellé « Humidité extérieure » dans l'interface, mais la clé de configuration et l'association d'entité sous-jacentes sont inchangées.
- Visuellement, la carte paraîtra différente immédiatement après la mise à jour : la scène devient un viewport plus petit et dégagé en haut, et tous les indicateurs/prévisions se déplacent dans une zone d'informations en flux normal en dessous, ce qui peut rendre la carte globalement plus haute. `Apparence → Hauteur minimale`/`Ratio d'aspect` ne dimensionnent désormais que la scène ; si votre carte paraît trop courte ou trop haute, revoyez ces deux réglages.
- Aucune association d'entité n'est perdue : tous les remplacements manuels que vous aviez configurés pour les indicateurs existants continuent de fonctionner et se modifient désormais depuis le nouvel onglet **Association des entités** plutôt que depuis les anciens menus déroulants intégrés à l'onglet **Indicateurs météo**.
- `environment_zones` et `alerts` démarrent vides ; rien n'est préconfiguré automatiquement à votre place, car l'attribution des zones/pièces et les seuils d'alerte sont par nature propres à votre logement et toujours configurés manuellement.
- `comfort.enabled` vaut par défaut `false` ; le panneau de confort n'est jamais affiché automatiquement et doit être explicitement activé dans l'onglet **Confort** — les configurations existantes sans cette section continuent de fonctionner avec le panneau masqué.

## Développement

```bash
npm install       # installer les dépendances
npm run typecheck # vérification stricte des types TypeScript
npm test          # exécuter la suite de tests unitaires vitest
npm run build     # vérifie les types puis produit dist/immersive-weather-dashboard.js
npm run dev       # reconstruction à chaque modification de fichier
```

Le projet est en TypeScript pur + [Lit](https://lit.dev/) + [Vite](https://vitejs.dev/), empaqueté en un seul fichier IIFE sans dépendance CDN au moment de l'exécution. Les versions sont construites par le workflow GitHub Actions `release.yml` lorsque vous poussez un tag `vX.Y.Z` ; il joint `dist/immersive-weather-dashboard.js` à la release GitHub et valide le résultat avec l'action officielle de HACS. Le résultat de la compilation n'est intentionnellement **pas** versionné dans le dépôt — il n'est produit que par la CI ou en local — afin de garder l'arborescence source propre.

### Première publication et versions

1. Créez le dépôt GitHub public `zarzak12/immersive-weather-dashboard`, ajoutez-lui une brève description, activez les Issues et ajoutez des sujets tels que `home-assistant`, `hacs`, `lovelace` et `weather`.
2. Poussez le code source sur sa branche `main`.
3. Publiez la première version en poussant un tag sémantique :

```bash
git tag v1.0.0
git push origin main
git push origin v1.0.0
```

Le workflow de release compile et joint exactement le fichier attendu par `hacs.json`. Attendez que le workflow **Release** se termine avec succès avant d'ajouter le dépôt dans HACS. Pour les versions suivantes, mettez à jour `package.json`, validez ce changement et poussez un nouveau tag `vX.Y.Z` ; ne déplacez et ne réutilisez jamais un tag de version existant.

## FAQ

**Dois-je écrire du YAML ?** Non. Toutes les options sont disponibles dans l'éditeur graphique, aussi bien pour ajouter la carte que pour la modifier ensuite.

**Cette carte appelle-t-elle un service météo ou une IA externe au moment de l'exécution ?** Non. Toute l'animation est calculée localement avec l'API Canvas 2D. La seule activité réseau est le chargement par Home Assistant de votre image de maison configurée et le trafic normal du frontend/WebSocket Home Assistant.

**Puis-je l'utiliser sans photo de maison ?** Oui — laissez l'URL de l'image vide et vous obtenez une scène de ciel/météo animée plein écran sans image de premier plan.

**Quelles intégrations météo sont prises en charge ?** Toute intégration fournissant une entité `weather.*` standard. La prise en charge des prévisions dépend du fait que cette intégration implémente les abonnements WebSocket de prévisions `hourly`/`daily`.

**Les règles d'alerte vont-elles m'envoyer une notification si je ne regarde pas le tableau de bord ?** Non. Les alertes sont des recommandations d'affichage purement visuelles, rendues à l'intérieur de la carte et évaluées uniquement pendant qu'elle est affichée ; une carte Lovelace ne peut pas s'exécuter en arrière-plan, elle n'appelle donc jamais de service ou de notification Home Assistant. Utilisez une automatisation Home Assistant si vous devez être notifié ailleurs.

**Puis-je utiliser ma propre station météo (par exemple ESP32) au lieu des données du fournisseur ?** Oui — associez ses entités capteur aux indicateurs extérieurs (température, humidité, pression…) dans l'onglet **Association des entités** ; les remplacements manuels ont toujours la priorité sur le fournisseur météo.

## Limites

- Le moteur de rendu est **procédural et stylisé**, pas une simulation météo photoréaliste ni un service vidéo/photo météo sous licence ; ne vous attendez pas à un réalisme cinématographique.
- Les visuels de précipitations, de nuages et d'éclairs sont des approximations pilotées par la condition rapportée par l'entité météo, pas des simulations physiquement exactes.
- La qualité de l'effet de « ciel transparent » dépend entièrement de la qualité du détourage alpha de votre image.
- Des images de maison très volumineuses ou non optimisées peuvent ralentir le chargement initial de la carte ; voir les recommandations de résolution ci-dessous.
- Les associations d'entités des zones environnementales et des alertes sont **intentionnellement manuelles** — la carte ne tente pas de deviner quel capteur appartient à quelle pièce, cette attribution étant par nature propre à votre logement.
- Les règles d'alerte sont **purement d'affichage** : elles ne déclenchent jamais de notification, de service ou d'automatisation Home Assistant, et ne sont évaluées que pendant que la carte est réellement affichée à l'écran.

## Prompt IA pour préparer votre photo de maison

Vous pouvez utiliser un outil d'édition d'image par IA (ou un outil de suppression d'arrière-plan, voir la solution de repli ci-dessous) pour transformer votre propre photo de maison en calque de premier plan à ciel transparent attendu par cette carte. Copiez le prompt ci-dessous dans l'outil de votre choix.

> ⚠️ **N'utilisez qu'une photo dont vous êtes propriétaire ou que vous avez le droit de modifier et d'afficher.** Téléverser une photo personnelle vers un service d'IA tiers envoie cette image à ce fournisseur — vérifiez ses politiques de conservation et d'entraînement des données avant de la téléverser, et demandez-vous si la photo révèle des détails sensibles (numéro de maison, plaques d'immatriculation, visages de personnes, localisation précise) que vous préféreriez flouter au préalable.

### Prompt prêt à copier

```
Retouche cette photo de ma maison. Conserve la maison, le sol, l'allée, la végétation et
tous les éléments du premier plan exactement tels qu'ils sont : même géométrie, même
perspective, mêmes matériaux, même éclairage sur le sujet, un rendu entièrement
photoréaliste — ne repeins et ne restylise rien d'autre que le ciel. Supprime UNIQUEMENT
le ciel, jusqu'à la silhouette exacte de la ligne de toiture, des cheminées, des antennes
et des branches d'arbres qui le traversent. Remplace le ciel supprimé par une véritable
transparence alpha totale (canal alpha RGBA = 0) — pas de blanc, pas de noir, pas de motif
en damier, pas de couleur unie servant de substitut à la transparence. Préserve les détails
fins comme les antennes, les cheminées, les câbles et les fines branches, avec des bords
propres et anti-crénelés ; ne les floute pas et ne les simplifie pas. N'ajoute ni nuages,
ni soleil, ni étoiles, ni éclairs, ni éclairage supplémentaire, ni reflets, ni filigrane,
ni texte. Exporte un fichier PNG ou WebP sans perte avec un véritable canal alpha, à la
résolution et au ratio d'aspect d'origine, sans recadrage, étirement ni recomposition.
```

### Prompt négatif

```
ciel, nuages, soleil, lune, étoiles, brume, effet de halo, arrière-plan en dégradé,
arrière-plan de couleur unie, fond blanc, fond noir, motif en damier intégré aux pixels,
ombre portée ajoutée, bâtiments supplémentaires, personnes, voitures, texte, filigrane,
logo, bords flous, artefacts JPEG, géométrie modifiée, perspective modifiée, style
cartoon, style peinture, basse résolution, artefacts d'agrandissement
```

### Liste de vérification (à faire avant de téléverser le résultat)

- [ ] Zoomez à 300–400 % sur la ligne de toiture, la cheminée et les branches d'arbres : le bord alpha doit être propre et anti-crénelé, sans liseré blanc ou noir marqué.
- [ ] Ouvrez le fichier dans un éditeur/visualiseur qui affiche un damier pour la transparence (par exemple GIMP, Photoshop, Affinity Photo, ou l'aperçu de fichier de votre système) : toute l'ancienne zone de ciel doit afficher le damier, pas une couleur unie simulant la transparence.
- [ ] Les objets fins (antenne, cheminée, câbles, fines branches) sont toujours visibles et n'ont pas été « mangés » par la suppression du ciel.
- [ ] La résolution et le ratio d'aspect correspondent à la photo d'origine — pas de recadrage ou d'étirement indésirable.
- [ ] Aucun nouveau ciel, nuage, soleil, étoile, éclairage ou texte n'a été ajouté par l'outil.
- [ ] Le fichier est enregistré en PNG (24/32 bits, avec alpha) ou en WebP (sans perte, avec alpha) — **jamais en JPEG**, qui ne peut absolument pas stocker de transparence.

### Si votre outil d'IA ne peut pas produire de véritable transparence alpha

Certains générateurs d'images par IA ne produisent qu'une image aplatie — une couleur unie, un damier *dessiné en pixels*, ou un arrière-plan « ciel » générique — même si vous demandez de la transparence. Dans ce cas :

1. Utilisez le résultat de l'IA comme *guide approximatif* pour repérer la limite ciel/toiture.
2. Passez la photo d'origine dans un outil dédié de suppression d'arrière-plan (par exemple l'outil en ligne de commande open source [`rembg`](https://github.com/danielgatis/rembg), ou les outils intégrés de GIMP/Photoshop/Affinity Photo/Photopea) pour détourer le ciel manuellement ou automatiquement.
3. Affinez le masque à la main autour des détails fins (antennes, branches) pour un résultat net.
4. Exportez en PNG ou WebP avec un véritable canal alpha, puis revérifiez avec la liste de contrôle ci-dessus.

Ne présentez jamais une image aplatie à transparence simulée comme si elle disposait d'un véritable canal alpha — la carte s'appuie sur une transparence alpha authentique par pixel pour composer correctement le ciel animé.

### Résolution et poids de fichier recommandés

- Utilisez au moins la résolution native de votre écran cible (par exemple 1920 × 1080 pour un écran mural Full HD), et évitez de dépasser environ 3000 px sur le plus grand côté — une résolution plus élevée ajoute rarement un détail visible sur un tableau de bord mais ralentit le chargement.
- Préférez le WebP sans perte ou un PNG optimisé (passez-le par exemple dans `oxipng` ou `pngquant` en mode sans perte ou quasi sans perte) pour rester sous quelques mégaoctets sans abîmer les bords du canal alpha.
- Conservez le ratio d'aspect d'origine ; la carte utilise `object-fit: cover`, donc un ratio différent entraînera un recadrage plutôt qu'un étirement.

## Licence

Distribué sous [licence MIT](LICENSE).
