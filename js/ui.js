/* Arayüz: yönlendirme, tema, Besinlerim sayfası (arama + ayrıntı tablosu).
   Bugün / Geçmiş / Grafikler / Hedefler / Ayarlar sonraki aşamalarda eklenecek. */
(function (root) {
  var doc = root.document;
  var Calc = root.Calc, Foods = root.Foods, Nutrients = root.Nutrients, Storage = root.Storage;

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

  var state = { q: '', kategori: '', gorunum: 'tumu', favs: new Set(), recents: [] };
  var content = doc.getElementById('icerik');

  function uyar(msg) {
    var u = doc.getElementById('uyari');
    u.textContent = msg; u.hidden = false;
    root.clearTimeout(uyar._t);
    uyar._t = root.setTimeout(function () { u.hidden = true; }, 5000);
  }

  /* ---------- Tema ---------- */
  function temaUygula(t) {
    doc.documentElement.setAttribute('data-tema', t);
    doc.getElementById('tema-btn').textContent = t === 'koyu' ? 'Açık tema' : 'Koyu tema';
  }
  function temaBaslat() {
    var sistem = root.matchMedia && root.matchMedia('(prefers-color-scheme: dark)').matches ? 'koyu' : 'acik';
    return Storage.getSetting('tema', sistem).then(temaUygula).then(function () {
      doc.getElementById('tema-btn').addEventListener('click', function () {
        var yeni = doc.documentElement.getAttribute('data-tema') === 'koyu' ? 'acik' : 'koyu';
        temaUygula(yeni);
        Storage.setSetting('tema', yeni);
      });
    });
  }

  /* ---------- Besinlerim sayfası ---------- */
  function gorunenBesinler() {
    var opts = { kategori: state.kategori };
    if (state.gorunum === 'fav') opts.idSet = state.favs;
    if (state.gorunum === 'son') opts.idSet = new Set(state.recents);
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
  function listeyiYenile() {
    var list = gorunenBesinler();
    tbody.textContent = '';
    if (!list.length) {
      var msg = state.gorunum === 'fav' ? 'Henüz favori besin yok. Yıldız simgesine tıklayarak ekleyebilirsiniz.'
        : state.gorunum === 'son' ? 'Henüz son kullanılan besin yok.' : 'Aramanıza uyan besin bulunamadı.';
      tbody.appendChild(h('tr', {}, h('td', { colspan: 7, class: 'bos', text: msg })));
    }
    list.forEach(function (f) {
      var d = f.degerler;
      tbody.appendChild(h('tr', { class: 'satir', tabindex: 0, onclick: function () { ayrintiAc(f); },
          onkeydown: function (e) { if (e.key === 'Enter') ayrintiAc(f); } },
        h('td', {}, favButonu(f)),
        h('td', { class: 'ad', text: f.ad }),
        h('td', {}, h('span', { class: 'etiket', text: f.kategori })),
        h('td', { class: 'sayi', text: Calc.fmt(d.kcal, 'kcal') }),
        h('td', { class: 'sayi', text: Calc.fmt(d.protein, 'g') }),
        h('td', { class: 'sayi', text: Calc.fmt(d.karb, 'g') }),
        h('td', { class: 'sayi', text: Calc.fmt(d.yag, 'g') })
      ));
    });
    sayac.textContent = list.length + ' besin listeleniyor (toplam ' + Foods.ALL.length + '). Değerler 100 g başınadır.';
  }

  function besinlerSayfasi() {
    var arama = h('input', { type: 'search', placeholder: 'Besin ara… (ör. mercimek, simit, ayran)', 'aria-label': 'Besin ara', value: state.q,
      oninput: function (e) { state.q = e.target.value; listeyiYenile(); } });
    var kat = h('select', { 'aria-label': 'Kategori', onchange: function (e) { state.kategori = e.target.value; listeyiYenile(); } },
      h('option', { value: '', text: 'Tüm kategoriler' }));
    Foods.kategoriler().forEach(function (k) {
      var o = h('option', { value: k, text: k }); if (k === state.kategori) o.selected = true; kat.appendChild(o);
    });
    var sekmeler = h('div', { class: 'sekmeler', role: 'group', 'aria-label': 'Görünüm' });
    var sekmeBtn = {};
    [['tumu', 'Tümü'], ['fav', 'Favoriler'], ['son', 'Son kullanılanlar']].forEach(function (s) {
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
        h('th', { class: 'sayi', text: 'Karb. (g)' }), h('th', { class: 'sayi', text: 'Yağ (g)' }))),
      tbody);

    content.textContent = '';
    content.appendChild(h('h1', { text: 'Besinlerim' }));
    content.appendChild(h('p', { class: 'alt-baslik', text: 'Besin veritabanında arayın; bir satıra tıklayınca tüm besin değerleri açılır.' }));
    var dogrulanmamis = Foods.ALL.filter(function (f) { return !f.dogrulandi; }).length;
    if (dogrulanmamis) {
      content.appendChild(h('p', { class: 'etiket dogrulanmamis', text: dogrulanmamis + ' besinin değerleri yaklaşıktır ve henüz kaynağa (USDA / TürKomp) karşı doğrulanmamıştır.' }));
    }
    content.appendChild(h('div', { class: 'araclar' }, arama, kat, sekmeler));
    content.appendChild(h('div', { class: 'tablo-kap' }, tablo));
    content.appendChild(sayac);
    listeyiYenile();
  }

  /* ---------- Besin ayrıntısı (seçilen miktar için tam değer tablosu) ---------- */
  function ayrintiAc(food) {
    var dlg = doc.getElementById('ayrinti');
    Storage.touchRecent(food.id).then(function () { return Storage.listRecents(); }).then(function (r) { state.recents = r; });

    var gram = food.varsayilan_g;
    var miktar = h('input', { type: 'number', min: 0, step: 'any', value: String(gram), 'aria-label': 'Miktar (gram)' });
    var porsiyon = h('select', { 'aria-label': 'Porsiyon' }, h('option', { value: '', text: 'Porsiyon seç…' }));
    food.porsiyonlar.forEach(function (p) { porsiyon.appendChild(h('option', { value: String(p.g), text: p.ad + ' (' + Calc.fmt(p.g, 'g') + ' g)' })); });
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

    miktar.addEventListener('input', function () { porsiyon.value = ''; ciz(); });
    porsiyon.addEventListener('change', function () { if (porsiyon.value) { miktar.value = porsiyon.value; ciz(); } });

    dlg.textContent = '';
    dlg.appendChild(h('div', { class: 'd-ust' },
      h('div', {}, h('h2', { id: 'ayrinti-baslik', text: food.ad }), h('span', { class: 'etiket', text: food.kategori })),
      h('button', { type: 'button', class: 'ikincil', text: 'Kapat', onclick: function () { dlg.close(); } })));
    dlg.appendChild(h('div', { class: 'd-govde' },
      h('div', { class: 'miktar' }, h('label', { text: 'Miktar (g): ' }, miktar), porsiyon), govde));
    ciz();
    dlg.onclick = function (e) { if (e.target === dlg) dlg.close(); };
    dlg.showModal();
  }

  /* ---------- Bugün (günlük sayfa) ---------- */
  var OGUNLER = ['kahvaltı', 'öğle', 'akşam', 'ara öğün', 'özel'];
  var OGUN_AD = { 'kahvaltı': 'Kahvaltı', 'öğle': 'Öğle yemeği', 'akşam': 'Akşam yemeği', 'ara öğün': 'Ara öğün', 'özel': 'Özel' };
  /* Varsayılan hedefler; düzenleme sayfası Aşama 6'da eklenecek. */
  var VARSAYILAN_HEDEF = { kcal: 2000, protein: 100, karb: 250, yag: 70, lif: 30 };
  var HEDEF_AD = [['kcal', 'Kalori', 'kcal'], ['protein', 'Protein', 'g'], ['karb', 'Karbonhidrat', 'g'], ['yag', 'Yağ', 'g'], ['lif', 'Lif', 'g']];
  var gun = { tarih: null, sira: 0 };
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
    Promise.all([Storage.listLogByDate(gun.tarih), Storage.getSetting('hedefler', VARSAYILAN_HEDEF)]).then(function (r) {
      if (sira === gun.sira && aktifSayfa === 'bugun') bugunCiz(r[0], r[1]);
    }).catch(function (e) { if (aktifSayfa === 'bugun') hataGoster(e); });
  }
  function yenile() { bugunSayfasi(); }

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

  function bugunCiz(kayitlar, hedefler) {
    var bugun = yerelTarih(new Date());
    var hs = hesapla(kayitlar);
    var sayfa = h('div');

    sayfa.appendChild(h('h1', { text: gun.tarih === bugun ? 'Bugün' : tarihMetni(gun.tarih) }));
    sayfa.appendChild(h('p', { class: 'alt-baslik', text: gun.tarih === bugun ? tarihMetni(gun.tarih) : 'Seçili gün' }));

    var tarihGirdisi = h('input', { type: 'date', value: gun.tarih, 'aria-label': 'Tarih',
      onchange: function (e) { if (e.target.value) { gun.tarih = e.target.value; yenile(); } } });
    sayfa.appendChild(h('div', { class: 'araclar' },
      h('button', { type: 'button', class: 'ikincil', 'aria-label': 'Önceki gün', text: '‹ Önceki', onclick: function () { gun.tarih = tarihKaydir(gun.tarih, -1); yenile(); } }),
      tarihGirdisi,
      h('button', { type: 'button', class: 'ikincil', 'aria-label': 'Sonraki gün', text: 'Sonraki ›', onclick: function () { gun.tarih = tarihKaydir(gun.tarih, 1); yenile(); } }),
      gun.tarih === bugun ? null : h('button', { type: 'button', text: 'Bugüne dön', onclick: function () { gun.tarih = bugun; yenile(); } })));

    /* Günlük özet */
    var ozet = h('section', { class: 'panel', 'aria-label': 'Günlük özet' }, h('h2', { text: 'Günlük özet' }));
    HEDEF_AD.forEach(function (x) {
      var hedef = hedefler[x[0]] != null ? hedefler[x[0]] : VARSAYILAN_HEDEF[x[0]];
      ozet.appendChild(ilerlemeCubugu(x[1], hs.toplam[x[0]], hedef, x[2], kayitlar.length ? hs.eksik[x[0]] : 0));
    });
    if (!kayitlar.length) ozet.appendChild(h('p', { class: 'not', text: 'Bu güne henüz besin eklenmedi.' }));
    sayfa.appendChild(ozet);

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
    var q = '';

    function baslik(metin) {
      return h('div', { class: 'd-ust' }, h('h2', { text: metin }),
        h('button', { type: 'button', class: 'ikincil', text: 'Kapat', onclick: function () { dlg.close(); } }));
    }

    function adim1() {
      var liste = h('div', { class: 'tablo-kap' });
      function doldur() {
        var res;
        if (q.trim()) res = Foods.search(q);
        else {
          var gor = {}, ilk = [];
          state.recents.concat(Array.from(state.favs)).forEach(function (id) { if (Foods.BY_ID[id] && !gor[id]) { gor[id] = 1; ilk.push(Foods.BY_ID[id]); } });
          res = ilk.length ? ilk : Foods.search('');
        }
        res = res.slice(0, 60);
        liste.textContent = '';
        if (!res.length) { liste.appendChild(h('p', { class: 'bos', text: 'Aramanıza uyan besin bulunamadı.' })); return; }
        var tb = h('tbody');
        res.forEach(function (f) {
          tb.appendChild(h('tr', { class: 'satir', tabindex: 0, onclick: function () { adim2(f); }, onkeydown: function (e) { if (e.key === 'Enter') adim2(f); } },
            h('td', { class: 'ad', text: f.ad }), h('td', {}, h('span', { class: 'etiket', text: f.kategori })),
            h('td', { class: 'sayi', text: Calc.fmt(f.degerler.kcal, 'kcal') + ' kcal/100 g' })));
        });
        liste.appendChild(h('table', {}, tb));
      }
      var arama = h('input', { type: 'search', placeholder: 'Besin ara…', 'aria-label': 'Besin ara', oninput: function (e) { q = e.target.value; doldur(); } });
      dlg.textContent = '';
      dlg.appendChild(baslik(OGUN_AD[og] + ' — besin ekle'));
      dlg.appendChild(h('div', { class: 'd-govde' }, h('div', { class: 'araclar' }, arama),
        h('p', { class: 'not', text: q.trim() ? '' : 'Arama boşken son kullanılanlar ve favoriler gösterilir.' }), liste));
      doldur();
      arama.focus();
    }

    function adim2(food) {
      var miktar = h('input', { type: 'number', min: 0, step: 'any', value: String(food.varsayilan_g), 'aria-label': 'Miktar (gram)' });
      var por = h('select', { 'aria-label': 'Porsiyon' }, h('option', { value: '', text: 'Porsiyon seç…' }));
      food.porsiyonlar.forEach(function (p) { por.appendChild(h('option', { value: String(p.g), text: p.ad + ' (' + Calc.fmt(p.g, 'g') + ' g)' })); });
      var onizleme = h('div', { class: 'ozet' });
      function ciz() {
        var v = Calc.scale(food.degerler, sayi(miktar.value));
        onizleme.textContent = '';
        [['kcal', 'Kalori (kcal)', 'kcal'], ['protein', 'Protein (g)', 'g'], ['karb', 'Karbonhidrat (g)', 'g'], ['yag', 'Yağ (g)', 'g']].forEach(function (x) {
          onizleme.appendChild(h('div', {}, h('b', { text: Calc.fmt(v[x[0]], x[2]) }), h('span', { text: x[1] })));
        });
      }
      miktar.addEventListener('input', function () { por.value = ''; ciz(); });
      por.addEventListener('change', function () { if (por.value) { miktar.value = por.value; ciz(); } });
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
        h('div', { class: 'miktar' }, h('label', { text: 'Miktar (g): ' }, miktar), por), onizleme,
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
    Storage.tumLog().then(function (hepsi) {
      if (aktifSayfa !== 'gecmis') return;
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
          h('td', { class: 'ad', text: tarihMetni(t) }),
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
        .then(function () { return Promise.all([Storage.listFavorites(), Storage.listRecents(), Storage.getSetting('tema', 'acik')]); })
        .then(function (r) { state.favs = new Set(r[0]); state.recents = r[1]; temaUygula(r[2]); sonuc('İçe aktarma tamam: ' + d.veri.log.length + ' öğün kaydı geri yüklendi.', false); hatirlatmaKontrol(); })
        .catch(function () { sonuc('İçe aktarma sırasında hata oluştu; mevcut veriler değişmedi.', true); });
    }, function () { sonuc('Dosya okunamadı.', true); });
  }

  function tumunuSil(sonuc) {
    if (!root.confirm('TÜM VERİLER (öğün kayıtları, favoriler, ayarlar) kalıcı olarak silinecek.\n\nÖnce otomatik bir yedek dosyası indirilecek. Devam edilsin mi?')) return;
    var yaz = root.prompt('Onaylamak için SİL yazın:');
    if (yaz == null || Calc.norm(yaz) !== 'sil') { sonuc('Silme iptal edildi.', false); return; }
    yedekAl('besin-takip-silme-oncesi').then(function () { return Storage.degistirHepsini({}); })
      .then(function () { state.favs = new Set(); state.recents = []; sonuc('Tüm veriler silindi. Silme öncesi yedek dosyası indirildi.', false); hatirlatmaKontrol(); })
      .catch(function () { sonuc('Silme sırasında hata oluştu.', true); });
  }

  function tarihSaat(iso) {
    return iso ? new Date(iso).toLocaleString('tr-TR', { dateStyle: 'long', timeStyle: 'short' }) : 'hiç alınmadı';
  }

  /* ilk: sayfa açılınca gösterilecek {m, hata} durum mesajı (işlem sonrası tazelemede kullanılır) */
  function ayarlarSayfasi(ilk) {
    if (ilk && ilk.type) ilk = null; /* olay nesnesi geldiyse yok say */
    Promise.all([Storage.getSetting('sonYedek', null), Storage.tumLog()]).then(function (r) {
      if (aktifSayfa !== 'ayarlar') return;
      var sonYedek = r[0], kayitSayisi = r[1].length;
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

  /* ---------- Yönlendirme ---------- */
  var SAYFALAR = {
    besinler: besinlerSayfasi,
    bugun: bugunSayfasi,
    gecmis: gecmisSayfasi,
    grafikler: yakinda('Grafikler', 'Makro dağılımı, trendler ve mikro besin panosu (Aşama 5).'),
    hedefler: yakinda('Hedefler', 'Günlük hedefler (Aşama 6).'),
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
    return Promise.all([Storage.listFavorites(), Storage.listRecents(), temaBaslat()]);
  }).then(function (r) {
    state.favs = new Set(r[0]); state.recents = r[1];
  }).catch(function (e) {
    uyar('Depolama hatası: ' + ((e && e.message) || e));
  }).then(baslat);
})(window);
