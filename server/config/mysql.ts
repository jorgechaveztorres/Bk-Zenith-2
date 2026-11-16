import mysql, { Pool, PoolConnection } from 'mysql2/promise';

/**
 * Conexión a MySQL/MariaDB del cPanel (base shocos_zenith).
 * Reemplaza a Firestore. Los datos de acceso vienen SOLO de variables de entorno.
 */
let pool: Pool | null = null;

export const getPool = (): Pool => {
  if (pool) return pool;

  const { DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME } = process.env;
  if (!DB_USER || !DB_PASSWORD || !DB_NAME) {
    throw new Error('Faltan variables DB_USER, DB_PASSWORD o DB_NAME para conectar a MySQL.');
  }

  pool = mysql.createPool({
    host: DB_HOST || 'localhost',
    port: DB_PORT ? parseInt(DB_PORT, 10) : 3306,
    user: DB_USER,
    password: DB_PASSWORD,
    database: DB_NAME,
    waitForConnections: true,
    connectionLimit: 8,
    timezone: 'Z',
    charset: 'utf8mb4',
    dateStrings: false,
  });
  return pool;
};

/** Ejecuta una función dentro de una transacción; hace rollback si algo falla. */
export const withTransaction = async <T>(fn: (conn: PoolConnection) => Promise<T>): Promise<T> => {
  const conn = await getPool().getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

/** Solo para pruebas: cierra el pool. */
export const closePool = async () => {
  if (pool) {
    await pool.end();
    pool = null;
  }
};
