import { createPool } from 'mariadb';

const pool = createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'cobranca_admin',
  password: process.env.DB_PASS || 'Xk9mL2vR7pQ4nW',
  database: process.env.DB_NAME || 'cobranca_pro',
  connectionLimit: 10,
  charset: 'utf8mb4',
});

const columnExistsCache = new Map();

export async function query(sql, params) {
  let conn;
  try {
    conn = await pool.getConnection();
    const rows = await conn.query(sql, params);
    return rows;
  } finally {
    if (conn) conn.release();
  }
}

export async function hasColumn(tableName, columnName) {
  const cacheKey = `${tableName}:${columnName}`;
  if (columnExistsCache.has(cacheKey)) {
    return columnExistsCache.get(cacheKey);
  }

  const rows = await query(
    `SELECT 1 AS exists_flag
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
       AND COLUMN_NAME = ?
     LIMIT 1`,
    [tableName, columnName]
  );

  const exists = Array.isArray(rows)
    ? rows.some((row) => row && typeof row === 'object' && 'exists_flag' in row)
    : false;

  columnExistsCache.set(cacheKey, exists);
  return exists;
}

export function clearSchemaCache() {
  columnExistsCache.clear();
}

export default pool;
