/* Servis çalışanı: uygulamayı çevrimdışı/ana ekrana eklenebilir yapar (PWA).
   Yalnızca statik kod dosyalarını önbelleğe alır — kullanıcı verisi (IndexedDB)
   bu dosyanın kapsamı dışındadır, hiçbir zaman buradan geçmez veya gönderilmez.
   Sürüm değiştikçe CACHE_ADI güncellenmeli (besin-takip.html'deki ?v= ile birlikte). */
var CACHE_ADI = 'besin-takip-v0.13.1';
var ONBELLEGE_ALINACAKLAR = [
  './index.html',
  './besin-takip.html',
  './css/style.css',
  './js/nutrients.js',
  './js/calc.js',
  './js/storage.js',
  './js/foods-data.js',
  './js/foods.js',
  './js/exercises-data.js',
  './js/exercises.js',
  './js/rda.js',
  './js/backup.js',
  './js/charts.js',
  './js/ui.js',
  './lib/chart.umd.min.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png'
];

self.addEventListener('install', function (e) {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_ADI).then(function (cache) {
      return cache.addAll(ONBELLEGE_ALINACAKLAR);
    })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (isimler) {
      return Promise.all(isimler.filter(function (ad) { return ad !== CACHE_ADI; }).map(function (ad) { return caches.delete(ad); }));
    }).then(function () { return self.clients.claim(); })
  );
});

/* Sayfa gezintisi: önce ağ dene (güncel sürüm gelsin), olmazsa önbellekten aç.
   Diğer statik dosyalar: önce önbellek (hızlı), arka planda ağdan tazele. */
self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  var url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return; /* Open Food Facts / Gemini gibi dış istekleri asla önbelleğe alma */

  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request).catch(function () {
        return caches.match('./besin-takip.html');
      })
    );
    return;
  }

  e.respondWith(
    caches.match(e.request).then(function (onbellekYaniti) {
      var agdanGetir = fetch(e.request).then(function (yanit) {
        if (yanit && yanit.ok) {
          var kopya = yanit.clone();
          caches.open(CACHE_ADI).then(function (cache) { cache.put(e.request, kopya); });
        }
        return yanit;
      }).catch(function () { return onbellekYaniti; });
      return onbellekYaniti || agdanGetir;
    })
  );
});
