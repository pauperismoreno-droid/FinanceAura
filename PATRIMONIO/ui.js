/* Patrimonia — componentes de interfaz: modales, avisos, tablas, formularios, búsqueda */
'use strict';

/* ---------- modales ---------- */
const modalStack = [];
function openModal({ title, body, foot, size = '', onMount, onClose, tabs }) {
  const scrim = document.createElement('div'); scrim.className = 'scrim';
  const m = document.createElement('div'); m.className = 'modal ' + size; m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true'); m.setAttribute('aria-label', title);
  m.innerHTML = `<div class="modal-h"><h3>${esc(title)}</h3><button class="icon-btn x" type="button" aria-label="Cerrar">${I('x')}</button></div>${tabs || ''}<div class="modal-b">${body}</div>${foot ? `<div class="modal-f">${foot}</div>` : ''}`;
  document.body.append(scrim, m);
  const prevFocus = document.activeElement;
  const api = {
    el: m, close() {
      scrim.remove(); m.remove(); const i = modalStack.indexOf(api); if (i >= 0) modalStack.splice(i, 1);
      hideTip(); onClose && onClose(); if (prevFocus && prevFocus.focus) try { prevFocus.focus(); } catch (e) { }
    }
  };
  modalStack.push(api);
  scrim.addEventListener('click', api.close);
  m.querySelector('.x').addEventListener('click', api.close);
  onMount && onMount(m, api);
  const first = m.querySelector('[autofocus]') || m.querySelector('.modal-b input:not([type=checkbox]), .modal-b select, .modal-b textarea');
  if (first) setTimeout(() => first.focus(), 30);
  return api;
}
function closeTopModal() { const t = modalStack[modalStack.length - 1]; if (t) { t.close(); return true; } return false; }

function confirmDialog({ title, text, ok = 'Confirmar', danger = false }) {
  return new Promise(res => {
    let done = false;
    const m = openModal({
      title, size: 'sm', body: `<p style="margin:0;color:var(--ink-2)">${text}</p>`,
      foot: `<span class="spacer"></span><button class="btn" data-a="no" type="button">Cancelar</button><button class="btn ${danger ? 'danger solid' : 'primary'}" data-a="ok" type="button" autofocus>${esc(ok)}</button>`,
      onClose: () => { if (!done) res(false); }
    });
    m.el.querySelector('[data-a=no]').onclick = () => { done = true; res(false); m.close(); };
    m.el.querySelector('[data-a=ok]').onclick = () => { done = true; res(true); m.close(); };
    setTimeout(() => m.el.querySelector('[data-a=ok]').focus(), 40);
  });
}

/* ---------- avisos (toasts) ---------- */
function toast(msg, { undo, ms = 4200 } = {}) {
  let wrap = $('.toasts'); if (!wrap) { wrap = document.createElement('div'); wrap.className = 'toasts'; wrap.setAttribute('aria-live', 'polite'); document.body.appendChild(wrap); }
  const t = document.createElement('div'); t.className = 'toast';
  t.innerHTML = `<span class="ok">${I('check', 'sm')}</span><span>${esc(msg)}</span>${undo ? '<button type="button">Deshacer</button>' : ''}`;
  wrap.appendChild(t);
  const kill = () => { t.style.transition = 'opacity .2s'; t.style.opacity = '0'; setTimeout(() => t.remove(), 200); };
  const timer = setTimeout(kill, undo ? ms + 2000 : ms);
  if (undo) t.querySelector('button').onclick = () => { clearTimeout(timer); kill(); undo(); };
}
/* borrar con posibilidad de deshacer: guarda una copia del estado */
function withUndo(msg, mutate) {
  const snap = JSON.stringify(S);
  mutate(); commit();
  toast(msg, { undo: () => { S = JSON.parse(snap); commit(); toast('Cambio deshecho'); } });
}

/* ---------- popover ---------- */
let openPop = null;
function popover(anchor, html, { align = 'right', cls = '', onMount } = {}) {
  closePop();
  const p = document.createElement('div'); p.className = 'popover ' + cls; p.innerHTML = html;
  document.body.appendChild(p);
  const r = anchor.getBoundingClientRect();
  const w = p.offsetWidth, h = p.offsetHeight;
  let left = align === 'right' ? r.right - w : r.left;
  left = clamp(left, 8, window.innerWidth - w - 8);
  let top = r.bottom + 8; if (top + h > window.innerHeight - 8) top = Math.max(8, r.top - h - 8);
  p.style.left = left + 'px'; p.style.top = top + 'px';
  openPop = { el: p, anchor };
  setTimeout(() => document.addEventListener('pointerdown', popOutside, true), 0);
  onMount && onMount(p);
  return p;
}
function popOutside(e) { if (openPop && !openPop.el.contains(e.target) && !openPop.anchor.contains(e.target)) closePop(); }
function closePop() { if (openPop) { openPop.el.remove(); openPop = null; document.removeEventListener('pointerdown', popOutside, true); return true; } return false; }

/* ---------- helpers de formulario ---------- */
const opt = (v, l, sel) => `<option value="${esc(v)}"${String(v) === String(sel) ? ' selected' : ''}>${esc(l)}</option>`;
const field = (label, input, { full, hint, id, err = true } = {}) => `<div class="field${full ? ' full' : ''}">${label ? `<label${id ? ` for="${id}"` : ''}>${esc(label)}</label>` : ''}${input}${hint ? `<span class="hint">${hint}</span>` : ''}${err ? '<span class="err"></span>' : ''}</div>`;
const accountOptions = (sel, filter = () => true, empty) => (empty ? opt('', empty, sel) : '') + S.accounts.filter(filter).map(a => opt(a.id, `${a.name} · ${(ACCOUNT_TYPES[a.type] || {}).label || ''}`, sel)).join('');
function setErr(form, name, msg) {
  const inp = form.querySelector(`[name="${name}"]`); if (!inp) return;
  const f = inp.closest('.field'); const e = f && f.querySelector('.err');
  inp.classList.toggle('invalid', !!msg); if (e) e.textContent = msg || '';
}
function clearErrs(form) { form.querySelectorAll('.invalid').forEach(i => i.classList.remove('invalid')); form.querySelectorAll('.err').forEach(e => e.textContent = ''); }
const numVal = v => { if (v == null) return NaN; const s = String(v).trim().replace(/\s/g, ''); if (!s) return NaN; const c = s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s; return parseFloat(c); };
const fmtIn = v => v == null || v === '' || isNaN(v) ? '' : String(round2(v)).replace('.', ',');

/* entrada de etiquetas */
function tagInput(name, tags = []) {
  return `<div class="tag-input" data-tags="${esc(name)}">${tags.map(t => `<span class="tag">#${esc(t)}<button type="button" class="tag-x" data-rm="${esc(t)}" aria-label="Quitar ${esc(t)}">×</button></span>`).join('')}<input type="text" placeholder="${tags.length ? '' : 'Añade etiquetas…'}" aria-label="Etiquetas"/></div><div class="tag-sugg"></div>`;
}
function bindTagInput(root) {
  const box = root.querySelector('[data-tags]'); if (!box) return () => [];
  let tags = $$('.tag', box).map(t => t.textContent.replace('×', '').replace('#', '').trim());
  const input = box.querySelector('input'); const sugg = box.nextElementSibling;
  const draw = () => {
    $$('.tag', box).forEach(t => t.remove());
    tags.forEach(t => { const s = document.createElement('span'); s.className = 'tag'; s.innerHTML = `#${esc(t)}<button type="button" class="tag-x" aria-label="Quitar ${esc(t)}">×</button>`; s.querySelector('button').onclick = () => { tags = tags.filter(x => x !== t); draw(); }; box.insertBefore(s, input); });
    input.placeholder = tags.length ? '' : 'Añade etiquetas…';
    const q = norm(input.value.replace('#', ''));
    sugg.innerHTML = S.tags.filter(t => !tags.includes(t) && (!q || norm(t).includes(q))).slice(0, 9).map(t => `<button type="button" data-add="${esc(t)}">#${esc(t)}</button>`).join('');
    sugg.querySelectorAll('[data-add]').forEach(b => b.onclick = () => { tags.push(b.dataset.add); input.value = ''; draw(); input.focus(); });
  };
  const addCur = () => { const v = input.value.replace(/[#,]/g, '').trim().toLowerCase(); if (v && !tags.includes(v)) { tags.push(v); if (!S.tags.includes(v)) S.tags.push(v); } input.value = ''; draw(); };
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ',' || e.key === ' ') { if (input.value.trim()) { e.preventDefault(); addCur(); } }
    else if (e.key === 'Backspace' && !input.value && tags.length) { tags.pop(); draw(); }
  });
  input.addEventListener('input', draw);
  input.addEventListener('blur', () => { if (input.value.trim()) addCur(); });
  box.addEventListener('click', e => { if (e.target === box) input.focus(); });
  draw();
  return () => { if (input.value.trim()) addCur(); return tags.slice(); };
}

/* =====================================================================
   TABLA PROFESIONAL: búsqueda, filtros, orden, paginación, selección
   ===================================================================== */
