import { normalizeName as norm } from './http.mjs';
import { extractBrand } from './brands.mjs';

export function tokenize(text) {
  return norm(text)
    .split(' ')
    .filter((t) => t.length >= 2);
}

function score(modelTokens, storeTokens) {
  if (!modelTokens.length || !storeTokens.length) return 0;
  const covered = modelTokens.filter((t) => storeTokens.includes(t)).length;
  return covered / modelTokens.length;
}

export function findBestMatch(phones, product) {
  const brand = product.brand || extractBrand(product.name || '');
  const storeTokens = tokenize(product.name || '');
  if (!storeTokens.length) return null;

  let best = null;
  let bestScore = 0;

  for (const phone of phones) {
    if (brand && phone.brand?.toLowerCase() !== brand.toLowerCase()) continue;
    const modelTokens = tokenize(phone.model);
    const s = score(modelTokens, storeTokens);
    if (s > bestScore) {
      bestScore = s;
      best = phone;
    }
  }

  return bestScore >= 0.75 ? best : null;
}