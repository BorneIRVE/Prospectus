# Prospectus — assistant menus & promos

Application web (site statique) qui construit des menus autour des promotions
de la semaine, calcule le **coût réel** après coupons/ODR, et génère une liste
de courses rangée par rayon. Aucune base de données, aucun serveur : le site
est statique et un job GitHub Actions met à jour les promos chaque mardi.

## Mise en ligne (GitHub Pages)

1. Créez un dépôt GitHub et déposez-y **tout le contenu de ce dossier** à la racine.
2. Dépôt → **Settings → Pages** → Source : *Deploy from a branch*, branche `main`, dossier `/root`.
3. Ouvrez l'URL fournie (`https://votre-compte.github.io/votre-repo/`).

L'app fonctionne immédiatement grâce au `data/promos.json` d'amorçage inclus.

## Activer la mise à jour automatique des promos

1. Ouvrez `scraper/anticrise.py` et réglez en haut :
   - `ENSEIGNES` : vos magasins (minuscules, comme sur anti-crise.fr) ;
   - `CONTACT` : votre e-mail (inséré dans le User-Agent).
2. Poussez le code. Le workflow `.github/workflows/promos.yml` tourne chaque
   mardi 06:00 UTC, régénère `data/promos.json` et le commite.
3. Pour un test immédiat : onglet **Actions → Promos hebdo → Run workflow**.

Voir `scraper/README.md` pour le détail.

## Structure

```
index.html            écran unique, 6 onglets
css/style.css         direction visuelle « prospectus »
js/
  rayons.js           range un produit dans un rayon (+ flag comestible)
  recettes.js         base de recettes (à enrichir librement)
  promos.js           rend l'onglet Promo depuis data/promos.json
  menu.js             génère le menu piloté par les promos
  app.js              orchestrateur (onboarding, navigation, liste, suivi)
data/promos.json      promos de la semaine (généré par le scraper)
scraper/              scraper Python + dépendances + notice
.github/workflows/    automatisation hebdomadaire
```

## Comment ça marche

- **Promo** — lit `data/promos.json`, classe chaque offre par rayon, affiche le
  prix barré rouge + le coût réel + les liens coupon/ODR. Bouton *Ajouter à ma
  liste* (verrouillé si l'offre est déjà au menu).
- **Menu** — `Générer` choisit les recettes qui exploitent le plus de promos
  alimentaires, sous vos contraintes (personnes, repas, exclusions, magasins).
  Anti-gaspi : réutilisation des restes signalée.
- **Liste** — construite depuis le menu (+ promos ajoutées + ajouts manuels),
  rangée par rayon, avec deux coûts : **promos (ferme)** et **reste estimé**.
  *Valider les courses* alimente le suivi de l'Accueil.
- **Accueil** — dépensé / économisé du mois, répartition par rayon, historique.
- **Réglages** — foyer, budget, exclusions, magasins, placards.

Tout est stocké en local sur l'appareil (localStorage). « Tout effacer » dans
Réglages remet à zéro.

## Limites connues (et évolutions)

- **Coût hors promo** = estimation forfaitaire (1,30 €/ingrédient) faute de
  prix de référence. Brancher **Open Prices** (Open Food Facts) le remplacera.
- **Générateur** = heuristique gloutonne (très bon menu, pas prouvé optimal).
  Un vrai solveur sous contraintes (OR-Tools) est l'évolution côté serveur.
- **Historique de prix / fausses promos** : nécessite d'accumuler plusieurs
  semaines de `promos.json`.
- anti-crise.fr est une **source secondaire et remplaçable** ; en cas de
  changement de structure, le scraper échoue visiblement (voir sa notice).