const tblState = {};
function dataTable(el, cfg) {
  if (!el) return;
  const st = tblState[cfg.id] || (tblState[cfg.id] = { q: '', sort: cfg.defaultSort || null, page: 0, size: cfg.pageSize || 12, sel: new Set(), filters: Object.assign({}, cfg.initialFilters || {}) });
  if (cfg.forceFilters) Object.assign(st.filters, cfg.forceFilters);
  const draw = () => {
    let rows = cfg.rows.slice();
    if (st.q) { const q = norm(st.q); rows = rows.filter(r => norm(cfg.search(r)).includes(q)); }
    (cfg.filters || []).forEach(f => { const v = st.filters[f.key]; if (v) rows = rows.filter(r => f.test(r, v)); });
    if (st.sort) {
      const col = cfg.columns.find(c => c.key === st.sort.key);
      if (col) { const g = col.sort || (r => r[col.key]); rows.sort((a, b) => { const x = g(a), y = g(b); return (x < y ? -1 : x > y ? 1 : 0) * st.sort.dir; }); }
    }
    const total = rows.length, pages = Math.max(1, Math.ceil(total / st.size));
    st.page = clamp(st.page, 0, pages - 1);
    const pageRows = rows.slice(st.page * st.size, st.page * st.size + st.size);
    const allSel = pageRows.length && pageRows.every(r => st.sel.has(r.id));
    const selCount = [...st.sel].filter(id => cfg.rows.some(r => r.id === id)).length;
    const filtersHtml = (cfg.filters || []).map(f => `<select class="input sm" data-f="${f.key}" aria-label="${esc(f.label)}">${opt('', f.label, st.filters[f.key] || '')}${f.options.map(([v, l]) => opt(v, l, st.filters[f.key] || '')).join('')}</select>`).join('');
    const active = Object.values(st.filters).some(Boolean) || st.q;
    el.innerHTML = `
      ${cfg.noBar ? '' : `<div class="tbl-bar">
        <div class="tbl-search">${I('search', 'sm')}<input class="input sm" type="search" placeholder="${esc(cfg.placeholder || 'Buscar…')}" value="${esc(st.q)}" aria-label="Buscar en la tabla"/></div>
        <div class="tbl-filters">${filtersHtml}${active ? `<button class="btn ghost sm" data-clear type="button">${I('x', 'sm')}Limpiar</button>` : ''}</div>
        <div class="spacer"></div>${cfg.toolbar || ''}
      </div>`}
      ${selCount ? `<div class="bulk">${selCount} seleccionado${selCount > 1 ? 's' : ''}${cfg.bulkSum ? ` · ${cfg.bulkSum(cfg.rows.filter(r => st.sel.has(r.id)))}` : ''}<span class="spacer"></span><button class="btn xs" data-bulk-none type="button">Quitar selección</button>${cfg.onDelete ? `<button class="btn xs danger" data-bulk-del type="button">${I('trash', 'sm')}Eliminar</button>` : ''}</div>` : ''}
      <div class="tbl-wrap">${total ? `<table class="tbl">
        <thead><tr>${cfg.select !== false ? `<th class="cb"><input type="checkbox" data-all ${allSel ? 'checked' : ''} aria-label="Seleccionar página"/></th>` : ''}
        ${cfg.columns.map(c => `<th class="${c.cls || ''} ${c.sortable !== false ? 'sortable' : ''} ${st.sort && st.sort.key === c.key ? 'sorted' : ''} ${c.hideSm ? 'hide-sm' : ''}" data-k="${c.key}" ${c.sortable !== false ? `aria-sort="${st.sort && st.sort.key === c.key ? (st.sort.dir > 0 ? 'ascending' : 'descending') : 'none'}" tabindex="0"` : ''}>${esc(c.label)}${c.sortable !== false ? `<span class="sort-ic">${st.sort && st.sort.key === c.key ? (st.sort.dir > 0 ? '▲' : '▼') : '↕'}</span>` : ''}</th>`).join('')}
        ${cfg.onEdit || cfg.onDelete || cfg.actions ? '<th class="act"><span class="sr" style="position:absolute;left:-9999px">Acciones</span></th>' : ''}</tr></thead>
        <tbody>${pageRows.map(r => `<tr class="${st.sel.has(r.id) ? 'sel' : ''}" data-id="${esc(r.id)}">
          ${cfg.select !== false ? `<td class="cb"><input type="checkbox" data-sel ${st.sel.has(r.id) ? 'checked' : ''} aria-label="Seleccionar fila"/></td>` : ''}
          ${cfg.columns.map(c => `<td class="${c.cls || ''} ${c.hideSm ? 'hide-sm' : ''}">${c.render ? c.render(r) : esc(r[c.key])}</td>`).join('')}
          ${cfg.onEdit || cfg.onDelete || cfg.actions ? `<td class="act"><span class="row-acts">${cfg.actions ? cfg.actions(r) : ''}${cfg.onEdit ? `<button class="mini-btn" data-edit type="button" aria-label="Editar">${I('edit', 'sm')}</button>` : ''}${cfg.onDelete ? `<button class="mini-btn del" data-del type="button" aria-label="Eliminar">${I('trash', 'sm')}</button>` : ''}</span></td>` : ''}
        </tr>`).join('')}</tbody>
        ${cfg.footer ? `<tfoot>${cfg.footer(rows)}</tfoot>` : ''}
      </table>` : (cfg.empty || emptyState('search', active ? 'Nada coincide con la búsqueda' : 'Todavía no hay registros', active ? 'Prueba con otro término o limpia los filtros.' : 'Añade el primero con el botón «Añadir».'))}</div>
      ${total > Math.min(st.size, 10) || pages > 1 ? `<div class="tbl-foot"><span>${total} registro${total !== 1 ? 's' : ''}</span>
        <select class="input sm" data-size style="width:auto" aria-label="Filas por página">${[10, 12, 25, 50, 100].map(n => opt(n, n + ' por página', st.size)).join('')}</select>
        <div class="pager"><button class="btn xs" data-pg="-1" ${st.page === 0 ? 'disabled' : ''} type="button" aria-label="Página anterior">${I('left', 'sm')}</button><span class="num">${st.page + 1} / ${pages}</span><button class="btn xs" data-pg="1" ${st.page >= pages - 1 ? 'disabled' : ''} type="button" aria-label="Página siguiente">${I('right', 'sm')}</button></div></div>` : ''}`;
    // eventos
    const q = el.querySelector('.tbl-search input');
    if (q) { q.oninput = () => { st.q = q.value; st.page = 0; const pos = q.selectionStart; draw(); const nq = el.querySelector('.tbl-search input'); nq.focus(); try { nq.setSelectionRange(pos, pos); } catch (e) { } }; }
    el.querySelectorAll('[data-f]').forEach(s => s.onchange = () => { st.filters[s.dataset.f] = s.value; st.page = 0; draw(); });
    const clr = el.querySelector('[data-clear]'); if (clr) clr.onclick = () => { st.q = ''; Object.keys(st.filters).forEach(k => st.filters[k] = ''); draw(); };
    el.querySelectorAll('th.sortable').forEach(th => { const go = () => { const k = th.dataset.k; st.sort = st.sort && st.sort.key === k ? (st.sort.dir === -1 ? { key: k, dir: 1 } : null) : { key: k, dir: -1 }; draw(); }; th.onclick = go; th.onkeydown = e => { if (e.key === 'Enter') go(); }; });
    const all = el.querySelector('[data-all]'); if (all) all.onchange = () => { pageRows.forEach(r => all.checked ? st.sel.add(r.id) : st.sel.delete(r.id)); draw(); };
    el.querySelectorAll('[data-sel]').forEach(cb => cb.onchange = () => { const id = cb.closest('tr').dataset.id; cb.checked ? st.sel.add(id) : st.sel.delete(id); draw(); });
    el.querySelectorAll('[data-pg]').forEach(b => b.onclick = () => { st.page += +b.dataset.pg; draw(); });
    const sz = el.querySelector('[data-size]'); if (sz) sz.onchange = () => { st.size = +sz.value; st.page = 0; draw(); };
    const none = el.querySelector('[data-bulk-none]'); if (none) none.onclick = () => { st.sel.clear(); draw(); };
    const bd = el.querySelector('[data-bulk-del]');
    if (bd) bd.onclick = async () => {
      const ids = [...st.sel].filter(id => cfg.rows.some(r => r.id === id));
      if (await confirmDialog({ title: `Eliminar ${ids.length} registro${ids.length > 1 ? 's' : ''}`, text: 'Los saldos, gráficos e informes se recalcularán. Podrás deshacerlo justo después.', ok: 'Eliminar', danger: true })) { st.sel.clear(); cfg.onDelete(ids); }
    };
    el.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => { const r = cfg.rows.find(x => x.id === b.closest('tr').dataset.id); cfg.onEdit(r); });
    el.querySelectorAll('[data-del]').forEach(b => b.onclick = async () => {
      const r = cfg.rows.find(x => x.id === b.closest('tr').dataset.id);
      if (await confirmDialog({ title: 'Eliminar registro', text: `Se eliminará <b>${esc(cfg.label ? cfg.label(r) : 'este registro')}</b>. Podrás deshacerlo justo después.`, ok: 'Eliminar', danger: true })) cfg.onDelete([r.id]);
    });
    if (cfg.onRow) el.querySelectorAll('tbody tr').forEach(tr => tr.addEventListener('dblclick', () => cfg.onRow(cfg.rows.find(x => x.id === tr.dataset.id))));
    if (typeof holdingActions !== 'undefined' && cfg.actions === holdingActions) bindHoldingBtns(el);
    cfg.afterDraw && cfg.afterDraw(el);
  };
  draw();
}

/* =====================================================================
   FORMULARIOS DE OPERACIONES (+ Añadir)
   ===================================================================== */
