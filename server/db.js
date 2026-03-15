import mariadb from 'mariadb';

const pool = mariadb.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'cobranca_admin',
  password: process.env.DB_PASS || 'Xk9#mL2vR7@pQ4nW',
  database: process.env.DB_NAME || 'cobranca_pro',
  connectionLimit: 10,
  charset: 'utf8mb4',
});

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

export default pool;
