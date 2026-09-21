/* Depolama modülü: IndexedDB (kalıcı). IndexedDB açılamazsa bellekte çalışır ve uyarı verir.
   Şema sürümü değişirse onupgradeneeded içine göç (migration) eklenmelidir. */
(function (root) {
  var DB_NAME = 'besin-takip';
  /* Sürüm 2: 'log' deposu (öğün kayıtları) eklendi.
     Sürüm 3: 'log' deposunda eksik kalabilen 'tarih' dizini onarılır (v2'de depo dizinsiz oluşmuş olabilir).
     Açılışta eksik depo VE eksik dizin tamamlanır; mevcut kayıtlara dokunulmaz. */
  var SCHEMA_VERSION = 3;
  var STORES = { settings: 'key', favorites: 'id', recents: 'id', log: 'id' };
  var INDEXES = { log: { tarih: 'tarih' } }; /* depo -> { dizin adı: anahtar yolu } */

  var db = null;
  var memory = { settings: {}, favorites: {}, recents: {}, log: {} };
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
      return Promise.all([all('settings'), all('favorites'), all('recents'), all('log')]).then(function (r) {
        return { settings: r[0], favorites: r[1], recents: r[2], log: r[3] };
      });
    },
    tumLog: function () { return all('log'); },
    degistirHepsini: function (v) {
      var map = { settings: v.settings || [], favorites: v.favorites || [], recents: v.recents || [], log: v.log || [] };
      var adlar = Object.keys(STORES);
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
    putLog: function (kayit) { return put('log', kayit); },
    deleteLog: function (id) { return del('log', id); },
    listLogByDate: function (tarih) {
      function sug(liste) { return liste.filter(function (e) { return e.tarih === tarih; }); }
      if (!kalici) {
        return Promise.resolve(sug(Object.keys(memory.log).map(function (k) { return memory.log[k]; })));
      }
      /* Dizin beklenmedik şekilde yoksa sayfayı çökertme: tüm kayıtları okuyup süz. */
      return tx('log', 'readonly', function (s) {
        return s.indexNames.contains('tarih') ? s.index('tarih').getAll(tarih) : s.getAll();
      }).then(function (r) { return sug(r || []); });
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
