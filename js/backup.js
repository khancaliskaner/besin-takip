/* Yedekleme mantığı (arayüzden bağımsız, test edilebilir): paketleme, doğrulama, göç, CSV. */
(function (root) {
  var UYGULAMA = 'besin-takip';
  var OGUNLER = ['kahvaltı', 'öğle', 'akşam', 'ara öğün', 'özel'];
  var MAKS_BOYUT = 50 * 1024 * 1024;
  var BOLUMLER = ['settings', 'favorites', 'recents', 'log', 'ozelBesinler', 'tarifler', 'favoriOgunler',
                   'suKayitlari', 'ozelHareketler', 'antrenmanGunlugu', 'favoriAntrenmanlar', 'gunTamamlamalar'];

  function gecerliTarih(s) {
    if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
    var p = s.split('-').map(Number), d = new Date(p[0], p[1] - 1, p[2]);
    return d.getFullYear() === p[0] && d.getMonth() === p[1] - 1 && d.getDate() === p[2];
  }

  /* Depodan gelen dizilerle yedek nesnesi üretir. 'sonYedek' cihaza özgü olduğundan dışarı yazılmaz. */
  function paketle(parca, surum) {
    var v = {
      uygulama: UYGULAMA,
      schemaVersion: surum,
      disaAktarim: new Date().toISOString(),
      settings: (parca.settings || []).filter(function (s) { return s.key !== 'sonYedek'; })
    };
    BOLUMLER.forEach(function (k) { if (k !== 'settings') v[k] = parca[k] || []; });
    return v;
  }

  /* Eski şema sürümlerini güncel biçime getirir. Yeni sürüm eklendikçe buraya adım eklenir. */
  function goc(data, hedefSurum) {
    var v = data.schemaVersion;
    /* v1 -> v2: 'log' deposu eklendi (v1 yedeklerinde yoktu) */
    if (v < 2 && !Array.isArray(data.log)) data.log = [];
    /* v2 -> v3: yalnızca IndexedDB'deki 'tarih' dizini onarıldı; yedek biçimi değişmedi. */
    /* v3 -> v4: kendi besinler, tarifler ve favori öğünler eklendi (eski yedeklerde yoktu). */
    /* v4 -> v5: su kayıtları, kendi hareketler, antrenman günlüğü, favori antrenmanlar eklendi. */
    /* v5 -> v6: gün tamamlama işaretleri eklendi. */
    BOLUMLER.forEach(function (k) { if (k !== 'settings' && !Array.isArray(data[k])) data[k] = []; });
    data.schemaVersion = Math.max(v, hedefSurum || 6);
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
    var d = { uygulama: UYGULAMA, schemaVersion: v, disaAktarim: data.disaAktarim };
    BOLUMLER.forEach(function (k) { d[k] = data[k]; });
    d = goc(d, mevcutSurum);
    BOLUMLER.forEach(function (k) { if (d[k] == null) d[k] = []; });
    for (var k = 0; k < BOLUMLER.length; k++) {
      var ad = BOLUMLER[k];
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
    /* Kendi besinler: değerler nesnesi ve porsiyonlar tutarlı olmalı */
    var bids = {};
    for (i = 0; i < d.ozelBesinler.length; i++) {
      var b = d.ozelBesinler[i], bn = i + 1;
      if (!b || typeof b.id !== 'string' || !b.id) return hata('Kendi besin ' + bn + ': kimlik eksik.');
      if (bids[b.id]) return hata('Kendi besin ' + bn + ': aynı kimlik iki kez var.');
      bids[b.id] = 1;
      if (typeof b.ad !== 'string' || !b.ad.trim()) return hata('Kendi besin ' + bn + ': ad eksik.');
      if (!b.degerler || typeof b.degerler !== 'object') return hata('Kendi besin ' + bn + ': besin değerleri eksik.');
      if (typeof b.degerler.kcal !== 'number' || b.degerler.kcal < 0) return hata('Kendi besin ' + bn + ': kalori değeri geçersiz.');
      if (!Array.isArray(b.porsiyonlar)) return hata('Kendi besin ' + bn + ': porsiyon listesi bozuk.');
      for (var pi = 0; pi < b.porsiyonlar.length; pi++) {
        var p = b.porsiyonlar[pi];
        if (!p || typeof p.ad !== 'string' || typeof p.g !== 'number' || !(p.g > 0)) return hata('Kendi besin ' + bn + ': porsiyon tanımı geçersiz.');
      }
    }
    /* Tarifler: en az bir bileşen, pozitif toplam ağırlık */
    var tids = {};
    for (i = 0; i < d.tarifler.length; i++) {
      var tr = d.tarifler[i], tn = i + 1;
      if (!tr || typeof tr.id !== 'string' || !tr.id) return hata('Tarif ' + tn + ': kimlik eksik.');
      if (tids[tr.id]) return hata('Tarif ' + tn + ': aynı kimlik iki kez var.');
      tids[tr.id] = 1;
      if (typeof tr.ad !== 'string' || !tr.ad.trim()) return hata('Tarif ' + tn + ': ad eksik.');
      if (!Array.isArray(tr.bilesenler) || !tr.bilesenler.length) return hata('Tarif ' + tn + ': bileşen listesi boş.');
      for (var bi = 0; bi < tr.bilesenler.length; bi++) {
        var bl = tr.bilesenler[bi];
        if (!bl || typeof bl.besin_id !== 'string' || !bl.besin_id) return hata('Tarif ' + tn + ': bileşen besini eksik.');
        if (typeof bl.gram !== 'number' || !(bl.gram > 0)) return hata('Tarif ' + tn + ': bileşen miktarı geçersiz.');
      }
      if (typeof tr.toplam_g !== 'number' || !(tr.toplam_g > 0)) return hata('Tarif ' + tn + ': toplam ağırlık geçersiz.');
    }
    /* Favori öğünler */
    var fids = {};
    for (i = 0; i < d.favoriOgunler.length; i++) {
      var fo = d.favoriOgunler[i], fn = i + 1;
      if (!fo || typeof fo.id !== 'string' || !fo.id) return hata('Favori öğün ' + fn + ': kimlik eksik.');
      if (fids[fo.id]) return hata('Favori öğün ' + fn + ': aynı kimlik iki kez var.');
      fids[fo.id] = 1;
      if (typeof fo.ad !== 'string' || !fo.ad.trim()) return hata('Favori öğün ' + fn + ': ad eksik.');
      if (!Array.isArray(fo.kalemler) || !fo.kalemler.length) return hata('Favori öğün ' + fn + ': besin listesi boş.');
      for (var ki = 0; ki < fo.kalemler.length; ki++) {
        var kl = fo.kalemler[ki];
        if (!kl || typeof kl.besin_id !== 'string' || !kl.besin_id) return hata('Favori öğün ' + fn + ': besin eksik.');
        if (typeof kl.miktar_g !== 'number' || !(kl.miktar_g > 0)) return hata('Favori öğün ' + fn + ': miktar geçersiz.');
      }
    }
    /* Su kayıtları */
    var sids = {};
    for (i = 0; i < d.suKayitlari.length; i++) {
      var su = d.suKayitlari[i], sn = i + 1;
      if (!su || typeof su.id !== 'string' || !su.id) return hata('Su kaydı ' + sn + ': kimlik eksik.');
      if (sids[su.id]) return hata('Su kaydı ' + sn + ': aynı kimlik iki kez var.');
      sids[su.id] = 1;
      if (!gecerliTarih(su.tarih)) return hata('Su kaydı ' + sn + ': geçersiz tarih.');
      if (typeof su.ml !== 'number' || !isFinite(su.ml) || su.ml <= 0) return hata('Su kaydı ' + sn + ': geçersiz miktar.');
    }
    /* Kendi hareketler */
    var hids = {};
    for (i = 0; i < d.ozelHareketler.length; i++) {
      var hr = d.ozelHareketler[i], hn = i + 1;
      if (!hr || typeof hr.id !== 'string' || !hr.id) return hata('Kendi hareket ' + hn + ': kimlik eksik.');
      if (hids[hr.id]) return hata('Kendi hareket ' + hn + ': aynı kimlik iki kez var.');
      hids[hr.id] = 1;
      if (typeof hr.ad !== 'string' || !hr.ad.trim()) return hata('Kendi hareket ' + hn + ': ad eksik.');
    }
    /* Setler ortak biçim: [{tekrar, agirlik_kg?, dinlenme_sn?}] — ağırlık/dinlenme isteğe bağlı, tekrar zorunlu */
    function setlerGecerliMi(setler) {
      if (!Array.isArray(setler) || !setler.length) return false;
      return setler.every(function (s) {
        if (!s || typeof s.tekrar !== 'number' || !(s.tekrar > 0)) return false;
        if (s.agirlik_kg != null && (typeof s.agirlik_kg !== 'number' || s.agirlik_kg < 0)) return false;
        if (s.dinlenme_sn != null && (typeof s.dinlenme_sn !== 'number' || s.dinlenme_sn < 0)) return false;
        return true;
      });
    }
    /* Antrenman günlüğü */
    var aids = {};
    for (i = 0; i < d.antrenmanGunlugu.length; i++) {
      var an = d.antrenmanGunlugu[i], an_n = i + 1;
      if (!an || typeof an.id !== 'string' || !an.id) return hata('Antrenman kaydı ' + an_n + ': kimlik eksik.');
      if (aids[an.id]) return hata('Antrenman kaydı ' + an_n + ': aynı kimlik iki kez var.');
      aids[an.id] = 1;
      if (!gecerliTarih(an.tarih)) return hata('Antrenman kaydı ' + an_n + ': geçersiz tarih.');
      if (typeof an.hareket_id !== 'string' || !an.hareket_id) return hata('Antrenman kaydı ' + an_n + ': hareket eksik.');
      if (!setlerGecerliMi(an.setler)) return hata('Antrenman kaydı ' + an_n + ': set listesi geçersiz (en az bir set, her sette pozitif tekrar sayısı gerekir).');
    }
    /* Favori antrenmanlar */
    var faids = {};
    for (i = 0; i < d.favoriAntrenmanlar.length; i++) {
      var fa = d.favoriAntrenmanlar[i], fa_n = i + 1;
      if (!fa || typeof fa.id !== 'string' || !fa.id) return hata('Favori antrenman ' + fa_n + ': kimlik eksik.');
      if (faids[fa.id]) return hata('Favori antrenman ' + fa_n + ': aynı kimlik iki kez var.');
      faids[fa.id] = 1;
      if (typeof fa.ad !== 'string' || !fa.ad.trim()) return hata('Favori antrenman ' + fa_n + ': ad eksik.');
      if (!Array.isArray(fa.hareketler) || !fa.hareketler.length) return hata('Favori antrenman ' + fa_n + ': hareket listesi boş.');
      for (var hi = 0; hi < fa.hareketler.length; hi++) {
        var hl = fa.hareketler[hi];
        if (!hl || typeof hl.hareket_id !== 'string' || !hl.hareket_id) return hata('Favori antrenman ' + fa_n + ': hareket eksik.');
        if (!setlerGecerliMi(hl.setler)) return hata('Favori antrenman ' + fa_n + ': set listesi geçersiz.');
      }
    }
    /* Gün tamamlama: anahtar tarihin kendisi (id), yinelenen tarih olamaz */
    var gtids = {};
    for (i = 0; i < d.gunTamamlamalar.length; i++) {
      var gt = d.gunTamamlamalar[i], gt_n = i + 1;
      if (!gt || typeof gt.id !== 'string' || !gecerliTarih(gt.id)) return hata('Gün tamamlama ' + gt_n + ': geçersiz tarih.');
      if (gtids[gt.id]) return hata('Gün tamamlama ' + gt_n + ': aynı tarih iki kez var.');
      gtids[gt.id] = 1;
      if (gt.tamamlandi !== true) return hata('Gün tamamlama ' + gt_n + ': geçersiz durum.');
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
