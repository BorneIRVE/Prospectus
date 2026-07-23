#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Scraper anti-crise.fr — catalogues optimisés -> promos.json
===========================================================

Chaîne :
  1. Lit la page listing "Les catalogues avec optimisations".
  2. En extrait, par enseigne, l'URL de chaque catalogue + ses dates.
  3. Ouvre chaque catalogue retenu et parse le tableau "Les optimisations"
     (marque, produit, quantité, prix, promo, coupon, source, prix final, remise).
  4. Écrit data/promos.json (+ une copie datée) et archive le HTML brut.

Conçu pour tourner chaque mardi via GitHub Actions, puis commité dans le dépôt ;
le site statique lit ensuite data/promos.json. Aucun serveur requis.

Principes (cf. document d'architecture) :
  - anti-crise.fr est une source SECONDAIRE et REMPLAÇABLE : tout passe par la
    classe Source, isolée, pour pouvoir la remplacer sans toucher au reste.
  - On archive le HTML brut AVANT de parser : un parseur cassé se rejoue sur
    l'archive, la donnée n'est jamais perdue.
  - robots.txt respecté, User-Agent identifiable, débit poli, cache du jour.
  - Contrôle de santé : 0 offre => sortie en erreur (l'Action passe au rouge).

Dépendances : requests, beautifulsoup4  (voir requirements.txt)
"""

from __future__ import annotations

import dataclasses
import datetime as dt
import hashlib
import json
import os
import re
import sys
import time
import urllib.robotparser as robotparser
from pathlib import Path
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup

# ------------------------------------------------------------------ config ---

BASE = "https://anti-crise.fr"
LISTING = f"{BASE}/les-catalogues-avec-optimisations/"

# Enseignes voulues, en minuscules, telles qu'écrites dans les titres de section
# de la page listing. Adaptez à vos magasins (un format = une entrée).
ENSEIGNES = {
    "aldi", "auchan", "auchan supermarché", "carrefour", "carrefour market",
    "hyper u", "super u", "intermarché", "leclerc", "lidl",
}

# Ne garder que les catalogues encore valides (fin >= aujourd'hui).
GARDER_EXPIRES = False
# Débit : secondes d'attente entre deux requêtes.
DELAI = 2.5
# Contact inclus dans le User-Agent (courtoisie / joignabilité).
CONTACT = "contact@exemple.fr"
UA = f"AerohmMenusBot/1.0 (+{CONTACT})"

RACINE = Path(__file__).resolve().parent.parent
DATA = RACINE / "data"
RAW = DATA / "raw"
AUJ = dt.date.today()

# ------------------------------------------------------------------- utils ---

_money_re = re.compile(r"-?\d[\d\s]*,\d{2}")
_date_range_re = re.compile(r"(\d{2}/\d{2}/\d{4})\s*[-–]\s*(\d{2}/\d{2}/\d{4})")
_pct_re = re.compile(r"(\d{1,3})\s*%")
# lien « Version PDF » éventuel sur la page catalogue
_pdf_re = re.compile(r'href=["\']([^"\']+\.pdf(?:\?[^"\']*)?)["\']', re.I)
# mécaniques magasin écrites en clair : « 2+1 », « 1+1 gratuit », « lot de 3 »…
_meca_re = re.compile(
    r"\d\s*\+\s*\d(?:\s*(?:gratuit|offert)s?)?|lot\s+de\s+\d+|par\s+\d+\s+achet[ée]s?",
    re.I,
)


def money(txt: str):
    """'11,50€' -> 11.5 ; '-2,88€' -> -2.88 ; '' -> None."""
    if not txt:
        return None
    m = _money_re.search(txt.replace("\u202f", " ").replace("\xa0", " "))
    if not m:
        return None
    return float(m.group(0).replace(" ", "").replace(",", "."))


def iso(fr: str):
    """'14/07/2026' -> '2026-07-14'."""
    d, m, y = fr.split("/")
    return f"{y}-{m}-{d}"


def clean(txt: str) -> str:
    return re.sub(r"\s+", " ", (txt or "")).replace("HAUTDEPAGE", "").strip()


def slug_enseigne(url: str) -> str:
    """Repli : enseigne depuis le slug (…/catalogue-<enseigne>-du-<date>…)."""
    slug = urlparse(url).path.rstrip("/").split("/")[-1]
    slug = slug[len("catalogue-"):] if slug.startswith("catalogue-") else slug
    return slug.split("-du-")[0].replace("-", " ").strip()


# ------------------------------------------------------------------ source ---

class Source:
    """Accès réseau isolé : robots.txt, cache, archive, débit. Remplaçable."""

    def __init__(self):
        self.sess = requests.Session()
        self.sess.headers["User-Agent"] = UA
        self.robots = robotparser.RobotFileParser()
        self._last = 0.0
        try:
            self.robots.set_url(f"{BASE}/robots.txt")
            self.robots.read()
        except Exception as e:                       # robots injoignable
            print(f"[!] robots.txt illisible ({e}) — on reste prudent.")
            self.robots = None

    def autorise(self, url: str) -> bool:
        if self.robots is None:
            return True
        try:
            return self.robots.can_fetch(UA, url)
        except Exception:
            return True

    def get(self, url: str, slug: str) -> str | None:
        """Retourne le HTML : cache du jour -> réseau. Archive le brut."""
        arch = RAW / AUJ.isoformat() / f"{slug}.html"
        if arch.exists():                            # déjà récupéré aujourd'hui
            return arch.read_text(encoding="utf-8", errors="replace")
        if not self.autorise(url):
            print(f"[robots] interdit : {url}")
            return None
        wait = DELAI - (time.time() - self._last)
        if wait > 0:
            time.sleep(wait)
        try:
            r = self.sess.get(url, timeout=30)
            self._last = time.time()
            r.raise_for_status()
        except Exception as e:
            print(f"[http] échec {url} : {e}")
            return None
        html = r.text
        arch.parent.mkdir(parents=True, exist_ok=True)
        arch.write_text(html, encoding="utf-8")      # archive avant parsing
        return html


# ------------------------------------------------------------------ parsing --

@dataclasses.dataclass
class Catalogue:
    enseigne: str
    titre: str | None
    debut: str | None
    fin: str | None
    url: str


def parse_listing(html: str) -> list[Catalogue]:
    """Parcourt la page en gardant l'enseigne (h2) et les dates (h6) en cours."""
    soup = BeautifulSoup(html, "html.parser")
    enseigne = None
    dates = None
    attente = None
    vus = set()
    out: list[Catalogue] = []
    for el in soup.find_all(["h2", "h6", "a"]):
        if el.name == "h2":
            enseigne, dates, attente = clean(el.get_text()), None, None
        elif el.name == "h6":
            t = clean(el.get_text())
            m = _date_range_re.search(t)
            if m:
                dates = (iso(m.group(1)), iso(m.group(2)))
            elif attente is not None and t:
                attente.titre = t
                attente = None
        elif el.name == "a":
            href = el.get("href", "")
            if "/catalogue/catalogue-" not in href:
                continue
            url = urljoin(BASE, href.split("#")[0])
            if url in vus:
                continue
            vus.add(url)
            cat = Catalogue(
                enseigne=(enseigne or slug_enseigne(url)),
                titre=None,
                debut=dates[0] if dates else None,
                fin=dates[1] if dates else None,
                url=url,
            )
            out.append(cat)
            attente = cat
    return out


def _colmap(header_cells) -> dict:
    idx = {}
    for i, c in enumerate(header_cells):
        idx[clean(c.get_text()).upper()] = i
    return idx


def parse_catalogue(html: str, cat: Catalogue) -> list[dict]:
    """Extrait les lignes du tableau 'Les optimisations'."""
    soup = BeautifulSoup(html, "html.parser")

    # « Version PDF » si le lien est présent dans le HTML brut (opportuniste :
    # le bouton est parfois généré en JS, auquel cas on n'aura rien).
    m_pdf = _pdf_re.search(html)
    cat_pdf = urljoin(BASE, m_pdf.group(1)) if m_pdf else None

    table = None
    for t in soup.find_all("table"):
        head = t.get_text(" ").upper()
        if "PRODUIT" in head and "PRIX FINAL" in head:
            table = t
            break
    if table is None:
        return []

    rows = table.find_all("tr")
    if len(rows) < 2:
        return []
    cols = _colmap(rows[0].find_all(["td", "th"]))

    def cell(cells, name):
        i = cols.get(name)
        return cells[i] if (i is not None and i < len(cells)) else None

    def txt(cells, name):
        c = cell(cells, name)
        return clean(c.get_text()) if c else ""

    offres = []
    for tr in rows[1:]:
        cells = tr.find_all(["td", "th"])
        if len(cells) < 6:
            continue
        produit = txt(cells, "PRODUIT")
        prix = money(txt(cells, "PRIX"))
        if not produit or prix is None:
            continue

        sources = []
        src_cell = cell(cells, "SOURCE")
        if src_cell:
            for a in src_cell.find_all("a"):
                label = clean(a.get_text())
                href = a.get("href", "")
                if label and href:
                    sources.append({"label": label, "url": urljoin(BASE, href)})

        page_txt = txt(cells, "N°")
        page = int(re.search(r"\d+", page_txt).group()) if re.search(r"\d+", page_txt) else None
        pct_txt = txt(cells, "R%")
        remise = int(_pct_re.search(pct_txt).group(1)) if _pct_re.search(pct_txt) else None

        # mécanique magasin si elle est écrite en toutes lettres (2+1, lot de 3, x2…)
        mecanique = None
        libelle = f"{txt(cells, 'MARQUE')} {produit}"
        m_meca = _meca_re.search(libelle)
        if m_meca:
            mecanique = clean(m_meca.group(0))

        oid = hashlib.sha1(
            f"{cat.enseigne}|{produit}|{cat.debut}|{prix}".encode("utf-8")
        ).hexdigest()[:12]

        offres.append({
            "id": oid,
            "enseigne": cat.enseigne,
            "catalogue_url": cat.url,
            # lien profond vers la page du prospectus où figure l'offre :
            # c'est LA source qui montre la mécanique en toutes lettres.
            "page_url": (cat.url + "#page" + str(page)) if page else cat.url,
            "pdf_url": cat_pdf,
            "debut": cat.debut,
            "fin": cat.fin,
            "page": page,
            "marque": txt(cells, "MARQUE"),
            "produit": produit,
            "quantite": txt(cells, "Q") or None,
            "prix": prix,                                   # prix rayon (pour Q)
            "promo": money(txt(cells, "PROMO")),            # remise immédiate magasin
            "mecanique": mecanique,                         # « 2+1 », « lot de 3 »… si écrit
            "opti": money(txt(cells, "OPTI")),              # bon / coupon
            "prix_final": money(txt(cells, "PRIX FINAL")),  # coût réel
            "remise_pct": remise,
            "sources": sources,
            "vu_le": AUJ.isoformat(),
        })
    return offres


# -------------------------------------------------------------------- main ---

def enseigne_voulue(nom: str) -> bool:
    return clean(nom).lower() in ENSEIGNES


def catalogue_actif(cat: Catalogue) -> bool:
    if GARDER_EXPIRES or not cat.fin:
        return True
    return cat.fin >= AUJ.isoformat()


def main() -> int:
    DATA.mkdir(parents=True, exist_ok=True)
    src = Source()

    html = src.get(LISTING, "_listing")
    if not html:
        print("[x] Listing inaccessible — arrêt.")
        return 1

    catalogues = parse_listing(html)
    print(f"[i] {len(catalogues)} catalogues trouvés sur le listing.")

    retenus = [c for c in catalogues if enseigne_voulue(c.enseigne) and catalogue_actif(c)]
    # une seule version par enseigne : la plus récente (debut max)
    par_enseigne: dict[str, Catalogue] = {}
    for c in sorted(retenus, key=lambda c: (c.debut or ""), reverse=True):
        par_enseigne.setdefault(c.enseigne.lower(), c)
    retenus = list(par_enseigne.values())
    print(f"[i] {len(retenus)} catalogues retenus : "
          + ", ".join(sorted(c.enseigne for c in retenus)))

    offres, resume, vides = [], [], []
    for c in retenus:
        slug = urlparse(c.url).path.rstrip("/").split("/")[-1]
        page = src.get(c.url, slug)
        if not page:
            continue
        lignes = parse_catalogue(page, c)
        if not lignes:
            vides.append(c.enseigne)
        offres.extend(lignes)
        resume.append({
            "enseigne": c.enseigne, "titre": c.titre,
            "debut": c.debut, "fin": c.fin, "url": c.url,
            "nb_offres": len(lignes),
        })
        print(f"    - {c.enseigne:<22} {len(lignes):>3} offres  ({c.debut}→{c.fin})")

    # dédoublonnage global par id
    uniques = {o["id"]: o for o in offres}
    offres = list(uniques.values())

    sortie = {
        "genere_le": dt.datetime.now().isoformat(timespec="seconds"),
        "source": "anti-crise.fr/les-catalogues-avec-optimisations",
        "avertissement": ("Données agrégées depuis anti-crise.fr — source secondaire "
                          "et remplaçable. Vérifiez la disponibilité en magasin."),
        "nb_offres": len(offres),
        "catalogues": resume,
        "offres": offres,
    }

    (DATA / "promos.json").write_text(
        json.dumps(sortie, ensure_ascii=False, indent=2), encoding="utf-8")
    (DATA / f"promos-{AUJ.isoformat()}.json").write_text(
        json.dumps(sortie, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"[✓] {len(offres)} offres écrites dans data/promos.json")
    if vides:
        print(f"[!] Aucun tableau lu pour : {', '.join(vides)} "
              "(structure changée ? à vérifier)")

    # contrôle de santé : rien => échec visible
    if len(offres) == 0:
        print("[x] 0 offre — le parseur ou la source a probablement changé.")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
