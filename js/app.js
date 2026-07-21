/* ============================================================
   Prospectus — logique applicative
   Tout est stocké en local (localStorage). Aucune donnée ne part
   du téléphone, sauf la requête de recherche des magasins.
   ============================================================ */

const CLE = "prospectus.v1";
const JOURS = ["Lundi","Mardi","Mercredi","Jeudi","Vendredi","Samedi","Dimanche"];

let S = {
  config:{ personnes:2, repas:7, budget:70, exclus:[], magasins:[], stock:[] },
  menu:[],           // [{recetteId, jour, cout, eco}]
  coches:{},         // {cleArticle:true}
  historique:[],     // [{date, total, eco, parRayon:{}}]
  installe:false
};
let PROMOS = { maj:null, items:[] };
let filtreEnseigne = "Toutes";
let magasinsTrouves = [];

/* ---------- utilitaires ---------- */
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const eur = n => n.toLocaleString("fr-FR",{minimumFractionDigits:2,maximumFractionDigits:2}) + " €";
const norm = s => (s||"").toLowerCase()
  .normalize("NFD").replace(/[\u0300-\u036f]/g,"")
  .replace(/[^a-z0-9 ]/g," ").replace(/\s+/g," ").trim();

function toast(msg){
  const t = $("#toast");
  t.textContent = msg; t.classList.add("on");
  clearTimeout(t._t); t._t = setTimeout(()=>t.classList.remove("on"), 2600);
}
function sauver(){ localStorage.setItem(CLE, JSON.stringify(S)); }
function charger(){
  try{ const b = JSON.parse(localStorage.getItem(CLE)); if(b) S = Object.assign(S,b); }catch(e){}
}
function listeDepuisTexte(t){
  return (t||"").split(/[,\n;]/).map(x=>x.trim()).filter(Boolean);
}

/* ============================================================
   1. ONBOARDING
   ============================================================ */
function initOnboarding(){
  let etape = 1;
  const total = 5;
  const aff = () => {
    $$(".ob-page").forEach(p => p.classList.toggle("hidden", +p.dataset.step !== etape));
    $("#obStep").textContent = etape;
    $(".onboarding").scrollTop = 0;
  };
  $$("[data-next]").forEach(b => b.onclick = () => { if(etape < total){ etape++; aff(); } });
  $$("[data-prev]").forEach(b => b.onclick = () => { if(etape > 1){ etape--; aff(); } });

  $$("[data-inc]").forEach(b => b.onclick = () => {
    const o = $("#"+b.dataset.inc); o.textContent = Math.min(21, +o.textContent + 1);
  });
  $$("[data-dec]").forEach(b => b.onclick = () => {
    const o = $("#"+b.dataset.dec); o.textContent = Math.max(1, +o.textContent - 1);
  });

  $("#obGeo").onclick = () => chercherMagasins("#obMagasins", "#obGeoHint");

  $("#obFinish").onclick = () => {
    S.config.personnes = +$("#obPersonnes").textContent;
    S.config.repas     = +$("#obRepas").textContent;
    S.config.budget    = +$("#obBudget").value || 70;
    S.config.exclus    = listeDepuisTexte($("#obExclus").value);
    S.config.magasins  = magasinsCoches("#obMagasins");
    S.installe = true;
    sauver();
    $("#onboarding").classList.add("hidden");
    $("#app").classList.remove("hidden");
    demarrerApp();
  };
  aff();
}

/* ============================================================
   2. MAGASINS (OpenStreetMap / Overpass — pas de clé API)
   ============================================================ */