const ADD_TYPES = [
  { k: 'gasto', label: 'Gasto', icon: 'dn', key: 'G', color: 'var(--c-expense)', soft: 'var(--c-expense-soft)', sub: 'Compra, factura o pago' },
  { k: 'ingreso', label: 'Ingreso', icon: 'up', key: 'I', color: 'var(--c-income)', soft: 'var(--c-income-soft)', sub: 'Nómina, extra, dividendos…' },
  { k: 'transferencia', label: 'Transferencia', icon: 'transfer', key: 'T', color: 'var(--c-saving)', soft: 'var(--c-saving-soft)', sub: 'Entre tus cuentas, sin afectar al ahorro' },
  { k: 'inversion', label: 'Inversión', icon: 'trend', key: 'V', color: 'var(--c-invest)', soft: 'var(--c-invest-soft)', sub: 'Aportación a fondo, acción o bono' },
  { k: 'activo', label: 'Activo', icon: 'box', key: 'A', color: 'var(--c-networth)', soft: 'var(--accent-soft)', sub: 'Inmueble, vehículo u otro bien' },
  { k: 'pasivo', label: 'Pasivo', icon: 'scale', key: 'P', color: 'var(--c-debt)', soft: 'var(--c-debt-soft)', sub: 'Hipoteca, préstamo, tarjeta…' }
];
function addMenu(anchor) {
  popover(anchor, `<div role="menu" aria-label="Añadir">${ADD_TYPES.map(t => `<button class="menu-item" role="menuitem" data-add="${t.k}" type="button"><span class="mi-ic" style="background:${t.soft};color:${t.color}">${I(t.icon)}</span><span><span class="mi-t">${t.label}</span><br><span class="mi-s">${t.sub}</span></span><kbd>${t.key}</kbd></button>`).join('')}</div>`, {
    onMount: p => {
      p.querySelectorAll('[data-add]').forEach(b => b.onclick = () => { closePop(); openAdd(b.dataset.add); });
      p.querySelector('button').focus();
    }
  });
}
function openAdd(kind, preset) {
  if (kind === 'activo') return assetForm(null, preset);
  if (kind === 'pasivo') return liabilityForm(null, preset);
  if (kind === 'inversion' && !S.holdings.length) { toast('Primero da de alta la inversión (fondo, acción, bono…)'); return holdingForm(); }
  return txForm(kind, null, preset);
}

/* recuerda la última categoría usada para un concepto: autocategorización simple */
function guessFromConcept(concept, type) {
  const c = norm(concept).trim(); if (!c) return null;
  return ledger().desc.find(t => t.type === type && norm(t.concept) === c) || ledger().desc.find(t => t.type === type && norm(t.concept).startsWith(c) && c.length > 3) || null;
}

