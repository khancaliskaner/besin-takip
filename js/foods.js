/* Besin yükleyici: foods-data.js satırlarını besin nesnelerine çevirir, arama yapar. */
(function (root) {
  var ORDER = ['kcal', 'protein', 'karb', 'seker', 'lif', 'yag', 'doymus', 'sodyum', 'kolesterol'];

  function slug(ad) {
    return root.Calc.norm(ad).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }

  function build(rows) {
    return rows.map(function (r) {
      var degerler = {};
      root.Nutrients.LIST.forEach(function (n) { degerler[n.k] = null; });
      ORDER.forEach(function (k, i) { degerler[k] = r[4][i]; });
      var ek = r[5] || {};
      Object.keys(ek).forEach(function (k) {
        if (!(k in degerler)) throw new Error('Bilinmeyen besin alanı: ' + k + ' (' + r[0] + ')');
        degerler[k] = ek[k];
      });
      return {
        id: 'h-' + slug(r[0]),
        ad: r[0],
        kategori: r[1],
        kaynak: 'hazır',
        dogrulandi: false,
        varsayilan_g: r[2],
        porsiyonlar: r[3].map(function (p) { return { ad: p[0], g: p[1] }; }),
        degerler: degerler,
        _ara: root.Calc.norm(r[0])
      };
    });
  }

  var HAZIR = build(root.FOOD_ROWS);
  var ALL = HAZIR.slice();

  /* Kullanıcı besinini uygulama biçimine çevirir (eksik alanlar null kalır). */
  function ozelBesine(b) {
    var degerler = {};
    root.Nutrients.LIST.forEach(function (n) {
      var v = b.degerler ? b.degerler[n.k] : null;
      degerler[n.k] = (typeof v === 'number' && isFinite(v)) ? v : null;
    });
    return {
      id: b.id, ad: b.ad, kategori: b.kategori || 'Kendi besinim',
      kaynak: 'kullanıcı', dogrulandi: false, kendi: true,
      varsayilan_g: b.varsayilan_g > 0 ? b.varsayilan_g : 100,
      porsiyonlar: (b.porsiyonlar || []).slice(),
      degerler: degerler,
      _ara: root.Calc.norm(b.ad)
    };
  }

  /* Tarifi besin nesnesine çevirir: bileşenlerin toplamı, 100 g başına ölçeklenir.
     Bir alanda hiçbir bileşenin verisi yoksa alan null kalır (0 sayılmaz); kısmen
     eksikse kısmi toplam kullanılır ve eksik bileşen sayısı `eksikAlan` ile bildirilir. */
  function tarifBesine(t, byId) {
    var kalemler = (t.bilesenler || []).map(function (b) {
      var f = byId[b.besin_id];
      return f ? { degerler: f.degerler, gram: b.gram } : null;
    }).filter(Boolean);
    var toplamG = t.toplam_g > 0 ? t.toplam_g : kalemler.reduce(function (a, k) { return a + k.gram; }, 0);
    var s = root.Calc.sum(kalemler);
    var degerler = {}, eksikAlan = 0;
    root.Nutrients.LIST.forEach(function (n) {
      if (n.olceklenmez) { degerler[n.k] = null; return; }
      var hepsiEksik = s.eksik[n.k] >= kalemler.length;
      if (hepsiEksik || !(toplamG > 0)) { degerler[n.k] = null; return; }
      if (s.eksik[n.k] > 0) eksikAlan++;
      degerler[n.k] = s.toplam[n.k] / toplamG * 100;
    });
    return {
      id: t.id, ad: t.ad, kategori: 'Tarif',
      kaynak: 'tarif', dogrulandi: false, tarif: true, eksikAlan: eksikAlan,
      bilesenSayisi: kalemler.length,
      varsayilan_g: t.varsayilan_g > 0 ? t.varsayilan_g : Math.round(toplamG),
      porsiyonlar: (t.porsiyonlar && t.porsiyonlar.length ? t.porsiyonlar
        : [{ ad: 'Tarifin tamamı', g: Math.round(toplamG) }]).slice(),
      degerler: degerler,
      toplam_g: toplamG,
      _ara: root.Calc.norm(t.ad)
    };
  }

  /* Kendi besinler ve tarifler değişince listeyi yeniden kurar.
     Tarifler hazır + kendi besinlerden hesaplanır (tarif içinde tarif yoktur). */
  function guncelle(ozelBesinler, tarifler) {
    var ozel = (ozelBesinler || []).map(ozelBesine);
    var temel = HAZIR.concat(ozel);
    var byId = {};
    temel.forEach(function (f) { byId[f.id] = f; });
    var tarifBesin = (tarifler || []).map(function (t) { return tarifBesine(t, byId); });
    ALL = temel.concat(tarifBesin);
    BY_ID = {};
    ALL.forEach(function (f) { BY_ID[f.id] = f; });
    root.Foods.ALL = ALL;
    root.Foods.BY_ID = BY_ID;
  }

  /* Arama: her kelime (Türkçe karakter toleranslı) besin adında geçmeli; adın başında eşleşenler öne. */
  function search(q, opts) {
    opts = opts || {};
    var words = root.Calc.norm(q).split(' ').filter(Boolean);
    var res = ALL.filter(function (f) {
      if (opts.kategori && f.kategori !== opts.kategori) return false;
      if (opts.idSet && !opts.idSet.has(f.id)) return false;
      return words.every(function (w) { return f._ara.indexOf(w) !== -1; });
    });
    if (words.length) {
      var w0 = words[0];
      res.sort(function (a, b) {
        var pa = a._ara.indexOf(w0) === 0 ? 0 : 1, pb = b._ara.indexOf(w0) === 0 ? 0 : 1;
        return pa - pb || a.ad.localeCompare(b.ad, 'tr');
      });
    } else {
      res.sort(function (a, b) { return a.ad.localeCompare(b.ad, 'tr'); });
    }
    return res;
  }

  var BY_ID = {};
  ALL.forEach(function (f) { BY_ID[f.id] = f; });

  root.Foods = {
    ALL: ALL,
    BY_ID: BY_ID,
    search: search,
    guncelle: guncelle,
    slug: slug,
    tarifBesine: tarifBesine,
    kategoriler: function () {
      var s = {};
      ALL.forEach(function (f) { s[f.kategori] = true; });
      return Object.keys(s).sort(function (a, b) { return a.localeCompare(b, 'tr'); });
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
