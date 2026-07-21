#!/usr/bin/env python3
"""
Récupère les bons plans courses et bons de réduction d'anti-crise.fr
et écrit data/promos.json.

Ne garde que les offres alimentaires : la page mélange l'épicerie
et les fournitures scolaires, qui n'ont rien à faire dans un menu.

Lancé chaque mardi par GitHub Actions.
"""

import json
import re
import sys
import unicodedata
from datetime import datetime, timezone
from pathlib import Path

import requests
from bs4 import BeautifulSoup

RACINE = Path(__file__).resolve().parent.parent
SORTIE = RACINE / "data" / "promos.json"
BASE = "https://anti-crise.fr"

SOURCES = [
    (f"{BASE}/les-bons-plans-courses/", "promo"),
    (f"{BASE}/produits-1ere-necessite/", "promo"),
    (f"{BASE}/les-bons-de-reduction/", "coupon"),
    (f"{BASE}/les-catalogues-avec-optimisations/", "promo"),
]

ENTETES = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/126.0 Safari/537.36",
    "Accept-Language": "fr-FR,fr;q=0.9",
}

ENSEIGNES = [
    "Auchan Supermarché", "Auchan Local", "Auchan", "Carrefour Market", "Carrefour Contact",
    "Carrefour", "Leclerc Local", "Leclerc", "Intermarché", "Lidl", "Aldi", "Atac",
    "Géant Casino", "Petit Casino", "Casino", "Cora", "Match", "Netto", "Super U",
    "Hyper U", "U Express", "Magasins U", "Monoprix", "Franprix", "G20", "Spar", "Vival",
    "Leader Price", "Bi1", "Action", "Picard", "Grand Frais",
]

# ------------------------------------------------------------------
# Classement par rayon : les clés doivent correspondre à RAYONS
# dans js/recettes.js. Tout ce qui ne matche rien est écarté.
# ------------------------------------------------------------------
LEXIQUE = {
    "Fruits & légumes": [
        "legume", "fruit", "salade", "tomate", "pomme de terre", "carotte", "oignon",
        "courgette", "poivron", "champignon", "poireau", "aubergine", "citron", "ail",
        "banane", "pomme", "orange", "raisin", "melon", "fraise", "herbes", "basilic",
        "persil", "crudites", "epinard", "haricot vert", "avocat", "concombre",
    ],
    "Boucherie": [
        "viande", "boeuf", "porc", "poulet", "volaille", "dinde", "jambon", "lardon",
        "saucisse", "merguez", "steak", "escalope", "rôti", "roti", "charcuterie",
        "agneau", "veau", "cote de", "haché", "hache", "chipolata", "bacon",
    ],
    "Poissonnerie": [
        "poisson", "saumon", "thon", "cabillaud", "colin", "crevette", "moule",
        "sardine", "maquereau", "surimi", "truite", "fruits de mer", "poissons fumes",
    ],
    "Crèmerie": [
        "lait", "yaourt", "fromage", "beurre", "creme", "crème", "mozzarella", "chevre",
        "chèvre", "parmesan", "emmental", "camembert", "skyr", "oeuf", "œuf", "raclette",
        "comte", "comté", "feta", "petit suisse", "faisselle", "reblochon", "brie",
        "boursin", "kiri", "babybel", "gouda", "pâte à pizza", "pate a pizza", "pate brisee",
        "pâte brisée", "pate feuilletee", "gnocchi",
    ],
    "Épicerie": [
        "pates", "pâtes", "riz", "semoule", "lentille", "pois chiche", "haricot rouge",
        "farine", "sucre", "huile", "vinaigre", "sauce", "conserve", "tomate concassee",
        "coulis", "moutarde", "mayonnaise", "ketchup", "epice", "épice", "cafe", "café",
        "the", "thé", "cereale", "céréale", "biscuit", "chocolat", "confiture", "miel",
        "boite de conserve", "soupe", "bouillon", "lait de coco", "curry", "couscous",
        "quinoa", "boulgour", "olive", "cornichon", "maïs", "mais", "petits pois",
        "sel", "poivre", "levure", "compote", "puree", "purée", "epicerie", "taboule",
        "taboulé", "nouille", "pizza", "sodas", "boisson", "jus", "eau",
    ],
    "Surgelés": [
        "surgele", "surgelé", "glace", "poele", "poêlée", "frites", "nugget",
        "epinards surgeles", "legumes surgeles",
    ],
    "Boulangerie": [
        "pain", "baguette", "brioche", "viennoiserie", "biscotte", "pain de mie",
        "boulangerie", "patisserie", "pâtisserie", "tarte", "croissant",
    ],
}

