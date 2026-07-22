/* ============================================================
   app.js — orchestrateur de l'application.
   Dépend de : rayons.js, promos.js, menu.js, recettes.js
   Persistance : localStorage (fonctionne sur GitHub Pages).
   ============================================================ */
(function () {
  "use strict";

  var R = window.Rayons, EST = 1.30;
  var JOURS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
  var COUL_RAYON = {
    "Boucherie · Poissonnerie": "#D6202A", "Crèmerie": "#1B2A4A", "Fruits & légumes": "#0F7B4F",
    "Épicerie": "#C98A1B", "Surgelés": "#3B7CA6", "Boissons": "#9C3B2E",
    "Bébé": "#B0873A", "Hygiène & beauté": "#7A5C8E", "Maison & entretien": "#6B6357",
    "Animaux": "#8A6D3B", "Divers": "#8A8078"
  };

  // ---- utils ----
  function $(id) { return document.getElementById(id); }
  function eur(v) { return (v == null ? 0 : v).toFixed(2).replace(".", ",") + " €"; }
  function norm(s) { return (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim(); }
  function esc(s) { return (s || "").replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function frdate(iso) { if (!iso) return ""; var p = iso.split("-"); return p[2] + "/" + p[1]; }
  function moisCourant() { var d = new Date(); return d.toLocaleDateString("fr-FR", { month: "long", year: "numeric" }); }
  function toast(m) { var t = $("toast"); if (!t) return; t.textContent = m; t.classList.add("on"); clearTimeout(toast._t); toast._t = setTimeout(function () { t.classList.remove("on"); }, 1800); }

  // ---- state ----
  var LS = {
    get: function (k, d) { try { return JSON.parse(localStorage.getItem("aerohm." + k)) ?? d; } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem("aerohm." + k, JSON.stringify(v)); } catch (e) {} },
    del: function (k) { try { localStorage.removeItem("aerohm." + k); } catch (e) {} },
  };
  var APP = {
    foyer: LS.get("foyer", null),
    offres: [],
    menu: LS.get("menu", null),         // {jours, promoIds:[], ...} promoIds sérialisé en tableau
    promoAdds: LS.get("promoAdds", {}), // id -> offre ajoutée manuellement
    manuel: LS.get("manuel", []),       // {nom, qte, rayon}
    coches: LS.get("coches", {}),       // clé -> true
    mois: LS.get("mois", { label: moisCourant(), depense: 0, economie: 0, rayons: {}, semaines: [] }),
  };
  function save() {
    LS.set("foyer", APP.foyer); LS.set("menu", APP.menu); LS.set("promoAdds", APP.promoAdds);
    LS.set("manuel", APP.manuel); LS.set("coches", APP.coches); LS.set("mois", APP.mois);
  }

  // reset du mois si on a changé de mois
  if (APP.mois.label !== moisCourant()) {
    APP.mois = { label: moisCourant(), depense: 0, economie: 0, rayons: {}, semaines: [] };
  }

  // ---- offres actives (selon magasins du foyer) ----
  function offresActives() {
    var mags = (APP.foyer && APP.foyer.magasins) || [];
    if (!mags.length) return APP.offres;
    return APP.offres.filter(function (o) {
      return mags.some(function (m) { return norm(m) === norm(o.enseigne); });
    });
  }

  // ============================================================ NAVIGATION
  function montrer(vue) {
    document.querySelectorAll(".view").forEach(function (v) { v.classList.add("hidden"); });
    var el = $("view-" + vue); if (el) el.classList.remove("hidden");
    document.querySelectorAll(".tab").forEach(function (t) { t.classList.toggle("is-active", t.dataset.view === vue); });
    if (vue === "accueil") rendreAccueil();
    if (vue === "promo") rendrePromo();
    if (vue === "menu") rendreMenu();
    if (vue === "liste") rendreListe();
    if (vue === "recette") rendreRecettes();
    if (vue === "reglages") rendreReglages();
    window.scrollTo(0, 0);
  }
  document.querySelectorAll(".tab").forEach(function (t) {
    t.addEventListener("click", function () { montrer(t.dataset.view); });
  });

  // ============================================================ ONBOARDING
  function stepper(id, min, max) {
    var out = $(id); var v = parseInt(out.textContent, 10) || min;
    document.querySelector('[data-dec="' + id + '"]').addEventListener("click", function () { v = Math.max(min, v - 1); out.textContent = v; });
    document.querySelector('[data-inc="' + id + '"]').addEventListener("click", function () { v = Math.min(max, v + 1); out.textContent = v; });
  }
  var ENSEIGNES_CONNUES = ["E.Leclerc", "Carrefour", "Intermarché", "Auchan", "Lidl", "Aldi", "Super U"];
  function rendreCasesMagasins(conteneur, selection) {
    conteneur.innerHTML = ENSEIGNES_CONNUES.map(function (e) {
      var on = selection.some(function (m) { return norm(m) === norm(e); });
      return '<label class="store"><input type="checkbox" value="' + esc(e) + '"' + (on ? " checked" : "") + '><span class="store-nom">' + esc(e) + "</span></label>";
    }).join("");
  }
  function initOnboarding() {
    var step = 1;
    function aff() { document.querySelectorAll(".ob-page").forEach(function (p) { p.classList.toggle("hidden", +p.dataset.step !== step); }); $("obStep").textContent = step; }
    stepper("obPersonnes", 1, 12); stepper("obRepas", 1, 21);
    document.querySelectorAll("[data-next]").forEach(function (b) { b.addEventListener("click", function () { step = Math.min(5, step + 1); if (step === 5) rendreCasesMagasins($("obMagasins"), []); aff(); }); });
    document.querySelectorAll("[data-prev]").forEach(function (b) { b.addEventListener("click", function () { step = Math.max(1, step - 1); aff(); }); });
    $("obGeo") && $("obGeo").addEventListener("click", function () {
      $("obGeoHint").textContent = "Cochez vos enseignes ci-dessous.";
      if (navigator.geolocation) navigator.geolocation.getCurrentPosition(function () {}, function () {});
      rendreCasesMagasins($("obMagasins"), []);
    });
    $("obFinish").addEventListener("click", function () {
      var mags = Array.prototype.map.call($("obMagasins").querySelectorAll("input:checked"), function (i) { return i.value; });
      APP.foyer = {
        personnes: parseInt($("obPersonnes").textContent, 10),
        repas: parseInt($("obRepas").textContent, 10),
        budget: parseFloat($("obBudget").value) || 70,
        exclus: ($("obExclus").value || "").split(/[\n,]+/).map(function (s) { return s.trim(); }).filter(Boolean),
        magasins: mags,
      };
      save();
      $("onboarding").classList.add("hidden"); $("app").classList.remove("hidden");
      montrer("accueil");
    });
    aff();
  }

  // ============================================================ ACCUEIL
  function rendreAccueil() {
    $("moisLabel").textContent = APP.mois.label;
    $("totalDepense").textContent = eur(APP.mois.depense);
    $("totalEco").textContent = eur(APP.mois.economie);

    var rayons = APP.mois.rayons || {};
    var data = Object.keys(rayons).map(function (r) { return { nom: r, val: rayons[r], col: COUL_RAYON[r] || "#8A8078" }; })
      .filter(function (d) { return d.val > 0; }).sort(function (a, b) { return b.val - a.val; });
    var total = data.reduce(function (s, d) { return s + d.val; }, 0);

    var vide = $("accueilEmpty");
    var svg = $("donut"); var leg = $("legende");
    svg.innerHTML = ""; leg.innerHTML = "";
    if (!data.length) {
      if (vide) vide.classList.remove("hidden");
      $("donutCenterVal").textContent = "0 €";
    } else {
      if (vide) vide.classList.add("hidden");
      $("donutCenterVal").textContent = Math.round(total) + " €";
      var NS = "http://www.w3.org/2000/svg", cx = 100, cy = 100, r = 68, sw = 30, C = 2 * Math.PI * r, off = 0, gap = 2;
      var bg = document.createElementNS(NS, "circle");
      bg.setAttribute("cx", cx); bg.setAttribute("cy", cy); bg.setAttribute("r", r);
      bg.setAttribute("fill", "none"); bg.setAttribute("stroke", "#E7E0D3"); bg.setAttribute("stroke-width", sw); svg.appendChild(bg);
      data.forEach(function (d) {
        var len = d.val / total * C;
        var c = document.createElementNS(NS, "circle");
        c.setAttribute("cx", cx); c.setAttribute("cy", cy); c.setAttribute("r", r); c.setAttribute("fill", "none");
        c.setAttribute("stroke", d.col); c.setAttribute("stroke-width", sw);
        c.setAttribute("stroke-dasharray", Math.max(len - gap, 0) + " " + (C - Math.max(len - gap, 0)));
        c.setAttribute("stroke-dashoffset", -off);
        c.setAttribute("transform", "rotate(-90 " + cx + " " + cy + ")");
        svg.appendChild(c); off += len;
      });
      leg.innerHTML = data.map(function (d) {
        return '<li><span class="pastille" style="background:' + d.col + '"></span><span class="lg-nom">' + esc(d.nom) + '</span><span class="lg-val">' + eur(d.val) + "</span></li>";
      }).join("");
    }

    var histo = $("histo");
    histo.innerHTML = (APP.mois.semaines || []).slice().reverse().map(function (s) {
      return '<li><span class="h-left">' + esc(s.label) + '<span class="h-sem">' + eur(s.depense) + '</span></span><span class="h-eco">éco ' + eur(s.economie) + "</span></li>";
    }).join("") || '<li class="empty" style="border:0">Aucune semaine validée pour le moment.</li>';
  }

  // ============================================================ PROMO
  function rendrePromo() {
    var menuIds = new Set((APP.menu && APP.menu.promoIds) || []);
    window.Promos.init({
      offres: offresActives(),
      menuIds: menuIds,
      onAjout: function (offre, ajoute) {
        if (ajoute) APP.promoAdds[offre.id] = offre;
        else delete APP.promoAdds[offre.id];
        save();
      },
    });
  }

  // ============================================================ MENU
  function platCarte(j, i) {
    var total = j.coutPromo + j.coutEstime, par = total / j.portions;
    var cnt = j.promos.length > 0
      ? '<span class="cnt promo">' + j.promos.length + " promo" + (j.promos.length > 1 ? "s" : "") + "</span>"
      : '<span class="cnt est">estimé</span>';
    var meta = (j.recette.ingredients || []).map(function (ing) {
      var promo = j.matchs.some(function (m) { return m.ing === ing; });
      return promo ? '<span class="ing-promo">' + esc(ing) + "</span>" : esc(ing);
    }).join(" · ") + " · " + j.recette.temps + " min";
    var flag = j.antigaspi ? '<span class="plat-flag">↺ Réutilise le ' + esc(j.reutilise.join(", ")) + "</span>" : "";
    return '<article class="plat" data-i="' + i + '"><div class="plat-head"><span class="plat-jour">' + JOURS[i] + "</span>" +
      '<span class="plat-prix"><span class="val"><span class="t">~</span>' + eur(total) + '</span><span class="par">≈ ' + eur(par) + "/pers</span>" + cnt + "</span></div>" +
      flag + '<h3 class="plat-nom">' + esc(j.recette.nom) + '</h3><p class="plat-meta">' + meta + "</p>" +
      '<div class="plat-actions"><button class="mini" data-voir="' + esc(j.recette.id) + '">Voir la recette</button><button class="mini mini-swap">Régénérer</button></div></article>';
  }
  function genererMenu() {
    var m = window.Menu.generer({ recettes: window.RECETTES, offres: offresActives(), foyer: APP.foyer });
    m.promoIds = Array.from(m.promoIds);   // sérialisable
    APP.menu = m; save();
  }
  function rendreMenu() {
    if (!APP.menu) { $("menuListe").innerHTML = '<p class="empty">Touchez « Générer le menu » pour composer votre semaine autour des promos.</p>'; }
    var m = APP.menu;
    if (m) {
      $("jaugeCout").innerHTML = '<span style="color:var(--encre-douce)">~</span>' + Math.round(m.total) + " €";
      $("jaugeBudget").textContent = (APP.foyer.budget || 0) + " €";
      var pct = Math.min(100, Math.round(m.total / (APP.foyer.budget || 1) * 100));
      var fill = $("jaugeFill"); fill.style.width = pct + "%"; fill.classList.toggle("over", m.total > APP.foyer.budget);
      $("jaugeEco").textContent = "≈ " + eur(m.economie) + " économisés grâce à " + (m.promoIds.length) + " promos";
      $("menuListe").innerHTML = m.jours.map(platCarte).join("");
      document.querySelectorAll("#menuListe .mini-swap").forEach(function (b) {
        b.addEventListener("click", function () { genererMenu(); rendreMenu(); });
      });
      document.querySelectorAll("#menuListe [data-voir]").forEach(function (b) {
        b.addEventListener("click", function () { montrer("recette"); setTimeout(function () { ouvrirRecette(b.dataset.voir); }, 50); });
      });
    }
    var btn = $("btnGenerer");
    btn.textContent = APP.menu ? "Régénérer le menu" : "Générer le menu";
    btn.onclick = function () { genererMenu(); rendreMenu(); toast("Menu généré"); };
  }

  // ============================================================ LISTE
  function construireListe() {
    var m = APP.menu;
    var promoItems = {};   // id -> offre
    var ingPromo = new Set();

    if (m) {
      m.jours.forEach(function (j) {
        j.promos.forEach(function (o) { promoItems[o.id] = o; });
        j.matchs.forEach(function (mm) { ingPromo.add(norm(mm.ing)); promoItems[mm.offre.id] = mm.offre; });
      });
    }
    Object.keys(APP.promoAdds).forEach(function (id) { promoItems[id] = APP.promoAdds[id]; });

    // ingrédients estimés (du menu, hors promo, hors placards)
    var stock = ((APP.foyer && APP.foyer.stock) || []).map(norm);
    var estimes = {};
    if (m) {
      m.jours.forEach(function (j) {
        (j.recette.ingredients || []).forEach(function (ing) {
          var k = norm(ing);
          if (ingPromo.has(k)) return;
          if (stock.some(function (s) { return s && k.indexOf(s) !== -1; })) return;  // déjà en placard
          if (!estimes[k]) { var c = R.classer(ing); estimes[k] = { nom: ing, rayon: c.rayon, comestible: c.comestible }; }
        });
      });
    }

    // regroupement par rayon
    var rayons = {};
    function add(rayon, item) { (rayons[rayon] = rayons[rayon] || []).push(item); }

    Object.keys(promoItems).forEach(function (id) {
      var o = promoItems[id]; var c = R.classer(o.produit, o.marque);
      add(c.rayon, { type: "promo", nom: (o.marque ? o.marque + " — " : "") + o.produit, enseigne: o.enseigne, prix: o.prix, prix_final: o.prix_final, sources: o.sources || [], vu_le: o.vu_le, key: "p:" + id });
    });
    Object.keys(estimes).forEach(function (k) {
      var e = estimes[k]; add(e.rayon, { type: "est", nom: e.nom, comestible: e.comestible, key: "e:" + k });
    });
    APP.manuel.forEach(function (it, i) {
      add(it.rayon || "Divers", { type: "manuel", nom: it.nom, qte: it.qte, key: "m:" + i, idx: i });
    });

    return rayons;
  }

  function bilanListe(rayons) {
    var promos = 0, eco = 0, nbPromo = 0, reste = 0, sansEst = 0, nbEst = 0;
    Object.keys(rayons).forEach(function (ray) {
      rayons[ray].forEach(function (it) {
        if (it.type === "promo") { promos += it.prix_final || 0; if (it.prix != null && it.prix_final != null) eco += it.prix - it.prix_final; nbPromo++; }
        else if (it.type === "est") { if (it.comestible) { reste += EST; nbEst++; } else sansEst++; }
        else sansEst++;
      });
    });
    return { promos: promos, eco: eco, nbPromo: nbPromo, reste: reste, total: promos + reste, sansEst: sansEst, nbEst: nbEst };
  }

  function rendreListe() {
    var cont = $("listeCourses");
    var rayons = construireListe();
    var ordre = R.ORDRE.filter(function (r) { return rayons[r]; });
    if (!ordre.length && !APP.manuel.length) {
      cont.innerHTML = '<p class="empty">Générez un menu (onglet Menu) ou ajoutez des promos pour construire votre liste.</p>';
      $("btnValider").classList.add("hidden");
      return;
    }

    var html = ordre.map(function (ray) {
      var items = rayons[ray];
      var sousTotal = items.reduce(function (s, it) { return s + (it.type === "promo" ? (it.prix_final || 0) : (it.type === "est" && it.comestible ? EST : 0)); }, 0);
      var mixte = items.some(function (it) { return it.type !== "promo"; });
      var lis = items.map(function (it) {
        var coche = APP.coches[it.key] ? " coche" : "";
        var check = '<input type="checkbox" data-k="' + esc(it.key) + '"' + (APP.coches[it.key] ? " checked" : "") + ">";
        if (it.type === "promo") {
          var liens = (it.sources || []).map(function (s) { return '<a class="lien coupon" href="' + esc(s.url) + '" target="_blank" rel="noopener"><span class="pt"></span>' + esc(s.label) + " ↗</a>"; }).join("");
          return '<li class="' + (liens ? "riche" : "") + coche + '">' + check +
            '<span class="art-nom">' + esc(it.nom) + '<span class="art-qte">' + esc(it.enseigne || "") + (it.vu_le ? " · vu " + frdate(it.vu_le) : "") + "</span>" + (liens ? '<span class="art-liens">' + liens + "</span>" : "") + "</span>" +
            '<span class="art-prix"><span class="avant">' + eur(it.prix) + '</span><span class="apres">' + eur(it.prix_final) + "</span></span></li>";
        }
        if (it.type === "est") {
          return '<li class="' + coche + '">' + check + '<span class="art-nom">' + esc(it.nom) + '<span class="art-qte">estimation</span></span>' +
            (it.comestible ? '<span class="art-prix est"><span class="val">~' + eur(EST) + "</span></span>" : '<span class="art-prix absent">—</span>') + "</li>";
        }
        return '<li class="' + coche + '">' + check + '<span class="art-nom">' + esc(it.nom) + '<span class="tag-ajoute">ajouté</span>' + (it.qte ? '<span class="art-qte">' + esc(it.qte) + "</span>" : "") + "</span>" +
          '<span class="art-prix absent">—</span><button class="art-suppr" data-suppr="' + it.idx + '">×</button></li>';
      }).join("");
      return '<div class="rayon"><div class="rayon-head"><span class="rayon-nom">' + esc(ray) + '</span><span class="rayon-total">' + (mixte ? "~" : "") + eur(sousTotal) + "</span></div><ul>" + lis + "</ul></div>";
    }).join("");

    // bouton + formulaire d'ajout
    html += '<button class="ajout-btn" id="ajoutOuvrir"><span class="plus">+</span> Ajouter un produit</button>' +
      '<div class="ajout-form" id="ajoutForm"><h4>Nouveau produit</h4>' +
      '<label class="ajout-champ"><span>Produit</span><input type="text" id="ajNom" placeholder="Lessive, sacs poubelle…" autocomplete="off"></label>' +
      '<div class="row2"><label class="ajout-champ"><span>Quantité</span><input type="text" id="ajQte" placeholder="1 · 40 doses" autocomplete="off"></label>' +
      '<label class="ajout-champ"><span>Rayon</span><select id="ajRayon">' + R.ORDRE.map(function (r) { return '<option>' + r + "</option>"; }).join("") + "</select></label></div>" +
      '<div class="ajout-actions"><button class="btn btn-ghost" id="ajAnnuler">Annuler</button><button class="btn btn-primary" id="ajValider">Ajouter</button></div></div>';

    // bilan
    var b = bilanListe(rayons);
    html += '<div class="bilan"><p class="bilan-titre">Coût de la semaine</p>' +
      '<div class="bilan-ligne"><span class="bl-lab promo">Promos<span class="bl-sub">' + b.nbPromo + ' produits · prix fermes</span></span><span class="bl-val promo">' + eur(b.promos) + "</span></div>" +
      '<div class="bilan-ligne"><span class="bl-lab">Reste estimé <span class="info-i" id="infoBtn">i</span><span class="bl-sub">Open Prices · ' + b.sansEst + ' sans estimation</span></span><span class="bl-val est"><span class="t">~</span>' + eur(b.reste) + "</span></div>" +
      '<div class="bilan-total"><span class="bl-lab">Total estimé</span><span class="bl-val"><span class="t" style="color:var(--encre-douce)">~</span>' + Math.round(b.total) + " €</span></div>" +
      (APP.foyer.budget ? '<p class="bilan-budget" style="color:' + (b.total <= APP.foyer.budget ? "var(--vert)" : "var(--rouge)") + '">' + (b.total <= APP.foyer.budget ? "✓ sous" : "⚠ au-dessus de") + " votre budget de " + APP.foyer.budget + " €</p>" : "") +
      '<div class="bilan-note" id="dispNote">Les prix hors promo proviennent d\'<b>Open Prices</b>, base communautaire. Ordre de grandeur seulement, variable selon le magasin et la date.</div></div>';

    cont.innerHTML = html;
    $("btnValider").classList.remove("hidden");

    // interactions
    cont.querySelectorAll('input[type=checkbox]').forEach(function (c) {
      c.addEventListener("change", function () { var k = c.dataset.k; if (c.checked) APP.coches[k] = 1; else delete APP.coches[k]; c.closest("li").classList.toggle("coche", c.checked); save(); });
    });
    var info = $("infoBtn"); if (info) info.addEventListener("click", function () { $("dispNote").classList.toggle("on"); });
    cont.querySelectorAll("[data-suppr]").forEach(function (b) { b.addEventListener("click", function () { APP.manuel.splice(+b.dataset.suppr, 1); save(); rendreListe(); }); });
    brancherAjout();
  }

  function brancherAjout() {
    var btn = $("ajoutOuvrir"), form = $("ajoutForm");
    if (!btn) return;
    btn.addEventListener("click", function () { form.classList.add("on"); btn.style.display = "none"; $("ajNom").focus(); });
    $("ajAnnuler").addEventListener("click", function () { form.classList.remove("on"); btn.style.display = "flex"; });
    function ajouter() {
      var nom = $("ajNom").value.trim(); if (!nom) return;
      APP.manuel.push({ nom: nom, qte: $("ajQte").value.trim(), rayon: $("ajRayon").value });
      save(); rendreListe();
    }
    $("ajValider").addEventListener("click", ajouter);
    $("ajNom").addEventListener("keydown", function (e) { if (e.key === "Enter") ajouter(); });
  }

  // valider les courses -> alimente l'accueil
  function validerCourses() {
    var rayons = construireListe(); var b = bilanListe(rayons);
    if (b.nbPromo === 0) { toast("Rien à valider"); return; }
    APP.mois.depense += b.promos;
    APP.mois.economie += b.eco;
    Object.keys(rayons).forEach(function (ray) {
      rayons[ray].forEach(function (it) { if (it.type === "promo") APP.mois.rayons[ray] = (APP.mois.rayons[ray] || 0) + (it.prix_final || 0); });
    });
    APP.mois.semaines.push({ label: "Semaine du " + new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" }), depense: b.promos, economie: b.eco });
    // on repart pour une nouvelle semaine
    APP.menu = null; APP.promoAdds = {}; APP.manuel = []; APP.coches = {};
    save();
    toast("Courses validées — suivi mis à jour");
    montrer("accueil");
  }

  // ============================================================ RECETTES
  function rendreRecettes() {
    $("recettesListe").innerHTML = window.RECETTES.map(function (r) {
      return '<div class="recette" data-r="' + esc(r.id) + '"><button class="recette-head"><span class="recette-nom">' + esc(r.nom) + '</span><span class="recette-temps">' + r.temps + ' min</span></button>' +
        '<div class="recette-corps hidden"><h4>Ingrédients</h4><ul>' + r.ingredients.map(function (i) { return "<li>" + esc(i) + "</li>"; }).join("") + "</ul>" +
        "<h4>Préparation</h4><ol>" + r.etapes.map(function (e) { return "<li>" + esc(e) + "</li>"; }).join("") + "</ol></div></div>";
    }).join("");
    document.querySelectorAll("#recettesListe .recette-head").forEach(function (h) {
      h.addEventListener("click", function () { h.nextElementSibling.classList.toggle("hidden"); });
    });
  }
  function ouvrirRecette(id) {
    var el = document.querySelector('#recettesListe .recette[data-r="' + id + '"]');
    if (el) { el.querySelector(".recette-corps").classList.remove("hidden"); el.scrollIntoView({ behavior: "smooth", block: "center" }); }
  }

  // ============================================================ REGLAGES
  function rendreReglages() {
    var f = APP.foyer;
    $("setPersonnes").value = f.personnes; $("setRepas").value = f.repas; $("setBudget").value = f.budget;
    $("setExclus").value = (f.exclus || []).join(", ");
    $("setStock").value = (f.stock || []).join(", ");
    rendreCasesMagasins($("setMagasins"), f.magasins || []);
    $("setGeo").onclick = function () { rendreCasesMagasins($("setMagasins"), f.magasins || []); toast("Cochez vos enseignes"); };
    $("btnSauver").onclick = function () {
      f.personnes = parseInt($("setPersonnes").value, 10) || f.personnes;
      f.repas = parseInt($("setRepas").value, 10) || f.repas;
      f.budget = parseFloat($("setBudget").value) || f.budget;
      f.exclus = ($("setExclus").value || "").split(/[\n,]+/).map(function (s) { return s.trim(); }).filter(Boolean);
      f.stock = ($("setStock").value || "").split(/[\n,]+/).map(function (s) { return s.trim(); }).filter(Boolean);
      f.magasins = Array.prototype.map.call($("setMagasins").querySelectorAll("input:checked"), function (i) { return i.value; });
      save(); toast("Réglages enregistrés");
    };
    $("btnReset").onclick = function () {
      if (!confirm("Tout effacer et recommencer ?")) return;
      ["foyer", "menu", "promoAdds", "manuel", "coches", "mois"].forEach(LS.del);
      location.reload();
    };
  }

  // ============================================================ DÉMARRAGE
  function chargerPromos() {
    return fetch("data/promos.json", { cache: "no-store" }).then(function (r) { if (!r.ok) throw 0; return r.json(); })
      .then(function (d) {
        APP.offres = (d.offres || []).map(function (o) { var c = R.classer(o.produit, o.marque); return Object.assign({}, o, { comestible: c.comestible }); });
      }).catch(function () { APP.offres = []; });
  }

  $("btnValider") && $("btnValider").addEventListener("click", validerCourses);

  chargerPromos().then(function () {
    if (!APP.foyer) { $("onboarding").classList.remove("hidden"); initOnboarding(); }
    else { $("app").classList.remove("hidden"); montrer("accueil"); }
  });
})();
