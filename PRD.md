# Product Requirements Document (PRD)
# Website Pemesanan Makanan Rumah Makan

**Versi:** 1.1
**Tanggal:** 6 Juli 2026
**Status:** Draft

---

## 1. Latar Belakang & Tujuan

Rumah makan membutuhkan sistem pemesanan berbasis website yang memungkinkan pelanggan memesan makanan secara mandiri (self-order) tanpa perlu membuat akun/login, baik dari meja (via scan QR Code) maupun dari luar (misalnya untuk pesan antar/bawa pulang). Pemilik rumah makan membutuhkan dashboard admin untuk mengelola menu, metode pembayaran, informasi restoran, dan melihat rekap keuangan secara real-time.

### 1.1 Tujuan Produk
- Mempermudah pelanggan memesan makanan tanpa hambatan (tanpa login/registrasi).
- Mengurangi beban kerja kasir/pelayan dalam mencatat pesanan manual.
- Memberikan kontrol penuh kepada admin/pemilik untuk mengelola konten dan operasional toko melalui dashboard.
- Mengintegrasikan pembayaran digital otomatis melalui payment gateway **Tripay**.
- Menyediakan rekap keuangan yang akurat dan mudah diakses.

### 1.2 Target Pengguna
| Peran | Deskripsi |
|---|---|
| **Customer (Pelanggan)** | Pengunjung yang memesan makanan, baik dari meja (scan QR) maupun secara umum, tanpa perlu login. |
| **Admin/Owner** | Pemilik atau staf yang mengelola menu, pembayaran, konten restoran, dan rekap keuangan melalui dashboard admin. |

---

## 2. Ruang Lingkup (Scope)

### 2.1 Termasuk dalam Scope
- Halaman pemesanan publik (tanpa login) untuk customer.
- Sistem keranjang belanja (cart) dengan catatan per item, terisolasi per sesi/perangkat.
- Alur checkout dengan input nama pemesan / nomor meja otomatis (dari QR).
- Perhitungan otomatis pajak (PB1) & service charge pada total pesanan.
- Penguncian harga (price snapshot) saat item masuk keranjang.
- Integrasi payment gateway Tripay, termasuk validasi nominal pembayaran.
- Dashboard admin dengan autentikasi (login) untuk mengelola sistem.
- Manajemen menu, kategori, metode pembayaran, profil restoran (nama, logo, banner).
- Rekap dan laporan keuangan.
- Generator QR Code per meja (berbasis token acak).
- Cetak struk/tiket pesanan melalui fitur print bawaan browser (tanpa integrasi hardware printer).

### 2.2 Di Luar Scope (Fase Awal)
- Sistem loyalty/membership pelanggan.
- Aplikasi mobile native (Android/iOS).
- Multi-cabang/multi-tenant restoran.
- Integrasi dengan sistem kasir/POS pihak ketiga.
- Integrasi *hardware* printer thermal (ESC/POS) & *Kitchen Display System* (KDS) — digantikan fitur notifikasi pesanan baru di dashboard + cetak via browser (`window.print()`).
- Fitur *delivery* dengan integrasi ongkir/kurir pihak ketiga.

---

## 3. Alur Pengguna (User Flow)

### 3.1 Alur Customer
1. Customer membuka website — bisa melalui:
   - **Scan QR Code di meja (Dine-in)** → sistem membaca token unik dari URL, mencocokkan ke data meja, lalu **nomor/nama meja otomatis terisi & tertampil** di sistem (tanpa pernah menampilkan token mentah ke customer).
   - **Akses langsung via URL umum (Take-away/Pickup)** → tanpa nomor meja, customer memesan untuk diambil sendiri di kasir. *(Catatan: fitur delivery dengan alamat pengiriman & ongkir tidak termasuk di Fase Awal — lihat Bagian 2.2.)*