function chercherMagasins(cible, hintSel){
  const hint = hintSel ? $(hintSel) : null;
  if(!navigator.geolocation){
    if(hint) hint.textContent = "Ce navigateur ne donne pas la position. Saisissez vos magasins à la main dans Réglages.";
    return;
  }
  if(hint) hint.textContent = "Recherche en cours…";
  navigator.geolocation.getCurrentPosition(async pos => {
    const {latitude:lat, longitude:lon} = pos.coords;
    const q = `[out:json][timeout:25];(
      node["shop"~"supermarket|convenience|hypermarket|greengrocer|butcher|bakery"](around:6000,${lat},${lon});
      way["shop"~"supermarket|convenience|hypermarket"](around:6000,${lat},${lon});
    );out center 60;`;
    try{
      const r = await fetch("https://overpass-api.de/api/interpreter",
        {method:"POST", body:"data="+encodeURIComponent(q)});
      const d = await r.json();
      magasinsTrouves = d.elements
        .map(e => ({
          nom: (e.tags && (e.tags.brand || e.tags.name)) || null,
          type: e.tags && e.tags.shop,
          dist: distance(lat, lon, e.lat || (e.center&&e.center.lat), e.lon || (e.center&&e.center.lon))
        }))
        .filter(m => m.nom && isFinite(m.dist))
        .sort((a,b) => a.dist - b.dist);
      // dédoublonnage par enseigne
      const vus = new Set();
      magasinsTrouves = magasinsTrouves.filter(m => {
        const k = norm(m.nom); if(vus.has(k)) return false; vus.add(k); return true;
      }).slice(0, 14);

      if(!magasinsTrouves.length){
        if(hint) hint.textContent = "Aucune enseigne trouvée dans un rayon de 6 km.";
        return;
      }
      if(hint) hint.textContent = magasinsTrouves.length + " enseignes trouvées. Cochez celles où vous allez.";
      rendreMagasins(cible);
    }catch(e){
      if(hint) hint.textContent = "La recherche a échoué. Réessayez, ou ajoutez vos magasins à la main.";
    }
  }, () => {
    if(hint) hint.textContent = "Position refusée. Vous pourrez cocher vos magasins plus tard dans Réglages.";
  }, {enableHighAccuracy:false, timeout:12000});
}

function distance(la1, lo1, la2, lo2){
  if(la2 == null || lo2 == null) return NaN;
  const R = 6371, t = x => x*Math.PI/180;
  const dLa = t(la2-la1), dLo = t(lo2-lo1);
  const a = Math.sin(dLa/2)**2 + Math.cos(t(la1))*Math.cos(t(la2))*Math.sin(dLo/2)**2;
  return 2*R*Math.asin(Math.sqrt(a));
}

function rendreMagasins(cible){
  const dejaCoches = S.config.magasins.map(norm);
  $(cible).innerHTML = magasinsTrouves.map((m,i) => `
    <label class="store">
      <input type="checkbox" value="${m.nom}" ${dejaCoches.includes(norm(m.nom))?"checked":""}>
      <span class="store-nom">${m.nom}</span>
      <span class="store-dist">${m.dist.toFixed(1)} km</span>
    </label>`).join("");
}
function magasinsCoches(cible){
  const c = $$(cible + " input:checked").map(i => i.value);
  return c.length ? c : S.config.magasins;
}

/* ============================================================
   3. PROMOS
   ============================================================ */
async function chargerPromos(){
  try{
    const r = await fetch("data/promos.json?v=" + Date.now());
    PROMOS = await r.json();
  }catch(e){
    PROMOS = {maj:null, items:[]};
  }
  rendrePromos();
}

function promosActives(){
  const mes = S.config.magasins.map(norm);
  return PROMOS.items.filter(p =>
    p.type === "coupon" || !mes.length || mes.some(m => norm(p.enseigne).includes(m) || m.includes(norm(p.enseigne)))
  );
}

/** Cherche la meilleure promo correspondant à un ingrédient.
    Une offre sans pourcentage lisible est conservée (remise 0) : elle
    ne fait pas baisser le budget, mais elle signale le produit. */
