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

  var ALL = build(root.FOOD_ROWS);

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
    kategoriler: function () {
      var s = {};
      ALL.forEach(function (f) { s[f.kategori] = true; });
      return Object.keys(s).sort(function (a, b) { return a.localeCompare(b, 'tr'); });
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