2. Customer melihat daftar menu (dikelompokkan per kategori: makanan, minuman, snack, dll).
3. Customer memilih menu → menambahkan ke **keranjang (cart)**.
   - Saat menambahkan item, customer dapat mengisi **catatan** khusus per item (contoh: "tidak pedas", "tanpa es").
   - Customer dapat mengatur jumlah (quantity) tiap item.
   - **Harga setiap item dikunci (price snapshot)** pada saat dimasukkan ke keranjang. Jika admin mengubah harga menu setelah item ada di keranjang, harga di keranjang customer **tidak berubah**; harga baru hanya berlaku untuk penambahan item setelahnya atau pesanan baru.
   - **Keranjang bersifat terisolasi per sesi/perangkat (browser session)** — jika ada 2 orang di meja yang sama scan QR dengan HP masing-masing, keranjang mereka **tidak tergabung/tertukar**. Namun di sisi dashboard admin, seluruh pesanan dari meja yang sama tetap **dikelompokkan (grouped) berdasarkan nomor meja** agar staf dapur/kasir mudah mengenali order per meja.
4. Customer membuka keranjang, meninjau pesanan (bisa edit/hapus item). Ringkasan menampilkan **Subtotal → Service Charge (jika aktif) → Pajak/PB1 (jika aktif) → Grand Total**, sesuai persentase yang diatur admin.
5. Customer menekan tombol **"Pesan Sekarang"**.
6. Sistem menampilkan form checkout:
   - **Jika akses via QR meja** → field nomor meja **terisi otomatis** (read-only/tidak bisa diubah).
   - **Jika akses umum (take-away)** → customer mengisi **nama untuk dipanggil**.
   - Customer dapat (opsional) mengisi **email** — jika diisi, digunakan untuk menerima struk/notifikasi status pembayaran dari Tripay; jika **tidak diisi**, sistem otomatis membuatkan **email placeholder** (misal `order-{nomor_pesanan}@namatoko.com`) agar tetap memenuhi syarat wajib pada API Tripay.
   - Customer memilih **metode pembayaran** (daftar metode diambil dari pengaturan admin, terhubung ke Tripay).
   - **Grand Total final (setelah pajak & service) dikunci dan dikirim ke Tripay** sebagai nominal transaksi — tidak berubah lagi meski admin mengubah harga menu di waktu bersamaan.
7. Customer melanjutkan ke proses pembayaran (redirect/embed halaman pembayaran Tripay sesuai metode yang dipilih). Sesi pembayaran memiliki **batas waktu 30 menit**; jika lewat, pesanan otomatis berstatus *expired* agar meja/slot tidak "terkunci" oleh pesanan yang tidak jadi dibayar.
8. Setelah pembayaran berhasil, customer melihat halaman status pesanan (struk digital: nomor pesanan, nama/meja, daftar item, catatan, rincian pajak/service, total, status pembayaran). Status pesanan (*Menunggu Pembayaran → Diterima → Sedang Disiapkan → Siap Diambil*) **diperbarui otomatis secara berkala** (polling beberapa detik) tanpa perlu customer me-refresh halaman.
9. Dari halaman struk digital, customer dapat menekan tombol **"Pesan Lagi / Tambah Menu"** — sistem akan mengenali meja yang sama (via token) dan membuat pesanan baru yang tetap tertaut ke meja tersebut, agar staf tahu itu tambahan dari meja yang sama.

> **Catatan penting:** Tidak ada tautan/menu yang mengarah ke dashboard admin yang ditampilkan di halaman/alur pemesanan customer. URL dashboard admin bersifat tersembunyi (tidak dipromosikan di UI publik) dan hanya diketahui oleh pihak admin.

### 3.2 Alur Admin
1. Admin membuka URL khusus dashboard admin (tidak tertaut dari halaman pemesanan) dan login menggunakan username & password.
2. Admin diarahkan ke halaman utama dashboard (ringkasan penjualan hari ini, pesanan masuk, dsb).
3. Admin dapat mengakses menu-menu pengaturan (lihat detail di Bagian 4.2).

---

## 4. Fitur Produk

### 4.1 Fitur Customer (Tanpa Login)

