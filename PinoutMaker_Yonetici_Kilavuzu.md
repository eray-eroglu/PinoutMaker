# Pinout Maker - Yönetici Özeti ve Kullanım Kılavuzu

**Pinout Maker**, şirket bünyesinde tasarlanan veya kullanılan elektronik devre kartlarının (board) "Pin Bağlantı Diyagramlarını (Pinout)" hızlı, standartlara uygun ve estetik bir şekilde oluşturmak amacıyla geliştirilmiş profesyonel bir masaüstü aracıdır.

Bu doküman, uygulamanın sunduğu özellikleri ve kullanım akışını özetlemektedir.

---

## 1. Temel İşlevler ve Görsel Yönetimi

- **Görsel Yükleme (Import):** Elektronik kartın fotoğrafı veya çizimi sisteme kolayca yüklenir.
- **Yönlendirme (Rotation):** Yüklenen kart görseli, ihtiyaca göre 90 derecelik açılarla döndürülerek çalışma alanına tam oturtulur.
- **Esnek Çalışma Alanı (Pan & Zoom):** Fare tekerleği ile kart üzerinde istenilen bölgeye yakınlaşılabilir (zoom) ve sürükleme ile devrenin farklı noktaları rahatça incelenebilir.

## 2. Pin (Etiket) Ekleme ve Düzenleme Arayüzü

- **Pin Ekleme:** Üst menüden "Add Pin" (Pin Ekle) modu açılarak kart üzerindeki istenen konumlara tek tıkla pin etiketleri yerleştirilir.
- **Detaylı Özelleştirme (Sağ Panel):** Yerleştirilen her pinin üzerine tıklandığında sağ panel açılır. Bu panelden;
  - Pinin adı/metni değiştirilebilir.
  - Pinin elektriksel işlevine göre (Power, Ground, Analog, I2C, SPI, USB vb.) standartlaştırılmış **renk kodlaması** atanabilir.
  - Özel sinyal tipleri (Örn: PWM) işaretlenebilir.
- **Aralık Ayarı (Gap Size):** Yan yana dizilen pinlerin karmaşık görünmemesi için aralarındaki boşluklar sistem üzerinden dinamik olarak ayarlanabilir.
- **Hızlı Düzenleme:** Herhangi bir pinin üzerine çift tıklandığında sağ taraftaki isim değiştirme alanı otomatik olarak odaklanır.

## 3. Hız ve Verimlilik Araçları (Kısayollar)

Mühendislerin ve teknikerlerin belgelendirme sürecini hızlandırmak için gelişmiş klavye kısayolları sisteme entegre edilmiştir:
- **Kopyala / Yapıştır (Ctrl+C / Ctrl+V):** Benzer özelliğe sahip pinler kopyalanıp yapıştırılarak hızlıca çoğaltılır; sistem yeni pini otomatik olarak eskisinin altına nizami şekilde kaydırır.
- **Geri Al / İleri Al (Ctrl+Z / Ctrl+Y):** Yapılan her işlem kayıt altındadır, hatalı işlemler saniyeler içinde geri alınabilir.
- **Hızlı Silme (Delete / Backspace):** Yanlış eklenen pinler klavyeden tek tuşla silinebilir.


## 4. Proje Kayıt ve Dışa Aktarma Sistemi

- **Projeyi Kaydetme ve Yükleme (Save/Load):** Üzerinde çalışılan kapsamlı bir kart şeması bilgisayara özel bir formatta (.json) kaydedilebilir (Ctrl+S ile hızlı kayıt desteği bulunur) ve daha sonra kaldığı yerden çalışmaya devam edilebilir.
- **Profesyonel PDF Çıktısı (Export PDF):** Hazırlanan diyagram, yüksek kaliteli bir PDF belgesi olarak tek tıkla dışa aktarılır.
- **Otomatik Lejant (Tablo) Üretimi:** Sistem PDF çıktısını alırken, sol alt köşeye otomatik olarak devrede kullanılan pin renklerinin anlamlarını gösteren (Güç, Toprak, USART vb.) profesyonel bir **bilgi tablosu (Lejant)** yerleştirir. Böylece dokümanı okuyan müşteriler veya departmanlar şemayı kolayca anlar.

---

## Yönetime Sağladığı Temel Katkılar
1. **Kurumsal Standartlaşma:** Tüm kart tasarımlarında aynı renk, font ve tasarım dili kullanılarak şirketin profesyonel imajı güçlendirilir.
2. **Hızlandırılmış Dokümantasyon:** Manuel çizim araçları yerine spesifik olarak bu sürece uygun geliştirildiği için dokümantasyon süresini doğrudan kısaltır.
3. **Müşteri ve Ekip İçi İletişim Kolaylığı:** Otomatik üretilen açıklama tabloları (lejant) ve net diyagram çizgileri sayesinde teknik anlaşmazlıklar ve hatalı bağlantı riskleri en aza indirilir.
