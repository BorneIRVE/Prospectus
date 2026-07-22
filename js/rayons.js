/* ============================================================
   rayons.js — range un produit dans un rayon à partir de son nom.
   Réutilisé par l'onglet Promo (badge) et par la Liste (regroupement).
   Renvoie { rayon, comestible }.
   - comestible=false => exclu du générateur de menu (lessive, couches…)
     mais ajoutable manuellement à la Liste.
   Première règle qui matche gagne : l'ordre compte.
   ============================================================ */
(function (global) {
  "use strict";

  var REGLES = [
    ["Boucherie · Poissonnerie", true,
      /poulet|b(?:œ|o)uf|steak|hach|saucisse|merguez|jambon|lardon|poisson|saumon|cabillaud|crevette|colin|viande|escalope|c(?:ô|o)te|brochette|carpaccio|dinde|\bporc\b|agneau|charal|bigard|volaille|r(?:ô|o)ti|magret|filet|nuggets/i],
    ["Surgelés", true,
      /surgel|\bglace|sorbet|b(?:â|a)tonnet|\bfrite/i],
    ["Crèmerie", true,
      /\blait\b|yaourt|yahourt|fromage|beurre|cr(?:è|e)me|(?:œ|o)euf|\boeuf|emmental|camembert|mozzarella|skyr|r(?:â|a)p(?:é|e)|ricotta|chantilly|petit suisse/i],
    ["Fruits & légumes", true,
      /pomme de terre|patate|poireau|tomate|salade|banane|carotte|oignon|courgette|\bfruit|l(?:é|e)gume|\bail\b|persil|citron|fraise|raisin|melon|p(?:ê|e)che|abricot|champignon|concombre|poivron|brocoli|(?:é|e)pinard/i],
    ["Boissons", true,
      /\beau\b|\bjus\b|soda|cola|bi(?:è|e)re|\bvin\b|sirop|boisson|limonade|smoothie/i],
    ["Épicerie", true,
      /p(?:â|a)tes|\briz\b|farine|huile|sucre|\bsel\b|conserve|\bsauce|biscuit|chocolat|c(?:é|e)r(?:é|e)al|compote|gourde|confiture|tartiner|nutella|miel|semoule|lentille|\bthon\b|bo(?:î|i)te|c(?:é|e)r(?:é|e)ales|ap(?:é|e)ritif|chips|g(?:â|a)teau|caf(?:é|e)|th(?:é|e)/i],
    ["Bébé", false,
      /couche|pampers|lingette|petit pot|b(?:é|e)b(?:é|e)/i],
    ["Hygiène & beauté", false,
      /shampo?ing|gel douche|dentifrice|\bsavon|d(?:é|e)odorant|rasoir|serviette|culotte|prot(?:è|e)ge|always|tampon|\bcoton|maquillage|d(?:é|e)maquill/i],
    ["Maison & entretien", false,
      /lessive|adoucissant|vaisselle|fairy|\bdash\b|nettoyant|(?:é|e)ponge|sac poubelle|swiffer|plumeau|essuie|papier toilette|d(?:é|e)tergent|javel|d(?:é|e)sodoris/i],
    ["Animaux", false,
      /croquette|p(?:â|a)t(?:é|e)e?\s|liti(?:è|e)re|\bchien\b|\bchat\b/i],
  ];

  function classer(nom, marque) {
    var s = ((nom || "") + " " + (marque || "")).toLowerCase();
    for (var i = 0; i < REGLES.length; i++) {
      if (REGLES[i][2].test(s)) {
        return { rayon: REGLES[i][0], comestible: REGLES[i][1] };
      }
    }
    return { rayon: "Divers", comestible: false };
  }

  // ordre d'affichage des rayons dans la Liste
  var ORDRE = [
    "Boucherie · Poissonnerie", "Crèmerie", "Fruits & légumes",
    "Épicerie", "Surgelés", "Boissons",
    "Bébé", "Hygiène & beauté", "Maison & entretien", "Animaux", "Divers",
  ];

  var api = { classer: classer, ORDRE: ORDRE };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  global.Rayons = api;
})(typeof window !== "undefined" ? window : globalThis);
