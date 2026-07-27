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
- [Comment fonctionne la superposition d'images](#comment-fonctionne-la-superposition-dimages)
- [Référence de configuration](#référence-de-configuration)
- [Algorithme de détection automatique et remplacements manuels](#algorithme-de-détection-automatique-et-remplacements-manuels)
- [Tableau de référence des indicateurs / entités](#tableau-de-référence-des-indicateurs--entités)
- [Prévisions](#prévisions)
- [Réactivité, performance, accessibilité, confidentialité](#réactivité-performance-accessibilité-confidentialité)
- [Dépannage](#dépannage)
- [Mise à jour et suppression de la carte](#mise-à-jour-et-suppression-de-la-carte)
- [Développement](#développement)
- [FAQ](#faq)
- [Limites](#limites)
- [Prompt IA pour préparer votre photo de maison](#prompt-ia-pour-préparer-votre-photo-de-maison)
- [Licence](#licence)

## Concept

Immersive Weather Dashboard transforme une simple carte Lovelace en une scène météo plein écran. Vous fournissez une photo de votre propre maison dont le ciel a été détouré (avec une véritable transparence alpha). La carte affiche derrière cette photo un ciel animé **procédural, calculé localement** : dégradés jour/nuit, soleil/lune, étoiles, nuages en mouvement, pluie, pluie battante, neige, mélange neige/pluie, grêle, brouillard, vent et orages avec éclairs. Tout est dessiné avec l'API Canvas 2D au moment de l'exécution — **aucun fichier vidéo, aucun service de rendu dans le cloud, aucun appel réseau** n'est utilisé pour produire l'animation.

Le résultat est une carte de tableau de bord/écran mural qui semble vivante et réagit à votre véritable entité météo et à vos capteurs, tout en gardant votre propre maison reconnaissable au premier plan.

## Tour des fonctionnalités

- Mise en page immersive plein écran, conçue pour smartphones, tablettes, tableaux de bord de bureau et écrans muraux.
- Moteur météo/ciel procédural : dégradé jour/nuit, soleil, lune, étoiles scintillantes, nuages en dérive, pluie, pluie battante, neige, mélange neige/pluie, grêle, brouillard, rafales de vent, éclairs pour les orages.
- Panneaux « glassmorphism » discrets (flous, translucides) pour les conditions actuelles, la station d'indicateurs et les prévisions, afin que la scène reste visible en dessous.
- Configuration graphique complète — **aucune édition YAML n'est nécessaire** après l'installation via HACS. Chaque option (image, couleurs, opacité, indicateurs, prévisions…) dispose d'un contrôle dans l'interface.
- Détection automatique fiable des entités grâce à un algorithme de score déterministe, avec remplacement manuel possible pour chaque indicateur.
- Abonnement en direct aux prévisions via l'API WebSocket moderne `weather/subscribe_forecast` (journalières et horaires), avec gestion explicite des cas où une intégration météo ne prend pas en charge un type de prévision donné.
- Respecte le réglage système `prefers-reduced-motion`, met le rendu en pause lorsque la carte n'est plus visible à l'écran ou que l'onglet du navigateur est masqué, et plafonne la densité de pixels de l'appareil pour maîtriser le coût GPU/CPU.
- Contrôles de qualité et d'intensité d'animation pour que les tablettes murales peu puissantes et les écrans Raspberry Pi restent fluides.
- Interface en anglais et en français, suivant `hass.locale.language`, avec repli sur l'anglais.

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
3. Ajoutez la carte à un tableau de bord, ouvrez l'éditeur de carte, et dans l'onglet **Image et scène**, collez le chemin de l'image (`/local/maison.png`) dans **URL de l'image de la maison**.
4. Choisissez votre **entité météo** dans l'onglet **Source de données**, ou laissez le champ vide pour laisser la carte détecter automatiquement la meilleure entité.
5. Ajustez l'**Apparence** (opacité/flou/rayon des panneaux, couleurs d'accent/texte, hauteur minimale, densité) pour correspondre à votre thème et à votre écran.
6. Activez/désactivez les **Prévisions** et choisissez le nombre d'éléments horaires/journaliers à afficher.
7. Ouvrez **Indicateurs météo** pour réordonner, masquer, relabelliser, recolorer ou remapper manuellement chacun des seize indicateurs pris en charge.
8. Cliquez éventuellement sur **Configuration automatique** une fois satisfait des détections automatiques, pour les figer dans la configuration enregistrée (voir [Détection automatique](#algorithme-de-détection-automatique-et-remplacements-manuels)).

## Comment fonctionne la superposition d'images

La carte compose trois couches, de l'arrière vers l'avant :

1. **Canevas d'arrière-plan** — dégradé de ciel, soleil/lune, étoiles et nuages. Il se trouve **derrière** votre photo de maison, et ne devient donc visible qu'à travers la zone de ciel transparente de votre PNG/WebP.
2. **Votre photo de maison** — le premier plan opaque (maison, sol, végétation…) peint par-dessus le canevas d'arrière-plan. Partout où la photo est opaque, l'animation du ciel est naturellement masquée ; partout où elle est transparente (le ciel détouré), l'arrière-plan animé apparaît.
3. **Canevas de premier plan** — pluie, neige, grêle, volutes de brouillard et éclairs, dessinés **au-dessus** de votre photo de maison. C'est intentionnel : la pluie et la brume qui tombent passent aussi réellement devant une maison, pas seulement derrière.

La composition reposant entièrement sur le canal alpha de votre image, la qualité du détourage détermine directement le réalisme de la scène. Un masque alpha propre et précis (sans liseré, sans pixel de ciel restant, sans antenne trop effacée) est l'ingrédient le plus important pour un bon résultat.

## Référence de configuration

Tout ce qui suit est configurable depuis l'éditeur graphique. Aucune édition YAML n'est nécessaire ni attendue. Home Assistant stocke tout de même la configuration en interne (comme pour toute carte), mais vous n'avez jamais besoin de l'ouvrir ou de la modifier à la main.

| Onglet de l'éditeur | Options |
| --- | --- |
| Source de données | Titre de la carte, entité météo (ou détection automatique) |
| Image et scène | URL de l'image de la maison, mode jour/nuit (auto/jour/nuit), animation activée/désactivée, qualité d'animation (faible/moyenne/élevée), intensité d'animation (0–2) |
| Apparence | Opacité des panneaux, flou des panneaux, rayon des coins des panneaux, couleur d'accent, couleur du texte, hauteur minimale de la carte, ratio d'aspect, densité (confortable/compacte) |
| Prévisions | Afficher/masquer les prévisions horaires, afficher/masquer les prévisions journalières, nombre d'éléments horaires, nombre d'éléments journaliers |
| Indicateurs météo | Par indicateur : visible, libellé personnalisé, couleur personnalisée, icône personnalisée, entité de remplacement manuelle, et un indicateur de « source » en lecture seule (manuelle / attribut météo / capteur / non disponible) |

Deux actions dédiées sont toujours disponibles :

- **Réinitialiser** — restaure toutes les options à leurs valeurs par défaut (conserve le type de carte).
- **Configuration automatique** — calcule un nouvel instantané de la meilleure entité météo et des meilleurs capteurs détectés et **l'enregistre** dans la configuration après une boîte de dialogue de confirmation explicite. Tant que vous ne cliquez pas dessus, la détection automatique reste purement dynamique/adaptative et rien n'est écrit dans votre configuration.

## Algorithme de détection automatique et remplacements manuels

Pour chacun des seize indicateurs pris en charge, la carte résout une valeur selon cet ordre de priorité strict :

1. **Remplacement manuel** — l'entité que vous avez explicitement choisie pour cet indicateur dans l'éditeur. Si elle existe mais est `unavailable`/`unknown`, l'indicateur est affiché comme non disponible plutôt que de basculer silencieusement vers une autre source (les erreurs de configuration restent ainsi visibles).
2. **Attribut de l'entité météo** — si l'entité météo sélectionnée expose un attribut correspondant (par exemple `humidity`, `pressure`, `wind_speed`, `wind_bearing`, `wind_gust_speed`, `uv_index`, `visibility`, `dew_point`, `cloud_coverage`, `ozone`, `apparent_temperature`), il est utilisé directement.
3. **Capteur le mieux noté** — la carte note chaque entité `sensor.*` (et `air_quality.*` pour la qualité de l'air) par rapport à l'indicateur : `+10` pour une `device_class` correspondante, `+5` pour un mot-clé correspondant dans l'identifiant de l'entité, `+3` pour un mot-clé correspondant dans le nom convivial. Les indicateurs dont la classe est ambiguë (par exemple le point de rosée face à une température quelconque, les rafales face au vent moyen ou le lever du soleil face à n'importe quel horodatage) exigent aussi un mot-clé sémantique. Les entités `unavailable`/`unknown`, appartenant à un domaine non autorisé ou ne passant pas ce garde-fou sont rejetées afin d'éviter les associations accidentelles. L'entité la mieux notée l'emporte ; en cas d'égalité, l'ordre alphabétique de l'identifiant tranche, pour rester déterministe.
4. **Entité `sun.sun`** — utilisée uniquement pour le lever/coucher du soleil, via `next_rising`/`next_setting`, si aucun capteur n'a été trouvé.
5. **Non disponible** — si rien ne convient, l'indicateur est simplement omis de la station plutôt que d'afficher un zéro trompeur.

L'entité météo elle-même est sélectionnée de façon similaire : votre entité `weather.*` configurée est utilisée si elle existe et est disponible ; sinon, la carte choisit l'entité météo disponible qui expose le jeu d'attributs de station actuels le plus riche. Les égalités sont départagées par ordre alphabétique afin de conserver un résultat déterministe.

Cet algorithme s'exécute en direct à chaque rendu de la carte, il s'adapte donc naturellement si vous ajoutez, renommez ou remplacez des entités — sauf si vous avez explicitement utilisé **Configuration automatique**, qui fige les détections actuelles dans la configuration enregistrée.

## Tableau de référence des indicateurs / entités

| Indicateur | Attribut météo utilisé | `device_class` du capteur | Mots-clés typiques |
| --- | --- | --- | --- |
| Ressenti (température apparente) | `apparent_temperature` | `temperature` | feels_like, apparent, ressenti |
| Humidité | `humidity` | `humidity` | humidity, humidite |
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

## Prévisions

Les prévisions n'étant plus exposées comme attributs d'état des entités météo dans les versions récentes de Home Assistant, la carte s'abonne aux mises à jour de prévisions en direct via la commande WebSocket `weather/subscribe_forecast`, séparément pour les types `daily` et `hourly`. Si votre intégration météo ne prend pas en charge un type de prévision donné, la tentative d'abonnement est gérée explicitement (pas silencieusement ignorée) et la section correspondante est simplement masquée — vous ne verrez pas de chargement bloqué indéfiniment. Les abonnements sont automatiquement renouvelés si vous changez d'entité météo ou de réglages de prévisions, et proprement résiliés lorsque la carte est retirée ou quitte le tableau de bord.

## Réactivité, performance, accessibilité, confidentialité

- **Réactivité** — la scène remplit son conteneur et s'adapte aux smartphones, tablettes, cartes de bureau et écrans muraux ; la densité des panneaux et la taille des polices s'ajustent sur les petites largeurs.
- **Performance** — la qualité et l'intensité de l'animation sont configurables ; la densité de pixels de l'appareil utilisée pour les canevas est plafonnée à 2 pour éviter une charge GPU/CPU excessive sur les écrans haute densité ; le rendu est automatiquement mis en pause lorsque la carte défile hors de l'écran (`IntersectionObserver`) ou que l'onglet du navigateur est masqué (`visibilitychange`).
- **Accessibilité** — le moteur de rendu respecte le réglage système `prefers-reduced-motion` : une seule image statique est dessinée au lieu d'une boucle d'animation continue.
- **Confidentialité** — la carte n'effectue **aucun appel réseau propre** au moment de l'exécution, en dehors de ce que votre frontend Home Assistant fait déjà (charger l'image de maison configurée et dialoguer avec votre propre instance Home Assistant). Aucune télémétrie, aucun outil d'analyse, aucun service tiers n'intervient dans le rendu de la scène météo.

## Dépannage

- **La carte n'apparaît pas dans le sélecteur** — vérifiez que la ressource Lovelace a bien été enregistrée (HACS le fait automatiquement ; pour une installation manuelle, vérifiez **Paramètres → Tableaux de bord → Ressources**), puis rechargez complètement l'onglet du navigateur (Ctrl/Cmd+Maj+R) pour contourner le cache.
- **« Aucune entité météo trouvée »** — choisissez-en une explicitement dans l'éditeur, ou assurez-vous qu'au moins une entité `weather.*` est disponible (ni `unavailable`, ni `unknown`).
- **Un indicateur n'affiche rien** — vérifiez l'indicateur « source » dans l'onglet **Indicateurs météo** : il indique si la valeur provient d'un remplacement manuel, d'un attribut météo ou d'un capteur, et si rien n'a pu être trouvé.
- **Les prévisions n'apparaissent pas** — votre intégration météo ne prend peut-être pas en charge le type de prévision `hourly` ou `daily` ; ceci est signalé en interne comme « non pris en charge » plutôt que comme une erreur, et la ligne de prévision correspondante est masquée.
- **Ancienne configuration après une mise à jour** — les configurations sont fusionnées avec les valeurs par défaut actuelles au chargement, donc les configurations anciennes ou partielles continuent de fonctionner ; si un champ semble incorrect, ouvrez l'éditeur, il affichera les valeurs effectives.
- **Scène vide/noire** — vérifiez que l'URL de votre image est accessible (ouvrez-la directement dans un onglet du navigateur) ; si l'URL est incorrecte, l'animation du ciel continue de s'afficher, mais sans votre photo de maison.

## Mise à jour et suppression de la carte

- **Mise à jour** — HACS vous informera des nouvelles versions ; cliquez sur « Mettre à jour » puis rechargez le frontend ensuite.
- **Suppression** — retirez la carte de vos tableaux de bord, puis supprimez le dépôt de HACS (ou supprimez la ressource et le fichier pour une installation manuelle). Cette carte ne crée aucune entité, automatisation ni service en arrière-plan persistant, la suppression est donc immédiate et propre.

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

## Limites

- Le moteur de rendu est **procédural et stylisé**, pas une simulation météo photoréaliste ni un service vidéo/photo météo sous licence ; ne vous attendez pas à un réalisme cinématographique.
- Les visuels de précipitations, de nuages et d'éclairs sont des approximations pilotées par la condition rapportée par l'entité météo, pas des simulations physiquement exactes.
- La qualité de l'effet de « ciel transparent » dépend entièrement de la qualité du détourage alpha de votre image.
- Des images de maison très volumineuses ou non optimisées peuvent ralentir le chargement initial de la carte ; voir les recommandations de résolution ci-dessous.

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