function promoPour(nomIngredient, rayon){
  const n = norm(nomIngredient);
  const mots = n.split(" ").filter(w => w.length > 3);
  let best = null;
  for(const p of promosActives()){
    if(rayon && p.rayon && p.rayon !== rayon) continue;
    const cible = norm(p.produit + " " + (p.marque || ""));
    const match = cible.includes(n) || n.includes(cible) || mots.some(w => cible.includes(w));
    if(match && (!best || p.remise > best.remise)) best = p;
  }
  return best;
}

function rendrePromos(){
  $("#promoMaj").textContent = PROMOS.maj
    ? "Mis à jour le " + new Date(PROMOS.maj).toLocaleDateString("fr-FR",{day:"numeric",month:"long"})
    : "Catalogue non encore récupéré";

  const actives = promosActives();
  const enseignes = ["Toutes", ...new Set(actives.map(p => p.enseigne))];
  $("#promoFiltres").innerHTML = enseignes.map(e =>
    `<button class="filtre ${e===filtreEnseigne?"is-on":""}" data-ens="${e}">${e}</button>`).join("");
  $$("#promoFiltres .filtre").forEach(b => b.onclick = () => { filtreEnseigne = b.dataset.ens; rendrePromos(); });

  const liste = actives.filter(p => filtreEnseigne === "Toutes" || p.enseigne === filtreEnseigne);
  if(!liste.length){
    $("#promoListe").innerHTML = `<p class="empty">Rien à afficher pour l'instant. Le catalogue se remplit tout seul chaque mardi matin.</p>`;
    return;
  }
  $("#promoListe").innerHTML = liste.map(p => `
    <article class="promo">
      <div class="promo-txt">
        <div class="promo-ens">${p.enseigne}</div>
        <div class="promo-nom">${p.produit}</div>
        <div class="promo-meta">${p.rayon || ""}${p.marque ? " · " + p.marque : ""}${p.fin ? " · jusqu'au " + p.fin : ""}</div>
        <span class="badge-remise ${p.type==="coupon"?"badge-coupon":""}">
          ${p.remise >= 1 ? "Gratuit"
            : p.remise > 0 ? "−" + Math.round(p.remise*100) + " %"
            : p.type === "coupon" ? "Bon de réduction" : "En promo"}
        </span>
      </div>
      ${p.prix ? `<div class="prix">
        ${p.prixAvant ? `<span class="prix-avant">${eur(p.prixAvant)}</span>` : ""}
        <span class="prix-apres">${eur(p.prix)}</span>
      </div>` : ""}
    </article>`).join("");
}

/* ============================================================
   4. COÛTS ET GÉNÉRATION DU MENU
   ============================================================ */
function coutRecette(rec){
  const n = S.config.personnes;
  let plein = 0, reduit = 0, nbPromos = 0;
  for(const i of rec.ing){
    const brut = i.q * n * i.p;
    plein += brut;
    const pr = promoPour(i.n, i.r);
    if(pr) nbPromos++;
    reduit += pr ? brut * (1 - pr.remise) : brut;
  }
  return {plein, reduit, eco: plein - reduit, nbPromos};
}

function estExclue(rec){
  const ex = S.config.exclus.map(norm).filter(Boolean);
  if(!ex.length) return false;
  return rec.ing.some(i => ex.some(e => norm(i.n).includes(e) || e.includes(norm(i.n))))
      || ex.some(e => norm(rec.nom).includes(e));
}

function candidats(){
  return RECETTES.filter(r => !estExclue(r)).map(r => ({rec:r, c:coutRecette(r)}));
}

