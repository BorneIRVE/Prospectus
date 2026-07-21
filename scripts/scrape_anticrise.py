#!/usr/bin/env python3
"""
Récupère les optimisations d'anti-crise.fr et écrit data/promos.json.

Parcours à deux niveaux :
  1. la page des catalogues optimisés donne la liste des catalogues,
  2. chaque page catalogue contient un tableau d'optimisations avec
     marque, produit, prix, prix final et pourcentage de remise.

C'est ce tableau qui porte les vraies données : la page de listing
ne contient que des vignettes, sans aucun prix.

Un diagnostic est affiché à chaque étape.
"""

import json
import re
import sys
import time
import unicodedata
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

import requests
from bs4 import BeautifulSoup

RACINE = Path(__file__).resolve().parent.parent
SORTIE = RACINE / "data" / "promos.json"
BASE = "https://anti-crise.fr"

INDEX = [
    f"{BASE}/les-catalogues-avec-optimisations/",
    f"{BASE}/les-nouveaux-catalogues-de-vos-supermarches/",
]

MAX_CATALOGUES = 45      # borne le temps d'exécution du workflow
PAUSE = 1.0              # secondes entre deux requêtes, par correction

ENTETES = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "fr-FR,fr;q=0.9",
    "Upgrade-Insecure-Requests": "1",
}

ENSEIGNES = [
    "Auchan Supermarché", "Auchan Local", "Auchan", "Carrefour Market", "Carrefour Contact",
    "Carrefour City", "Carrefour Express", "Carrefour", "Leclerc Local", "Leclerc",
    "Intermarché", "Lidl", "Aldi", "Atac", "Géant Casino", "Petit Casino", "Casino",
    "Cora", "Match", "Netto", "Super U", "Hyper U", "U Express", "Magasins U",
    "Monoprix", "Franprix", "G20", "Spar", "Vival", "Leader Price", "Bi1", "Colruyt",
    "Grand Frais", "Picard", "Norma", "Supeco", "Maximarché",
]

LEXIQUE = {
    "Boucherie": [
        "viande", "boeuf", "bœuf", "porc", "poulet", "volaille", "dinde", "jambon",
        "lardon", "saucisse", "merguez", "steak", "escalope", "roti", "rôti", "agneau",
        "veau", "hache", "haché", "chipolata", "bacon", "charcuterie", "cordon bleu",
        "canard", "boudin", "rillette", "saucisson", "nugget", "grillade", "knacki",
    ],
    "Poissonnerie": [
        "poisson", "saumon", "thon", "cabillaud", "colin", "crevette", "moule",
        "sardine", "maquereau", "surimi", "truite", "fruits de mer", "hareng", "anchois",
        "lieu noir", "merlu", "dorade", "tartinable de thon",
    ],
    "Crèmerie": [
        "lait", "yaourt", "fromage", "beurre", "creme", "crème", "mozzarella", "chevre",
        "chèvre", "parmesan", "emmental", "camembert", "skyr", "oeuf", "œuf", "raclette",
        "comte", "comté", "feta", "petit suisse", "faisselle", "reblochon", "brie",
        "boursin", "kiri", "babybel", "gouda", "gnocchi", "fromage blanc", "margarine",
        "chantilly", "mascarpone", "ricotta", "flan", "danette", "activia", "omega 3",
        "oméga 3", "pate a pizza", "pâte à pizza", "pate brisee", "pate feuilletee",
        "dessert lacte", "petit filou", "actimel", "yop",
    ],
    "Fruits & légumes": [
        "legume", "légume", "fruit", "salade", "tomate", "pomme de terre", "carotte",
        "oignon", "courgette", "poivron", "champignon", "poireau", "aubergine", "citron",
        "ail", "banane", "pomme", "orange", "raisin", "melon", "fraise", "basilic",
        "persil", "crudite", "crudité", "epinard", "épinard", "haricot vert", "avocat",
        "concombre", "brocoli", "chou", "radis", "betterave", "navet", "potiron",
    ],
    "Boulangerie": [
        "pain", "baguette", "brioche", "viennoiserie", "biscotte", "boulangerie",
        "patisserie", "pâtisserie", "croissant", "pain de mie", "harrys", "jacquet",
    ],
    "Surgelés": [
        "surgele", "surgelé", "glace", "poelee", "poêlée", "frite", "creme glacee",
        "sorbet", "magnum", "haagen", "pizza surgelee", "batonnet",
    ],
    "Épicerie": [
        "pate", "pâte", "riz", "semoule", "lentille", "pois chiche", "haricot rouge",
        "farine", "sucre", "huile", "vinaigre", "sauce", "conserve", "coulis", "moutarde",
        "mayonnaise", "ketchup", "epice", "épice", "cafe", "café", "the", "thé",
        "cereale", "céréale", "biscuit", "chocolat", "confiture", "miel", "soupe",
        "bouillon", "lait de coco", "curry", "couscous", "quinoa", "boulgour", "olive",
        "cornichon", "mais", "maïs", "petits pois", "sel", "poivre", "levure", "compote",
        "puree", "purée", "taboule", "taboulé", "nouille", "pizza", "soda", "boisson",
        "jus", "eau", "sirop", "bonbon", "chips", "gateau", "gâteau", "nesquik",
        "chocolat en poudre", "madeleine", "gaufre", "barre cerealiere",
    ],
}

