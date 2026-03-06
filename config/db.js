const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');

dotenv.config();

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

async function seedAdmin() {
  const email = process.env.ADMIN_EMAIL;
  const plainPassword = process.env.ADMIN_PASSWORD;

  if (!email || !plainPassword) return;

  const [cols] = await pool.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'users'
       AND COLUMN_NAME IN ('password', 'role')`
  );

  const existing = cols.map((c) => c.COLUMN_NAME.toLowerCase());

  if (!existing.includes('password')) {
    await pool.query(
      `ALTER TABLE users ADD COLUMN password VARCHAR(255) NULL`
    );
  }

  if (!existing.includes('role')) {
    await pool.query(
      `ALTER TABLE users ADD COLUMN role ENUM('admin','staff') NOT NULL DEFAULT 'staff'`
    );
  }

  const [rows] = await pool.query(
    `SELECT id FROM users WHERE email = ?`,
    [email]
  );

  if (rows.length === 0) {
    const hash = await bcrypt.hash(plainPassword, 10);
    await pool.query(
      `INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, 'admin')`,
      ['Admin', email, hash]
    );
    console.log('Admin account seeded.');
  }
}

module.exports = pool;
module.exports.seedAdmin = seedAdmin;
