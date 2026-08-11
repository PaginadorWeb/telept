const state = {
  activeBrand: null,
  compare: new Set(),
  detailId: null
};

const VIEW_IDS = { home: 'homeView', detail: 'detailView', compare: 'compareView' };

const $ = (sel) => document.querySelector(sel);

async function api(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(res.statusText);
  return res.json();
}

function setView(id) {
  document.querySelectorAll('.view').forEach((v) => v.classList.remove('active'));
  document.getElementById(VIEW_IDS[id]).classList.add('active');
  window.scrollTo({ top: 0 });
}

function go(id) {
  if (id === 'home') {
    state.compare.forEach((c) => {
      const el = document.querySelector(`[data-id="${c}"]`);
      if (el) el.classList.remove('checked');
    });
    state.compare.clear();
    updateCompareBar();
  }
  location.hash = id;
}

function storeClass(store) {
  const s = String(store).toLowerCase();
  if (s.includes('meo')) return 'meo';
  if (s.includes('vod')) return 'voda';
  if (s.includes('dart')) return 'dart';
  return 'nos';
}

function storeLabel(store) {
  return String(store).substring(0, 8).toUpperCase();
}

function fmt(n) {
  return n.toFixed(2).replace('.', ',');
}

function priceChips(prices) {
  if (!prices || !prices.length) return '<div class="prices-row"><span class="store-price">sem preço</span></div>';
  return `<div class="prices-row">${prices
    .map(
      (p) =>
        p.available
          ? `<span class="store-price ${storeClass(p.store)}">${storeLabel(p.store)} ${fmt(p.price)}€</span>`
          : `<span class="store-price">${storeLabel(p.store)} esgotado</span>`
    )
    .join('')}</div>`;
}

function thumbHtml(p) {
  if (p.image_url) return `<img loading="lazy" src="${p.image_url}" alt="${p.brand} ${p.model}" onclick="openDetail(${p.id})">`;
  const letter = (p.brand || '?').charAt(0).toUpperCase();
  return `<div class="thumb ph" onclick="openDetail(${p.id})">${letter}</div>`;
}

function cardHtml(p) {
  const inCompare = state.compare.has(String(p.id));
  return `
    <div class="card ${inCompare ? 'checked' : ''}" data-id="${p.id}">
      ${thumbHtml(p)}
      <div class="brand-tag" onclick="openDetail(${p.id})">${p.brand}</div>
      <h3 onclick="openDetail(${p.id})">${p.model}</h3>
      ${priceChips(p.prices)}
      <button class="add-cmp" onclick="toggleCompare(${p.id}, this)">${inCompare ? '✓ Adicionado à comparação' : '+ Comparar'}</button>
    </div>
  `;
}

async function renderResults(q) {
  const box = $('#results');
  if (!q && !state.activeBrand) {
    box.innerHTML =
      '<div class="status">Pesquisa um modelo (ex.: «Flip 8», «S25», «Redmi») ou toca numa marca acima.</div>';
    return;
  }
  box.innerHTML = '<div class="status"><div class="spinner"></div>Carregando...</div>';
  try {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (state.activeBrand) params.set('brand', state.activeBrand);
    const list = await api('/api/phones?' + params);
    box.innerHTML = list.length
      ? list.map(cardHtml).join('')
      : '<div class="status">Nenhum telemóvel encontrado.</div>';
  } catch (err) {
    box.innerHTML = `<div class="status">Erro: ${err.message}</div>`;
  }
}

async function loadBrands() {
  try {
    const brands = await api('/api/brands');
    $('#brandBar').innerHTML =
      '<button class="brand-chip" onclick="setBrand(null, this)">Todos</button>' +
      brands.map((b) => `<button class="brand-chip" onclick="setBrand('${b.brand.replace(/'/g, '')}', this)">${b.brand}</button>`).join('');
  } catch {
    /* chips opcionais */
  }
}

function setBrand(brand, el) {
  state.activeBrand = brand;
  document.querySelectorAll('.brand-chip').forEach((c) => c.classList.remove('active'));
  if (el) el.classList.add('active');
  renderResults($('#searchInput').value.trim());
}

function toggleCompare(id, el) {
  const key = String(id);
  const card = el.closest('.card');
  if (state.compare.has(key)) {
    state.compare.delete(key);
    card.classList.remove('checked');
    if (el.classList.contains('add-cmp')) el.textContent = '+ Comparar';
  } else {
    if (state.compare.size >= 3) {
      const first = [...state.compare][0];
      state.compare.delete(first);
      const old = document.querySelector(`[data-id="${first}"]`);
      if (old) {
        old.classList.remove('checked');
        const btn = old.querySelector('.add-cmp');
        if (btn) btn.textContent = '+ Comparar';
      }
    }
    state.compare.add(key);
    card.classList.add('checked');
    if (el.classList.contains('add-cmp')) el.textContent = '✓ Adicionado à comparação';
  }
  updateCompareBar();
}