/** Choisit `n` recettes sous le budget, en privilégiant les promos et la variété. */
function genererMenu(){
  const pool = candidats();
  if(!pool.length){ toast("Toutes les recettes sont exclues. Allégez la liste dans Réglages."); return; }

  const budget = S.config.budget;
  const n = Math.min(S.config.repas, pool.length);
  const cible = budget / n;

  // score : moins cher que la cible = bonus, économie promo = bonus fort
  const notes = pool.map(p => ({
    ...p,
    score: (cible - p.c.reduit) * 0.6 + p.c.eco * 2.5 + p.c.nbPromos * 0.8 + Math.random() * 1.6
  })).sort((a,b) => b.score - a.score);

  const choisies = [];
  let total = 0;
  const tagsUtilises = {};
  for(const p of notes){
    if(choisies.length >= n) break;
    const tagPrincipal = p.rec.tags[0] || "";
    if((tagsUtilises[tagPrincipal] || 0) >= 3) continue;   // variété
    choisies.push(p);
    tagsUtilises[tagPrincipal] = (tagsUtilises[tagPrincipal] || 0) + 1;
    total += p.c.reduit;
  }
  // si on dépasse, on remplace les plus chères par les moins chères restantes
  const restantes = notes.filter(p => !choisies.includes(p)).sort((a,b) => a.c.reduit - b.c.reduit);
  let garde = 0;
  while(total > budget && restantes.length && garde++ < 40){
    choisies.sort((a,b) => b.c.reduit - a.c.reduit);
    const chere = choisies[0], pasChere = restantes.shift();
    if(pasChere.c.reduit >= chere.c.reduit) break;
    total += pasChere.c.reduit - chere.c.reduit;
    choisies[0] = pasChere;
  }

  S.menu = choisies.map((p,i) => ({id:p.rec.id, jour:JOURS[i % 7]}));
  S.coches = {};
  sauver();
  rendreMenu(); rendreListe(); rendreRecettes();
  toast(total > budget ? "Menu généré — budget dépassé, voyez la jauge" : "Menu généré sous le budget");
}

function remplacerPlat(index){
  const utilisees = S.menu.map(m => m.id);
  const pool = candidats().filter(p => !utilisees.includes(p.rec.id));
  if(!pool.length){ toast("Plus de recette disponible avec vos critères."); return; }
  const budget = S.config.budget;
  const totalAutres = S.menu.reduce((s,m,i) =>
    i === index ? s : s + coutRecette(RECETTES.find(r => r.id === m.id)).reduit, 0);
  const marge = budget - totalAutres;
  const compatibles = pool.filter(p => p.c.reduit <= marge);
  const source = compatibles.length ? compatibles : pool;
  source.sort((a,b) => (b.c.eco - a.c.eco) + (Math.random() - .5));
  S.menu[index].id = source[Math.floor(Math.random() * Math.min(4, source.length))].rec.id;
  S.coches = {};
  sauver();
  rendreMenu(index); rendreListe(); rendreRecettes();
}

/* ============================================================
   5. RENDU — MENU
   ============================================================ */
function totauxMenu(){
  let plein = 0, reduit = 0;
  for(const m of S.menu){
    const r = RECETTES.find(x => x.id === m.id); if(!r) continue;
    const c = coutRecette(r); plein += c.plein; reduit += c.reduit;
  }
  return {plein, reduit, eco: plein - reduit};
}

function rendreMenu(indexAnime){
  const t = totauxMenu();
  const b = S.config.budget;
  $("#jaugeCout").textContent = eur(t.reduit);
  $("#jaugeBudget").textContent = eur(b);
  const pct = b ? Math.min(100, t.reduit / b * 100) : 0;
  const fill = $("#jaugeFill");
  fill.style.width = pct + "%";
  fill.classList.toggle("over", t.reduit > b);
  $("#jaugeEco").textContent = t.eco > 0.01 ? eur(t.eco) + " d'économies grâce aux promos" : "";

  if(!S.menu.length){
    $("#menuListe").innerHTML = `<p class="empty">Aucun menu pour l'instant. Appuyez sur « Générer le menu ».</p>`;
    return;
  }
  $("#menuListe").innerHTML = S.menu.map((m,i) => {
    const r = RECETTES.find(x => x.id === m.id);
    const c = coutRecette(r);
    return `<article class="plat ${i===indexAnime?"pop":""}">
      <div class="plat-head">
        <div>
          <div class="plat-jour">${m.jour} · repas ${i+1}</div>
          <h3 class="plat-nom">${r.nom}</h3>
          <div class="plat-meta">${r.temps} min · ${S.config.personnes} pers.</div>
        </div>
        <div class="prix">
          ${c.eco > 0.01 ? `<span class="prix-avant">${eur(c.plein)}</span>` : ""}
          <span class="prix-apres">${eur(c.reduit)}</span>
        </div>
      </div>
      <div class="plat-actions">
        <button class="mini mini-swap" data-swap="${i}">Remplacer</button>
      </div>
    </article>`;
  }).join("");
  $$("[data-swap]").forEach(b => b.onclick = () => remplacerPlat(+b.dataset.swap));
}