HORS_SUJET = [
    "stylo", "cahier", "feutre", "surligneur", "crayon", "agenda", "colle", "ciseau",
    "ardoise", "classeur", "trousse", "papier dessin", "ruban", "correcteur", "scotch",
    "trieur", "porte vue", "bloc note", "cartable", "calculatrice", "copie double",
    "protege cahier", "fourniture", "shampoing", "gel douche", "dentifrice", "deodorant",
    "déodorant", "rasoir", "maquillage", "creme solaire", "solaire", "couche", "lingette",
    "serviette", "tampon", "lessive", "adoucissant", "liquide vaisselle", "nettoyant",
    "javel", "desodorisant", "entretien", "croquette", "litiere", "litière", "chien",
    "chat", "jouet", "vetement", "vêtement", "pile", "ampoule", "bricolage", "jardinage",
    "biere", "bière", "whisky", "rhum", "vodka", "champagne", "pastis", "vin",
    "cigarette", "magazine", "abonnement", "concours", "echantillon", "échantillon",
    "mouchoir", "papier toilette", "sopalin", "coton", "brosse a dent", "savon",
    "gel lavant", "soin", "creme visage", "epilation", "parfum", "vernis",
]

RE_PRIX = re.compile(r"(\d{1,4}[.,]\d{1,2})")
RE_POURCENT = re.compile(r"(\d{1,3})\s?%")
RE_DATES = re.compile(r"du[- ](\d{1,2})[- ](\w+)(?:[- ]\d{4})?[- ]au[- ](\d{1,2})[- ](\w+)[- ](\d{4})", re.I)


def sa(txt: str) -> str:
    return "".join(
        c for c in unicodedata.normalize("NFD", txt or "") if unicodedata.category(c) != "Mn"
    ).lower()


def contient(mot: str, texte: str) -> bool:
    """Frontières de mots, pluriels tolérés : « ail » ne doit pas matcher « volaille »."""
    return re.search(
        rf"(?<![a-z0-9]){re.escape(sa(mot))}(?:s|es|x)?(?![a-z0-9])", texte
    ) is not None


def classer_rayon(texte: str):
    t = sa(texte)
    if any(contient(x, t) for x in HORS_SUJET):
        return None
    for rayon in ["Boucherie", "Poissonnerie", "Crèmerie", "Fruits & légumes",
                  "Boulangerie", "Surgelés", "Épicerie"]:
        if any(contient(m, t) for m in LEXIQUE[rayon]):
            return rayon
    return None


def enseigne_depuis_url(url: str) -> str:
    slug = sa(url.rstrip("/").split("/")[-1]).replace("-", " ")
    for e in sorted(ENSEIGNES, key=len, reverse=True):
        if sa(e) in slug:
            return e
    return "Toutes enseignes"


def nombre(cellule: str):
    m = RE_PRIX.search(cellule.replace("\u202f", "").replace("\xa0", ""))
    return float(m.group(1).replace(",", ".")) if m else None


# ---------------------------------------------------------------- niveau 1
def lister_catalogues(session, diag: Counter):
    """Collecte les URL de catalogues depuis les pages d'index."""
    urls = []
    vus = set()
    for index in INDEX:
        try:
            r = session.get(index, timeout=40)
            print(f"    index {index} : statut {r.status_code}, "
                  f"{len(r.text):,} caracteres")
            if r.status_code != 200:
                continue
            soup = BeautifulSoup(r.text, "html.parser")
            for a in soup.find_all("a", href=True):
                href = a["href"]
                if not re.search(r"/catalogue/catalogue-[^/]+/?$", href):
                    continue
                plein = href if href.startswith("http") else BASE + href
                if plein in vus:
                    continue
                vus.add(plein)
                urls.append(plein)
        except Exception as exc:  # noqa: BLE001
            print(f"    ERREUR sur l'index : {exc}")
    diag["catalogues_trouves"] = len(urls)
    return urls[:MAX_CATALOGUES]


