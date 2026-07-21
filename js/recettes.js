/* ============================================================
   Base de recettes.
   q = quantité POUR UNE PERSONNE, u = unité, r = rayon,
   p = prix de référence en € par unité (hors promo).
   Ajoutez vos propres recettes à la fin du tableau.
   ============================================================ */

const RAYONS = ["Fruits & légumes","Boucherie","Poissonnerie","Crèmerie","Épicerie","Surgelés","Boulangerie"];

const COULEURS_RAYON = {
  "Fruits & légumes":"#0F7B4F",
  "Boucherie":"#D6202A",
  "Poissonnerie":"#1B2A4A",
  "Crèmerie":"#E9C46A",
  "Épicerie":"#8B5E34",
  "Surgelés":"#5AA9D6",
  "Boulangerie":"#C97B2F"
};

const RECETTES = [
  {id:"r01", nom:"Poulet rôti au citron et pommes de terre", temps:55, tags:["four","volaille"],
   ing:[
     {n:"Cuisses de poulet",q:0.25,u:"kg",r:"Boucherie",p:6.90},
     {n:"Pommes de terre",q:0.30,u:"kg",r:"Fruits & légumes",p:1.60},
     {n:"Citron",q:0.5,u:"pièce",r:"Fruits & légumes",p:0.60},
     {n:"Ail",q:0.5,u:"pièce",r:"Fruits & légumes",p:0.40},
     {n:"Huile d'olive",q:0.02,u:"L",r:"Épicerie",p:7.50},
     {n:"Thym",q:0.1,u:"pièce",r:"Épicerie",p:1.20}],
   etapes:["Préchauffer le four à 200 °C.","Couper les pommes de terre en quartiers, les mélanger à l'huile, l'ail écrasé et le thym.","Poser les cuisses par-dessus, arroser du jus de citron, saler et poivrer.","Enfourner 45 min en arrosant à mi-cuisson.","Laisser reposer 5 min avant de servir."]},

  {id:"r02", nom:"Pâtes à la bolognaise maison", temps:40, tags:["mijoté","boeuf"],
   ing:[
     {n:"Boeuf haché 5 %",q:0.13,u:"kg",r:"Boucherie",p:11.90},
     {n:"Pâtes (tagliatelles)",q:0.12,u:"kg",r:"Épicerie",p:2.20},
     {n:"Tomates concassées",q:0.20,u:"kg",r:"Épicerie",p:1.80},
     {n:"Oignon",q:0.5,u:"pièce",r:"Fruits & légumes",p:0.35},
     {n:"Carotte",q:0.5,u:"pièce",r:"Fruits & légumes",p:0.30},
     {n:"Parmesan",q:0.02,u:"kg",r:"Crèmerie",p:19.00}],
   etapes:["Émincer l'oignon et la carotte, les faire suer 5 min.","Ajouter la viande, la saisir à feu vif.","Verser les tomates, saler, poivrer, laisser mijoter 25 min à couvert.","Cuire les pâtes al dente, les mélanger à la sauce.","Râper le parmesan au moment de servir."]},

  {id:"r03", nom:"Curry de pois chiches et lait de coco", temps:30, tags:["végétarien","rapide"],
   ing:[
     {n:"Pois chiches",q:0.15,u:"kg",r:"Épicerie",p:2.40},
     {n:"Lait de coco",q:0.10,u:"L",r:"Épicerie",p:3.20},
     {n:"Riz basmati",q:0.08,u:"kg",r:"Épicerie",p:2.60},
     {n:"Épinards",q:0.08,u:"kg",r:"Surgelés",p:2.50},
     {n:"Oignon",q:0.5,u:"pièce",r:"Fruits & légumes",p:0.35},
     {n:"Pâte de curry",q:0.015,u:"kg",r:"Épicerie",p:12.00}],
   etapes:["Faire revenir l'oignon émincé 4 min.","Ajouter la pâte de curry, remuer 1 min.","Verser les pois chiches égouttés et le lait de coco, mijoter 12 min.","Ajouter les épinards, cuire 4 min de plus.","Servir sur le riz."]},

  {id:"r04", nom:"Gratin de courgettes au chèvre", temps:45, tags:["four","végétarien"],
   ing:[
     {n:"Courgettes",q:0.30,u:"kg",r:"Fruits & légumes",p:2.20},
     {n:"Bûche de chèvre",q:0.05,u:"kg",r:"Crèmerie",p:12.00},
     {n:"Crème fraîche",q:0.06,u:"L",r:"Crèmerie",p:4.20},
     {n:"Oeufs",q:1,u:"pièce",r:"Crèmerie",p:0.35},
     {n:"Chapelure",q:0.02,u:"kg",r:"Épicerie",p:3.00}],
   etapes:["Trancher les courgettes, les faire revenir 8 min à la poêle.","Battre les oeufs avec la crème, saler, poivrer.","Disposer courgettes et chèvre dans un plat, verser l'appareil.","Saupoudrer de chapelure.","Cuire 30 min à 190 °C."]},

  {id:"r05", nom:"Filet de colin, riz et beurre citronné", temps:25, tags:["poisson","rapide"],
   ing:[
     {n:"Filet de colin",q:0.15,u:"kg",r:"Surgelés",p:9.50},
     {n:"Riz",q:0.08,u:"kg",r:"Épicerie",p:2.20},
     {n:"Beurre",q:0.02,u:"kg",r:"Crèmerie",p:9.50},
     {n:"Citron",q:0.5,u:"pièce",r:"Fruits & légumes",p:0.60},
     {n:"Persil",q:0.2,u:"pièce",r:"Fruits & légumes",p:1.00}],
   etapes:["Cuire le riz.","Poêler le colin 4 min de chaque côté à feu moyen.","Réserver le poisson, faire fondre le beurre dans la poêle avec le jus de citron.","Napper le poisson, parsemer de persil.","Servir aussitôt avec le riz."]},

  {id:"r06", nom:"Chili sin carne", temps:40, tags:["végétarien","mijoté"],
   ing:[
     {n:"Haricots rouges",q:0.15,u:"kg",r:"Épicerie",p:2.30},
     {n:"Tomates concassées",q:0.20,u:"kg",r:"Épicerie",p:1.80},
     {n:"Maïs",q:0.06,u:"kg",r:"Épicerie",p:2.60},
     {n:"Poivron",q:0.5,u:"pièce",r:"Fruits & légumes",p:1.10},
     {n:"Oignon",q:0.5,u:"pièce",r:"Fruits & légumes",p:0.35},
     {n:"Riz",q:0.07,u:"kg",r:"Épicerie",p:2.20}],
   etapes:["Faire revenir oignon et poivron 6 min.","Ajouter tomates, haricots, maïs et épices.","Mijoter 25 min à feu doux.","Rectifier l'assaisonnement.","Servir avec le riz."]},

  {id:"r07", nom:"Omelette aux pommes de terre et lardons", temps:25, tags:["rapide","économique"],
   ing:[
     {n:"Oeufs",q:3,u:"pièce",r:"Crèmerie",p:0.35},
     {n:"Pommes de terre",q:0.20,u:"kg",r:"Fruits & légumes",p:1.60},
     {n:"Lardons",q:0.05,u:"kg",r:"Boucherie",p:9.00},
     {n:"Oignon",q:0.3,u:"pièce",r:"Fruits & légumes",p:0.35}],
   etapes:["Cuire les pommes de terre en dés 12 min à la poêle.","Ajouter lardons et oignon, dorer 5 min.","Battre les oeufs, les verser dans la poêle.","Cuire 6 min à feu doux, replier.","Servir avec une salade."]},

  {id:"r08", nom:"Soupe de lentilles corail au cumin", temps:35, tags:["végétarien","économique"],
   ing:[
     {n:"Lentilles corail",q:0.09,u:"kg",r:"Épicerie",p:3.80},
     {n:"Carotte",q:1,u:"pièce",r:"Fruits & légumes",p:0.30},
     {n:"Oignon",q:0.5,u:"pièce",r:"Fruits & légumes",p:0.35},
     {n:"Cumin",q:0.005,u:"kg",r:"Épicerie",p:22.00},
     {n:"Pain de campagne",q:0.08,u:"kg",r:"Boulangerie",p:4.50}],
   etapes:["Faire suer oignon et carotte en dés.","Ajouter les lentilles rincées, le cumin et 3 volumes d'eau.","Cuire 22 min à couvert.","Mixer, ajuster la texture avec un peu d'eau.","Servir avec le pain grillé."]},

  {id:"r09", nom:"Sauté de porc aux carottes", temps:50, tags:["mijoté","porc"],
   ing:[
     {n:"Sauté de porc",q:0.15,u:"kg",r:"Boucherie",p:8.90},
     {n:"Carotte",q:2,u:"pièce",r:"Fruits & légumes",p:0.30},
     {n:"Oignon",q:0.5,u:"pièce",r:"Fruits & légumes",p:0.35},
     {n:"Riz",q:0.08,u:"kg",r:"Épicerie",p:2.20},
     {n:"Moutarde",q:0.01,u:"kg",r:"Épicerie",p:5.00}],
   etapes:["Saisir la viande sur toutes les faces.","Ajouter oignon et carottes en rondelles.","Mouiller à hauteur, ajouter la moutarde.","Mijoter 35 min à couvert.","Servir avec le riz."]},

  {id:"r10", nom:"Pizza maison tomate-mozzarella", temps:40, tags:["four","végétarien"],
   ing:[
     {n:"Pâte à pizza",q:0.5,u:"pièce",r:"Boulangerie",p:2.20},
     {n:"Coulis de tomate",q:0.10,u:"kg",r:"Épicerie",p:2.00},
     {n:"Mozzarella",q:0.06,u:"kg",r:"Crèmerie",p:8.50},
     {n:"Origan",q:0.003,u:"kg",r:"Épicerie",p:25.00},
     {n:"Roquette",q:0.02,u:"kg",r:"Fruits & légumes",p:12.00}],
   etapes:["Préchauffer le four à 240 °C.","Étaler la pâte, napper de coulis, saler.","Répartir la mozzarella, saupoudrer d'origan.","Cuire 12 min.","Ajouter la roquette à la sortie du four."]},

  {id:"r11", nom:"Quiche lorraine", temps:50, tags:["four"],
   ing:[
     {n:"Pâte brisée",q:0.35,u:"pièce",r:"Crèmerie",p:1.90},
     {n:"Lardons",q:0.05,u:"kg",r:"Boucherie",p:9.00},
     {n:"Oeufs",q:1,u:"pièce",r:"Crèmerie",p:0.35},
     {n:"Crème fraîche",q:0.07,u:"L",r:"Crèmerie",p:4.20},
     {n:"Emmental râpé",q:0.03,u:"kg",r:"Crèmerie",p:9.50}],
   etapes:["Étaler la pâte dans un moule, piquer le fond.","Faire dorer les lardons 5 min.","Battre oeufs et crème, poivrer généreusement.","Garnir, verser l'appareil, ajouter l'emmental.","Cuire 35 min à 180 °C."]},

  {id:"r12", nom:"Wok de nouilles aux légumes", temps:25, tags:["rapide","végétarien"],
   ing:[
     {n:"Nouilles chinoises",q:0.10,u:"kg",r:"Épicerie",p:3.20},
     {n:"Poivron",q:0.5,u:"pièce",r:"Fruits & légumes",p:1.10},
     {n:"Carotte",q:1,u:"pièce",r:"Fruits & légumes",p:0.30},
     {n:"Sauce soja",q:0.02,u:"L",r:"Épicerie",p:6.50},
     {n:"Huile de sésame",q:0.005,u:"L",r:"Épicerie",p:14.00},
     {n:"Ail",q:0.5,u:"pièce",r:"Fruits & légumes",p:0.40}],
   etapes:["Cuire les nouilles, les rincer.","Tailler les légumes en fines lanières.","Saisir 5 min au wok à feu vif avec l'ail.","Ajouter les nouilles et la sauce soja, sauter 3 min.","Finir avec l'huile de sésame."]},

  {id:"r13", nom:"Hachis parmentier", temps:60, tags:["four","boeuf"],
   ing:[
     {n:"Boeuf haché 5 %",q:0.12,u:"kg",r:"Boucherie",p:11.90},
     {n:"Pommes de terre",q:0.35,u:"kg",r:"Fruits & légumes",p:1.60},
     {n:"Lait",q:0.08,u:"L",r:"Crèmerie",p:1.10},
     {n:"Beurre",q:0.02,u:"kg",r:"Crèmerie",p:9.50},
     {n:"Oignon",q:0.5,u:"pièce",r:"Fruits & légumes",p:0.35},
     {n:"Emmental râpé",q:0.02,u:"kg",r:"Crèmerie",p:9.50}],
   etapes:["Cuire les pommes de terre 25 min, les écraser avec lait et beurre.","Faire revenir oignon puis viande 10 min.","Alterner viande et purée dans un plat.","Parsemer d'emmental.","Gratiner 20 min à 200 °C."]},

  {id:"r14", nom:"Salade de lentilles, féta et tomates", temps:30, tags:["froid","végétarien"],
   ing:[
     {n:"Lentilles vertes",q:0.09,u:"kg",r:"Épicerie",p:3.40},
     {n:"Féta",q:0.04,u:"kg",r:"Crèmerie",p:11.00},
     {n:"Tomates",q:0.15,u:"kg",r:"Fruits & légumes",p:2.80},
     {n:"Oignon rouge",q:0.3,u:"pièce",r:"Fruits & légumes",p:0.50},
     {n:"Huile d'olive",q:0.015,u:"L",r:"Épicerie",p:7.50},
     {n:"Vinaigre balsamique",q:0.008,u:"L",r:"Épicerie",p:6.00}],
   etapes:["Cuire les lentilles 20 min, les rafraîchir.","Couper tomates et oignon.","Émietter la féta.","Assembler, assaisonner huile et vinaigre.","Réserver 15 min au frais avant de servir."]},

  {id:"r15", nom:"Blanquette de dinde express", temps:45, tags:["mijoté","volaille"],
   ing:[
     {n:"Escalope de dinde",q:0.15,u:"kg",r:"Boucherie",p:9.80},
     {n:"Champignons de Paris",q:0.08,u:"kg",r:"Fruits & légumes",p:5.50},
     {n:"Carotte",q:1,u:"pièce",r:"Fruits & légumes",p:0.30},
     {n:"Crème fraîche",q:0.05,u:"L",r:"Crèmerie",p:4.20},
     {n:"Riz",q:0.08,u:"kg",r:"Épicerie",p:2.20}],
   etapes:["Couper la dinde en cubes, la faire blanchir 5 min.","Ajouter carottes et champignons, mouiller à hauteur.","Mijoter 25 min.","Lier avec la crème hors du feu.","Servir avec le riz."]},

  {id:"r16", nom:"Tartiflette de semaine", temps:55, tags:["four","hiver"],
   ing:[
     {n:"Pommes de terre",q:0.35,u:"kg",r:"Fruits & légumes",p:1.60},
     {n:"Reblochon",q:0.06,u:"kg",r:"Crèmerie",p:14.00},
     {n:"Lardons",q:0.06,u:"kg",r:"Boucherie",p:9.00},
     {n:"Oignon",q:0.5,u:"pièce",r:"Fruits & légumes",p:0.35},
     {n:"Crème fraîche",q:0.04,u:"L",r:"Crèmerie",p:4.20}],
   etapes:["Cuire les pommes de terre 20 min, les trancher.","Faire dorer oignon et lardons.","Mélanger le tout avec la crème dans un plat.","Poser le reblochon coupé en deux sur le dessus.","Gratiner 25 min à 200 °C."]},

  {id:"r17", nom:"Risotto aux champignons", temps:40, tags:["végétarien"],
   ing:[
     {n:"Riz arborio",q:0.09,u:"kg",r:"Épicerie",p:3.60},
     {n:"Champignons de Paris",q:0.10,u:"kg",r:"Fruits & légumes",p:5.50},
     {n:"Bouillon de légumes",q:0.01,u:"kg",r:"Épicerie",p:14.00},
     {n:"Parmesan",q:0.02,u:"kg",r:"Crèmerie",p:19.00},
     {n:"Oignon",q:0.4,u:"pièce",r:"Fruits & légumes",p:0.35},
     {n:"Beurre",q:0.015,u:"kg",r:"Crèmerie",p:9.50}],
   etapes:["Faire suer l'oignon, nacrer le riz 2 min.","Ajouter le bouillon louche par louche en remuant.","Poêler les champignons à part, les incorporer.","Cuire 18 min au total.","Lier hors du feu avec beurre et parmesan."]},

  {id:"r18", nom:"Croque-monsieur et salade verte", temps:20, tags:["rapide","économique"],
   ing:[
     {n:"Pain de mie",q:0.12,u:"kg",r:"Boulangerie",p:3.20},
     {n:"Jambon blanc",q:0.06,u:"kg",r:"Boucherie",p:12.00},
     {n:"Emmental râpé",q:0.04,u:"kg",r:"Crèmerie",p:9.50},
     {n:"Salade verte",q:0.4,u:"pièce",r:"Fruits & légumes",p:1.20},
     {n:"Beurre",q:0.01,u:"kg",r:"Crèmerie",p:9.50}],
   etapes:["Beurrer les tranches de pain.","Garnir de jambon et de fromage.","Dorer 4 min de chaque côté à la poêle.","Assaisonner la salade.","Servir bien chaud."]},

  {id:"r19", nom:"Saumon au four et haricots verts", temps:30, tags:["poisson"],
   ing:[
     {n:"Pavé de saumon",q:0.15,u:"kg",r:"Poissonnerie",p:19.90},
     {n:"Haricots verts",q:0.15,u:"kg",r:"Surgelés",p:2.90},
     {n:"Citron",q:0.4,u:"pièce",r:"Fruits & légumes",p:0.60},
     {n:"Huile d'olive",q:0.01,u:"L",r:"Épicerie",p:7.50},
     {n:"Aneth",q:0.15,u:"pièce",r:"Fruits & légumes",p:1.30}],
   etapes:["Préchauffer à 180 °C.","Poser le saumon sur du papier cuisson, arroser d'huile et de citron.","Cuire 15 min.","Cuire les haricots à la vapeur 8 min.","Parsemer d'aneth au moment de servir."]},

  {id:"r20", nom:"Couscous de légumes et merguez", temps:50, tags:["mijoté"],
   ing:[
     {n:"Merguez",q:0.12,u:"kg",r:"Boucherie",p:10.50},
     {n:"Semoule",q:0.08,u:"kg",r:"Épicerie",p:2.10},
     {n:"Courgettes",q:0.15,u:"kg",r:"Fruits & légumes",p:2.20},
     {n:"Carotte",q:1,u:"pièce",r:"Fruits & légumes",p:0.30},
     {n:"Pois chiches",q:0.08,u:"kg",r:"Épicerie",p:2.40},
     {n:"Ras el-hanout",q:0.004,u:"kg",r:"Épicerie",p:28.00}],
   etapes:["Faire mijoter les légumes 30 min avec les épices et un peu d'eau.","Ajouter les pois chiches en fin de cuisson.","Griller les merguez 10 min.","Hydrater la semoule avec un volume égal d'eau bouillante.","Servir séparément."]},

  {id:"r21", nom:"Gratin de pâtes au thon", temps:40, tags:["four","économique"],
   ing:[
     {n:"Pâtes (macaronis)",q:0.11,u:"kg",r:"Épicerie",p:1.90},
     {n:"Thon en boîte",q:0.08,u:"kg",r:"Épicerie",p:11.00},
     {n:"Coulis de tomate",q:0.12,u:"kg",r:"Épicerie",p:2.00},
     {n:"Emmental râpé",q:0.03,u:"kg",r:"Crèmerie",p:9.50},
     {n:"Oignon",q:0.4,u:"pièce",r:"Fruits & légumes",p:0.35}],
   etapes:["Cuire les pâtes al dente.","Faire revenir l'oignon, ajouter thon et coulis.","Mélanger avec les pâtes dans un plat.","Couvrir d'emmental.","Gratiner 20 min à 200 °C."]},

  {id:"r22", nom:"Poêlée de gnocchis, tomates cerises et mozzarella", temps:20, tags:["rapide","végétarien"],
   ing:[
     {n:"Gnocchis",q:0.20,u:"kg",r:"Crèmerie",p:3.40},
     {n:"Tomates cerises",q:0.10,u:"kg",r:"Fruits & légumes",p:5.50},
     {n:"Mozzarella",q:0.05,u:"kg",r:"Crèmerie",p:8.50},
     {n:"Basilic",q:0.15,u:"pièce",r:"Fruits & légumes",p:2.20},
     {n:"Huile d'olive",q:0.01,u:"L",r:"Épicerie",p:7.50}],
   etapes:["Poêler les gnocchis 8 min sans pré-cuisson jusqu'à ce qu'ils dorent.","Ajouter les tomates coupées en deux, cuire 4 min.","Couper le feu, ajouter la mozzarella en morceaux.","Couvrir 2 min pour la faire fondre.","Parsemer de basilic."]},

  {id:"r23", nom:"Soupe à l'oignon gratinée", temps:45, tags:["hiver","économique"],
   ing:[
     {n:"Oignon",q:2.5,u:"pièce",r:"Fruits & légumes",p:0.35},
     {n:"Bouillon de boeuf",q:0.01,u:"kg",r:"Épicerie",p:14.00},
     {n:"Pain de campagne",q:0.06,u:"kg",r:"Boulangerie",p:4.50},
     {n:"Emmental râpé",q:0.04,u:"kg",r:"Crèmerie",p:9.50},
     {n:"Beurre",q:0.015,u:"kg",r:"Crèmerie",p:9.50}],
   etapes:["Émincer les oignons, les caraméliser 20 min au beurre à feu doux.","Mouiller avec le bouillon, cuire 15 min.","Verser en bols, poser une tranche de pain.","Couvrir d'emmental.","Gratiner 8 min sous le gril."]},

  {id:"r24", nom:"Boulettes de boeuf sauce tomate", temps:40, tags:["boeuf"],
   ing:[
     {n:"Boeuf haché 5 %",q:0.13,u:"kg",r:"Boucherie",p:11.90},
     {n:"Chapelure",q:0.02,u:"kg",r:"Épicerie",p:3.00},
     {n:"Oeufs",q:0.4,u:"pièce",r:"Crèmerie",p:0.35},
     {n:"Coulis de tomate",q:0.18,u:"kg",r:"Épicerie",p:2.00},
     {n:"Pâtes (spaghetti)",q:0.10,u:"kg",r:"Épicerie",p:1.90},
     {n:"Ail",q:0.5,u:"pièce",r:"Fruits & légumes",p:0.40}],
   etapes:["Mélanger viande, chapelure, oeuf, sel et poivre.","Former des boulettes, les dorer 6 min.","Ajouter le coulis et l'ail, mijoter 20 min.","Cuire les pâtes.","Servir les boulettes sur les pâtes."]},

  {id:"r25", nom:"Tarte aux poireaux et lardons", temps:55, tags:["four"],
   ing:[
     {n:"Pâte brisée",q:0.35,u:"pièce",r:"Crèmerie",p:1.90},
     {n:"Poireaux",q:0.20,u:"kg",r:"Fruits & légumes",p:2.60},
     {n:"Lardons",q:0.05,u:"kg",r:"Boucherie",p:9.00},
     {n:"Crème fraîche",q:0.06,u:"L",r:"Crèmerie",p:4.20},
     {n:"Oeufs",q:0.8,u:"pièce",r:"Crèmerie",p:0.35}],
   etapes:["Émincer les poireaux, les faire fondre 15 min à couvert.","Ajouter les lardons, cuire 5 min.","Battre oeufs et crème.","Garnir la pâte, verser l'appareil.","Cuire 35 min à 180 °C."]},

  {id:"r26", nom:"Dahl de lentilles à la tomate", temps:35, tags:["végétarien","économique"],
   ing:[
     {n:"Lentilles corail",q:0.10,u:"kg",r:"Épicerie",p:3.80},
     {n:"Tomates concassées",q:0.15,u:"kg",r:"Épicerie",p:1.80},
     {n:"Lait de coco",q:0.06,u:"L",r:"Épicerie",p:3.20},
     {n:"Riz",q:0.07,u:"kg",r:"Épicerie",p:2.20},
     {n:"Gingembre",q:0.01,u:"kg",r:"Fruits & légumes",p:9.00},
     {n:"Oignon",q:0.5,u:"pièce",r:"Fruits & légumes",p:0.35}],
   etapes:["Faire revenir oignon et gingembre râpé.","Ajouter lentilles, tomates et 2 volumes d'eau.","Cuire 20 min en remuant.","Verser le lait de coco, mijoter 5 min.","Servir avec le riz."]},

  {id:"r27", nom:"Escalope de dinde panée et purée", temps:35, tags:["volaille","enfants"],
   ing:[
     {n:"Escalope de dinde",q:0.15,u:"kg",r:"Boucherie",p:9.80},
     {n:"Chapelure",q:0.03,u:"kg",r:"Épicerie",p:3.00},
     {n:"Oeufs",q:0.5,u:"pièce",r:"Crèmerie",p:0.35},
     {n:"Pommes de terre",q:0.30,u:"kg",r:"Fruits & légumes",p:1.60},
     {n:"Lait",q:0.07,u:"L",r:"Crèmerie",p:1.10},
     {n:"Beurre",q:0.015,u:"kg",r:"Crèmerie",p:9.50}],
   etapes:["Cuire les pommes de terre 25 min, les écraser avec lait et beurre.","Passer les escalopes dans l'oeuf battu puis la chapelure.","Dorer 4 min de chaque côté.","Saler à la sortie de la poêle.","Servir avec la purée."]},

  {id:"r28", nom:"Salade César au poulet", temps:25, tags:["froid","volaille"],
   ing:[
     {n:"Filet de poulet",q:0.13,u:"kg",r:"Boucherie",p:11.50},
     {n:"Salade romaine",q:0.5,u:"pièce",r:"Fruits & légumes",p:1.60},
     {n:"Parmesan",q:0.02,u:"kg",r:"Crèmerie",p:19.00},
     {n:"Pain de campagne",q:0.04,u:"kg",r:"Boulangerie",p:4.50},
     {n:"Mayonnaise",q:0.02,u:"kg",r:"Épicerie",p:5.50},
     {n:"Citron",q:0.3,u:"pièce",r:"Fruits & légumes",p:0.60}],
   etapes:["Griller le poulet 10 min, le trancher.","Dorer des dés de pain à la poêle.","Mélanger mayonnaise, jus de citron et parmesan râpé.","Assembler salade, poulet et croûtons.","Napper de sauce au moment de servir."]},

  {id:"r29", nom:"Ratatouille et oeufs pochés", temps:50, tags:["végétarien","mijoté"],
   ing:[
     {n:"Courgettes",q:0.15,u:"kg",r:"Fruits & légumes",p:2.20},
     {n:"Aubergine",q:0.12,u:"kg",r:"Fruits & légumes",p:3.20},
     {n:"Poivron",q:0.5,u:"pièce",r:"Fruits & légumes",p:1.10},
     {n:"Tomates concassées",q:0.15,u:"kg",r:"Épicerie",p:1.80},
     {n:"Oeufs",q:2,u:"pièce",r:"Crèmerie",p:0.35},
     {n:"Huile d'olive",q:0.015,u:"L",r:"Épicerie",p:7.50}],
   etapes:["Tailler les légumes en cubes réguliers.","Les saisir séparément 5 min chacun.","Réunir avec les tomates, mijoter 25 min.","Casser les oeufs dans des creux de la ratatouille.","Couvrir 6 min et servir."]},

  {id:"r30", nom:"Pâtes carbonara à l'italienne", temps:20, tags:["rapide"],
   ing:[
     {n:"Pâtes (spaghetti)",q:0.11,u:"kg",r:"Épicerie",p:1.90},
     {n:"Lardons",q:0.06,u:"kg",r:"Boucherie",p:9.00},
     {n:"Oeufs",q:1.2,u:"pièce",r:"Crèmerie",p:0.35},
     {n:"Parmesan",q:0.025,u:"kg",r:"Crèmerie",p:19.00}],
   etapes:["Cuire les pâtes, garder une louche d'eau de cuisson.","Faire dorer les lardons sans matière grasse.","Battre les jaunes avec le parmesan et beaucoup de poivre.","Hors du feu, mélanger pâtes, lardons et appareil.","Détendre avec l'eau de cuisson jusqu'à obtenir une crème."]},

  {id:"r31", nom:"Poulet basquaise", temps:55, tags:["mijoté","volaille"],
   ing:[
     {n:"Cuisses de poulet",q:0.22,u:"kg",r:"Boucherie",p:6.90},
     {n:"Poivron",q:1,u:"pièce",r:"Fruits & légumes",p:1.10},
     {n:"Tomates concassées",q:0.18,u:"kg",r:"Épicerie",p:1.80},
     {n:"Oignon",q:0.6,u:"pièce",r:"Fruits & légumes",p:0.35},
     {n:"Riz",q:0.08,u:"kg",r:"Épicerie",p:2.20},
     {n:"Piment d'Espelette",q:0.002,u:"kg",r:"Épicerie",p:60.00}],
   etapes:["Dorer le poulet sur toutes les faces, réserver.","Faire fondre oignon et poivrons 10 min.","Remettre le poulet, ajouter les tomates et le piment.","Mijoter 35 min à couvert.","Servir avec le riz."]},

  {id:"r32", nom:"Galettes de pommes de terre et salade", temps:30, tags:["végétarien","économique"],
   ing:[
     {n:"Pommes de terre",q:0.30,u:"kg",r:"Fruits & légumes",p:1.60},
     {n:"Oeufs",q:1,u:"pièce",r:"Crèmerie",p:0.35},
     {n:"Farine",q:0.02,u:"kg",r:"Épicerie",p:1.20},
     {n:"Salade verte",q:0.4,u:"pièce",r:"Fruits & légumes",p:1.20},
     {n:"Crème fraîche",q:0.04,u:"L",r:"Crèmerie",p:4.20}],
   etapes:["Râper les pommes de terre, les presser pour retirer l'eau.","Mélanger avec l'oeuf et la farine, saler.","Former des galettes, cuire 5 min par face.","Assaisonner la salade.","Servir avec une cuillère de crème."]}
];