| No | Fitur | Deskripsi |
|---|---|---|
| 1 | Lihat Menu | Menampilkan daftar menu beserta foto, nama, harga, deskripsi, dan kategori. |
| 2 | Pencarian & Filter Menu | Customer dapat mencari menu atau filter berdasarkan kategori. |
| 3 | Tambah ke Keranjang | Menambahkan item ke cart, mengatur jumlah, dan menambahkan catatan per item. |
| 4 | Kelola Keranjang | Melihat, mengubah jumlah, mengedit catatan, atau menghapus item dari keranjang sebelum checkout. |
| 5 | Deteksi Nomor Meja via QR | Saat customer scan QR yang ditempel di meja, sistem otomatis mendeteksi & mengisi nomor meja tanpa input manual. |
| 6 | Input Nama Pemesan | Jika tidak melalui QR meja, customer mengisi nama untuk dipanggil saat pesanan siap. |
| 7 | Pilih Metode Pembayaran | Menampilkan metode pembayaran yang aktif (diatur oleh admin), terhubung ke Tripay (contoh: QRIS, Virtual Account, E-wallet, dll — tergantung channel yang diaktifkan admin di Tripay). |
| 8 | Pembayaran Online | Proses pembayaran melalui integrasi API Tripay, termasuk callback status pembayaran otomatis. |
| 9 | Struk & Status Pesanan | Halaman konfirmasi pesanan berisi ringkasan pesanan (termasuk rincian pajak/service charge) dan status pembayaran/pesanan yang **update otomatis secara real-time** (polling berkala) tanpa perlu refresh. |
| 10 | Tampilan Identitas Restoran | Nama restoran, logo, dan banner ditampilkan di halaman pemesanan sesuai pengaturan admin. |
| 11 | Pesan Lagi / Tambah Menu | Dari halaman struk digital, customer di meja yang sama dapat membuat pesanan tambahan yang tetap tertaut ke meja tersebut. |

### 4.2 Fitur Dashboard Admin (Dengan Login)

| No | Fitur | Deskripsi |
|---|---|---|
| 1 | Login Admin | Autentikasi aman untuk mengakses dashboard (username/password, dengan opsi manajemen sesi/logout). |
| 2 | Manajemen Menu | Tambah, edit, hapus menu; atur nama, harga, deskripsi, foto, kategori, dan status ketersediaan (tersedia/habis). |
| 3 | Manajemen Kategori Menu | Tambah/edit/hapus kategori (misal: Makanan Utama, Minuman, Dessert). |
| 4 | Manajemen Metode Pembayaran | Daftar metode pembayaran **diambil otomatis dari Tripay** (melalui API *Payment Channel* Tripay) berdasarkan channel yang sudah dikonfigurasi & diaktifkan (enable) di akun merchant Tripay — admin tidak perlu menambahkan channel secara manual. Admin cukup mengatur **API Key, Private Key, dan Merchant Code Tripay** di dashboard, lalu sistem melakukan sinkronisasi (fetch) daftar channel aktif. Admin dapat memilih channel mana saja (dari hasil sinkronisasi) yang ingin **ditampilkan ke customer** di halaman pemesanan, serta melakukan **refresh/sinkronisasi ulang** jika ada perubahan konfigurasi di sisi Tripay. |
| 5 | Rekap Keuangan | Laporan transaksi harian/mingguan/bulanan: total pendapatan, jumlah pesanan, rincian per metode pembayaran, dan grafik/statistik penjualan. Dapat difilter berdasarkan rentang tanggal. Fitur export laporan (misal ke Excel/PDF). |
| 6 | Manajemen Pesanan | Melihat daftar pesanan masuk secara real-time, **dikelompokkan otomatis berdasarkan nomor meja** untuk order dine-in, detail tiap pesanan (item, catatan, nama/meja, rincian pajak/service, status pembayaran), serta mengubah status pesanan (diterima/diproses/selesai/dibatalkan). |
| 7 | Pengaturan Profil Restoran | Mengatur nama restoran, logo, banner/gambar utama, deskripsi singkat, alamat, dan kontak. |
| 8 | Manajemen Meja & QR Code | Menambahkan data meja (nomor/nama), sistem otomatis men-generate **token acak unik permanen** per meja beserta QR Code yang dicetak & ditempel **satu kali** (dipakai berulang tanpa batas waktu). Admin dapat men-generate ulang (regenerate) token/QR suatu meja **secara manual jika diperlukan saja** (misal QR rusak/dicurigai bocor) — bukan bagian dari operasional rutin; setelah regenerate, QR fisik meja tersebut wajib dicetak & ditempel ulang. |
| 9 | Pengaturan Jam Operasional | Mengatur jam buka/tutup toko; sistem dapat menonaktifkan pemesanan otomatis di luar jam operasional (opsional). |
| 10 | Manajemen Promo/Diskon (Opsional) | Menambahkan kode promo atau diskon menu tertentu. |
| 11 | Manajemen Pengguna Admin (Opsional) | Menambah/menghapus akun admin/staf dengan hak akses berbeda (owner, kasir, dll). |
| 12 | Notifikasi Pesanan Baru | Notifikasi (suara/visual/push) di dashboard saat ada pesanan baru masuk — berfungsi sebagai pengganti tiket dapur fisik tanpa perlu integrasi printer. |
| 13 | Pengaturan Pajak (PB1) & Service Charge | Admin dapat mengaktifkan/menonaktifkan pajak daerah (PB1) dan service charge secara terpisah, masing-masing dengan persentase yang dapat diatur. Perhitungan otomatis diterapkan ke setiap pesanan: `Subtotal + Service Charge + Pajak = Grand Total`. |
| 14 | Cetak Struk/Tiket Pesanan | Admin/kasir dapat mencetak struk pesanan (untuk dapur atau untuk diberikan ke customer take-away) langsung dari halaman detail pesanan menggunakan fitur cetak bawaan browser (`window.print()`) ke printer biasa apa pun yang terpasang — tanpa integrasi API/driver printer thermal khusus. |