# ---------------------------------------------------------------- niveau 2
def lire_tableau(html: str, url: str, diag: Counter):
    """Extrait les lignes du tableau d'optimisations d'une page catalogue."""
    soup = BeautifulSoup(html, "html.parser")
    enseigne = enseigne_depuis_url(url)
    offres = []

    for table in soup.find_all("table"):
        entetes = [sa(th.get_text(" ", strip=True)) for th in table.find_all("th")]
        blob = " ".join(entetes)
        if "produit" not in blob:
            continue
        diag["tableaux_reconnus"] += 1

        def col(*noms):
            for n in noms:
                for i, h in enumerate(entetes):
                    if n in h:
                        return i
            return None

        i_marque = col("marque")
        i_produit = col("produit")
        i_prix = col("prix") if col("prix final") is None else None
        i_final = col("prix final")
        i_remise = col("r%", "remise", "%")
        i_qte = col("q")

        # « prix » et « prix final » se ressemblent : on les distingue par position
        indices_prix = [i for i, h in enumerate(entetes) if h.startswith("prix")]
        if len(indices_prix) >= 2:
            i_prix, i_final = indices_prix[0], indices_prix[-1]

        for tr in table.find_all("tr"):
            cells = tr.find_all(["td"])
            if len(cells) < 4:
                continue
            txt = [c.get_text(" ", strip=True) for c in cells]
            diag["lignes_lues"] += 1

            produit = txt[i_produit] if i_produit is not None and i_produit < len(txt) else ""
            marque = txt[i_marque] if i_marque is not None and i_marque < len(txt) else ""
            if not produit or len(produit) < 3:
                continue

            rayon = classer_rayon(f"{produit} {marque}")
            if not rayon:
                diag["hors_alimentaire"] += 1
                continue

            prix_avant = nombre(txt[i_prix]) if i_prix is not None and i_prix < len(txt) else None
            prix_final = nombre(txt[i_final]) if i_final is not None and i_final < len(txt) else None

            remise = 0.0
            if i_remise is not None and i_remise < len(txt):
                m = RE_POURCENT.search(txt[i_remise]) or RE_PRIX.search(txt[i_remise])
                if m:
                    v = float(m.group(1).replace(",", "."))
                    if 1 <= v <= 95:
                        remise = v / 100
            if not remise and prix_avant and prix_final and prix_final < prix_avant:
                remise = round(1 - prix_final / prix_avant, 2)

            qte = None
            if i_qte is not None and i_qte < len(txt):
                mq = re.search(r"\d+", txt[i_qte])
                qte = int(mq.group()) if mq else None

            offres.append({
                "enseigne": enseigne,
                "produit": f"{produit} {marque}".strip() if marque and sa(marque) not in sa(produit) else produit,
                "marque": marque,
                "rayon": rayon,
                "detail": f"{produit}{' · lot de ' + str(qte) if qte and qte > 1 else ''}",
                "type": "promo",
                "remise": round(remise, 2),
                "prix": prix_final,
                "prixAvant": prix_avant,
                "lien": url,
                "fin": None,
            })
    return offres


def main() -> int:
    session = requests.Session()
    session.headers.update(ENTETES)
    diag = Counter()
    items = []

    print("=== Niveau 1 : liste des catalogues")
    catalogues = lister_catalogues(session, diag)
    print(f"    {diag['catalogues_trouves']} catalogues reperes, "
          f"{len(catalogues)} seront lus")
    if not catalogues:
        print("    Aucun catalogue trouve : la page d'index a change de structure "
              "ou le site bloque la requete.", file=sys.stderr)

    print("\n=== Niveau 2 : lecture des tableaux d'optimisations")
    for i, url in enumerate(catalogues, 1):
        try:
            r = session.get(url, timeout=40)
            if r.status_code != 200:
                print(f"    [{i}/{len(catalogues)}] statut {r.status_code} — {url}")
                continue
            trouves = lire_tableau(r.text, url, diag)
            items += trouves
            if trouves:
                print(f"    [{i}/{len(catalogues)}] {enseigne_depuis_url(url):20} "
                      f"{len(trouves)} offres alimentaires")
        except Exception as exc:  # noqa: BLE001
            print(f"    [{i}/{len(catalogues)}] ERREUR : {exc}")
        time.sleep(PAUSE)

    print(f"\n    tableaux reconnus : {diag['tableaux_reconnus']}")
    print(f"    lignes lues : {diag['lignes_lues']} · "
          f"ecartees car non alimentaires : {diag['hors_alimentaire']}")

    # dédoublonnage
    uniques, vus = [], set()
    for it in items:
        cle = (sa(it["enseigne"]), sa(it["produit"]))
        if cle not in vus:
            vus.add(cle)
            uniques.append(it)

    uniques.sort(key=lambda x: x["remise"], reverse=True)
    uniques = uniques[:500]

    print(f"\n=== TOTAL : {len(uniques)} offres uniques")
    if not uniques:
        print("Rien a ecrire, le fichier existant est conserve.", file=sys.stderr)
        return 0

    print("Repartition :", dict(Counter(x["rayon"] for x in uniques)))
    print("Exemples :")
    for x in uniques[:10]:
        avant = f"{x['prixAvant']:.2f}€ -> " if x["prixAvant"] else ""
        prix = f"{x['prix']:.2f}€" if x["prix"] else "?"
        print(f"  [{x['rayon']:16}] {x['enseigne']:18} {x['produit'][:40]:40} "
              f"{avant}{prix} ({int(x['remise']*100)}%)")

    SORTIE.parent.mkdir(parents=True, exist_ok=True)
    SORTIE.write_text(
        json.dumps(
            {"maj": datetime.now(timezone.utc).isoformat(timespec="seconds"),
             "source": BASE, "items": uniques},
            ensure_ascii=False, indent=1,
        ),
        encoding="utf-8",
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
