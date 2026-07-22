# Scraper anti-crise — promos.json

Récupère les catalogues optimisés d'anti-crise.fr et produit `data/promos.json`,
que le site lit ensuite. Aucun serveur : un job GitHub Actions tourne le mardi et
commite le fichier.

## Arborescence attendue dans le dépôt

```
votre-repo/
├─ index.html            (votre app)
├─ css/ js/ …
├─ data/
│  └─ promos.json        ← généré (ne pas éditer à la main)
├─ scraper/
│  ├─ anticrise.py
│  └─ requirements.txt
└─ .github/workflows/
   └─ promos.yml
```

## Lancer en local

```bash
pip install -r scraper/requirements.txt
python scraper/anticrise.py
```

Produit `data/promos.json` (+ une copie datée) et archive le HTML brut dans
`data/raw/AAAA-MM-JJ/`. Relancer le même jour relit l'archive au lieu de
retélécharger.

## Réglages (en haut de `anticrise.py`)

- `ENSEIGNES` : les magasins voulus, en minuscules, tels qu'écrits sur le listing
  (`"auchan supermarché"`, `"super u"`…). Un format = une entrée.
- `GARDER_EXPIRES` : `False` ignore les catalogues déjà terminés.
- `DELAI` : secondes entre deux requêtes (courtoisie).
- `CONTACT` : e-mail inclus dans le User-Agent — **mettez le vôtre**.

## Ce que contient `promos.json`

```jsonc
{
  "genere_le": "...",
  "source": "anti-crise.fr/les-catalogues-avec-optimisations",
  "nb_offres": 42,
  "catalogues": [ { "enseigne", "titre", "debut", "fin", "url", "nb_offres" } ],
  "offres": [ {
    "id", "enseigne", "catalogue_url", "debut", "fin", "page",
    "marque", "produit", "quantite",
    "prix",        // prix rayon pour la quantité Q
    "promo",       // remise immédiate (négatif)
    "opti",        // bon / coupon (négatif)
    "prix_final",  // coût réel après promo + coupon
    "remise_pct",
    "sources": [ { "label", "url" } ],   // liens ODR / coupon
    "vu_le"
  } ]
}
```

Le mapping vers l'onglet Promo est direct : `prix` → prix barré, `prix_final` →
prix choc rouge, `sources` → puces ODR/coupon, `prix_final` → pastille « réel ».

## Automatisation

`.github/workflows/promos.yml` lance le scraper chaque mardi 06:00 UTC et commite
`data/promos.json` s'il a changé. Lancement manuel possible via l'onglet
**Actions → Promos hebdo → Run workflow**.

## Bon voisinage / limites

- Respecte `robots.txt`, User-Agent identifiable, débit throttlé, cache du jour.
- anti-crise.fr est une **source secondaire et remplaçable** : toute la logique
  réseau est isolée dans la classe `Source`, pour la changer sans toucher au reste.
- Si une semaine renvoie 0 offre, le job échoue volontairement (rouge visible) :
  c'est le signal que la structure du site a changé et que le parseur est à revoir.
- Le HTML brut est archivé avant parsing : un parseur corrigé se rejoue sur
  l'archive sans re-télécharger.