---

## 5. Kebutuhan Fungsional Utama

1. Sistem **tidak boleh mewajibkan login/registrasi** apa pun bagi customer untuk melakukan pemesanan.
2. Sistem harus dapat **membedakan sumber akses**: dari QR meja (nomor meja otomatis) vs akses umum (input nama manual).
3. Setiap item di keranjang harus mendukung **catatan teks bebas** (contoh: request tanpa bahan tertentu).
4. Sistem harus terintegrasi dengan **API Tripay** untuk:
   - Mengambil (fetch) daftar metode/channel pembayaran yang aktif secara otomatis dari akun merchant Tripay, tanpa input manual oleh admin.
   - Membuat transaksi pembayaran.
   - Menerima callback/webhook status pembayaran (berhasil/gagal/kedaluwarsa).
   - Menampilkan status pembayaran secara real-time ke customer.
5. URL dashboard admin **tidak boleh ditampilkan/ditautkan** di halaman atau alur pemesanan customer.
6. Dashboard admin harus dilindungi dengan **autentikasi login**, terpisah dari akses publik.
7. Perubahan yang dilakukan admin (menu baru, harga, status metode pembayaran, logo, banner, nama restoran) harus **langsung tercermin** di halaman pemesanan customer tanpa perlu deploy ulang.
8. Sistem harus mencatat setiap transaksi untuk keperluan rekap keuangan (jumlah, waktu, metode pembayaran, status).
9. Sistem harus mendukung **perhitungan otomatis pajak (PB1) & service charge** sesuai konfigurasi admin, dan menyertakannya dalam nominal yang dikirim ke Tripay.
10. Harga item harus **dikunci (snapshot)** pada saat masuk ke keranjang, sehingga perubahan harga oleh admin di tengah sesi customer tidak memengaruhi pesanan yang sedang berjalan.
11. Keranjang harus **terisolasi per sesi/perangkat customer**, namun pesanan tetap **dikelompokkan berdasarkan nomor meja** di sisi dashboard admin.
12. Sistem harus **memvalidasi nominal pembayaran** pada callback Tripay terhadap total pesanan di database sebelum menandai pesanan sebagai lunas; selisih kecil (misal karena biaya admin bank) ditoleransi dalam ambang batas yang wajar (contoh: ≤ Rp 100), selisih di luar itu ditandai untuk ditinjau admin.
13. Sesi pembayaran memiliki batas waktu (default 30 menit); pesanan yang melewati batas waktu otomatis berstatus *expired*.

