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

export function isUnknownColumnError(err, columnName = 'owner_id') {
  const message = String(err?.message || err || '').toLowerCase();
  return message.includes('unknown column') && message.includes(String(columnName).toLowerCase());
}

export async function hasColumn(tableName, columnName) {
  const cacheKey = `${tableName}:${columnName}`;
  if (columnExistsCache.has(cacheKey)) {
    return columnExistsCache.get(cacheKey);
  }

  const rows = await query(
    `SELECT COUNT(*) AS total
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND LOWER(TABLE_NAME) = LOWER(?)
       AND LOWER(COLUMN_NAME) = LOWER(?)`,
    [tableName, columnName]
  );

  const firstRow = Array.isArray(rows)
    ? rows.find((row) => row && typeof row === 'object' && Object.prototype.hasOwnProperty.call(row, 'total'))
    : null;

  const exists = Number(firstRow?.total || 0) > 0;

  columnExistsCache.set(cacheKey, exists);
  return exists;
}

export function clearSchemaCache() {
  columnExistsCache.clear();
}

export default pool;
