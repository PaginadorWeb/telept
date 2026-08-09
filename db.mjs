import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const dir = path.dirname(fileURLToPath(import.meta.url));
const dbDir = path.join(dir, 'data');
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir);

const db = new Database(path.join(dbDir, 'telept.sqlite'));

db.exec(`
  CREATE TABLE IF NOT EXISTS smartphones (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    brand TEXT,
    model TEXT,
    specs JSON,
    image_url TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE UNIQUE INDEX IF NOT EXISTS idx_brand_model ON smartphones(brand COLLATE NOCASE, model COLLATE NOCASE);

  CREATE TABLE IF NOT EXISTS prices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    phone_id INTEGER NOT NULL REFERENCES smartphones(id) ON DELETE CASCADE,
    store TEXT NOT NULL,
    product_url TEXT,
    raw_name TEXT,
    price REAL,
    available INTEGER DEFAULT 1,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(phone_id, store)
  );
`);

export const insertPhone = db.prepare(`
  INSERT INTO smartphones (brand, model, specs, image_url)
  VALUES (@brand, @model, @specs, @image_url)
  ON CONFLICT(brand, model) DO UPDATE SET
    specs = excluded.specs,
    image_url = excluded.image_url
`);

export const getPhoneByModel = db.prepare(`
  SELECT * FROM smartphones WHERE model LIKE ?
`);

export const getAllPhones = db.prepare(`
  SELECT * FROM smartphones ORDER BY brand, model
`);

export const upsertPrice = db.prepare(`
  INSERT INTO prices (phone_id, store, product_url, raw_name, price, available)
  VALUES (@phone_id, @store, @product_url, @raw_name, @price, @available)
  ON CONFLICT(phone_id, store) DO UPDATE SET
    product_url = excluded.product_url,
    raw_name = excluded.raw_name,
    price = excluded.price,
    available = excluded.available,
    updated_at = CURRENT_TIMESTAMP
`);

export const getPricesForPhone = db.prepare(`
  SELECT store, product_url, raw_name, price, available, updated_at
  FROM prices WHERE phone_id = ?
`);

export default db;