# Signaux d'exclusion : rentrée scolaire, beauté, entretien, animaux…
HORS_SUJET = [
    "stylo", "cahier", "feutre", "surligneur", "crayon", "agenda", "colle", "ciseaux",
    "ardoise", "classeur", "trousse", "papier dessin", "feuilles", "ruban", "correcteur",
    "scotch", "trieur", "chemise", "porte vues", "bloc-notes", "cartable", "calculatrice",
    "shampoing", "gel douche", "dentifrice", "deodorant", "déodorant", "rasoir", "maquillage",
    "creme solaire", "couche", "lingette", "serviette", "tampon", "lessive", "adoucissant",
    "liquide vaisselle", "nettoyant", "javel", "desodorisant", "wc", "croquette",
    "litiere", "litière", "chien", "chat", "jouet", "vetement", "vêtement", "pile",
    "ampoule", "bricolage", "jardinage", "bière", "biere", "vin ", "whisky", "rhum",
    "vodka", "champagne", "apéritif", "aperitif", "cigarette", "magazine", "abonnement",
    "jeux-concours", "echantillon", "échantillon",
]

RE_REMISE = re.compile(r"(\d{1,3})\s?%")
RE_PRIX = re.compile(r"(\d{1,3}[.,]\d{1,2})\s?€")
RE_FIN = re.compile(r"Fin le\s+(\d{2}/\d{2}/\d{4})")


def sa(txt: str) -> str:
    """Minuscules sans accents."""
    return "".join(
        c for c in unicodedata.normalize("NFD", txt or "") if unicodedata.category(c) != "Mn"
    ).lower()


def trouver_enseigne(texte: str) -> str:
    t = sa(texte)
    for e in ENSEIGNES:  # ordre : les noms longs d'abord
        if sa(e) in t:
            return e
    if "partout" in t or "valable partout" in t:
        return "Toutes enseignes"
    return "Toutes enseignes"


def contient(mot: str, texte: str) -> bool:
    """Recherche sur frontières de mots : sans ça, « ail » matche « volaille »."""
    return re.search(
        rf"(?<![a-z0-9]){re.escape(sa(mot))}(?:s|es|x)?(?![a-z0-9])", texte
    ) is not None


def classer_rayon(texte: str):
    """Renvoie le rayon alimentaire, ou None si l'offre n'est pas alimentaire."""
    t = sa(texte)
    if any(contient(x, t) for x in HORS_SUJET):
        return None
    # Boucherie et Poissonnerie d'abord : « produits frais » est ambigu
    ordre = ["Boucherie", "Poissonnerie", "Crèmerie", "Fruits & légumes",
             "Boulangerie", "Surgelés", "Épicerie"]
    for rayon in ordre:
        if any(contient(m, t) for m in LEXIQUE[rayon]):
            return rayon
    return None


def nettoyer_produit(titre: str, marque: str) -> str:
    """Isole le produit : retire l'enseigne, les dates, les mentions de canal."""
    p = titre
    p = re.sub(r"\(\s*\d{2}/\d{2}.*?\)", "", p)          # (28/07 – 09/08)
    p = re.sub(r"\(Le\s+\d{2}/\d{2}\)", "", p, flags=re.I)
    p = re.sub(r"[–-]\s*(Drive|En Magasin)\s*$", "", p, flags=re.I)
    for e in ENSEIGNES:
        p = re.sub(rf"\b{re.escape(e)}\b\s*:?", "", p, flags=re.I)
    p = re.sub(r"\b(chez|partout|valable)\b", "", p, flags=re.I)
    p = re.sub(r"\s*&\s*$", "", p)
    p = re.sub(r"\s{2,}", " ", p).strip(" -–:&,")
    if marque and sa(marque) not in {"multi-marques", "produits du catalogue"} \
            and sa(marque) not in sa(p):
        p = f"{p} {marque}".strip()
    return p[:100] or titre[:100]