function updateCompareBar() {
  const n = state.compare.size;
  $('#compareCount').textContent = `${n} selecionado${n === 1 ? '' : 's'}`;
  $('#compareBtn').disabled = n < 2;
  $('#compareBar').classList.toggle('hidden', n === 0);
}

function showDetail(phone) {
  state.detailId = phone.id;
  const specSections = Object.entries(phone.specs || {})
    .map(
      ([cat, items]) =>
        `<div class="spec-section"><h3>${cat}</h3><table>${Object.entries(items)
          .map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`)
          .join('')}</table></div>`
    )
    .join('');
  const siteRow = phone.manufacturer_site
    ? `<div class="site-row">
         <a class="btn-site" href="${phone.manufacturer_site}" target="_blank" rel="noopener">Site oficial de ${phone.manufacturer} ↗</a>
         <a class="btn-site ghost" href="https://www.google.com/search?q=${encodeURIComponent(`${phone.brand} ${phone.model} especificações`)}" target="_blank" rel="noopener">Specs no Google ↗</a>
       </div>`
    : '';
  $('#detailBody').innerHTML = `
    <div class="detail-head">
      ${phone.image_url ? `<img src="${phone.image_url}" alt="">` : `<div class="thumb ph big">${(phone.brand || '?').charAt(0).toUpperCase()}</div>`}
      <div>
        <div class="brand">${phone.brand}</div>
        <h2>${phone.model}</h2>
        ${priceChips(phone.prices)}
        ${siteRow}
      </div>
    </div>
    ${specSections}
  `;
}

async function openDetail(id) {
  state.detailId = id;
  location.hash = 'detail';
}

async function renderDetail(id) {
  setView('detail');
  $('#detailBody').innerHTML = '<div class="status"><div class="spinner"></div>A carregar specs...</div>';
  try {
    const list = await api('/api/phones?ids=' + encodeURIComponent(String(id)));
    const phone = list[0];
    if (phone) showDetail(phone);
    else $('#detailBody').innerHTML = '<div class="status">Não encontrado.</div>';
  } catch (err) {
    $('#detailBody').innerHTML = `<div class="status">Erro: ${err.message}</div>`;
  }
}

async function openCompare() {
  if (state.compare.size < 2) return;
  location.hash = 'compare';
}

async function renderCompare() {
  setView('compare');
  $('#compareBody').innerHTML = '<div class="status"><div class="spinner"></div>A preparar specs...</div>';
  try {
    const ids = [...state.compare].join(',');
    const list = await api('/api/phones?ids=' + encodeURIComponent(ids));
    const phones = list.filter((p) => state.compare.has(String(p.id)));
    const keys = [
      ...new Set(
        phones.flatMap((p) =>
          Object.entries(p.specs || {}).flatMap(([cat, items]) =>
            Object.keys(items).map((k) => `${cat}||${k}`)
          )
        )
      )
    ];
    $('#compareBody').innerHTML = `
      <table class="compare-table">
        <thead><tr>
          <th></th>
          ${phones
            .map(
              (p) =>
                `<th class="head">${p.image_url ? `<img src="${p.image_url}" alt="">` : ''}<br>${
                  p.brand
                }<br><b>${p.model}</b><br>${priceChips(p.prices)}</th>`
            )
            .join('')}
        </tr></thead>
        <tbody>
          ${keys
            .map((k) => {
              const [cat, key] = k.split('||');
              return `<tr><td class="k"><b>${cat}</b><br><small>${key}</small></td>${phones
                .map((p) => `<td>${p.specs?.[cat]?.[key] || '—'}</td>`)
                .join('')}</tr>`;
            })
            .join('')}
        </tbody>
      </table>
    `;
  } catch (err) {
    $('#compareBody').innerHTML = `<div class="status">Erro: ${err.message}</div>`;
  }
}

async function router() {
  const id = location.hash.replace('#', '') || 'home';
  setView(id);
  if (id === 'detail' && state.detailId) return renderDetail(state.detailId);
  if (id === 'compare') return renderCompare();
  return renderResults($('#searchInput').value.trim());
}

window.addEventListener('hashchange', router);

$('#searchBtn').addEventListener('click', () => {
  state.activeBrand = null;
  document.querySelectorAll('.brand-chip').forEach((c) => c.classList.remove('active'));
  renderResults($('#searchInput').value.trim());
});
$('#searchInput').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    state.activeBrand = null;
    document.querySelectorAll('.brand-chip').forEach((c) => c.classList.remove('active'));
    renderResults($('#searchInput').value.trim());
  }
});
$('#compareBtn').addEventListener('click', openCompare);

(async function init() {
  await loadBrands();
  router();
})();