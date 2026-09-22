/* Hareket yükleyici: exercises-data.js satırlarını hareket nesnelerine çevirir, arama yapar,
   kullanıcının kendi hareketlerini listeye karıştırır. foods.js ile aynı desen. */
(function (root) {
  function slug(ad) { return root.Calc.norm(ad).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }

  function build(rows) {
    return rows.map(function (r) {
      return { id: 'e-' + slug(r[0]), ad: r[0], kategori: r[1], kaynak: 'hazır', kendi: false, _ara: root.Calc.norm(r[0]) };
    });
  }

  var HAZIR = build(root.EXERCISE_ROWS);
  var ALL = HAZIR.slice();
  var BY_ID = {};
  ALL.forEach(function (e) { BY_ID[e.id] = e; });

  /* Kullanıcının kendi hareketlerini listeye ekler; kaydedilmiş hareketler silinirse (guncelle([]))
     hazır liste bozulmadan geri döner. */
  function guncelle(ozelHareketler) {
    var ozel = (ozelHareketler || []).map(function (h) {
      return { id: h.id, ad: h.ad, kategori: h.kategori || 'Diğer', kaynak: 'kullanıcı', kendi: true, _ara: root.Calc.norm(h.ad) };
    });
    ALL = HAZIR.concat(ozel);
    BY_ID = {};
    ALL.forEach(function (e) { BY_ID[e.id] = e; });
    root.Exercises.ALL = ALL;
    root.Exercises.BY_ID = BY_ID;
  }

  /* Arama: her kelime (Türkçe karakter toleranslı) hareket adında geçmeli; adın başında eşleşenler öne. */
  function search(q, opts) {
    opts = opts || {};
    var words = root.Calc.norm(q).split(' ').filter(Boolean);
    var res = ALL.filter(function (e) {
      if (opts.kategori && e.kategori !== opts.kategori) return false;
      return words.every(function (w) { return e._ara.indexOf(w) !== -1; });
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

  root.Exercises = {
    ALL: ALL,
    BY_ID: BY_ID,
    search: search,
    guncelle: guncelle,
    kategoriler: function () {
      var s = {};
      ALL.forEach(function (e) { s[e.kategori] = true; });
      return Object.keys(s).sort(function (a, b) { return a.localeCompare(b, 'tr'); });
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
