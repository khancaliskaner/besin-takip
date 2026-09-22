# BESİN TAKİP PROGRAMI — PROJE HAFIZA DOSYASI

> Bu dosya, projenin kalıcı hafızasıdır. Programı geliştiren yapay zekâ (Claude Code vb.) her oturumun başında bu dosyayı okumalı, işlem yaptıkça "GELİŞTİRME GÜNLÜĞÜ" bölümünü güncellemelidir.

---

## 1. PROJE ÖZETİ

Kişisel kullanım için, tamamen **çevrimdışı** çalışan, hafif bir günlük besin takip programı. Kullanıcı günün her öğününe besin ekler; program her besinin ve her öğünün **en ince ayrıntısına kadar** (makro + mikro besinler) değerlerini hesaplar ve **sade, profesyonel grafiklerle** gösterir.

- Kullanıcı: Tek kişi (kendisi). Giriş/üyelik yok.
- Dil: **Türkçe** arayüz.
- Platform: Windows / macOS / Linux masaüstü (kurulumsuz veya minimal kurulum).

## 2. KULLANICI İSTEKLERİ (DEĞİŞTİRİLEMEZ ÇEKİRDEK)

1. **Geniş besin çeşitliliği** — Türk mutfağı ağırlıklı, en az 500+ besin ile başlanmalı; kullanıcı kendi besinini ekleyebilmeli.
2. **Ayrıntılı besin değerleri** — Her besin ve her öğün için tüm makro ve mikro değerler görülebilmeli.
3. **Grafikli, profesyonel, sade, anlaşılır arayüz** — Gereksiz süs yok, okunaklı, tutarlı.
4. **Kalıcı hafıza + hafif + bağımsız** — Veriler bilgisayarda saklanır; internet, hesap, sunucu, bulut gerekmez; program ağır olmaz.

## 3. TEKNİK KARAR (ÖNERİLEN MİMARİ)

**Seçenek A (VARSAYILAN, ÖNERİLEN): Tek dosyalık HTML uygulaması**
- Tek `besin-takip.html` dosyası; çift tıklayınca tarayıcıda açılır. Kurulum yok.
- Veri saklama: **IndexedDB** (ana depo) + düzenli **JSON yedek dışa/içe aktarma**.
- Grafik kütüphanesi: **Chart.js** (min.js dosyası HTML içine gömülü veya yanındaki `lib/` klasöründe; CDN KULLANMA, çevrimdışı çalışmalı).
- Besin veritabanı: `foods.js` (yerel JSON) veya HTML içine gömülü.
- Dosya boyutu hedefi: < 5 MB toplam.

**Seçenek B (alternatif):** Python + SQLite + Tkinter/PySide6 masaüstü uygulaması. Yalnızca kullanıcı özellikle isterse.

> Not: Tarayıcı verisi "site verisi temizle" ile silinebilir; bu yüzden **otomatik yedek hatırlatması** ve **tek tıkla JSON dışa aktarma** zorunludur.

## 4. VERİ MODELİ

### 4.1 Besin (Food)
```
id, ad, kategori, marka(opsiyonel), kaynak ("hazır" | "kullanıcı"),
varsayılan_porsiyon_g, porsiyon_tanımları[{ad:"1 dilim", g:30}],
değerler_100g: { ...bölüm 5'teki tüm alanlar }
```

### 4.2 Öğün Kaydı (LogEntry)
```
id, tarih (YYYY-MM-DD), öğün ("kahvaltı"|"öğle"|"akşam"|"ara öğün"|"özel"),
besin_id, miktar_g, saat(opsiyonel), not(opsiyonel)
```

### 4.3 Hedefler (Goals)
```
kalori, protein_g, karbonhidrat_g, yağ_g, lif_g, su_ml, (isteğe bağlı mikro hedefler)
```

### 4.4 Ayarlar
Tema (açık/koyu), birim, hedefler, son yedek tarihi, kullanıcı profili (boy, kilo, yaş, cinsiyet, aktivite — isteğe bağlı, hedef hesabı için).

## 5. TAKİP EDİLECEK BESİN DEĞERLERİ (100 g başına saklanır, miktara göre ölçeklenir)

**Enerji ve makrolar:** Kalori (kcal), Protein, Karbonhidrat, Şeker, Nişasta, Lif, Toplam yağ, Doymuş yağ, Tekli doymamış, Çoklu doymamış, Trans yağ, Kolesterol, Su.

**Vitaminler:** A, B1 (Tiamin), B2 (Riboflavin), B3 (Niasin), B5, B6, B7 (Biyotin), B9 (Folat), B12, C, D, E, K.

