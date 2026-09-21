/* Yedekleme mantığı (arayüzden bağımsız, test edilebilir): paketleme, doğrulama, göç, CSV. */
(function (root) {
  var UYGULAMA = 'besin-takip';
  var OGUNLER = ['kahvaltı', 'öğle', 'akşam', 'ara öğün', 'özel'];
  var MAKS_BOYUT = 50 * 1024 * 1024;

  function gecerliTarih(s) {
    if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
    var p = s.split('-').map(Number), d = new Date(p[0], p[1] - 1, p[2]);
    return d.getFullYear() === p[0] && d.getMonth() === p[1] - 1 && d.getDate() === p[2];
  }

  /* Depodan gelen dizilerle yedek nesnesi üretir. 'sonYedek' cihaza özgü olduğundan dışarı yazılmaz. */
  function paketle(parca, surum) {
    return {
      uygulama: UYGULAMA,
      schemaVersion: surum,
      disaAktarim: new Date().toISOString(),
      settings: (parca.settings || []).filter(function (s) { return s.key !== 'sonYedek'; }),
      favorites: parca.favorites || [],
      recents: parca.recents || [],
      log: parca.log || []
    };
  }

  /* Eski şema sürümlerini güncel biçime getirir. Yeni sürüm eklendikçe buraya adım eklenir. */
  function goc(data, hedefSurum) {
    var v = data.schemaVersion;
    /* v1 -> v2: 'log' deposu eklendi (v1 yedeklerinde yoktu) */
    if (v < 2 && !Array.isArray(data.log)) data.log = [];
    /* v2 -> v3: yalnızca IndexedDB'deki 'tarih' dizini onarıldı; yedek biçimi değişmedi. */
    data.schemaVersion = Math.max(v, hedefSurum || 3);
    return data;
  }

  /* Döner: {ok:true, veri} | {ok:false, hata:'Türkçe açıklama'} */
  function dogrula(data, mevcutSurum) {
    function hata(m) { return { ok: false, hata: m }; }
    if (!data || typeof data !== 'object' || Array.isArray(data)) return hata('Dosya geçerli bir yedek değil.');
    if (data.uygulama !== UYGULAMA) return hata('Bu dosya Besin Takip yedeği değil.');
    var v = data.schemaVersion;
    if (typeof v !== 'number' || v % 1 !== 0 || v < 1) return hata('Yedek sürümü okunamadı.');
    if (v > mevcutSurum) return hata('Bu yedek programın daha yeni bir sürümüyle alınmış (sürüm ' + v + '). Programı güncelleyin.');
    var d = {
      uygulama: UYGULAMA, schemaVersion: v, disaAktarim: data.disaAktarim,
      settings: data.settings, favorites: data.favorites, recents: data.recents, log: data.log
    };
    d = goc(d, mevcutSurum);
    ['settings', 'favorites', 'recents', 'log'].forEach(function (k) { if (d[k] == null) d[k] = []; });
    for (var k = 0; k < 4; k++) {
      var ad = ['settings', 'favorites', 'recents', 'log'][k];
      if (!Array.isArray(d[ad])) return hata('"' + ad + '" bölümü bozuk.');
    }
    var i;
    for (i = 0; i < d.settings.length; i++) {
      var s = d.settings[i];
      if (!s || typeof s.key !== 'string' || !s.key) return hata('Ayarlar bölümünde bozuk kayıt var (' + (i + 1) + '. satır).');
    }
    for (i = 0; i < d.favorites.length; i++) {
      if (!d.favorites[i] || typeof d.favorites[i].id !== 'string' || !d.favorites[i].id) return hata('Favoriler bölümünde bozuk kayıt var (' + (i + 1) + '. satır).');
    }
    for (i = 0; i < d.recents.length; i++) {
      var r = d.recents[i];
      if (!r || typeof r.id !== 'string' || !r.id || typeof r.ts !== 'number') return hata('Son kullanılanlar bölümünde bozuk kayıt var (' + (i + 1) + '. satır).');
    }
    var ids = {};
    for (i = 0; i < d.log.length; i++) {
      var e = d.log[i], n = i + 1;
      if (!e || typeof e.id !== 'string' || !e.id) return hata('Öğün kaydı ' + n + ': kimlik eksik.');
      if (ids[e.id]) return hata('Öğün kaydı ' + n + ': aynı kimlik iki kez var.');
      ids[e.id] = 1;
      if (!gecerliTarih(e.tarih)) return hata('Öğün kaydı ' + n + ': geçersiz tarih.');
      if (OGUNLER.indexOf(e.ogun) === -1) return hata('Öğün kaydı ' + n + ': geçersiz öğün.');
      if (typeof e.besin_id !== 'string' || !e.besin_id) return hata('Öğün kaydı ' + n + ': besin eksik.');
      if (typeof e.miktar_g !== 'number' || !isFinite(e.miktar_g) || e.miktar_g < 0) return hata('Öğün kaydı ' + n + ': geçersiz miktar.');
    }
    return { ok: true, veri: d };
  }

  /* ---- CSV ---- (noktalı virgül ayraçlı, ondalık virgül, UTF-8 BOM: Türkçe Excel'de doğrudan açılır) */
  function hucre(v) {
    if (v == null) return '';
    if (typeof v === 'number') {
      if (!isFinite(v)) return '';
      return String(Math.round(v * 1000) / 1000).replace('.', ',');
    }
    var s = String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; /* Excel formül enjeksiyonuna karşı */
    if (/[;"\n\r]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
    return s;
  }

  function csv(kayitlar, foodById) {
    var alanlar = root.Nutrients.LIST.filter(function (n) { return !n.olceklenmez; });
    var baslik = ['Tarih', 'Öğün', 'Saat', 'Besin', 'Kategori', 'Miktar (g)'].concat(alanlar.map(function (n) { return n.ad + (n.b ? ' (' + n.b + ')' : ''); }));
    var sirali = kayitlar.slice().sort(function (a, b) {
      return a.tarih < b.tarih ? -1 : a.tarih > b.tarih ? 1
        : OGUNLER.indexOf(a.ogun) - OGUNLER.indexOf(b.ogun) || String(a.saat || '').localeCompare(String(b.saat || ''));
    });
    var satirlar = [baslik.map(hucre).join(';')];
    sirali.forEach(function (k) {
      var f = foodById[k.besin_id];
      var v = f ? root.Calc.scale(f.degerler, k.miktar_g) : null;
      var hc = [k.tarih, k.ogun, k.saat || '', f ? f.ad : k.besin_id, f ? f.kategori : '', k.miktar_g];
      alanlar.forEach(function (n) { hc.push(v ? v[n.k] : null); });
      satirlar.push(hc.map(hucre).join(';'));
    });
    return '﻿' + satirlar.join('\r\n') + '\r\n';
  }

  function dosyaAdi(onek, uzanti) {
    var d = new Date(), p = function (n) { return (n < 10 ? '0' : '') + n; };
    return onek + '-' + d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '-' + p(d.getHours()) + p(d.getMinutes()) + '.' + uzanti;
  }

  root.Backup = { OGUNLER: OGUNLER, MAKS_BOYUT: MAKS_BOYUT, paketle: paketle, dogrula: dogrula, goc: goc, csv: csv, hucre: hucre, dosyaAdi: dosyaAdi, gecerliTarih: gecerliTarih };
})(typeof window !== 'undefined' ? window : globalThis);
