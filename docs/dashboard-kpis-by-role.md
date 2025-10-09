# Dashboard KPI Kartları — Role Bazlı Görünürlük

Bu doküman, dashboard’daki KPI kartlarının kullanıcı rolüne göre hangi kombinasyonlarda göründüğünü ve bunların uygulamadaki kaynaklarını özetler. Ayrıca yüzde formatlama, detay paneli ve yeni KPI ekleme rehberini içerir.

## Roller ve Görünen KPI Kartları

Aşağıdaki listeler, ilgili dashboard bileşenlerinde gösterilen kartların etiketlerini yansıtır.

### Forwarder (Taşıyıcı)
Kaynaklar: `src/features/dashboard/compute.ts#computeForwarderKpis`, `src/components/dashboard/role-dashboards.tsx#ForwarderDashboard`
- Active Shipments — key: `active_shipments`
- Quotes Acceptance (%) — key: `acceptance_rate`
- Revenue per Shipment — key: `avg_revenue`
- Quotes Sent — key: `quotes_sent`

Notlar:
- `Quotes Acceptance` yüzde olarak gösterilir (UI’de `%` eklenir).

### Owner (Shipper)
Kaynaklar: `src/features/dashboard/compute.ts#computeShipperKpis`, `src/components/dashboard/role-dashboards.tsx#ShipperDashboard`
- Total Spend — key: `total_spend`
- Shipments in Transit — key: `in_transit`
- Delivery Rate (%) — key: `delivery_rate`
- Open Requests — key: `open_requests`

Notlar:
- `Delivery Rate` yüzde olarak gösterilir (UI’de `%` eklenir).

### Receiver (Alıcı)
Kaynaklar: `src/features/dashboard/compute.ts#computeReceiverKpis`, `src/components/dashboard/role-dashboards.tsx#ReceiverDashboard`
- Incoming Shipments — key: `incoming_shipments`
- Delivery Accuracy (%) — key: `delivery_accuracy`
- Unread Notifications — key: `unread_notifications`

Notlar:
- `Delivery Accuracy` yüzde olarak gösterilir (UI, anahtarda "accuracy" geçtiğinde `%` ekler).

### Customs Officer (Gümrük)
Kaynaklar: `src/components/dashboard/role-dashboards.tsx#CustomsOfficerDashboard` (statik)
- Pending Clearances
- Avg. Processing Time
- Compliance Issues
- Cleared Shipments

## KPI Değerleri Nasıl Hesaplanır?

Hesaplamalar saf (framework bağımsız) fonksiyonlarda yapılır:
- `computeShipperKpis({ shipments, requests })`
- `computeForwarderKpis({ shipments, offers })`
- `computeReceiverKpis({ shipments, notificationsUnread })`

Bu fonksiyonlar şuradadır: `src/features/dashboard/compute.ts`

Veriler, ilgili hook’lar ile Supabase üzerinden çekilir:
- Shipper: `useShipperDashboard(userId)` — `shipments`, `requests`
- Forwarder: `useForwarderDashboard(userId)` — `shipments`, `offers`
- Receiver: `useReceiverDashboard(userId)` — `shipments`, `notifications`

Hook’lar: `src/features/dashboard/hooks.ts`

## Yüzde Formatlama Kuralları

UI tarafında bazı KPI’lar yüzde ile gösterilir:
- Forwarder: `acceptance_rate` → `%` eklenir.
- Shipper: `delivery_rate` → `%` eklenir.
- Receiver: Anahtar adı `accuracy` içeriyorsa → `%` eklenir (`delivery_accuracy`).

Bu formatlama `src/components/dashboard/role-dashboards.tsx` dosyasındaki `KPICards` kullanımında yapılır.

## Kartlar ve Detay Paneli

- Kart bileşeni: `src/components/dashboard/kpi-cards.tsx` (`KPICards`).
- Bir karta tıklanınca açılan panel: `src/components/dashboard/kpi-details-panel.tsx` (`KpiDetailsPanel`).
  - Sekmeler: Overview, Details, Insights
  - Periyot seçimi: 7d / 30d / 90d / custom (placeholder)
  - Trend grafiği: `recharts` LineChart
  - Aksiyonlar: Paylaş, Export (CSV/PDF), Compare (placeholder)

`KpiComputed` tipi (key/label/value/trend/deltaPct/note/headline/series) `src/features/dashboard/compute.ts` içinde tanımlıdır ve hem kartları hem de detay panelini besler.

## Kenar Durumları ve Notlar

- Oranlar (örn. acceptance_rate, delivery_rate, delivery_accuracy) hesaplanırken bölen 0 ise sonuç 0 kabul edilir; trend genellikle `flat` kalır.
- Shipper toplam harcama `net_amount_cents` üzerinden toplanır ve 100’e bölünerek para birimi varsayımsal değer olarak gösterilir (şu an para birimi simgesi UI’da yer almıyor).
- Seriler (series) 7 günlük bucket’lar halinde gruplandırılır; boş veri setinde seri boş döner.
- Receiver’ın `notificationsUnread` değeri okunmamış bildirim sayısını yansıtır (yoksa 0).

## Yeni KPI Ekleme Rehberi

1) Domain verisini belirleyin ve ilgili hook’a dahil edin:
   - Gerekliyse Supabase sorgularını `src/features/dashboard/hooks.ts` içinde ilgili role hook’una ekleyin.
2) KPI hesaplamasını yazın:
   - `src/features/dashboard/compute.ts` içindeki ilgili `compute*` fonksiyonunda yeni bir `KpiComputed` nesnesi döndürün.
   - `key`, `label`, `value`, `trend` zorunludur. `deltaPct`, `note`, `headline`, `series` opsiyoneldir.
3) UI’da gösterin:
   - İlgili role dashboard bileşeninde (`src/components/dashboard/role-dashboards.tsx`), `kpis.map(...)` ile kart listesine otomatik dahil olur.
   - Yüzde gösterimi gerekiyorsa, o rol için map edilirken `%` ekleme kuralını uygulayın (örn. `k.key === 'delivery_rate' ? value + '%' : value`).
4) Detay panelinde doğrulayın:
   - KPI kartına tıklayınca `KpiDetailsPanel` açılır; `series` ve `headline` gibi alanlar otomatik yansır.

## Hızlı Referans — KPI Anahtarları

- Shipper: `total_spend`, `in_transit`, `delivery_rate`, `open_requests`
- Forwarder: `active_shipments`, `acceptance_rate`, `avg_revenue`, `quotes_sent`
- Receiver: `incoming_shipments`, `delivery_accuracy`, `unread_notifications`
- Customs (statik etiketler, key kullanılmıyor)

## Dosya Referansları

- `src/components/dashboard/role-dashboards.tsx` — Rol spesifik sayfa düzenleri ve `KPICards` kullanımı.
- `src/components/dashboard/kpi-cards.tsx` — Kart görünümü ve trend rozetleri.
- `src/components/dashboard/kpi-details-panel.tsx` — KPI tıklanınca açılan detay paneli.
- `src/features/dashboard/hooks.ts` — Supabase veri çekme ve realtime invalidation.
- `src/features/dashboard/compute.ts` — Tüm KPI hesaplama mantığı ve tipler.