---

## 6. Kebutuhan Non-Fungsional

| Aspek | Kebutuhan |
|---|---|
| **Keamanan** | Endpoint dashboard admin wajib terautentikasi; data pembayaran tidak disimpan secara sensitif (mengandalkan Tripay sebagai payment processor); gunakan HTTPS. |
| **Performa** | Halaman menu & keranjang harus responsif, idealnya load < 2 detik pada koneksi normal. |
| **Skalabilitas** | Sistem harus mampu menangani lonjakan pesanan pada jam ramai (misal jam makan siang). |
| **Kompatibilitas** | Responsive design — dapat diakses dengan baik dari smartphone (prioritas utama, karena mayoritas akses via scan QR) maupun desktop. |
| **Ketersediaan** | Uptime tinggi, khususnya saat jam operasional restoran. |
| **Auditability** | Setiap transaksi dan perubahan data penting (menu, harga) sebaiknya tercatat log-nya untuk audit. |

---

## 7. Model Data (Gambaran Umum)

- **Restaurant Profile**: nama, logo, banner, deskripsi, alamat, kontak, jam operasional.
- **Category**: id, nama kategori.
- **Menu Item**: id, kategori, nama, deskripsi, harga, foto, status ketersediaan.
- **Table (Meja)**: id, nomor/nama meja (ditampilkan ke customer), `token` (string acak unik, digunakan di URL QR, tidak ditampilkan ke customer), status aktif, `token_regenerated_at`.
- **Tax & Service Config**: `tax_enabled` (bool), `tax_percentage`, `service_enabled` (bool), `service_percentage` — konfigurasi global, berlaku untuk seluruh pesanan.
- **Order (Pesanan)**: id, nomor pesanan, `session_id`/`device_id` (untuk isolasi keranjang per perangkat), `table_id` (untuk pengelompokan pesanan per meja), sumber (meja/umum/take-away), nama pemesan/nomor meja, subtotal, `service_amount`, `tax_amount`, grand total, metode pembayaran, status pembayaran, status pesanan, `parent_order_id` (jika merupakan pesanan tambahan dari "Pesan Lagi"), timestamp.
- **Order Item**: id, `order_id`, `menu_id`, qty, `price_snapshot` (harga saat ditambahkan ke keranjang, terkunci), catatan/notes.
- **Payment Method**: id, `code` (kode channel Tripay, mis. BRIVA), `name`, `group` (VA/E-Wallet/Convenience Store), `type` (direct/redirect), `fee_merchant`, `fee_customer`, `minimum_amount`, `maximum_amount`, `icon_url`, `active` (dari Tripay), `is_shown` (pilihan admin untuk ditampilkan ke customer), `last_synced_at`.
- **Transaction (Tripay)**: `reference` (dari Tripay), `merchant_ref` (nomor pesanan internal), `order_id` terkait, `payment_method`, `amount`, `actual_paid_amount`, `pay_code`/`checkout_url`/`qr_url`, `status` (UNPAID/PAID/FAILED/EXPIRED/REFUND), `paid_at`, `expired_time`, payload callback terakhir.
- **Admin User**: id, username, password (hash), role.

---

## 8. Integrasi Pihak Ketiga

### 8.1 Tripay Payment Gateway

**Mode transaksi:** Closed Payment — nominal ditentukan oleh merchant (sistem kita) dan 1 kode bayar hanya berlaku untuk 1 kali transaksi (sesuai dengan model pemesanan makanan per-order).

**Kredensial yang dibutuhkan (diatur admin di dashboard):**
- `Merchant Code`
- `API Key`
- `Private Key`
- Tersedia 2 mode: **Sandbox** (testing) dan **Production** (live), masing-masing dengan kredensial terpisah. Admin dapat memilih mode aktif dari dashboard.

**A. Sinkronisasi Metode Pembayaran (Otomatis)**
- Endpoint: `GET /merchant/payment-channel`
  - Sandbox: `https://tripay.co.id/api-sandbox/merchant/payment-channel`
  - Production: `https://tripay.co.id/api/merchant/payment-channel`
