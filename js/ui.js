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
    /* Grafikler renklerini CSS değişkenlerinden okur: tema değişince yeniden çizilmeli. */
    if (aktifSayfa === 'grafikler' && root.Charts) grafiklerSayfasi();
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
      h('button', { type: 'button', class: 'ikincil', text: '+ Tarif oluştur', onclick: function () { tarifAc(null, besinKaydedildi); } })));
    content.appendChild(h('div', { class: 'tablo-kap' }, tablo));
    content.appendChild(sayac);
    listeyiYenile();
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
    Promise.all([Storage.listLogByDate(gun.tarih), Storage.getSetting('hedefler', VARSAYILAN_HEDEF), Storage.listSuByDate(gun.tarih)]).then(function (r) {
      if (sira === gun.sira && aktifSayfa === 'bugun') bugunCiz(r[0], r[1], r[2]);
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

  function bugunCiz(kayitlar, hedefler, suKayitlari) {
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

    /* Su */
    var suHedef = hedefler.su_ml != null ? hedefler.su_ml : VARSAYILAN_HEDEF.su_ml;
    sayfa.appendChild(suPaneli(suKayitlari, suHedef));

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
      dlg.textContent = '';
      dlg.appendChild(baslik(OGUN_AD[og] + ' — besin ekle'));
      dlg.appendChild(h('div', { class: 'd-govde' }, h('div', { class: 'araclar' }, arama, katSec), not, liste));
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
        .then(function () { return Promise.all([Storage.listFavorites(), Storage.listRecents(), Storage.getSetting('tema', 'acik'), besinListesiniTazele(), hareketListesiniTazele()]); })
        .then(function (r) {
          state.favs = new Set(r[0]); state.recents = r[1]; temaUygula(r[2]);
          sonuc('İçe aktarma tamam: ' + d.veri.log.length + ' öğün kaydı, ' + d.veri.ozelBesinler.length +
            ' kendi besin, ' + d.veri.tarifler.length + ' tarif, ' + d.veri.antrenmanGunlugu.length +
            ' antrenman kaydı, ' + d.veri.suKayitlari.length + ' su kaydı geri yüklendi.', false);
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
    Promise.all([Storage.tumLog(), Storage.getSetting('hedefler', VARSAYILAN_HEDEF)]).then(function (r) {
      if (sira !== gun.sira || aktifSayfa !== 'grafikler') return;
      grafikCiz(r[0], r[1]);
    }).catch(function (e) { if (aktifSayfa === 'grafikler') hataGoster(e); });
  }

  function grafikCiz(hepsi, hedefler) {
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
    else trendGrafikleri(hepsi, hedefler);
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
  function trendGrafikleri(hepsi, hedefler) {
    var bugun = yerelTarih(new Date());
    var aralikSec = h('div', { class: 'sekmeler', role: 'group', 'aria-label': 'Zaman aralığı' });
    GRAFIK_ARALIK.forEach(function (a) {
      aralikSec.appendChild(h('button', { type: 'button', 'aria-pressed': String(grafikDurum.aralik === a[0]), text: a[1],
        onclick: function () { grafikDurum.aralik = a[0]; grafiklerSayfasi(); } }));
    });
    content.appendChild(h('div', { class: 'araclar' }, aralikSec));

    /* Aralıktaki her gün; kayıt olmayan gün boş bırakılır (sıfır çizilmez) */
    var etiket = [], kcal = [], protein = [], satir = [], gunMap = {};
    hepsi.forEach(function (k) { (gunMap[k.tarih] = gunMap[k.tarih] || []).push(k); });
    for (var i = grafikDurum.aralik - 1; i >= 0; i--) {
      var t = tarihKaydir(bugun, -i);
      etiket.push(new Date(t + 'T12:00:00').toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' }));
      if (gunMap[t]) {
        var top = hesapla(gunMap[t]).toplam;
        kcal.push(Math.round(top.kcal));
        protein.push(Math.round(top.protein * 10) / 10);
        satir.push([tarihMetni(t), gunMap[t].length, Calc.fmt(top.kcal, 'kcal'), Calc.fmt(top.protein, 'g')]);
      } else { kcal.push(null); protein.push(null); }
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

    /* İki ölçü, iki ayrı grafik: farklı birimler tek eksende karşılaştırılmaz */
    content.appendChild(h('div', { class: 'grafik-ikili' },
      grafikKart('Enerji (kcal)', 'İnce gri çizgi günlük hedefi gösterir.', [
        h('div', { class: 'grafik-alan tip-cizgi' },
          h('canvas', { id: 'g-trend-kcal', role: 'img', 'aria-label': 'Günlük kalori trendi; değerler tabloda listelenmiştir' }))]),
      grafikKart('Protein (g)', 'İnce gri çizgi günlük hedefi gösterir.', [
        h('div', { class: 'grafik-alan tip-cizgi' },
          h('canvas', { id: 'g-trend-protein', role: 'img', 'aria-label': 'Günlük protein trendi; değerler tabloda listelenmiştir' }))])));

    content.appendChild(h('section', { class: 'grafik-kart' },
      h('h2', { text: 'Günlük değerler' }),
      tabloGorunum(['Gün', 'Kayıt', 'kcal', 'Protein (g)'], satir)));

    if (root.Chart) {
      var r = Charts.renkler();
      Charts.trendCizgi('g-trend-kcal', etiket, kcal, { birim: 'kcal', hedef: hedefKcal, renk: r.seri[0] });
      Charts.trendCizgi('g-trend-protein', etiket, protein, { birim: 'g', hedef: hedefProtein, renk: r.seri[1] });
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
    var por = porsiyonDuzenleyici(mevcut ? mevcut.porsiyonlar : null);
    var form = degerFormu(mevcut ? mevcut.degerler : null);
    var durum = h('p', { class: 'durum', role: 'status', 'aria-live': 'polite' });

    function kaydet() {
      var a = ad.value.trim();
      if (!a) { durum.textContent = 'Besin adı boş olamaz.'; durum.className = 'durum hata'; ad.focus(); return; }
      if (form.kaloriBos()) { durum.textContent = 'Kalori (kcal) alanı zorunludur.'; durum.className = 'durum hata'; return; }
      var g = sayi(varsayilan.value);
      if (!(g > 0)) { durum.textContent = 'Varsayılan miktar sıfırdan büyük olmalı.'; durum.className = 'durum hata'; return; }
      var kayit = {
        id: mevcut ? mevcut.id : 'k-' + yeniId(),
        ad: a,
        kategori: kategori.value.trim() || 'Kendi besinim',
        varsayilan_g: g,
        porsiyonlar: por.oku(),
        degerler: form.oku(),
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
      h('h2', { text: mevcut ? 'Besini düzenle' : 'Kendi besinimi ekle' }),
      h('button', { type: 'button', class: 'ikincil', text: 'Kapat', onclick: function () { dlg.close(); } })));
    dlg.appendChild(h('div', { class: 'd-govde' },
      h('div', { class: 'form-satir' },
        h('label', { class: 'genis' }, 'Besin adı ', ad),
        h('label', {}, 'Kategori ', kategori),
        h('label', {}, 'Varsayılan miktar (g) ', varsayilan)),
      h('h3', { text: 'Porsiyonlar' }),
      h('p', { class: 'aciklama', text: 'Miktar girerken seçilebilecek tanımlar. "1 ölçek" gibi bir tanım yazarsanız, ekleme sırasında adet çarpanıyla katları da seçilebilir.' }),
      por.eleman,
      h('h3', { text: '100 gram için besin değerleri' }),
      h('p', { class: 'aciklama', text: 'Yalnızca bildiğiniz alanları doldurun. Boş bıraktığınız alan "bilinmiyor" sayılır ve toplamlarda sıfır olarak eklenmez.' }),
      form.eleman,
      h('div', { class: 'araclar' },
        h('button', { type: 'button', text: mevcut ? 'Değişiklikleri kaydet' : 'Besini kaydet', onclick: kaydet }),
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
      dlg.textContent = '';
      dlg.appendChild(ust(baslikMetni));
      dlg.appendChild(h('div', { class: 'd-govde' }, h('div', { class: 'araclar' }, arama, katSec), liste));
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
    Promise.all([Storage.getSetting('hedefler', VARSAYILAN_HEDEF), Storage.getSetting('profil', null)])
      .then(function (r) {
        if (aktifSayfa !== 'hedefler') return;
        hedeflerCiz(r[0] || VARSAYILAN_HEDEF, r[1], ilkDurum);
      }).catch(function (e) { if (aktifSayfa === 'hedefler') hataGoster(e); });
  }

  function hedeflerCiz(hedefler, profil, ilkDurum) {
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
      if (hataliAd) { durum.textContent = hataliAd + ' hedefi sıfırdan büyük olmalı.'; durum.className = 'durum hata'; return; }
      Storage.setSetting('hedefler', yeni).then(function () {
        hedeflerSayfasi({ m: 'Hedefler kaydedildi.', hata: false });
      });
    }
    function varsayilana() {
      if (!root.confirm('Hedefler varsayılan değerlere döndürülsün mü?')) return;
      HEDEF_AD.forEach(function (x) { girdi[x[0]].value = String(VARSAYILAN_HEDEF[x[0]]); });
      suGirdi.value = String(VARSAYILAN_HEDEF.su_ml);
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
    var kilo = h('input', { type: 'number', min: 0, step: 'any', 'aria-label': 'Kilo (kg)', value: p.kilo != null ? String(p.kilo) : '' });
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