/* ============================================================
   6. RENDU — LISTE DE COURSES
   ============================================================ */
function construireListe(){
  const stock = S.config.stock.map(norm).filter(Boolean);
  const agg = {};
  for(const m of S.menu){
    const r = RECETTES.find(x => x.id === m.id); if(!r) continue;
    for(const i of r.ing){
      const cle = i.n + "|" + i.u;
      if(!agg[cle]) agg[cle] = {n:i.n, u:i.u, r:i.r, p:i.p, q:0};
      agg[cle].q += i.q * S.config.personnes;
    }
  }
  return Object.values(agg)
    .filter(a => !stock.some(s => norm(a.n).includes(s) || s.includes(norm(a.n))))
    .map(a => {
      const pr = promoPour(a.n, a.r);
      const plein = a.q * a.p;
      return {...a, promo:pr, plein, cout: pr ? plein * (1 - pr.remise) : plein};
    });
}

function fmtQte(a){
  if(a.u === "kg") return a.q < 1 ? Math.round(a.q*1000) + " g" : a.q.toFixed(2).replace(".",",") + " kg";
  if(a.u === "L")  return a.q < 1 ? Math.round(a.q*1000) + " ml" : a.q.toFixed(2).replace(".",",") + " L";
  return Math.ceil(a.q * 10) / 10 + " " + (a.q > 1 ? "pièces" : "pièce");
}

function rendreListe(){
  const arts = construireListe();
  if(!arts.length){
    $("#listeCourses").innerHTML = `<p class="empty">La liste se remplit dès qu'un menu est généré.</p>`;
    $("#btnValider").classList.add("hidden");
    return;
  }
  const parRayon = {};
  arts.forEach(a => (parRayon[a.r] = parRayon[a.r] || []).push(a));

  $("#listeCourses").innerHTML = RAYONS.filter(r => parRayon[r]).map(r => {
    const items = parRayon[r].sort((a,b) => a.n.localeCompare(b.n,"fr"));
    const tot = items.reduce((s,a) => s + a.cout, 0);
    return `<section class="rayon">
      <div class="rayon-head">
        <span class="rayon-nom">${r}</span>
        <span class="rayon-total">${eur(tot)}</span>
      </div>
      <ul>${items.map(a => {
        const cle = a.n + "|" + a.u;
        const coche = S.coches[cle] ? "coche" : "";
        return `<li>
          <input type="checkbox" data-cle="${cle}" ${S.coches[cle]?"checked":""}>
          <span class="art-nom ${coche}">${a.n}<span class="art-qte">${fmtQte(a)}${a.promo ? " · promo " + a.promo.enseigne : ""}</span></span>
          <span class="prix">
            ${a.promo ? `<span class="prix-avant">${eur(a.plein)}</span>` : ""}
            <span class="prix-apres">${eur(a.cout)}</span>
          </span>
        </li>`;
      }).join("")}</ul>
    </section>`;
  }).join("");

  $$("#listeCourses input[type=checkbox]").forEach(c => c.onchange = () => {
    S.coches[c.dataset.cle] = c.checked; sauver();
    c.closest("li").querySelector(".art-nom").classList.toggle("coche", c.checked);
  });
  $("#btnValider").classList.remove("hidden");
}

