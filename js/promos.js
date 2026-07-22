/* ============================================================
   promos.js — remplit l'onglet Promo depuis data/promos.json.
   Dépend de rayons.js (window.Rayons).
   API : Promos.init({ menuIds, onAjout })
     - menuIds : Set d'ids déjà au menu -> bouton verrouillé
     - onAjout : callback(offre) appelé quand on ajoute à la liste
                 (c'est là que la Liste range l'offre dans offre.rayon)
   ============================================================ */
(function (global) {
  "use strict";
  var R = global.Rayons;

  function eur(v) { return v == null ? "—" : v.toFixed(2).replace(".", ",") + " €"; }
  function frdate(iso) { if (!iso) return ""; var p = iso.split("-"); return p[2] + "/" + p[1]; }
  function esc(s) { return (s || "").replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  async function charger() {
    try {
      var r = await fetch("data/promos.json", { cache: "no-store" });
      if (!r.ok) throw new Error(r.status);
      return await r.json();
    } catch (e) {
      console.warn("[promos] promos.json indisponible, données de démo.", e);
      return global.__PROMOS_DEMO__ || { offres: [], catalogues: [] };
    }
  }

  function enrichir(data, menuIds) {
    return (data.offres || []).map(function (o) {
      var c = R.classer(o.produit, o.marque);
      return Object.assign({}, o, {
        rayon: c.rayon,
        comestible: c.comestible,
        coupon: !!(o.sources && o.sources.length),
        dansMenu: menuIds.has(o.id),
      });
    });
  }

  function carte(o) {
    var avant = eur(o.prix), final = eur(o.prix_final);
    var remise = o.remise_pct != null ? '<span class="badge-remise">−' + o.remise_pct + " %</span>" : "";
    var liens = (o.sources || []).map(function (s) {
      return '<a class="lien coupon" href="' + esc(s.url) + '" target="_blank" rel="noopener">' +
        '<span class="pt"></span>' + esc(s.label) + ' <span class="fleche">↗</span></a>';
    }).join("");
    var reel = (o.prix_final != null && o.opti && o.opti < 0)
      ? '<span class="reel-pill">réel ' + final + "</span>" : "";
    var tags = '<div class="promo-tags"><span class="promo-tag rayon">' + esc(o.rayon) + "</span>" +
      (o.dansMenu ? '<span class="promo-tag menu">Dans mon menu</span>' : "") + "</div>";
    return '<div class="promo" data-ens="' + esc(o.enseigne) + '" data-coupon="' + (o.coupon ? 1 : 0) +
      '" data-alim="' + (o.comestible ? 1 : 0) + '" data-menu="' + (o.dansMenu ? 1 : 0) +
      '" data-id="' + esc(o.id) + '">' +
      '<div class="promo-txt">' +
      '<div class="promo-ens">' + esc(o.enseigne) + (o.vu_le ? " · vu " + frdate(o.vu_le) : "") + "</div>" +
      '<div class="promo-nom">' + (o.marque ? esc(o.marque) + " — " : "") + esc(o.produit) + "</div>" +
      '<div class="promo-meta">' + (o.quantite ? "x" + esc(o.quantite) + " · " : "") + avant + "</div>" +
      tags +
      '<div class="art-liens">' + liens + reel + "</div>" +
      "</div>" +
      '<div class="prix"><span class="prix-avant">' + avant + '</span><span class="prix-apres">' + final + "</span>" + remise + "</div>" +
      "</div>";
  }

  function init(opts) {
    opts = opts || {};
    var menuIds = opts.menuIds || new Set();
    var onAjout = opts.onAjout || function () {};

    var liste = document.getElementById("promoListe");
    var filtres = document.getElementById("promoFiltres");
    var maj = document.getElementById("promoMaj");
    if (!liste) return;

    // offres préchargées (par app.js) ou fetch autonome
    var source = opts.offres
      ? Promise.resolve({ offres: opts.offres })
      : charger();

    source.then(function (data) {
      var offres = enrichir(data, menuIds);
      var parId = {};
      offres.forEach(function (o) { parId[o.id] = o; });

      if (maj) {
        var ens = Array.from(new Set(offres.map(function (o) { return o.enseigne; })));
        maj.textContent = "Catalogues · " + ens.length + " enseignes · " + offres.length + " offres";
      }

      // filtres dynamiques
      var ensList = Array.from(new Set(offres.map(function (o) { return o.enseigne; }))).sort();
      var defs = [
        ["tout", "Toutes", offres.length],
        ["coupon", "Avec coupon", offres.filter(function (o) { return o.coupon; }).length],
        ["alim", "Alimentaire", offres.filter(function (o) { return o.comestible; }).length],
      ];
      ensList.forEach(function (e) {
        defs.push(["ens:" + e, e, offres.filter(function (o) { return o.enseigne === e; }).length]);
      });
      if (filtres) {
        filtres.innerHTML = defs.map(function (d, i) {
          return '<button class="filtre' + (i === 0 ? " is-on" : "") + '" data-f="' + esc(d[0]) + '">' +
            esc(d[1]) + (d[2] != null ? " · " + d[2] : "") + "</button>";
        }).join("");
      }

      liste.innerHTML = offres.map(carte).join("") +
        '<p class="promo-vide hidden" id="promoVide">Aucune promo dans ce filtre cette semaine.</p>';

      brancher(offres, parId, filtres, liste, onAjout);
    });
  }

  function brancher(offres, parId, filtres, liste, onAjout) {
    var vide = document.getElementById("promoVide");

    // filtres
    if (filtres) {
      var boutons = filtres.querySelectorAll(".filtre");
      boutons.forEach(function (f) {
        f.addEventListener("click", function () {
          boutons.forEach(function (x) { x.classList.remove("is-on"); });
          f.classList.add("is-on");
          var key = f.dataset.f, n = 0;
          liste.querySelectorAll(".promo").forEach(function (p) {
            var show = key === "tout" ||
              (key === "coupon" && p.dataset.coupon === "1") ||
              (key === "alim" && p.dataset.alim === "1") ||
              (key.indexOf("ens:") === 0 && p.dataset.ens === key.slice(4));
            p.classList.toggle("hidden", !show);
            if (show) n++;
          });
          if (vide) vide.classList.toggle("hidden", n > 0);
        });
      });
    }

    // toast
    var toast = document.getElementById("toast"), tt;
    function flash(m) {
      if (!toast) return;
      toast.textContent = m; toast.classList.add("on");
      clearTimeout(tt); tt = setTimeout(function () { toast.classList.remove("on"); }, 1800);
    }

    // bouton ajouter / verrou
    liste.querySelectorAll(".promo").forEach(function (p) {
      var o = parId[p.dataset.id];
      var btn = document.createElement("button");
      btn.className = "promo-add";
      if (o.dansMenu) {
        btn.classList.add("on", "lock");
        btn.disabled = true;
        btn.innerHTML = '<span class="ic">✓</span> Déjà dans la liste';
      } else {
        btn.innerHTML = '<span class="ic">+</span> Ajouter à ma liste';
        btn.addEventListener("click", function () {
          var on = btn.classList.toggle("on");
          btn.innerHTML = on
            ? '<span class="ic">✓</span> Ajouté'
            : '<span class="ic">+</span> Ajouter à ma liste';
          flash(on ? "« " + o.produit + " » → rayon " + o.rayon : "« " + o.produit + " » retiré");
          onAjout(o, on);      // la Liste range o dans o.rayon
        });
      }
      p.querySelector(".promo-txt").appendChild(btn);
    });
  }

  global.Promos = { init: init };
  // NB : pas d'auto-init — app.js appelle Promos.init() quand l'onglet s'ouvre.
})(typeof window !== "undefined" ? window : globalThis);
