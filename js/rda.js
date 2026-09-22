/* Günlük referans değerler (mikro besin panosu için).
   KAYNAK: ABD FDA "Daily Value" (DV) listesi, 2016 etiketleme düzenlemesi — yetişkin ve 4 yaş üstü.
   Bunlar GENEL referanslardır; yaş, cinsiyet, gebelik ve sağlık durumuna göre değişir.
   Program sağlık/diyet önerisi vermez; bu değerler yalnızca "ne kadarını karşıladım" kıyası içindir.
   ust: true olanlar hedef değil ÜST SINIRDIR (aşılması istenmez). */
(function (root) {
  var DV = {
    vitA:      { deger: 900,  b: 'µg' },
    b1:        { deger: 1.2,  b: 'mg' },
    b2:        { deger: 1.3,  b: 'mg' },
    b3:        { deger: 16,   b: 'mg' },
    b5:        { deger: 5,    b: 'mg' },
    b6:        { deger: 1.7,  b: 'mg' },
    b7:        { deger: 30,   b: 'µg' },
    b9:        { deger: 400,  b: 'µg' },
    b12:       { deger: 2.4,  b: 'µg' },
    vitC:      { deger: 90,   b: 'mg' },
    vitD:      { deger: 20,   b: 'µg' },
    vitE:      { deger: 15,   b: 'mg' },
    vitK:      { deger: 120,  b: 'µg' },

    kalsiyum:  { deger: 1300, b: 'mg' },
    demir:     { deger: 18,   b: 'mg' },
    magnezyum: { deger: 420,  b: 'mg' },
    fosfor:    { deger: 1250, b: 'mg' },
    potasyum:  { deger: 4700, b: 'mg' },
    sodyum:    { deger: 2300, b: 'mg', ust: true },
    cinko:     { deger: 11,   b: 'mg' },
    bakir:     { deger: 0.9,  b: 'mg' },
    manganez:  { deger: 2.3,  b: 'mg' },
    selenyum:  { deger: 55,   b: 'µg' },
    iyot:      { deger: 150,  b: 'µg' }
  };

  root.RDA = {
    DV: DV,
    KAYNAK: 'ABD FDA Daily Value (2016) — yetişkin genel referans',
    /* Bir besin alanı için karşılama yüzdesi; referansı yoksa null. */
    yuzde: function (k, deger) {
      var r = DV[k];
      if (!r || deger == null || !(r.deger > 0)) return null;
      return deger / r.deger * 100;
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