function validerCourses(){
  const arts = construireListe();
  if(!arts.length) return;
  const parRayon = {};
  arts.forEach(a => parRayon[a.r] = (parRayon[a.r] || 0) + a.cout);
  const total = arts.reduce((s,a) => s + a.cout, 0);
  const eco   = arts.reduce((s,a) => s + (a.plein - a.cout), 0);
  S.historique.unshift({date:new Date().toISOString(), total, eco, parRayon});
  sauver();
  rendreAccueil();
  allerA("accueil");
  toast("Courses ajoutées au suivi du mois");
}

/* ============================================================
   7. RENDU — RECETTES
   ============================================================ */
function rendreRecettes(){
  if(!S.menu.length){
    $("#recettesListe").innerHTML = `<p class="empty">Les recettes apparaissent une fois le menu généré.</p>`;
    return;
  }
  $("#recettesListe").innerHTML = S.menu.map((m,i) => {
    const r = RECETTES.find(x => x.id === m.id);
    return `<article class="recette">
      <button class="recette-head" data-open="${i}" aria-expanded="false">
        <span class="recette-nom">${r.nom}</span>
        <span class="recette-temps">${r.temps} min</span>
      </button>
      <div class="recette-corps hidden" id="rc-${i}">
        <h4>Ingrédients · ${S.config.personnes} pers.</h4>
        <ul>${r.ing.map(ing => {
          const a = {...ing, q: ing.q * S.config.personnes};
          return `<li>${fmtQte(a)} — ${ing.n}</li>`;
        }).join("")}</ul>
        <h4>Préparation</h4>
        <ol>${r.etapes.map(e => `<li>${e}</li>`).join("")}</ol>
      </div>
    </article>`;
  }).join("");

  $$("[data-open]").forEach(b => b.onclick = () => {
    const c = $("#rc-" + b.dataset.open);
    const ouvert = !c.classList.contains("hidden");
    c.classList.toggle("hidden", ouvert);
    b.setAttribute("aria-expanded", String(!ouvert));
  });
}

/* ============================================================
   8. RENDU — ACCUEIL (camembert)
   ============================================================ */