- Header: `Authorization: Bearer {api_key}`
- Response berisi seluruh channel yang **sudah diaktifkan admin di akun Tripay**, lengkap dengan: kode channel, nama, grup (Virtual Account/E-Wallet/Convenience Store, dll), tipe (`direct`/`redirect`), rincian biaya (fee merchant/customer), batas minimum & maksimum nominal, serta status `active`.
- Sistem melakukan fetch ke endpoint ini dan menyimpan hasilnya sebagai cache lokal (tabel `payment_methods`), sehingga:
  - Admin tinggal memilih (toggle) channel mana yang ingin ditampilkan ke customer, tanpa input manual.
  - Channel yang berstatus `active: false` di sisi Tripay otomatis tidak ditampilkan.
- Sinkronisasi dapat dipicu **manual** (tombol "Sinkronkan" di dashboard) maupun **otomatis berkala** (scheduler, misal setiap beberapa jam).
- Catatan penting: channel dengan tipe **REDIRECT** (OVO, DANA, ShopeePay non-QRIS) akan mengarahkan customer ke halaman pembayaran Tripay, sedangkan tipe **DIRECT** (VA Bank, QRIS, Indomaret/Alfamart) dapat ditampilkan langsung di halaman kita (kode bayar/QR ditampilkan inline).

**B. Pembuatan Transaksi (Saat Customer Checkout)**
- Endpoint: `POST /transaction/create`
- Signature wajib dibuat dengan **HMAC-SHA256**, menggunakan kombinasi `merchant_code + merchant_ref + amount`, dikunci dengan Private Key.
- Parameter utama: `method` (kode channel terpilih), `merchant_ref` (nomor unik pesanan dari sistem kita), `amount`, `customer_name`, `customer_email`, `customer_phone`, `order_items` (rincian item pesanan beserta catatan dapat dimasukkan ke deskripsi/nama item), `callback_url`, `return_url`, `expired_time`.
- Response mengembalikan `pay_code`/nomor VA, `checkout_url` (untuk channel redirect), `qr_string`/`qr_url` (untuk QRIS), serta instruksi pembayaran per channel.
- Karena customer tidak memiliki akun/email tetap, sistem menyediakan field **email opsional** saat checkout. Jika customer mengisi email, digunakan untuk notifikasi/struk dari Tripay. Jika **dikosongkan**, sistem otomatis membuat **email placeholder unik per pesanan** (contoh format: `order-{merchant_ref}@{domain-toko}.com`) agar tetap memenuhi parameter wajib `customer_email` pada API Tripay, tanpa membebani customer untuk mengisi data pribadi.

**C. Callback / Webhook Status Pembayaran**
- Tripay mengirim notifikasi **POST** ke `callback_url` yang didaftarkan setiap kali status transaksi berubah (`PAID`, `FAILED`, `EXPIRED`, `REFUND`).
- Setiap request callback membawa header `X-Callback-Signature` yang **wajib divalidasi** oleh sistem kita: signature dihitung dari HMAC-SHA256 atas raw JSON body, dikunci dengan Private Key. Jika signature tidak cocok, callback wajib ditolak.
- Sistem harus merespon dengan `{"success": true}` agar Tripay tidak mengirim ulang callback (Tripay akan retry hingga 3 kali dengan jeda 2 menit jika respon tidak sesuai).
- Berdasarkan `merchant_ref` dan `reference` pada payload callback, sistem meng-update status pesanan (`order.status_pembayaran`) secara otomatis.
- Sebagai pelengkap (fallback jika callback gagal diterima), sistem juga dapat memanggil endpoint `GET /transaction/check-status` atau `GET /transaction/detail` secara berkala untuk memastikan status transaksi tetap sinkron.
- **Validasi nominal (wajib):** saat menerima callback berstatus `PAID`, sistem harus membandingkan `amount` yang dibayar dengan `total` (Grand Total setelah pajak/service) pesanan yang tersimpan di database sebelum menandai pesanan sebagai lunas. Ini mencegah kemungkinan manipulasi nominal di sisi client sebelum request dikirim ke Tripay.
- **Penanganan selisih nominal (partial/overpayment):** untuk channel VA yang berpotensi memiliki biaya tambahan, sistem mencatat `actual_paid_amount` dari payload callback. Jika selisih antara `actual_paid_amount` dan `total` pesanan berada dalam ambang toleransi (default ≤ Rp 100), pesanan tetap ditandai `PAID`. Jika selisih melebihi ambang tersebut, pesanan ditandai untuk **ditinjau manual oleh admin** di dashboard, bukan otomatis gagal/lunas.