function txForm(type = 'gasto', tx = null, preset = {}) {
  const editing = !!tx;
  const t = tx ? Object.assign({}, tx) : Object.assign({ type, date: TODAY, amount: '', concept: '', category: type === 'ingreso' ? 'Salario' : '', sub: '', account: S.accounts[0] ? S.accounts[0].id : '', method: 'Tarjeta', tags: [], recurring: false, notes: '' }, preset);
  type = t.type;
  const tabs = editing ? '' : `<div class="type-tabs" role="tablist">${ADD_TYPES.map(x => `<button type="button" role="tab" data-type="${x.k}" class="${x.k === type ? 'on' : ''}" aria-selected="${x.k === type}">${I(x.icon, 'sm')}${x.label}</button>`).join('')}</div>`;
  const titles = { gasto: 'gasto', ingreso: 'ingreso', transferencia: 'transferencia', inversion: 'aportación a inversión', 'compra-activo': 'compra de activo', venta: 'venta' };
  let body = '';
  const amountBlock = `<div class="amount-input"><input name="amount" inputmode="decimal" autocomplete="off" placeholder="0,00" value="${fmtIn(t.amount)}" aria-label="Importe" autofocus/><span class="cur">${esc((nf(0).formatToParts(0).find(p => p.type === 'currency') || { value: '€' }).value)}</span></div><span class="err" data-for="amount"></span>`;
  if (type === 'gasto' || type === 'ingreso') {
    const cats = type === 'gasto' ? S.categories : S.incomeCategories;
    const curCat = cats.find(c => c.name === t.category);
    body = `${amountBlock}
      <div class="form-grid">
        ${field('Concepto', `<input class="input" name="concept" list="concepts" value="${esc(t.concept)}" placeholder="${type === 'gasto' ? 'p. ej. Supermercado' : 'p. ej. Nómina'}" autocomplete="off"/>`, { full: true })}
        <datalist id="concepts">${[...new Set(ledger().desc.filter(x => x.type === type).map(x => x.concept))].slice(0, 60).map(c => `<option value="${esc(c)}">`).join('')}</datalist>
        <div class="field full"><span class="lbl">Categoría</span><div class="chips" data-cats>${cats.map(c => `<button type="button" class="chip${c.name === t.category ? ' on' : ''}" data-cat="${esc(c.name)}"><span class="sw" style="background:${catColor(c.name, type)}"></span>${esc(c.name)}</button>`).join('')}</div><input type="hidden" name="category" value="${esc(t.category)}"/><span class="err"></span></div>
        ${type === 'gasto' ? field('Subcategoría', `<select class="input" name="sub">${(curCat ? curCat.subs : []).map(s => opt(s, s, t.sub)).join('') || opt('', 'Elige una categoría')}</select>`) : ''}
        ${field('Fecha', `<input class="input" type="date" name="date" value="${esc(t.date)}"/>`)}
        ${field('Cuenta', `<select class="input" name="account">${accountOptions(t.account)}</select>`)}
        ${type === 'gasto' ? field('Método de pago', `<select class="input" name="method">${METHODS.map(m => opt(m, m, t.method)).join('')}</select>`) : ''}
        ${type === 'gasto' ? `<div class="field full"><span class="lbl">Etiquetas</span>${tagInput('tags', t.tags || [])}</div>` : ''}
        <label class="check full"><span class="switch"><input type="checkbox" name="recurring" ${t.recurring ? 'checked' : ''}/><span></span></span>${type === 'gasto' ? 'Gasto recurrente' : 'Ingreso recurrente'}</label>
        ${field('Notas', `<textarea class="input" name="notes" rows="2" placeholder="Opcional">${esc(t.notes || '')}</textarea>`, { full: true })}
      </div>`;
  } else if (type === 'transferencia') {
    body = `${amountBlock}
      <div class="form-grid">
        ${field('Desde', `<select class="input" name="account">${accountOptions(t.account)}</select>`)}
        ${field('Hacia', `<select class="input" name="toAccount">${accountOptions(t.toAccount || (S.accounts[1] || {}).id)}</select>`)}
        ${field('Concepto', `<input class="input" name="concept" value="${esc(t.concept || 'Transferencia entre cuentas')}"/>`)}
        ${field('Fecha', `<input class="input" type="date" name="date" value="${esc(t.date)}"/>`)}
        ${field('Notas', `<textarea class="input" name="notes" rows="2" placeholder="Opcional">${esc(t.notes || '')}</textarea>`, { full: true })}
      </div>
      <div class="note">${I('info', 'sm')}<span>Una transferencia entre cuentas propias mueve dinero sin cambiar tu patrimonio: no cuenta como ingreso ni como gasto.</span></div>`;
  } else if (type === 'inversion') {
    const groups = Object.entries(HOLDING_KINDS).map(([k, v]) => { const hs = S.holdings.filter(h => h.kind === k); return hs.length ? `<optgroup label="${esc(v.label)}">${hs.map(h => opt(h.id, h.name, t.holdingId)).join('')}</optgroup>` : ''; }).join('');
    const h0 = S.holdings.find(h => h.id === t.holdingId) || S.holdings[0];
    body = `<div class="form-grid">
        ${field('Inversión', `<select class="input" name="holdingId">${groups}${opt('__new', '+ Nueva inversión…', '')}</select>`, { full: true })}
        ${field('Importe total invertido', `<input class="input" name="amount" inputmode="decimal" value="${fmtIn(t.amount)}" placeholder="0,00" autofocus/>`, { hint: 'Incluye la comisión' })}
        ${field('Comisión', `<input class="input" name="fee" inputmode="decimal" value="${fmtIn(t.fee || 0)}"/>`)}
        ${field('Precio por participación', `<input class="input" name="price" inputmode="decimal" value="${fmtIn(t.price || (h0 ? h0.price : ''))}"/>`)}
        ${field('Participaciones', `<input class="input" name="units" inputmode="decimal" value="${t.units ? String(t.units).replace('.', ',') : ''}"/>`, { hint: 'Se calcula solo; puedes ajustarlo' })}
        ${field('Desde la cuenta', `<select class="input" name="account">${accountOptions(t.account)}</select>`)}
        ${field('Fecha', `<input class="input" type="date" name="date" value="${esc(t.date)}"/>`)}
        <label class="check full"><span class="switch"><input type="checkbox" name="recurring" ${t.recurring ? 'checked' : ''}/><span></span></span>Aportación periódica</label>
      </div>
      <div class="note">${I('info', 'sm')}<span>Una aportación no es un gasto: el dinero sale de tu cuenta y entra en la inversión. Tu patrimonio no cambia salvo por la comisión; la rentabilidad se mide aparte.</span></div>`;
  } else if (type === 'compra-activo' || type === 'venta') {
    body = `${amountBlock}<div class="form-grid">${field('Concepto', `<input class="input" name="concept" value="${esc(t.concept)}"/>`, { full: true })}${field('Cuenta', `<select class="input" name="account">${accountOptions(t.account)}</select>`)}${field('Fecha', `<input class="input" type="date" name="date" value="${esc(t.date)}"/>`)}</div>`;
  }
  const foot = `${editing ? `<button class="btn danger" type="button" data-del>${I('trash', 'sm')}Eliminar</button>` : `<span class="hint hide-sm"><kbd>Ctrl</kbd> + <kbd>Enter</kbd> para guardar</span>`}<span class="spacer"></span>${editing ? '' : '<button class="btn" type="button" data-another>Guardar y añadir otro</button>'}<button class="btn primary" type="submit" form="txf">${editing ? 'Guardar cambios' : 'Guardar'}</button>`;
  const m = openModal({ title: (editing ? 'Editar ' : 'Nuevo ') + titles[type], tabs, body: `<form id="txf" class="stack" novalidate>${body}</form>`, foot });
  const form = m.el.querySelector('form');
  m.el.querySelectorAll('[data-type]').forEach(b => b.onclick = () => {
    m.close();
    const carry = {}; const a = numVal(form.amount && form.amount.value); if (!isNaN(a)) carry.amount = a;
    if (form.concept && form.concept.value) carry.concept = form.concept.value;
    openAdd(b.dataset.type, carry);
  });
  const getTags = bindTagInput(form);
  // categorías
  const subSel = form.querySelector('[name=sub]');
  const setCat = name => {
    form.category.value = name;
    form.querySelectorAll('[data-cat]').forEach(c => c.classList.toggle('on', c.dataset.cat === name));
    if (subSel) { const c = S.categories.find(x => x.name === name); subSel.innerHTML = (c ? c.subs : []).map(s => opt(s, s, '')).join(''); }
  };
  form.querySelectorAll('[data-cat]').forEach(c => c.onclick = () => setCat(c.dataset.cat));
  // autocompletar por concepto
  if (form.concept && (type === 'gasto' || type === 'ingreso')) form.concept.addEventListener('change', () => {
    if (editing) return;
    const g = guessFromConcept(form.concept.value, type); if (!g) return;
    setCat(g.category); if (subSel && g.sub) subSel.value = g.sub;
    if (form.account) form.account.value = g.account;
    if (form.method && g.method) form.method.value = g.method;
    if (form.amount && !form.amount.value && g.recurring) form.amount.value = fmtIn(g.amount);
  });
  // inversión: cálculo de participaciones
  if (type === 'inversion') {
    const hs = form.holdingId;
    const recalc = () => { const a = numVal(form.amount.value), f = numVal(form.fee.value) || 0, p = numVal(form.price.value); if (a > 0 && p > 0) form.units.value = String(+((a - f) / p).toFixed(6)).replace('.', ','); };
    hs.onchange = () => {
      if (hs.value === '__new') { m.close(); holdingForm(null); return; }
      const h = S.holdings.find(x => x.id === hs.value); if (h) { form.price.value = fmtIn(priceAt(h, form.date.value || TODAY)); recalc(); }
    };
    form.amount.oninput = recalc; form.fee.oninput = recalc; form.price.oninput = recalc;
    form.date.onchange = () => { const h = S.holdings.find(x => x.id === hs.value); if (h && !editing) { form.price.value = fmtIn(priceAt(h, form.date.value || TODAY)); recalc(); } };
  }
  const delBtn = m.el.querySelector('[data-del]');
  if (delBtn) delBtn.onclick = async () => { if (await confirmDialog({ title: 'Eliminar movimiento', text: `Se eliminará «${esc(t.concept)}». Podrás deshacerlo justo después.`, ok: 'Eliminar', danger: true })) { m.close(); withUndo('Movimiento eliminado', () => { S.tx = S.tx.filter(x => x.id !== t.id); }); } };
  const save = again => {
    clearErrs(form);
    const fd = Object.fromEntries(new FormData(form).entries());
    const out = Object.assign({}, t, { type, date: fd.date || TODAY, notes: (fd.notes || '').trim() });
    let ok = true;
    const amount = numVal(fd.amount);
    if (!(amount > 0)) { ok = false; const e = form.querySelector('[data-for=amount]'); if (e) { e.textContent = 'Introduce un importe mayor que cero.'; } else setErr(form, 'amount', 'Introduce un importe mayor que cero.'); }
    out.amount = round2(amount);
    if (type === 'gasto' || type === 'ingreso') {
      out.concept = (fd.concept || '').trim(); out.category = fd.category; out.account = fd.account; out.recurring = !!fd.recurring;
      if (type === 'gasto') { out.sub = fd.sub || ''; out.method = fd.method; out.tags = getTags(); }
      if (!out.concept) { ok = false; setErr(form, 'concept', 'Escribe un concepto para reconocerlo después.'); }
      if (!out.category) { ok = false; setErr(form, 'category', 'Elige una categoría.'); }
      if (!out.account) { ok = false; setErr(form, 'account', 'Crea una cuenta antes de registrar movimientos.'); }
    } else if (type === 'transferencia') {
      out.account = fd.account; out.toAccount = fd.toAccount; out.concept = (fd.concept || 'Transferencia').trim();
      if (out.account === out.toAccount) { ok = false; setErr(form, 'toAccount', 'Elige una cuenta de destino distinta a la de origen.'); }
    } else if (type === 'inversion') {
      const h = S.holdings.find(x => x.id === fd.holdingId);
      if (!h) { ok = false; setErr(form, 'holdingId', 'Elige una inversión o crea una nueva.'); }
      const fee = numVal(fd.fee) || 0, price = numVal(fd.price); let units = numVal(fd.units);
      if (!(price > 0)) { ok = false; setErr(form, 'price', 'Indica el precio de compra.'); }
      if (!(units > 0) && price > 0 && amount > 0) units = (amount - fee) / price;
      if (fee >= amount) { ok = false; setErr(form, 'fee', 'La comisión no puede superar el importe.'); }
      if (!(amount > 0)) setErr(form, 'amount', 'Introduce un importe mayor que cero.');
      Object.assign(out, { holdingId: fd.holdingId, fee: round2(fee), price: round2(price), units: +(+units).toFixed(6), account: fd.account, concept: h ? `Aportación ${h.name}` : 'Aportación', recurring: !!fd.recurring });
    } else { out.concept = (fd.concept || '').trim(); out.account = fd.account; }
    if (!ok) { const inv = form.querySelector('.invalid'); if (inv) inv.focus(); return; }
    if (editing) { const i = S.tx.findIndex(x => x.id === t.id); S.tx[i] = out; }
    else { out.id = uid('t'); S.tx.unshift(out); }
    m.close(); commit();
    const verb = { gasto: 'Gasto', ingreso: 'Ingreso', transferencia: 'Transferencia', inversion: 'Aportación' }[type] || 'Movimiento';
    toast(editing ? 'Cambios guardados' : `${verb} de ${money(out.amount)} registrado`);
    if (again) txForm(type, null, { account: out.account, date: out.date });
  };
  form.addEventListener('submit', e => { e.preventDefault(); save(false); });
  form.addEventListener('keydown', e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); save(false); } });
  const again = m.el.querySelector('[data-another]'); if (again) again.onclick = () => save(true);
}

/* ---------- cuentas ---------- */
function accountForm(acc = null) {
  const a = acc || { name: '', institution: '', type: 'corriente', initial: 0, openDate: TODAY };
  const m = openModal({
    title: acc ? 'Editar cuenta' : 'Nueva cuenta', body: `<form id="accf" class="form-grid" novalidate>
      ${field('Nombre', `<input class="input" name="name" value="${esc(a.name)}" placeholder="p. ej. Banco principal" autofocus/>`, { full: true })}
      ${field('Tipo', `<select class="input" name="type">${Object.entries(ACCOUNT_TYPES).map(([k, v]) => opt(k, v.label, a.type)).join('')}</select>`)}
      ${field('Entidad', `<input class="input" name="institution" value="${esc(a.institution || '')}" placeholder="Opcional"/>`)}
      ${field('Saldo inicial', `<input class="input" name="initial" inputmode="decimal" value="${fmtIn(a.initial)}"/>`, { hint: 'Saldo en la fecha de apertura' })}
      ${field('Fecha de apertura', `<input class="input" type="date" name="openDate" value="${esc(a.openDate || TODAY)}"/>`)}
      ${field('Interés anual (%)', `<input class="input" name="rate" inputmode="decimal" value="${a.rate != null ? fmtIn(a.rate) : ''}" placeholder="Opcional"/>`)}
    </form>`,
    foot: `${acc ? `<button class="btn danger" type="button" data-del>${I('trash', 'sm')}Eliminar</button>` : ''}<span class="spacer"></span><button class="btn" type="button" data-cancel>Cancelar</button><button class="btn primary" type="submit" form="accf">Guardar</button>`
  });
  const f = m.el.querySelector('form');
  m.el.querySelector('[data-cancel]').onclick = m.close;
  const del = m.el.querySelector('[data-del]');
  if (del) del.onclick = async () => {
    const n = S.tx.filter(t => t.account === acc.id || t.toAccount === acc.id).length;
    if (n) { await confirmDialog({ title: 'No se puede eliminar todavía', text: `La cuenta tiene ${n} movimientos. Elimínalos o muévelos a otra cuenta antes de borrarla, para no descuadrar tu patrimonio.`, ok: 'Entendido' }); return; }
    if (await confirmDialog({ title: 'Eliminar cuenta', text: `Se eliminará «${esc(acc.name)}».`, ok: 'Eliminar', danger: true })) { m.close(); withUndo('Cuenta eliminada', () => { S.accounts = S.accounts.filter(x => x.id !== acc.id); }); }
  };
  f.onsubmit = e => {
    e.preventDefault(); clearErrs(f);
    const fd = Object.fromEntries(new FormData(f).entries());
    if (!fd.name.trim()) { setErr(f, 'name', 'Ponle un nombre a la cuenta.'); return; }
    const init = numVal(fd.initial); if (isNaN(init)) { setErr(f, 'initial', 'Introduce un número (puede ser 0).'); return; }
    const out = Object.assign({}, a, { name: fd.name.trim(), type: fd.type, institution: fd.institution.trim(), initial: round2(init), openDate: fd.openDate || TODAY, rate: isNaN(numVal(fd.rate)) ? undefined : numVal(fd.rate) });
    if (acc) S.accounts[S.accounts.findIndex(x => x.id === acc.id)] = out; else { out.id = uid('a'); S.accounts.push(out); }
    m.close(); commit(); toast(acc ? 'Cuenta actualizada' : 'Cuenta creada');
  };
}

