/* Grafik modülü (Chart.js sarmalayıcısı).
   Palet: dataviz referans paleti, slot 1-3 (mavi / turuncu / deniz yeşili) — açık ve koyu mod için
   ayrı adımlar, her iki modda renk körlüğü kapılarından geçirildi (CVD ΔE 9.2 açık / 9.4 koyu).
   Açık modda slot 3 kontrastı 2.82:1 (3:1 altında) — bu yüzden her grafikte görünür değer etiketi
   ve tablo görünümü zorunludur; renk tek başına anlam taşımaz. */
(function (root) {
  var doc = root.document;
  var Calc = root.Calc;

  function css(ad, varsayilan) {
    var v = getComputedStyle(doc.documentElement).getPropertyValue(ad);
    return (v && v.trim()) || varsayilan;
  }

  /* Tema-duyarlı çizim renkleri; her çizimde yeniden okunur. */
  function renkler() {
    return {
      seri: [css('--seri-1', '#2a78d6'), css('--seri-2', '#eb6834'), css('--seri-3', '#1baf7a')],
      yuzey: css('--panel', '#ffffff'),
      izgara: css('--izgara', '#e1e0d9'),
      eksen: css('--eksen-cizgi', '#c3c2b7'),
      metin: css('--soluk', '#5b6570'),
      metinGuclu: css('--metin', '#1c2126')
    };
  }

  var ORTAK_FONT = { family: '"Segoe UI", system-ui, -apple-system, sans-serif', size: 12 };
  /* Animasyon kapalı: 10 000 kayıtta bile anında çizim, yeniden boyutlandırmada titreme yok,
     hareket duyarlılığı olan kullanıcılar için de güvenli. */
  var ANIMASYON = { animation: false, animations: { colors: false, x: false, y: false }, transitions: { active: { animation: { duration: 0 } } } };
  /* Değer etiketi eklentisi — doğrudan etiketleme.
     Yatay çubukta değer ucun sağında; sığmazsa çubuğun içine alınır (asla kırpılmaz).
     Çizgide yalnızca SON nokta etiketlenir (her noktaya sayı yazmak okunmaz). */
  var degerEtiketi = {
    id: 'degerEtiketi',
    afterDatasetsDraw: function (chart, args, opts) {
      if (!opts || !opts.etkin) return;
      var ctx = chart.ctx, alan = chart.chartArea;
      ctx.save();
      ctx.font = '600 12px ' + ORTAK_FONT.family;
      ctx.textBaseline = 'middle';
      chart.data.datasets.forEach(function (ds, di) {
        if (ds.label === 'hedef') return;
        var meta = chart.getDatasetMeta(di);
        meta.data.forEach(function (el, i) {
          var v = ds.data[i];
          if (v == null) return;
          if (opts.sadeceSon && i !== ds.data.length - 1 - sondanBosSayisi(ds.data)) return;
          var metin = opts.bicim ? opts.bicim(v) : String(v);
          var g = ctx.measureText(metin).width;
          if (opts.yatay) {
            var sagBosluk = alan.right - el.x;
            if (g + 10 <= sagBosluk) {          /* uçtan sonra sığıyor: dışarı yaz */
              ctx.fillStyle = opts.renk;
              ctx.textAlign = 'left';
              ctx.fillText(metin, el.x + 6, el.y);
            } else if (g + 14 <= el.x - alan.left) { /* çubuk içine sığıyor: içeri al */
              ctx.fillStyle = opts.icMetin;
              ctx.textAlign = 'right';
              ctx.fillText(metin, el.x - 7, el.y);
            }                                    /* hiçbiri değilse ipucu + tablo taşır */
          } else {
            ctx.fillStyle = opts.renk;
            if (el.x + g + 8 <= alan.right) {        /* sağa sığıyor */
              ctx.textAlign = 'left';
              ctx.fillText(metin, el.x + 8, el.y - 10);
            } else {                                  /* sığmıyor: noktanın soluna al */
              ctx.textAlign = 'right';
              ctx.fillText(metin, el.x - 8, el.y - 10);
            }
          }
        });
      });
      ctx.restore();
    }
  };
  /* Dizinin sonundaki boş (kayıtsız) gün sayısı — son etiket dolu noktaya konsun diye */
  function sondanBosSayisi(dizi) {
    var n = 0;
    for (var i = dizi.length - 1; i >= 0 && dizi[i] == null; i--) n++;
    return n;
  }

  var kayit = {}; /* canvas id -> Chart örneği */

  function yokEt(id) { if (kayit[id]) { kayit[id].destroy(); delete kayit[id]; } }
  function hepsiniYokEt() { Object.keys(kayit).forEach(yokEt); }

  function ipucu(r, bicim) {
    return {
      enabled: true,
      backgroundColor: r.yuzey,
      titleColor: r.metin,
      bodyColor: r.metinGuclu,
      borderColor: r.eksen,
      borderWidth: 1,
      padding: 10,
      titleFont: ORTAK_FONT,
      bodyFont: { family: ORTAK_FONT.family, size: 13, weight: '600' },
      displayColors: true,
      boxWidth: 10, boxHeight: 2, /* kutu değil, kısa çizgi anahtarı */
      callbacks: bicim
    };
  }

  /* 1) Makro dağılımı — halka. veri: {protein, karb, yag} kcal katkıları */
  function makroHalka(id, veri) {
    var r = renkler(), c = doc.getElementById(id);
    if (!c || !root.Chart) return null;
    yokEt(id);
    var toplam = veri.protein + veri.karb + veri.yag;
    kayit[id] = new root.Chart(c, {
      type: 'doughnut',
      data: {
        labels: ['Protein', 'Karbonhidrat', 'Yağ'],
        datasets: [{
          data: [veri.protein, veri.karb, veri.yag],
          backgroundColor: r.seri,
          borderColor: r.yuzey,
          borderWidth: 2, /* 2px yüzey boşluğu: dilimleri ayıran şey çerçeve değil boşluk */
          hoverOffset: 4
        }]
      },
      options: Object.assign({}, ANIMASYON, {
        responsive: true, maintainAspectRatio: false,
        cutout: '62%',
        plugins: {
          legend: { display: false }, /* kendi HTML gösterge tablomuz var */
          tooltip: ipucu(r, {
            label: function (x) {
              var pay = toplam > 0 ? Math.round(x.parsed / toplam * 100) : 0;
              return Calc.fmt(x.parsed, 'kcal') + ' kcal  (%' + pay + ')';
            }
          })
        }
      })
    });
    return kayit[id];
  }

  /* 2) Öğünlere göre kalori — yatay çubuk, tek ölçü → tek hue */
  function ogunCubuk(id, etiketler, degerler) {
    var r = renkler(), c = doc.getElementById(id);
    if (!c || !root.Chart) return null;
    yokEt(id);
    kayit[id] = new root.Chart(c, {
      type: 'bar',
      plugins: [degerEtiketi],
      data: {
        labels: etiketler,
        datasets: [{
          data: degerler,
          backgroundColor: r.seri[0],
          borderColor: r.yuzey,
          borderWidth: { top: 1, bottom: 1, left: 0, right: 0 }, /* komşu çubuklar arası yüzey boşluğu */
          maxBarThickness: 24,
          borderRadius: 4, borderSkipped: 'start' /* veri ucu yuvarlak, taban kare */
        }]
      },
      options: Object.assign({}, ANIMASYON, {
        indexAxis: 'y',
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: false }, /* tek seri: başlık zaten ne çizildiğini söylüyor */
          tooltip: ipucu(r, { label: function (x) { return Calc.fmt(x.parsed.x, 'kcal') + ' kcal'; } }),
          degerEtiketi: { etkin: true, yatay: true, renk: r.metinGuclu, icMetin: '#ffffff',
            bicim: function (v) { return Calc.fmt(v, 'kcal'); } }
        },
        scales: {
          x: {
            beginAtZero: true,
            grace: '8%', /* uç etiketine yer */
            border: { color: r.eksen },
            grid: { color: r.izgara, drawTicks: false }, /* düz kıl çizgi, kesikli değil */
            ticks: { color: r.metin, font: ORTAK_FONT, precision: 0 },
            title: { display: true, text: 'kcal', color: r.metin, font: ORTAK_FONT }
          },
          y: {
            border: { color: r.eksen },
            grid: { display: false },
            ticks: { color: r.metin, font: ORTAK_FONT }
          }
        }
      })
    });
    return kayit[id];
  }

  /* 3) Trend — çizgi + isteğe bağlı hedef referans çizgisi.
     Farklı ölçekli ölçüler (kcal / g) ASLA tek grafikte ikinci eksene konmaz; ayrı grafik çizilir. */
  function trendCizgi(id, etiketler, degerler, opts) {
    opts = opts || {};
    var r = renkler(), c = doc.getElementById(id);
    if (!c || !root.Chart) return null;
    yokEt(id);
    var renk = opts.renk || r.seri[0];
    var veri = [{
      data: degerler,
      borderColor: renk,
      backgroundColor: renk + '1a', /* ~%10 opaklık: yıkama, dolu blok değil */
      borderWidth: 2,
      tension: 0.25,
      fill: opts.dolgu !== false,
      pointRadius: 4, pointHoverRadius: 6,
      pointBackgroundColor: renk,
      pointBorderColor: r.yuzey, pointBorderWidth: 2, /* 2px yüzey halkası */
      spanGaps: true
    }];
    if (opts.hedef > 0) {
      veri.push({
        data: etiketler.map(function () { return opts.hedef; }),
        borderColor: r.metin, borderWidth: 1, pointRadius: 0, pointHitRadius: 0,
        fill: false, tension: 0, label: 'hedef'
      });
    }
    kayit[id] = new root.Chart(c, {
      plugins: [degerEtiketi],
      data: { labels: etiketler, datasets: veri.map(function (d) { return Object.assign({ type: 'line' }, d); }) },
      options: Object.assign({}, ANIMASYON, {
        responsive: true, maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false }, /* nişangâh: X'i bulmak için çizgiye isabet gerekmez */
        plugins: {
          legend: { display: false },
          degerEtiketi: { etkin: true, sadeceSon: true, renk: r.metinGuclu,
            bicim: function (v) { return Calc.fmt(v, opts.birim) + ' ' + opts.birim; } },
          tooltip: ipucu(r, {
            title: function (x) { return opts.baslikBicim ? opts.baslikBicim(x[0].label) : x[0].label; },
            label: function (x) {
              if (x.datasetIndex === 1) return 'Hedef: ' + Calc.fmt(x.parsed.y, opts.birim) + ' ' + opts.birim;
              return Calc.fmt(x.parsed.y, opts.birim) + ' ' + opts.birim;
            }
          })
        },
        scales: {
          x: {
            border: { color: r.eksen },
            grid: { display: false },
            ticks: { color: r.metin, font: ORTAK_FONT, maxRotation: 0, autoSkipPadding: 12 }
          },
          y: {
            beginAtZero: true,
            grace: '12%', /* hedef çizgisi ve uç etiketi üst kenara yapışmasın */
            border: { color: r.eksen },
            grid: { color: r.izgara, drawTicks: false },
            ticks: { color: r.metin, font: ORTAK_FONT, precision: 0 },
            title: { display: true, text: opts.birim || '', color: r.metin, font: ORTAK_FONT }
          }
        }
      })
    });
    return kayit[id];
  }

  root.Charts = {
    hazir: function () { return !!root.Chart; },
    renkler: renkler,
    makroHalka: makroHalka,
    ogunCubuk: ogunCubuk,
    trendCizgi: trendCizgi,
    yokEt: yokEt,
    hepsiniYokEt: hepsiniYokEt
  };
})(typeof window !== 'undefined' ? window : globalThis);