**D. Keamanan Endpoint Callback**
- Endpoint callback di sisi kita harus dapat diakses publik oleh server Tripay (tidak boleh memerlukan login), namun tetap divalidasi lewat signature (poin C).
- Opsional: whitelist IP resmi Tripay (`95.111.200.230` / IPv6 terkait) jika sistem menerapkan pembatasan IP pada endpoint tersebut.

### 8.2 QR Code Meja
- Setiap meja memiliki **token unik acak** (bukan nomor urut polos) yang digenerate sistem, contoh: `namadomain.com/order?t=8f3a1c92-x7z`.
- Token inilah yang di-encode ke dalam QR Code fisik yang ditempel di meja — **bukan nomor meja itu sendiri** — sehingga tidak bisa ditebak/diganti manual oleh customer melalui URL (mencegah orang iseng mengetik ulang URL dengan nomor meja lain).
- **Token bersifat permanen/statis secara default.** Token dibuat **satu kali** saat meja pertama kali didaftarkan, QR dicetak & ditempel **satu kali**, dan dapat **dipakai berulang kali tanpa batas waktu** oleh customer mana pun yang duduk di meja tersebut — tidak ada perubahan otomatis atau kedaluwarsa terhadap token.
- Saat customer scan QR, sistem membaca token dari parameter URL, mencocokkannya ke data meja di database, lalu **menampilkan nomor/nama meja yang sesuai** (contoh: "Meja 5") ke customer di halaman pemesanan & form checkout — read-only, tidak bisa diubah customer.
- Jika token tidak valid/tidak ditemukan, sistem menampilkan halaman pemesanan umum (tanpa info meja) atau pesan error yang sesuai.
- **Regenerate token bersifat manual & opsional** — hanya dilakukan admin pada kondisi khusus, bukan bagian dari operasional rutin, misalnya:
  - QR fisik rusak/hilang dan perlu **dicetak ulang dengan token yang sama** (tidak perlu regenerate sama sekali dalam kasus ini).
  - Admin mencurigai token bocor/disalahgunakan (misal QR difoto & disebar), sehingga sengaja ingin mengganti demi keamanan.
  - Meja fisik diganti/dipindah dan admin ingin reset datanya.
- **Konsekuensi regenerate:** begitu admin menekan tombol regenerate, token lama langsung tidak berlaku dan **QR fisik lama di meja tersebut wajib dicetak ulang & ditempel ulang**, karena kode QR lama akan mengarah ke token yang sudah invalid. Ini adalah trade-off yang disengaja demi keamanan — bukan sesuatu yang terjadi otomatis atau berkala.

---

## 9. Metrik Keberhasilan (Success Metrics)

- Berkurangnya waktu rata-rata proses pemesanan dibanding metode manual.
- Persentase transaksi pembayaran yang berhasil (tanpa kegagalan sistem).
- Jumlah pesanan harian yang diproses melalui sistem.
- Tingkat kepuasan pelanggan terhadap kemudahan pemesanan (tanpa login).
- Akurasi rekap keuangan dibanding pencatatan manual.

---

## 10. Risiko & Mitigasi

