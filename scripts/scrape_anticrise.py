#!/usr/bin/env python3
"""
Récupère les promotions et bons de réduction publiés sur anti-crise.fr
et écrit data/promos.json, consommé par le site.

Lancé automatiquement chaque mardi matin par GitHub Actions.
En cas d'échec (site indisponible, structure modifiée), l'ancien
fichier est conservé : le site continue de fonctionner.
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

# Pages listées : catalogues promos + bons de réduction
SOURCES = [
    (f"{BASE}/", "promo"),
    (f"{BASE}/category/catalogues/", "promo"),
    (f"{BASE}/category/bons-de-reduction/", "coupon"),
    (f"{BASE}/category/promotions/", "promo"),
]

ENSEIGNES = [
    "Auchan", "Carrefour", "Leclerc", "E.Leclerc", "Intermarché", "Lidl", "Aldi",
    "Casino", "Cora", "Match", "Netto", "Super U", "Hyper U", "U Express",
    "Monoprix", "Franprix", "Grand Frais", "Picard", "Action", "Colruyt",
    "Leader Price", "Bi1", "Coccinelle",
]

ENTETES = {
    "User-Agent": "Mozilla/5.0 (compatible; ProspectusBot/1.0; +https://github.com)",
    "Accept-Language": "fr-FR,fr;q=0.9",
}

RE_REMISE = re.compile(r"-?\s?(\d{1,2})\s?%")
RE_PRIX = re.compile(r"(\d+[.,]\d{2})\s?€")
RE_EURO_REMISE = re.compile(r"(\d+[.,]\d{1,2})\s?€\s?(?:de\s+)?(?:remise|réduction|offerts?)", re.I)


def sans_accents(txt: str) -> str:
    return "".join(
        c for c in unicodedata.normalize("NFD", txt or "") if unicodedata.category(c) != "Mn"
    ).lower()


def trouver_enseigne(texte: str) -> str:
    t = sans_accents(texte)
    for e in ENSEIGNES:
        if sans_accents(e) in t:
            return e
    return "Toutes enseignes"


def nettoyer_produit(titre: str) -> str:
    """Retire l'enseigne et le bruit éditorial du titre pour garder le produit."""
    p = re.sub(r"\b(chez|à|au|en)\s+", " ", titre, flags=re.I)
    for e in ENSEIGNES:
        p = re.sub(re.escape(e), "", p, flags=re.I)
    p = re.sub(r"(bon de r[ée]duction|promo(tion)?s?|catalogue|offre|anti[- ]crise)", "", p, flags=re.I)
    p = re.sub(r"[-–|:]{1,2}", " ", p)
    p = re.sub(r"\s{2,}", " ", p).strip(" -–|:·")
    return p[:90] or titre[:90]


def extraire_cartes(html: str, type_defaut: str):
    """Parcourt les titres d'articles de la page de listing."""
    soup = BeautifulSoup(html, "html.parser")
    vus = set()
    resultats = []

    for titre_el in soup.select("h1 a, h2 a, h3 a, .entry-title a, article a[title]"):
        titre = titre_el.get_text(" ", strip=True) or titre_el.get("title", "")
        lien = titre_el.get("href", "")
        if not titre or len(titre) < 8 or lien in vus:
            continue
        vus.add(lien)

        contexte = titre
        parent = titre_el.find_parent(["article", "div", "li"])
        if parent:
            contexte = parent.get_text(" ", strip=True)[:400]

        est_coupon = bool(re.search(r"bon de r[ée]duction|coupon|cashback", contexte, re.I))
        type_promo = "coupon" if est_coupon else type_defaut

        remise = 0.0
        m = RE_REMISE.search(contexte)
        if m:
            remise = min(int(m.group(1)) / 100, 0.9)

        prix = prix_avant = None
        prix_trouves = [float(x.replace(",", ".")) for x in RE_PRIX.findall(contexte)]
        if prix_trouves:
            prix = min(prix_trouves)
            if len(prix_trouves) > 1:
                prix_avant = max(prix_trouves)
                if prix_avant > prix and not remise:
                    remise = round(1 - prix / prix_avant, 2)

        if not remise:
            me = RE_EURO_REMISE.search(contexte)
            if me and prix:
                valeur = float(me.group(1).replace(",", "."))
                remise = round(min(valeur / prix, 0.9), 2)
            elif est_coupon:
                remise = 0.15  # estimation prudente pour un bon sans montant lisible

        if remise <= 0:
            continue

        resultats.append(
            {
                "enseigne": trouver_enseigne(contexte),
                "produit": nettoyer_produit(titre),
                "detail": titre[:140],
                "type": type_promo,
                "remise": round(remise, 2),
                "prix": prix,
                "prixAvant": prix_avant,
                "lien": lien if lien.startswith("http") else BASE + lien,
                "fin": None,
            }
        )
    return resultats


def main() -> int:
    items, erreurs = [], []

    for url, type_defaut in SOURCES:
        try:
            r = requests.get(url, headers=ENTETES, timeout=30)
            r.raise_for_status()
            items += extraire_cartes(r.text, type_defaut)
        except Exception as exc:  # noqa: BLE001
            erreurs.append(f"{url} : {exc}")

    # dédoublonnage sur (enseigne, produit)
    uniques, vus = [], set()
    for it in items:
        cle = (sans_accents(it["enseigne"]), sans_accents(it["produit"]))
        if cle in vus:
            continue
        vus.add(cle)
        uniques.append(it)

    uniques.sort(key=lambda x: x["remise"], reverse=True)
    uniques = uniques[:300]

    if not uniques:
        print("Aucune promo extraite. Fichier existant conservé.", file=sys.stderr)
        for e in erreurs:
            print("  ", e, file=sys.stderr)
        return 0  # on ne casse pas le workflow

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
    print(f"{len(uniques)} promos écrites dans {SORTIE}")
    if erreurs:
        print("Sources en échec :", *erreurs, sep="\n  ")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
