// Database Initialization Script
import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const initDatabase = async () => {
  let connection;

  try {
    // Connect without database first
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT) || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      multipleStatements: true,
    });

    console.log('Connected to MySQL server');

    // Read and execute init.sql
    const sqlPath = path.join(__dirname, 'init.sql');
    let sql = fs.readFileSync(sqlPath, 'utf8');

    // Replace placeholder password with actual bcrypt hash
    const hashedPassword = await bcrypt.hash('admin123', 10);
    sql = sql.replace('YourHashedPasswordHere', hashedPassword);

    console.log('Executing database schema...');
    await connection.query(sql);

    console.log('✅ Database initialized successfully!');
    console.log('');
    console.log('Default credentials:');
    console.log('  Email: admin@nexorapm.com');
    console.log('  Password: admin123');
    console.log('');
    console.log('⚠️  IMPORTANT: Change this password in production!');

  } catch (error) {
    console.error('❌ Database initialization failed:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
};

initDatabase();