**Mineraller:** Kalsiyum, Demir, Magnezyum, Fosfor, Potasyum, Sodyum, Çinko, Bakır, Manganez, Selenyum, Iyot.

**Diğer:** Kafein, Alkol, Omega-3, Omega-6, Glisemik indeks (biliniyorsa).

> Bilinmeyen değer `null` olarak tutulmalı ve arayüzde "—" gösterilmeli. Bilinmeyen değer 0 sayılmamalı; toplamlarda "eksik veri var" uyarısı verilebilmeli.

## 6. ÖZELLİKLER

### 6.1 Zorunlu (v1)
- **Günlük sayfa:** Tarih seçici (önceki/sonraki gün), 5 öğün bölümü, her öğüne besin ekleme.
- **Besin arama:** Anlık arama, Türkçe karakter toleranslı (ı/i, ş/s, ğ/g...), kategori filtresi, son kullanılanlar ve favoriler.
- **Miktar girişi:** Gram veya tanımlı porsiyon (1 dilim, 1 su bardağı, 1 yemek kaşığı...).
- **Öğün ayrıntısı:** Bir öğünün tıklanınca açılan tam değer tablosu (makro + vitamin + mineral).
- **Besin ayrıntısı:** Her girilen besinin girilen miktar için tam değer tablosu.
- **Günlük özet:** Hedefe göre ilerleme çubukları (kalori, protein, karb, yağ, lif, su).
- **Kendi besinini ekle/düzenle/sil**, kendi tarifini (birden çok besinden oluşan yemek) oluşturma.
- **Kalıcı hafıza** (IndexedDB) + **JSON dışa/içe aktarma** + **CSV dışa aktarma**.
- **Öğünü kopyala** (dünden/başka güne), **favori öğün** kaydetme.

### 6.2 Grafikler (sade ve okunaklı)
1. Günlük **makro dağılımı** (halka grafik: protein/karb/yağ % kalori katkısı).
2. Günlük **kalori dağılımı öğünlere göre** (yatay çubuk).
3. **Hedef karşılaştırma** (ilerleme çubukları, hedefi aşınca renk değişimi).
4. **Haftalık / aylık trend** (çizgi: kalori, protein, kilo, su).
5. **Mikro besin panosu** (vitamin/mineral için % günlük ihtiyaç çubukları).
6. Seçilen besin için **öğün içindeki katkı** (hangi besin ne kadar kalori/protein verdi).

### 6.3 İsteğe bağlı (v2)
- Su takibi, kilo/ölçü takibi, aralıklı oruç zamanlayıcı, haftalık PDF/yazdır raporu, barkod (yok, çevrimdışı olduğu için atla), besin karşılaştırma.

## 7. BESİN VERİTABANI PLANI

- Kaynak önerisi: USDA FoodData Central (açık veri, kamu malı) + Türkiye Besin Kompozisyon Veri Tabanı (TürKomp) bilgileri elle uyarlanarak. Lisans/atıf notu README'ye yazılmalı.
- **Kategoriler:** Tahıl/ekmek, Baklagil, Sebze, Meyve, Et/tavuk/balık, Süt ürünleri, Yumurta, Yağlar, Kuruyemiş/tohum, Tatlı/şekerleme, İçecek, Çorba, Ana yemek (Türk mutfağı), Kahvaltılık, Fast-food, Paketli ürün, Takviye.
- **Mutlaka olmalı (Türk mutfağı örnekleri):** simit, pide, lahmacun, mercimek çorbası, kuru fasulye, pilav, bulgur pilavı, menemen, börek, mantı, köfte, döner, çiğ köfte, baklava, ayran, çay, Türk kahvesi, beyaz peynir, zeytin, bal, pekmez, tahin, helva.
- Her besin için en az: kalori, makrolar, lif, şeker, sodyum. Mikro değerler mümkün olduğunca dolu.
- Veri dosyası ayrı tutulmalı (`foods.json`) — uygulama koduna dokunmadan genişletilebilsin.
- **Hata önleme:** Değerler uydurulmamalı; emin olunmayan besin "doğrulanmamış" işaretlenmeli.

### 7.1 Marka ürünler (2026-09-22, kullanıcı isteği)

Kullanıcı isteğiyle besin veritabanı **525 besine** çıkarıldı (`js/foods-data.js`); hazır (jenerik) besinlerin yanına, mevcut kategoriler içine marka ürünler eklendi:

