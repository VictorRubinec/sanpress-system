import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const dbPath = process.env.DATABASE_PATH || './data/database.sqlite';

// Ensure the directory for the database exists
import fs from 'fs';
const dbDir = path.dirname(path.resolve(__dirname, dbPath));
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

export default {
  development: {
    client: 'sqlite3',
    connection: {
      filename: path.resolve(__dirname, dbPath)
    },
    useNullAsDefault: true,
    migrations: {
      directory: path.resolve(__dirname, 'src/db/migrations'),
      tableName: 'knex_migrations'
    },
    seeds: {
      directory: path.resolve(__dirname, 'src/db/seeds')
    },
    pool: {
      afterCreate: (conn, cb) => {
        conn.run('PRAGMA foreign_keys = ON', cb);
      }
    }
  }
};
