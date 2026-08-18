# kalkulator-harga-shopee
Aplikasi sederhana dengan nodejs, express, bettersqlite. Berfungsi untuk menghitung harga display rekomendasi
=======
# 🛍️ Kalkulator Harga Shopee (PWA)

Aplikasi kalkulator finansial interaktif berbentuk **Progressive Web App (PWA)** yang dirancang khusus untuk penjual (*seller*) Shopee. Aplikasi ini membantu menghitung rekomendasi harga jual *display* secara tepat agar profit target yang diincar tidak tergerus oleh berbagai komisi platform, biaya kampanye, voucher, hingga pajak.

---

## ✨ Fitur Utama

- 📱 **Progressive Web App (PWA):** Dapat di-install langsung di HP (Android/iOS) maupun Desktop, mendukung akses secara offline.
- 💰 **Precision Pricing Engine:** Menghitung akumulasi modal, target profit, dan persentase komisi platform secara transparan.
- 📊 **Manajemen Riwayat Kalkulasi:** Simpan hasil kalkulasi ke database SQLite internal, lihat riwayat kapan saja, atau hapus riwayat yang tidak diperlukan.
- ⚡ **Modern UI/UX:** Tampilan bersih, cepat, dan responsif menggunakan Tailwind CSS.
- 🐳 **Docker-Ready:** Dilengkapi dengan *Multi-Stage Dockerfile* yang siap di-deploy ke server mana pun dalam satu langkah.

---

## 🧮 Logika Perhitungan

1. **Total Persentase Biaya ($\%_{\text{total}}$):**
   $$\%_{\text{total}} = \text{Biaya Resiko} + \text{Payment} + \text{Campaign} + \text{Promo} + \text{Voucher} + \text{Affiliate} + \text{Flash Sale} + \text{Pajak}$$

2. **Modal + Profit ($\text{Base Price}$):**
   $$\text{Base Price} = \text{HPP} + \text{Target Profit}$$

3. **Rekomendasi Harga Display:**
   $$\text{Harga Display} = \text{Base Price} + (\text{Base Price} \times \%_{\text{total}})$$

---

## 🛠️ Tech Stack

- **Frontend:** React 18, Vite, Tailwind CSS, `vite-plugin-pwa`
- **Backend:** Node.js 22, Express.js
- **Database:** SQLite (`better-sqlite3`)
- **Containerization:** Docker (Multi-stage Build)

---

## 🚀 Cara Menjalankan Aplikasi

### Menggunakan Docker (Rekomendasi)

1. **Clone Repositori:**
   ```bash
   git clone [https://github.com/username/kalkulator-shopee-pwa.git](https://github.com/username/kalkulator-shopee-pwa.git)
   cd kalkulator-shopee-pwa