- **Takviye:** Big Boy, HardLine, ProteinOcean, Weider, MyProtein, Warrior, Optimum Nutrition, Predator Nutrition, Sponser, Vale Fitness whey/vegan/kazein çeşitleri (çikolata/vanilya/muz/çilek/fındık aromaları) + BCAA, glutamin, kreatin HCL, beta-alanin, pre-workout, L-karnitin, multivitamin, balık yağı, ZMA, kolajen, elektrolit tozu, protein bar, weight gainer.
- **Tahıl/ekmek:** Uno, Yeşilvadi, Öz Kaya, Halk Ekmek, Bimeks, Sinangil ekmek çeşitleri + kinoa, karabuğday, esmer pirinç gibi tahıllar.
- **Süt ürünleri:** Sütaş, Pınar, İçim, Eker, Sek, Torku, Danone/Activia süt/yoğurt/ayran/peynir/tereyağı çeşitleri.
- **Paketli ürün:** Lay's, Ruffles, Doritos, Cheetos, Pringles, Ülker, Eti, Torku, Kellogg's, Oreo, Snickers, Mars, Twix, Bounty, M&M's, Skittles.
- **Tatlı/şekerleme:** Ülker, Eti, Şölen, Milka, Toblerone, KitKat + ev tatlıları (kazandibi, güllaç, revani vb.).
- **Kahvaltılık:** Nutella, Komili, Balparmak, Marmarabirlik, Tadım, Dr. Oetker, Tamek, Aroma.
- **İçecek:** Coca-Cola, Pepsi, Fanta, Sprite, Fuse Tea, Lipton, Nescafe, Redbull, Burn, Cappy, Dimes, Uludağ/Yedigün gazoz, Beypazarı.
- **Fast-food:** McDonald's, Burger King, KFC, Domino's, Pizza Hut, Subway, Popeyes, Little Caesars, Simit Sarayı, Starbucks.
- Ayrıca jenerik kategorilere (sebze, meyve, et/balık, baklagil, kuruyemiş, ana yemek, çorba) onlarca yeni kalem eklendi.

Tüm yeni satırlar da **"doğrulanmamış"** — marka değerleri paket etiketlerinden değil, tipik/yaklaşık değerlerden alınmıştır; ambalajdaki gerçek değerle farklılık gösterebilir. `tests/test.html` ile doğrulandı: 525 besin, tekil kimlik, tutarlı makro/porsiyon alanları; yalnızca 5 kalemde bilgilendirici Atwater sapma uyarısı var (test başarısızlığı değil).

## 8. ARAYÜZ İLKELERİ

- Sade, bol boşluklu, tek vurgu rengi; açık ve koyu tema.
- Sol menü: **Bugün · Geçmiş · Grafikler · Besinlerim · Hedefler · Ayarlar/Yedek**.
- Rakamlar okunaklı (tabular-nums), birimler her yerde açık (g, mg, µg, kcal).
- Renk körlüğüne uyumlu palet; renk tek başına anlam taşımasın.
- Mobil uyum şart değil, ama 1280 px altı pencerede bozulmamalı.
- Yükleme < 1 sn, 10 000 kayıtta bile akıcı. *(2026-09-22 doğrulandı: 10.030 kayıtla Geçmiş 11 ms, Bugün 11 ms, Besinlerim 75 ms, Grafikler 334 ms)*
- Tüm kritik işlemlerde (silme, içe aktarma) onay iletişim kutusu.

## 9. KABUL KRİTERLERİ (BİTTİ SAYILMA ŞARTLARI)

- [x] İnternet bağlantısı kapalıyken tüm özellikler çalışıyor. *(dış kaynak/CDN yok — ölçüldü: 12 kaynağın hepsi yerel)*
- [x] Program kapatılıp açılınca veriler duruyor. *(gerçek tarayıcı + IndexedDB ile doğrulandı, 2026-09-22)*
- [x] Yedeği dışa aktar → verileri sil → içe aktar → her şey geri geliyor.
- [x] En az 500 besin, 30+ besin değeri alanı mevcut. *(2026-09-22: **525 besin**, 41 alan; marka ürünler dahil — bkz. bölüm 7.1)*
- [x] Bir besin ve bir öğün için tam ayrıntı tablosu açılabiliyor.
- [x] Grafikler (6.2’deki 1–5) çalışıyor ve doğru toplamları gösteriyor. *(4. maddede kilo/su v2’ye bağlı)*
- [x] Toplamlar elle hesapla karşılaştırıldığında tutuyor (birim testi: örn. 150 g × 52 kcal/100 g = 78 kcal). *(`tests/test.html`)*
- [x] Toplam boyut < 5 MB, ilk açılış < 1 sn. *(352 KB; DOM hazır 137 ms)*

## 10. GELİŞTİRME KURALLARI (YAPAY ZEKÂ İÇİN)

