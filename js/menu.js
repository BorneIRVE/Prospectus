/* ============================================================
   menu.js — génère un menu de la semaine piloté par les promos.
   100% navigateur. Heuristique gloutonne "max-couverture" :
   on choisit d'abord les recettes qui exploitent le plus de promos
   NEUVES, en respectant exclusions / variété / anti-gaspi.

   API : Menu.generer({ recettes, offres, foyer })
     recettes : [{ id, nom, temps, portions, protein, ingredients:[str], saison? }]
     offres   : promos enrichies (doivent porter .comestible) — voir promos.js
     foyer    : { personnes, repas, budget, exclus:[str] }
   Retour :
     { jours:[{recette, portions, promos:[offre], reutilise:[str],
               antigaspi, coutPromo, coutEstime}],
       promoIds:Set, coutPromoTotal, coutEstimeTotal, economie, sousBudget }

   NB : sélection heuristique, non optimale au sens strict. Le passage à un
   vrai solveur sous contraintes (OR-Tools) est l'évolution serveur prévue.
   ============================================================ */
(function (global) {
  "use strict";

  // coût moyen supposé d'un ingrédient hors promo, faute de prix de référence
  // câblé (Open Prices viendra remplacer cette constante).
  var EST_INGREDIENT = 1.30;
  var PROTEINES_REPORT = ["poulet", "boeuf", "bœuf", "porc", "poisson", "saumon", "dinde"];

  function norm(s) {
    return (s || "").toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")   // enlève accents
      .replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
  }

  // un ingrédient correspond-il à une offre promo ?
  function offrePourIngredient(ing, offres) {
    var n = norm(ing);
    if (n.length < 3) return null;
    var best = null, bestEco = -1;
    for (var i = 0; i < offres.length; i++) {
      var o = offres[i];
      if (o.comestible === false) continue;
      var p = norm(o.produit + " " + (o.marque || ""));
      // correspondance souple : le nom d'ingrédient apparaît dans le produit
      // (ou l'inverse pour les libellés courts)
      var hit = p.indexOf(n) !== -1 || (n.length > 4 && n.indexOf(p) !== -1);
      if (!hit) {
        // tolère le pluriel simple (poireau/poireaux)
        hit = p.indexOf(n + "s") !== -1 || p.indexOf(n.replace(/s$/, "")) !== -1 && n.length > 4;
      }
      if (!hit) continue;
      var eco = Math.abs(o.promo || 0) + Math.abs(o.opti || 0);
      if (eco > bestEco) { bestEco = eco; best = o; }
    }
    return best;
  }

  function matchsRecette(r, offres) {
    var vus = {}, out = [];
    (r.ingredients || []).forEach(function (ing) {
      var o = offrePourIngredient(ing, offres);
      if (o && !vus[o.id]) { vus[o.id] = 1; out.push({ ing: ing, offre: o }); }
    });
    return out;
  }

  function contientExclu(r, exclus) {
    return (r.ingredients || []).some(function (ing) {
      var n = norm(ing);
      return exclus.some(function (x) { return x && n.indexOf(x) !== -1; });
    });
  }

  function generer(opts) {
    opts = opts || {};
    var recettes = opts.recettes || [];
    var offres = (opts.offres || []).filter(function (o) { return o.comestible !== false; });
    var foyer = opts.foyer || {};
    var N = Math.max(1, foyer.repas || 7);
    var pers = Math.max(1, foyer.personnes || 2);
    var exclus = (foyer.exclus || []).map(norm).filter(Boolean);

    // candidats : recettes sans ingrédient exclu
    var cands = recettes.filter(function (r) { return !contientExclu(r, exclus); });
    cands.forEach(function (r) { r._m = matchsRecette(r, offres); });

    var usedPromo = new Set();       // ids de promos déjà "achetées"
    var usedIngr = new Set();        // ingrédients déjà présents (anti-gaspi)
    var protCount = {};              // pour la variété
    var pool = cands.slice();
    var jours = [];

    for (var i = 0; i < N && pool.length; i++) {
      var best = null, bestScore = -Infinity;
      for (var k = 0; k < pool.length; k++) {
        var r = pool[k];
        var neufs = 0, ecoNeuve = 0, reutil = 0;
        r._m.forEach(function (m) {
          if (usedPromo.has(m.offre.id)) { reutil++; }
          else { neufs++; ecoNeuve += Math.abs(m.offre.promo || 0) + Math.abs(m.offre.opti || 0); }
        });
        // anti-gaspi : la protéine de la recette a déjà été achetée cette semaine
        var reemploi = PROTEINES_REPORT.indexOf(norm(r.protein)) !== -1 &&
                       usedIngr.has(norm(r.protein));
        var score = neufs * 100 + ecoNeuve + reutil * 12 + (reemploi ? 45 : 0);
        score -= (protCount[r.protein] || 0) * 40;            // variété
        score += Math.random() * 8;                            // jitter (régénérer)
        if (score > bestScore) { bestScore = score; best = r; }
      }
      pool = pool.filter(function (r) { return r !== best; });

      var neufsOffres = best._m.filter(function (m) { return !usedPromo.has(m.offre.id); }).map(function (m) { return m.offre; });
      var reemploiIng = [];
      (best.ingredients || []).forEach(function (ing) {
        if (usedIngr.has(norm(ing)) && PROTEINES_REPORT.indexOf(norm(ing)) !== -1) reemploiIng.push(ing);
      });

      neufsOffres.forEach(function (o) { usedPromo.add(o.id); });
      (best.ingredients || []).forEach(function (ing) { usedIngr.add(norm(ing)); });
      protCount[best.protein] = (protCount[best.protein] || 0) + 1;

      var facteur = pers / (best.portions || 4);
      var coutPromo = neufsOffres.reduce(function (s, o) { return s + (o.prix_final || 0); }, 0);
      var nbHorsPromo = (best.ingredients || []).length - best._m.length;
      var coutEstime = Math.max(0, nbHorsPromo) * EST_INGREDIENT * Math.max(1, facteur);

      jours.push({
        recette: best,
        portions: pers,
        promos: neufsOffres,
        matchs: best._m.slice(),        // [{ing, offre}] pour colorer les ingrédients
        reutilise: reemploiIng,
        antigaspi: reemploiIng.length > 0,
        coutPromo: coutPromo,
        coutEstime: coutEstime,
      });
    }

    var coutPromoTotal = jours.reduce(function (s, j) { return s + j.coutPromo; }, 0);
    var coutEstimeTotal = jours.reduce(function (s, j) { return s + j.coutEstime; }, 0);
    var economie = 0;
    usedPromo.forEach(function (id) {
      var o = offres.find(function (x) { return x.id === id; });
      if (o && o.prix != null && o.prix_final != null) economie += (o.prix - o.prix_final);
    });

    return {
      jours: jours,
      promoIds: usedPromo,
      coutPromoTotal: coutPromoTotal,
      coutEstimeTotal: coutEstimeTotal,
      total: coutPromoTotal + coutEstimeTotal,
      economie: economie,
      sousBudget: foyer.budget ? (coutPromoTotal + coutEstimeTotal) <= foyer.budget : null,
    };
  }

  var api = { generer: generer, _norm: norm };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  global.Menu = api;
})(typeof window !== "undefined" ? window : globalThis);
