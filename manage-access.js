#!/usr/bin/env node
'use strict';

const { DatabaseSync } = require('node:sqlite');

const DB_PATH = process.env.MANAGE_DB || '/data/shopee_calculator.db';

function openDb() {
  const db = new DatabaseSync(DB_PATH);
  db.exec('PRAGMA busy_timeout = 5000');
  return db;
}

function getUsers(db) {
  return db
    .prepare(
      `SELECT u.id, u.email, u.isActivated, u.accessExpiresAt,
         CASE WHEN u.accessExpiresAt IS NULL THEN 'unlimited'
              WHEN u.accessExpiresAt <= datetime('now') THEN 'expired'
              ELSE 'active' END AS accessState,
         CASE WHEN u.accessExpiresAt IS NULL THEN NULL
              ELSE CAST(julianday(u.accessExpiresAt) - julianday('now') AS INTEGER) END AS daysLeft
       FROM users u ORDER BY u.id`
    )
    .all();
}

function formatExpiry(row) {
  if (row.accessState === 'unlimited') {
    return { berakhir: 'tanpa batas', sisa: '∞' };
  }
  const date = String(row.accessExpiresAt).slice(0, 16);
  if (row.accessState === 'expired') {
    return { berakhir: date, sisa: 'HABIS' };
  }
  const hari = row.daysLeft === null ? '?' : `${row.daysLeft} hari`;
  return { berakhir: date, sisa: hari };
}

function statusLabel(row) {
  if (!row.isActivated) return 'belum aktif';
  if (row.accessState === 'expired') return 'KEDALUWARSA';
  return 'aktif';
}

function printAccounts(db) {
  const rows = getUsers(db);
  console.log('');
  if (rows.length === 0) {
    console.log('Belum ada akun terdaftar.');
    return rows;
  }
  const wNo = 3;
  const wEmail = Math.max(5, ...rows.map((r) => r.email.length)) + 2;
  const wStatus = Math.max(6, ...rows.map((r) => statusLabel(r).length)) + 2;
  const fmt = rows.map(formatExpiry);
  const wBerakhir = Math.max(8, ...fmt.map((f) => f.berakhir.length)) + 2;
  const wSisa = Math.max(4, ...fmt.map((f) => f.sisa.length)) + 2;

  const line = `-${'-'.repeat(wNo)}+-${'-'.repeat(wEmail)}+-${'-'.repeat(wStatus)}+-${'-'.repeat(wBerakhir)}+-${'-'.repeat(wSisa)}-`;
  console.log(` No | Email${' '.repeat(wEmail - 8)}| Status${' '.repeat(wStatus - 7)}| Berakhir${' '.repeat(wBerakhir - 9)}| Sisa`);
  console.log(line);
  rows.forEach((r, i) => {
    const f = fmt[i];
    console.log(
      ` ${String(i + 1).padStart(wNo - 1)} | ${r.email.padEnd(wEmail - 1)}| ${statusLabel(r).padEnd(wStatus - 1)}| ${f.berakhir.padEnd(wBerakhir - 1)}| ${f.sisa}`
    );
  });
  console.log(line);
  return rows;
}

function findUserByChoice(rows, choice) {
  const trimmed = choice.trim();
  const asNumber = Number(trimmed);
  if (Number.isInteger(asNumber) && asNumber >= 1 && asNumber <= rows.length) {
    return rows[asNumber - 1];
  }
  return rows.find((r) => r.email.toLowerCase() === trimmed.toLowerCase()) || null;
}

function extendDays(db, email, days) {
  if (!Number.isFinite(days) || days <= 0) throw new Error('Jumlah hari harus angka positif.');
  const result = db
    .prepare(
      `UPDATE users SET accessExpiresAt = datetime(
         CASE WHEN accessExpiresAt IS NULL OR accessExpiresAt <= datetime('now')
              THEN datetime('now')
              ELSE accessExpiresAt END,
         '+' || ? || ' days'
       ) WHERE email = ?`
    )
    .run(String(days), email);
  if (result.changes === 0) throw new Error(`Akun tidak ditemukan: ${email}`);
  const { accessExpiresAt } = db.prepare('SELECT accessExpiresAt FROM users WHERE email = ?').get(email);
  return accessExpiresAt;
}

function setExpiry(db, email, value) {
  let expiry;
  if (/^\+\d+$/.test(value)) {
    expiry = db
      .prepare("SELECT datetime('now', '+' || ? || ' days') AS d")
      .get(value.slice(1)).d;
  } else if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    expiry = `${value} 23:59:59`;
    const check = db.prepare("SELECT datetime(?) AS d").get(expiry).d;
    if (!check || !check.startsWith(value)) throw new Error(`Tanggal tidak valid: ${value}`);
  } else {
    throw new Error('Format harus YYYY-MM-DD atau +N (contoh: 2026-12-31 atau +30)');
  }
  const result = db
    .prepare('UPDATE users SET accessExpiresAt = ? WHERE email = ?')
    .run(expiry, email);
  if (result.changes === 0) throw new Error(`Akun tidak ditemukan: ${email}`);
  return expiry;
}

function unlimit(db, email) {
  const result = db.prepare('UPDATE users SET accessExpiresAt = NULL WHERE email = ?').run(email);
  if (result.changes === 0) throw new Error(`Akun tidak ditemukan: ${email}`);
}

