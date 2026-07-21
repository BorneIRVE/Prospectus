# Prospectus

Assistant de menus : il compose les repas de la semaine sous votre budget, en tenant compte
de ce que vous avez déjà, de vos exclusions alimentaires et des promotions du moment.

## Mise en ligne (5 minutes, faisable depuis l'iPhone)

1. Sur github.com, créez un dépôt public — par exemple `prospectus`.
2. Glissez-y tous les fichiers de ce dossier, en gardant l'arborescence :

```
index.html
css/style.css
js/app.js
js/recettes.js
data/promos.json
scripts/scrape_anticrise.py
.github/workflows/promos.yml
```

3. Dans **Settings → Pages**, choisissez la branche `main` et le dossier `/ (root)`.
4. Le site s'ouvre sur `https://<votre-compte>.github.io/prospectus/`.
   Ajoutez-le à l'écran d'accueil : il s'ouvre alors comme une application.

## La mise à jour des promos

Le workflow `.github/workflows/promos.yml` tourne **chaque mardi à 5 h 30 UTC**.
Il lit anti-crise.fr, écrit `data/promos.json` et pousse le commit tout seul.
Aucune action de votre part.

Pour le déclencher à la main : onglet **Actions → Promos du mardi → Run workflow**.

Si anti-crise.fr change de structure, le script n'écrase rien : l'ancien fichier reste
en place et le site continue de fonctionner avec les prix de référence.

## Ce qui reste sur votre téléphone

Paramètres, menus, liste cochée et historique vivent dans le stockage local du navigateur.
Rien n'est envoyé à un serveur. Seule exception : la recherche des magasins interroge
OpenStreetMap avec vos coordonnées approximatives, une fois, au moment où vous appuyez
sur le bouton.

## Ajouter vos recettes

Ouvrez `js/recettes.js` et copiez le format d'une entrée existante.
`q` est la quantité **pour une personne**, `p` le prix de référence hors promo
par unité (`kg`, `L` ou `pièce`). Le reste se calcule tout seul.
