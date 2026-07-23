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

  // Afficher les mécaniques DÉDUITES du calcul (« −60 % sur le 2ᵉ »…) ?
  // false par défaut : elles ne sont pas certaines (« −60 % sur le 2ᵉ » et
  // « −30 % sur les 2 » donnent le même total). La page du catalogue, elle,
  // affiche la vraie mécanique — c'est le lien « Voir la page N ».
  var MECANIQUE_DEDUITE = false;

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

  // quantité à acheter (la colonne Q du catalogue) — 1 par défaut
  function qte(o) { var q = parseInt(o.quantite, 10); return (q && q > 0) ? q : 1; }

  // Mécanique magasin.
  // Renvoie { label, deduit } — deduit=true quand elle vient du calcul et non
  // du libellé. Base : Q (quantité à acheter) et la part que représente la
  // remise. Si la remise vaut t/Q du total, c'est un taux t sur le Qe article.
  function mecanique(o) {
    if (o.mecanique) return { label: o.mecanique, deduit: false };
    var q = qte(o);
    if (!o.prix || !o.promo) return null;
    var r = Math.abs(o.promo) / o.prix;          // part de remise sur le total
    var pct = Math.round(r * 100);
    if (q < 2) return { label: "−" + pct + " %", deduit: false };
    // au-delà de Q=1, la mécanique exacte n'est pas dans les données :
    // on n'affiche que le certain, sauf si la déduction est activée.
    if (!MECANIQUE_DEDUITE) return { label: "−" + pct + " % sur " + q, deduit: false };

    var t = r * q;                                // taux appliqué au Qe article
    if (Math.abs(t - 1) < 0.02) return { label: (q - 1) + "+1 offert", deduit: true };
    if (t < 1.01) {
      var t5 = Math.round(t * 20) / 20;           // arrondi au multiple de 5 %
      if (Math.abs(t - t5) < 0.02 && t5 >= 0.1) {
        return { label: "−" + Math.round(t5 * 100) + " % sur le " + q + "ᵉ", deduit: true,
                 equiv: "−" + pct + " % sur les " + q };
      }
    }
    return { label: "−" + pct + " % sur " + q + " achetés", deduit: true };
  }

  function carte(o) {
    var avant = eur(o.prix), final = eur(o.prix_final);
    var q = qte(o), meca = mecanique(o);
    var remisePct = (o.prix && o.promo) ? Math.round(Math.abs(o.promo) / o.prix * 100) : null;
    var clsD = (meca && meca.deduit) ? " deduit" : "";

    // badge principal : la mécanique
    var badge = meca ? '<span class="badge-remise' + (meca.deduit ? " badge-meca" : "") + '">' + esc(meca.label) + "</span>" : "";

    // ce qu'il faut acheter pour obtenir ce prix
    var achat = '<div class="promo-achat">' +
      '<span class="qte-pill">' + (q > 1 ? "Achetez " + q : "1 unité") + "</span>" +
      (q > 1 && o.prix_final != null ? '<span class="unitaire">soit ' + eur(o.prix_final / q) + "/u</span>" : "") +
      "</div>";

    // détail du prix : rayon → remise magasin → bon/ODR → coût réel
    var lignes = '<div class="detail-l"><span>Prix rayon' + (q > 1 ? " (x" + q + ")" : "") + "</span><span>" + avant + "</span></div>";
    if (o.promo && o.promo < 0) {
      var libMeca = meca ? '<span class="meca' + clsD + '">' + esc(meca.label) + "</span>" : "";
      lignes += '<div class="detail-l magasin"><span>Remise magasin' + (libMeca ? " · " + libMeca : "") +
        "</span><span>" + eur(o.promo) + "</span></div>";
      if (meca && meca.equiv) {
        lignes += '<div class="detail-l equiv"><span>équivaut à ' + esc(meca.equiv) + "</span><span></span></div>";
      }
    }
    if (o.opti && o.opti < 0) {
      var nomBon = (o.sources && o.sources[0] && o.sources[0].label) ? o.sources[0].label : "Bon / ODR";
      lignes += '<div class="detail-l bon"><span>' + esc(nomBon) + "</span><span>" + eur(o.opti) + "</span></div>";
    }
    lignes += '<div class="detail-l total"><span>Coût réel</span><span>' + final + "</span></div>";
    var detail = '<div class="promo-detail">' + lignes + "</div>";

    var liens = (o.sources || []).map(function (s) {
      return '<a class="lien coupon" href="' + esc(s.url) + '" target="_blank" rel="noopener">' +
        '<span class="pt"></span>' + esc(s.label) + ' <span class="fleche">↗</span></a>';
    }).join("");

    // la référence : la page du prospectus, où la mécanique est imprimée
    if (o.page_image || o.page_url) {
      liens = '<button class="lien page" data-page="' + esc(o.id) + '">' +
        '<span class="pt"></span>Voir la page' + (o.page ? " " + o.page : "") + ' du catalogue</button>' + liens;
    }
    if (o.pdf_url) {
      liens += '<a class="lien pdf" href="' + esc(o.pdf_url) + '" target="_blank" rel="noopener">' +
        '<span class="pt"></span>PDF <span class="fleche">↗</span></a>';
    }
    var tags = '<div class="promo-tags"><span class="promo-tag rayon">' + esc(o.rayon) + "</span>" +
      (o.dansMenu ? '<span class="promo-tag menu">Dans mon menu</span>' : "") + "</div>";
    return '<div class="promo" data-ens="' + esc(o.enseigne) + '" data-coupon="' + (o.coupon ? 1 : 0) +
      '" data-alim="' + (o.comestible ? 1 : 0) + '" data-menu="' + (o.dansMenu ? 1 : 0) +
      '" data-id="' + esc(o.id) + '">' +
      '<div class="promo-txt">' +
      '<div class="promo-ens">' + esc(o.enseigne) + (o.vu_le ? " · vu " + frdate(o.vu_le) : "") + "</div>" +
      '<div class="promo-nom">' + (o.marque ? esc(o.marque) + " — " : "") + esc(o.produit) + "</div>" +
      achat + tags + detail +
      (liens ? '<div class="art-liens">' + liens + "</div>" : "") +
      "</div>" +
      '<div class="prix"><span class="prix-avant">' + avant + '</span><span class="prix-apres">' + final + "</span>" + badge + "</div>" +
      "</div>";
  }

  // ---- visionneuse : affiche l'image de la page du prospectus ----
  function visionneuse(o) {
    var m = document.getElementById("pageViewer");
    if (!m) {
      m = document.createElement("div");
      m.id = "pageViewer";
      m.className = "viewer";
      document.body.appendChild(m);
    }
    var titre = (o.page ? "Page " + o.page + " · " : "") + o.enseigne;
    var corps = o.page_image
      ? '<img src="' + esc(o.page_image) + '" alt="' + esc(titre) + '" loading="lazy">'
      : '<p class="viewer-vide">L\'image de cette page n\'a pas pu être récupérée.<br>' +
        "Ouvrez le prospectus sur anti-crise pour la consulter.</p>";
    m.innerHTML =
      '<div class="viewer-bar"><span class="viewer-t">' + esc(titre) + "</span>" +
      '<button class="viewer-x" aria-label="Fermer">×</button></div>' +
      '<div class="viewer-body">' + corps + "</div>" +
      '<div class="viewer-foot"><span class="viewer-src">source : anti-crise.fr</span>' +
      '<a class="btn btn-primary" href="' + esc(o.page_url || o.catalogue_url || "#") +
      '" target="_blank" rel="noopener">Ouvrir le prospectus ↗</a></div>';
    m.classList.add("on");
    document.body.classList.add("no-scroll");
    function fermer() { m.classList.remove("on"); document.body.classList.remove("no-scroll"); }
    m.querySelector(".viewer-x").addEventListener("click", fermer);
    m.addEventListener("click", function (e) { if (e.target === m) fermer(); });
    document.addEventListener("keydown", function esc2(e) {
      if (e.key === "Escape") { fermer(); document.removeEventListener("keydown", esc2); }
    });
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

      liste.innerHTML = '<p class="promo-legende">Montants et quantités viennent du catalogue. Pour la mécanique exacte (2+1, −50 % sur le 2ᵉ…), ouvrez <b>la page du prospectus</b> indiquée sur chaque offre.</p>' +
        offres.map(carte).join("") +
        '<p class="promo-vide hidden" id="promoVide">Aucune promo dans ce filtre cette semaine.</p>';

      brancher(offres, parId, filtres, liste, onAjout);
    });
  }

  function brancher(offres, parId, filtres, liste, onAjout) {
    var vide = document.getElementById("promoVide");

    // ouverture de la page du prospectus
    liste.querySelectorAll("[data-page]").forEach(function (b) {
      b.addEventListener("click", function () { visionneuse(parId[b.dataset.page]); });
    });

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