/* ---------- inversiones (posiciones) ---------- */
function holdingForm(h = null, presetKind) {
  const x = h ? Object.assign({}, h) : { kind: presetKind || 'fondo', name: '', price: '' };
  const extra = k => {
    const v = (n, l, ph = '', t = 'text', full) => field(l, `<input class="input" name="${n}" ${t === 'num' ? 'inputmode="decimal"' : `type="${t}"`} value="${esc(t === 'num' ? fmtIn(x[n]) : (x[n] || ''))}" placeholder="${esc(ph)}"/>`, { full });
    if (k === 'fondo' || k === 'etf' || k === 'fondo-rf') return v('isin', 'ISIN', 'p. ej. IE00B4L5Y983') + v('manager', 'Gestora') + v('index', 'Índice', 'p. ej. MSCI World') + v('ter', 'Comisión anual (TER, %)', '0,12', 'num') + (k === 'etf' ? v('ticker', 'Ticker') : '');
    if (k === 'accion') return v('ticker', 'Ticker', 'p. ej. ITX') + v('market', 'Mercado', 'p. ej. BME');
    if (k === 'bono' || k === 'letra' || k === 'bono-corp') return v('country', 'País', 'España') + v('issuer', 'Emisor', 'Tesoro Público') + v('bondType', 'Tipo de bono', 'Bono a 10 años') + v('nominal', 'Nominal por título', '1000', 'num') + v('coupon', 'Cupón anual (%)', '0', 'num') + v('maturity', 'Fecha de vencimiento', '', 'date');
    if (k === 'cripto') return v('ticker', 'Símbolo', 'BTC');
    return '';
  };
  const m = openModal({
    title: h ? 'Editar inversión' : 'Nueva inversión', size: 'wide', body: `<form id="hf" class="stack" novalidate>
      <div class="form-grid">
        ${field('Tipo', `<select class="input" name="kind">${Object.entries(HOLDING_KINDS).map(([k, v]) => opt(k, v.label, x.kind)).join('')}</select>`)}
        ${field('Nombre', `<input class="input" name="name" value="${esc(x.name)}" placeholder="p. ej. Fondo índice mundial" autofocus/>`)}
        <div class="form-grid full" data-extra>${extra(x.kind)}</div>
        ${field('Valor actual por participación', `<input class="input" name="price" inputmode="decimal" value="${fmtIn(x.price)}"/>`, { hint: 'Actualízalo cuando cambie la cotización' })}
      </div>
      ${h ? '' : `<div class="divider"></div><div class="eyebrow">Primera compra (opcional)</div>
      <div class="form-grid">
        ${field('Participaciones', '<input class="input" name="units" inputmode="decimal" placeholder="0"/>')}
        ${field('Precio de compra', '<input class="input" name="buyPrice" inputmode="decimal" placeholder="0,00"/>')}
        ${field('Comisión', '<input class="input" name="fee" inputmode="decimal" value="0"/>')}
        ${field('Fecha de compra', `<input class="input" type="date" name="date" value="${TODAY}"/>`)}
        ${field('Pagado desde', `<select class="input" name="account">${opt('', 'Posición que ya tenía (sin movimiento de efectivo)', '')}${accountOptions('')}</select>`, { full: true, hint: 'Si eliges una cuenta, se descontará el importe de su saldo.' })}
      </div>`}
    </form>`,
    foot: `${h ? `<button class="btn danger" type="button" data-del>${I('trash', 'sm')}Eliminar</button>` : ''}<span class="spacer"></span><button class="btn" type="button" data-cancel>Cancelar</button><button class="btn primary" type="submit" form="hf">Guardar</button>`
  });
  const f = m.el.querySelector('form');
  m.el.querySelector('[data-cancel]').onclick = m.close;
  f.kind.onchange = () => { x.kind = f.kind.value; f.querySelector('[data-extra]').innerHTML = extra(f.kind.value); };
  const del = m.el.querySelector('[data-del]');
  if (del) del.onclick = async () => {
    const n = S.tx.filter(t => t.holdingId === h.id).length;
    if (await confirmDialog({ title: 'Eliminar inversión', text: `Se eliminará «${esc(h.name)}»${n ? ` y sus ${n} aportaciones (el efectivo volverá a las cuentas de origen)` : ''}.`, ok: 'Eliminar', danger: true })) {
      m.close(); withUndo('Inversión eliminada', () => { S.holdings = S.holdings.filter(y => y.id !== h.id); S.tx = S.tx.filter(t => t.holdingId !== h.id); });
    }
  };
  f.onsubmit = e => {
    e.preventDefault(); clearErrs(f);
    const fd = Object.fromEntries(new FormData(f).entries());
    if (!fd.name.trim()) { setErr(f, 'name', 'Escribe el nombre de la inversión.'); return; }
    const price = numVal(fd.price);
    const units = numVal(fd.units), buy = numVal(fd.buyPrice);
    if (!(price > 0) && !(buy > 0)) { setErr(f, 'price', 'Indica el valor actual por participación.'); return; }
    const out = Object.assign({}, x, { kind: fd.kind, name: fd.name.trim(), price: price > 0 ? price : buy });
    ['isin', 'manager', 'index', 'ticker', 'market', 'country', 'issuer', 'bondType', 'maturity'].forEach(k => { if (fd[k] != null) out[k] = fd[k].trim(); });
    ['ter', 'nominal', 'coupon'].forEach(k => { if (fd[k] != null) { const v = numVal(fd[k]); out[k] = isNaN(v) ? undefined : v; } });
    if (h) { out.hist = h.hist; S.holdings[S.holdings.findIndex(y => y.id === h.id)] = out; }
    else {
      out.id = uid('h'); out.hist = []; out.opening = [];
      if (units > 0 && buy > 0) {
        const fee = numVal(fd.fee) || 0;
        if (fd.account) S.tx.unshift({ id: uid('t'), type: 'inversion', date: fd.date || TODAY, amount: round2(units * buy + fee), fee, units, price: buy, account: fd.account, holdingId: out.id, concept: `Compra ${out.name}`, tags: [], notes: '' });
        else out.opening.push({ date: fd.date || TODAY, units, price: buy, fee });
        if (fd.date && fd.date < TODAY) out.hist = [[fd.date, buy]];
      }
      S.holdings.push(out);
    }
    m.close(); commit(); toast(h ? 'Inversión actualizada' : 'Inversión añadida');
  };
}
function priceForm(h) {
  const m = openModal({
    title: 'Actualizar valor', size: 'sm', body: `<form id="pf" class="stack" novalidate><p class="muted" style="margin:0">${esc(h.name)} · último valor ${M(h.price)}</p>${field('Nuevo valor por participación', `<input class="input" name="price" inputmode="decimal" value="${fmtIn(h.price)}" autofocus/>`)}</form>`,
    foot: `<span class="spacer"></span><button class="btn" type="button" data-cancel>Cancelar</button><button class="btn primary" type="submit" form="pf">Actualizar</button>`
  });
  const f = m.el.querySelector('form'); m.el.querySelector('[data-cancel]').onclick = m.close;
  f.onsubmit = e => {
    e.preventDefault(); const p = numVal(f.price.value);
    if (!(p > 0)) { setErr(f, 'price', 'Introduce un valor mayor que cero.'); return; }
    const old = h.price; h.price = p;
    m.close(); commit(); toast(`Valor actualizado (${pct(p / old - 1, 2, true)})`);
  };
}