| Risiko | Mitigasi |
|---|---|
| Customer salah menekan atau meninggalkan pesanan sebelum bayar | Sediakan status "pending" dengan batas waktu (expired otomatis) sesuai pengaturan Tripay. |
| Callback Tripay gagal diterima (network issue) | Terapkan mekanisme retry/reconciliation berkala untuk mengecek status transaksi ke API Tripay. |
| Nomor meja QR disalahgunakan (dibagikan online) | Menggunakan **token acak unik per meja** (bukan nomor urut polos) di URL QR sehingga tidak bisa ditebak; admin dapat **regenerate token/QR** kapan saja jika dicurigai bocor. |
| URL dashboard admin bocor/ditebak | Gunakan path unik yang sulit ditebak, kombinasikan dengan autentikasi login yang kuat, batasi percobaan login (rate limiting). |
| Keranjang tertukar antar customer di meja yang sama (banyak HP scan QR sama) | Isolasi keranjang berdasarkan sesi/perangkat (session/device ID), namun tetap dikelompokkan per meja di sisi admin agar dapur tidak kebingungan. |
| Harga menu berubah saat customer sedang checkout, menyebabkan selisih tagihan | Terapkan price snapshot — harga dikunci saat item masuk keranjang, bukan saat pembayaran diproses. |
| Manipulasi nominal pembayaran sebelum dikirim ke Tripay | Validasi nominal callback terhadap total pesanan di database sebelum menandai lunas (lihat Bagian 8.1-C). |

---

## 11. Tahapan Pengembangan (Rekomendasi Roadmap)

1. **Fase 1 — Core System**: Manajemen menu, halaman pemesanan customer, keranjang & catatan (dengan isolasi sesi & price snapshot), checkout dasar, pengaturan pajak/service charge.
2. **Fase 2 — Integrasi Pembayaran**: Integrasi Tripay (create transaction & callback, termasuk validasi nominal), pengaturan metode pembayaran di admin.
3. **Fase 3 — Dashboard Admin Lengkap**: Rekap keuangan, manajemen pesanan real-time (grouped per meja), cetak struk via browser, pengaturan profil restoran (nama, logo, banner).
4. **Fase 4 — QR Meja & Penyempurnaan**: Generator QR per meja (token acak), fitur "Pesan Lagi", notifikasi pesanan baru, status pesanan real-time, optimasi UX & performa.
5. **Fase 5 (Opsional)**: Promo/diskon, multi-admin/role, laporan lanjutan.

---

## 12. Lampiran: Keputusan Desain (Sebelumnya Open Questions)

Berikut keputusan final atas pertanyaan terbuka pada draft sebelumnya:

| Pertanyaan | Keputusan |
|---|---|
| Cetak struk fisik? | **Ya, dibutuhkan** — namun cukup melalui fitur cetak bawaan browser (`window.print()`) dari halaman detail pesanan di dashboard admin, tanpa integrasi API/driver printer thermal. Digunakan untuk struk kasir maupun tiket dapur sederhana. |
| Take-away/Delivery? | **Fase Awal: Dine-in (via QR meja) & Take-away/Pickup saja.** Delivery dengan alamat pengiriman & integrasi ongkir (mis. RajaOngkir/kurir) dimasukkan ke *backlog* untuk fase lanjutan, karena menambah kompleksitas manajemen kurir. |
| Masa aktif sesi pembayaran? | **30 menit.** Jika pelanggan tidak menyelesaikan pembayaran dalam waktu tersebut, pesanan otomatis berstatus *expired* agar meja/slot tidak terkunci oleh pesanan yang batal. |
| Histori pesanan tanpa login? | Gunakan **kombinasi cookie/local session yang di-bind ke token meja** — cukup untuk menampilkan pesanan aktif/terakhir jika customer membuka kembali halaman dari meja yang sama, tanpa perlu sistem akun penuh. |

### Item yang secara sadar dikeluarkan dari scope (bukan pertanyaan terbuka, tapi keputusan produk)
- **Kitchen Display System (KDS) & integrasi printer thermal (ESC/POS):** tidak digunakan pada versi ini. Sebagai gantinya, staf dapur/kasir memantau pesanan masuk melalui **Dashboard Admin** (dibuka di laptop/tablet/HP) dengan **notifikasi suara/visual** saat ada pesanan baru (Bagian 4.2 No. 12), dan dapat mencetak struk/tiket via tombol print browser bila sesekali dibutuhkan salinan fisik. Keputusan ini diambil untuk menghindari kompleksitas integrasi hardware (jaringan, driver, kompatibilitas alat) pada versi awal sistem berbasis web murni.
