/* Arayüz: yönlendirme, tema, Besinlerim sayfası (arama + ayrıntı tablosu).
   Bugün / Geçmiş / Grafikler / Hedefler / Ayarlar sonraki aşamalarda eklenecek. */
(function (root) {
  var doc = root.document;
  var Calc = root.Calc, Foods = root.Foods, Nutrients = root.Nutrients, Storage = root.Storage;
  var Charts = root.Charts, RDA = root.RDA, Exercises = root.Exercises;

  function h(tag, props) {
    var el = doc.createElement(tag);
    Object.keys(props || {}).forEach(function (k) {
      var v = props[k];
      if (k === 'text') el.textContent = v;
      else if (k.indexOf('on') === 0) el.addEventListener(k.slice(2), v);
      else if (v === true) el.setAttribute(k, '');
      else if (v !== false && v != null) el.setAttribute(k, v);
    });
    for (var i = 2; i < arguments.length; i++) {
      var c = arguments[i];
      if (c == null) continue;
      el.appendChild(typeof c === 'string' ? doc.createTextNode(c) : c);
    }
    return el;
  }

  var state = { q: '', kategori: '', gorunum: 'tumu', favs: new Set(), recents: [], vurgu: 'varsayilan' };
  var content = doc.getElementById('icerik');

  function uyar(msg) {
    var u = doc.getElementById('uyari');
    u.textContent = msg; u.hidden = false;
    root.clearTimeout(uyar._t);
    uyar._t = root.setTimeout(function () { u.hidden = true; }, 5000);
  }

  /* ---------- Tema ---------- */
  /* Vurgu rengi paleti: her renk için açık temada koyu ton (beyaz yazıyla ≥4.5:1 kontrast),
     koyu temada açık ton (koyu yazıyla) tanımlı; "varsayilan" CSS'teki özgün turkuazı korur. */
  var PALET = [
    { id: 'varsayilan', ad: 'Turkuaz', acik: '#0f766e', koyu: '#2dd4bf' },
    { id: 'mavi', ad: 'Mavi', acik: '#1d4ed8', koyu: '#60a5fa' },
    { id: 'lacivert', ad: 'Çivit', acik: '#4338ca', koyu: '#a5b4fc' },
    { id: 'mor', ad: 'Mor', acik: '#7e22ce', koyu: '#c084fc' },
    { id: 'gul', ad: 'Gül', acik: '#be123c', koyu: '#fb7185' },
    { id: 'turuncu', ad: 'Turuncu', acik: '#c2410c', koyu: '#fb923c' },
    { id: 'yesil', ad: 'Yeşil', acik: '#15803d', koyu: '#4ade80' },
    { id: 'gri', ad: 'Arduvaz', acik: '#475569', koyu: '#cbd5e1' }
  ];
  function paletBul(id) { return PALET.filter(function (p) { return p.id === id; })[0] || PALET[0]; }
  function vurguUygula() {
    var st = doc.documentElement.style, koyu = doc.documentElement.getAttribute('data-tema') === 'koyu';
    if (state.vurgu === 'varsayilan') {
      ['--vurgu', '--vurgu-metin', '--vurgu-acik'].forEach(function (k) { st.removeProperty(k); });
      return;
    }
    var p = paletBul(state.vurgu), renk = koyu ? p.koyu : p.acik;
    st.setProperty('--vurgu', renk);
    st.setProperty('--vurgu-metin', koyu ? '#0b1116' : '#ffffff');
    st.setProperty('--vurgu-acik', 'color-mix(in srgb, ' + renk + (koyu ? ' 20%, #1c2226)' : ' 12%, #ffffff)'));
  }

  function temaUygula(t) {
    doc.documentElement.setAttribute('data-tema', t);
    vurguUygula();
    doc.getElementById('tema-btn').textContent = t === 'koyu' ? 'Açık tema' : 'Koyu tema';
    /* Grafikler renklerini CSS değişkenlerinden okur: tema değişince yeniden çizilmeli. */
    if (aktifSayfa === 'grafikler' && root.Charts) grafiklerSayfasi();
  }
  function temaBaslat() {
    var sistem = root.matchMedia && root.matchMedia('(prefers-color-scheme: dark)').matches ? 'koyu' : 'acik';
    return Storage.getSetting('vurguRenk', 'varsayilan').then(function (v) { state.vurgu = paletBul(v).id; })
      .then(function () { return Storage.getSetting('tema', sistem); }).then(temaUygula).then(function () {
      doc.getElementById('tema-btn').addEventListener('click', function () {
        var yeni = doc.documentElement.getAttribute('data-tema') === 'koyu' ? 'acik' : 'koyu';
        temaUygula(yeni);
        Storage.setSetting('tema', yeni);
      });
    });
  }

  /* ---------- Besinlerim sayfası ---------- */
  /* Kategorileri alfabetik yerine öğün akışına göre sırala: sık aranan gruplar (kahvaltılık,
     ana yemek, fast-food...) önce gelsin, atıştırmalık/takviye gibi ikincil gruplar sonda kalsın. */
  var KATEGORI_SIRA = [
    'Kahvaltılık', 'Ana yemek', 'Çorba', 'Fast-food', 'Tahıl/ekmek', 'Sebze', 'Meyve',
    'Et/tavuk/balık', 'Yumurta', 'Süt ürünleri', 'Baklagil', 'Kuruyemiş/tohum', 'Yağlar',
    'Tatlı/şekerleme', 'İçecek', 'Paketli ürün', 'Takviye', 'Tarif', 'Kendi besinim'
  ];
  function kategorilerSirali() {
    return Foods.kategoriler().slice().sort(function (a, b) {
      var ia = KATEGORI_SIRA.indexOf(a), ib = KATEGORI_SIRA.indexOf(b);
      if (ia === -1) ia = 999; if (ib === -1) ib = 999;
      return ia - ib || a.localeCompare(b, 'tr');
    });
  }

  /* Kendi besin / tarif kaydedildikten sonra listeyi tazele ve bildir */
  function besinKaydedildi(kayit) {
    if (aktifSayfa === 'besinler') besinlerSayfasi();
    uyar('"' + kayit.ad + '" kaydedildi.');
  }
  function kendiDuzenle(f) {
    if (f.tarif) {
      Storage.listTarif().then(function (liste) {
        var t = liste.filter(function (x) { return x.id === f.id; })[0];
        if (t) tarifAc(t, besinKaydedildi); else uyar('Tarif bulunamadı.');
      });
    } else {
      Storage.listOzelBesin().then(function (liste) {
        var b = liste.filter(function (x) { return x.id === f.id; })[0];
        if (b) kendiBesinAc(b, besinKaydedildi); else uyar('Besin bulunamadı.');
      });
    }
  }
  /* Silmeden önce bu besne bağlı öğün kayıtları sayılır ve kullanıcıya bildirilir. */
  function kendiSil(f) {
    Storage.tumLog().then(function (log) {
      var kullanim = log.filter(function (k) { return k.besin_id === f.id; }).length;
      var mesaj = '"' + f.ad + '" kalıcı olarak silinecek.';
      if (kullanim) {
        mesaj += '\n\nBu besin ' + kullanim + ' öğün kaydında kullanılmış. Kayıtlar silinmez ama besin ' +
                 'listede bulunamayacağı için "Bilinmeyen besin" olarak görünür ve toplamlara katılmaz.';
      }
      mesaj += '\n\nDevam edilsin mi?';
      if (!root.confirm(mesaj)) return;
      var sil = f.tarif ? Storage.deleteTarif(f.id) : Storage.deleteOzelBesin(f.id);
      sil.then(besinListesiniTazele).then(function () {
        if (aktifSayfa === 'besinler') besinlerSayfasi();
        uyar('"' + f.ad + '" silindi.');
      });
    });
  }

  function gorunenBesinler() {
    var opts = { kategori: state.kategori };
    if (state.gorunum === 'fav') opts.idSet = state.favs;
    if (state.gorunum === 'son') opts.idSet = new Set(state.recents);
    if (state.gorunum === 'kendi') {
      opts.idSet = new Set(Foods.ALL.filter(function (f) { return f.kendi || f.tarif; }).map(function (f) { return f.id; }));
    }
    var res = Foods.search(state.q, opts);
    if (state.gorunum === 'son' && !state.q) {
      res.sort(function (a, b) { return state.recents.indexOf(a.id) - state.recents.indexOf(b.id); });
    }
    return res;
  }

  function favToggle(food, btn) {
    var acik = state.favs.has(food.id);
    if (acik) { state.favs.delete(food.id); Storage.removeFavorite(food.id); }
    else { state.favs.add(food.id); Storage.addFavorite(food.id); }
    btn.setAttribute('aria-pressed', String(!acik));
    btn.textContent = acik ? '☆' : '★';
    btn.setAttribute('aria-label', (acik ? 'Favorilere ekle: ' : 'Favorilerden çıkar: ') + food.ad);
  }

  function favButonu(food) {
    var on = state.favs.has(food.id);
    return h('button', {
      type: 'button', class: 'fav', 'aria-pressed': String(on), title: 'Favori',
      'aria-label': (on ? 'Favorilerden çıkar: ' : 'Favorilere ekle: ') + food.ad,
      text: on ? '★' : '☆',
      onclick: function (e) { e.stopPropagation(); favToggle(food, e.currentTarget); if (state.gorunum === 'fav') listeyiYenile(); }
    });
  }

  var tbody, sayac;
  function besinSatiri(f) {
    var d = f.degerler;
    return h('tr', { class: 'satir', tabindex: 0, onclick: function () { ayrintiAc(f); },
        onkeydown: function (e) { if (e.key === 'Enter') ayrintiAc(f); } },
      h('td', {}, favButonu(f)),
      h('td', { class: 'ad' }, f.ad,
        f.kendi ? h('span', { class: 'etiket kendi-etiket', text: 'kendi besinim' }) : null,
        f.tarif ? h('span', { class: 'etiket kendi-etiket', text: f.bilesenSayisi + ' bileşenli tarif' }) : null),
      h('td', {}, h('span', { class: 'etiket', text: f.kategori })),
      h('td', { class: 'sayi', text: Calc.fmt(d.kcal, 'kcal') }),
      h('td', { class: 'sayi', text: Calc.fmt(d.protein, 'g') }),
      h('td', { class: 'sayi', text: Calc.fmt(d.karb, 'g') }),
      h('td', { class: 'sayi', text: Calc.fmt(d.yag, 'g') }),
      h('td', {}, (f.kendi || f.tarif)
        ? h('span', { class: 'satir-dugme' },
            h('button', { type: 'button', class: 'ikincil kucuk', text: 'Düzenle', 'aria-label': 'Düzenle: ' + f.ad,
              onclick: function (e) { e.stopPropagation(); kendiDuzenle(f); } }),
            h('button', { type: 'button', class: 'ikincil kucuk', text: 'Sil', 'aria-label': 'Sil: ' + f.ad,
              onclick: function (e) { e.stopPropagation(); kendiSil(f); } }))
        : null));
  }

  function listeyiYenile() {
    var list = gorunenBesinler();
    tbody.textContent = '';
    if (!list.length) {
      var msg = state.gorunum === 'fav' ? 'Henüz favori besin yok. Yıldız simgesine tıklayarak ekleyebilirsiniz.'
        : state.gorunum === 'son' ? 'Henüz son kullanılan besin yok.' : 'Aramanıza uyan besin bulunamadı.';
      tbody.appendChild(h('tr', {}, h('td', { colspan: 8, class: 'bos', text: msg })));
    }
    /* Filtresiz/aramasız genel görünüm 525 besini tek alfabetik yığın hâlinde vermez, karışık olur:
       kategori başlıklarıyla grupla (kahvaltılık, ana yemek, fast-food… sırasıyla). Arama, kategori
       filtresi veya favori/son kullanılan sekmeleri açıkken sıralama zaten anlamlı, gruplama gerekmez. */
    var grupla = state.gorunum === 'tumu' && !state.q && !state.kategori;
    if (grupla) {
      var gruplar = {};
      list.forEach(function (f) { (gruplar[f.kategori] = gruplar[f.kategori] || []).push(f); });
      kategorilerSirali().forEach(function (kat) {
        if (!gruplar[kat]) return;
        tbody.appendChild(h('tr', { class: 'grup-baslik' },
          h('td', { colspan: 8, text: kat + ' (' + gruplar[kat].length + ')' })));
        gruplar[kat].forEach(function (f) { tbody.appendChild(besinSatiri(f)); });
      });
    } else {
      list.forEach(function (f) { tbody.appendChild(besinSatiri(f)); });
    }
    sayac.textContent = list.length + ' besin listeleniyor (toplam ' + Foods.ALL.length + '). Değerler 100 g başınadır.';
  }

  function besinlerSayfasi() {
    var arama = h('input', { type: 'search', placeholder: 'Besin ara… (ör. mercimek, simit, ayran)', 'aria-label': 'Besin ara', value: state.q,
      oninput: function (e) { state.q = e.target.value; listeyiYenile(); } });
    var kat = h('select', { 'aria-label': 'Kategori', onchange: function (e) { state.kategori = e.target.value; listeyiYenile(); } },
      h('option', { value: '', text: 'Tüm kategoriler' }));
    kategorilerSirali().forEach(function (k) {
      var o = h('option', { value: k, text: k }); if (k === state.kategori) o.selected = true; kat.appendChild(o);
    });
    var sekmeler = h('div', { class: 'sekmeler', role: 'group', 'aria-label': 'Görünüm' });
    var sekmeBtn = {};
    [['tumu', 'Tümü'], ['kendi', 'Kendi besinlerim'], ['fav', 'Favoriler'], ['son', 'Son kullanılanlar']].forEach(function (s) {
      sekmeBtn[s[0]] = h('button', { type: 'button', 'aria-pressed': String(state.gorunum === s[0]), text: s[1],
        onclick: function () {
          state.gorunum = s[0];
          Object.keys(sekmeBtn).forEach(function (k) { sekmeBtn[k].setAttribute('aria-pressed', String(k === s[0])); });
          listeyiYenile();
        } });
      sekmeler.appendChild(sekmeBtn[s[0]]);
    });

    tbody = h('tbody');
    sayac = h('p', { class: 'sayac' });
    var tablo = h('table', {},
      h('thead', {}, h('tr', {},
        h('th', { 'aria-label': 'Favori' }), h('th', { text: 'Besin' }), h('th', { text: 'Kategori' }),
        h('th', { class: 'sayi', text: 'kcal' }), h('th', { class: 'sayi', text: 'Protein (g)' }),
        h('th', { class: 'sayi', text: 'Karb. (g)' }), h('th', { class: 'sayi', text: 'Yağ (g)' }),
        h('th', { 'aria-label': 'İşlemler' }))),
      tbody);

    content.textContent = '';
    content.appendChild(h('h1', { text: 'Besinlerim' }));
    content.appendChild(h('p', { class: 'alt-baslik', text: 'Besin veritabanında arayın; bir satıra tıklayınca tüm besin değerleri açılır.' }));
    /* Uyarı yalnızca hazır veritabanı için geçerli: kendi besin ve tariflerin kaynağı kullanıcıdır. */
    var hazirDogrulanmamis = Foods.ALL.filter(function (f) { return !f.dogrulandi && !f.kendi && !f.tarif; }).length;
    if (hazirDogrulanmamis) {
      content.appendChild(h('p', { class: 'etiket dogrulanmamis', text: 'Hazır veritabanındaki ' + hazirDogrulanmamis + ' besinin değerleri yaklaşıktır ve henüz kaynağa (USDA / TürKomp) karşı doğrulanmamıştır.' }));
    }
    content.appendChild(h('div', { class: 'araclar' }, arama, kat, sekmeler,
      h('button', { type: 'button', text: '+ Kendi besinim', onclick: function () { kendiBesinAc(null, besinKaydedildi); } }),
      h('button', { type: 'button', class: 'ikincil', text: '+ Tarif oluştur', onclick: function () { tarifAc(null, besinKaydedildi); } }),
      h('button', { type: 'button', class: 'ikincil', text: 'Besin karşılaştır', onclick: besinKarsilastirmaPenceresi }),
      h('button', { type: 'button', class: 'ikincil', text: 'Barkod tara', onclick: barkodAra })));
    content.appendChild(h('div', { class: 'tablo-kap' }, tablo));
    content.appendChild(sayac);
    listeyiYenile();
  }


  /* ---------- Besin karşılaştırma ----------
     2-4 besini yan yana koyup 100 g başına tüm değerlerini (41 alan) karşılaştırır.
     Program sağlık/diyet önerisi vermediği için "daha iyi/kötü" gibi bir yorum eklenmez;
     yalnızca değerler yan yana gösterilir, kullanıcı kendi karşılaştırmasını yapar. */
  function besinKarsilastirmaPenceresi() {
    var dlg = doc.getElementById('secici');
    dlg.onclick = function (e) { if (e.target === dlg) dlg.close(); };
    var secililer = [];
    var q = '', kat = '';

    function ust() {
      return h('div', { class: 'd-ust' }, h('h2', { text: 'Besin karşılaştır' }),
        h('button', { type: 'button', class: 'ikincil', text: 'Kapat', onclick: function () { dlg.close(); } }));
    }

    function ciz() {
      var cipler = h('div', { class: 'su-liste' });
      secililer.forEach(function (f, i) {
        cipler.appendChild(h('span', { class: 'su-cip' }, f.ad,
          h('button', { type: 'button', class: 'su-cip-sil', 'aria-label': 'Karşılaştırmadan çıkar: ' + f.ad,
            onclick: function () { secililer.splice(i, 1); ciz(); } })));
      });

      var liste = h('div', { class: 'tablo-kap' });
      function doldur() {
        var doluMu = secililer.length >= 4;
        var res = Foods.search(q, kat ? { kategori: kat } : undefined)
          .filter(function (f) { return !secililer.some(function (s) { return s.id === f.id; }); }).slice(0, 60);
        liste.textContent = '';
        if (doluMu) { liste.appendChild(h('p', { class: 'bos', text: 'En fazla 4 besin karşılaştırılabilir. Eklemek için önce birini çıkarın.' })); return; }
        if (!res.length) { liste.appendChild(h('p', { class: 'bos', text: 'Bu kategoride/aramada besin bulunamadı.' })); return; }
        var tb = h('tbody');
        res.forEach(function (f) {
          tb.appendChild(h('tr', { class: 'satir', tabindex: 0,
            onclick: function () { secililer.push(f); ciz(); },
            onkeydown: function (ev) { if (ev.key === 'Enter') { secililer.push(f); ciz(); } } },
            h('td', { class: 'ad', text: f.ad }), h('td', {}, h('span', { class: 'etiket', text: f.kategori })),
            h('td', { class: 'sayi', text: Calc.fmt(f.degerler.kcal, 'kcal') + ' kcal/100 g' })));
        });
        liste.appendChild(h('table', {}, tb));
      }
      var arama = h('input', { type: 'search', placeholder: 'Besin ara…', 'aria-label': 'Besin ara', value: q,
        oninput: function (e) { q = e.target.value; doldur(); } });
      var katSec = h('select', { 'aria-label': 'Kategori', onchange: function (e) { kat = e.target.value; doldur(); } },
        h('option', { value: '', text: 'Tüm kategoriler' }));
      kategorilerSirali().forEach(function (k) {
        var o = h('option', { value: k, text: k }); if (k === kat) o.selected = true; katSec.appendChild(o);
      });

      dlg.textContent = '';
      dlg.appendChild(ust());
      dlg.appendChild(h('div', { class: 'd-govde' },
        h('p', { class: 'aciklama', text: 'Karşılaştırmak istediğiniz 2-4 besini seçin (100 g başına).' }),
        secililer.length ? cipler : null,
        h('div', { class: 'araclar' }, arama, katSec),
        liste,
        h('div', { class: 'araclar' },
          h('button', { type: 'button', text: 'Karşılaştır (' + secililer.length + ')', disabled: secililer.length < 2,
            onclick: function () { dlg.close(); karsilastirmaSayfasi(secililer.slice()); } }))));
      doldur();
    }
    ciz();
    if (!dlg.open) dlg.showModal();
  }

  function karsilastirmaSayfasi(besinler) {
    content.textContent = '';
    content.appendChild(h('h1', { text: 'Besin karşılaştırma' }));
    content.appendChild(h('p', { class: 'alt-baslik', text: besinler.length + ' besin, 100 g başına. "—" değeri bilinmiyor demektir (0 anlamına gelmez).' }));
    content.appendChild(h('div', { class: 'araclar' },
      h('button', { type: 'button', class: 'ikincil', text: '‹ Besinlerime dön', onclick: besinlerSayfasi })));

    var thead = h('tr', {}, h('th', { text: 'Değer' }));
    besinler.forEach(function (f) { thead.appendChild(h('th', { class: 'sayi', text: f.ad })); });
    var tb = h('tbody');
    Nutrients.GROUPS.forEach(function (grup) {
      tb.appendChild(h('tr', { class: 'grup-baslik' }, h('td', { colspan: besinler.length + 1, text: grup })));
      Nutrients.LIST.filter(function (n) { return n.g === grup; }).forEach(function (n) {
        var tr = h('tr', {}, h('td', { text: n.ad }));
        besinler.forEach(function (f) {
          var v = f.degerler[n.k];
          tr.appendChild(h('td', { class: 'sayi', text: Calc.fmt(v, n.b) + (v == null || !n.b ? '' : ' ' + n.b) }));
        });
        tb.appendChild(tr);
      });
    });
    content.appendChild(h('div', { class: 'tablo-kap' }, h('table', {}, h('thead', {}, thead), tb)));
    if (besinler.some(function (f) { return !f.dogrulandi; })) {
      content.appendChild(h('p', { class: 'not', text: 'Listedeki bazı besinlerin değerleri yaklaşıktır ve henüz doğrulanmamıştır.' }));
    }
  }

  /* ---------- Barkod tarama ----------
     Tamamen çevrimdışı çalışır: tarayıcının yerleşik BarcodeDetector'ı ile kamera
     görüntüsünden barkod okunur, kendi eklediğiniz besinler arasında aranır.
     Program 525 hazır besin için uydurma barkod içermez (kaynağı doğrulanamayan
     veri eklenmez). Barkod bulunamazsa, yalnızca kullanıcı isteyerek tıkladığında
     Open Food Facts'e (internet) tek seferlik bir sorgu gönderilir; gönderilen
     tek bilgi barkod numarasıdır, başka hiçbir veri paylaşılmaz. */

  /* Kamera + BarcodeDetector ile tarama penceresi. Bulununca veya elle girilince
     sonuc(kod) çağrılır ve pencere kapanır. Kamera/algılayıcı yoksa yalnızca elle
     giriş sunulur. */
  function barkodTaraPenceresi(sonuc) {
    var dlg = doc.getElementById('secici');
    var stream = null, dur = false;
    function kapat() { dur = true; if (stream) { stream.getTracks().forEach(function (t) { t.stop(); }); stream = null; } dlg.close(); }
    dlg.onclick = function (e) { if (e.target === dlg) kapat(); };

    var video = h('video', { autoplay: true, playsinline: true, muted: true, class: 'barkod-video' });
    var kameraDurum = h('p', { class: 'durum', role: 'status', 'aria-live': 'polite' });
    var elle = h('input', { type: 'text', inputmode: 'numeric', placeholder: 'Barkod numarasını elle girin', 'aria-label': 'Barkod (elle)' });
    function ellegonder() {
      var k = elle.value.trim();
      if (!k) { kameraDurum.textContent = 'Barkod boş olamaz.'; kameraDurum.className = 'durum hata'; return; }
      kapat(); sonuc(k);
    }

    dlg.textContent = '';
    dlg.appendChild(h('div', { class: 'd-ust' }, h('h2', { text: 'Barkod tara' }),
      h('button', { type: 'button', class: 'ikincil', text: 'Kapat', onclick: kapat })));
    dlg.appendChild(h('div', { class: 'd-govde' },
      h('p', { class: 'aciklama', text: 'Kamerayla barkodu çerçeve içine getirin, ya da numarayı elle yazın. Tarama tamamen cihazınızda yapılır; hiçbir görüntü hiçbir yere gönderilmez.' }),
      video, kameraDurum,
      h('div', { class: 'form-satir' }, h('label', { class: 'genis' }, 'Elle giriş ', elle),
        h('button', { type: 'button', text: 'Kullan', onclick: ellegonder }))));
    dlg.showModal();

    if (!root.BarcodeDetector) {
      video.hidden = true;
      kameraDurum.textContent = 'Bu tarayıcı kamera ile barkod okumayı desteklemiyor; numarayı elle girin.';
      kameraDurum.className = 'durum';
      elle.focus();
      return;
    }
    if (!(root.navigator && root.navigator.mediaDevices && root.navigator.mediaDevices.getUserMedia)) {
      video.hidden = true;
      kameraDurum.textContent = 'Kameraya erişilemiyor; numarayı elle girin.';
      kameraDurum.className = 'durum';
      elle.focus();
      return;
    }
    var detector = new root.BarcodeDetector({
      formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'qr_code']
    });
    root.navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } }).then(function (s) {
      if (dur) { s.getTracks().forEach(function (t) { t.stop(); }); return; }
      stream = s;
      video.srcObject = s;
      function dongu() {
        if (dur) return;
        detector.detect(video).then(function (barkodlar) {
          if (dur) return;
          if (barkodlar && barkodlar.length) { var kod = barkodlar[0].rawValue; kapat(); sonuc(kod); return; }
          root.requestAnimationFrame(dongu);
        }).catch(function () { if (!dur) root.requestAnimationFrame(dongu); });
      }
      dongu();
    }).catch(function (e) {
      video.hidden = true;
      kameraDurum.textContent = 'Kameraya erişilemedi (' + ((e && e.message) || 'izin verilmedi') + '); numarayı elle girin.';
      kameraDurum.className = 'durum hata';
      elle.focus();
    });
  }

  /* Open Food Facts'te tek seferlik, yalnızca barkod numarasıyla arama. Kullanıcının
     bilgisi (e-posta, ad vb.) hiçbir zaman gönderilmez. Yalnızca kullanıcı açıkça
     "İnternet gerekir" düğmesine tıkladığında çağrılır. */
  function openFoodFactsAra(kod) {
    var url = 'https://world.openfoodfacts.org/api/v2/product/' + encodeURIComponent(kod) +
      '.json?fields=product_name,nutriments,quantity';
    return root.fetch(url).then(function (r) {
      if (!r.ok) throw new Error('Sunucu yanıtı: ' + r.status);
      return r.json();
    }).then(function (data) {
      if (!data || data.status !== 1 || !data.product) return null;
      var p = data.product, n = p.nutriments || {};
      function say(v) { return (typeof v === 'number' && isFinite(v)) ? v : null; }
      return {
        ad: p.product_name || ('Ürün ' + kod),
        degerler: {
          kcal: say(n['energy-kcal_100g']),
          protein: say(n.proteins_100g),
          karb: say(n.carbohydrates_100g),
          seker: say(n.sugars_100g),
          lif: say(n.fiber_100g),
          yag: say(n.fat_100g),
          doymus: say(n['saturated-fat_100g']),
          sodyum: say(n.sodium_100g) != null ? say(n.sodium_100g) * 1000 : null,
          kolesterol: say(n.cholesterol_100g) != null ? say(n.cholesterol_100g) * 1000 : null
        }
      };
    });
  }

  /* Barkod bulunamadığında gösterilen pencere: elle "kendi besin" olarak ekle,
     ya da (isteğe bağlı) Open Food Facts'te ara. Sonuç asla otomatik kaydedilmez;
     "kendi besinim" formunda gözden geçirip kaydetmek kullanıcıya bırakılır. */
  function barkodBulunamadiPenceresi(kod) {
    var dlg = doc.getElementById('secici');
    dlg.onclick = function (e) { if (e.target === dlg) dlg.close(); };
    var durum = h('p', { class: 'durum', role: 'status', 'aria-live': 'polite' });
    dlg.textContent = '';
    dlg.appendChild(h('div', { class: 'd-ust' }, h('h2', { text: 'Barkod bulunamadı' }),
      h('button', { type: 'button', class: 'ikincil', text: 'Kapat', onclick: function () { dlg.close(); } })));
    dlg.appendChild(h('div', { class: 'd-govde' },
      h('p', { class: 'aciklama', text: 'Barkod: ' + kod + '. Bu numara kendi besinleriniz arasında kayıtlı değil.' }),
      h('div', { class: 'araclar' },
        h('button', { type: 'button', text: 'Kendi besin olarak ekle', onclick: function () {
          dlg.close(); kendiBesinAc({ id: null, ad: '', kategori: 'Kendi besinim', varsayilan_g: 100, porsiyonlar: [], degerler: {}, barkod: kod }, besinKaydedildi);
        } }),
        h('button', { type: 'button', class: 'ikincil', text: 'Open Food Facts’te ara (internet gerekir)', onclick: function () {
          durum.textContent = 'Aranıyor…'; durum.className = 'durum';
          openFoodFactsAra(kod).then(function (bulunan) {
            if (!bulunan) { durum.textContent = 'Open Food Facts’te de bulunamadı. Kendi besin olarak elle ekleyebilirsiniz.'; durum.className = 'durum hata'; return; }
            dlg.close();
            var taslak = { id: null, ad: bulunan.ad, kategori: 'Paketli ürün', varsayilan_g: 100, porsiyonlar: [], degerler: bulunan.degerler, barkod: kod };
            kendiBesinAc(taslak, besinKaydedildi);
            uyar('Open Food Facts’ten alınan değerler taslak olarak dolduruldu; kaydetmeden önce gözden geçirin.');
          }).catch(function (e) {
            durum.textContent = 'Arama başarısız: ' + ((e && e.message) || e); durum.className = 'durum hata';
          });
        } })),
      durum));
    dlg.showModal();
  }

  /* Ana giriş noktası: tara, kendi besinler arasında ara, bulunursa ayrıntısını aç. */
  function barkodAra() {
    barkodTaraPenceresi(function (kod) {
      var bulunan = Foods.barkodBul(kod);
      if (bulunan) { ayrintiAc(bulunan); return; }
      barkodBulunamadiPenceresi(kod);
    });
  }

  /* ---------- Fotoğrafla besin tanıma ----------
     Bölüm 2/6.8'deki barkod istisnasına ek, ikinci ve daha geniş bir çevrimdışı-çekirdek
     istisnası: kullanıcı kararıyla (bkz. besin-takip.md 6.9) her tanıma isteğinde çekilen
     fotoğraf, kullanıcının KENDİ API anahtarıyla doğrudan Google Gemini'ye gönderilir.
     Anahtar yalnızca bu tarayıcıda (IndexedDB) tutulur, JSON yedeğine dahil edilmez
     (bkz. js/backup.js) ve uygulama tarafından başka hiçbir yere gönderilmez. Sonuç asla
     otomatik kaydedilmez; kullanıcı her kalemi gözden geçirip miktarı/eşleşmeyi
     düzenledikten sonra "Öğüne ekle" ile onaylar. */

  var GEMINI_VARSAYILAN_MODEL = 'gemini-2.0-flash';
  var GEMINI_YEDEK_MODELLER = ['gemini-2.0-flash', 'gemini-1.5-flash'];
  var GEMINI_ZAMAN_ASIMI_MS = 45000;

  /* İstemin ana metni. Uygulamanın kendi besin listesi (kimlik|ad) eklenir: model mümkünse
     listeden birebir bir kimlik seçer, böylece doğrulanmış veritabanı değerleri kullanılır ve
     modelin kendi tahmin ettiği makrolara yalnızca listede karşılık yoksa başvurulur. */
  function fotoPromptuOlustur(not) {
    var katalog = Foods.ALL.filter(function (f) { return !f.tarif; })
      .map(function (f) { return f.id + '|' + f.ad; }).join('\n');
    return 'Bu fotoğraftaki yemek/öğünü incele ve gördüğün her ayrı besini bir JSON dizisi olarak döndür. ' +
      'Aşağıda uygulamanın besin listesi var (her satır "kimlik|ad"). Bir besinin listede birebir karşılığı ' +
      'varsa "besin_id" alanına o satırın kimliğini AYNEN yaz; uygun karşılık yoksa "besin_id" null olsun ' +
      '(kimlik UYDURMA). Alanlar: "besin_id", "ad" (kısa Türkçe ad), "tahmini_g" (fotoğraftaki porsiyonun ' +
      'tahmini gramı, sayı) ve YALNIZCA besin_id null ise "kcal_100g", "protein_100g", "karb_100g", ' +
      '"yag_100g" (100 g için tahmini değerler; emin değilsen null). Porsiyon büyüklüğünü tabak, çatal-kaşık ' +
      'gibi ölçek ipuçlarından ve varsa aşağıdaki kullanıcı notundan çıkar. Yalnızca geçerli bir JSON dizisi ' +
      'döndür, başka açıklama ekleme.' +
      (not ? '\n\nKullanıcı notu: ' + not : '') +
      '\n\nBESİN LİSTESİ:\n' + katalog;
  }

  function beklet(ms) { return new Promise(function (r) { root.setTimeout(r, ms); }); }

  function geminiHataMetni(durum, mesaj) {
    if (durum === 400 && /api key/i.test(mesaj || '')) return 'API anahtarı geçersiz görünüyor. Ayarlar sayfasından kontrol edin.';
    if (durum === 401 || durum === 403) return 'API anahtarı yetkisiz ya da bu hesap/bölgede kullanılamıyor (' + durum + ').';
    if (durum === 404) return 'Model bulunamadı. Ayarlar sayfasından model adını kontrol edin.';
    if (durum === 429) return 'İstek kotası doldu. Biraz bekleyip tekrar deneyin.';
    if (durum >= 500) return 'Gemini sunucusu şu an yanıt veremiyor (' + durum + '). Biraz sonra tekrar deneyin.';
    return mesaj || ('Sunucu yanıtı: ' + durum);
  }

  /* Tek istek: zaman aşımı + geçici hatalarda (429/500/503) en fazla 2 yeniden deneme. */
  function geminiIstek(url, govde, deneme) {
    deneme = deneme || 0;
    var ctl = root.AbortController ? new root.AbortController() : null;
    var zaman = root.setTimeout(function () { if (ctl) ctl.abort(); }, GEMINI_ZAMAN_ASIMI_MS);
    return root.fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(govde), signal: ctl ? ctl.signal : undefined })
      .then(function (r) {
        root.clearTimeout(zaman);
        if (r.ok) return r.json();
        return r.json().catch(function () { return null; }).then(function (h) {
          var hata = new Error(geminiHataMetni(r.status, h && h.error && h.error.message));
          hata.durum = r.status;
          if ((r.status === 429 || r.status === 500 || r.status === 503) && deneme < 2) {
            return beklet(2000 * (deneme + 1)).then(function () { return geminiIstek(url, govde, deneme + 1); });
          }
          throw hata;
        });
      }, function (e) {
        root.clearTimeout(zaman);
        if (e && e.name === 'AbortError') throw new Error('Zaman aşımı: Gemini ' + (GEMINI_ZAMAN_ASIMI_MS / 1000) + ' saniyede yanıt vermedi.');
        throw new Error('Ağa ulaşılamadı; internet bağlantınızı kontrol edin.');
      });
  }

  /* Model bulunamazsa (404) sıradaki yedek modele geçer. */
  function geminiModelleriDene(modeller, govde, apiAnahtari) {
    var url = 'https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(modeller[0]) +
      ':generateContent?key=' + encodeURIComponent(apiAnahtari);
    return geminiIstek(url, govde).catch(function (e) {
      if (e && e.durum === 404 && modeller.length > 1) return geminiModelleriDene(modeller.slice(1), govde, apiAnahtari);
      throw e;
    });
  }

  /* base64 görseli Gemini'ye gönderir, ayrıştırılmış besin listesini döndürür. Her kalem:
     {besin_id (geçerli DB kimliği ya da null), ad, tahmini_g, kcal_100g, protein_100g, karb_100g, yag_100g}. */
  function geminiFotoTani(base64Veri, mimeTuru, apiAnahtari, model, not) {
    var modeller = [model].concat(GEMINI_YEDEK_MODELLER).filter(function (m, i, a) { return m && a.indexOf(m) === i; });
    var govde = {
      contents: [{ parts: [{ text: fotoPromptuOlustur(not) }, { inline_data: { mime_type: mimeTuru, data: base64Veri } }] }],
      generationConfig: { responseMimeType: 'application/json', temperature: 0.2 }
    };
    return geminiModelleriDene(modeller, govde, apiAnahtari).then(function (data) {
      if (data && data.promptFeedback && data.promptFeedback.blockReason) {
        throw new Error('İstek güvenlik nedeniyle engellendi (' + data.promptFeedback.blockReason + ').');
      }
      var metin = data && data.candidates && data.candidates[0] && data.candidates[0].content &&
        data.candidates[0].content.parts && data.candidates[0].content.parts[0] && data.candidates[0].content.parts[0].text;
      if (!metin) throw new Error('Yanıt boş döndü.');
      var ayrisik;
      try { ayrisik = JSON.parse(metin); } catch (e) { throw new Error('Yanıt JSON olarak ayrıştırılamadı.'); }
      if (!Array.isArray(ayrisik)) throw new Error('Yanıt beklenen biçimde değil (dizi bekleniyor).');
      function say(v) { return (typeof v === 'number' && isFinite(v)) ? v : null; }
      return ayrisik.map(function (o) {
        o = o || {};
        var f = (typeof o.besin_id === 'string' && Foods.BY_ID[o.besin_id] && !Foods.BY_ID[o.besin_id].tarif) ? Foods.BY_ID[o.besin_id] : null;
        var ad = (typeof o.ad === 'string' && o.ad.trim()) ? o.ad.trim() : (f ? f.ad : 'Bilinmeyen besin');
        return {
          besin_id: f ? f.id : null,
          ad: f ? f.ad : ad,
          tahmini_g: say(o.tahmini_g) > 0 ? o.tahmini_g : (f ? f.varsayilan_g : 100),
          kcal_100g: f ? null : say(o.kcal_100g),
          protein_100g: f ? null : say(o.protein_100g),
          karb_100g: f ? null : say(o.karb_100g),
          yag_100g: f ? null : say(o.yag_100g)
        };
      }).filter(function (o) { return o.besin_id || o.ad !== 'Bilinmeyen besin' || o.kcal_100g != null; });
    });
  }

  /* Video/kanvastan aşağı ölçeklenmiş bir JPEG (dataURL) üretir. */
  function gorseliKüçült(kaynak, genislik, yukseklik, maksBoyut) {
    var olcek = Math.min(1, maksBoyut / Math.max(genislik, yukseklik));
    var canvas = doc.createElement('canvas');
    canvas.width = Math.max(1, Math.round(genislik * olcek));
    canvas.height = Math.max(1, Math.round(yukseklik * olcek));
    canvas.getContext('2d').drawImage(kaynak, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.85);
  }

  /* Fotoğraf çek/seç → tanı → gözden geçir → öğüne ekle penceresi.
     bitince() çağrılır ve pencere kapanır (öğün sayfası kendini tazeler). */
  function fotoTaniPenceresi(og, bitince) {
    var dlg = doc.getElementById('secici');
    var stream = null, dur = false, dataUrl = null, kullaniciNotu = '';
    function kapat() { dur = true; if (stream) { stream.getTracks().forEach(function (t) { t.stop(); }); stream = null; } dlg.close(); }
    dlg.onclick = function (e) { if (e.target === dlg) kapat(); };
    function ust(metin) {
      return h('div', { class: 'd-ust' }, h('h2', { text: metin }),
        h('button', { type: 'button', class: 'ikincil', text: 'Kapat', onclick: kapat }));
    }

    function cekimAdimi() {
      if (stream) { stream.getTracks().forEach(function (t) { t.stop(); }); stream = null; }
      var video = h('video', { autoplay: true, playsinline: true, muted: true, class: 'barkod-video' });
      var durum = h('p', { class: 'durum', role: 'status', 'aria-live': 'polite' });
      var dosyaInput = h('input', { type: 'file', accept: 'image/*', 'aria-label': 'Fotoğraf dosyası seç',
        onchange: function (e) {
          var f = e.target.files[0]; if (!f) return;
          var okuyucu = new root.FileReader();
          okuyucu.onload = function () {
            var img = new root.Image();
            img.onload = function () { dataUrl = gorseliKüçült(img, img.naturalWidth, img.naturalHeight, 1024); onizlemeAdimi(); };
            img.onerror = function () { durum.textContent = 'Görsel okunamadı.'; durum.className = 'durum hata'; };
            img.src = okuyucu.result;
          };
          okuyucu.readAsDataURL(f);
        } });
      function cek() {
        if (!stream || !video.videoWidth) { durum.textContent = 'Kamera hazır değil.'; durum.className = 'durum hata'; return; }
        dataUrl = gorseliKüçült(video, video.videoWidth, video.videoHeight, 1024);
        onizlemeAdimi();
      }
      dlg.textContent = '';
      dlg.appendChild(ust('Fotoğrafla besin tanı'));
      dlg.appendChild(h('div', { class: 'd-govde' },
        h('p', { class: 'aciklama', text: 'Öğününüzün fotoğrafını çekin ya da bir dosya seçin. Fotoğraf yalnızca tanıma için, sizin Ayarlar’da kaydettiğiniz kendi API anahtarınızla doğrudan Google Gemini’ye gönderilir; başka hiçbir yere gönderilmez, uygulama tarafından kaydedilmez.' }),
        video, durum,
        h('div', { class: 'form-satir' },
          h('button', { type: 'button', text: 'Fotoğraf çek', onclick: cek }),
          h('label', {}, 'veya dosyadan seç ', dosyaInput))));
      dlg.showModal();

      if (!(root.navigator && root.navigator.mediaDevices && root.navigator.mediaDevices.getUserMedia)) {
        video.hidden = true;
        durum.textContent = 'Kameraya erişilemiyor; dosyadan bir fotoğraf seçebilirsiniz.'; durum.className = 'durum';
        return;
      }
      root.navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } }).then(function (s) {
        if (dur) { s.getTracks().forEach(function (t) { t.stop(); }); return; }
        stream = s; video.srcObject = s;
      }).catch(function (e) {
        video.hidden = true;
        durum.textContent = 'Kameraya erişilemedi (' + ((e && e.message) || 'izin verilmedi') + '); dosyadan bir fotoğraf seçebilirsiniz.';
        durum.className = 'durum hata';
      });
    }

    function onizlemeAdimi() {
      if (stream) { stream.getTracks().forEach(function (t) { t.stop(); }); stream = null; }
      var img = h('img', { src: dataUrl, class: 'foto-onizleme', alt: 'Çekilen fotoğraf' });
      var durum = h('p', { class: 'durum', role: 'status', 'aria-live': 'polite' });
      var notInp = h('textarea', { class: 'foto-not', maxlength: '300', rows: '2', 'aria-label': 'Porsiyon notu',
        placeholder: 'Örn. 26 cm tabak, 2 kepçe pilav, tavuk yaklaşık 150 g', oninput: function (e) { kullaniciNotu = e.target.value; } });
      notInp.value = kullaniciNotu;
      var taniBtn = h('button', { type: 'button', text: 'Tanı (Gemini’ye gönder)', onclick: tani });
      var tekrarBtn = h('button', { type: 'button', class: 'ikincil', text: '‹ Yeniden çek', onclick: cekimAdimi });
      function mesgul(evet) { taniBtn.disabled = evet; tekrarBtn.disabled = evet; }
      function tani() {
        Promise.all([Storage.getSetting('geminiApiKey', null), Storage.getSetting('geminiModel', GEMINI_VARSAYILAN_MODEL)])
          .then(function (r) {
            var apiAnahtari = r[0], model = r[1] || GEMINI_VARSAYILAN_MODEL;
            if (!apiAnahtari) {
              durum.textContent = 'Önce Ayarlar sayfasında Gemini API anahtarınızı girmelisiniz.'; durum.className = 'durum hata';
              return;
            }
            mesgul(true);
            durum.textContent = 'Gemini’ye gönderiliyor… (en fazla ' + (GEMINI_ZAMAN_ASIMI_MS / 1000) + ' sn)'; durum.className = 'durum';
            var virgul = dataUrl.indexOf(',');
            var base64Veri = dataUrl.slice(virgul + 1);
            geminiFotoTani(base64Veri, 'image/jpeg', apiAnahtari, model, kullaniciNotu.trim()).then(function (kalemler) {
              if (dur) return;
              if (!kalemler.length) { mesgul(false); durum.textContent = 'Fotoğrafta besin tanınamadı. Farklı bir fotoğrafla tekrar deneyin.'; durum.className = 'durum hata'; return; }
              sonucAdimi(kalemler);
            }).catch(function (e) {
              if (dur) return;
              mesgul(false);
              durum.textContent = 'Tanıma başarısız: ' + ((e && e.message) || e); durum.className = 'durum hata';
            });
          });
      }
      dlg.textContent = '';
      dlg.appendChild(ust('Fotoğrafla besin tanı'));
      dlg.appendChild(h('div', { class: 'd-govde' }, img,
        h('label', { class: 'foto-not-etiket' }, 'İsteğe bağlı not (porsiyon/ölçek ipucu — tahmini iyileştirir)', notInp),
        durum,
        h('div', { class: 'araclar' }, taniBtn, tekrarBtn)));
    }

    function sonucAdimi(kalemler) {
      var durum = h('p', { class: 'durum', role: 'status', 'aria-live': 'polite' });
      var tb = h('tbody');
      var satirlar;
      /* kcal + protein/karbonhidrat/yağ özeti: iki satırlık hücre içeriği */
      function ozetHucresi() {
        var kcalEl = h('b'), altEl = h('span', { class: 'not' });
        return {
          eleman: h('td', { class: 'sayi foto-ozet' }, kcalEl, h('br'), altEl),
          yaz: function (v) {
            kcalEl.textContent = Calc.fmt(v.kcal, 'kcal') + ' kcal';
            altEl.textContent = 'P ' + Calc.fmt(v.protein, 'g') + ' · K ' + Calc.fmt(v.karb, 'g') + ' · Y ' + Calc.fmt(v.yag, 'g');
          }
        };
      }
      var toplamHucre = ozetHucresi();
      function toplamCiz() {
        if (!satirlar) return;
        var t = { kcal: null, protein: null, karb: null, yag: null };
        satirlar.forEach(function (s) {
          if (!s.dahil.checked) return;
          var v = s.deger();
          Object.keys(t).forEach(function (k) { if (typeof v[k] === 'number') t[k] = (t[k] || 0) + v[k]; });
        });
        toplamHucre.yaz(t);
      }

      satirlar = kalemler.map(function (k) {
        /* Öneri sırası: AI'nin listeden seçtiği kimlik önce, sonra ad aramasından gelenler. */
        var oneriler = [];
        if (k.besin_id) oneriler.push(Foods.BY_ID[k.besin_id]);
        Foods.search(k.ad).filter(function (f) { return !f.tarif && f.id !== k.besin_id; })
          .slice(0, 5).forEach(function (f) { oneriler.push(f); });
        var dahil = h('input', { type: 'checkbox', checked: true, 'aria-label': 'Öğüne dahil et: ' + k.ad, onchange: toplamCiz });
        var adInp = h('input', { type: 'text', value: k.ad, 'aria-label': 'Besin adı' });
        var gramInp = h('input', { type: 'number', min: 0, step: 'any', value: String(k.tahmini_g), 'aria-label': 'Miktar (gram)' });
        var sec = h('select', { 'aria-label': 'Veritabanı eşleşmesi' });
        oneriler.forEach(function (f) { sec.appendChild(h('option', { value: f.id, text: f.ad + ' — ' + f.kategori })); });
        sec.appendChild(h('option', { value: '', text: 'Eşleşme yok (AI tahminini kullan)', selected: !oneriler.length }));
        var porKap = h('div', { class: 'foto-porsiyon' });
        var por = null;
        var ozet = ozetHucresi();
        function deger() {
          var f = sec.value ? Foods.BY_ID[sec.value] : null;
          var d = f ? f.degerler : { kcal: k.kcal_100g, protein: k.protein_100g, karb: k.karb_100g, yag: k.yag_100g };
          return Calc.scale(d, sayi(gramInp.value) || 0);
        }
        function ciz() { ozet.yaz(deger()); toplamCiz(); }
        function porsiyonYenile() {
          var f = sec.value ? Foods.BY_ID[sec.value] : null;
          porKap.textContent = ''; por = null;
          if (f && f.porsiyonlar.length) { por = porsiyonSecici(f, gramInp, ciz); porKap.appendChild(por.eleman); }
        }
        sec.addEventListener('change', function () { porsiyonYenile(); ciz(); });
        gramInp.addEventListener('input', function () { if (por) por.sifirla(); ciz(); });
        porsiyonYenile();
        ozet.yaz(deger());
        tb.appendChild(h('tr', {},
          h('td', {}, dahil),
          h('td', {}, adInp, sec.options.length > 1 ? sec : null,
            k.besin_id ? h('p', { class: 'not', text: 'Eşleşmeyi AI, besin listenizden seçti; kontrol edin.' }) : null,
            oneriler.length ? null : h('p', { class: 'not', text: 'Eşleşme yok; eklenirse AI’nin yaklaşık değerleriyle "kendi besinim" olarak kaydedilir (doğrulanmamış).' })),
          h('td', {}, gramInp, ' g', porKap),
          ozet.eleman));
        return { dahil: dahil, adInp: adInp, gramInp: gramInp, sec: sec, kalem: k, deger: deger };
      });
      toplamCiz();

      function ekle() {
        var secilenler = satirlar.filter(function (s) { return s.dahil.checked; });
        if (!secilenler.length) { durum.textContent = 'En az bir besin seçili olmalı.'; durum.className = 'durum hata'; return; }
        var zincirle = Promise.resolve();
        secilenler.forEach(function (s) {
          zincirle = zincirle.then(function () {
            var g = sayi(s.gramInp.value);
            if (!(g > 0)) return Promise.resolve();
            var besinIdSoz;
            if (s.sec.value) {
              besinIdSoz = Promise.resolve(s.sec.value);
            } else {
              var k = s.kalem;
              var kayit = {
                id: 'k-' + yeniId(),
                ad: (s.adInp.value.trim() || k.ad) + ' (AI tahmini)',
                kategori: 'AI fotoğraf tahmini',
                varsayilan_g: g,
                porsiyonlar: [{ ad: '1 porsiyon', g: g }],
                degerler: { kcal: k.kcal_100g, protein: k.protein_100g, karb: k.karb_100g, yag: k.yag_100g },
                barkod: null,
                guncellendi: new Date().toISOString()
              };
              besinIdSoz = Storage.putOzelBesin(kayit).then(besinListesiniTazele).then(function () { return kayit.id; });
            }
            return besinIdSoz.then(function (besinId) {
              var simdi = new Date();
              var log = { id: yeniId(), tarih: gun.tarih, ogun: og, besin_id: besinId, miktar_g: g,
                saat: pad(simdi.getHours()) + ':' + pad(simdi.getMinutes()) };
              return Storage.putLog(log).then(function () { return Storage.touchRecent(besinId); });
            });
          });
        });
        zincirle.then(function () { return Storage.listRecents(); }).then(function (r) {
          state.recents = r; if (bitince) bitince();
        }).catch(function (e) { durum.textContent = 'Kaydedilemedi: ' + ((e && e.message) || e); durum.className = 'durum hata'; });
      }

      dlg.textContent = '';
      dlg.appendChild(ust('Tanınan besinler'));
      dlg.appendChild(h('div', { class: 'd-govde' },
        h('p', { class: 'aciklama', text: 'Değerler yaklaşıktır ve doğrulanmamıştır; eklemeden önce ad/miktarı düzenleyebilir veya veritabanı eşleşmesini değiştirebilirsiniz.' }),
        h('div', { class: 'tablo-kap' }, h('table', { class: 'foto-tablo' }, h('thead', {}, h('tr', {},
          h('th', { 'aria-label': 'Dahil et' }), h('th', { text: 'Besin' }), h('th', { text: 'Miktar' }), h('th', { class: 'sayi', text: 'Değerler' }))), tb,
          h('tfoot', {}, h('tr', { class: 'foto-toplam' }, h('td'), h('td', { text: 'Toplam (seçili)' }), h('td'), toplamHucre.eleman)))),
        h('div', { class: 'araclar' },
          h('button', { type: 'button', text: OGUN_AD[og] + ' öğününe ekle', onclick: ekle }),
          h('button', { type: 'button', class: 'ikincil', text: '‹ Yeniden çek', onclick: cekimAdimi })),
        durum));
    }

    cekimAdimi();
  }

  /* ---------- Besin ayrıntısı (seçilen miktar için tam değer tablosu) ---------- */
  /* Porsiyon seçici + adet çarpanı: "1 ölçek (30 g)" × 2 = 60 g.
     Katlar veri dosyasına elle yazılmaz; çarpan her besne aynı şekilde uygulanır.
     Ondalık de serbesttir (0,5 dilim gibi). Gram elle değiştirilirse seçim temizlenir. */
  function porsiyonSecici(food, miktarInput, degisti) {
    var sec = h('select', { 'aria-label': 'Porsiyon' }, h('option', { value: '', text: 'Porsiyon seç…' }));
    food.porsiyonlar.forEach(function (p, i) {
      sec.appendChild(h('option', { value: String(i), text: p.ad + ' (' + Calc.fmt(p.g, 'g') + ' g)' }));
    });
    var adet = h('input', { type: 'number', min: 0, step: 0.5, value: '1', class: 'adet', 'aria-label': 'Porsiyon adedi' });
    adet.disabled = true;
    var kap = h('span', { class: 'porsiyon-grup' }, sec,
      h('span', { class: 'carpi', 'aria-hidden': 'true', text: '×' }), adet,
      h('span', { class: 'adet-birim', text: 'adet' }));

    function uygula() {
      if (sec.value === '') return;
      var p = food.porsiyonlar[parseInt(sec.value, 10)];
      if (!p) return;
      miktarInput.value = String(Math.round(p.g * sayi(adet.value) * 100) / 100);
      degisti();
    }
    sec.addEventListener('change', function () {
      adet.disabled = sec.value === '';
      if (sec.value !== '') {
        if (!(sayi(adet.value) > 0)) adet.value = '1';
        uygula();
      }
    });
    adet.addEventListener('input', uygula);

    return {
      eleman: kap,
      /* Gram elle yazıldığında porsiyon seçimi anlamını yitirir */
      sifirla: function () { sec.value = ''; adet.value = '1'; adet.disabled = true; }
    };
  }

  function ayrintiAc(food) {
    var dlg = doc.getElementById('ayrinti');
    Storage.touchRecent(food.id).then(function () { return Storage.listRecents(); }).then(function (r) { state.recents = r; });

    var gram = food.varsayilan_g;
    var miktar = h('input', { type: 'number', min: 0, step: 'any', value: String(gram), 'aria-label': 'Miktar (gram)' });
    var porsiyon = porsiyonSecici(food, miktar, function () { ciz(); });
    var govde = h('div');

    function ciz() {
      var g = parseFloat(String(miktar.value).replace(',', '.'));
      if (!(g >= 0)) g = 0;
      var v = Calc.scale(food.degerler, g);
      govde.textContent = '';
      function kutu(k, ad, b) { return h('div', {}, h('b', { text: Calc.fmt(v[k], b) }), h('span', { text: ad + ' (' + b + ')' })); }
      govde.appendChild(h('div', { class: 'ozet' }, kutu('kcal', 'Kalori', 'kcal'), kutu('protein', 'Protein', 'g'), kutu('karb', 'Karbonhidrat', 'g'), kutu('yag', 'Yağ', 'g')));
      var tb = h('tbody');
      Nutrients.GROUPS.forEach(function (grup) {
        tb.appendChild(h('tr', { class: 'grup-baslik' }, h('td', { colspan: 3, text: grup })));
        Nutrients.LIST.filter(function (n) { return n.g === grup; }).forEach(function (n) {
          tb.appendChild(h('tr', {},
            h('td', { text: n.ad }),
            h('td', { class: 'sayi', text: Calc.fmt(v[n.k], n.b) + (v[n.k] == null || !n.b ? '' : ' ' + n.b) }),
            h('td', { class: 'sayi', text: Calc.fmt(food.degerler[n.k], n.b) + (food.degerler[n.k] == null || !n.b ? '' : ' ' + n.b) })));
        });
      });
      govde.appendChild(h('div', { class: 'tablo-kap' }, h('table', {},
        h('thead', {}, h('tr', {}, h('th', { text: 'Değer' }), h('th', { class: 'sayi', text: Calc.fmt(g, 'g') + ' g için' }), h('th', { class: 'sayi', text: '100 g için' }))), tb)));
      govde.appendChild(h('p', { class: 'not', text: '"—" değeri bilinmiyor demektir (0 anlamına gelmez). ' +
        (food.dogrulandi ? '' : 'Bu besinin değerleri yaklaşıktır ve henüz kaynağa karşı doğrulanmamıştır.') }));
    }

    miktar.addEventListener('input', function () { porsiyon.sifirla(); ciz(); });

    dlg.textContent = '';
    dlg.appendChild(h('div', { class: 'd-ust' },
      h('div', {}, h('h2', { id: 'ayrinti-baslik', text: food.ad }), h('span', { class: 'etiket', text: food.kategori })),
      h('button', { type: 'button', class: 'ikincil', text: 'Kapat', onclick: function () { dlg.close(); } })));
    dlg.appendChild(h('div', { class: 'd-govde' },
      h('div', { class: 'miktar' }, h('label', { text: 'Miktar (g): ' }, miktar), porsiyon.eleman), govde));
    ciz();
    dlg.onclick = function (e) { if (e.target === dlg) dlg.close(); };
    dlg.showModal();
  }

  /* ---------- Bugün (günlük sayfa) ---------- */
  var OGUNLER = ['kahvaltı', 'öğle', 'akşam', 'ara öğün', 'özel'];
  var OGUN_AD = { 'kahvaltı': 'Kahvaltı', 'öğle': 'Öğle yemeği', 'akşam': 'Akşam yemeği', 'ara öğün': 'Ara öğün', 'özel': 'Özel' };
  /* Varsayılan hedefler; düzenleme sayfası Aşama 6'da eklenecek. */
  var VARSAYILAN_HEDEF = { kcal: 2000, protein: 100, karb: 250, yag: 70, lif: 30, su_ml: 2000 };
  var HEDEF_AD = [['kcal', 'Kalori', 'kcal'], ['protein', 'Protein', 'g'], ['karb', 'Karbonhidrat', 'g'], ['yag', 'Yağ', 'g'], ['lif', 'Lif', 'g']];
  var gun = { tarih: null, sira: 0 };
  var orucZamanlayiciId = null; /* Bugün sayfasındaki oruç sayacının setInterval kimliği */
  var aktifSayfa = '';

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function yerelTarih(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function tarihKaydir(t, n) { var d = new Date(t + 'T12:00:00'); d.setDate(d.getDate() + n); return yerelTarih(d); }
  function tarihMetni(t) {
    return new Date(t + 'T12:00:00').toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  }
  function yeniId() { return 'k-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
  function sayi(s) { var n = parseFloat(String(s).replace(',', '.')); return n >= 0 ? n : 0; }

  /* Kayıt listesi -> {satirlar:[{kayit, food, v}], toplam, eksik}; silinmiş/bilinmeyen besinler toplama girmez. */
  function hesapla(kayitlar) {
    var satirlar = kayitlar.map(function (k) {
      var food = Foods.BY_ID[k.besin_id];
      return { kayit: k, food: food, v: food ? Calc.scale(food.degerler, k.miktar_g) : null };
    });
    var s = Calc.sum(satirlar.filter(function (r) { return r.food; }).map(function (r) { return { degerler: r.food.degerler, gram: r.kayit.miktar_g }; }));
    return { satirlar: satirlar, toplam: s.toplam, eksik: s.eksik };
  }

  function bugunSayfasi() {
    if (!gun.tarih) gun.tarih = yerelTarih(new Date());
    var sira = ++gun.sira;
    Promise.all([Storage.listLogByDate(gun.tarih), Storage.getSetting('hedefler', VARSAYILAN_HEDEF),
      Storage.listSuByDate(gun.tarih), Storage.listTamamlananGunler(), Storage.kiloOku(gun.tarih), Storage.orucAktifOku()]).then(function (r) {
      if (sira === gun.sira && aktifSayfa === 'bugun') bugunCiz(r[0], r[1], r[2], r[3], r[4], r[5]);
    }).catch(function (e) { if (aktifSayfa === 'bugun') hataGoster(e); });
  }
  function yenile() { bugunSayfasi(); }

  /* ---------- Gün çizelgesi: haftalık şerit + günü tamamlandı işaretleme ----------
     "Tamamlandı" tamamen kullanıcının kendi kararı — belirli bir hedefe ulaşma şartı aranmaz.
     Bir günü işaretlemek/kaldırmak kolayca geri alınabilir olduğu için onay istenmez. */
  var HAFTA_GUN_KISA = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];
  function haftaBaslangici(tarih) {
    var d = new Date(tarih + 'T12:00:00');
    var gunIndeksi = d.getDay(); /* 0=Pazar .. 6=Cumartesi */
    d.setDate(d.getDate() + (gunIndeksi === 0 ? -6 : 1 - gunIndeksi)); /* o haftanın Pazartesi'sine git */
    return yerelTarih(d);
  }
  function gunCizelgesi(tamamlananSet) {
    var bugun = yerelTarih(new Date());
    var baslangic = haftaBaslangici(gun.tarih);
    var satir = h('div', { class: 'gun-cizelge', role: 'group', 'aria-label': 'Hafta gün çizelgesi' });
    for (var i = 0; i < 7; i++) {
      var t = tarihKaydir(baslangic, i);
      var tamamlandi = tamamlananSet.has(t);
      var secili = t === gun.tarih;
      var bugunMu = t === bugun;
      var gunNo = String(new Date(t + 'T12:00:00').getDate());
      satir.appendChild(h('button', {
        type: 'button',
        class: 'gun-hucre' + (secili ? ' secili' : '') + (bugunMu ? ' bugun' : '') + (tamamlandi ? ' tamamlandi' : ''),
        'aria-pressed': String(secili),
        'aria-label': tarihMetni(t) + (bugunMu ? ' (bugün)' : '') + (tamamlandi ? ' — tamamlandı' : ''),
        onclick: (function (tt) { return function () { gun.tarih = tt; yenile(); }; })(t)
      },
        h('span', { class: 'gun-hucre-gun', text: HAFTA_GUN_KISA[i] }),
        h('span', { class: 'gun-hucre-no', text: gunNo }),
        tamamlandi ? h('span', { class: 'gun-hucre-tik', 'aria-hidden': 'true', text: '✓' }) : null));
    }
    return satir;
  }
  function tamamlamaDugmesi(tamamlandi) {
    return h('button', {
      type: 'button', class: 'tamamla-buton' + (tamamlandi ? ' tamamlandi' : ' ikincil'),
      'aria-pressed': String(tamamlandi),
      onclick: function () {
        (tamamlandi ? Storage.gunTamamlaKaldir(gun.tarih) : Storage.gunTamamlaIsaretle(gun.tarih)).then(yenile);
      }
    }, tamamlandi ? '✓ Gün tamamlandı' : 'Günü tamamlandı işaretle');
  }

  /* ---------- Haftalık rapor (yazdır / "PDF olarak kaydet") ----------
     Seçili günü içeren Pazartesi-Pazar haftası. window.print() tarayıcının kendi
     yazdırma diyaloğunu açar; kullanıcı orada "PDF olarak kaydet"i seçebilir —
     ayrı bir PDF kütüphanesi gerekmez, çevrimdışı çalışma kuralı bozulmaz. */
  function haftalikRaporYazdir() {
    var baslangic = haftaBaslangici(gun.tarih);
    var gunler = [];
    for (var i = 0; i < 7; i++) gunler.push(tarihKaydir(baslangic, i));
    var bitis = gunler[6];

    Promise.all([Storage.tumLog(), Storage.tumSu(), Storage.listKilo(), Storage.listTamamlananGunler()]).then(function (r) {
      var log = r[0].filter(function (k) { return k.tarih >= baslangic && k.tarih <= bitis; });
      var su = r[1].filter(function (k) { return k.tarih >= baslangic && k.tarih <= bitis; });
      var kiloMap = {}; r[2].forEach(function (k) { kiloMap[k.id] = k.kilo_kg; });
      var tamamlananSet = new Set(r[3].map(function (x) { return x.id; }));

      var satirlar = [], toplamKcalSayaci = [], toplamProteinSayaci = [];
      gunler.forEach(function (t) {
        var gunKayit = log.filter(function (k) { return k.tarih === t; });
        var hs = hesapla(gunKayit);
        var suMl = su.filter(function (k) { return k.tarih === t; }).reduce(function (a, k) { return a + k.ml; }, 0);
        if (gunKayit.length) { toplamKcalSayaci.push(hs.toplam.kcal); toplamProteinSayaci.push(hs.toplam.protein); }
        satirlar.push({
          tarih: t, kayitVar: gunKayit.length > 0,
          kcal: gunKayit.length ? hs.toplam.kcal : null, protein: gunKayit.length ? hs.toplam.protein : null,
          karb: gunKayit.length ? hs.toplam.karb : null, yag: gunKayit.length ? hs.toplam.yag : null,
          su: suMl, kilo: kiloMap[t] != null ? kiloMap[t] : null, tamamlandi: tamamlananSet.has(t)
        });
      });

      var ort = function (dizi) { return dizi.length ? dizi.reduce(function (a, b) { return a + b; }, 0) / dizi.length : null; };
      var ortKcal = ort(toplamKcalSayaci), ortProtein = ort(toplamProteinSayaci);

      var alan = doc.getElementById('yazdir-alani');
      alan.textContent = '';
      alan.appendChild(h('h1', { text: 'Haftalık rapor' }));
      alan.appendChild(h('p', { class: 'rapor-alt', text: tarihMetni(baslangic) + ' – ' + tarihMetni(bitis) +
        ' · oluşturulma: ' + new Date().toLocaleString('tr-TR') }));
      alan.appendChild(h('div', { class: 'rapor-ozet' },
        h('div', {}, h('b', { text: ortKcal != null ? Calc.fmt(ortKcal, 'kcal') + ' kcal' : '—' }), h('span', { text: 'Günlük ortalama kalori' })),
        h('div', {}, h('b', { text: ortProtein != null ? Calc.fmt(ortProtein, 'g') + ' g' : '—' }), h('span', { text: 'Günlük ortalama protein' })),
        h('div', {}, h('b', { text: String(toplamKcalSayaci.length) + ' / 7' }), h('span', { text: 'Kayıt girilen gün' })),
        h('div', {}, h('b', { text: String(satirlar.filter(function (s) { return s.tamamlandi; }).length) + ' / 7' }), h('span', { text: 'Tamamlandı işaretli gün' }))));

      var tb = h('tbody');
      satirlar.forEach(function (s) {
        tb.appendChild(h('tr', {},
          h('td', { text: tarihMetni(s.tarih) + (s.tamamlandi ? ' ✓' : '') }),
          h('td', { class: 'sayi', text: s.kcal != null ? Calc.fmt(s.kcal, 'kcal') : '—' }),
          h('td', { class: 'sayi', text: s.protein != null ? Calc.fmt(s.protein, 'g') : '—' }),
          h('td', { class: 'sayi', text: s.karb != null ? Calc.fmt(s.karb, 'g') : '—' }),
          h('td', { class: 'sayi', text: s.yag != null ? Calc.fmt(s.yag, 'g') : '—' }),
          h('td', { class: 'sayi', text: s.su > 0 ? Calc.fmt(s.su, 'ml') : '—' }),
          h('td', { class: 'sayi', text: s.kilo != null ? Calc.fmt(s.kilo, 'kg') : '—' })));
      });
      alan.appendChild(h('table', {},
        h('thead', {}, h('tr', {}, h('th', { text: 'Gün' }), h('th', { class: 'sayi', text: 'kcal' }),
          h('th', { class: 'sayi', text: 'Protein (g)' }), h('th', { class: 'sayi', text: 'Karb. (g)' }),
          h('th', { class: 'sayi', text: 'Yağ (g)' }), h('th', { class: 'sayi', text: 'Su (ml)' }), h('th', { class: 'sayi', text: 'Kilo (kg)' }))),
        tb));
      alan.appendChild(h('p', { style: 'font-size:11px;color:#777', text: '"—" değeri bilinmiyor/kayıt yok demektir. Besin Takip — kişisel kayıt aracı; sağlık/diyet önerisi içermez.' }));

      root.setTimeout(function () { root.print(); }, 50); /* içerik DOM'a yerleşsin diye kısa gecikme */
    }).catch(function (e) { uyar('Rapor oluşturulamadı: ' + ((e && e.message) || e)); });
  }

  function ilerlemeCubugu(ad, deger, hedef, birim, eksikSayisi) {
    var oran = hedef > 0 ? deger / hedef : 0;
    var asti = oran > 1;
    var yuzde = Math.round(oran * 100);
    return h('div', { class: 'ilerleme' },
      h('div', { class: 'ilerleme-ust' },
        h('span', { text: ad }),
        h('span', { class: 'sayi', text: Calc.fmt(deger, birim) + ' / ' + Calc.fmt(hedef, birim) + ' ' + birim + '  (%' + yuzde + ')' + (asti ? ' — hedef aşıldı' : '') })),
      h('div', { class: 'cubuk' + (asti ? ' asti' : ''), role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': Math.min(100, yuzde), 'aria-label': ad },
        h('div', { class: 'dolgu', style: 'width:' + Math.min(100, yuzde) + '%' })),
      eksikSayisi ? h('div', { class: 'not', text: eksikSayisi + ' kayıtta bu değer bilinmiyor; toplam eksik olabilir.' }) : null);
  }

  var SU_HIZLI = [[200, '1 bardak (200 ml)'], [330, '1 kutu (330 ml)'], [500, '1 şişe (500 ml)']];
  function suPaneli(suKayitlari, hedefMl) {
    var toplam = suKayitlari.reduce(function (a, k) { return a + k.ml; }, 0);
    function ekle(ml) {
      if (!(ml > 0)) return;
      var simdi = new Date();
      Storage.putSu({ id: yeniId(), tarih: gun.tarih, ml: ml, saat: pad(simdi.getHours()) + ':' + pad(simdi.getMinutes()) }).then(yenile);
    }
    var ozelMl = h('input', { type: 'number', min: 0, step: 'any', placeholder: 'ml', class: 'su-ozel-ml', 'aria-label': 'Özel miktar (ml)' });
    var dugmeler = h('div', { class: 'araclar' });
    SU_HIZLI.forEach(function (x) {
      dugmeler.appendChild(h('button', { type: 'button', class: 'ikincil', text: '+ ' + x[1], onclick: function () { ekle(x[0]); } }));
    });
    dugmeler.appendChild(ozelMl);
    dugmeler.appendChild(h('button', { type: 'button', class: 'ikincil', text: 'Ekle',
      onclick: function () { ekle(sayi(ozelMl.value)); ozelMl.value = ''; } }));

    var panel = h('section', { class: 'panel' }, h('h2', { text: 'Su' }), dugmeler,
      ilerlemeCubugu('Su', toplam, hedefMl, 'ml'));
    if (suKayitlari.length) {
      var liste = h('div', { class: 'su-liste' });
      suKayitlari.slice().sort(function (a, b) { return String(a.saat || '').localeCompare(String(b.saat || '')); }).forEach(function (k) {
        liste.appendChild(h('span', { class: 'su-cip' }, Calc.fmt(k.ml, 'ml') + ' ml' + (k.saat ? ' · ' + k.saat : ''),
          h('button', { type: 'button', class: 'su-cip-sil', 'aria-label': 'Su kaydını sil (' + k.ml + ' ml)',
            onclick: function () { Storage.deleteSu(k.id).then(yenile); }, text: '×' })));
      });
      panel.appendChild(liste);
    }
    return panel;
  }

  /* Günde bir ölçüm; aynı günü tekrar kaydetmek üzerine yazar (yeni depo kaydı açmaz). */
  function kiloPaneli(kiloBugun, hedefler) {
    var girdi = h('input', { type: 'number', min: 0, step: 'any', placeholder: 'kg', class: 'su-ozel-ml',
      value: kiloBugun ? String(kiloBugun.kilo_kg) : '', 'aria-label': 'Bugünkü kilo (kg)' });
    function kaydet() {
      var v = sayi(girdi.value);
      if (!(v > 0)) { uyar('Kilo sıfırdan büyük olmalı.'); return; }
      Storage.kiloKaydet(gun.tarih, v).then(yenile);
    }
    var panel = h('section', { class: 'panel' }, h('h2', { text: 'Kilo' }),
      h('div', { class: 'araclar' },
        girdi, h('span', { class: 'not', text: 'kg' }),
        h('button', { type: 'button', class: 'ikincil', text: kiloBugun ? 'Güncelle' : 'Kaydet', onclick: kaydet }),
        kiloBugun ? h('button', { type: 'button', class: 'ikincil', text: 'Sil',
          onclick: function () { Storage.kiloSil(gun.tarih).then(yenile); } }) : null));
    var hedefKilo = hedefler.hedef_kilo_kg;
    if (kiloBugun && hedefKilo > 0) {
      var fark = Math.round((kiloBugun.kilo_kg - hedefKilo) * 10) / 10;
      var metin = Math.abs(fark) < 0.05 ? 'Hedef kiloya ulaştın (' + Calc.fmt(hedefKilo, 'kg') + ' kg).'
        : (fark > 0 ? Calc.fmt(fark, 'kg') : Calc.fmt(-fark, 'kg')) + ' kg, hedefin ' + (fark > 0 ? 'üzerinde' : 'altında') +
          ' (hedef ' + Calc.fmt(hedefKilo, 'kg') + ' kg).';
      panel.appendChild(h('p', { class: 'not', text: metin }));
    }
    return panel;
  }

  /* ---------- Aralıklı oruç zamanlayıcı ----------
     "Şimdi"ye bağlı, seçili güne değil: yalnızca Bugün sayfasında ve bugün seçiliyken gösterilir.
     Aktif oturum settings['orucAktif'] içinde tutulur (tarihe bağlı bir depo değil). */
  var ORUC_HIZLI = [16, 18, 20, 23];
  function orucSuresiMetni(dk) { return Math.floor(dk / 60) + ' sa ' + pad(Math.abs(dk) % 60) + ' dk'; }
  function orucPaneli(aktif) {
    if (orucZamanlayiciId) { root.clearInterval(orucZamanlayiciId); orucZamanlayiciId = null; }
    var panel = h('section', { class: 'panel', 'aria-label': 'Aralıklı oruç' }, h('h2', { text: 'Oruç' }));

    if (!aktif) {
      var ozelSaat = h('input', { type: 'number', min: 1, max: 48, step: 1, placeholder: 'saat', class: 'su-ozel-ml', 'aria-label': 'Özel hedef süre (saat)' });
      var dugmeler = h('div', { class: 'araclar' });
      ORUC_HIZLI.forEach(function (s) {
        dugmeler.appendChild(h('button', { type: 'button', class: 'ikincil', text: s + ':' + (24 - s),
          onclick: function () { Storage.orucBaslat(s).then(yenile); } }));
      });
      dugmeler.appendChild(ozelSaat);
      dugmeler.appendChild(h('button', { type: 'button', class: 'ikincil', text: 'Başlat',
        onclick: function () {
          var v = sayi(ozelSaat.value);
          if (!(v > 0)) { uyar('Hedef süre sıfırdan büyük olmalı.'); return; }
          Storage.orucBaslat(v).then(yenile);
        } }));
      panel.appendChild(dugmeler);
      panel.appendChild(h('p', { class: 'not', text: '16:8, 18:6, 20:4 gibi yaygın düzenler veya kendi hedef sürenizi (saat) girin.' }));
      return panel;
    }

    var durumEl = h('div', {});
    function guncelle() {
      var gecenDk = Math.floor((Date.now() - new Date(aktif.baslangic).getTime()) / 60000);
      var hedefDk = aktif.hedef_saat * 60;
      var kalanDk = hedefDk - gecenDk;
      var yuzde = hedefDk > 0 ? gecenDk / hedefDk * 100 : 0;
      durumEl.textContent = '';
      durumEl.appendChild(h('p', { class: 'one-cikan-alt', text: 'Başlangıç: ' +
        new Date(aktif.baslangic).toLocaleString('tr-TR', { weekday: 'short', hour: '2-digit', minute: '2-digit' }) }));
      durumEl.appendChild(h('p', { class: 'one-cikan', text: orucSuresiMetni(gecenDk) }));
      durumEl.appendChild(h('p', { class: 'aciklama', text: kalanDk <= 0
        ? 'Hedef süre (' + aktif.hedef_saat + ' sa) tamamlandı.'
        : orucSuresiMetni(kalanDk) + ' kaldı (hedef ' + aktif.hedef_saat + ' sa).' }));
      durumEl.appendChild(h('div', { class: 'cubuk' + (yuzde > 100 ? ' asti' : ''), role: 'progressbar',
        'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': Math.min(100, Math.round(yuzde)), 'aria-label': 'Oruç ilerlemesi' },
        h('div', { class: 'dolgu', style: 'width:' + Math.min(100, yuzde) + '%' })));
    }
    guncelle();
    orucZamanlayiciId = root.setInterval(guncelle, 30000); /* saniye hassasiyeti gerekmez, 30 sn'de bir yeter */
    panel.appendChild(durumEl);
    panel.appendChild(h('div', { class: 'araclar' },
      h('button', { type: 'button', text: 'Orucu bitir', onclick: function () {
        var bitisIso = new Date().toISOString();
        var sureDk = Math.round((new Date(bitisIso).getTime() - new Date(aktif.baslangic).getTime()) / 60000);
        Storage.orucBitir({ id: yeniId(), baslangic: aktif.baslangic, bitis: bitisIso, hedef_saat: aktif.hedef_saat, sure_dk: sureDk }).then(yenile);
      } }),
      h('button', { type: 'button', class: 'ikincil', text: 'İptal et (kaydetmeden)', onclick: function () {
        if (!root.confirm('Bu oruç oturumu geçmişe kaydedilmeden iptal edilsin mi?')) return;
        Storage.orucIptal().then(yenile);
      } })));
    return panel;
  }

  /* Sağ üstteki renk paleti düğmesi + açılır renk seçici. Seçim 'vurguRenk' ayarında kalıcıdır. */
  function paletKontrolu() {
    var acilir = h('div', { class: 'palet-acilir', role: 'group', 'aria-label': 'Vurgu rengi', hidden: true });
    var dugme = h('button', { type: 'button', class: 'ikincil palet-dugme', 'aria-label': 'Renk paleti', 'aria-expanded': 'false', title: 'Renk paleti' });
    var kap = h('div', { class: 'palet-kap' }, dugme, acilir);
    function kapat() { acilir.hidden = true; dugme.setAttribute('aria-expanded', 'false'); doc.removeEventListener('click', disTik, true); doc.removeEventListener('keydown', tus, true); }
    function disTik(e) { if (!kap.contains(e.target)) kapat(); }
    function tus(e) { if (e.key === 'Escape') { kapat(); dugme.focus(); } }
    function renkleriCiz() {
      var koyu = doc.documentElement.getAttribute('data-tema') === 'koyu';
      acilir.textContent = '';
      PALET.forEach(function (p) {
        acilir.appendChild(h('button', { type: 'button', class: 'palet-renk', 'aria-label': p.ad, title: p.ad,
          'aria-pressed': String(state.vurgu === p.id), style: 'background:' + (koyu ? p.koyu : p.acik),
          onclick: function () {
            state.vurgu = p.id; vurguUygula(); Storage.setSetting('vurguRenk', p.id); renkleriCiz();
            if (aktifSayfa === 'grafikler' && root.Charts) grafiklerSayfasi();
          } }));
      });
    }
    dugme.addEventListener('click', function () {
      if (!acilir.hidden) { kapat(); return; }
      renkleriCiz(); acilir.hidden = false; dugme.setAttribute('aria-expanded', 'true');
      doc.addEventListener('click', disTik, true); doc.addEventListener('keydown', tus, true);
    });
    return kap;
  }

  function bugunCiz(kayitlar, hedefler, suKayitlari, tamamlananListe, kiloBugun, orucAktif) {
    var bugun = yerelTarih(new Date());
    var hs = hesapla(kayitlar);
    var tamamlananSet = new Set(tamamlananListe.map(function (x) { return x.id; }));
    var sayfa = h('div');

    sayfa.appendChild(h('div', { class: 'sayfa-ust' },
      h('h1', { text: gun.tarih === bugun ? 'Bugün' : tarihMetni(gun.tarih) },
        tamamlananSet.has(gun.tarih) ? h('span', { class: 'gun-tik-baslik', title: 'Gün tamamlandı', 'aria-label': 'Gün tamamlandı', text: '✓' }) : null),
      paletKontrolu()));
    sayfa.appendChild(h('p', { class: 'alt-baslik', text: gun.tarih === bugun ? tarihMetni(gun.tarih) : 'Seçili gün' }));

    var tarihGirdisi = h('input', { type: 'date', value: gun.tarih, 'aria-label': 'Tarih',
      onchange: function (e) { if (e.target.value) { gun.tarih = e.target.value; yenile(); } } });
    sayfa.appendChild(h('div', { class: 'araclar' },
      h('button', { type: 'button', class: 'ikincil', 'aria-label': 'Önceki gün', text: '‹ Önceki', onclick: function () { gun.tarih = tarihKaydir(gun.tarih, -1); yenile(); } }),
      tarihGirdisi,
      h('button', { type: 'button', class: 'ikincil', 'aria-label': 'Sonraki gün', text: 'Sonraki ›', onclick: function () { gun.tarih = tarihKaydir(gun.tarih, 1); yenile(); } }),
      gun.tarih === bugun ? null : h('button', { type: 'button', text: 'Bugüne dön', onclick: function () { gun.tarih = bugun; yenile(); } })));

    /* Gün çizelgesi: haftalık şerit + tamamlama işareti + haftalık rapor */
    sayfa.appendChild(h('div', { class: 'gun-cizelge-satir' },
      gunCizelgesi(tamamlananSet),
      h('span', { class: 'satir-dugme' },
        h('button', { type: 'button', class: 'ikincil', text: 'Haftalık raporu yazdır', onclick: haftalikRaporYazdir }),
        tamamlamaDugmesi(tamamlananSet.has(gun.tarih)))));

    /* Günlük özet */
    var ozet = h('section', { class: 'panel', 'aria-label': 'Günlük özet' }, h('h2', { text: 'Günlük özet' }));
    HEDEF_AD.forEach(function (x) {
      var hedef = hedefler[x[0]] != null ? hedefler[x[0]] : VARSAYILAN_HEDEF[x[0]];
      ozet.appendChild(ilerlemeCubugu(x[1], hs.toplam[x[0]], hedef, x[2], kayitlar.length ? hs.eksik[x[0]] : 0));
    });
    if (!kayitlar.length) ozet.appendChild(h('p', { class: 'not', text: 'Bu güne henüz besin eklenmedi.' }));
    sayfa.appendChild(ozet);

    /* Su */
    var suHedef = hedefler.su_ml != null ? hedefler.su_ml : VARSAYILAN_HEDEF.su_ml;
    sayfa.appendChild(suPaneli(suKayitlari, suHedef));

    /* Kilo */
    sayfa.appendChild(kiloPaneli(kiloBugun, hedefler));

    /* Oruç: "şimdi"ye bağlı olduğu için yalnızca bugün seçiliyken gösterilir */
    if (gun.tarih === bugun) sayfa.appendChild(orucPaneli(orucAktif));
    else if (orucZamanlayiciId) { root.clearInterval(orucZamanlayiciId); orucZamanlayiciId = null; }

    /* Öğünler */
    OGUNLER.forEach(function (og) {
      var ogKayit = kayitlar.filter(function (k) { return k.ogun === og; });
      var oh = hesapla(ogKayit);
      var tb = h('tbody');
      oh.satirlar.forEach(function (r) {
        var k = r.kayit;
        var miktar = h('input', { type: 'number', min: 0, step: 'any', value: String(k.miktar_g), 'aria-label': 'Miktar (g): ' + (r.food ? r.food.ad : 'bilinmeyen besin'),
          onchange: function (e) { var g = sayi(e.target.value); k.miktar_g = g; Storage.putLog(k).then(yenile); } });
        tb.appendChild(h('tr', {},
          h('td', { class: 'ad', text: r.food ? r.food.ad : 'Bilinmeyen besin (veritabanında yok)' }),
          h('td', {}, miktar, ' g'),
          h('td', { class: 'sayi', text: r.v ? Calc.fmt(r.v.kcal, 'kcal') : '—' }),
          h('td', { class: 'sayi', text: r.v ? Calc.fmt(r.v.protein, 'g') : '—' }),
          h('td', { class: 'sayi', text: r.v ? Calc.fmt(r.v.karb, 'g') : '—' }),
          h('td', { class: 'sayi', text: r.v ? Calc.fmt(r.v.yag, 'g') : '—' }),
          h('td', {}, h('button', { type: 'button', class: 'ikincil', text: 'Sil', 'aria-label': 'Sil: ' + (r.food ? r.food.ad : 'kayıt'),
            onclick: function () { if (root.confirm('Bu kayıt silinsin mi?')) Storage.deleteLog(k.id).then(yenile); } }))));
      });
      var panel = h('section', { class: 'panel ogun', 'aria-label': OGUN_AD[og] },
        h('div', { class: 'ogun-ust' },
          h('h2', {}, OGUN_AD[og], ' ', h('span', { class: 'kcal-etiket', text: Calc.fmt(oh.toplam.kcal, 'kcal') + ' kcal' })),
          h('div', { class: 'ogun-dugmeler' },
            ogKayit.length ? h('button', { type: 'button', class: 'ikincil', text: 'Ayrıntı', onclick: function () { ogunAyrinti(og, ogKayit); } }) : null,
            h('button', { type: 'button', class: 'ikincil', text: 'Favoriler', onclick: function () { favoriOgunAc(og, ogKayit); } }),
            h('button', { type: 'button', class: 'ikincil', text: 'Başka günden kopyala', onclick: function () { kopyalaAc(og); } }),
            h('button', { type: 'button', text: '+ Besin ekle', onclick: function () { besinSec(og); } }))));
      if (ogKayit.length) {
        panel.appendChild(h('div', { class: 'tablo-kap' }, h('table', {},
          h('thead', {}, h('tr', {}, h('th', { text: 'Besin' }), h('th', { text: 'Miktar' }), h('th', { class: 'sayi', text: 'kcal' }),
            h('th', { class: 'sayi', text: 'Protein (g)' }), h('th', { class: 'sayi', text: 'Karb. (g)' }), h('th', { class: 'sayi', text: 'Yağ (g)' }), h('th'))), tb)));
      } else {
        panel.appendChild(h('p', { class: 'not', text: 'Bu öğünde besin yok.' }));
      }
      sayfa.appendChild(panel);
    });

    content.textContent = '';
    content.appendChild(sayfa);
  }

  /* Öğün ayrıntısı: öğündeki tüm besinlerin toplam değer tablosu + hangi besin ne kadar katkı verdi */
  function ogunAyrinti(og, kayitlar) {
    var dlg = doc.getElementById('ayrinti');
    var hs = hesapla(kayitlar);
    var tb = h('tbody');
    Nutrients.GROUPS.forEach(function (grup) {
      tb.appendChild(h('tr', { class: 'grup-baslik' }, h('td', { colspan: 3, text: grup })));
      Nutrients.LIST.filter(function (n) { return n.g === grup && !n.olceklenmez; }).forEach(function (n) {
        var e = hs.eksik[n.k];
        var hepsiBilinmiyor = e >= kayitlar.length; /* hiçbir besinde veri yok: 0 değil "—" */
        tb.appendChild(h('tr', {},
          h('td', { text: n.ad }),
          h('td', { class: 'sayi', text: hepsiBilinmiyor ? '—' : Calc.fmt(hs.toplam[n.k], n.b) + (n.b ? ' ' + n.b : '') }),
          h('td', { class: 'sayi', text: hepsiBilinmiyor ? 'veri yok' : e ? e + ' besinde bilinmiyor (toplam eksik)' : '' })));
      });
    });
    var katki = h('tbody');
    hs.satirlar.forEach(function (r) {
      if (!r.v) return;
      var pay = hs.toplam.kcal > 0 ? Math.round(r.v.kcal / hs.toplam.kcal * 100) : 0;
      katki.appendChild(h('tr', {}, h('td', { class: 'ad', text: r.food.ad }), h('td', { class: 'sayi', text: Calc.fmt(r.kayit.miktar_g, 'g') + ' g' }),
        h('td', { class: 'sayi', text: Calc.fmt(r.v.kcal, 'kcal') + ' kcal' }), h('td', { class: 'sayi', text: '%' + pay })));
    });
    dlg.textContent = '';
    dlg.appendChild(h('div', { class: 'd-ust' },
      h('div', {}, h('h2', { id: 'ayrinti-baslik', text: OGUN_AD[og] + ' — ayrıntı' }), h('span', { class: 'etiket', text: tarihMetni(gun.tarih) })),
      h('button', { type: 'button', class: 'ikincil', text: 'Kapat', onclick: function () { dlg.close(); } })));
    dlg.appendChild(h('div', { class: 'd-govde' },
      h('div', { class: 'ozet' },
        h('div', {}, h('b', { text: Calc.fmt(hs.toplam.kcal, 'kcal') }), h('span', { text: 'Kalori (kcal)' })),
        h('div', {}, h('b', { text: Calc.fmt(hs.toplam.protein, 'g') }), h('span', { text: 'Protein (g)' })),
        h('div', {}, h('b', { text: Calc.fmt(hs.toplam.karb, 'g') }), h('span', { text: 'Karbonhidrat (g)' })),
        h('div', {}, h('b', { text: Calc.fmt(hs.toplam.yag, 'g') }), h('span', { text: 'Yağ (g)' }))),
      h('h3', { text: 'Besin katkıları' }),
      h('div', { class: 'tablo-kap' }, h('table', {}, katki)),
      h('h3', { text: 'Tüm değerler (toplam)' }),
      h('div', { class: 'tablo-kap' }, h('table', {}, h('thead', {}, h('tr', {}, h('th', { text: 'Değer' }), h('th', { class: 'sayi', text: 'Toplam' }), h('th', { class: 'sayi', text: 'Not' }))), tb)),
      h('p', { class: 'not', text: 'Bilinmeyen değerler toplamda 0 sayılmaz, hiç eklenmez; bu yüzden ilgili toplam eksik olabilir.' })));
    dlg.onclick = function (e) { if (e.target === dlg) dlg.close(); };
    dlg.showModal();
  }

  /* Besin ekleme penceresi: 1) ara ve seç  2) miktar gir  */
  function besinSec(og) {
    var dlg = doc.getElementById('secici');
    dlg.onclick = function (e) { if (e.target === dlg) dlg.close(); };
    var q = '', kat = '';

    function baslik(metin) {
      return h('div', { class: 'd-ust' }, h('h2', { text: metin }),
        h('button', { type: 'button', class: 'ikincil', text: 'Kapat', onclick: function () { dlg.close(); } }));
    }

    function adim1() {
      var liste = h('div', { class: 'tablo-kap' });
      var not = h('p', { class: 'not' });
      function doldur() {
        var res;
        if (q.trim() || kat) res = Foods.search(q, kat ? { kategori: kat } : undefined);
        else {
          var gor = {}, ilk = [];
          state.recents.concat(Array.from(state.favs)).forEach(function (id) { if (Foods.BY_ID[id] && !gor[id]) { gor[id] = 1; ilk.push(Foods.BY_ID[id]); } });
          res = ilk.length ? ilk : Foods.search('');
        }
        not.textContent = (q.trim() || kat) ? '' : 'Arama boşken son kullanılanlar ve favoriler gösterilir.';
        res = res.slice(0, 60);
        liste.textContent = '';
        if (!res.length) { liste.appendChild(h('p', { class: 'bos', text: 'Bu kategoride/aramada besin bulunamadı.' })); return; }
        var tb = h('tbody');
        res.forEach(function (f) {
          tb.appendChild(h('tr', { class: 'satir', tabindex: 0, onclick: function () { adim2(f); }, onkeydown: function (e) { if (e.key === 'Enter') adim2(f); } },
            h('td', { class: 'ad', text: f.ad }), h('td', {}, h('span', { class: 'etiket', text: f.kategori })),
            h('td', { class: 'sayi', text: Calc.fmt(f.degerler.kcal, 'kcal') + ' kcal/100 g' })));
        });
        liste.appendChild(h('table', {}, tb));
      }
      var arama = h('input', { type: 'search', placeholder: 'Besin ara…', 'aria-label': 'Besin ara', value: q,
        oninput: function (e) { q = e.target.value; doldur(); } });
      var katSec = h('select', { 'aria-label': 'Kategori', onchange: function (e) { kat = e.target.value; doldur(); } },
        h('option', { value: '', text: 'Tüm kategoriler' }));
      kategorilerSirali().forEach(function (k) {
        var o = h('option', { value: k, text: k }); if (k === kat) o.selected = true; katSec.appendChild(o);
      });
      var barkodBtn = h('button', { type: 'button', class: 'ikincil', text: 'Barkod tara',
        onclick: function () {
          barkodTaraPenceresi(function (kod) {
            var f = Foods.barkodBul(kod);
            if (f) { adim2(f); return; }
            adim1();
            uyar('Barkod (' + kod + ') kendi besinleriniz arasında bulunamadı. "Besinlerim" sayfasından "Barkod tara" ile ekleyebilirsiniz.');
          });
        } });
      var fotoBtn = h('button', { type: 'button', class: 'ikincil', text: 'Fotoğrafla tanı',
        onclick: function () { fotoTaniPenceresi(og, function () { dlg.close(); yenile(); }); } });
      dlg.textContent = '';
      dlg.appendChild(baslik(OGUN_AD[og] + ' — besin ekle'));
      dlg.appendChild(h('div', { class: 'd-govde' }, h('div', { class: 'araclar' }, arama, katSec, barkodBtn, fotoBtn), not, liste));
      doldur();
      arama.focus();
    }

    function adim2(food) {
      var miktar = h('input', { type: 'number', min: 0, step: 'any', value: String(food.varsayilan_g), 'aria-label': 'Miktar (gram)' });
      var por = porsiyonSecici(food, miktar, function () { ciz(); });
      var onizleme = h('div', { class: 'ozet' });
      function ciz() {
        var v = Calc.scale(food.degerler, sayi(miktar.value));
        onizleme.textContent = '';
        [['kcal', 'Kalori (kcal)', 'kcal'], ['protein', 'Protein (g)', 'g'], ['karb', 'Karbonhidrat (g)', 'g'], ['yag', 'Yağ (g)', 'g']].forEach(function (x) {
          onizleme.appendChild(h('div', {}, h('b', { text: Calc.fmt(v[x[0]], x[2]) }), h('span', { text: x[1] })));
        });
      }
      miktar.addEventListener('input', function () { por.sifirla(); ciz(); });
      function ekle() {
        var g = sayi(miktar.value);
        if (!(g > 0)) { uyar('Miktar sıfırdan büyük olmalı.'); return; }
        var simdi = new Date();
        var kayit = { id: yeniId(), tarih: gun.tarih, ogun: og, besin_id: food.id, miktar_g: g, saat: pad(simdi.getHours()) + ':' + pad(simdi.getMinutes()) };
        Storage.putLog(kayit).then(function () { return Storage.touchRecent(food.id); })
          .then(function () { return Storage.listRecents(); }).then(function (r) { state.recents = r; dlg.close(); yenile(); });
      }
      dlg.textContent = '';
      dlg.appendChild(baslik(food.ad));
      dlg.appendChild(h('div', { class: 'd-govde' },
        h('div', { class: 'miktar' }, h('label', { text: 'Miktar (g): ' }, miktar), por.eleman), onizleme,
        h('div', { class: 'araclar' },
          h('button', { type: 'button', text: OGUN_AD[og] + ' öğününe ekle', onclick: ekle }),
          h('button', { type: 'button', class: 'ikincil', text: '‹ Geri', onclick: adim1 })),
        food.dogrulandi ? null : h('p', { class: 'not', text: 'Bu besinin değerleri yaklaşıktır ve henüz doğrulanmamıştır.' })));
      ciz();
      miktar.focus(); miktar.select();
    }

    adim1();
    dlg.showModal();
  }

  /* Başka günden öğün kopyala */
  function kopyalaAc(og) {
    var dlg = doc.getElementById('secici');
    dlg.onclick = function (e) { if (e.target === dlg) dlg.close(); };
    var kaynak = h('input', { type: 'date', value: tarihKaydir(gun.tarih, -1), 'aria-label': 'Kopyalanacak gün' });
    var mesaj = h('p', { class: 'not' });
    function kopyala() {
      if (!kaynak.value) return;
      if (kaynak.value === gun.tarih) { mesaj.textContent = 'Kaynak gün, seçili günle aynı olamaz.'; return; }
      Storage.listLogByDate(kaynak.value).then(function (liste) {
        var uygun = liste.filter(function (k) { return k.ogun === og; });
        if (!uygun.length) { mesaj.textContent = tarihMetni(kaynak.value) + ' günü "' + OGUN_AD[og] + '" öğününde kayıt yok.'; return; }
        return Promise.all(uygun.map(function (k) {
          return Storage.putLog({ id: yeniId(), tarih: gun.tarih, ogun: og, besin_id: k.besin_id, miktar_g: k.miktar_g, saat: k.saat });
        })).then(function () { dlg.close(); yenile(); });
      });
    }
    dlg.textContent = '';
    dlg.appendChild(h('div', { class: 'd-ust' }, h('h2', { text: OGUN_AD[og] + ' — başka günden kopyala' }),
      h('button', { type: 'button', class: 'ikincil', text: 'Kapat', onclick: function () { dlg.close(); } })));
    dlg.appendChild(h('div', { class: 'd-govde' },
      h('div', { class: 'miktar' }, h('label', { text: 'Kopyalanacak gün: ' }, kaynak)),
      h('div', { class: 'araclar' }, h('button', { type: 'button', text: 'Kopyala', onclick: kopyala })), mesaj));
    dlg.showModal();
  }

  /* ---------- Geçmiş ---------- */
  var gecmisAralik = 30;
  function gecmisSayfasi() {
    Promise.all([Storage.tumLog(), Storage.listTamamlananGunler()]).then(function (r) {
      if (aktifSayfa !== 'gecmis') return;
      var hepsi = r[0];
      var tamamlananSet = new Set(r[1].map(function (x) { return x.id; }));
      var gunler = {};
      hepsi.forEach(function (k) { (gunler[k.tarih] = gunler[k.tarih] || []).push(k); });
      var tarihler = Object.keys(gunler).sort().reverse();
      if (gecmisAralik > 0) {
        var sinir = tarihKaydir(yerelTarih(new Date()), -gecmisAralik);
        tarihler = tarihler.filter(function (t) { return t >= sinir; });
      }
      var aralik = h('select', { 'aria-label': 'Aralık', onchange: function (e) { gecmisAralik = parseInt(e.target.value, 10); gecmisSayfasi(); } });
      [[30, 'Son 30 gün'], [90, 'Son 90 gün'], [365, 'Son 1 yıl'], [0, 'Tümü']].forEach(function (a) {
        var o = h('option', { value: String(a[0]), text: a[1] }); if (a[0] === gecmisAralik) o.selected = true; aralik.appendChild(o);
      });
      var tb = h('tbody');
      tarihler.forEach(function (t) {
        var hs = hesapla(gunler[t]);
        var ac = function () { gun.tarih = t; root.location.hash = '#bugun'; };
        tb.appendChild(h('tr', { class: 'satir', tabindex: 0, onclick: ac, onkeydown: function (e) { if (e.key === 'Enter') ac(); } },
          h('td', { class: 'ad' }, tarihMetni(t),
            tamamlananSet.has(t) ? h('span', { class: 'gun-tik-baslik gun-tik-satir', title: 'Gün tamamlandı', 'aria-label': 'tamamlandı', text: '✓' }) : null),
          h('td', { class: 'sayi', text: String(gunler[t].length) }),
          h('td', { class: 'sayi', text: Calc.fmt(hs.toplam.kcal, 'kcal') }),
          h('td', { class: 'sayi', text: Calc.fmt(hs.toplam.protein, 'g') }),
          h('td', { class: 'sayi', text: Calc.fmt(hs.toplam.karb, 'g') }),
          h('td', { class: 'sayi', text: Calc.fmt(hs.toplam.yag, 'g') })));
      });
      content.textContent = '';
      content.appendChild(h('h1', { text: 'Geçmiş' }));
      content.appendChild(h('p', { class: 'alt-baslik', text: 'Kayıt girilmiş günler. Bir güne tıklayınca o günün sayfası açılır.' }));
      content.appendChild(h('div', { class: 'araclar' }, aralik));
      if (!tarihler.length) {
        content.appendChild(h('p', { class: 'bos', text: 'Bu aralıkta kayıt yok.' }));
      } else {
        content.appendChild(h('div', { class: 'tablo-kap' }, h('table', {},
          h('thead', {}, h('tr', {}, h('th', { text: 'Gün' }), h('th', { class: 'sayi', text: 'Kayıt' }), h('th', { class: 'sayi', text: 'kcal' }),
            h('th', { class: 'sayi', text: 'Protein (g)' }), h('th', { class: 'sayi', text: 'Karb. (g)' }), h('th', { class: 'sayi', text: 'Yağ (g)' }))), tb)));
        content.appendChild(h('p', { class: 'sayac', text: tarihler.length + ' gün listeleniyor.' }));
      }
    }).catch(function (e) { if (aktifSayfa === 'gecmis') hataGoster(e); });
  }

  /* ---------- Yedekleme ---------- */
  function indir(ad, icerik, mime) {
    var blob = new Blob([icerik], { type: mime });
    var url = root.URL.createObjectURL(blob);
    var a = h('a', { href: url, download: ad });
    doc.body.appendChild(a); a.click(); a.remove();
    root.setTimeout(function () { root.URL.revokeObjectURL(url); }, 2000);
  }

  /* JSON yedeğini indirir ve son yedek tarihini kaydeder. */
  function yedekAl(onek) {
    return Storage.exportParcalari().then(function (p) {
      var veri = Backup.paketle(p, Storage.SCHEMA_VERSION);
      indir(Backup.dosyaAdi(onek || 'besin-takip-yedek', 'json'), JSON.stringify(veri, null, 1), 'application/json');
      return Storage.setSetting('sonYedek', new Date().toISOString()).then(function () { return veri; });
    });
  }

  function csvAl() {
    return Storage.tumLog().then(function (k) {
      if (!k.length) { uyar('Dışa aktarılacak öğün kaydı yok.'); return; }
      indir(Backup.dosyaAdi('besin-takip-kayitlar', 'csv'), Backup.csv(k, Foods.BY_ID), 'text/csv;charset=utf-8');
    });
  }

  function yedekIceAktar(dosya, sonuc) {
    if (dosya.size > Backup.MAKS_BOYUT) { sonuc('Dosya çok büyük (en fazla 50 MB).', true); return; }
    dosya.text().then(function (metin) {
      var data;
      try { data = JSON.parse(metin); } catch (e) { sonuc('Dosya okunamadı: geçerli bir JSON değil.', true); return; }
      var d = Backup.dogrula(data, Storage.SCHEMA_VERSION);
      if (!d.ok) { sonuc('İçe aktarılamadı: ' + d.hata, true); return; }
      var msg = 'Yedekteki veriler (' + d.veri.log.length + ' öğün kaydı, ' + d.veri.favorites.length + ' favori) MEVCUT TÜM VERİLERİN YERİNE geçecek.\n\n' +
        'Devam etmeden önce mevcut verileriniz otomatik olarak bir yedek dosyasına indirilecek. Devam edilsin mi?';
      if (!root.confirm(msg)) { sonuc('İçe aktarma iptal edildi.', false); return; }
      yedekAl('besin-takip-ice-aktarma-oncesi').then(function () { return Storage.degistirHepsini(d.veri); })
        .then(function () { return Storage.setSetting('sonYedek', new Date().toISOString()); })
        .then(function () { return Promise.all([Storage.listFavorites(), Storage.listRecents(), Storage.getSetting('tema', 'acik'), besinListesiniTazele(), hareketListesiniTazele(), Storage.getSetting('vurguRenk', 'varsayilan')]); })
        .then(function (r) {
          state.favs = new Set(r[0]); state.recents = r[1]; state.vurgu = paletBul(r[5]).id; temaUygula(r[2]);
          var toplamKayit = Backup.BOLUMLER.filter(function (k) { return k !== 'settings'; })
            .reduce(function (a, k) { return a + d.veri[k].length; }, 0);
          sonuc('İçe aktarma tamam: ' + d.veri.log.length + ' öğün kaydı dahil, toplam ' + toplamKayit + ' kayıt geri yüklendi.', false);
          hatirlatmaKontrol();
        })
        .catch(function () { sonuc('İçe aktarma sırasında hata oluştu; mevcut veriler değişmedi.', true); });
    }, function () { sonuc('Dosya okunamadı.', true); });
  }

  function tumunuSil(sonuc) {
    if (!root.confirm('TÜM VERİLER (öğün kayıtları, favoriler, ayarlar) kalıcı olarak silinecek.\n\nÖnce otomatik bir yedek dosyası indirilecek. Devam edilsin mi?')) return;
    var yaz = root.prompt('Onaylamak için SİL yazın:');
    if (yaz == null || Calc.norm(yaz) !== 'sil') { sonuc('Silme iptal edildi.', false); return; }
    yedekAl('besin-takip-silme-oncesi').then(function () { return Storage.degistirHepsini({}); })
      .then(function () { return Promise.all([besinListesiniTazele(), hareketListesiniTazele()]); })
      .then(function () { state.favs = new Set(); state.recents = []; sonuc('Tüm veriler silindi. Silme öncesi yedek dosyası indirildi.', false); hatirlatmaKontrol(); })
      .catch(function () { sonuc('Silme sırasında hata oluştu.', true); });
  }

  function tarihSaat(iso) {
    return iso ? new Date(iso).toLocaleString('tr-TR', { dateStyle: 'long', timeStyle: 'short' }) : 'hiç alınmadı';
  }

  /* ilk: sayfa açılınca gösterilecek {m, hata} durum mesajı (işlem sonrası tazelemede kullanılır) */
  function ayarlarSayfasi(ilk) {
    if (ilk && ilk.type) ilk = null; /* olay nesnesi geldiyse yok say */
    Promise.all([Storage.getSetting('sonYedek', null), Storage.tumLog(),
      Storage.getSetting('geminiApiKey', ''), Storage.getSetting('geminiModel', GEMINI_VARSAYILAN_MODEL)]).then(function (r) {
      if (aktifSayfa !== 'ayarlar') return;
      var sonYedek = r[0], kayitSayisi = r[1].length, geminiAnahtar = r[2], geminiModel = r[3];
      var durum = h('p', { class: 'durum', role: 'status', 'aria-live': 'polite' });
      function sonuc(m, hata, tazele) {
        if (tazele) { ayarlarSayfasi({ m: m, hata: hata }); return; }
        durum.textContent = m; durum.className = 'durum' + (hata ? ' hata' : '');
      }
      if (ilk) sonuc(ilk.m, ilk.hata);
      var dosyaSec = h('input', { type: 'file', accept: '.json,application/json', 'aria-label': 'Yedek dosyası seç',
        onchange: function (e) { var f = e.target.files[0]; e.target.value = ''; if (f) yedekIceAktar(f, function (m, hata) { sonuc(m, hata, !hata); }); } });

      content.textContent = '';
      content.appendChild(h('h1', { text: 'Ayarlar / Yedek' }));
      content.appendChild(h('p', { class: 'alt-baslik', text: 'Verileriniz bu bilgisayarda, tarayıcının deposunda tutulur. Tarayıcı verisi temizlenirse silinebilir; bu yüzden düzenli yedek alın.' }));

      content.appendChild(h('section', { class: 'panel' }, h('h2', { text: 'Yedek al' }),
        h('p', { text: 'Son yedek: ' + tarihSaat(sonYedek) + ' · Kayıtlı öğün girdisi: ' + kayitSayisi }),
        h('div', { class: 'araclar' },
          h('button', { type: 'button', text: 'Yedek al (JSON)', onclick: function () { yedekAl().then(function () { sonuc('Yedek dosyası indirildi.', false); hatirlatmaKontrol(); }); } }),
          h('button', { type: 'button', class: 'ikincil', text: 'Kayıtları CSV olarak indir', onclick: function () { csvAl(); } })),
        h('p', { class: 'not', text: 'JSON yedeği tüm verileri içerir ve geri yüklenebilir. CSV yalnızca öğün kayıtlarını ve her kaydın besin değerlerini içerir (Excel için); geri yüklenmez.' })));

      content.appendChild(h('section', { class: 'panel' }, h('h2', { text: 'Yedekten geri yükle' }),
        h('p', { text: 'Daha önce aldığınız JSON yedek dosyasını seçin. Mevcut veriler yedektekilerle değiştirilir; işlemden önce mevcut verileriniz otomatik yedeklenir.' }),
        h('div', { class: 'araclar' }, dosyaSec)));

      content.appendChild(h('section', { class: 'panel' }, h('h2', { text: 'Depolama' }),
        h('p', { text: Storage.kalici ? 'Kalıcı depolama etkin (IndexedDB). Veriler program kapatılınca da durur.' : 'Kalıcı depolama KULLANILAMIYOR: veriler yalnızca bu oturumda tutuluyor. Yedek almadan sayfayı kapatmayın.' }),
        Storage.kalici || !Storage.sonHata ? null : h('p', { class: 'durum hata', text: Storage.sonHata }),
        h('p', { class: 'not', text: 'Veri şeması sürümü: ' + Storage.SCHEMA_VERSION })));

      var geminiDurum = h('p', { class: 'durum', role: 'status', 'aria-live': 'polite' });
      var geminiInp = h('input', { type: 'password', value: geminiAnahtar || '', placeholder: 'AIza…', autocomplete: 'off', 'aria-label': 'Gemini API anahtarı' });
      var geminiModelInp = h('input', { type: 'text', value: geminiModel || GEMINI_VARSAYILAN_MODEL, placeholder: GEMINI_VARSAYILAN_MODEL, 'aria-label': 'Gemini model adı' });
      content.appendChild(h('section', { class: 'panel' }, h('h2', { text: 'Fotoğrafla besin tanıma (isteğe bağlı, çevrimiçi)' }),
        h('p', { text: 'Bugün sayfasında öğüne "Fotoğrafla tanı" ile besin ekleyebilmek için kendi Google Gemini API anahtarınızı buraya girin (Google AI Studio’dan ücretsiz alınabilir). Yalnızca bu tarayıcıda saklanır, yedek dosyasına dahil edilmez ve uygulama tarafından Google’ın kendi API adresi dışında hiçbir yere gönderilmez. Çekilen fotoğraf, yalnızca siz "Tanı" düğmesine bastığınızda bu anahtarla doğrudan Gemini’ye gönderilir — bu, programın diğer her yerde geçerli "internet gerekmez" kuralının, sizin onayınızla kullanılan, dar bir istisnasıdır.' }),
        h('div', { class: 'form-satir' },
          h('label', { class: 'genis' }, 'API anahtarı ', geminiInp),
          h('label', {}, 'Model ', geminiModelInp)),
        h('div', { class: 'araclar' },
          h('button', { type: 'button', text: 'Kaydet', onclick: function () {
            Promise.all([Storage.setSetting('geminiApiKey', geminiInp.value.trim()), Storage.setSetting('geminiModel', geminiModelInp.value.trim() || GEMINI_VARSAYILAN_MODEL)])
              .then(function () { geminiDurum.textContent = 'Kaydedildi.'; geminiDurum.className = 'durum'; })
              .catch(function (e) { geminiDurum.textContent = 'Kaydedilemedi: ' + ((e && e.message) || e); geminiDurum.className = 'durum hata'; });
          } }),
          geminiAnahtar ? h('button', { type: 'button', class: 'ikincil', text: 'Anahtarı kaldır', onclick: function () {
            Storage.setSetting('geminiApiKey', '').then(function () { ayarlarSayfasi({ m: 'API anahtarı kaldırıldı.' }); });
          } }) : null),
        geminiDurum));

      content.appendChild(h('section', { class: 'panel tehlike' }, h('h2', { text: 'Tüm verileri sil' }),
        h('p', { text: 'Öğün kayıtlarını, favorileri ve ayarları kalıcı olarak siler. Önce otomatik yedek indirilir.' }),
        h('button', { type: 'button', class: 'ikincil', text: 'Tüm verileri sil…', onclick: function () { tumunuSil(function (m, hata) { sonuc(m, hata, !hata); }); } })));
      content.appendChild(durum);
    }).catch(function (e) { if (aktifSayfa === 'ayarlar') hataGoster(e); });
  }

  /* Yedek hatırlatması: kayıt var ve son yedek yok / 7 günden eski ise üstte uyarı gösterir. */
  var HATIRLATMA_GUN = 7;
  function hatirlatmaKontrol() {
    var el = doc.getElementById('hatirlatma');
    Promise.all([Storage.getSetting('sonYedek', null), Storage.tumLog()]).then(function (r) {
      var son = r[0] ? new Date(r[0]).getTime() : 0;
      var eski = !son || (Date.now() - son) > HATIRLATMA_GUN * 86400000;
      if (!r[1].length || !eski) { el.hidden = true; el.textContent = ''; return; }
      el.textContent = '';
      el.appendChild(h('span', { text: son ? 'Son yedeğiniz ' + tarihSaat(r[0]) + ' tarihli. Yeni bir yedek almanız önerilir.' : 'Henüz hiç yedek almadınız. Verileriniz yalnızca bu tarayıcıda duruyor.' }));
      el.appendChild(h('button', { type: 'button', text: 'Şimdi yedek al', onclick: function () { yedekAl().then(hatirlatmaKontrol); } }));
      el.hidden = false;
    });
  }

  /* ---------- Grafikler ----------
     Biçim seçimi: makro payı part-to-whole (3 dilim → halka), öğün kalorisi tek ölçü
     (yatay çubuk, tek renk — çubuk boyu zaten büyüklüğü gösteriyor), trend zaman serisi (çizgi).
     Kalori (kcal) ile protein (g) farklı ölçekte olduğu için ASLA tek grafikte iki eksene
     konmaz; ayrı grafikler çizilir. Renk hiçbir yerde tek başına anlam taşımaz:
     her grafiğin görünür değer etiketi ve tablo görünümü vardır. */
  var grafikDurum = { sekme: 'gun', aralik: 7 };
  var GRAFIK_ARALIK = [[7, 'Son 7 gün'], [30, 'Son 30 gün'], [90, 'Son 90 gün']];

  /* Açılır tablo: grafiğin erişilebilir eşdeğeri (renk körlüğü / ekran okuyucu / yazdırma). */
  function tabloGorunum(basliklar, satirlar, ozet) {
    var tb = h('tbody');
    satirlar.forEach(function (s) {
      var tr = h('tr');
      s.forEach(function (hucre, i) {
        tr.appendChild(h('td', { class: i === 0 ? 'ad' : 'sayi', text: String(hucre) }));
      });
      tb.appendChild(tr);
    });
    var th = h('tr');
    basliklar.forEach(function (b, i) { th.appendChild(h('th', { class: i === 0 ? '' : 'sayi', text: b })); });
    return h('details', { class: 'tablo-gorunum' },
      h('summary', { text: 'Tablo olarak göster' }),
      h('div', { class: 'tablo-kap' }, h('table', {}, h('thead', {}, th), tb)),
      ozet ? h('p', { class: 'not', text: ozet }) : null);
  }

  function grafikKart(baslik, aciklama, icerik) {
    var k = h('section', { class: 'grafik-kart' }, h('h2', { text: baslik }));
    if (aciklama) k.appendChild(h('p', { class: 'aciklama', text: aciklama }));
    (icerik || []).forEach(function (x) { if (x) k.appendChild(x); });
    return k;
  }

  function grafiklerSayfasi() {
    Charts.hepsiniYokEt();
    if (!gun.tarih) gun.tarih = yerelTarih(new Date());
    var sira = ++gun.sira;
    Promise.all([Storage.tumLog(), Storage.getSetting('hedefler', VARSAYILAN_HEDEF), Storage.listKilo()]).then(function (r) {
      if (sira !== gun.sira || aktifSayfa !== 'grafikler') return;
      grafikCiz(r[0], r[1], r[2]);
    }).catch(function (e) { if (aktifSayfa === 'grafikler') hataGoster(e); });
  }

  function grafikCiz(hepsi, hedefler, kiloKayitlari) {
    content.textContent = '';
    content.appendChild(h('h1', { text: 'Grafikler' }));
    content.appendChild(h('p', { class: 'alt-baslik', text: 'Kayıtlarınızın görsel özeti. Her grafiğin altında aynı verinin tablo hâli vardır.' }));

    var sekmeler = h('div', { class: 'sekmeler', role: 'group', 'aria-label': 'Grafik görünümü' });
    [['gun', 'Seçili gün'], ['trend', 'Trend']].forEach(function (s) {
      sekmeler.appendChild(h('button', { type: 'button', 'aria-pressed': String(grafikDurum.sekme === s[0]), text: s[1],
        onclick: function () { grafikDurum.sekme = s[0]; grafiklerSayfasi(); } }));
    });
    content.appendChild(h('div', { class: 'araclar' }, sekmeler));

    if (!root.Chart) {
      content.appendChild(h('p', { class: 'bos', text: 'Grafik kütüphanesi (lib/chart.umd.min.js) yüklenemedi. Tablo görünümleri yine de çalışır.' }));
    }
    if (grafikDurum.sekme === 'gun') gunGrafikleri(hepsi, hedefler);
    else trendGrafikleri(hepsi, hedefler, kiloKayitlari);
  }

  /* ----- Seçili gün ----- */
  function gunGrafikleri(hepsi, hedefler) {
    var bugun = yerelTarih(new Date());
    var kayitlar = hepsi.filter(function (k) { return k.tarih === gun.tarih; });
    var hs = hesapla(kayitlar);

    /* Tek filtre satırı: altındaki her şeyi kapsar */
    content.appendChild(h('div', { class: 'araclar' },
      h('button', { type: 'button', class: 'ikincil', text: '‹ Önceki', 'aria-label': 'Önceki gün',
        onclick: function () { gun.tarih = tarihKaydir(gun.tarih, -1); grafiklerSayfasi(); } }),
      h('input', { type: 'date', value: gun.tarih, 'aria-label': 'Tarih',
        onchange: function (e) { if (e.target.value) { gun.tarih = e.target.value; grafiklerSayfasi(); } } }),
      h('button', { type: 'button', class: 'ikincil', text: 'Sonraki ›', 'aria-label': 'Sonraki gün',
        onclick: function () { gun.tarih = tarihKaydir(gun.tarih, 1); grafiklerSayfasi(); } }),
      gun.tarih === bugun ? null : h('button', { type: 'button', text: 'Bugüne dön',
        onclick: function () { gun.tarih = bugun; grafiklerSayfasi(); } })));

    if (!kayitlar.length) {
      content.appendChild(h('p', { class: 'bos', text: tarihMetni(gun.tarih) + ' için kayıt yok. Bugün sayfasından besin ekleyebilirsiniz.' }));
      return;
    }

    /* Öne çıkan sayı — sayfada tek bir tane, oransal rakamlarla */
    var hedefKcal = hedefler.kcal != null ? hedefler.kcal : VARSAYILAN_HEDEF.kcal;
    content.appendChild(h('section', { class: 'grafik-kart' },
      h('p', { class: 'one-cikan-alt', text: tarihMetni(gun.tarih) + ' · toplam alınan enerji' }),
      h('p', { class: 'one-cikan', text: Calc.fmt(hs.toplam.kcal, 'kcal') + ' kcal' }),
      h('p', { class: 'aciklama', text: 'Günlük hedef ' + Calc.fmt(hedefKcal, 'kcal') + ' kcal · ' + kayitlar.length + ' kayıt' })));

    /* 1) Makro dağılımı (halka) */
    var mk = Calc.makroKalori(hs.toplam);
    var mkToplam = mk.protein + mk.karb + mk.yag;
    function pay(v) { return mkToplam > 0 ? Math.round(v / mkToplam * 100) : 0; }
    var seriRenk = Charts.renkler().seri;
    var gosterge = h('div', { class: 'gosterge' });
    [['Protein', mk.protein, hs.toplam.protein], ['Karbonhidrat', mk.karb, hs.toplam.karb], ['Yağ', mk.yag, hs.toplam.yag]].forEach(function (x, i) {
      gosterge.appendChild(h('div', {},
        h('i', { style: 'background:' + seriRenk[i] }),
        h('b', { text: '%' + pay(x[1]) }),
        h('span', { text: x[0] + ' · ' + Calc.fmt(x[2], 'g') + ' g · ' + Calc.fmt(x[1], 'kcal') + ' kcal' })));
    });
    content.appendChild(grafikKart('Makro dağılımı',
      'Enerjinin makro besinlere göre payı. Protein ve karbonhidrat 4, yağ 9 kcal/g üzerinden hesaplanır.', [
        h('div', { class: 'grafik-alan tip-halka' },
          h('canvas', { id: 'g-makro', role: 'img', 'aria-label': 'Makro dağılımı halka grafiği; değerler hemen altında listelenmiştir' })),
        gosterge,
        tabloGorunum(['Makro', 'Miktar (g)', 'Enerji (kcal)', 'Pay'], [
          ['Protein', Calc.fmt(hs.toplam.protein, 'g'), Calc.fmt(mk.protein, 'kcal'), '%' + pay(mk.protein)],
          ['Karbonhidrat', Calc.fmt(hs.toplam.karb, 'g'), Calc.fmt(mk.karb, 'kcal'), '%' + pay(mk.karb)],
          ['Yağ', Calc.fmt(hs.toplam.yag, 'g'), Calc.fmt(mk.yag, 'kcal'), '%' + pay(mk.yag)]
        ], 'Makrolardan hesaplanan enerji ' + Calc.fmt(mkToplam, 'kcal') + ' kcal; kayıtlı enerji ' +
           Calc.fmt(hs.toplam.kcal, 'kcal') + ' kcal. Küçük fark yuvarlamadan ve lif/alkol payındandır.')
      ]));

    /* 2) Öğünlere göre kalori (yatay çubuk, tek ölçü → tek renk) */
    var ogunAd = [], ogunKcal = [], ogunSatir = [];
    OGUNLER.forEach(function (og) {
      var ok = kayitlar.filter(function (k) { return k.ogun === og; });
      if (!ok.length) return;
      var t = hesapla(ok).toplam;
      ogunAd.push(OGUN_AD[og]);
      ogunKcal.push(Math.round(t.kcal));
      ogunSatir.push([OGUN_AD[og], ok.length, Calc.fmt(t.kcal, 'kcal'), Calc.fmt(t.protein, 'g'), Calc.fmt(t.karb, 'g'), Calc.fmt(t.yag, 'g')]);
    });
    content.appendChild(grafikKart('Öğünlere göre enerji', 'Günün enerjisinin öğünlere dağılımı.', [
      h('div', { class: 'grafik-alan tip-cubuk' },
        h('canvas', { id: 'g-ogun', role: 'img', 'aria-label': 'Öğünlere göre kalori çubuk grafiği; değerler tabloda listelenmiştir' })),
      tabloGorunum(['Öğün', 'Kayıt', 'kcal', 'Protein (g)', 'Karb. (g)', 'Yağ (g)'], ogunSatir)
    ]));

    /* 3) Mikro besin panosu */
    content.appendChild(mikroPano(hs, kayitlar.length));

    /* Çizim, tuvaller DOM'a girdikten sonra */
    if (root.Chart) {
      Charts.makroHalka('g-makro', mk);
      Charts.ogunCubuk('g-ogun', ogunAd, ogunKcal);
    }
  }

  function mikroPano(hs, kayitSayisi) {
    var kart = h('section', { class: 'grafik-kart' },
      h('h2', { text: 'Mikro besin panosu' }),
      h('p', { class: 'aciklama', text: 'Günlük referans değerin ne kadarının karşılandığı. Kaynak: ' + RDA.KAYNAK +
        '. Yüzdeler yalnızca kıyas içindir; kişisel ihtiyaç yaşa, cinsiyete ve sağlık durumuna göre değişir.' }));
    var tabloSatir = [];
    ['Vitaminler', 'Mineraller'].forEach(function (grup) {
      kart.appendChild(h('h3', { text: grup }));
      var liste = h('div', { class: 'olcer-liste' });
      Nutrients.LIST.filter(function (n) { return n.g === grup && RDA.DV[n.k]; }).forEach(function (n) {
        var dv = RDA.DV[n.k];
        var eksik = hs.eksik[n.k];
        var hepsiEksik = eksik >= kayitSayisi;
        var deger = hepsiEksik ? null : hs.toplam[n.k];
        var y = deger == null ? null : RDA.yuzde(n.k, deger);
        var asildi = dv.ust && y != null && y > 100;
        var sagMetin = deger == null ? 'veri yok'
          : Calc.fmt(deger, dv.b) + ' ' + dv.b + ' · %' + Math.round(y) + (asildi ? ' — üst sınır aşıldı' : '');
        liste.appendChild(h('div', { class: 'olcer' + (asildi ? ' asildi' : '') + (deger == null ? ' veriyok' : '') },
          h('div', { class: 'olcer-ust' },
            h('span', { text: n.ad + (dv.ust ? ' (üst sınır)' : '') }),
            h('span', { class: 'sag', text: sagMetin })),
          h('div', { class: 'olcer-yol', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': 100,
            'aria-valuenow': y == null ? 0 : Math.min(100, Math.round(y)),
            'aria-label': n.ad + ': referansın yüzde ' + (y == null ? 'bilinmiyor' : Math.round(y)) + 'i' },
            h('div', { class: 'olcer-dolgu', style: 'width:' + (y == null ? 0 : Math.min(100, y)) + '%' }))));
        tabloSatir.push([
          n.ad + (dv.ust ? ' (üst sınır)' : ''),
          deger == null ? '—' : Calc.fmt(deger, dv.b),
          dv.b,
          Calc.fmt(dv.deger, dv.b),
          y == null ? '—' : '%' + Math.round(y),
          eksik ? eksik + ' kayıtta bilinmiyor' : ''
        ]);
      });
      kart.appendChild(liste);
    });
    kart.appendChild(tabloGorunum(['Besin ögesi', 'Alınan', 'Birim', 'Referans', 'Karşılama', 'Not'], tabloSatir,
      'Bilinmeyen değerler toplama katılmaz (sıfır sayılmaz); bu yüzden karşılama yüzdesi olduğundan düşük görünebilir.'));
    return kart;
  }

  /* ----- Trend ----- */
  function trendGrafikleri(hepsi, hedefler, kiloKayitlari) {
    var bugun = yerelTarih(new Date());
    var aralikSec = h('div', { class: 'sekmeler', role: 'group', 'aria-label': 'Zaman aralığı' });
    GRAFIK_ARALIK.forEach(function (a) {
      aralikSec.appendChild(h('button', { type: 'button', 'aria-pressed': String(grafikDurum.aralik === a[0]), text: a[1],
        onclick: function () { grafikDurum.aralik = a[0]; grafiklerSayfasi(); } }));
    });
    content.appendChild(h('div', { class: 'araclar' }, aralikSec));

    /* Aralıktaki her gün; kayıt olmayan gün boş bırakılır (sıfır çizilmez) */
    var kiloMap = {};
    (kiloKayitlari || []).forEach(function (k) { kiloMap[k.id] = k.kilo_kg; });
    var etiket = [], kcal = [], protein = [], kilo = [], satir = [], gunMap = {}, kiloVarMi = false;
    hepsi.forEach(function (k) { (gunMap[k.tarih] = gunMap[k.tarih] || []).push(k); });
    for (var i = grafikDurum.aralik - 1; i >= 0; i--) {
      var t = tarihKaydir(bugun, -i);
      etiket.push(new Date(t + 'T12:00:00').toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' }));
      var kiloDeger = kiloMap[t] != null ? kiloMap[t] : null;
      kilo.push(kiloDeger);
      if (kiloDeger != null) kiloVarMi = true;
      if (gunMap[t]) {
        var top = hesapla(gunMap[t]).toplam;
        kcal.push(Math.round(top.kcal));
        protein.push(Math.round(top.protein * 10) / 10);
        satir.push([tarihMetni(t), gunMap[t].length, Calc.fmt(top.kcal, 'kcal'), Calc.fmt(top.protein, 'g'), kiloDeger != null ? Calc.fmt(kiloDeger, 'kg') : '—']);
      } else {
        kcal.push(null); protein.push(null);
        if (kiloDeger != null) satir.push([tarihMetni(t), 0, '—', '—', Calc.fmt(kiloDeger, 'kg')]);
      }
    }
    if (!satir.length) {
      content.appendChild(h('p', { class: 'bos', text: 'Bu aralıkta kayıt yok.' }));
      return;
    }
    var dolu = kcal.filter(function (x) { return x != null; });
    var ortKcal = dolu.reduce(function (a, b) { return a + b; }, 0) / dolu.length;
    var hedefKcal = hedefler.kcal != null ? hedefler.kcal : VARSAYILAN_HEDEF.kcal;
    var hedefProtein = hedefler.protein != null ? hedefler.protein : VARSAYILAN_HEDEF.protein;

    content.appendChild(h('section', { class: 'grafik-kart' },
      h('p', { class: 'one-cikan-alt', text: 'Kayıtlı günlerin günlük ortalaması · son ' + grafikDurum.aralik + ' gün' }),
      h('p', { class: 'one-cikan', text: Calc.fmt(ortKcal, 'kcal') + ' kcal' }),
      h('p', { class: 'aciklama', text: satir.length + ' günde kayıt var; kayıt olmayan günler ortalamaya ve grafiğe katılmaz.' })));

    /* Farklı ölçekler (kcal / g / kg) ayrı grafiklerde: tek eksende karşılaştırılmaz */
    var ikili = h('div', { class: 'grafik-ikili' },
      grafikKart('Enerji (kcal)', 'İnce gri çizgi günlük hedefi gösterir.', [
        h('div', { class: 'grafik-alan tip-cizgi' },
          h('canvas', { id: 'g-trend-kcal', role: 'img', 'aria-label': 'Günlük kalori trendi; değerler tabloda listelenmiştir' }))]),
      grafikKart('Protein (g)', 'İnce gri çizgi günlük hedefi gösterir.', [
        h('div', { class: 'grafik-alan tip-cizgi' },
          h('canvas', { id: 'g-trend-protein', role: 'img', 'aria-label': 'Günlük protein trendi; değerler tabloda listelenmiştir' }))]));
    if (kiloVarMi) {
      ikili.appendChild(grafikKart('Kilo (kg)', hedefler.hedef_kilo_kg > 0 ? 'İnce gri çizgi hedef kiloyu gösterir.' : 'Kayıt girilmeyen günler boş bırakılır.', [
        h('div', { class: 'grafik-alan tip-cizgi' },
          h('canvas', { id: 'g-trend-kilo', role: 'img', 'aria-label': 'Kilo trendi; değerler tabloda listelenmiştir' }))]));
    }
    content.appendChild(ikili);

    content.appendChild(h('section', { class: 'grafik-kart' },
      h('h2', { text: 'Günlük değerler' }),
      tabloGorunum(['Gün', 'Kayıt', 'kcal', 'Protein (g)', 'Kilo (kg)'], satir)));

    if (root.Chart) {
      var r = Charts.renkler();
      Charts.trendCizgi('g-trend-kcal', etiket, kcal, { birim: 'kcal', hedef: hedefKcal, renk: r.seri[0] });
      Charts.trendCizgi('g-trend-protein', etiket, protein, { birim: 'g', hedef: hedefProtein, renk: r.seri[1] });
      if (kiloVarMi) Charts.trendCizgi('g-trend-kilo', etiket, kilo, { birim: 'kg', hedef: hedefler.hedef_kilo_kg > 0 ? hedefler.hedef_kilo_kg : 0, renk: r.seri[2] });
    }
  }

  /* ---------- Favori öğünler ----------
     Sık tekrarlanan bir öğünü (örn. standart kahvaltı) adıyla kaydedip tek tıkla geri ekler.
     Kaydedilen şey besin kimlikleri ve miktarlardır; besin silinirse o kalem eklenmez. */
  function favoriOgunAc(og, mevcutKayitlar) {
    var dlg = doc.getElementById('secici');
    dlg.onclick = function (e) { if (e.target === dlg) dlg.close(); };
    var durum = h('p', { class: 'durum', role: 'status', 'aria-live': 'polite' });

    function ciz() {
      Storage.listFavoriOgun().then(function (liste) {
        liste.sort(function (a, b) { return a.ad.localeCompare(b.ad, 'tr'); });
        var govde = h('div', { class: 'd-govde' });

        /* Bu öğünü kaydet */
        if (mevcutKayitlar && mevcutKayitlar.length) {
          var varsayilanAd = OGUN_AD[og];
          var adInp = h('input', { type: 'text', value: varsayilanAd, 'aria-label': 'Favori adı', placeholder: 'Örn. Standart kahvaltım' });
          var toplam = hesapla(mevcutKayitlar).toplam;
          govde.appendChild(h('section', { class: 'panel' },
            h('h3', { text: 'Bu öğünü favori olarak kaydet' }),
            h('p', { class: 'aciklama', text: mevcutKayitlar.length + ' besin · ' + Calc.fmt(toplam.kcal, 'kcal') + ' kcal' }),
            h('div', { class: 'form-satir' },
              h('label', { class: 'genis' }, 'Favori adı ', adInp),
              h('button', { type: 'button', text: 'Kaydet', onclick: function () {
                var a = adInp.value.trim();
                if (!a) { durum.textContent = 'Favori adı boş olamaz.'; durum.className = 'durum hata'; return; }
                var kayit = {
                  id: 'f-' + yeniId(), ad: a, ogun: og,
                  kalemler: mevcutKayitlar.map(function (k) { return { besin_id: k.besin_id, miktar_g: k.miktar_g }; }),
                  olusturuldu: new Date().toISOString()
                };
                Storage.putFavoriOgun(kayit).then(function () {
                  durum.textContent = '"' + a + '" favorilere kaydedildi.'; durum.className = 'durum';
                  ciz();
                });
              } }))));
        }

        /* Kayıtlı favoriler */
        var kap = h('section', { class: 'panel' }, h('h3', { text: 'Kayıtlı favori öğünler' }));
        if (!liste.length) {
          kap.appendChild(h('p', { class: 'not', text: 'Henüz favori öğün yok. Dolu bir öğünü buradan kaydedebilirsiniz.' }));
        } else {
          var tb = h('tbody');
          liste.forEach(function (f) {
            var gecerli = f.kalemler.filter(function (k) { return Foods.BY_ID[k.besin_id]; });
            var eksik = f.kalemler.length - gecerli.length;
            var top = hesapla(gecerli.map(function (k) { return { besin_id: k.besin_id, miktar_g: k.miktar_g }; })).toplam;
            tb.appendChild(h('tr', {},
              h('td', { class: 'ad' }, f.ad,
                h('span', { class: 'etiket', text: OGUN_AD[f.ogun] || f.ogun })),
              h('td', { class: 'sayi', text: gecerli.length + ' besin' }),
              h('td', { class: 'sayi', text: Calc.fmt(top.kcal, 'kcal') + ' kcal' }),
              h('td', {}, h('span', { class: 'satir-dugme' },
                h('button', { type: 'button', class: 'kucuk', text: OGUN_AD[og] + ' öğününe ekle',
                  onclick: function () {
                    if (!gecerli.length) { durum.textContent = 'Bu favorideki besinler artık listede yok.'; durum.className = 'durum hata'; return; }
                    var simdi = new Date();
                    Promise.all(gecerli.map(function (k) {
                      return Storage.putLog({ id: yeniId(), tarih: gun.tarih, ogun: og, besin_id: k.besin_id,
                        miktar_g: k.miktar_g, saat: pad(simdi.getHours()) + ':' + pad(simdi.getMinutes()) });
                    })).then(function () {
                      dlg.close();
                      yenile();
                      uyar('"' + f.ad + '" eklendi (' + gecerli.length + ' besin' + (eksik ? ', ' + eksik + ' besin bulunamadı' : '') + ').');
                    });
                  } }),
                h('button', { type: 'button', class: 'ikincil kucuk', text: 'Sil', 'aria-label': 'Favoriyi sil: ' + f.ad,
                  onclick: function () {
                    if (!root.confirm('"' + f.ad + '" favorisi silinsin mi? Öğün kayıtlarınız etkilenmez.')) return;
                    Storage.deleteFavoriOgun(f.id).then(function () {
                      durum.textContent = '"' + f.ad + '" silindi.'; durum.className = 'durum';
                      ciz();
                    });
                  } }))),
              eksik ? h('td', { class: 'not', text: eksik + ' besin bulunamadı' }) : h('td')));
          });
          kap.appendChild(h('div', { class: 'tablo-kap' }, h('table', {}, tb)));
        }
        govde.appendChild(kap);
        govde.appendChild(durum);

        dlg.textContent = '';
        dlg.appendChild(h('div', { class: 'd-ust' },
          h('h2', { text: 'Favori öğünler' }),
          h('button', { type: 'button', class: 'ikincil', text: 'Kapat', onclick: function () { dlg.close(); } })));
        dlg.appendChild(govde);
        if (!dlg.open) dlg.showModal();
      });
    }
    ciz();
  }

  /* ---------- Kendi besinim ve tariflerim ----------
     Kendi besin: 100 g için değerler elle girilir. Boş bırakılan alan "bilinmiyor" (null) kalır,
     sıfır sayılmaz — toplamlarda eksik veri olarak bildirilir.
     Tarif: bileşenlerden hesaplanır; toplam ağırlık pişirme kaybı için elle düzeltilebilir. */

  /* Ad + gram satırlarından oluşan porsiyon düzenleyici */
  function porsiyonDuzenleyici(baslangic) {
    var kap = h('div', { class: 'porsiyon-satirlar' });
    function satirEkle(ad, gram) {
      var sAd = h('input', { type: 'text', value: ad || '', placeholder: '1 dilim', 'aria-label': 'Porsiyon adı' });
      var sG = h('input', { type: 'number', min: 0, step: 'any', value: gram != null ? String(gram) : '', placeholder: 'gram', 'aria-label': 'Porsiyon gramı' });
      var satir = h('div', { class: 'porsiyon-satir' }, sAd, sG, h('span', { class: 'birim', text: 'g' }),
        h('button', { type: 'button', class: 'ikincil kucuk', text: 'Sil', 'aria-label': 'Porsiyon satırını sil',
          onclick: function () { satir.remove(); } }));
      satir._oku = function () {
        var a = sAd.value.trim(), g = sayi(sG.value);
        return (a && g > 0) ? { ad: a, g: g } : null;
      };
      kap.appendChild(satir);
    }
    (baslangic && baslangic.length ? baslangic : [{ ad: '1 porsiyon', g: 100 }]).forEach(function (p) { satirEkle(p.ad, p.g); });
    return {
      eleman: h('div', {}, kap,
        h('button', { type: 'button', class: 'ikincil kucuk', text: '+ Porsiyon satırı', onclick: function () { satirEkle('', ''); } })),
      oku: function () {
        return Array.prototype.map.call(kap.children, function (s) { return s._oku(); }).filter(Boolean);
      }
    };
  }

  /* 100 g için besin değeri girdileri; gruplar katlanabilir, boş = bilinmiyor */
  function degerFormu(baslangic) {
    var girdi = {};
    function alanKutu(n) {
      var v = baslangic ? baslangic[n.k] : null;
      var inp = h('input', { type: 'number', min: 0, step: 'any', 'aria-label': n.ad + (n.b ? ' (' + n.b + ')' : ''),
        value: (typeof v === 'number' && isFinite(v)) ? String(v) : '' });
      girdi[n.k] = inp;
      return h('div', { class: 'deger-alan' },
        h('label', {}, n.ad + ' ', h('span', { class: 'birim', text: n.b ? '(' + n.b + ')' : '' })), inp);
    }
    var kap = h('div');
    Nutrients.GROUPS.forEach(function (grup) {
      var alanlar = Nutrients.LIST.filter(function (n) { return n.g === grup; });
      var izgara = h('div', { class: 'deger-izgara' });
      alanlar.forEach(function (n) { izgara.appendChild(alanKutu(n)); });
      if (grup === Nutrients.GROUPS[0]) {
        kap.appendChild(h('div', {}, h('h3', { text: grup }), izgara));
      } else {
        kap.appendChild(h('details', { class: 'deger-grup' }, h('summary', { text: grup }), izgara));
      }
    });
    return {
      eleman: kap,
      oku: function () {
        var d = {};
        Nutrients.LIST.forEach(function (n) {
          var s = String(girdi[n.k].value).trim();
          d[n.k] = s === '' ? null : sayi(s); /* boş bırakılan alan bilinmiyor kalır */
        });
        return d;
      },
      kaloriBos: function () { return String(girdi.kcal.value).trim() === ''; }
    };
  }

  /* Kendi besin ekleme/düzenleme penceresi. mevcut=null ise yeni kayıt. */
  function kendiBesinAc(mevcut, bitince) {
    var dlg = doc.getElementById('secici');
    dlg.onclick = function (e) { if (e.target === dlg) dlg.close(); };
    var ad = h('input', { type: 'text', value: mevcut ? mevcut.ad : '', placeholder: 'Örn. Annemin keki', 'aria-label': 'Besin adı' });
    var kategori = h('input', { type: 'text', value: mevcut ? (mevcut.kategori || 'Kendi besinim') : 'Kendi besinim', 'aria-label': 'Kategori' });
    var varsayilan = h('input', { type: 'number', min: 0, step: 'any', value: String(mevcut ? mevcut.varsayilan_g : 100), 'aria-label': 'Varsayılan miktar (g)' });
    var barkod = h('input', { type: 'text', inputmode: 'numeric', value: mevcut && mevcut.barkod ? mevcut.barkod : '', placeholder: 'İsteğe bağlı', 'aria-label': 'Barkod' });
    var por = porsiyonDuzenleyici(mevcut ? mevcut.porsiyonlar : null);
    var form = degerFormu(mevcut ? mevcut.degerler : null);
    var durum = h('p', { class: 'durum', role: 'status', 'aria-live': 'polite' });

    function kaydet() {
      var a = ad.value.trim();
      if (!a) { durum.textContent = 'Besin adı boş olamaz.'; durum.className = 'durum hata'; ad.focus(); return; }
      if (form.kaloriBos()) { durum.textContent = 'Kalori (kcal) alanı zorunludur.'; durum.className = 'durum hata'; return; }
      var g = sayi(varsayilan.value);
      if (!(g > 0)) { durum.textContent = 'Varsayılan miktar sıfırdan büyük olmalı.'; durum.className = 'durum hata'; return; }
      var bk = barkod.value.trim() || null;
      if (bk) {
        var carpisan = Foods.barkodBul(bk);
        if (carpisan && (!mevcut || carpisan.id !== mevcut.id)) {
          durum.textContent = 'Bu barkod zaten "' + carpisan.ad + '" adlı besine kayıtlı.'; durum.className = 'durum hata'; return;
        }
      }
      var kayit = {
        id: (mevcut && mevcut.id) ? mevcut.id : 'k-' + yeniId(),
        ad: a,
        kategori: kategori.value.trim() || 'Kendi besinim',
        varsayilan_g: g,
        porsiyonlar: por.oku(),
        degerler: form.oku(),
        barkod: bk,
        guncellendi: new Date().toISOString()
      };
      if (!kayit.porsiyonlar.length) kayit.porsiyonlar = [{ ad: '1 porsiyon', g: g }];
      Storage.putOzelBesin(kayit)
        .then(besinListesiniTazele)
        .then(function () { dlg.close(); if (bitince) bitince(kayit); })
        .catch(function (e) { durum.textContent = 'Kaydedilemedi: ' + ((e && e.message) || e); durum.className = 'durum hata'; });
    }

    dlg.textContent = '';
    dlg.appendChild(h('div', { class: 'd-ust' },
      h('h2', { text: (mevcut && mevcut.id) ? 'Besini düzenle' : 'Kendi besinimi ekle' }),
      h('button', { type: 'button', class: 'ikincil', text: 'Kapat', onclick: function () { dlg.close(); } })));
    dlg.appendChild(h('div', { class: 'd-govde' },
      h('div', { class: 'form-satir' },
        h('label', { class: 'genis' }, 'Besin adı ', ad),
        h('label', {}, 'Kategori ', kategori),
        h('label', {}, 'Varsayılan miktar (g) ', varsayilan)),
      h('div', { class: 'form-satir' },
        h('label', {}, 'Barkod ', barkod),
        h('button', { type: 'button', class: 'ikincil', text: 'Kamerayla tara',
          onclick: function () { barkodTaraPenceresi(function (kod) { barkod.value = kod; }); } })),
      h('h3', { text: 'Porsiyonlar' }),
      h('p', { class: 'aciklama', text: 'Miktar girerken seçilebilecek tanımlar. "1 ölçek" gibi bir tanım yazarsanız, ekleme sırasında adet çarpanıyla katları da seçilebilir.' }),
      por.eleman,
      h('h3', { text: '100 gram için besin değerleri' }),
      h('p', { class: 'aciklama', text: 'Yalnızca bildiğiniz alanları doldurun. Boş bıraktığınız alan "bilinmiyor" sayılır ve toplamlarda sıfır olarak eklenmez.' }),
      form.eleman,
      h('div', { class: 'araclar' },
        h('button', { type: 'button', text: (mevcut && mevcut.id) ? 'Değişiklikleri kaydet' : 'Besini kaydet', onclick: kaydet }),
        h('button', { type: 'button', class: 'ikincil', text: 'Vazgeç', onclick: function () { dlg.close(); } })),
      durum));
    dlg.showModal();
    ad.focus();
  }

  /* Tarif ekleme/düzenleme penceresi */
  function tarifAc(mevcut, bitince) {
    var dlg = doc.getElementById('secici');
    dlg.onclick = function (e) { if (e.target === dlg) dlg.close(); };
    var ad = h('input', { type: 'text', value: mevcut ? mevcut.ad : '', placeholder: 'Örn. Yulaflı kahvaltı', 'aria-label': 'Tarif adı' });
    var bilesenler = (mevcut && mevcut.bilesenler ? mevcut.bilesenler.slice() : []);
    var elDuzeltildi = !!(mevcut && mevcut.toplam_g_elle);
    var toplamG = h('input', { type: 'number', min: 0, step: 'any', 'aria-label': 'Toplam ağırlık (g)',
      value: mevcut && mevcut.toplam_g ? String(mevcut.toplam_g) : '' });
    var listeKap = h('div');
    var ozetKap = h('div');
    var durum = h('p', { class: 'durum', role: 'status', 'aria-live': 'polite' });

    function hamToplam() { return bilesenler.reduce(function (a, b) { return a + b.gram; }, 0); }

    function ciz() {
      var ham = hamToplam();
      if (!elDuzeltildi) toplamG.value = ham > 0 ? String(Math.round(ham * 100) / 100) : '';
      listeKap.textContent = '';
      if (!bilesenler.length) {
        listeKap.appendChild(h('p', { class: 'bos', text: 'Henüz bileşen yok. "+ Bileşen ekle" ile besin seçin.' }));
      } else {
        var tb = h('tbody');
        bilesenler.forEach(function (b, i) {
          var f = Foods.BY_ID[b.besin_id];
          var gramInp = h('input', { type: 'number', min: 0, step: 'any', value: String(b.gram), 'aria-label': 'Miktar (g)',
            onchange: function (e) { b.gram = sayi(e.target.value); ciz(); } });
          var v = f ? Calc.scale(f.degerler, b.gram) : null;
          tb.appendChild(h('tr', {},
            h('td', { class: 'ad', text: f ? f.ad : 'Bilinmeyen besin' }),
            h('td', {}, gramInp, ' g'),
            h('td', { class: 'sayi', text: v ? Calc.fmt(v.kcal, 'kcal') + ' kcal' : '—' }),
            h('td', {}, h('button', { type: 'button', class: 'ikincil kucuk', text: 'Sil',
              'aria-label': 'Bileşeni sil: ' + (f ? f.ad : ''),
              onclick: function () { bilesenler.splice(i, 1); ciz(); } }))));
        });
        listeKap.appendChild(h('div', { class: 'tablo-kap' }, h('table', {}, tb)));
      }
      /* Önizleme: tarifin 100 g ve porsiyon başına değerleri */
      ozetKap.textContent = '';
      var tg = sayi(toplamG.value);
      if (bilesenler.length && tg > 0) {
        var onizleme = Foods.tarifBesine({ id: 'onizleme', ad: ad.value || 'Tarif', toplam_g: tg, bilesenler: bilesenler }, Foods.BY_ID);
        var d = onizleme.degerler;
        ozetKap.appendChild(h('div', { class: 'ozet' },
          h('div', {}, h('b', { text: Calc.fmt(d.kcal, 'kcal') }), h('span', { text: '100 g başına kcal' })),
          h('div', {}, h('b', { text: Calc.fmt(d.protein, 'g') }), h('span', { text: '100 g başına protein (g)' })),
          h('div', {}, h('b', { text: Calc.fmt(d.karb, 'g') }), h('span', { text: '100 g başına karb. (g)' })),
          h('div', {}, h('b', { text: Calc.fmt(d.yag, 'g') }), h('span', { text: '100 g başına yağ (g)' }))));
        var tamami = Calc.scale(d, tg);
        ozetKap.appendChild(h('p', { class: 'not', text: 'Tarifin tamamı (' + Calc.fmt(tg, 'g') + ' g): ' +
          Calc.fmt(tamami.kcal, 'kcal') + ' kcal · ' + Calc.fmt(tamami.protein, 'g') + ' g protein' +
          (onizleme.eksikAlan ? ' — ' + onizleme.eksikAlan + ' besin ögesinde bazı bileşenlerin verisi eksik.' : '') }));
      }
    }

    toplamG.addEventListener('input', function () { elDuzeltildi = true; ciz(); });

    function bilesenEkle() {
      besinSecPenceresi(function (food, gram) {
        bilesenler.push({ besin_id: food.id, gram: gram });
        ciz();
        tarifPenceresiniGoster();
      }, 'Tarife bileşen ekle', function () { tarifPenceresiniGoster(); });
    }

    function kaydet() {
      var a = ad.value.trim();
      if (!a) { durum.textContent = 'Tarif adı boş olamaz.'; durum.className = 'durum hata'; ad.focus(); return; }
      if (!bilesenler.length) { durum.textContent = 'Tarife en az bir bileşen ekleyin.'; durum.className = 'durum hata'; return; }
      var tg = sayi(toplamG.value);
      if (!(tg > 0)) { durum.textContent = 'Toplam ağırlık sıfırdan büyük olmalı.'; durum.className = 'durum hata'; return; }
      var kayit = {
        id: mevcut ? mevcut.id : 't-' + yeniId(),
        ad: a,
        bilesenler: bilesenler.map(function (b) { return { besin_id: b.besin_id, gram: b.gram }; }),
        toplam_g: tg,
        toplam_g_elle: elDuzeltildi,
        varsayilan_g: Math.round(tg),
        porsiyonlar: [{ ad: 'Tarifin tamamı', g: Math.round(tg) }],
        guncellendi: new Date().toISOString()
      };
      Storage.putTarif(kayit)
        .then(besinListesiniTazele)
        .then(function () { dlg.close(); if (bitince) bitince(kayit); })
        .catch(function (e) { durum.textContent = 'Kaydedilemedi: ' + ((e && e.message) || e); durum.className = 'durum hata'; });
    }

    function tarifPenceresiniGoster() {
      dlg.textContent = '';
      dlg.appendChild(h('div', { class: 'd-ust' },
        h('h2', { text: mevcut ? 'Tarifi düzenle' : 'Tarif oluştur' }),
        h('button', { type: 'button', class: 'ikincil', text: 'Kapat', onclick: function () { dlg.close(); } })));
      dlg.appendChild(h('div', { class: 'd-govde' },
        h('div', { class: 'form-satir' }, h('label', { class: 'genis' }, 'Tarif adı ', ad)),
        h('h3', { text: 'Bileşenler' }),
        listeKap,
        h('div', { class: 'araclar' },
          h('button', { type: 'button', class: 'ikincil', text: '+ Bileşen ekle', onclick: bilesenEkle })),
        h('h3', { text: 'Toplam ağırlık' }),
        h('p', { class: 'aciklama', text: 'Bileşenlerin toplamı otomatik yazılır. Pişirmede su kaybı varsa pişmiş ağırlığı elle yazın; değerler bu ağırlığa göre 100 g başına hesaplanır.' }),
        h('div', { class: 'form-satir' }, h('label', {}, 'Toplam ağırlık (g) ', toplamG),
          h('span', { class: 'not', text: 'Bileşen toplamı: ' + Calc.fmt(hamToplam(), 'g') + ' g' })),
        ozetKap,
        h('div', { class: 'araclar' },
          h('button', { type: 'button', text: mevcut ? 'Değişiklikleri kaydet' : 'Tarifi kaydet', onclick: kaydet }),
          h('button', { type: 'button', class: 'ikincil', text: 'Vazgeç', onclick: function () { dlg.close(); } })),
        durum));
      if (!dlg.open) dlg.showModal();
    }

    ciz();
    tarifPenceresiniGoster();
    ad.focus();
  }

  /* Ortak besin seçme penceresi: ara → seç → gram gir → geri çağır.
     Tarif bileşeni seçerken kullanılır (tarif içinde tarif seçilemez: döngü olmasın). */
  function besinSecPenceresi(secildi, baslikMetni, iptal) {
    var dlg = doc.getElementById('secici');
    var q = '', kat = '';
    function ust(metin) {
      return h('div', { class: 'd-ust' }, h('h2', { text: metin }),
        h('button', { type: 'button', class: 'ikincil', text: 'Kapat',
          onclick: function () { dlg.close(); if (iptal) iptal(); } }));
    }
    function adim1() {
      var liste = h('div', { class: 'tablo-kap' });
      function doldur() {
        var res = Foods.search(q, kat ? { kategori: kat } : undefined).filter(function (f) { return !f.tarif; }).slice(0, 60);
        liste.textContent = '';
        if (!res.length) { liste.appendChild(h('p', { class: 'bos', text: 'Bu kategoride/aramada besin bulunamadı.' })); return; }
        var tb = h('tbody');
        res.forEach(function (f) {
          tb.appendChild(h('tr', { class: 'satir', tabindex: 0,
            onclick: function () { adim2(f); },
            onkeydown: function (e) { if (e.key === 'Enter') adim2(f); } },
            h('td', { class: 'ad', text: f.ad }),
            h('td', {}, h('span', { class: 'etiket', text: f.kategori })),
            h('td', { class: 'sayi', text: Calc.fmt(f.degerler.kcal, 'kcal') + ' kcal/100 g' })));
        });
        liste.appendChild(h('table', {}, tb));
      }
      var arama = h('input', { type: 'search', placeholder: 'Besin ara…', 'aria-label': 'Besin ara', value: q,
        oninput: function (e) { q = e.target.value; doldur(); } });
      var katSec = h('select', { 'aria-label': 'Kategori', onchange: function (e) { kat = e.target.value; doldur(); } },
        h('option', { value: '', text: 'Tüm kategoriler' }));
      kategorilerSirali().forEach(function (k) {
        if (k === 'Tarif') return; /* tarif içinde tarif seçilemez */
        var o = h('option', { value: k, text: k }); if (k === kat) o.selected = true; katSec.appendChild(o);
      });
      var barkodBtn = h('button', { type: 'button', class: 'ikincil', text: 'Barkod tara',
        onclick: function () {
          barkodTaraPenceresi(function (kod) {
            var f = Foods.barkodBul(kod);
            if (f) { adim2(f); return; }
            adim1();
            uyar('Barkod (' + kod + ') kendi besinleriniz arasında bulunamadı. "Besinlerim" sayfasından "Barkod tara" ile ekleyebilirsiniz.');
          });
        } });
      dlg.textContent = '';
      dlg.appendChild(ust(baslikMetni));
      dlg.appendChild(h('div', { class: 'd-govde' }, h('div', { class: 'araclar' }, arama, katSec, barkodBtn), liste));
      doldur();
      if (!dlg.open) dlg.showModal();
      arama.focus();
    }
    function adim2(food) {
      var miktar = h('input', { type: 'number', min: 0, step: 'any', value: String(food.varsayilan_g), 'aria-label': 'Miktar (gram)' });
      var por = porsiyonSecici(food, miktar, function () {});
      miktar.addEventListener('input', function () { por.sifirla(); });
      dlg.textContent = '';
      dlg.appendChild(ust(food.ad));
      dlg.appendChild(h('div', { class: 'd-govde' },
        h('div', { class: 'miktar' }, h('label', { text: 'Miktar (g): ' }, miktar), por.eleman),
        h('div', { class: 'araclar' },
          h('button', { type: 'button', text: 'Ekle', onclick: function () {
            var g = sayi(miktar.value);
            if (!(g > 0)) { uyar('Miktar sıfırdan büyük olmalı.'); return; }
            secildi(food, g);
          } }),
          h('button', { type: 'button', class: 'ikincil', text: '‹ Geri', onclick: adim1 }))));
      miktar.focus(); miktar.select();
    }
    adim1();
  }

  /* ---------- Hedefler ----------
     Program sağlık veya diyet önerisi vermez. Buradaki hesap, yaygın olarak kullanılan
     Mifflin-St Jeor denklemiyle günlük enerji ihtiyacının KABA bir tahminini üretir;
     kullanıcı dilerse hedefine kopyalar. Karar ve sorumluluk kullanıcıdadır. */
  var AKTIVITE = [
    [1.2, 'Hareketsiz (masa başı)'],
    [1.375, 'Hafif hareketli (haftada 1–3 gün)'],
    [1.55, 'Orta hareketli (haftada 3–5 gün)'],
    [1.725, 'Çok hareketli (haftada 6–7 gün)'],
    [1.9, 'Aşırı hareketli (ağır iş / günde iki antrenman)']
  ];

  function hedeflerSayfasi(ilkDurum) {
    if (ilkDurum && ilkDurum.type) ilkDurum = null;
    Promise.all([Storage.getSetting('hedefler', VARSAYILAN_HEDEF), Storage.getSetting('profil', null), Storage.listKilo()])
      .then(function (r) {
        if (aktifSayfa !== 'hedefler') return;
        var sonKilo = r[2].slice().sort(function (a, b) { return b.id.localeCompare(a.id); })[0];
        hedeflerCiz(r[0] || VARSAYILAN_HEDEF, r[1], ilkDurum, sonKilo);
      }).catch(function (e) { if (aktifSayfa === 'hedefler') hataGoster(e); });
  }

  function hedeflerCiz(hedefler, profil, ilkDurum, sonKilo) {
    var durum = h('p', { class: 'durum', role: 'status', 'aria-live': 'polite' });
    if (ilkDurum) { durum.textContent = ilkDurum.m; durum.className = 'durum' + (ilkDurum.hata ? ' hata' : ''); }

    /* --- Hedef girdileri --- */
    var girdi = {};
    var liste = h('div', { class: 'hedef-liste' });
    HEDEF_AD.forEach(function (x) {
      var k = x[0];
      var inp = h('input', { type: 'number', min: 0, step: 'any', 'aria-label': x[1] + ' hedefi (' + x[2] + ')',
        value: String(hedefler[k] != null ? hedefler[k] : VARSAYILAN_HEDEF[k]) });
      girdi[k] = inp;
      liste.appendChild(h('div', { class: 'hedef-satir' },
        h('label', {}, x[1] + ' ', h('span', { class: 'birim', text: '(' + x[2] + ')' })), inp));
    });
    var suGirdi = h('input', { type: 'number', min: 0, step: 'any', 'aria-label': 'Su hedefi (ml)',
      value: String(hedefler.su_ml != null ? hedefler.su_ml : VARSAYILAN_HEDEF.su_ml) });
    liste.appendChild(h('div', { class: 'hedef-satir' },
      h('label', {}, 'Su ', h('span', { class: 'birim', text: '(ml)' })), suGirdi));
    var hedefKiloGirdi = h('input', { type: 'number', min: 0, step: 'any', placeholder: 'isteğe bağlı',
      'aria-label': 'Hedef kilo (kg, isteğe bağlı)', value: hedefler.hedef_kilo_kg != null ? String(hedefler.hedef_kilo_kg) : '' });
    liste.appendChild(h('div', { class: 'hedef-satir' },
      h('label', {}, 'Hedef kilo ', h('span', { class: 'birim', text: '(kg, isteğe bağlı)' })), hedefKiloGirdi));

    /* Makro hedeflerinin enerji karşılığı, kalori hedefiyle tutarlı mı? */
    var tutarlilik = h('p', { class: 'not', role: 'status', 'aria-live': 'polite' });
    function tutarlilikGuncelle() {
      var kcal = sayi(girdi.kcal.value);
      var mk = sayi(girdi.protein.value) * 4 + sayi(girdi.karb.value) * 4 + sayi(girdi.yag.value) * 9;
      if (!(kcal > 0)) { tutarlilik.textContent = ''; return; }
      var fark = Math.round(mk - kcal);
      tutarlilik.textContent = 'Makro hedefleri ' + Calc.fmt(mk, 'kcal') + ' kcal eder; kalori hedefi ' +
        Calc.fmt(kcal, 'kcal') + ' kcal. ' +
        (Math.abs(fark) <= 50 ? 'Tutarlı.' : (fark > 0 ? fark + ' kcal fazla.' : (-fark) + ' kcal eksik.'));
    }
    Object.keys(girdi).forEach(function (k) { girdi[k].addEventListener('input', tutarlilikGuncelle); });

    function kaydet() {
      var yeni = {};
      var hataliAd = null;
      HEDEF_AD.forEach(function (x) {
        var v = sayi(girdi[x[0]].value);
        if (!(v > 0)) hataliAd = hataliAd || x[1];
        yeni[x[0]] = v;
      });
      var suDeger = sayi(suGirdi.value);
      if (!(suDeger > 0)) hataliAd = hataliAd || 'Su';
      yeni.su_ml = suDeger;
      var hedefKiloDeger = sayi(hedefKiloGirdi.value);
      yeni.hedef_kilo_kg = hedefKiloDeger > 0 ? hedefKiloDeger : null; /* isteğe bağlı: boş/0 = ayarlanmamış */
      if (hataliAd) { durum.textContent = hataliAd + ' hedefi sıfırdan büyük olmalı.'; durum.className = 'durum hata'; return; }
      Storage.setSetting('hedefler', yeni).then(function () {
        hedeflerSayfasi({ m: 'Hedefler kaydedildi.', hata: false });
      });
    }
    function varsayilana() {
      if (!root.confirm('Hedefler varsayılan değerlere döndürülsün mü?')) return;
      HEDEF_AD.forEach(function (x) { girdi[x[0]].value = String(VARSAYILAN_HEDEF[x[0]]); });
      suGirdi.value = String(VARSAYILAN_HEDEF.su_ml);
      hedefKiloGirdi.value = '';
      tutarlilikGuncelle();
      durum.textContent = 'Varsayılanlar yüklendi — kaydetmek için "Hedefleri kaydet" düğmesine basın.';
      durum.className = 'durum';
    }

    /* --- Enerji ihtiyacı tahmini (isteğe bağlı) --- */
    var p = profil || {};
    var cinsiyet = h('select', { 'aria-label': 'Cinsiyet' });
    [['kadin', 'Kadın'], ['erkek', 'Erkek']].forEach(function (c) {
      var o = h('option', { value: c[0], text: c[1] });
      if (p.cinsiyet === c[0]) o.selected = true;
      cinsiyet.appendChild(o);
    });
    var yas = h('input', { type: 'number', min: 0, max: 120, step: 1, 'aria-label': 'Yaş', value: p.yas != null ? String(p.yas) : '' });
    var boy = h('input', { type: 'number', min: 0, step: 'any', 'aria-label': 'Boy (cm)', value: p.boy != null ? String(p.boy) : '' });
    var kiloVarsayilan = p.kilo != null ? p.kilo : (sonKilo ? sonKilo.kilo_kg : null);
    var kilo = h('input', { type: 'number', min: 0, step: 'any', 'aria-label': 'Kilo (kg)', value: kiloVarsayilan != null ? String(kiloVarsayilan) : '' });
    var aktivite = h('select', { 'aria-label': 'Hareket düzeyi' });
    AKTIVITE.forEach(function (a) {
      var o = h('option', { value: String(a[0]), text: a[1] });
      if (p.aktivite === a[0]) o.selected = true;
      aktivite.appendChild(o);
    });
    var sonucKutu = h('div', { class: 'tahmin-sonuc', role: 'status', 'aria-live': 'polite' });
    var son = { tdee: 0 };

    function hesapla() {
      var kg = sayi(kilo.value), cm = sayi(boy.value), y = sayi(yas.value);
      if (!(kg > 0 && cm > 0 && y > 0)) {
        sonucKutu.textContent = 'Hesap için yaş, boy ve kilo girin.';
        son.tdee = 0;
        return;
      }
      /* Mifflin-St Jeor (1990) bazal metabolizma, ardından hareket çarpanı */
      var bmr = 10 * kg + 6.25 * cm - 5 * y + (cinsiyet.value === 'erkek' ? 5 : -161);
      var tdee = bmr * parseFloat(aktivite.value);
      son.tdee = tdee;
      sonucKutu.textContent = '';
      sonucKutu.appendChild(h('div', {},
        h('b', { text: Calc.fmt(tdee, 'kcal') + ' kcal/gün' }),
        h('span', { text: ' — kabaca tahmini günlük enerji ihtiyacı (bazal ' + Calc.fmt(bmr, 'kcal') + ' kcal)' })));
      sonucKutu.appendChild(h('button', { type: 'button', class: 'ikincil', text: 'Kalori hedefine kopyala',
        onclick: function () {
          girdi.kcal.value = String(Math.round(tdee));
          tutarlilikGuncelle();
          durum.textContent = 'Tahmin kalori hedefine yazıldı — kaydetmek için "Hedefleri kaydet" düğmesine basın.';
          durum.className = 'durum';
        } }));
    }
    [yas, boy, kilo].forEach(function (i) { i.addEventListener('input', hesapla); });
    [cinsiyet, aktivite].forEach(function (s) { s.addEventListener('change', hesapla); });

    function profilKaydet() {
      var yeni = { cinsiyet: cinsiyet.value, yas: sayi(yas.value), boy: sayi(boy.value),
                   kilo: sayi(kilo.value), aktivite: parseFloat(aktivite.value) };
      Storage.setSetting('profil', yeni).then(function () {
        durum.textContent = 'Profil kaydedildi.'; durum.className = 'durum';
      });
    }

    /* --- Kaloriyi makrolara dağıt --- */
    var payProtein = h('input', { type: 'number', min: 0, max: 100, step: 1, value: '30', 'aria-label': 'Protein yüzdesi' });
    var payKarb = h('input', { type: 'number', min: 0, max: 100, step: 1, value: '40', 'aria-label': 'Karbonhidrat yüzdesi' });
    var payYag = h('input', { type: 'number', min: 0, max: 100, step: 1, value: '30', 'aria-label': 'Yağ yüzdesi' });
    var dagitDurum = h('p', { class: 'not', role: 'status', 'aria-live': 'polite' });
    function dagit() {
      var kcal = sayi(girdi.kcal.value);
      var a = sayi(payProtein.value), b = sayi(payKarb.value), c = sayi(payYag.value);
      var toplam = a + b + c;
      if (!(kcal > 0)) { dagitDurum.textContent = 'Önce kalori hedefi girin.'; return; }
      if (Math.round(toplam) !== 100) { dagitDurum.textContent = 'Yüzdelerin toplamı 100 olmalı (şu an ' + Math.round(toplam) + ').'; return; }
      girdi.protein.value = String(Math.round(kcal * a / 100 / 4));
      girdi.karb.value = String(Math.round(kcal * b / 100 / 4));
      girdi.yag.value = String(Math.round(kcal * c / 100 / 9));
      tutarlilikGuncelle();
      dagitDurum.textContent = 'Makro hedefleri güncellendi — kaydetmek için "Hedefleri kaydet" düğmesine basın.';
    }

    content.textContent = '';
    content.appendChild(h('h1', { text: 'Hedefler' }));
    content.appendChild(h('p', { class: 'alt-baslik', text: 'Günlük hedefleriniz. Bugün sayfasındaki ilerleme çubukları ve grafiklerdeki hedef çizgisi bu değerleri kullanır.' }));

    content.appendChild(h('section', { class: 'panel' },
      h('h2', { text: 'Günlük hedefler' }),
      liste,
      tutarlilik,
      h('div', { class: 'araclar' },
        h('button', { type: 'button', text: 'Hedefleri kaydet', onclick: kaydet }),
        h('button', { type: 'button', class: 'ikincil', text: 'Varsayılanlara dön', onclick: varsayilana }))));

    content.appendChild(h('section', { class: 'panel' },
      h('h2', { text: 'Kaloriyi makrolara dağıt' }),
      h('p', { class: 'aciklama', text: 'Kalori hedefini verdiğiniz yüzdelere göre protein, karbonhidrat ve yağa böler (4/4/9 kcal/g).' }),
      h('div', { class: 'pay-satir' },
        h('label', {}, 'Protein % ', payProtein),
        h('label', {}, 'Karbonhidrat % ', payKarb),
        h('label', {}, 'Yağ % ', payYag),
        h('button', { type: 'button', class: 'ikincil', text: 'Dağıt', onclick: dagit })),
      dagitDurum));

    content.appendChild(h('section', { class: 'panel' },
      h('h2', { text: 'Enerji ihtiyacı tahmini (isteğe bağlı)' }),
      h('p', { class: 'aciklama', text: 'Mifflin-St Jeor denklemiyle kaba bir tahmin üretir. Bu bir sağlık veya diyet önerisi değildir; kişisel ihtiyaç kişiden kişiye değişir. Diyet ve sağlık kararları için bir uzmana danışın.' }),
      h('div', { class: 'profil-satir' },
        h('label', {}, 'Cinsiyet ', cinsiyet),
        h('label', {}, 'Yaş ', yas),
        h('label', {}, 'Boy (cm) ', boy),
        h('label', {}, 'Kilo (kg) ', kilo)),
      h('div', { class: 'profil-satir' }, h('label', { class: 'genis' }, 'Hareket düzeyi ', aktivite)),
      sonucKutu,
      h('div', { class: 'araclar' },
        h('button', { type: 'button', class: 'ikincil', text: 'Profili kaydet', onclick: profilKaydet }))));

    content.appendChild(durum);
    tutarlilikGuncelle();
    hesapla();
  }


  /* ---------- Spor ----------
     Bugün sayfasıyla aynı gün kavramını (gun.tarih) paylaşır: Bugün'de dünü seçip Spor'a
     geçersen aynı gün gösterilir. Hareket veritabanı (js/exercises-data.js) besin sistemiyle
     aynı desende: arama + kategori filtresi + kendi hareket ekleme. Kalori hesabı yapılmaz;
     kullanıcı yalnızca set/tekrar/ağırlık/dinlenme takibi istedi. */
  var HAREKET_KATEGORI_SIRA = ['Göğüs', 'Sırt', 'Omuz', 'Biceps', 'Triceps', 'Bacak', 'Karın',
    'Kardiyo', 'Tüm vücut/Fonksiyonel', 'Esneklik/Mobilite', 'Diğer'];
  function hareketKategorilerSirali() {
    return Exercises.kategoriler().slice().sort(function (a, b) {
      var ia = HAREKET_KATEGORI_SIRA.indexOf(a), ib = HAREKET_KATEGORI_SIRA.indexOf(b);
      if (ia === -1) ia = 999; if (ib === -1) ib = 999;
      return ia - ib || a.localeCompare(b, 'tr');
    });
  }

  /* Dinamik set satırları: her satırda tekrar (zorunlu), ağırlık kg (opsiyonel), dinlenme sn (opsiyonel). */
  function setDuzenleyici(baslangic) {
    var kap = h('div', { class: 'set-satirlar' });
    var sayac = 0;
    function satirEkle(deger) {
      sayac++;
      var no = sayac;
      var tekrar = h('input', { type: 'number', min: 0, step: 1, value: deger && deger.tekrar != null ? String(deger.tekrar) : '10', 'aria-label': 'Set ' + no + ' tekrar sayısı' });
      var agirlik = h('input', { type: 'number', min: 0, step: 'any', value: deger && deger.agirlik_kg != null ? String(deger.agirlik_kg) : '', placeholder: '—', 'aria-label': 'Set ' + no + ' ağırlık (kg)' });
      var dinlenme = h('input', { type: 'number', min: 0, step: 1, value: deger && deger.dinlenme_sn != null ? String(deger.dinlenme_sn) : '', placeholder: '—', 'aria-label': 'Set ' + no + ' dinlenme (sn)' });
      var satir = h('div', { class: 'set-satir' },
        h('span', { class: 'set-no', text: 'Set ' + no }),
        tekrar, h('span', { class: 'birim', text: 'tekrar' }),
        agirlik, h('span', { class: 'birim', text: 'kg' }),
        dinlenme, h('span', { class: 'birim', text: 'sn dinlenme' }),
        h('button', { type: 'button', class: 'ikincil kucuk', text: 'Sil', 'aria-label': 'Set ' + no + ' satırını sil',
          onclick: function () { satir.remove(); yenidenNumarala(); } }));
      satir._oku = function () {
        var t = sayi(tekrar.value);
        if (!(t > 0)) return null;
        var s = { tekrar: t };
        var a = sayi(agirlik.value); if (a > 0) s.agirlik_kg = a;
        var d = sayi(dinlenme.value); if (d > 0) s.dinlenme_sn = d;
        return s;
      };
      satir._etiketGuncelle = function (n) { satir.querySelector('.set-no').textContent = 'Set ' + n; };
      kap.appendChild(satir);
    }
    function yenidenNumarala() {
      Array.prototype.forEach.call(kap.children, function (s, i) { s._etiketGuncelle(i + 1); });
    }
    (baslangic && baslangic.length ? baslangic : [null]).forEach(satirEkle);
    return {
      eleman: h('div', {}, kap,
        h('button', { type: 'button', class: 'ikincil kucuk', text: '+ Set ekle',
          onclick: function () {
            var son = kap.lastElementChild;
            var onceki = son ? son._oku() : null;
            satirEkle(onceki);
          } })),
      oku: function () {
        return Array.prototype.map.call(kap.children, function (s) { return s._oku(); }).filter(Boolean);
      }
    };
  }

  /* Hareket seçme penceresi: ara/kategori filtrele → seç → set gir → geri çağır. */
  function hareketSecPenceresi(baslikMetni, secildi) {
    var dlg = doc.getElementById('secici');
    dlg.onclick = function (e) { if (e.target === dlg) dlg.close(); };
    var q = '', kat = '';
    function ust(metin) {
      return h('div', { class: 'd-ust' }, h('h2', { text: metin }),
        h('button', { type: 'button', class: 'ikincil', text: 'Kapat', onclick: function () { dlg.close(); } }));
    }
    function adim1() {
      var liste = h('div', { class: 'tablo-kap' });
      function doldur() {
        var res = Exercises.search(q, kat ? { kategori: kat } : undefined).slice(0, 80);
        liste.textContent = '';
        if (!res.length) { liste.appendChild(h('p', { class: 'bos', text: 'Bu kategoride/aramada hareket bulunamadı.' })); return; }
        var tb = h('tbody');
        res.forEach(function (e) {
          tb.appendChild(h('tr', { class: 'satir', tabindex: 0, onclick: function () { adim2(e); },
              onkeydown: function (ev) { if (ev.key === 'Enter') adim2(e); } },
            h('td', { class: 'ad' }, e.ad, e.kendi ? h('span', { class: 'etiket kendi-etiket', text: 'kendi hareketim' }) : null),
            h('td', {}, h('span', { class: 'etiket', text: e.kategori }))));
        });
        liste.appendChild(h('table', {}, tb));
      }
      var arama = h('input', { type: 'search', placeholder: 'Hareket ara…', 'aria-label': 'Hareket ara', value: q,
        oninput: function (ev) { q = ev.target.value; doldur(); } });
      var katSec = h('select', { 'aria-label': 'Kategori', onchange: function (ev) { kat = ev.target.value; doldur(); } },
        h('option', { value: '', text: 'Tüm kategoriler' }));
      hareketKategorilerSirali().forEach(function (k) {
        var o = h('option', { value: k, text: k }); if (k === kat) o.selected = true; katSec.appendChild(o);
      });
      dlg.textContent = '';
      dlg.appendChild(ust(baslikMetni));
      dlg.appendChild(h('div', { class: 'd-govde' }, h('div', { class: 'araclar' }, arama, katSec), liste));
      doldur();
      if (!dlg.open) dlg.showModal();
      arama.focus();
    }
    function adim2(hareket) {
      var setler = setDuzenleyici(null);
      var durum = h('p', { class: 'durum', role: 'status', 'aria-live': 'polite' });
      dlg.textContent = '';
      dlg.appendChild(ust(hareket.ad));
      dlg.appendChild(h('div', { class: 'd-govde' },
        h('p', { class: 'aciklama', text: 'Her set için tekrar sayısı zorunlu; ağırlık ve dinlenme süresi isteğe bağlıdır.' }),
        setler.eleman,
        h('div', { class: 'araclar' },
          h('button', { type: 'button', text: 'Antrenmana ekle', onclick: function () {
            var sl = setler.oku();
            if (!sl.length) { durum.textContent = 'En az bir set girin (tekrar sayısı sıfırdan büyük olmalı).'; durum.className = 'durum hata'; return; }
            secildi(hareket, sl);
          } }),
          h('button', { type: 'button', class: 'ikincil', text: '‹ Geri', onclick: adim1 })),
        durum));
    }
    adim1();
  }

  /* Kendi hareketim ekle/düzenle */
  function kendiHareketAc(mevcut, bitince) {
    var dlg = doc.getElementById('secici');
    dlg.onclick = function (e) { if (e.target === dlg) dlg.close(); };
    var ad = h('input', { type: 'text', value: mevcut ? mevcut.ad : '', placeholder: 'Örn. Trap Bar Deadlift', 'aria-label': 'Hareket adı' });
    var kat = h('select', { 'aria-label': 'Kategori' });
    hareketKategorilerSirali().forEach(function (k) {
      var o = h('option', { value: k, text: k }); if (mevcut && mevcut.kategori === k) o.selected = true; kat.appendChild(o);
    });
    if (!mevcut) kat.value = 'Tüm vücut/Fonksiyonel';
    var durum = h('p', { class: 'durum', role: 'status', 'aria-live': 'polite' });
    function kaydet() {
      var a = ad.value.trim();
      if (!a) { durum.textContent = 'Hareket adı boş olamaz.'; durum.className = 'durum hata'; ad.focus(); return; }
      var kayit = { id: mevcut ? mevcut.id : 'k-' + yeniId(), ad: a, kategori: kat.value };
      Storage.putOzelHareket(kayit).then(hareketListesiniTazele)
        .then(function () { dlg.close(); if (bitince) bitince(kayit); })
        .catch(function (e) { durum.textContent = 'Kaydedilemedi: ' + ((e && e.message) || e); durum.className = 'durum hata'; });
    }
    dlg.textContent = '';
    dlg.appendChild(h('div', { class: 'd-ust' },
      h('h2', { text: mevcut ? 'Hareketi düzenle' : 'Kendi hareketimi ekle' }),
      h('button', { type: 'button', class: 'ikincil', text: 'Kapat', onclick: function () { dlg.close(); } })));
    dlg.appendChild(h('div', { class: 'd-govde' },
      h('div', { class: 'form-satir' }, h('label', { class: 'genis' }, 'Hareket adı ', ad), h('label', {}, 'Kategori ', kat)),
      h('div', { class: 'araclar' },
        h('button', { type: 'button', text: mevcut ? 'Değişiklikleri kaydet' : 'Hareketi kaydet', onclick: kaydet }),
        h('button', { type: 'button', class: 'ikincil', text: 'Vazgeç', onclick: function () { dlg.close(); } })),
      durum));
    dlg.showModal();
    ad.focus();
  }

  function kendiHareketSil(e) {
    Storage.tumAntrenman().then(function (kayitlar) {
      var kullanim = kayitlar.filter(function (k) { return k.hareket_id === e.id; }).length;
      var mesaj = '"' + e.ad + '" kalıcı olarak silinecek.';
      if (kullanim) mesaj += '\n\nBu hareket ' + kullanim + ' antrenman kaydında kullanılmış. Kayıtlar silinmez ama hareket "Bilinmeyen hareket" olarak görünür.';
      mesaj += '\n\nDevam edilsin mi?';
      if (!root.confirm(mesaj)) return;
      Storage.deleteOzelHareket(e.id).then(hareketListesiniTazele).then(function () {
        if (aktifSayfa === 'spor') sporSayfasi();
        uyar('"' + e.ad + '" silindi.');
      });
    });
  }

  /* Favori antrenmanlar: bugünün antrenmanını adla kaydet, ya da kayıtlı birini seçili güne uygula. */
  function favoriAntrenmanAc(gunlukHareketler) {
    var dlg = doc.getElementById('secici');
    dlg.onclick = function (e) { if (e.target === dlg) dlg.close(); };
    var durum = h('p', { class: 'durum', role: 'status', 'aria-live': 'polite' });

    function ciz() {
      Storage.listFavoriAntrenman().then(function (liste) {
        liste.sort(function (a, b) { return a.ad.localeCompare(b.ad, 'tr'); });
        var govde = h('div', { class: 'd-govde' });

        if (gunlukHareketler && gunlukHareketler.length) {
          var adInp = h('input', { type: 'text', value: '', placeholder: 'Örn. İtme günü', 'aria-label': 'Favori adı' });
          govde.appendChild(h('section', { class: 'panel' },
            h('h3', { text: 'Bugünün antrenmanını favori olarak kaydet' }),
            h('p', { class: 'aciklama', text: gunlukHareketler.length + ' hareket' }),
            h('div', { class: 'form-satir' },
              h('label', { class: 'genis' }, 'Favori adı ', adInp),
              h('button', { type: 'button', text: 'Kaydet', onclick: function () {
                var a = adInp.value.trim();
                if (!a) { durum.textContent = 'Favori adı boş olamaz.'; durum.className = 'durum hata'; return; }
                var kayit = {
                  id: 'fa-' + yeniId(), ad: a,
                  hareketler: gunlukHareketler.map(function (x) { return { hareket_id: x.hareket_id, setler: x.setler }; })
                };
                Storage.putFavoriAntrenman(kayit).then(function () {
                  durum.textContent = '"' + a + '" favorilere kaydedildi.'; durum.className = 'durum';
                  ciz();
                });
              } }))));
        }

        var kap = h('section', { class: 'panel' }, h('h3', { text: 'Kayıtlı favori antrenmanlar' }));
        if (!liste.length) {
          kap.appendChild(h('p', { class: 'not', text: 'Henüz favori antrenman yok.' }));
        } else {
          var tb = h('tbody');
          liste.forEach(function (f) {
            var gecerli = f.hareketler.filter(function (x) { return Exercises.BY_ID[x.hareket_id]; });
            var eksik = f.hareketler.length - gecerli.length;
            tb.appendChild(h('tr', {},
              h('td', { class: 'ad', text: f.ad }),
              h('td', { class: 'sayi', text: gecerli.length + ' hareket' }),
              h('td', {}, h('span', { class: 'satir-dugme' },
                h('button', { type: 'button', class: 'kucuk', text: 'Bu güne ekle', onclick: function () {
                  if (!gecerli.length) { durum.textContent = 'Bu favorideki hareketler artık listede yok.'; durum.className = 'durum hata'; return; }
                  var simdi = new Date();
                  Promise.all(gecerli.map(function (x) {
                    return Storage.putAntrenman({ id: yeniId(), tarih: gun.tarih, hareket_id: x.hareket_id, setler: x.setler,
                      saat: pad(simdi.getHours()) + ':' + pad(simdi.getMinutes()) });
                  })).then(function () {
                    dlg.close(); sporSayfasi();
                    uyar('"' + f.ad + '" eklendi (' + gecerli.length + ' hareket' + (eksik ? ', ' + eksik + ' hareket bulunamadı' : '') + ').');
                  });
                } }),
                h('button', { type: 'button', class: 'ikincil kucuk', text: 'Sil', 'aria-label': 'Favoriyi sil: ' + f.ad,
                  onclick: function () {
                    if (!root.confirm('"' + f.ad + '" favorisi silinsin mi?')) return;
                    Storage.deleteFavoriAntrenman(f.id).then(function () { durum.textContent = '"' + f.ad + '" silindi.'; durum.className = 'durum'; ciz(); });
                  } })))));
          });
          kap.appendChild(h('div', { class: 'tablo-kap' }, h('table', {}, tb)));
        }
        govde.appendChild(kap);
        govde.appendChild(durum);

        dlg.textContent = '';
        dlg.appendChild(h('div', { class: 'd-ust' }, h('h2', { text: 'Favori antrenmanlar' }),
          h('button', { type: 'button', class: 'ikincil', text: 'Kapat', onclick: function () { dlg.close(); } })));
        dlg.appendChild(govde);
        if (!dlg.open) dlg.showModal();
      });
    }
    ciz();
  }

  function sporSayfasi() {
    if (!gun.tarih) gun.tarih = yerelTarih(new Date());
    var sira = ++gun.sira;
    Promise.all([Storage.listAntrenmanByDate(gun.tarih)]).then(function (r) {
      if (sira === gun.sira && aktifSayfa === 'spor') sporCiz(r[0]);
    }).catch(function (e) { if (aktifSayfa === 'spor') hataGoster(e); });
  }

  function antrenmanEkle(hareket, setler) {
    var simdi = new Date();
    Storage.putAntrenman({ id: yeniId(), tarih: gun.tarih, hareket_id: hareket.id, setler: setler,
      saat: pad(simdi.getHours()) + ':' + pad(simdi.getMinutes()) }).then(function () {
      doc.getElementById('secici').close();
      sporSayfasi();
    });
  }

  function sporCiz(kayitlar) {
    var bugun = yerelTarih(new Date());
    var sayfa = h('div');

    sayfa.appendChild(h('h1', { text: 'Spor' }));
    sayfa.appendChild(h('p', { class: 'alt-baslik', text: gun.tarih === bugun ? 'Bugünkü antrenman' : tarihMetni(gun.tarih) + ' antrenmanı' }));

    var tarihGirdisi = h('input', { type: 'date', value: gun.tarih, 'aria-label': 'Tarih',
      onchange: function (e) { if (e.target.value) { gun.tarih = e.target.value; sporSayfasi(); } } });
    sayfa.appendChild(h('div', { class: 'araclar' },
      h('button', { type: 'button', class: 'ikincil', 'aria-label': 'Önceki gün', text: '‹ Önceki', onclick: function () { gun.tarih = tarihKaydir(gun.tarih, -1); sporSayfasi(); } }),
      tarihGirdisi,
      h('button', { type: 'button', class: 'ikincil', 'aria-label': 'Sonraki gün', text: 'Sonraki ›', onclick: function () { gun.tarih = tarihKaydir(gun.tarih, 1); sporSayfasi(); } }),
      gun.tarih === bugun ? null : h('button', { type: 'button', text: 'Bugüne dön', onclick: function () { gun.tarih = bugun; sporSayfasi(); } })));

    sayfa.appendChild(h('div', { class: 'araclar' },
      h('button', { type: 'button', text: '+ Hareket ekle', onclick: function () { hareketSecPenceresi(tarihMetni(gun.tarih) + ' — hareket ekle', antrenmanEkle); } }),
      h('button', { type: 'button', class: 'ikincil', text: 'Favori antrenmanlar', onclick: function () { favoriAntrenmanAc(kayitlar); } }),
      h('button', { type: 'button', class: 'ikincil', text: '+ Kendi hareketim', onclick: function () { kendiHareketAc(null, function (h) { uyar('"' + h.ad + '" kaydedildi.'); }); } })));

    if (!kayitlar.length) {
      sayfa.appendChild(h('p', { class: 'bos', text: 'Bu güne henüz hareket eklenmedi.' }));
    } else {
      kayitlar.forEach(function (k) {
        var e = Exercises.BY_ID[k.hareket_id];
        var toplamTekrar = k.setler.reduce(function (a, s) { return a + s.tekrar; }, 0);
        var tb = h('tbody');
        k.setler.forEach(function (s, i) {
          tb.appendChild(h('tr', {},
            h('td', { text: 'Set ' + (i + 1) }),
            h('td', { class: 'sayi', text: s.tekrar + ' tekrar' }),
            h('td', { class: 'sayi', text: s.agirlik_kg != null ? Calc.fmt(s.agirlik_kg, 'kg') + ' kg' : '—' }),
            h('td', { class: 'sayi', text: s.dinlenme_sn != null ? s.dinlenme_sn + ' sn' : '—' })));
        });
        var kart = h('div', { class: 'hareket-kart' },
          h('div', { class: 'hareket-ust' },
            h('h3', {}, e ? e.ad : 'Bilinmeyen hareket (veritabanında yok)', ' ',
              h('span', { class: 'etiket', text: (e ? e.kategori : '') }), ' ',
              h('span', { class: 'kcal-etiket', text: k.setler.length + ' set · ' + toplamTekrar + ' tekrar' })),
            h('div', { class: 'satir-dugme' },
              h('button', { type: 'button', class: 'ikincil kucuk', text: 'Sil', 'aria-label': 'Antrenman kaydını sil',
                onclick: function () { if (root.confirm('Bu kayıt silinsin mi?')) Storage.deleteAntrenman(k.id).then(sporSayfasi); } }))),
          h('table', { class: 'set-ozet-tablo' },
            h('thead', {}, h('tr', {}, h('th', { text: 'Set' }), h('th', { class: 'sayi', text: 'Tekrar' }),
              h('th', { class: 'sayi', text: 'Ağırlık' }), h('th', { class: 'sayi', text: 'Dinlenme' }))),
            tb));
        sayfa.appendChild(kart);
      });
    }

    /* Kendi hareketlerim: yalnızca varsa göster, düzenle/sil imkânıyla */
    Storage.listOzelHareket().then(function (ozel) {
      if (aktifSayfa !== 'spor' || !ozel.length) return;
      var panel = h('section', { class: 'panel' }, h('h2', { text: 'Kendi hareketlerim' }));
      var tb = h('tbody');
      ozel.slice().sort(function (a, b) { return a.ad.localeCompare(b.ad, 'tr'); }).forEach(function (o) {
        tb.appendChild(h('tr', {},
          h('td', { class: 'ad', text: o.ad }),
          h('td', {}, h('span', { class: 'etiket', text: o.kategori })),
          h('td', {}, h('span', { class: 'satir-dugme' },
            h('button', { type: 'button', class: 'ikincil kucuk', text: 'Düzenle', onclick: function () { kendiHareketAc(o, function () { if (aktifSayfa === 'spor') sporSayfasi(); }); } }),
            h('button', { type: 'button', class: 'ikincil kucuk', text: 'Sil', onclick: function () { kendiHareketSil(o); } })))));
      });
      panel.appendChild(h('div', { class: 'tablo-kap' }, h('table', {}, tb)));
      sayfa.appendChild(panel);
    });

    content.textContent = '';
    content.appendChild(sayfa);
  }

  /* ---------- Yönlendirme ---------- */
  var SAYFALAR = {
    besinler: besinlerSayfasi,
    bugun: bugunSayfasi,
    gecmis: gecmisSayfasi,
    grafikler: grafiklerSayfasi,
    spor: sporSayfasi,
    hedefler: hedeflerSayfasi,
    ayarlar: ayarlarSayfasi
  };
  function yakinda(baslik, aciklama) {
    return function () {
      content.textContent = '';
      content.appendChild(h('h1', { text: baslik }));
      content.appendChild(h('p', { class: 'alt-baslik', text: 'Bu sayfa henüz hazır değil. ' + aciklama }));
    };
  }

  function yonlendir() {
    var r = (root.location.hash || '').replace('#', '');
    if (!SAYFALAR[r]) r = 'bugun';
    if (aktifSayfa === 'grafikler' && r !== 'grafikler' && Charts) Charts.hepsiniYokEt(); /* tuval belleğini bırak */
    if (aktifSayfa === 'bugun' && r !== 'bugun' && orucZamanlayiciId) { root.clearInterval(orucZamanlayiciId); orucZamanlayiciId = null; } /* oruç sayacını durdur */
    aktifSayfa = r;
    hatirlatmaKontrol();
    Array.prototype.forEach.call(doc.querySelectorAll('.menu a'), function (a) {
      a.classList.toggle('aktif', a.getAttribute('data-r') === r);
      if (a.getAttribute('data-r') === r) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    try { SAYFALAR[r](); } catch (e) { hataGoster(e); }
  }

  /* ---------- Başlat ---------- */
  /* Depolama başka bir sekmedeki güncelleme yüzünden kapandıysa kullanıcıyı uyar. */
  root.__depoKapandi = function () { uyar(Storage.sonHata || 'Program başka bir sekmede güncellendi. Bu sekmeyi yenileyin.'); };

  /* Kendi besinleri ve tarifleri depodan okuyup arama listesine karıştırır.
     Tarif değerleri bileşenlerden hesaplandığı için bileşen değişince yeniden kurulmalı. */
  function besinListesiniTazele() {
    return Promise.all([Storage.listOzelBesin(), Storage.listTarif()]).then(function (r) {
      Foods.guncelle(r[0], r[1]);
      return r;
    });
  }
  /* Kendi hareketleri depodan okuyup hareket arama listesine karıştırır. */
  function hareketListesiniTazele() {
    return Storage.listOzelHareket().then(function (r) { Exercises.guncelle(r); return r; });
  }

  var baslatildi = false;
  function baslat() {
    if (baslatildi) return;
    baslatildi = true;
    root.addEventListener('hashchange', yonlendir);
    yonlendir();
  }

  /* Boş sayfa yerine her zaman bir şey göster: eski önbellek, depolama takılması ve beklenmeyen hatalar. */
  function hataGoster(e) {
    content.textContent = '';
    content.appendChild(h('h1', { text: 'Bir hata oluştu' }));
    content.appendChild(h('p', { class: 'alt-baslik', text: 'Sayfa yüklenirken sorun çıktı. Ctrl+F5 ile sayfayı yenileyin. Sürerse aşağıdaki mesajı iletin.' }));
    content.appendChild(h('pre', { class: 'hata-detay', text: String((e && (e.stack || e.message)) || e) }));
  }
  root.addEventListener('error', function (ev) { if (!content.querySelector('h1')) hataGoster(ev.error || ev.message); });
  root.addEventListener('unhandledrejection', function (ev) { if (!content.querySelector('h1')) hataGoster(ev.reason); });

  if (!Storage.listLogByDate || !root.Backup || !Storage.exportParcalari) {
    hataGoster('Program dosyalarının eski sürümü tarayıcı önbelleğinde kalmış. Ctrl+F5 ile yenileyin.');
    return;
  }

  /* Depolama 6 sn içinde hazır olmazsa yine de başla (veriler o oturumda bellekte tutulur). */
  root.setTimeout(function () {
    if (!baslatildi) { uyar('Depolama yanıt vermiyor; veriler yalnızca bu oturumda tutulacak.'); baslat(); }
  }, 6000);

  Storage.open().then(function (ok) {
    if (!ok) uyar(Storage.sonHata || 'Kalıcı depolama açılamadı: veriler yalnızca bu oturumda tutulacak. Tarayıcı ayarlarını kontrol edin.');
    return Promise.all([Storage.listFavorites(), Storage.listRecents(), temaBaslat(), besinListesiniTazele(), hareketListesiniTazele()]);
  }).then(function (r) {
    state.favs = new Set(r[0]); state.recents = r[1];
  }).catch(function (e) {
    uyar('Depolama hatası: ' + ((e && e.message) || e));
  }).then(baslat);
})(window);