/* ---------- activos no financieros ---------- */
function assetForm(asset = null, preset = {}) {
  const a = asset || Object.assign({ kind: 'inmueble', name: '', value: '', acquired: TODAY, annualChange: 0, notes: '' }, preset);
  const m = openModal({
    title: asset ? 'Editar activo' : 'Nuevo activo', body: `<form id="af" class="form-grid" novalidate>
      ${field('Nombre', `<input class="input" name="name" value="${esc(a.name)}" placeholder="p. ej. Piso en Valencia" autofocus/>`, { full: true })}
      ${field('Tipo', `<select class="input" name="kind">${Object.entries(ASSET_KINDS).map(([k, v]) => opt(k, v.label, a.kind)).join('')}</select>`)}
      ${field('Valor actual estimado', `<input class="input" name="value" inputmode="decimal" value="${fmtIn(a.value)}"/>`)}
      ${field('Fecha de adquisición', `<input class="input" type="date" name="acquired" value="${esc(a.acquired || TODAY)}"/>`)}
      ${field('Revalorización anual (%)', `<input class="input" name="annualChange" inputmode="decimal" value="${fmtIn(a.annualChange)}"/>`, { hint: 'Negativo para bienes que se deprecian' })}
      ${asset ? '' : field('Pagado desde', `<select class="input" name="account">${opt('', 'Ya lo tenía (no mueve efectivo)', '')}${accountOptions('')}</select>`, { hint: 'La compra cambia efectivo por el activo: no es un gasto.' })}
      ${asset ? '' : field('Importe pagado', '<input class="input" name="paid" inputmode="decimal" placeholder="Igual al valor"/>')}
      ${field('Notas', `<textarea class="input" name="notes" rows="2">${esc(a.notes || '')}</textarea>`, { full: true })}
    </form>`,
    foot: `${asset ? `<button class="btn danger" type="button" data-del>${I('trash', 'sm')}Eliminar</button>` : ''}<span class="spacer"></span><button class="btn" type="button" data-cancel>Cancelar</button><button class="btn primary" type="submit" form="af">Guardar</button>`
  });
  const f = m.el.querySelector('form'); m.el.querySelector('[data-cancel]').onclick = m.close;
  const del = m.el.querySelector('[data-del]');
  if (del) del.onclick = async () => { if (await confirmDialog({ title: 'Eliminar activo', text: `Se eliminará «${esc(asset.name)}» de tu patrimonio.`, ok: 'Eliminar', danger: true })) { m.close(); withUndo('Activo eliminado', () => { S.assets = S.assets.filter(x => x.id !== asset.id); }); } };
  f.onsubmit = e => {
    e.preventDefault(); clearErrs(f);
    const fd = Object.fromEntries(new FormData(f).entries());
    if (!fd.name.trim()) { setErr(f, 'name', 'Escribe un nombre.'); return; }
    const v = numVal(fd.value); if (!(v > 0)) { setErr(f, 'value', 'Indica un valor mayor que cero.'); return; }
    const out = Object.assign({}, a, { name: fd.name.trim(), kind: fd.kind, value: round2(v), acquired: fd.acquired || TODAY, annualChange: numVal(fd.annualChange) || 0, notes: fd.notes.trim() });
    if (asset) S.assets[S.assets.findIndex(x => x.id === asset.id)] = out;
    else {
      out.id = uid('o'); S.assets.push(out);
      if (fd.account) { const paid = numVal(fd.paid) > 0 ? numVal(fd.paid) : v; S.tx.unshift({ id: uid('t'), type: 'compra-activo', date: out.acquired, amount: round2(paid), account: fd.account, assetId: out.id, concept: `Compra ${out.name}`, tags: [], notes: '' }); }
    }
    m.close(); commit(); toast(asset ? 'Activo actualizado' : 'Activo añadido a tu patrimonio');
  };
}

/* ---------- pasivos ---------- */
function annuity(P, ratePct, n) { const r = ratePct / 100 / 12; return r ? P * r / (1 - Math.pow(1 + r, -n)) : P / n; }
function liabilityForm(l = null) {
  const x = l || { kind: 'prestamo', name: '', lender: '', principal: '', rate: '', months: '', start: TODAY, balance: '' };
  const isRev = k => ['tarjeta', 'personal', 'otro'].includes(k);
  const fields = k => isRev(k)
    ? field('Saldo pendiente', `<input class="input" name="balance" inputmode="decimal" value="${fmtIn(x.balance)}"/>`)
    : field('Capital inicial', `<input class="input" name="principal" inputmode="decimal" value="${fmtIn(x.principal)}"/>`) + field('Interés anual (%)', `<input class="input" name="rate" inputmode="decimal" value="${fmtIn(x.rate)}"/>`) + field('Plazo (meses)', `<input class="input" name="months" inputmode="numeric" value="${esc(x.months || '')}"/>`) + field('Fecha de inicio', `<input class="input" type="date" name="start" value="${esc(x.start || TODAY)}"/>`) + `<div class="field full"><span class="hint" data-quota></span></div>`;
  const m = openModal({
    title: l ? 'Editar pasivo' : 'Nuevo pasivo', body: `<form id="lf" class="form-grid" novalidate>
      ${field('Nombre', `<input class="input" name="name" value="${esc(x.name)}" placeholder="p. ej. Hipoteca vivienda" autofocus/>`, { full: true })}
      ${field('Tipo', `<select class="input" name="kind">${Object.entries(LIAB_KINDS).map(([k, v]) => opt(k, v.label, x.kind)).join('')}</select>`)}
      ${field('Entidad o acreedor', `<input class="input" name="lender" value="${esc(x.lender || '')}"/>`)}
      <div class="form-grid full" data-lx>${fields(x.kind)}</div>
    </form><div class="note">${I('info', 'sm')}<span>Los pasivos restan de tu patrimonio neto. En los préstamos con cuotas, el saldo pendiente baja solo según el cuadro de amortización.</span></div>`,
    foot: `${l ? `<button class="btn danger" type="button" data-del>${I('trash', 'sm')}Eliminar</button>` : ''}<span class="spacer"></span><button class="btn" type="button" data-cancel>Cancelar</button><button class="btn primary" type="submit" form="lf">Guardar</button>`
  });
  const f = m.el.querySelector('form'); m.el.querySelector('[data-cancel]').onclick = m.close;
  const q = () => { const h = f.querySelector('[data-quota]'); if (!h) return; const P = numVal(f.principal.value), r = numVal(f.rate.value) || 0, n = parseInt(f.months.value); h.innerHTML = P > 0 && n > 0 ? `Cuota mensual estimada: <b class="num">${M(annuity(P, r, n))}</b>` : 'Completa capital y plazo para calcular la cuota.'; };
  const wire = () => { ['principal', 'rate', 'months'].forEach(n => { if (f[n]) f[n].oninput = q; }); q(); };
  f.kind.onchange = () => { f.querySelector('[data-lx]').innerHTML = fields(f.kind.value); wire(); };
  wire();
  const del = m.el.querySelector('[data-del]');
  if (del) del.onclick = async () => { if (await confirmDialog({ title: 'Eliminar pasivo', text: `Se eliminará «${esc(l.name)}».`, ok: 'Eliminar', danger: true })) { m.close(); withUndo('Pasivo eliminado', () => { S.liabilities = S.liabilities.filter(y => y.id !== l.id); }); } };
  f.onsubmit = e => {
    e.preventDefault(); clearErrs(f);
    const fd = Object.fromEntries(new FormData(f).entries());
    if (!fd.name.trim()) { setErr(f, 'name', 'Escribe un nombre.'); return; }
    const out = Object.assign({}, x, { name: fd.name.trim(), kind: fd.kind, lender: fd.lender.trim() });
    if (isRev(fd.kind)) {
      const b = numVal(fd.balance); if (!(b >= 0)) { setErr(f, 'balance', 'Indica el saldo pendiente.'); return; }
      Object.assign(out, { revolving: true, balance: round2(b), start: x.start && x.revolving ? x.start : '0000-01-01' }); delete out.months;
    } else {
      const P = numVal(fd.principal), n = parseInt(fd.months), r = numVal(fd.rate) || 0;
      if (!(P > 0)) { setErr(f, 'principal', 'Indica el capital prestado.'); return; }
      if (!(n > 0)) { setErr(f, 'months', 'Indica el plazo en meses.'); return; }
      Object.assign(out, { revolving: false, principal: P, months: n, rate: r, start: fd.start || TODAY, payment: round2(annuity(P, r, n)) });
    }
    if (l) S.liabilities[S.liabilities.findIndex(y => y.id === l.id)] = out; else { out.id = uid('l'); S.liabilities.push(out); }
    m.close(); commit(); toast(l ? 'Pasivo actualizado' : 'Pasivo añadido');
  };
}