def extraire(html: str, type_defaut: str):
    soup = BeautifulSoup(html, "html.parser")
    resultats, vus = [], set()

    for a in soup.find_all("a", href=True):
        href = a["href"]
        if "/les-bons-plans-courses/" not in href and "/les-bons-de-reduction/" not in href:
            continue
        titre = a.get_text(" ", strip=True)
        if not titre or len(titre) < 10 or href in vus:
            continue

        # le bloc de l'offre contient un h6 : marque + date de fin
        bloc = a.find_parent(["article", "div", "li"]) or a.parent
        contexte = bloc.get_text(" ", strip=True)[:400] if bloc else titre

        marque = ""
        h6 = bloc.find("h6") if bloc else None
        if h6 and h6.find("strong"):
            marque = h6.find("strong").get_text(strip=True)

        rayon = classer_rayon(titre + " " + marque)
        if not rayon:
            continue
        vus.add(href)

        # remise en pourcentage
        remise = 0.0
        m = RE_REMISE.search(titre)
        if m:
            v = int(m.group(1))
            if 1 <= v <= 95:
                remise = v / 100
        if re.search(r"\bgratuit\b|100\s?%\s?rembours", titre, re.I):
            remise = 1.0

        # prix affiché
        prix = None
        prix_trouves = [float(x.replace(",", ".")) for x in RE_PRIX.findall(titre)]
        if prix_trouves:
            prix = min(prix_trouves)

        est_coupon = bool(re.search(r"coupon|bon de r[ée]duction|cagnott|remise fid", contexte, re.I))

        fin = None
        mf = RE_FIN.search(contexte)
        if mf:
            fin = mf.group(1)
            try:  # on jette les offres déjà expirées
                if datetime.strptime(fin, "%d/%m/%Y").date() < datetime.now().date():
                    continue
            except ValueError:
                pass

        resultats.append(
            {
                "enseigne": trouver_enseigne(titre),
                "produit": nettoyer_produit(titre, marque),
                "marque": marque,
                "rayon": rayon,
                "detail": titre[:150],
                "type": "coupon" if est_coupon else type_defaut,
                "remise": round(remise, 2),
                "prix": prix,
                "prixAvant": None,
                "lien": href if href.startswith("http") else BASE + href,
                "fin": fin,
            }
        )
    return resultats


def main() -> int:
    items, erreurs = [], []
    for url, type_defaut in SOURCES:
        try:
            r = requests.get(url, headers=ENTETES, timeout=30)
            r.raise_for_status()
            trouves = extraire(r.text, type_defaut)
            items += trouves
            print(f"{url} : {len(trouves)} offres alimentaires")
        except Exception as exc:  # noqa: BLE001
            erreurs.append(f"{url} : {exc}")

    uniques, vus = [], set()
    for it in items:
        cle = (sa(it["enseigne"]), sa(it["produit"]))
        if cle in vus:
            continue
        vus.add(cle)
        uniques.append(it)

    # les offres chiffrées d'abord, elles pèsent sur le budget
    uniques.sort(key=lambda x: (x["remise"] > 0, x["remise"]), reverse=True)
    uniques = uniques[:400]

    if not uniques:
        print("Aucune offre alimentaire extraite. Fichier existant conservé.", file=sys.stderr)
        for e in erreurs:
            print("  ", e, file=sys.stderr)
        return 0

    SORTIE.parent.mkdir(parents=True, exist_ok=True)
    SORTIE.write_text(
        json.dumps(
            {
                "maj": datetime.now(timezone.utc).isoformat(timespec="seconds"),
                "source": BASE,
                "items": uniques,
            },
            ensure_ascii=False,
            indent=1,
        ),
        encoding="utf-8",
    )
    chiffrees = sum(1 for x in uniques if x["remise"] > 0)
    print(f"{len(uniques)} offres écrites ({chiffrees} avec une remise chiffrée)")
    if erreurs:
        print("Sources en échec :", *erreurs, sep="\n  ")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
