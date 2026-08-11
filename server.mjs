import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import db, { getAllPhones } from './db.mjs';
import { manufacturerInfo } from './lib/manufacturers.mjs';

const app = express();
const port = Number(process.env.PORT || 3000);

const dir = path.dirname(fileURLToPath(import.meta.url));

const searchPhones = db.prepare(`
  SELECT * FROM smartphones
  WHERE brand LIKE ? OR model LIKE ?
  ORDER BY brand, model
`);

const allBrands = db.prepare(`
  SELECT DISTINCT brand FROM smartphones ORDER BY brand COLLATE NOCASE
`);

const withPrices = db.prepare('SELECT store, product_url, raw_name, price, available, updated_at FROM prices WHERE phone_id = ?');

function decorate(phone) {
  let specs = {};
  try {
    specs = JSON.parse(phone.specs || '{}');
  } catch {
    /* specs malformadas ignoradas */
  }
  const mf = manufacturerInfo(phone.brand);
  return {
    ...phone,
    specs,
    prices: withPrices.all(phone.id),
    manufacturer: mf.label,
    manufacturer_site: mf.site
  };
}

app.get('/api/phones', (req, res) => {
  const { q, brand } = req.query;
  try {
    let rows;
    if (brand && String(brand).trim()) {
      rows = db.prepare('SELECT * FROM smartphones WHERE brand = ? ORDER BY model').all(String(brand).trim());
    } else if (q && String(q).trim()) {
      const term = `%${String(q).trim()}%`;
      rows = searchPhones.all(term, term);
    } else {
      rows = getAllPhones.all();
    }
    res.json(rows.map(decorate));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/brands', (req, res) => {
  try {
    res.json(allBrands.all().map((r) => r.brand));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.use(express.static(path.join(dir, 'public')));

app.listen(port, () => {
  console.log(`TelePT a correr em http://localhost:${port}`);
});