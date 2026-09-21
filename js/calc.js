/* Hesaplama modülü: arayüzden bağımsız, test edilebilir. */
(function (root) {
  var LIST = root.Nutrients.LIST;

  /* Türkçe karakter toleranslı arama anahtarı: "Işık Şeker" -> "isik seker" */
  function norm(s) {
    return String(s == null ? '' : s)
      .toLocaleLowerCase('tr-TR')
      .replace(/ı/g, 'i')
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/\s+/g, ' ').trim();
  }

  /* 100 g değerlerinden gram miktarına ölçekle. Bilinmeyen (null) null kalır. */
  function scale(values, gram) {
    var out = {};
    LIST.forEach(function (n) {
      var v = values[n.k];
      out[n.k] = (v == null) ? null : (n.olceklenmez ? v : v * gram / 100);
    });
    return out;
  }

  /* items: [{degerler, gram}] -> { toplam: {k: sayı}, eksik: {k: bilinmeyen besin sayısı} }
     Bilinmeyen değer 0 sayılmaz; eksik sayacı ile bildirilir. */
  function sum(items) {
    var toplam = {}, eksik = {};
    LIST.forEach(function (n) { if (!n.olceklenmez) { toplam[n.k] = 0; eksik[n.k] = 0; } });
    items.forEach(function (it) {
      var s = scale(it.degerler, it.gram);
      LIST.forEach(function (n) {
        if (n.olceklenmez) return;
        if (s[n.k] == null) eksik[n.k]++; else toplam[n.k] += s[n.k];
      });
    });
    return { toplam: toplam, eksik: eksik };
  }

  /* Gösterim: birime göre uygun ondalık; null -> "—" */
  function fmt(v, birim) {
    if (v == null || isNaN(v)) return '—';
    var a = Math.abs(v), d;
    if (birim === 'kcal') d = 0;
    else if (a >= 100) d = 0;
    else if (a >= 10) d = 1;
    else d = 2;
    return v.toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: d });
  }

  /* Makronun kalori katkısı (Atwater): protein 4, karbonhidrat 4, yağ 9 kcal/g */
  function makroKalori(t) {
    return { protein: (t.protein || 0) * 4, karb: (t.karb || 0) * 4, yag: (t.yag || 0) * 9 };
  }

  root.Calc = { norm: norm, scale: scale, sum: sum, fmt: fmt, makroKalori: makroKalori };
})(typeof window !== 'undefined' ? window : globalThis);
