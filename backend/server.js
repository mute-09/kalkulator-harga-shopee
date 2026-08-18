const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const app = express();
app.use(cors());
app.use(express.json());

// Pastikan folder data/ ada untuk persistent volume
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Inisialisasi SQLite di dalam folder data/
const db = new Database(path.join(dataDir, 'shopee_calculator.db'));

// Buat tabel jika belum ada
db.exec(`
  CREATE TABLE IF NOT EXISTS price_calculations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    productName TEXT,
    hpp REAL,
    targetProfit REAL,
    biayaResiko REAL,
    paymentFee REAL,
    campaignFee REAL,
    promoFee REAL,
    voucherFee REAL,
    affiliateFee REAL,
    flashSaleFee REAL,
    pajakFee REAL,
    totalBiayaPct REAL,
    modalPlusProfit REAL,
    hargaDisplay REAL,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

function calculateShopeePrice(data) {
  const {
    hpp = 0, targetProfit = 0,
    biayaResiko = 0, paymentFee = 0, campaignFee = 0,
    promoFee = 0, voucherFee = 0, affiliateFee = 0,
    flashSaleFee = 0, pajakFee = 0
  } = data;

  const totalBiayaPct = (
    Number(biayaResiko) + Number(paymentFee) + Number(campaignFee) + 
    Number(promoFee) + Number(voucherFee) + Number(affiliateFee) + 
    Number(flashSaleFee) + Number(pajakFee)
  ) / 100;

  const modalPlusProfit = Number(hpp) + Number(targetProfit);
  const hargaDisplay = modalPlusProfit + (modalPlusProfit * totalBiayaPct);

  return {
    modalPlusProfit,
    totalBiayaPct: parseFloat((totalBiayaPct * 100).toFixed(2)),
    hargaDisplay: Math.round(hargaDisplay)
  };
}

// Endpoint API
app.post('/api/save', (req, res) => {
  try {
    const input = req.body;
    const calc = calculateShopeePrice(input);

    const stmt = db.prepare(`
      INSERT INTO price_calculations (
        productName, hpp, targetProfit, biayaResiko, paymentFee,
        campaignFee, promoFee, voucherFee, affiliateFee, flashSaleFee,
        pajakFee, totalBiayaPct, modalPlusProfit, hargaDisplay
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      input.productName || 'Tanpa Nama',
      Number(input.hpp) || 0,
      Number(input.targetProfit) || 0,
      Number(input.biayaResiko) || 0,
      Number(input.paymentFee) || 0,
      Number(input.campaignFee) || 0,
      Number(input.promoFee) || 0,
      Number(input.voucherFee) || 0,
      Number(input.affiliateFee) || 0,
      Number(input.flashSaleFee) || 0,
      Number(input.pajakFee) || 0,
      calc.totalBiayaPct,
      calc.modalPlusProfit,
      calc.hargaDisplay
    );

    const savedData = db.prepare('SELECT * FROM price_calculations WHERE id = ?').get(result.lastInsertRowid);
    res.json({ success: true, data: savedData });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get('/api/history', (req, res) => {
  try {
    const history = db.prepare('SELECT * FROM price_calculations ORDER BY createdAt DESC LIMIT 20').all();
    res.json({ success: true, data: history });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Serve Frontend (Hasil build React/Vite)
const frontendDist = path.join(__dirname, 'public');
app.use(express.static(frontendDist));

app.get('*', (req, res) => {
  res.sendFile(path.join(frontendDist, 'index.html'));
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server berjalan di http://localhost:${PORT}`);
});
