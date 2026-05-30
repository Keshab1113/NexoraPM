// config/db.js - Optimized for production with proper connection management

import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

// ✅ Optimized connection pool configuration
const pool = mysql.createPool({
  // Connection settings
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT,

  // ✅ Connection pool settings (optimized for production)
  connectionLimit: 50,              // Increased for high concurrency
  waitForConnections: true,         // Queue connections when limit reached
  queueLimit: 100,                  // Limit queue to prevent memory issues

  // ✅ Keep-alive settings (prevents ETIMEDOUT)
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000,    // 10 seconds

  // ✅ Connection timeout settings
  connectTimeout: 20000,            // 20 seconds to establish connection

  // ✅ Date and timezone settings
  dateStrings: true,
  timezone: "Z",                    // UTC timezone

  // ✅ Additional optimizations
  multipleStatements: false,        // Security: prevent SQL injection
  namedPlaceholders: false,         // Use ? placeholders only

  // ✅ Charset settings
  charset: 'utf8mb4',               // Support emojis and special characters
});

// ✅ Graceful shutdown handler
process.on('SIGINT', async () => {
  console.log('\n🔴 Closing database connection pool...');
  try {
    await pool.end();
    console.log('✅ Database connection pool closed');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error closing database pool:', err);
    process.exit(1);
  }
});

// ✅ Test connection on startup
pool.getConnection()
  .then(connection => {
    console.log('✅ MySQL connected successfully');
    connection.release();
  })
  .catch(err => {
    console.error('❌ MySQL connection failed:', err.message);
  });

// ✅ Add helper method to check pool status
pool.getPoolStatus = () => {
  return {
    totalConnections: pool.pool?._allConnections?.length || 0,
    freeConnections: pool.pool?._freeConnections?.length || 0,
    queueLength: pool.pool?._connectionQueue?.length || 0,
  };
};

export default pool;