1. Önce bu dosyayı oku. Kapsam dışına çıkma; yeni özellik önermeden önce sor.
2. Kodu küçük, okunabilir modüllere ayır: `data`, `storage`, `calc`, `ui`, `charts`.
3. Hesaplama mantığını arayüzden ayır ve test et.
4. Her adımda çalışır durumda bir sürüm bırak; büyük yeniden yazımlardan kaçın.
5. Dış bağımlılık ekleme (CDN, npm çalışma zamanı bağımlılığı, çevrimiçi API yok).
6. Veri kaybı riski olan değişikliklerde önce yedek al, veri şeması sürümünü artır (`schemaVersion`) ve göç (migration) yaz.
   - **IndexedDB kuralı:** Depo veya **dizin** eklerken `onupgradeneeded` içinde "yoksa oluştur" mantığını **hem depo hem dizin** için ayrı ayrı uygula (`js/storage.js` → `STORES` + `INDEXES`). Yalnızca depo oluşumuna bağlı dizin yaratmak, deponun daha önce dizinsiz oluştuğu tarayıcılarda kalıcı `NotFoundError` üretir (2026-09-22'de yaşandı).
   - Arayüz dosyaları değişince `besin-takip.html` içindeki `?v=` önbellek kırıcısını ve `.surum` etiketini birlikte güncelle.
7. Besin değeri uydurma; kaynak belirt veya "doğrulanmamış" işaretle.
8. Her oturum sonunda aşağıdaki günlüğü güncelle.

## 11. YOL HARİTASI

| Aşama | İçerik | Durum |
|---|---|---|
| 0 | Mimari kararı ve iskelet | ☑ (2026-09-22) |
| 1 | Besin veritabanı (`foods-data.js`) ve arama | ☑ (2026-09-22, sürüm 0.5.2) — **525 / 500+ besin** (marka ürünler dahil), hepsi "doğrulanmamış" |
| 2 | Günlük giriş sayfası + öğünler + hesaplama | ☑ (2026-09-22) — favori öğün kaydetme hariç (Aşama 6'ya bırakıldı) |
| 3 | Kalıcı hafıza (IndexedDB) + yedek/içe aktarma | ☑ (2026-09-22) — gerçek tarayıcıda kalıcılık doğrulandı |
| 4 | Ayrıntı tabloları (besin/öğün) | ☑ Besin ve öğün ayrıntı tabloları hazır (öğün: toplam + besin katkıları + eksik veri notu) |
| 5 | Grafikler | ☑ (2026-09-22, sürüm 0.4.0) — kilo/su trendi v2'ye bağlı |
| 6 | Hedefler, favoriler, kendi besin/tarif | ☑ (2026-09-22, sürüm 0.5.0) |
| 7 | Cilalama, tema, test, kabul kriterleri | ☑ (2026-09-22, sürüm 0.5.1) |

## 12. KARARLAR VE NOTLAR

- (Karar) Çevrimdışı tek dosya HTML + IndexedDB varsayılan mimari.
- (Not) Sağlık/diyet önerisi verilmez; program yalnızca kayıt ve bilgilendirme aracıdır. Ciddi diyet veya sağlık durumları için uzmana danışılmalıdır.

## 13. GELİŞTİRME GÜNLÜĞÜ

| Tarih | Yapılan | Sonraki adım |
|---|---|---|
| 2026-09-21 | Proje şartnamesi/hafıza dosyası oluşturuldu. | Aşama 0: mimari onayı ve iskelet |
| 2026-09-22 | **Aşama 0 tamam, Aşama 1 kısmen.** Klasör yapısı: `besin-takip.html`, `css/style.css`, `js/{nutrients,calc,storage,foods-data,foods,ui}.js`, `lib/chart.umd.min.js` (Chart.js 4.4.7, yerel), `tests/test.html`. 41 besin alanı tanımlandı. 205 besin girildi (Türk mutfağı dahil), hepsi yaklaşık değer ve "doğrulanmamış" (USDA/TürKomp tipik değerleri; kaynağa karşı doğrulanmadı). Besinlerim sayfası: Türkçe karakter toleranslı arama, kategori filtresi, favori, son kullanılanlar, ayrıntı penceresi (gram/porsiyon ile tam değer tablosu, "—" = bilinmiyor). Tema (açık/koyu) kalıcı. Testler: `tests/test.html` tarayıcıda açılır (headless Edge ile de çalıştırıldı) — tümü geçti; Atwater kalori tutarlılığı uyarısı yalnızca Limon (USDA'nın kendi değeri). IndexedDB açılışına 3 sn zaman aşımı + bellek moduna düşme eklendi (headless ortamda IDB hiç yanıt vermedi). | Besin sayısını 500+'a çıkar ve değerleri kaynağa karşı doğrula (Aşama 1'i bitir); sonra Aşama 2: günlük sayfa + öğünler |
| 2026-09-22 | **Aşama 2 tamam** (ayrıca Aşama 4'ün öğün ayrıntısı). Kullanıcı kararı: 205 besin şimdilik yeterli, 500+ sonraya bırakıldı. `storage.js` şema sürümü **2**: `log` deposu (`tarih` dizinli) eklendi, mevcut veriye dokunmaz. Bugün sayfası: tarih gezintisi (önceki/sonraki/tarih seçici/bugüne dön), 5 öğün, besin ekleme penceresi (arama → gram/porsiyon → ekle; boş aramada son kullanılanlar+favoriler), yerinde miktar düzenleme, onaylı silme, "Başka günden kopyala", öğün ayrıntısı, günlük özet çubukları (kalori/protein/karb/yağ/lif; hedef aşılınca çizgili desen + "hedef aşıldı" yazısı, yalnızca renk değil). Hiçbir besinde verisi olmayan değer toplamda "—" gösterilir, kısmen eksikse not düşülür. Varsayılan hedefler sabit (2000 kcal, 100 g protein, 250 g karb, 70 g yağ, 30 g lif) — düzenleme Aşama 6. Otomatik denendi: ekleme (Ayran 200 g = 72 kcal) ve kopyalama (elma 180 g = 94 kcal) doğru. | Aşama 3: JSON/CSV dışa-içe aktarma + yedek hatırlatması, Geçmiş sayfası |
| 2026-09-22 | **Aşama 3 tamam.** Yeni `js/backup.js` (paketleme, doğrulama, sürüm göçü, CSV). Ayarlar/Yedek sayfası: JSON yedek (tüm veri), CSV dışa aktarma (öğün kayıtları + her kaydın 40 besin değeri; `;` ayraç, ondalık virgül, UTF-8 BOM → Türkçe Excel; formül enjeksiyonuna karşı `'` öneki), yedekten geri yükleme, depolama durumu, "Tüm verileri sil" (onay + "SİL" yazma). Geri yükleme ve silmeden önce mevcut veri otomatik JSON olarak indirilir (kural 6). İçe aktarma yalnızca doğrulanmış dosyayı kabul eder (uygulama imzası, sürüm ≤ güncel, tarih/öğün/miktar/yinelenen kimlik denetimi) ve tüm depoları tek IndexedDB işleminde değiştirir; hata olursa hiçbir şey değişmez. Eski (v1) yedekler `goc()` ile yükseltilir. Yedek hatırlatması: kayıt varsa ve son yedek yok/7 günden eskiyse üstte bant. Geçmiş sayfası: kayıtlı günler (30 gün/90 gün/1 yıl/tümü), günlük toplamlar, tıklayınca o gün açılır. Testler: yedekleme mantığı + depolama gidiş-dönüşü (yedek → sil → geri yükle) `tests/test.html` içinde geçti; arayüzden uçtan uca (kayıt → yedek → sil → dosyadan içe aktar → 4/4 kayıt geri geldi; bozuk dosya reddedildi, veri değişmedi) headless denendi. | Aşama 5: grafikler (Chart.js) — Aşama 4 zaten tamam; sonra Aşama 6 |
| 2026-09-22 | **Sürüm 0.3.1 (hata bildirimi: "Bugün sekmesi boş").** Gerçek Edge + gerçek IndexedDB ile (CDP) denendi: temiz profil, v1 veritabanından yükseltme ve kalıcılık (kapat-aç) sorunsuz; sorun yeniden üretilemedi. Olası neden: eski dosyaların tarayıcı önbelleğinde kalması veya depolamanın takılması. Sağlamlaştırma: varlık adreslerine `?v=` önbellek kırıcı, menüde sürüm etiketi, "Yükleniyor…" metni, boş sayfa yerine görünür hata ekranı (`hataGoster`), depolama işlemlerine 8 sn / açılışa 6 sn zaman aşımı, eski önbellek tespiti. Her sürüm değişiminde `besin-takip.html` içindeki `?v=` ve sürüm etiketi güncellenmeli. | Kullanıcının tarayıcısı/ekranı öğrenilecek; Aşama 5 |
| 2026-09-22 | **Sürüm 0.3.3 — "Bugün" ekranındaki `NotFoundError` çözüldü.** Kök neden: `log` deposu, `tarih` dizini eklenmeden önceki bir anda oluşmuştu; `onupgradeneeded` yalnızca **depo yokken** dizin yarattığı için mevcut veritabanında dizin hiç oluşmadı ve `listLogByDate` her açılışta patladı. Düzeltme: **şema sürümü 3**; yükseltmede depo varsa yükseltme işlemi üzerinden açılıp **eksik dizinler onarılıyor** (`INDEXES` haritası; kayıtlar korunur, `createIndex` mevcut kayıtları indeksler). Savunma: dizin yine yoksa `listLogByDate` tüm kayıtları okuyup süzüyor (çökme yok). Çoklu sekme: `onblocked` için açık Türkçe mesaj, ayrıca `onversionchange` ile bağlantı otomatik bırakılıyor (eski sekme yükseltmeyi engellemiyor) — test sırasında `open()` ikinci kez çağrılınca eski bağlantının sızdığı ve yanlış bağlantının kapatıldığı ikinci bir hata bulunup düzeltildi. `Backup.goc()` artık hedef sürümü parametre alıyor (v1→v2→v3; yedek biçimi v3'te değişmedi). Doğrulama: kullanıcının bozuk v2 veritabanı hem `file://` hem **HTTP (Live Server taklidi)** üzerinde yeniden üretildi → onarıldı, kayıtlar korundu, besin ekleme çalıştı; tüm birim testleri geçti. | Aşama 5: grafikler |
| 2026-09-22 | **Aşama 5 tamam — Grafikler (sürüm 0.4.0).** Yeni `js/charts.js` (Chart.js sarmalayıcısı) ve `js/rda.js` (günlük referans değerler, kaynak: ABD FDA Daily Value 2016, yetişkin genel referans — kişisel ihtiyaç değişir, sağlık önerisi verilmez). Grafikler sayfası iki sekme: **Seçili gün** (tarih filtresi; öne çıkan toplam enerji, makro dağılımı halkası, öğünlere göre enerji yatay çubuğu, 24 maddelik mikro besin panosu) ve **Trend** (7/30/90 gün; enerji ve protein ayrı çizgilerde + hedef referans çizgisi). Hedef karşılaştırma çubukları Bugün sayfasında, besin katkısı öğün ayrıntısında zaten vardı — 6.2'deki 1–6 karşılandı (4. maddedeki kilo/su v2'ye bağlı). **Renk paleti hesaplandı, göz kararı yapılmadı:** dataviz referans paletinin 1–3. yuvaları, kendi yüzey renklerimize karşı doğrulayıcıyla sınandı — her iki modda renk körlüğü (CVD ΔE 9,2 açık / 9,4 koyu) ve normal görme (24,0 / 20,9) kapıları geçti; açık modda 3. yuva kontrastı 2,82:1 olduğu için **her grafikte görünür değer etiketi + açılır tablo görünümü** zorunlu tutuldu, böylece renk hiçbir yerde tek başına anlam taşımıyor. Farklı ölçekli ölçüler (kcal / g) tek grafikte ikinci eksene konmadı, ayrı grafiklere bölündü. Chart.js animasyonu kapatıldı (anında çizim, hareket duyarlılığı, büyük veri). Görsel incelemede iki hata bulundu ve düzeltildi: (1) grafik alanının `cubuk` sınıfı Bugün sayfasının ilerleme çubuğu stiliyle çakışıp zemini yeşile boyuyordu → `tip-cubuk`/`tip-halka`/`tip-cizgi` olarak ayrıldı; (2) hedef çizgisi üst kenarda ızgaraya yapışıyor, çizgi uç etiketi sağa taşıp çizilmiyordu → eksene pay (`grace`) eklendi, etiket taşarsa noktanın soluna/çubuğun içine alınıyor (asla kırpılmıyor). Ölçüm: açılış DOM hazır **137 ms**, toplam **352 KB**, dış kaynak **yok**. Testler: RDA eşleme/birim ve makro enerji testleri eklendi, tümü geçti. | Aşama 6: hedef düzenleme, favori öğün, kendi besin/tarif |
| 2026-09-22 | **Porsiyon adet çarpanı (sürüm 0.4.1).** Kullanıcı isteği: "1 ölçek whey 30 g, 2 ölçek 60 g gibi". Katları veri dosyasına elle yazmak yerine porsiyon seçicisine **adet alanı** eklendi: "1 ölçek (30 g) × 2 = 60 g". Tek ortak bileşen (`porsiyonSecici`) hem besin ayrıntısı hem öğüne ekleme penceresinde kullanılıyor, böylece **205 besnin tamamına** birden uygulandı; ondalık da serbest (0,5 dilim). Gram elle yazılınca porsiyon seçimi temizlenir. Doğrulandı: 1 ölçek=30 g, 2 ölçek=60 g/240 kcal, 0,5 ölçek=15 g/60 kcal. | Aşama 6 |
| 2026-09-22 | **Aşama 6 tamam (sürüm 0.5.0).** **Şema 4**: `ozelBesinler`, `tarifler`, `favoriOgunler` depoları; v3→v4 göçü yazıldı, yedek biçimine eklendi ve her bölüm için içerik doğrulaması kondu (ad/kimlik/miktar/bileşen denetimleri). **Hedefler sayfası**: beş hedefin düzenlenmesi, makro–kalori tutarlılık uyarısı, "kaloriyi makrolara dağıt" (4/4/9), Mifflin-St Jeor ile **kaba enerji tahmini** (profil kaydedilir; sağlık/diyet önerisi olmadığı açıkça yazılı — bölüm 12'ye uygun). **Kendi besinim**: 41 alanlı form (makrolar açık, vitamin/mineral katlanır), boş alan `null` kalır (0 sayılmaz), porsiyon satırları elle tanımlanır. **Tarif**: bileşen ekle/çıkar, bileşenlerden 100 g değerleri hesaplanır, pişme kaybı için toplam ağırlık elle düzeltilebilir, canlı önizleme; tarif içinde tarif seçilemez (döngü engellendi). **Favori öğün**: bir öğünü adıyla kaydet, tek tıkla başka güne/öğüne ekle, sil; silinmiş besin varsa kalem atlanır ve sayısı bildirilir. Kendi besin/tarif Besinlerim sayfasında "Kendi besinlerim" sekmesinde, etiketli ve Düzenle/Sil düğmeli. Silmeden önce o besnin kaç öğün kaydında kullanıldığı sayılıp kullanıcıya bildiriliyor. Doğrulama sırasında iki hata bulundu ve düzeltildi: (1) yedekten geri yükleme ve "tümünü sil" sonrası kendi besinler arama listesine yüklenmiyordu (`besinListesiniTazele` eklendi); (2) "doğrulanmamış" uyarısı kullanıcının kendi besinlerini de sayıyordu — artık yalnızca hazır veritabanını sayıyor. Uçtan uca doğrulandı: kendi besin + tarif + favori öğün → yedek al → tümünü sil (Foods 205'e düştü) → geri yükle (207, tarif 124,6 kcal korundu). Tüm testler geçti (yeni: şema 4 paketi, v3→v4 göçü, 7 bozuk-kayıt reddi, tarif hesabı, Foods.guncelle). | Aşama 7 (cilalama/test) veya besin veritabanını 500+'a çıkarma |
| 2026-09-22 | **Aşama 7 tamam (sürüm 0.5.1) — cilalama, tema, test, kabul kriterleri.** Kod düzeyinde tarama: yorum/TODO kalmadı, tekrar eden fonksiyon tanımı yok, konsola debug çıktısı yok. Görsel/işlevsel doğrulama: 1000 px ve 1280 px pencerede yatay taşma yok (Hedefler, Kendi besinim formu, Grafikler); koyu tema yeni eklenen tüm bileşenlerde (Hedefler, Kendi besinim/Tarif formları) doğru uygulanıyor. Uçtan uca denendi: kendi besin düzenleme (yeniden kayıt yerine güncelleniyor, tekilliği korunuyor), silme onay mesajı (kaç öğün kaydında kullanıldığını bildiriyor), hedeflerin sayfa yenilemesinden sonra kalıcılığı, öğün satırı silme onayı. **Daha önce hiç test edilmemiş kabul kriteri doğrulandı:** "10 000 kayıtta akıcı" — 10.030 gerçek IndexedDB kaydıyla ölçüldü: Bugün 11 ms, Geçmiş 11 ms, Besinlerim (207 satır) 75 ms, Grafikler (Chart.js dahil) 334 ms; hepsi rahat sınırlar içinde. Bulunan/düzeltilen sorun yok (önceki aşamalarda bulunanlar zaten giderilmişti). Kabul kriterleri (bölüm 9) ve arayüz ilkeleri (bölüm 8) tek tek gözden geçirildi ve belgelendi; yalnızca "500 besin" maddesi kullanıcı kararıyla açık bırakıldı. | Kullanıcı kararıyla: besin veritabanını 500+'a çıkarma ve diğer geliştirmeler ileride ele alınacak |
| 2026-09-22 | **Besin veritabanı 205 → 525 (sürüm 0.5.2), kullanıcı isteği.** `js/foods-data.js`'e ~320 yeni satır eklendi: whey/takviye markaları (Big Boy, HardLine, ProteinOcean, Weider, MyProtein, Optimum Nutrition, Warrior, Predator, Sponser, Vale Fitness — çoklu aroma), ekmek markaları (Uno, Yeşilvadi, Öz Kaya, Halk Ekmek, Bimeks, Sinangil), süt ürünü markaları (Sütaş, Pınar, İçim, Eker, Sek, Torku, Danone/Activia), paketli atıştırmalık markaları (Lay's, Doritos, Cheetos, Pringles, Ülker, Eti, Kellogg's, Snickers, Mars vb.), fast-food zincirleri (McDonald's, Burger King, KFC, Domino's, Subway, Starbucks vb.), içecek markaları (Coca-Cola, Pepsi, Fanta, Redbull, Nescafe vb.) + jenerik sebze/meyve/et-balık/baklagil/kuruyemiş/ana yemek/çorba/tatlı genişlemesi. Ayrıntılar bölüm 7.1'de. Doğrulama: `tests/test.html` 525 besinle tüm testleri geçti (tekil kimlik, pozitif porsiyon, makro toplamı ≤101, şeker≤karb, doymuş≤yağ); yalnızca 5 kalemde bilgilendirici Atwater sapma uyarısı (test başarısızlığı değil, gerçek USDA verilerinde de görülen bilinen bir durum). Arayüzden doğrulandı: Türkçe karakter toleranslı arama marka adlarını buluyor ("sutas" → Sütaş), porsiyon adet çarpanı yeni ürünlerde de doğru (2 ölçek Big Boy Whey = 66 g = 249 kcal). Toplam boyut 436 KB (hedef 5 MB altı). Kabul kriteri "en az 500 besin" artık işaretli. | Kullanıcı kararıyla ertelenenler: kalan gelecek geliştirmeler (kilo/su takibi vb.) |
| 2026-09-22 | **Besinlerim ve besin ekleme kategoriye göre düzenlendi (sürüm 0.5.3), kullanıcı geri bildirimi: "besin kısmı çok karışık".** 525 besinlik düz alfabetik liste karışık geliyordu. `KATEGORI_SIRA` sabiti eklendi (Kahvaltılık, Ana yemek, Çorba, Fast-food, Tahıl/ekmek, Sebze, Meyve… — öğün akışına göre, alfabetik değil) ve `kategorilerSirali()` yardımcı fonksiyonu üç yerde kullanılıyor: (1) Besinlerim'in kategori açılır menüsü artık bu sırada; (2) **Tümü** sekmesinde arama/kategori filtresi yokken liste kategori başlıklarıyla gruplanıyor (`grup-baslik` satırları, besin sayısı parantez içinde) — filtre veya arama varken gruplama kapanıyor (zaten anlamlı sıralı); (3) hem Bugün sayfasındaki "+ Besin ekle" penceresine hem Tarif'in "+ Bileşen ekle" penceresine aynı kategori açılır menüsü eklendi (tarif seçicisinde "Tarif" kategorisi döngü olmasın diye hariç tutuldu). Doğrulandı: Kahvaltı öğününe eklerken "Fast-food" seçince yalnızca fast-food kalemleri listeleniyor; "Kendi besinlerim" gibi diğer sekmeler gruplanmıyor (zaten dar liste). | Kullanıcının onayı bekleniyor; sonrasında kullanıcı kararıyla ertelenen işler |

**Notlar (Aşama 3):** Yedek dosyası `sonYedek` ayarını içermez (cihaza özgü). Yedeğe özel besinler (Aşama 6) eklendiğinde `schemaVersion` artırılıp `goc()`'a adım eklenmeli. Kabul kriteri "yedek → sil → içe aktar" otomatik doğrulandı; gerçek tarayıcıda (IndexedDB) elle de denenmeli.

**Notlar (Aşama 2):** Su hedefi/takibi özetten çıkarıldı (v2 özelliği; besin "su" değeri gram olarak ayrıca tutuluyor). Grafikler Aşama 5'te. Gerçek tarayıcıda IndexedDB kalıcılığı hâlâ elle denenmedi (headless ortamda bellek moduna düşüyor).

**Notlar (Aşama 0–1):** Uygulama `file://` ile açılır; `fetch` çalışmadığı için besin verisi `foods.json` yerine `js/foods-data.js` (script) olarak tutuluyor. Veri satır biçimi dosyanın başında açıklı. Node kurulu değil; testler tarayıcıda çalışır. Gerçek (görünür) tarayıcıda IndexedDB kalıcılığı henüz elle denenmedi.

---

## 14. BAŞLATMA İSTEMİ (kopyala-yapıştır)

> "Bu klasördeki `besin-takip.md` dosyasını oku. Bu, projenin hafıza ve şartname dosyası. Aşama 0'dan başla: çevrimdışı çalışan, tek dosyalık HTML + IndexedDB mimarisiyle iskeleti kur, sonra Aşama 1'e geç. Her aşama sonunda çalışır sürüm bırak ve dosyadaki Geliştirme Günlüğü ile Yol Haritası'nı güncelle."
