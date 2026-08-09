import axios from 'axios';
import * as cheerio from 'cheerio';
import { insertPhone } from '../db.mjs';
import { extractBrand, BRANDS } from './brands.mjs';

export const GSMARENA_BASE = 'https://www.gsmarena.com';

const headers = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36'
};

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function normalizeUrl(input) {
  if (input.startsWith('http://') || input.startsWith('https://')) return input;
  return `${GSMARENA_BASE}/${input.replace(/^\/+/, '')}`;
}

export function slugParts(slug) {
  const base = slug.split('-').slice(0, -1).join('-');
  const first = base.split('_')[0];
  const matched = BRANDS.find((b) => base.startsWith(b.toLowerCase().replace(/[ .-]/g, '_')));
  return { brand: matched || first || null, base };
}

export async function scrapeModel(url) {
  const { data } = await axios.get(normalizeUrl(url), { headers, timeout: 30000 });
  const $ = cheerio.load(data);

  const title = $('h1[data-spec="modelname"]').text().trim();
  if (!title) return null;

  const slug = normalizeUrl(url).split('/').pop().replace('.php', '');
  const { brand } = slugParts(slug);
  const brandFinal = brand || extractBrand(title) || 'Desconhecida';
  const model = title.replace(new RegExp(`^${brandFinal}\\s+`, 'i'), '').trim();
  const imageUrl = $('.specs-photo-main img').attr('src') || null;

  const specs = {};
  $('table').each((i, table) => {
    const $table = $(table);
    const category = $table.find('th').first().text().trim();
    if (!category) return;
    specs[category] = {};
    $table.find('tr').each((j, row) => {
      const $row = $(row);
      const key = $row.find('.ttl a').text().trim() || $row.find('.ttl').text().trim();
      const val = $row.find('.nfo').text().trim();
      if (key) specs[category][key] = val;
    });
  });

  return { brand: brandFinal, model, imageUrl, specs, title };
}

export async function fetchAndStore(url, { log = true } = {}) {
  try {
    const phone = await scrapeModel(url);
    if (!phone) {
      if (log) console.log(`  - sem titulo: ${url}`);
      return false;
    }
    insertPhone.run({
      brand: phone.brand,
      model: phone.model,
      specs: JSON.stringify(phone.specs),
      image_url: phone.imageUrl
    });
    if (log) {
      console.log(`  OK: ${phone.brand} ${phone.model} (${Object.keys(phone.specs).length} categorias)`);
    }
    return true;
  } catch (error) {
    if (error.response?.status === 404) {
      if (log) console.log(`  - 404: ${url}`);
    } else if (error.response?.status === 429) {
      throw new Error('RATE_LIMIT');
    } else if (log) {
      console.log(`  - erro: ${url}: ${error.message}`);
    }
    return false;
  }
}