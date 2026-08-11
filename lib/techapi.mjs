import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(here, '..', 'data');
const BASE = 'https://gettechapi.github.io/TechAPI/v1';

let indexCache = null;
let watchCache = null;

export function normalize(text) {
  return (text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/([a-z])(\d)/g, '$1 $2');
}

function tokens(text) {
  return normalize(text).split(/[^a-z0-9]+/).filter((t) => t.length >= 2);
}

function localOrFetch(file) {
  const local = path.join(DATA, file);
  if (fs.existsSync(local)) {
    const raw = JSON.parse(fs.readFileSync(local, 'utf8'));
    return raw.results || raw;
  }
  throw new Error(`${file} em falta (corra sync_techapi.mjs --refresh)`);
}

export function loadIndex() {
  if (!indexCache) indexCache = localOrFetch('techapi_index.json');
  return indexCache;
}

export function loadWatches() {
  if (!watchCache) watchCache = localOrFetch('techapi_watches.json');
  return watchCache;
}

export async function refreshIndex() {
  const [phones, watches] = await Promise.all([
    fetch(`${BASE}/smartphones/index.json`).then((r) => (r.ok ? r.json() : Promise.reject(new Error(`index HTTP ${r.status}`)))),
    fetch(`${BASE}/watches/index.json`).then((r) => (r.ok ? r.json() : Promise.reject(new Error(`watches HTTP ${r.status}`))))
  ]);
  indexCache = phones.results;
  watchCache = watches.results;
  fs.writeFileSync(path.join(DATA, 'techapi_index.json'), JSON.stringify(phones));
  fs.writeFileSync(path.join(DATA, 'techapi_watches.json'), JSON.stringify(watches));
  return indexCache;
}

export async function fetchDetail(slug, resource = 'smartphones') {
  const url = `${BASE}/${resource}/${slug}/index.json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`TechAPI detail HTTP ${res.status} (${slug})`);
  return res.json();
}

function bestMatch(list, brand, model, isWatch) {
  const want = tokens(`${brand} ${model}`);
  if (!want.length) return null;
  const modelNorm = normalize(model);
  const wantDigits = modelNorm.split(/[^0-9]+/).filter(Boolean);

  const substr = [];
  const rest = [];
  for (const entry of list) {
    const nameNorm = normalize(entry.name || '');
    const nameTokens = tokens(entry.name || '');
    if (!nameTokens.length) continue;
    if (modelNorm.length >= 4 && nameNorm.includes(modelNorm)) substr.push(entry);
    else rest.push(entry);
  }

  const evaluate = (list, requireDigits) => {
    let best = null;
    let bestScore = -Infinity;
    for (const entry of list) {
      const nameDigits = new Set(normalize(entry.name).split(/[^0-9]+/).filter(Boolean));
      if (requireDigits && wantDigits.length && !wantDigits.every((d) => nameDigits.has(d))) continue;
      const covered = want.filter((nameTok) => tokens(entry.name).includes(nameTok)).length;
      const score = covered / want.length + (normalize(entry.name) === normalize(`${brand} ${model}`) ? 0.3 : 0);
      if (score > bestScore) {
        bestScore = score;
        best = entry;
      }
    }
    return bestScore >= 0.75 ? { best, bestScore } : { best: null, bestScore: 0 };
  };

  const strong = evaluate(substr, true);
  if (strong.best) return strong.best;
  if (wantDigits.length) return null;
  const weak = evaluate(rest, false);
  return weak.bestScore >= 0.75 && weak.best ? weak.best : null;
}

export function findPhone(brand, model) {
  return bestMatch(loadIndex(), brand, model, false);
}

export function findWatch(brand, model) {
  return bestMatch(loadWatches(), brand, model, true);
}

export function toSpecs(detail) {
  const s = {};
  const add = (cat, key, value) => {
    if (value == null || value === '' || value === 0) return;
    s[cat] = s[cat] || {};
    s[cat][key] = String(value);
  };

  const { display = {}, battery_mah, charging_wired_w, charging_wireless_w, weight_g, dimensions = {}, ip_rating } = detail;
  add('Display', 'Tipo', display.type);
  add('Display', 'Tamanho', display.size_inch ? `${display.size_inch}"` : null);
  add('Display', 'Resolucao', display.resolution);
  add('Display', 'Refresh rate', display.refresh_hz ? `${display.refresh_hz} Hz` : null);
  add('Display', 'Brilho', display.brightness_nits ? `${display.brightness_nits} nits` : null);

  if (detail.soc) {
    add('Plataforma', 'SoC', detail.soc.name);
    add('Plataforma', 'Processo', detail.soc.process_nm ? `${detail.soc.process_nm} nm` : null);
    add('Plataforma', 'GPU', detail.soc.gpu_name);
  }
  add('Plataforma', 'SO', detail.os ? `${detail.os} ${detail.os_version}`.trim() : null);

  add('Memoria', 'RAM', detail.ram_gb);
  const storage = (detail.storage_options_gb || []).join(' / ');
  add('Memoria', 'Armazenamento', storage);

  add('Bateria', 'Capacidade', battery_mah ? `${battery_mah} mAh` : null);
  add('Bateria', 'Carregamento com fio', charging_wired_w);
  add('Bateria', 'Carregamento sem fios', charging_wireless_w);

  add('Corpo', 'Peso', weight_g != null ? `${weight_g} g` : null);
  add('Corpo', 'Dimensoes', dimensions?.height_mm ? `${dimensions.height_mm} x ${dimensions.width_mm} x ${dimensions.depth_mm} mm` : null);
  add('Corpo', 'Protecao (IP)', ip_rating);

  const cameras = detail.cameras || [];
  cameras.forEach((c, i) => {
    const label = c.type === 'main' ? 'Principal' : c.type === 'selfie' ? 'Selfie' : `${c.type || 'Camara'} ${i + 1}`;
    const parts = [];
    if (c.mp != null) parts.push(`${c.mp} MP`);
    if (c.optical_zoom) parts.push(`zoom ${c.optical_zoom}x`);
    if (c.aperture) parts.push(`f/${c.aperture}`);
    if (parts.length) add('Camaras', label, parts.join(' '));
  });
  if (detail.cameras && !detail.cameras.length) add('Camaras', 'Principal', 'n/d');

  const { wifi, bluetooth, nfc, usb } = detail.connectivity || {};
  if (wifi) add('Conectividade', 'Wi-Fi', wifi);
  if (bluetooth) add('Conectividade', 'Bluetooth', bluetooth);
  if (nfc) add('Conectividade', 'NFC', nfc ? 'Sim' : null);
  if (usb) add('Conectividade', 'USB', usb);

  add('Lancamento', 'Data', detail.release_date);
  add('Lancamento', 'PVI sugerido (USD)', detail.msrp_usd);

  return s;
}