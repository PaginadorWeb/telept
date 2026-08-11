import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import db from './db.mjs';
import { manufacturerInfo } from './lib/manufacturers.mjs';
import { fetchDetail, toSpecs } from './lib/techapi.mjs';

const app = express();
const port = Number(process.env.PORT || 3000);

const dir = path.dirname(fileURLToPath(import.meta.url));

const searchPhones = db.prepare(`
  SELECT * FROM smartphones
  WHERE brand LIKE ? OR model LIKE ?
  ORDER BY tracked DESC, brand, model
  LIMIT 60
`);

const searchByBrand = db.prepare(`
  SELECT * FROM smartphones
  WHERE brand = ?
  ORDER BY tracked DESC, model
  LIMIT 60
`);

const allBrands = db.prepare(`
  SELECT brand, COUNT(*) c FROM smartphones
  GROUP BY brand
  ORDER BY brand COLLATE NOCASE
`);

const byIds = db.prepare('SELECT * FROM smartphones WHERE id IN (SELECT value FROM json_each(?))');
const byId = db.prepare('SELECT * FROM smartphones WHERE id = ?');

const withPrices = db.prepare('SELECT store, product_url, raw_name, price, available, updated_at FROM prices WHERE phone_id = ?');

function brandSiteSlug(brand, model) {
  return encodeURIComponent(`${brand} ${model} especificações`);
}

function decorate(phone) {
  let specs = {};
  try {
    specs = JSON.parse(phone.specs || '{}');
  } catch {
    /* specs malformadas ignoradas */
  }
  const mf = manufacturerInfo(phone.brand);
  return {
    id: phone.id,
    brand: phone.brand,
    model: phone.model,
    image_url: phone.image_url,
    specs,
    prices: withPrices.all(phone.id),
    manufacturer: mf.label,
    manufacturer_site: mf.site,
    catalog: phone.catalog || 0,
    kind: phone.kind || 'phone'
  };
}

async function ensureSpecs(phone) {
  if (!phone.slug || (phone.specs && phone.specs !== '{}')) return phone;
  try {
    const resource = phone.kind === 'watch' ? 'watches' : 'smartphones';
    const detail = await fetchDetail(phone.slug, resource);
    const specs = toSpecs(detail);
    db.prepare('UPDATE smartphones SET specs = ?, image_url = ? WHERE id = ?').run(
      JSON.stringify(specs),
      detail.image_url || phone.image_url || '',
      phone.id
    );
    phone.specs = JSON.stringify(specs);
    if (detail.image_url) phone.image_url = detail.image_url;
  } catch (err) {
    console.log(`lazy specs falhou (${phone.brand} ${phone.model}): ${err.message}`);
  }
  return phone;
}

app.get('/api/phones', async (req, res) => {
  const { q, brand, ids } = req.query;
  try {
    if (ids && String(ids).trim()) {
      const idList = JSON.stringify(String(ids).trim().split(',').map(Number).filter((n) => Number.isInteger(n)));
      const list = byIds.all(idList);
      for (const phone of list) await ensureSpecs(phone);
      return res.json(list.map(decorate));
    }
    let rows;
    if (brand && String(brand).trim()) {
      rows = searchByBrand.all(String(brand).trim());
    } else if (q && String(q).trim()) {
      const term = `%${String(q).trim()}%`;
      rows = searchPhones.all(term, term);
    } else {
      rows = [];
    }
    res.json(rows.map(decorate));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/phones/:id', async (req, res) => {
  try {
    const phone = byId.get(Number(req.params.id));
    if (!phone) return res.status(404).json({ error: 'não encontrado' });
    await ensureSpecs(phone);
    res.json(decorate(phone));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/brands', (req, res) => {
  try {
    res.json(allBrands.all());
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.use(express.static(path.join(dir, 'public')));

app.listen(port, () => {
  console.log(`TelePT a correr em http://localhost:${port}`);
});