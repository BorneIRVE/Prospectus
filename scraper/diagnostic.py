#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
diagnostic.py — inspecte UNE page catalogue et dit où sont les images.

But : localiser le feuilletoir (images de pages, iframe tierce, PDF…) quand
l'extraction automatique échoue. À lancer une fois, puis coller la sortie.

    python scraper/diagnostic.py
    python scraper/diagnostic.py "https://anti-crise.fr/catalogue/xxx/"
"""

from __future__ import annotations

import re
import sys
from collections import Counter
from urllib.parse import urlparse

import requests
from bs4 import BeautifulSoup

UA = "AerohmMenusBot/1.0 (diagnostic)"
DEFAUT = "https://anti-crise.fr/les-catalogues-avec-optimisations/"

IMG_EXT = re.compile(r'https?://[^\s"\'<>\\)]+?\.(?:jpe?g|png|webp|avif)', re.I)
PDF_ANY = re.compile(r'https?://[^\s"\'<>]+?\.pdf(?:\?[^\s"\'<>]*)?', re.I)
MOTS = ["flipbook", "calameo", "issuu", "publitas", "paperturn", "yumpu", "pdf",
        "viewer", "pageflip", "turn.js", "swiper", "slider", "page-", "prospectus"]


def titre(t):
    print("\n" + "=" * 68)
    print(t)
    print("=" * 68)


def premier_catalogue():
    r = requests.get(DEFAUT, headers={"User-Agent": UA}, timeout=30)
    r.raise_for_status()
    soup = BeautifulSoup(r.text, "html.parser")
    for a in soup.find_all("a", href=True):
        if "/catalogue/catalogue-" in a["href"]:
            return a["href"].split("#")[0]
    return None


def main():
    # le workflow passe une chaîne vide quand le champ est laissé libre :
    # on la traite comme une absence d'argument.
    arg = sys.argv[1].strip() if len(sys.argv) > 1 else ""
    url = arg or premier_catalogue()
    if not url:
        print("Aucun catalogue trouvé sur le listing.")
        return 1
    print(f"Analyse de : {url}")
    r = requests.get(url, headers={"User-Agent": UA}, timeout=30)
    r.raise_for_status()
    html = r.text
    soup = BeautifulSoup(html, "html.parser")
    print(f"Taille du HTML : {len(html)} caractères")

    # ---- 1. balises img et leurs attributs porteurs d'URL ----
    titre("1. BALISES <img> (30 premières, attributs contenant une URL)")
    imgs = soup.find_all("img")
    print(f"{len(imgs)} balises <img> au total\n")
    for i, im in enumerate(imgs[:30]):
        infos = []
        for k, v in im.attrs.items():
            if isinstance(v, list):
                v = " ".join(v)
            v = str(v)
            if "/" in v and len(v) > 8:
                infos.append(f"{k}={v[:110]}")
        cls = " ".join(im.get("class") or [])[:40]
        if infos:
            print(f"[{i}] class={cls}")
            for x in infos:
                print(f"     {x}")

    # ---- 2. iframes (feuilletoir tiers ?) ----
    titre("2. IFRAMES")
    frames = soup.find_all("iframe")
    if not frames:
        print("aucune iframe dans le HTML initial")
    for f in frames:
        print(f"src={f.get('src')}  data-src={f.get('data-src')}")

    # ---- 3. URLs d'images, par domaine ----
    titre("3. URLs D'IMAGES TROUVÉES DANS TOUT LE HTML (par domaine)")
    urls = list(dict.fromkeys(IMG_EXT.findall(html)))
    doms = Counter(urlparse(u).netloc for u in urls)
    for d, n in doms.most_common():
        print(f"  {n:>4}  {d}")
    print("\nExemples (25 max) :")
    for u in urls[:25]:
        print("  " + u[:150])

    # ---- 4. PDF ----
    titre("4. LIENS PDF")
    pdfs = list(dict.fromkeys(PDF_ANY.findall(html)))
    print("\n".join("  " + p[:150] for p in pdfs) if pdfs else "  aucun .pdf dans le HTML")
    for a in soup.find_all("a"):
        t = (a.get_text() or "").strip()
        if "pdf" in t.lower():
            print(f"  lien texte='{t[:40]}' href={a.get('href')}")

    # ---- 5. scripts et mots-clés ----
    titre("5. SCRIPTS EXTERNES")
    for s in soup.find_all("script", src=True):
        print("  " + s["src"][:140])

    titre("6. MOTS-CLÉS PRÉSENTS DANS LE HTML")
    bas = html.lower()
    for m in MOTS:
        n = bas.count(m)
        if n:
            print(f"  {m:<14} {n} occurrence(s)")
            i = bas.find(m)
            print(f"     …{html[max(0, i-90):i+130]}…".replace("\n", " "))

    print("\nFIN — copiez cette sortie pour analyse.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