function moisCourant(){
  const now = new Date();
  return S.historique.filter(h => {
    const d = new Date(h.date);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
}

function rendreAccueil(){
  $("#moisLabel").textContent =
    new Date().toLocaleDateString("fr-FR",{month:"long",year:"numeric"}).toUpperCase();

  const mois = moisCourant();
  const total = mois.reduce((s,h) => s + h.total, 0);
  const eco   = mois.reduce((s,h) => s + h.eco, 0);
  $("#totalDepense").textContent = eur(total);
  $("#totalEco").textContent = eur(eco);
  $("#donutCenterVal").textContent = eur(total);

  const parts = {};
  mois.forEach(h => Object.entries(h.parRayon).forEach(([r,v]) => parts[r] = (parts[r]||0) + v));
  dessinerDonut(parts, total);

  $("#legende").innerHTML = Object.entries(parts).sort((a,b)=>b[1]-a[1]).map(([r,v]) => `
    <li>
      <span class="pastille" style="background:${COULEURS_RAYON[r]||"#999"}"></span>
      <span class="lg-nom">${r}</span>
      <span class="lg-val">${eur(v)}</span>
    </li>`).join("");
  $("#accueilEmpty").classList.toggle("hidden", mois.length > 0);

  $("#histo").innerHTML = S.historique.slice(0,8).map(h => `
    <li>
      <span>${new Date(h.date).toLocaleDateString("fr-FR",{day:"2-digit",month:"short"})} · ${eur(h.total)}</span>
      <span class="h-eco">−${eur(h.eco)}</span>
    </li>`).join("") || `<p class="empty">Rien d'archivé pour le moment.</p>`;
}

function dessinerDonut(parts, total){
  const svg = $("#donut");
  const entries = Object.entries(parts).sort((a,b)=>b[1]-a[1]);
  if(!total || !entries.length){
    svg.innerHTML = `<circle cx="100" cy="100" r="72" fill="none" stroke="#14120F" stroke-width="2" stroke-dasharray="4 6" opacity=".35"/>`;
    return;
  }
  const R = 78, r = 44, cx = 100, cy = 100;
  let ang = -Math.PI/2, html = "";
  for(const [nom,val] of entries){
    const a2 = ang + (val/total) * Math.PI * 2;
    const grand = (a2 - ang) > Math.PI ? 1 : 0;
    const p = (rad,a) => [cx + rad*Math.cos(a), cy + rad*Math.sin(a)];
    const [x1,y1]=p(R,ang), [x2,y2]=p(R,a2), [x3,y3]=p(r,a2), [x4,y4]=p(r,ang);
    html += `<path d="M${x1} ${y1} A${R} ${R} 0 ${grand} 1 ${x2} ${y2} L${x3} ${y3} A${r} ${r} 0 ${grand} 0 ${x4} ${y4} Z"
             fill="${COULEURS_RAYON[nom]||"#999"}" stroke="#14120F" stroke-width="2" stroke-linejoin="round">
             <title>${nom} — ${eur(val)}</title></path>`;
    ang = a2;
  }
  svg.innerHTML = html;
}

/* ============================================================
   9. RÉGLAGES + NAVIGATION
   ============================================================ */
function remplirReglages(){
  $("#setPersonnes").value = S.config.personnes;
  $("#setRepas").value     = S.config.repas;
  $("#setBudget").value    = S.config.budget;
  $("#setExclus").value    = S.config.exclus.join(", ");
  $("#setStock").value     = S.config.stock.join(", ");
  if(magasinsTrouves.length) rendreMagasins("#setMagasins");
  else $("#setMagasins").innerHTML = S.config.magasins.map(m =>
    `<label class="store"><input type="checkbox" value="${m}" checked><span class="store-nom">${m}</span></label>`).join("")
    || `<p class="hint">Aucun magasin enregistré.</p>`;
}

function sauverReglages(){
  S.config.personnes = Math.max(1, +$("#setPersonnes").value || 1);
  S.config.repas     = Math.max(1, +$("#setRepas").value || 1);
  S.config.budget    = Math.max(1, +$("#setBudget").value || 1);
  S.config.exclus    = listeDepuisTexte($("#setExclus").value);
  S.config.stock     = listeDepuisTexte($("#setStock").value);
  const coches = $$("#setMagasins input:checked").map(i => i.value);
  if(coches.length || $$("#setMagasins input").length) S.config.magasins = coches;
  sauver();
  rendrePromos(); rendreMenu(); rendreListe(); rendreRecettes();
  toast("Paramètres enregistrés");
}

function allerA(vue){
  $$(".view").forEach(v => v.classList.toggle("hidden", v.id !== "view-" + vue));
  $$(".tab").forEach(t => t.classList.toggle("is-active", t.dataset.view === vue));
  window.scrollTo(0,0);
  if(vue === "reglages") remplirReglages();
  if(vue === "accueil") rendreAccueil();
}

/* ============================================================
   10. DÉMARRAGE
   ============================================================ */
function demarrerApp(){
  $$(".tab").forEach(t => t.onclick = () => allerA(t.dataset.view));
  $("#btnGenerer").onclick = genererMenu;
  $("#btnValider").onclick = validerCourses;
  $("#btnSauver").onclick  = sauverReglages;
  $("#setGeo").onclick     = () => chercherMagasins("#setMagasins");
  $("#btnReset").onclick   = () => {
    if(confirm("Effacer tous vos paramètres, menus et historique ?")){
      localStorage.removeItem(CLE); location.reload();
    }
  };
  rendreAccueil(); rendreMenu(); rendreListe(); rendreRecettes();
  chargerPromos();
  allerA("accueil");
}

charger();
if(S.installe){
  $("#app").classList.remove("hidden");
  demarrerApp();
}else{
  $("#onboarding").classList.remove("hidden");
  initOnboarding();
}
