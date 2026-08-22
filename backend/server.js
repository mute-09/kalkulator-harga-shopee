const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
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

const ACTIVATION_TTL_HOURS = 24;
const SESSION_TTL_DAYS = 7;

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    passwordHash TEXT NOT NULL,
    isActivated INTEGER DEFAULT 0,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS activation_codes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    codeHash TEXT NOT NULL,
    expiresAt DATETIME NOT NULL,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    userId INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expiresAt DATETIME NOT NULL,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS price_calculations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER REFERENCES users(id) ON DELETE CASCADE,
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
  );
`);

// Migrasi untuk database lama yang belum punya kolom userId
const calcColumns = db.prepare('PRAGMA table_info(price_calculations)').all();
if (!calcColumns.some((c) => c.name === 'userId')) {
  db.prepare('ALTER TABLE price_calculations ADD COLUMN userId INTEGER').run();
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  const candidate = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, 'hex');
  if (candidate.length !== expected.length) return false;
  return crypto.timingSafeEqual(candidate, expected);
}

function hashCode(code) {
  return crypto.createHash('sha256').update(code).digest('hex');
}

function generateActivationCode() {
  return String(crypto.randomInt(100000, 1000000));
}

function logActivationCode(email, code, expiresAt) {
  console.log('');
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║            🔐 KODE AKTIVASI AKUN BARU             ║');
  console.log('╠══════════════════════════════════════════════════╣');
  console.log(`║  Email        : ${email}`);
  console.log(`║  Kode         : ${code}`);
  console.log(`║  Berlaku sampai: ${expiresAt}`);
  console.log('╚══════════════════════════════════════════════════╝');
  console.log('');
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function createSession(userId) {
  db.prepare("DELETE FROM sessions WHERE expiresAt <= datetime('now')").run();
  const token = crypto.randomBytes(32).toString('hex');
  db.prepare(
    "INSERT INTO sessions (token, userId, expiresAt) VALUES (?, ?, datetime('now', '+' || ? || ' days'))"
  ).run(token, userId, SESSION_TTL_DAYS);
  return token;
}

function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ success: false, message: 'Tidak terautentikasi' });
  }
  const session = db
    .prepare(
      `SELECT u.id, u.email FROM sessions s
       JOIN users u ON u.id = s.userId
       WHERE s.token = ? AND s.expiresAt > datetime('now')`
    )
    .get(token);
  if (!session) {
    return res.status(401).json({ success: false, message: 'Sesi tidak valid atau sudah kedaluwarsa' });
  }
  req.user = { id: session.id, email: session.email };
  next();
}

app.post('/api/auth/signup', (req, res) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');

    if (!isValidEmail(email)) {
      return res.status(400).json({ success: false, message: 'Format email tidak valid' });
    }
    if (password.length < 8) {
      return res.status(400).json({ success: false, message: 'Password minimal 8 karakter' });
    }

    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existing) {
      return res.status(409).json({ success: false, message: 'Email sudah terdaftar' });
    }

    const result = db
      .prepare('INSERT INTO users (email, passwordHash, isActivated) VALUES (?, ?, 0)')
      .run(email, hashPassword(password));
    const userId = result.lastInsertRowid;

    db.prepare("DELETE FROM activation_codes WHERE userId = ? OR expiresAt <= datetime('now')").run(userId);
    const code = generateActivationCode();
    db.prepare(
      "INSERT INTO activation_codes (userId, codeHash, expiresAt) VALUES (?, ?, datetime('now', '+' || ? || ' hours'))"
    ).run(userId, hashCode(code), ACTIVATION_TTL_HOURS);

    logActivationCode(email, code, `${ACTIVATION_TTL_HOURS} jam dari sekarang`);

    res.status(201).json({
      success: true,
      message: 'Pendaftaran berhasil. Kode aktivasi telah dikirim ke log terminal server.'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/auth/resend-code', (req, res) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const user = db.prepare('SELECT id, isActivated FROM users WHERE email = ?').get(email);

    if (!user || user.isActivated) {
      // Respons generik agar tidak membocorkan keberadaan akun
      return res.json({ success: true, message: 'Jika akun valid dan belum aktif, kode baru telah dibuat.' });
    }

    db.prepare("DELETE FROM activation_codes WHERE userId = ? OR expiresAt <= datetime('now')").run(user.id);
    const code = generateActivationCode();
    db.prepare(
      "INSERT INTO activation_codes (userId, codeHash, expiresAt) VALUES (?, ?, datetime('now', '+' || ? || ' hours'))"
    ).run(user.id, hashCode(code), ACTIVATION_TTL_HOURS);

    logActivationCode(email, code, `${ACTIVATION_TTL_HOURS} jam dari sekarang`);

    res.json({
      success: true,
      message: 'Kode aktivasi baru telah dibuat. Silakan cek log terminal server.'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/auth/activate', (req, res) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const code = String(req.body.code || '').trim();

    if (!email || !code) {
      return res.status(400).json({ success: false, message: 'Email dan kode aktivasi wajib diisi' });
    }

    const user = db.prepare('SELECT id, isActivated FROM users WHERE email = ?').get(email);
    if (!user) {
      return res.status(400).json({ success: false, message: 'Email atau kode aktivasi salah' });
    }
    if (user.isActivated) {
      return res.status(400).json({ success: false, message: 'Akun sudah aktif, silakan login' });
    }

    const record = db
      .prepare(
        "SELECT * FROM activation_codes WHERE userId = ? AND expiresAt > datetime('now') ORDER BY id DESC LIMIT 1"
      )
      .get(user.id);

    if (!record || record.codeHash !== hashCode(code)) {
      return res.status(400).json({ success: false, message: 'Kode aktivasi salah atau kedaluwarsa' });
    }

    db.prepare('UPDATE users SET isActivated = 1 WHERE id = ?').run(user.id);
    db.prepare('DELETE FROM activation_codes WHERE userId = ?').run(user.id);

    res.json({ success: true, message: 'Akun berhasil diaktivasi. Silakan login.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/auth/login', (req, res) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');

    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!user || !verifyPassword(password, user.passwordHash)) {
      return res.status(401).json({ success: false, message: 'Email atau password salah' });
    }
    if (!user.isActivated) {
      return res.status(403).json({
        success: false,
        message: 'Akun belum diaktivasi. Cek kode aktivasi di log terminal server.'
      });
    }

    const token = createSession(user.id);
    res.json({
      success: true,
      token,
      user: { id: user.id, email: user.email }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get('/api/auth/me', requireAuth, (req, res) => {
  res.json({ success: true, user: req.user });
});

app.post('/api/auth/logout', requireAuth, (req, res) => {
  try {
    const token = req.headers.authorization.slice(7);
    db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
    res.json({ success: true, message: 'Logout berhasil' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

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

app.post('/api/save', requireAuth, (req, res) => {
  try {
    const input = req.body;
    const calc = calculateShopeePrice(input);

    const stmt = db.prepare(`
      INSERT INTO price_calculations (
        userId, productName, hpp, targetProfit, biayaResiko, paymentFee,
        campaignFee, promoFee, voucherFee, affiliateFee, flashSaleFee,
        pajakFee, totalBiayaPct, modalPlusProfit, hargaDisplay
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      req.user.id,
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

app.get('/api/history', requireAuth, (req, res) => {
  try {
    const history = db
      .prepare('SELECT * FROM price_calculations WHERE userId = ? ORDER BY createdAt DESC LIMIT 20')
      .all(req.user.id);
    res.json({ success: true, data: history });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.delete('/api/history/:id', requireAuth, (req, res) => {
  try {
    const result = db
      .prepare('DELETE FROM price_calculations WHERE id = ? AND userId = ?')
      .run(req.params.id, req.user.id);
    if (result.changes === 0) {
      return res.status(404).json({ success: false, message: 'Riwayat tidak ditemukan' });
    }
    res.json({ success: true, message: 'Riwayat berhasil dihapus' });
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