function cmdList(db) {
  printAccounts(db);
}

function cmdExtend(db, email, daysArg) {
  const expiry = extendDays(db, email.trim().toLowerCase(), Number(daysArg));
  console.log(`✓ ${email} diperpanjang hingga ${expiry}`);
}

function cmdSet(db, email, value) {
  const expiry = setExpiry(db, email.trim().toLowerCase(), value);
  console.log(`✓ Masa akses ${email} diset hingga ${expiry}`);
}

function cmdUnlimit(db, email) {
  unlimit(db, email.trim().toLowerCase());
  console.log(`✓ ${email} kini tanpa batas waktu.`);
}

function usage() {
  console.log(`Manajemen masa akses akun.

Pemakaian:
  manage-access                     mode interaktif
  manage-access list                tampilkan semua akun & sisa masa akses
  manage-access extend <email> <hari>   perpanjang masa akses (menumpuk dari sisa)
  manage-access set <email> <YYYY-MM-DD|+N>   set tanggal kedaluwarsa
  manage-access unlimit <email>     hapus batas waktu`);
}

function createLineReader(input, output) {
  const readline = require('node:readline');
  const rl = readline.createInterface({ input, output });
  const buffer = [];
  const takers = [];
  let closed = false;
  rl.on('line', (line) => {
    const take = takers.shift();
    if (take) take(line);
    else buffer.push(line);
  });
  rl.on('close', () => {
    closed = true;
    while (takers.length) takers.shift()('');
  });
  return {
    async ask(prompt) {
      output.write(prompt);
      if (buffer.length) return buffer.shift();
      if (closed) return '';
      return new Promise((resolve) => takers.push(resolve));
    },
    close() {
      rl.close();
    }
  };
}

async function interactive(db) {
  const rl = createLineReader(process.stdin, process.stdout);

  console.log('╔══════════════════════════════════════╗');
  console.log('║      MANAJEMEN MASA AKSES AKUN       ║');
  console.log('╚══════════════════════════════════════╝');

  try {
    for (;;) {
      const rows = printAccounts(db);
      const choice = await rl.ask('\nPilih nomor/email akun (Enter = keluar): ');
      if (!choice.trim()) break;
      const user = findUserByChoice(rows, choice);
      if (!user) {
        console.log('✗ Akun tidak ditemukan.');
        continue;
      }

      for (;;) {
        console.log(`\nAkun: ${user.email} (${statusLabel(user)})`);
        const action = (
          await rl.ask('[1] Perpanjang N hari  [2] Set tanggal  [3] Unlimited  [0] Kembali\nPilihan: ')
        ).trim();

        if (!action) break;
        if (action === '0') break;
        try {
          if (action === '1') {
            const daysInput = await rl.ask('Perpanjang berapa hari? ');
            const expiry = extendDays(db, user.email, Number(daysInput.trim()));
            console.log(`✓ Diperpanjang hingga ${expiry}`);
          } else if (action === '2') {
            const dateInput = (await rl.ask('Tanggal (YYYY-MM-DD atau +N): ')).trim();
            const expiry = setExpiry(db, user.email, dateInput);
            console.log(`✓ Masa akses diset hingga ${expiry}`);
          } else if (action === '3') {
            unlimit(db, user.email);
            console.log('✓ Akun kini tanpa batas waktu.');
          } else {
            console.log('Pilihan tidak dikenal.');
          }
          const fresh = db
            .prepare(
              `SELECT id, email, isActivated, accessExpiresAt,
                 CASE WHEN accessExpiresAt IS NULL THEN 'unlimited'
                      WHEN accessExpiresAt <= datetime('now') THEN 'expired'
                      ELSE 'active' END AS accessState,
                 CASE WHEN accessExpiresAt IS NULL THEN NULL
                      ELSE CAST(julianday(accessExpiresAt) - julianday('now') AS INTEGER) END AS daysLeft
               FROM users WHERE id = ?`
            )
            .get(user.id);
          Object.assign(user, fresh);
        } catch (err) {
          console.log(`✗ ${err.message}`);
        }
        if (['1', '2', '3'].includes(action)) break;
      }
    }
  } finally {
    rl.close();
  }
  console.log('\nSelesai.');
}

async function main() {
  const [cmd, ...args] = process.argv.slice(2);
  const db = openDb();
  try {
    if (!cmd) {
      await interactive(db);
      return;
    }
    switch (cmd.toLowerCase()) {
      case 'list':
        return cmdList(db);
      case 'extend':
        if (args.length < 2) throw new Error('Pemakaian: extend <email> <hari>');
        return cmdExtend(db, args[0], args[1]);
      case 'set':
        if (args.length < 2) throw new Error('Pemakaian: set <email> <YYYY-MM-DD|+N>');
        return cmdSet(db, args[0], args[1]);
      case 'unlimit':
        if (args.length < 1) throw new Error('Pemakaian: unlimit <email>');
        return cmdUnlimit(db, args[0]);
      case 'help':
      case '--help':
      case '-h':
        return usage();
      default:
        usage();
        process.exitCode = 1;
    }
  } catch (err) {
    console.error(`✗ ${err.message}`);
    process.exitCode = 1;
  } finally {
    db.close();
  }
}

main();
