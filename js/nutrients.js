/* Besin değeri alanları: anahtar, Türkçe ad, birim, grup. Tüm değerler 100 g başına saklanır. */
(function (root) {
  var G = { MAKRO: 'Enerji ve makrolar', VIT: 'Vitaminler', MIN: 'Mineraller', DIGER: 'Diğer' };

  var NUTRIENTS = [
    { k: 'kcal', ad: 'Kalori', b: 'kcal', g: G.MAKRO },
    { k: 'protein', ad: 'Protein', b: 'g', g: G.MAKRO },
    { k: 'karb', ad: 'Karbonhidrat', b: 'g', g: G.MAKRO },
    { k: 'seker', ad: 'Şeker', b: 'g', g: G.MAKRO },
    { k: 'nisasta', ad: 'Nişasta', b: 'g', g: G.MAKRO },
    { k: 'lif', ad: 'Lif', b: 'g', g: G.MAKRO },
    { k: 'yag', ad: 'Toplam yağ', b: 'g', g: G.MAKRO },
    { k: 'doymus', ad: 'Doymuş yağ', b: 'g', g: G.MAKRO },
    { k: 'tekli', ad: 'Tekli doymamış yağ', b: 'g', g: G.MAKRO },
    { k: 'coklu', ad: 'Çoklu doymamış yağ', b: 'g', g: G.MAKRO },
    { k: 'trans', ad: 'Trans yağ', b: 'g', g: G.MAKRO },
    { k: 'kolesterol', ad: 'Kolesterol', b: 'mg', g: G.MAKRO },
    { k: 'su', ad: 'Su', b: 'g', g: G.MAKRO },

    { k: 'vitA', ad: 'A vitamini', b: 'µg', g: G.VIT },
    { k: 'b1', ad: 'B1 (Tiamin)', b: 'mg', g: G.VIT },
    { k: 'b2', ad: 'B2 (Riboflavin)', b: 'mg', g: G.VIT },
    { k: 'b3', ad: 'B3 (Niasin)', b: 'mg', g: G.VIT },
    { k: 'b5', ad: 'B5 (Pantotenik asit)', b: 'mg', g: G.VIT },
    { k: 'b6', ad: 'B6', b: 'mg', g: G.VIT },
    { k: 'b7', ad: 'B7 (Biyotin)', b: 'µg', g: G.VIT },
    { k: 'b9', ad: 'B9 (Folat)', b: 'µg', g: G.VIT },
    { k: 'b12', ad: 'B12', b: 'µg', g: G.VIT },
    { k: 'vitC', ad: 'C vitamini', b: 'mg', g: G.VIT },
    { k: 'vitD', ad: 'D vitamini', b: 'µg', g: G.VIT },
    { k: 'vitE', ad: 'E vitamini', b: 'mg', g: G.VIT },
    { k: 'vitK', ad: 'K vitamini', b: 'µg', g: G.VIT },

    { k: 'kalsiyum', ad: 'Kalsiyum', b: 'mg', g: G.MIN },
    { k: 'demir', ad: 'Demir', b: 'mg', g: G.MIN },
    { k: 'magnezyum', ad: 'Magnezyum', b: 'mg', g: G.MIN },
    { k: 'fosfor', ad: 'Fosfor', b: 'mg', g: G.MIN },
    { k: 'potasyum', ad: 'Potasyum', b: 'mg', g: G.MIN },
    { k: 'sodyum', ad: 'Sodyum', b: 'mg', g: G.MIN },
    { k: 'cinko', ad: 'Çinko', b: 'mg', g: G.MIN },
    { k: 'bakir', ad: 'Bakır', b: 'mg', g: G.MIN },
    { k: 'manganez', ad: 'Manganez', b: 'mg', g: G.MIN },
    { k: 'selenyum', ad: 'Selenyum', b: 'µg', g: G.MIN },
    { k: 'iyot', ad: 'Iyot', b: 'µg', g: G.MIN },

    { k: 'kafein', ad: 'Kafein', b: 'mg', g: G.DIGER },
    { k: 'alkol', ad: 'Alkol', b: 'g', g: G.DIGER },
    { k: 'omega3', ad: 'Omega-3', b: 'g', g: G.DIGER },
    { k: 'omega6', ad: 'Omega-6', b: 'g', g: G.DIGER },
    { k: 'gi', ad: 'Glisemik indeks', b: '', g: G.DIGER, olceklenmez: true }
  ];

  var BY_KEY = {};
  NUTRIENTS.forEach(function (n) { BY_KEY[n.k] = n; });

  root.Nutrients = { LIST: NUTRIENTS, BY_KEY: BY_KEY, GROUPS: [G.MAKRO, G.VIT, G.MIN, G.DIGER] };
})(typeof window !== 'undefined' ? window : globalThis);
