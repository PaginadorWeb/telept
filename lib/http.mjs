import axios from 'axios';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36 TelePT/0.1';

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function httpGet(url, { timeout = 30000, parse = true } = {}) {
  const { data } = await axios.get(url, {
    headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml,application/json' },
    timeout
  });
  return parse ? data : Buffer.from(data);
}

export function parseJsonLd(html) {
  const blocks = html.match(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi) || [];
  const out = [];
  for (const b of blocks) {
    const inner = b.replace(/^<script[^>]*>/i, '').replace(/<\/script>$/i, '');
    try {
      out.push(JSON.parse(inner));
    } catch {
      /* ignora blocos nao-JSON */
    }
  }
  return out;
}

export function normalizeName(name) {
  return String(name)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .trim();
}