/* ---------- objetivos ---------- */
function goalForm(g = null) {
  const x = g || { kind: 'emergencia', name: '', target: '', current: 0, date: D.addMonthsISO(TODAY, 12), monthly: '' };
  const m = openModal({
    title: g ? 'Editar objetivo' : 'Nuevo objetivo', body: `<form id="gf" class="form-grid" novalidate>
      ${field('Tipo', `<select class="input" name="kind">${Object.entries(GOAL_KINDS).map(([k, v]) => opt(k, v.label, x.kind)).join('')}</select>`)}
      ${field('Nombre', `<input class="input" name="name" value="${esc(x.name)}" placeholder="p. ej. Fondo de emergencia" autofocus/>`)}
      ${field('Cantidad objetivo', `<input class="input" name="target" inputmode="decimal" value="${fmtIn(x.target)}"/>`)}
      ${field('Fecha objetivo', `<input class="input" type="date" name="date" value="${esc(x.date)}"/>`)}
      ${field('Vincular saldo', `<select class="input" name="link">${opt('', 'Cantidad manual', x.accountId || (x.linkInvest ? '__inv' : ''))}${opt('__inv', 'Valor total de mis inversiones', x.linkInvest ? '__inv' : '')}${accountOptions(x.accountId || '')}</select>`, { hint: 'Si vinculas una cuenta, el progreso se actualiza solo.' })}
      ${field('Cantidad actual', `<input class="input" name="current" inputmode="decimal" value="${fmtIn(x.current)}"/>`)}
      ${field('Aportación mensual prevista', `<input class="input" name="monthly" inputmode="decimal" value="${fmtIn(x.monthly)}"/>`, { full: true })}
    </form>`,
    foot: `${g ? `<button class="btn danger" type="button" data-del>${I('trash', 'sm')}Eliminar</button>` : ''}<span class="spacer"></span><button class="btn" type="button" data-cancel>Cancelar</button><button class="btn primary" type="submit" form="gf">Guardar</button>`
  });
  const f = m.el.querySelector('form'); m.el.querySelector('[data-cancel]').onclick = m.close;
  const sync = () => { f.current.disabled = !!f.link.value; f.current.closest('.field').style.opacity = f.link.value ? .5 : 1; };
  f.link.onchange = sync; sync();
  f.kind.onchange = () => { if (!f.name.value) f.name.value = GOAL_KINDS[f.kind.value].label; };
  const del = m.el.querySelector('[data-del]');
  if (del) del.onclick = async () => { if (await confirmDialog({ title: 'Eliminar objetivo', text: `Se eliminará «${esc(g.name)}».`, ok: 'Eliminar', danger: true })) { m.close(); withUndo('Objetivo eliminado', () => { S.goals = S.goals.filter(y => y.id !== g.id); }); } };
  f.onsubmit = e => {
    e.preventDefault(); clearErrs(f);
    const fd = Object.fromEntries(new FormData(f).entries());
    if (!fd.name.trim()) { setErr(f, 'name', 'Escribe un nombre.'); return; }
    const t = numVal(fd.target); if (!(t > 0)) { setErr(f, 'target', 'Indica la cantidad que quieres alcanzar.'); return; }
    if (!fd.date || fd.date <= TODAY) { setErr(f, 'date', 'Elige una fecha futura.'); return; }
    const out = Object.assign({}, x, { kind: fd.kind, name: fd.name.trim(), target: t, date: fd.date, monthly: numVal(fd.monthly) || 0, current: numVal(fd.current) || (x.current || 0), accountId: fd.link && fd.link !== '__inv' ? fd.link : undefined, linkInvest: fd.link === '__inv' });
    if (g) S.goals[S.goals.findIndex(y => y.id === g.id)] = out; else { out.id = uid('g'); S.goals.push(out); }
    m.close(); commit(); toast(g ? 'Objetivo actualizado' : 'Objetivo creado');
  };
}

/* ---------- recurrentes ---------- */
function recurringForm(r = null) {
  const x = r || { name: '', kind: 'gasto', group: 'suscripcion', amount: '', freq: 'mensual', day: +TODAY.slice(8), month: +TODAY.slice(5, 7), category: 'Ocio', sub: 'Suscripciones', account: (S.accounts[0] || {}).id, active: true };
  const catFields = k => {
    if (k === 'gasto') return field('Categoría', `<select class="input" name="category">${S.categories.map(c => opt(c.name, c.name, x.category)).join('')}</select>`) + field('Subcategoría', `<select class="input" name="sub">${((S.categories.find(c => c.name === x.category) || S.categories[0]).subs).map(s => opt(s, s, x.sub)).join('')}</select>`);
    if (k === 'ingreso') return field('Categoría', `<select class="input" name="category">${S.incomeCategories.map(c => opt(c.name, c.name, x.category)).join('')}</select>`);
    if (k === 'aportacion') return field('Inversión', `<select class="input" name="holdingId">${S.holdings.map(h => opt(h.id, h.name, x.holdingId)).join('')}</select>`, { full: true });
    if (k === 'transferencia') return field('Cuenta destino', `<select class="input" name="toAccount">${accountOptions(x.toAccount)}</select>`, { full: true });
    return '';
  };
  const m = openModal({
    title: r ? 'Editar recurrente' : 'Nuevo pago recurrente', body: `<form id="rf" class="form-grid" novalidate>
      ${field('Nombre', `<input class="input" name="name" value="${esc(x.name)}" placeholder="p. ej. Netflix" autofocus/>`, { full: true })}
      ${field('Tipo', `<select class="input" name="kind">${opt('gasto', 'Gasto', x.kind)}${opt('ingreso', 'Ingreso', x.kind)}${opt('aportacion', 'Aportación a inversión', x.kind)}${opt('transferencia', 'Transferencia', x.kind)}</select>`)}
      ${field('Grupo', `<select class="input" name="group">${Object.entries(REC_GROUPS).map(([k, v]) => opt(k, v, x.group)).join('')}</select>`)}
      ${field('Importe', `<input class="input" name="amount" inputmode="decimal" value="${fmtIn(x.amount)}"/>`)}
      ${field('Frecuencia', `<select class="input" name="freq">${Object.entries(FREQS).map(([k, v]) => opt(k, v.label, x.freq)).join('')}</select>`)}
      ${field('Día de cobro', `<input class="input" name="day" type="number" min="1" max="31" value="${esc(x.day)}"/>`)}
      ${field('Mes (anual o trimestral)', `<select class="input" name="month">${MONTHS.map((n, i) => opt(i + 1, cap(n), x.month)).join('')}</select>`)}
      ${field('Cuenta', `<select class="input" name="account">${accountOptions(x.account)}</select>`)}
      <div class="form-grid full" data-cx>${catFields(x.kind)}</div>
      <label class="check full"><span class="switch"><input type="checkbox" name="active" ${x.active ? 'checked' : ''}/><span></span></span>Activo</label>
    </form>`,
    foot: `${r ? `<button class="btn danger" type="button" data-del>${I('trash', 'sm')}Eliminar</button>` : ''}<span class="spacer"></span><button class="btn" type="button" data-cancel>Cancelar</button><button class="btn primary" type="submit" form="rf">Guardar</button>`
  });
  const f = m.el.querySelector('form'); m.el.querySelector('[data-cancel]').onclick = m.close;
  const wire = () => { if (f.category && f.sub) f.category.onchange = () => { const c = S.categories.find(y => y.name === f.category.value); f.sub.innerHTML = (c ? c.subs : []).map(s => opt(s, s, '')).join(''); }; };
  f.kind.onchange = () => { x.kind = f.kind.value; f.querySelector('[data-cx]').innerHTML = catFields(f.kind.value); if (f.kind.value === 'ingreso') x.category = 'Salario'; wire(); };
  wire();
  const del = m.el.querySelector('[data-del]');
  if (del) del.onclick = async () => { if (await confirmDialog({ title: 'Eliminar recurrente', text: `Se eliminará «${esc(r.name)}». Los movimientos ya registrados se mantienen.`, ok: 'Eliminar', danger: true })) { m.close(); withUndo('Recurrente eliminado', () => { S.recurring = S.recurring.filter(y => y.id !== r.id); }); } };
  f.onsubmit = e => {
    e.preventDefault(); clearErrs(f);
    const fd = Object.fromEntries(new FormData(f).entries());
    if (!fd.name.trim()) { setErr(f, 'name', 'Escribe un nombre.'); return; }
    const a = numVal(fd.amount); if (!(a > 0)) { setErr(f, 'amount', 'Indica un importe mayor que cero.'); return; }
    const out = Object.assign({}, x, { name: fd.name.trim(), kind: fd.kind, group: fd.group, amount: round2(a), freq: fd.freq, day: clamp(parseInt(fd.day) || 1, 1, 31), month: +fd.month, account: fd.account, active: !!fd.active, category: fd.category, sub: fd.sub, holdingId: fd.holdingId, toAccount: fd.toAccount });
    if (r) S.recurring[S.recurring.findIndex(y => y.id === r.id)] = out; else { out.id = uid('r'); S.recurring.push(out); }
    m.close(); commit(); toast(r ? 'Recurrente actualizado' : 'Recurrente añadido');
  };
}
/* registra ya un recurrente como movimiento */
function registerRecurring(r, date) {
  const base = { id: uid('t'), date: date || TODAY, amount: r.amount, concept: r.name, account: r.account, recurring: true, recurringId: r.id, tags: [], notes: '' };
  if (r.kind === 'gasto') S.tx.unshift(Object.assign(base, { type: 'gasto', category: r.category, sub: r.sub, method: r.method || 'Domiciliación', tags: r.group === 'suscripcion' ? ['suscripción'] : [] }));
  else if (r.kind === 'ingreso') S.tx.unshift(Object.assign(base, { type: 'ingreso', category: r.category }));
  else if (r.kind === 'transferencia') S.tx.unshift(Object.assign(base, { type: 'transferencia', toAccount: r.toAccount }));
  else if (r.kind === 'aportacion') { const h = S.holdings.find(y => y.id === r.holdingId); if (!h) return; const p = h.price; S.tx.unshift(Object.assign(base, { type: 'inversion', holdingId: h.id, price: p, units: +(r.amount / p).toFixed(6), fee: 0, concept: `Aportación ${h.name}` })); }
  commit(); toast(`${r.name}: ${money(r.amount)} registrado`);
}

