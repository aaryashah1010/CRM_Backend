'use strict';

/**
 * Run once after containers start to create the admin user.
 * Usage:  node scripts/create-admin.js
 * Or:     docker exec -it erp_backend node scripts/create-admin.js
 */

require('dotenv').config();

const bcrypt = require('bcrypt');
const sql = require('mssql');
const readline = require('readline');

const toBool = (v, fallback = false) => {
  if (v === undefined || v === null || v === '') return fallback;
  return ['1', 'true', 'yes', 'y', 'on'].includes(String(v).toLowerCase());
};

const config = {
  server:   process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT, 10) || 1433,
  database: process.env.DB_NAME     || 'erp_crm',
  user:     process.env.DB_USER     || 'sa',
  password: process.env.DB_PASSWORD || '',
  options: {
    encrypt:                toBool(process.env.DB_ENCRYPT, false),
    trustServerCertificate: toBool(process.env.DB_TRUST_SERVER_CERTIFICATE, true),
    enableArithAbort:       true,
  },
  connectionTimeout: parseInt(process.env.DB_CONNECTION_TIMEOUT, 10) || 15000,
  requestTimeout:    parseInt(process.env.DB_REQUEST_TIMEOUT, 10)    || 15000,
};

const ask = (rl, question) => new Promise((resolve) => rl.question(question, resolve));

const run = async () => {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  console.log('\n=== ERP Admin User Setup ===\n');

  const fullName = await ask(rl, 'Full name  [System Admin]: ') || 'System Admin';
  const email    = await ask(rl, 'Email      [admin@erp.local]: ') || 'admin@erp.local';
  const username = await ask(rl, 'Username   [admin]: ') || 'admin';
  const password = await ask(rl, 'Password   (min 8 chars): ');

  rl.close();

  if (password.length < 8) {
    console.error('Password must be at least 8 characters.');
    process.exit(1);
  }

  const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS, 10) || 12;
  const passwordHash = await bcrypt.hash(password, saltRounds);

  const pool = await new sql.ConnectionPool(config).connect();

  const roleResult = await pool.request().query(`SELECT id FROM roles WHERE code = 'admin'`);
  const role = roleResult.recordset[0];
  if (!role) {
    console.error('Admin role not found. Make sure seed data has been applied.');
    await pool.close();
    process.exit(1);
  }

  const existingResult = await pool.request()
    .input('email',    sql.NVarChar(255), email)
    .input('username', sql.NVarChar(100), username)
    .query('SELECT id FROM users WHERE email = @email OR username = @username');
  if (existingResult.recordset.length > 0) {
    console.error('A user with that email or username already exists.');
    await pool.close();
    process.exit(1);
  }

  const insertResult = await pool.request()
    .input('role_id',       sql.BigInt,        role.id)
    .input('full_name',     sql.NVarChar(200), fullName)
    .input('email',         sql.NVarChar(255), email)
    .input('username',      sql.NVarChar(100), username)
    .input('password_hash', sql.NVarChar(255), passwordHash)
    .query(`
      INSERT INTO users (role_id, full_name, email, username, password_hash, is_active)
      OUTPUT INSERTED.id, INSERTED.email, INSERTED.username
      VALUES (@role_id, @full_name, @email, @username, @password_hash, 1)
    `);

  const user = insertResult.recordset[0];
  console.log(`\nAdmin user created successfully:`);
  console.log(`  ID:       ${user.id}`);
  console.log(`  Email:    ${user.email}`);
  console.log(`  Username: ${user.username}`);
  console.log('\nYou can now log in with these credentials.\n');

  await pool.close();
};

run().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
