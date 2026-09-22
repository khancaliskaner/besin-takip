/* Depolama modülü: IndexedDB (kalıcı). IndexedDB açılamazsa bellekte çalışır ve uyarı verir.
   Şema sürümü değişirse onupgradeneeded içine göç (migration) eklenmelidir. */
(function (root) {
  var DB_NAME = 'besin-takip';
  /* Sürüm 2: 'log' deposu (öğün kayıtları) eklendi.
     Sürüm 3: 'log' deposunda eksik kalabilen 'tarih' dizini onarılır (v2'de depo dizinsiz oluşmuş olabilir).
     Sürüm 4: kullanıcının kendi besinleri, tarifleri ve favori öğünleri için üç yeni depo.
     Sürüm 5: su kayıtları, hareket veritabanı (kendi hareketler), antrenman günlüğü, favori antrenmanlar.
     Sürüm 6: gün tamamlama işaretleri ('gunTamamlamalar' — kayıt anahtarı tarihin kendisi, ayrı dizin gerekmez).
     Sürüm 7: kilo takibi ('kiloKayitlari' — kayıt anahtarı tarihin kendisi; günde bir ölçüm, tekrar
       kaydedilince üzerine yazılır).
     Sürüm 8: aralıklı oruç geçmişi ('orucGecmisi'). Aktif oruç oturumu ayrı depo gerektirmez,
       'settings' içinde 'orucAktif' anahtarıyla tutulur.
     Açılışta eksik depo VE eksik dizin tamamlanır; mevcut kayıtlara dokunulmaz. */
  var SCHEMA_VERSION = 8;
  var STORES = { settings: 'key', favorites: 'id', recents: 'id', log: 'id',
                 ozelBesinler: 'id', tarifler: 'id', favoriOgunler: 'id',
                 suKayitlari: 'id', ozelHareketler: 'id', antrenmanGunlugu: 'id', favoriAntrenmanlar: 'id',
                 gunTamamlamalar: 'id', kiloKayitlari: 'id', orucGecmisi: 'id' };
  var INDEXES = { log: { tarih: 'tarih' }, suKayitlari: { tarih: 'tarih' }, antrenmanGunlugu: { tarih: 'tarih' } };

  var db = null;
  var memory = { settings: {}, favorites: {}, recents: {}, log: {}, ozelBesinler: {}, tarifler: {}, favoriOgunler: {},
                 suKayitlari: {}, ozelHareketler: {}, antrenmanGunlugu: {}, favoriAntrenmanlar: {}, gunTamamlamalar: {},
                 kiloKayitlari: {}, orucGecmisi: {} };
  var kalici = false;
  var sonHata = null;

  function open() {
    return new Promise(function (tamam) {
      /* IndexedDB bazı ortamlarda (engelli depolama, gizli mod) ne başarı ne hata döndürür: 3 sn sonra bellek moduna düş. */
      var bitti = false;
      var zaman = root.setTimeout(function () { resolve(false); }, 3000);
      function resolve(ok) { if (bitti) return; bitti = true; root.clearTimeout(zaman); tamam(ok); }
      if (!root.indexedDB) return resolve(false);
      var req;
      try { req = root.indexedDB.open(DB_NAME, SCHEMA_VERSION); } catch (e) { return resolve(false); }
      req.onupgradeneeded = function (ev) {
        var d = ev.target.result, upgradeTx = ev.target.transaction;
        Object.keys(STORES).forEach(function (name) {
          /* Depo yoksa oluştur, varsa yükseltme işlemi üzerinden aç (kayıtlar korunur). */
          var os = d.objectStoreNames.contains(name)
            ? upgradeTx.objectStore(name)
            : d.createObjectStore(name, { keyPath: STORES[name] });
          var dizinler = INDEXES[name] || {};
          Object.keys(dizinler).forEach(function (dz) {
            if (!os.indexNames.contains(dz)) os.createIndex(dz, dizinler[dz]); /* mevcut kayıtlar otomatik indekslenir */
          });
        });
      };
      req.onsuccess = function () {
        var baglanti = req.result;
        if (bitti) { baglanti.close(); return; } /* zaman aşımından sonra geldi: bellek modunda kal */
        if (db && db !== baglanti) { try { db.close(); } catch (e) { /* yok say */ } } /* önceki bağlantıyı bırak */
        db = baglanti; kalici = true;
        /* Başka bir sekme yeni sürüme yükseltmek isterse bu bağlantıyı bırak, yoksa orası engellenir.
           Kapatılacak bağlantıyı closure'dan al: 'db' o sırada başka bir bağlantıyı gösteriyor olabilir. */
        baglanti.onversionchange = function () {
          baglanti.close();
          if (db === baglanti) { db = null; kalici = false; }
          sonHata = 'Program başka bir sekmede güncellendi. Bu sekmeyi yenileyin.';
          if (typeof root.__depoKapandi === 'function') root.__depoKapandi();
        };
        resolve(true);
      };
      req.onerror = function () { sonHata = (req.error && req.error.message) || 'Veritabanı açılamadı.'; resolve(false); };
      /* Başka bir sekme eski sürümü açık tutuyorsa yükseltme engellenir. */
      req.onblocked = function () {
        sonHata = 'Programın başka bir sekmesi açık olduğu için veritabanı güncellenemedi. Diğer "Besin Takip" sekmelerini kapatıp bu sayfayı yenileyin.';
        resolve(false);
      };
    });
  }

  function tx(store, mode, fn) {
    return new Promise(function (resolve, reject) {
      /* Bazı ortamlarda işlem hiç sonuçlanmaz; sayfa sonsuza dek boş kalmasın. */
      var zaman = root.setTimeout(function () { reject(new Error('Depolama yanıt vermedi (' + store + ').')); }, 8000);
      var t = db.transaction(store, mode);
      var s = t.objectStore(store);
      var r = fn(s);
      t.oncomplete = function () { root.clearTimeout(zaman); resolve(r && r.result); };
      t.onerror = t.onabort = function () { root.clearTimeout(zaman); reject(t.error); };
    });
  }

  function put(store, obj) {
    if (!kalici) { memory[store][obj[STORES[store]]] = obj; return Promise.resolve(); }
    return tx(store, 'readwrite', function (s) { return s.put(obj); });
  }
  function del(store, id) {
    if (!kalici) { delete memory[store][id]; return Promise.resolve(); }
    return tx(store, 'readwrite', function (s) { return s.delete(id); });
  }
  function all(store) {
    if (!kalici) return Promise.resolve(Object.keys(memory[store]).map(function (k) { return memory[store][k]; }));
    return tx(store, 'readonly', function (s) { return s.getAll(); });
  }

  root.Storage = {
    SCHEMA_VERSION: SCHEMA_VERSION,
    open: open,
    get kalici() { return kalici; },
    get sonHata() { return sonHata; },

    getSetting: function (key, varsayilan) {
      if (!kalici) return Promise.resolve(key in memory.settings ? memory.settings[key].value : varsayilan);
      return tx('settings', 'readonly', function (s) { return s.get(key); })
        .then(function (r) { return r ? r.value : varsayilan; });
    },
    setSetting: function (key, value) { return put('settings', { key: key, value: value }); },

    listFavorites: function () { return all('favorites').then(function (a) { return a.map(function (x) { return x.id; }); }); },
    addFavorite: function (id) { return put('favorites', { id: id }); },
    removeFavorite: function (id) { return del('favorites', id); },

    /* En yeni önce, en fazla 30 kayıt */
    listRecents: function () {
      return all('recents').then(function (a) {
        return a.sort(function (x, y) { return y.ts - x.ts; }).slice(0, 30).map(function (x) { return x.id; });
      });
    },
    touchRecent: function (id) { return put('recents', { id: id, ts: Date.now() }); },

    /* Yedek: tüm depoları okur / tek işlemde (atomik) topluca değiştirir. Hata olursa hiçbir şey değişmez. */
    exportParcalari: function () {
      var adlar = Object.keys(STORES);
      return Promise.all(adlar.map(all)).then(function (r) {
        var o = {};
        adlar.forEach(function (n, i) { o[n] = r[i]; });
        return o;
      });
    },
    tumLog: function () { return all('log'); },
    degistirHepsini: function (v) {
      var adlar = Object.keys(STORES);
      var map = {};
      adlar.forEach(function (n) { map[n] = Array.isArray(v[n]) ? v[n] : []; });
      if (!kalici) {
        adlar.forEach(function (n) { memory[n] = {}; map[n].forEach(function (o) { memory[n][o[STORES[n]]] = o; }); });
        return Promise.resolve();
      }
      return new Promise(function (res, rej) {
        var t = db.transaction(adlar, 'readwrite');
        adlar.forEach(function (n) { var s = t.objectStore(n); s.clear(); map[n].forEach(function (o) { s.put(o); }); });
        t.oncomplete = function () { res(); };
        t.onerror = t.onabort = function () { rej(t.error); };
      });
    },

    /* Öğün kayıtları: {id, tarih 'YYYY-MM-DD', ogun, besin_id, miktar_g, saat?, not?} */
    /* Kullanıcının kendi besinleri: {id, ad, kategori, porsiyonlar[], degerler{}, kaynak:'kullanıcı'} */
    listOzelBesin: function () { return all('ozelBesinler'); },
    putOzelBesin: function (b) { return put('ozelBesinler', b); },
    deleteOzelBesin: function (id) { return del('ozelBesinler', id); },

    /* Tarifler: {id, ad, bilesenler:[{besin_id, gram}], toplam_g, porsiyonlar[]} */
    listTarif: function () { return all('tarifler'); },
    putTarif: function (t) { return put('tarifler', t); },
    deleteTarif: function (id) { return del('tarifler', id); },

    /* Favori öğünler: {id, ad, ogun, kalemler:[{besin_id, miktar_g}]} */
    listFavoriOgun: function () { return all('favoriOgunler'); },
    putFavoriOgun: function (f) { return put('favoriOgunler', f); },
    deleteFavoriOgun: function (id) { return del('favoriOgunler', id); },

    putLog: function (kayit) { return put('log', kayit); },
    deleteLog: function (id) { return del('log', id); },
    listLogByDate: function (tarih) { return byDate('log', tarih); },

    /* Su kayıtları: {id, tarih, ml, saat} */
    putSu: function (kayit) { return put('suKayitlari', kayit); },
    deleteSu: function (id) { return del('suKayitlari', id); },
    listSuByDate: function (tarih) { return byDate('suKayitlari', tarih); },

    /* Kullanıcının kendi hareketleri: {id, ad, kategori} */
    listOzelHareket: function () { return all('ozelHareketler'); },
    putOzelHareket: function (h) { return put('ozelHareketler', h); },
    deleteOzelHareket: function (id) { return del('ozelHareketler', id); },

    /* Antrenman günlüğü: {id, tarih, hareket_id, setler:[{tekrar, agirlik_kg?, dinlenme_sn?}], saat?, not?} */
    putAntrenman: function (kayit) { return put('antrenmanGunlugu', kayit); },
    deleteAntrenman: function (id) { return del('antrenmanGunlugu', id); },
    listAntrenmanByDate: function (tarih) { return byDate('antrenmanGunlugu', tarih); },
    tumAntrenman: function () { return all('antrenmanGunlugu'); },

    /* Favori antrenmanlar: {id, ad, hareketler:[{hareket_id, setler:[{tekrar, agirlik_kg?, dinlenme_sn?}]}]} */
    listFavoriAntrenman: function () { return all('favoriAntrenmanlar'); },
    putFavoriAntrenman: function (f) { return put('favoriAntrenmanlar', f); },
    deleteFavoriAntrenman: function (id) { return del('favoriAntrenmanlar', id); },

    /* Gün tamamlama: {id: tarih, tamamlandi: true, zaman}. Anahtar tarihin kendisi olduğu için
       ayrı dizine gerek yok; tek günün durumu doğrudan anahtarla okunur. */
    listTamamlananGunler: function () { return all('gunTamamlamalar'); },
    gunTamamlandiMi: function (tarih) {
      if (!kalici) return Promise.resolve(!!memory.gunTamamlamalar[tarih]);
      return tx('gunTamamlamalar', 'readonly', function (s) { return s.get(tarih); }).then(function (r) { return !!r; });
    },
    gunTamamlaIsaretle: function (tarih) { return put('gunTamamlamalar', { id: tarih, tamamlandi: true, zaman: new Date().toISOString() }); },
    gunTamamlaKaldir: function (tarih) { return del('gunTamamlamalar', tarih); },

    /* Kilo takibi: {id: tarih, kilo_kg, zaman}. Günde bir ölçüm; aynı gün tekrar kaydedilirse üzerine yazılır. */
    listKilo: function () { return all('kiloKayitlari'); },
    kiloOku: function (tarih) {
      if (!kalici) return Promise.resolve(memory.kiloKayitlari[tarih] || null);
      return tx('kiloKayitlari', 'readonly', function (s) { return s.get(tarih); }).then(function (r) { return r || null; });
    },
    kiloKaydet: function (tarih, kiloKg) { return put('kiloKayitlari', { id: tarih, kilo_kg: kiloKg, zaman: new Date().toISOString() }); },
    kiloSil: function (tarih) { return del('kiloKayitlari', tarih); },

    /* Haftalık rapor için: bir haftalık aralıktaki tüm su kayıtlarını okumak yerine tüm depoyu okuyup
       arayüzde tarihe göre süzmek daha basit (log/tumLog ile aynı desen). */
    tumSu: function () { return all('suKayitlari'); },

    /* Aralıklı oruç: aktif oturum settings['orucAktif'] = {baslangic, hedef_saat} | null.
       Geçmiş: {id, baslangic, bitis, hedef_saat, sure_dk}. */
    orucAktifOku: function () { return this.getSetting('orucAktif', null); },
    orucBaslat: function (hedefSaat) { return this.setSetting('orucAktif', { baslangic: new Date().toISOString(), hedef_saat: hedefSaat }); },
    orucBitir: function (kayit) {
      return del('settings', 'orucAktif').then(function () {
        return put('orucGecmisi', kayit);
      });
    },
    orucIptal: function () { return del('settings', 'orucAktif'); },
    listOrucGecmisi: function () { return all('orucGecmisi'); },
    orucGecmisSil: function (id) { return del('orucGecmisi', id); }
  };

  /* Tarih dizinli bir depodan tek günün kayıtlarını döndürür. Dizin beklenmedik şekilde
     yoksa sayfayı çökertme: tüm kayıtları okuyup süz. */
  function byDate(store, tarih) {
    function sug(liste) { return liste.filter(function (e) { return e.tarih === tarih; }); }
    if (!kalici) {
      return Promise.resolve(sug(Object.keys(memory[store]).map(function (k) { return memory[store][k]; })));
    }
    return tx(store, 'readonly', function (s) {
      return s.indexNames.contains('tarih') ? s.index('tarih').getAll(tarih) : s.getAll();
    }).then(function (r) { return sug(r || []); });
  }
})(typeof window !== 'undefined' ? window : globalThis);