/* ---------- presupuestos ---------- */
function budgetForm() {
  const m = openModal({
    title: 'Editar presupuestos', body: `<form id="bf" class="stack" novalidate><p class="muted" style="margin:0">Límite mensual por categoría. Deja 0 para no presupuestar una categoría.</p>
      ${S.categories.map(c => `<div class="row"><span class="cat-ic" style="background:var(--surface-3);color:${catColor(c.name)}">${I(c.icon, 'sm')}</span><span style="flex:1">${esc(c.name)}</span><input class="input sm" style="width:130px;text-align:right" name="b_${esc(c.name)}" inputmode="decimal" value="${fmtIn(S.budgets[c.name] || 0)}" aria-label="Presupuesto de ${esc(c.name)}"/></div>`).join('')}
    </form>`,
    foot: `<span class="hint" data-total></span><span class="spacer"></span><button class="btn" type="button" data-cancel>Cancelar</button><button class="btn primary" type="submit" form="bf">Guardar</button>`
  });
  const f = m.el.querySelector('form'); m.el.querySelector('[data-cancel]').onclick = m.close;
  const tot = () => { m.el.querySelector('[data-total]').innerHTML = `Total: <b class="num">${M(sum($$('input', f), i => numVal(i.value) || 0))}</b>/mes`; };
  f.oninput = tot; tot();
  f.onsubmit = e => {
    e.preventDefault();
    const nb = {}; $$('input', f).forEach(i => { const v = numVal(i.value); if (v > 0) nb[i.name.slice(2)] = round2(v); });
    S.budgets = nb; m.close(); commit(); toast('Presupuestos guardados');
  };
}

/* =====================================================================
   BÚSQUEDA GLOBAL (Ctrl/Cmd + K)
   ===================================================================== */
function openSearch() {
  closePop();
  if ($('.palette')) return;
  const scrim = document.createElement('div'); scrim.className = 'scrim';
  const p = document.createElement('div'); p.className = 'palette'; p.setAttribute('role', 'dialog'); p.setAttribute('aria-label', 'Búsqueda global');
  p.innerHTML = `<div class="palette-in">${I('search')}<input type="text" placeholder="Busca movimientos, cuentas, inversiones, objetivos, categorías…" aria-label="Buscar"/><kbd>Esc</kbd></div><div class="palette-res"></div>`;
  document.body.append(scrim, p);
  const input = p.querySelector('input'), res = p.querySelector('.palette-res');
  let items = [], kb = 0;
  const close = () => { scrim.remove(); p.remove(); document.removeEventListener('keydown', onKey, true); };
  scrim.onclick = close;
  const pages = NAV.flatMap(g => g.items ? g.items.map(([k, l]) => ({ k, l: `${l}`, g: g.g })) : [{ k: g.single, l: g.label, g: '' }]);
  const run = () => {
    const q = norm(input.value.trim());
    const groups = [];
    const pg = pages.filter(x => !q || norm(x.l + ' ' + x.g).includes(q)).slice(0, q ? 5 : 8).map(x => ({ icon: 'right', t: x.l, s: x.g, go: () => navigate(x.k) }));
    if (pg.length) groups.push(['Secciones', pg]);
    if (q) {
      const numQ = numVal(q);
      const tx = ledger().desc.filter(t => norm(`${t.concept} ${t.category || ''} ${t.sub || ''} ${(t.tags || []).join(' ')} ${accName(t.account)} ${t.notes || ''}`).includes(q) || (!isNaN(numQ) && Math.abs(t.amount - numQ) < 0.01)).slice(0, 8)
        .map(t => ({ icon: t.type === 'gasto' ? 'dn' : t.type === 'ingreso' ? 'up' : t.type === 'inversion' ? 'trend' : 'transfer', t: t.concept, s: `${fdate(t.date)} · ${t.category || accName(t.account)}`, v: (t.type === 'gasto' ? '−' : t.type === 'ingreso' ? '+' : '') + money(t.amount), go: () => editTx(t) }));
      if (tx.length) groups.push(['Movimientos', tx]);
      const acc = S.accounts.filter(a => norm(a.name + ' ' + (a.institution || '')).includes(q)).map(a => ({ icon: (ACCOUNT_TYPES[a.type] || {}).icon || 'bank', t: a.name, s: (ACCOUNT_TYPES[a.type] || {}).label, v: money(balAt(a.id)), go: () => { navigate('cuentas'); UIS.accSel = a.id; render(); } }));
      if (acc.length) groups.push(['Cuentas', acc]);
      const hs = S.holdings.filter(h => norm(`${h.name} ${h.isin || ''} ${h.ticker || ''} ${h.index || ''}`).includes(q)).map(h => ({ icon: HOLDING_KINDS[h.kind].icon, t: h.name, s: HOLDING_KINDS[h.kind].label + (h.isin ? ' · ' + h.isin : h.ticker ? ' · ' + h.ticker : ''), v: money(valueAt(h)), go: () => navigate(HOLDING_KINDS[h.kind].group === 'acciones' ? 'acciones' : HOLDING_KINDS[h.kind].group === 'bonos' ? 'bonos' : HOLDING_KINDS[h.kind].group === 'fondos' ? 'fondos' : 'cartera') }));
      if (hs.length) groups.push(['Inversiones', hs]);
      const gs = S.goals.filter(g => norm(g.name).includes(q)).map(g => ({ icon: 'flag', t: g.name, s: `${pct(goalStats(g).pct, 0)} completado`, v: money(g.target), go: () => navigate('objetivos') }));
      if (gs.length) groups.push(['Objetivos', gs]);
      const cs = S.categories.filter(c => norm(c.name + ' ' + c.subs.join(' ')).includes(q)).map(c => ({ icon: c.icon, t: c.name, s: 'Categoría de gasto · ver movimientos', go: () => { tblState.gastos = null; navigate('gastos', { cat: c.name }); } }))
        .concat(S.incomeCategories.filter(c => norm(c.name).includes(q)).map(c => ({ icon: c.icon, t: c.name, s: 'Categoría de ingreso', go: () => navigate('ingresos') })));
      if (cs.length) groups.push(['Categorías', cs]);
      const other = S.assets.filter(a => norm(a.name).includes(q)).map(a => ({ icon: ASSET_KINDS[a.kind].icon, t: a.name, s: 'Activo', v: money(assetValueAt(a)), go: () => navigate('activos') }))
        .concat(S.liabilities.filter(l => norm(l.name).includes(q)).map(l => ({ icon: LIAB_KINDS[l.kind].icon, t: l.name, s: 'Pasivo', v: money(liabBalanceAt(l)), go: () => navigate('pasivos') })))
        .concat(S.recurring.filter(r => norm(r.name).includes(q)).map(r => ({ icon: 'repeat', t: r.name, s: 'Recurrente', v: money(r.amount), go: () => navigate('recurrentes') })));
      if (other.length) groups.push(['Patrimonio y recurrentes', other]);
    }
    items = groups.flatMap(g => g[1]); kb = 0;
    res.innerHTML = items.length ? groups.map(([g, list]) => `<div class="palette-grp">${g}</div>${list.map(it => { const i = items.indexOf(it); return `<button class="menu-item" data-i="${i}" type="button"><span class="mi-ic" style="background:var(--surface-3)">${I(it.icon, 'sm')}</span><span style="min-width:0"><span class="mi-t">${esc(it.t)}</span><br><span class="mi-s">${esc(it.s || '')}</span></span>${it.v ? `<span class="mi-v amt">${esc(it.v)}</span>` : ''}</button>`; }).join('')}`).join('') : emptyState('search', 'Sin resultados', 'Prueba con un concepto, una categoría, un importe o el nombre de una cuenta.');
    res.querySelectorAll('[data-i]').forEach(b => b.onclick = () => { close(); items[+b.dataset.i].go(); });
    hl();
  };
  const hl = () => { res.querySelectorAll('[data-i]').forEach(b => b.classList.toggle('kb', +b.dataset.i === kb)); const c = res.querySelector('.kb'); if (c) c.scrollIntoView({ block: 'nearest' }); };
  const onKey = e => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); kb = Math.min(items.length - 1, kb + 1); hl(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); kb = Math.max(0, kb - 1); hl(); }
    else if (e.key === 'Enter' && items[kb]) { e.preventDefault(); close(); items[kb].go(); }
  };
  document.addEventListener('keydown', onKey, true);
  input.oninput = run; run(); input.focus();
}
async function editTx(t) {
  if (t.type === 'ajuste') {
    if (await confirmDialog({ title: 'Ajuste de saldo', text: `${esc(t.concept)}: ${money(t.amount, { sign: true })} en ${esc(accName(t.account))} el ${fdate(t.date)}. Sirve para que el saldo coincida con el que anotaste en tu Excel; no cuenta como ingreso ni gasto. ¿Quieres eliminarlo?`, ok: 'Eliminar ajuste', danger: true }))
      withUndo('Ajuste eliminado', () => { S.tx = S.tx.filter(x => x.id !== t.id); });
    return;
  }
  if (t.type === 'compra-activo') { const a = S.assets.find(x => x.id === t.assetId); if (a) return assetForm(a); }
  txForm(t.type, t);
}

/* =====================================================================
   ALERTAS
   ===================================================================== */
function alertsPanel(anchor) {
  const al = computeAlerts();
  popover(anchor, `<div class="ah"><h4>Avisos</h4><span class="spacer"></span><span class="muted" style="font-size:12px">${al.length ? `${al.length} activos` : 'Todo en orden'}</span></div>
    <div class="alert-list">${al.length ? al.map((a, i) => `<button class="alert ${a.lvl}" data-i="${i}" type="button" style="border:0;border-top:1px solid var(--line);background:none;text-align:left;width:100%"><span class="a-ic">${I(a.icon, 'sm')}</span><span><span class="a-t">${esc(a.t)}</span><span class="a-s" style="display:block">${esc(a.s)}</span></span></button>`).join('') : emptyState('check', 'Sin avisos', 'Te avisaremos de presupuestos, cobros próximos y desviaciones de tu cartera.')}</div>`,
    { cls: 'alerts-pop', onMount: p => p.querySelectorAll('[data-i]').forEach(b => b.onclick = () => { closePop(); navigate(al[+b.dataset.i].go); }) });
}
