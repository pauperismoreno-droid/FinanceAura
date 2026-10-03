/* Patrimonia — vistas: Inversiones y Planificación */
'use strict';

/* =====================================================================
   INVERSIONES
   ===================================================================== */
function holdingRows(filter) {
  const pf = portfolio(); const tot = pf.value || 1;
  return S.holdings.filter(filter).map(h => {
    const s = holdingStats(h);
    const lots = ledger().lots[h.id] || [];
    return Object.assign({ id: h.id, h, name: h.name, kind: h.kind, weight: s.value / tot, firstBuy: lots.length ? lots[0].date : null }, s);
  }).filter(r => r.units > 0.0000001);
}
function holdingActions(r) {
  return `<button class="mini-btn" data-price="${r.id}" type="button" aria-label="Actualizar valor" title="Actualizar valor">${I('refresh', 'sm')}</button><button class="mini-btn" data-buy="${r.id}" type="button" aria-label="Aportar" title="Nueva aportación">${I('plus', 'sm')}</button>`;
}
function bindHoldingActions() { /* los botones se enlazan en cada repintado de la tabla (bindHoldingBtns) */ }
function bindHoldingBtns(el) {
  el.querySelectorAll('[data-price]').forEach(p => p.onclick = () => priceForm(S.holdings.find(h => h.id === p.dataset.price)));
  el.querySelectorAll('[data-buy]').forEach(b => b.onclick = () => { const h = S.holdings.find(x => x.id === b.dataset.buy); txForm('inversion', null, { holdingId: h.id, price: h.price, account: (S.accounts.find(a => a.type === 'broker') || S.accounts[0] || {}).id }); });
}
const gainCell = (v, p) => `<span class="${v >= 0 ? 'pos' : 'neg'}">${M(v, { sign: true })}</span>${p != null ? `<span class="cell-sub" style="text-align:right">${pct(p, 2, true)}</span>` : ''}`;
function investKpis(rows, extra = '') {
  const cost = sum(rows, r => r.cost), value = sum(rows, r => r.value), gain = value - cost;
  return `<div class="kpis">
    ${kpi('Valor actual', M(value), `${rows.length} posiciones`, 'var(--c-invest)')}
    ${kpi('Capital aportado', M(cost), 'lo que has puesto, con comisiones', 'var(--ink-2)')}
    ${kpi('Ganancia / pérdida', `<span class="${gain >= 0 ? 'pos' : 'neg'}">${M(gain, { sign: true })}</span>`, deltaPill(cost ? gain / cost : NaN, { dec: 2 }), gain >= 0 ? 'var(--c-income)' : 'var(--c-expense)')}
    ${extra}
  </div>`;
}

VIEWS.cartera = {
  title: 'Cartera', crumb: 'Inversiones',
  html() {
    const pf = portfolio(); const rows = holdingRows(() => true);
    const byGroup = {}; rows.forEach(r => { const g = HOLDING_KINDS[r.kind].group; byGroup[g] = (byGroup[g] || 0) + r.value; });
    return `${pageHead('Cartera de inversión', 'Todas tus posiciones con su coste, valor de mercado y peso. Distingue siempre lo aportado de lo ganado.', `<button class="btn" data-newh type="button">${I('plus', 'sm')}Nueva posición</button><button class="btn primary" data-add="inversion" type="button">${I('trend', 'sm')}Aportar <kbd style="margin-left:4px;background:transparent;color:inherit;border-color:currentColor;opacity:.6">V</kbd></button>`)}
    ${investKpis(rows, kpi('Dividendos e intereses', M(pf.dividends + pf.couponInt + pf.other), 'cobrados desde el inicio', 'var(--c-income)'))}
    <div class="section-gap"></div>
    <div class="grid">
      <section class="card c-8"><div class="card-h"><div><h2>Valor frente a aportaciones</h2><div class="sub">La distancia entre las dos líneas es la rentabilidad generada</div></div></div>${legend([{ label: 'Valor de la cartera', color: 'var(--c-invest)', line: true }, { label: 'Capital aportado', color: 'var(--ink-2)', dash: true }])}<div id="pfChart"></div></section>
      <section class="card c-4"><div class="card-h"><h2>Por tipo de activo</h2></div><div id="pfDonut" style="max-width:180px;margin:0 auto 14px"></div>
        ${hbars([['fondos', 'Fondos y ETF', 'var(--s1)'], ['acciones', 'Acciones', 'var(--s2)'], ['bonos', 'Renta fija', 'var(--s3)'], ['otros', 'Cripto', 'var(--s6)']].filter(x => byGroup[x[0]]).map(([k, l, c]) => ({ label: l, value: byGroup[k], color: c })))}</section>
      <section class="card flush c-12"><div id="hTbl"></div></section>
    </div>`;
  },
  after() {
    on('[data-add]', 'click', (e, el) => openAdd(el.dataset.add));
    on('[data-newh]', 'click', () => holdingForm());
    bindHoldingActions();
    const ser = investSeries('1A');
    lineChart($('#pfChart'), { series: [{ name: 'Valor de la cartera', color: 'var(--c-invest)', data: ser.value, area: true }, { name: 'Capital aportado', color: 'var(--ink-2)', data: ser.cost, dash: true, noEnd: true }], height: 250, xfmt: d => monthLabel(D.ym(d), true), tipExtra: i => { const g = ser.value[i][1] - ser.cost[i][1]; return `<div class="tsep"></div>${tipRow(g >= 0 ? 'var(--c-income)' : 'var(--c-expense)', 'Rentabilidad generada', M(g, { sign: true }))}`; } });
    const rows = holdingRows(() => true);
    const g = {}; rows.forEach(r => { const k = HOLDING_KINDS[r.kind].group; g[k] = (g[k] || 0) + r.value; });
    donut($('#pfDonut'), { items: [['fondos', 'Fondos y ETF', 'var(--s1)'], ['acciones', 'Acciones', 'var(--s2)'], ['bonos', 'Renta fija', 'var(--s3)'], ['otros', 'Cripto', 'var(--s6)']].map(([k, l, c]) => ({ key: k, label: l, value: g[k] || 0, color: c })), centerLabel: 'Cartera' });
    dataTable($('#hTbl'), {
      id: 'cartera', rows, placeholder: 'Buscar por nombre, ISIN o ticker…', search: r => `${r.name} ${r.h.isin || ''} ${r.h.ticker || ''} ${HOLDING_KINDS[r.kind].label}`, label: r => r.name,
      defaultSort: { key: 'value', dir: -1 },
      filters: [{ key: 'kind', label: 'Todos los tipos', options: Object.entries(HOLDING_KINDS).map(([k, v]) => [k, v.label]), test: (r, v) => r.kind === v }],
      columns: [
        { key: 'name', label: 'Inversión', render: r => `<div class="concept">${esc(r.name)}<span class="cell-sub">${esc(HOLDING_KINDS[r.kind].label)}${r.h.isin ? ' · ' + esc(r.h.isin) : r.h.ticker ? ' · ' + esc(r.h.ticker) : ''}</span></div>` },
        { key: 'units', label: 'Participaciones', cls: 'r', hideSm: true, render: r => r.h.noUnits ? '<span class="muted" title="Valor importado del Excel, sin participaciones">—</span>' : numFmt(r.units, 4) },
        { key: 'avg', label: 'Precio medio', cls: 'r', hideSm: true, render: r => r.h.noUnits ? '<span class="muted">—</span>' : M(r.avg) },
        { key: 'price', label: 'Valor actual', cls: 'r', sort: r => r.h.price, hideSm: true, render: r => M(r.h.price) },
        { key: 'cost', label: 'Aportado', cls: 'r', render: r => M(r.cost) },
        { key: 'value', label: 'Valor de mercado', cls: 'r', render: r => M(r.value) },
        { key: 'gain', label: 'Ganancia / pérdida', cls: 'r', render: r => gainCell(r.gain, r.gainPct) },
        { key: 'weight', label: 'Peso', cls: 'r', hideSm: true, render: r => pct(r.weight) }
      ],
      actions: holdingActions, onEdit: r => holdingForm(r.h),
      onDelete: ids => withUndo('Posición eliminada', () => { S.holdings = S.holdings.filter(h => !ids.includes(h.id)); S.tx = S.tx.filter(t => !ids.includes(t.holdingId)); }),
      footer: rows => `<tr class="tfoot-sum"><td></td><td>Total</td><td class="hide-sm"></td><td class="hide-sm"></td><td class="hide-sm"></td><td class="r num">${M(sum(rows, r => r.cost))}</td><td class="r num">${M(sum(rows, r => r.value))}</td><td class="r num">${gainCell(sum(rows, r => r.gain))}</td><td class="hide-sm"></td><td></td></tr>`
    });
  }
};
/* series valor / aportado de la cartera (o de un subconjunto) */
function investSeries(range, filter = () => true) {
  const hs = S.holdings.filter(filter);
  const fv = d => sum(hs, h => valueAt(h, d)), fc = d => sum(hs, h => costAt(h, d));
  const value = nwSeries(range, d => d < ledger().start ? null : fv(d));
  return { value, cost: value.map(([d]) => [d, fc(d)]) };
}

VIEWS.fondos = {
  title: 'Fondos indexados', crumb: 'Inversiones',
  html() {
    const rows = holdingRows(h => h.kind === 'fondo' || h.kind === 'etf');
    const feeYear = sum(rows, r => r.value * (r.h.ter || 0) / 100);
    return `${pageHead('Fondos indexados y ETF', 'Gestión pasiva a bajo coste. Aquí ves cuánto has aportado, cuánto vale hoy y cuánto pagas en comisiones.', `<button class="btn" data-newh type="button">${I('plus', 'sm')}Nuevo fondo</button><button class="btn primary" data-add="inversion" type="button">${I('trend', 'sm')}Aportar</button>`)}
    ${investKpis(rows, kpi('Coste anual estimado', M(feeYear), `TER medio ${numFmt(rows.length ? sum(rows, r => (r.h.ter || 0) * r.value) / (sum(rows, r => r.value) || 1) : 0, 2)} %`, 'var(--c-debt)'))}
    <div class="section-gap"></div>
    <div class="grid"><section class="card c-12"><div class="card-h"><h2>Aportaciones y valor</h2><span class="sub">Fondos y ETF, último año</span></div>${legend([{ label: 'Valor', color: 'var(--s1)', line: true }, { label: 'Capital aportado', color: 'var(--ink-2)', dash: true }])}<div id="fChart"></div></section>
    <section class="card flush c-12"><div id="fTbl"></div></section></div>`;
  },
  after() {
    on('[data-add]', 'click', (e, el) => openAdd(el.dataset.add));
    on('[data-newh]', 'click', () => holdingForm(null, 'fondo'));
    bindHoldingActions();
    const f = h => h.kind === 'fondo' || h.kind === 'etf';
    const ser = investSeries('1A', f);
    lineChart($('#fChart'), { series: [{ name: 'Valor', color: 'var(--s1)', data: ser.value, area: true }, { name: 'Capital aportado', color: 'var(--ink-2)', data: ser.cost, dash: true, noEnd: true }], height: 230, xfmt: d => monthLabel(D.ym(d), true) });
    dataTable($('#fTbl'), {
      id: 'fondos', rows: holdingRows(f), placeholder: 'Buscar por nombre, ISIN, gestora o índice…', search: r => `${r.name} ${r.h.isin || ''} ${r.h.manager || ''} ${r.h.index || ''}`, label: r => r.name, defaultSort: { key: 'value', dir: -1 },
      columns: [
        { key: 'name', label: 'Fondo', render: r => `<div class="concept">${esc(r.name)}<span class="cell-sub">${esc(r.h.isin || '')}${r.kind === 'etf' ? ' · ETF' : ''}</span></div>` },
        { key: 'manager', label: 'Gestora', sort: r => r.h.manager, hideSm: true, render: r => esc(r.h.manager || '—') },
        { key: 'index', label: 'Índice', sort: r => r.h.index, render: r => esc(r.h.index || '—') },
        { key: 'units', label: 'Participaciones', cls: 'r', hideSm: true, render: r => r.h.noUnits ? '<span class="muted" title="Valor importado del Excel, sin participaciones">—</span>' : numFmt(r.units, 4) },
        { key: 'avg', label: 'Precio de compra', cls: 'r', hideSm: true, render: r => r.h.noUnits ? '<span class="muted">—</span>' : M(r.avg) },
        { key: 'price', label: 'Valor liquidativo', cls: 'r', sort: r => r.h.price, render: r => M(r.h.price) },
        { key: 'cost', label: 'Aportaciones', cls: 'r', render: r => M(r.cost) },
        { key: 'value', label: 'Valor actual', cls: 'r', render: r => M(r.value) },
        { key: 'gain', label: 'Rentabilidad', cls: 'r', render: r => gainCell(r.gain, r.gainPct) },
        { key: 'ter', label: 'Comisión (TER)', cls: 'r', sort: r => r.h.ter || 0, hideSm: true, render: r => r.h.ter != null ? numFmt(r.h.ter, 2) + ' %' : '—' }
      ],
      actions: holdingActions, onEdit: r => holdingForm(r.h),
      onDelete: ids => withUndo('Fondo eliminado', () => { S.holdings = S.holdings.filter(h => !ids.includes(h.id)); S.tx = S.tx.filter(t => !ids.includes(t.holdingId)); }),
      empty: emptyState('layers', 'Sin fondos indexados', 'Añade tu primer fondo con su ISIN, gestora e índice.', `<button class="btn primary" data-newh type="button">${I('plus', 'sm')}Nuevo fondo</button>`)
    });
  }
};

VIEWS.acciones = {
  title: 'Acciones', crumb: 'Inversiones',
  html() {
    const rows = holdingRows(h => h.kind === 'accion');
    const div = sum(ledger().txs.filter(t => t.type === 'ingreso' && t.category === 'Dividendos' && t.date >= D.addMonthsISO(TODAY, -12)), t => t.amount);
    const val = sum(rows, r => r.value);
    return `${pageHead('Acciones', 'Empresas en las que tienes participación directa, con precio medio de compra y valor de mercado.', `<button class="btn" data-newh type="button">${I('plus', 'sm')}Nueva acción</button><button class="btn primary" data-add="inversion" type="button">${I('trend', 'sm')}Comprar</button>`)}
    ${investKpis(rows, kpi('Dividendos 12 meses', M(div), `Rentabilidad por dividendo ${pct(val ? div / val : 0, 2)}`, 'var(--c-income)'))}
    <div class="section-gap"></div>
    <div class="grid"><section class="card c-12"><div class="card-h"><h2>Ganancia o pérdida por empresa</h2></div><div id="sBars"></div></section>
    <section class="card flush c-12"><div id="sTbl"></div></section></div>`;
  },
  after() {
    on('[data-add]', 'click', (e, el) => openAdd(el.dataset.add));
    on('[data-newh]', 'click', () => holdingForm(null, 'accion'));
    bindHoldingActions();
    const rows = holdingRows(h => h.kind === 'accion').sort((a, b) => b.gain - a.gain);
    barChart($('#sBars'), { labels: rows.map(r => r.h.ticker || r.name), height: 200, maxBar: 40, series: [{ name: 'Ganancia / pérdida', color: v => v >= 0 ? 'var(--c-income)' : 'var(--c-expense)', values: rows.map(r => r.gain) }], tipTitle: i => esc(rows[i].name), tipExtra: i => tipRow('var(--ink-2)', 'Rentabilidad', pct(rows[i].gainPct, 2, true)) });
    dataTable($('#sTbl'), {
      id: 'acciones', rows: holdingRows(h => h.kind === 'accion'), placeholder: 'Buscar empresa o ticker…', search: r => `${r.name} ${r.h.ticker || ''} ${r.h.market || ''}`, label: r => r.name, defaultSort: { key: 'value', dir: -1 },
      columns: [
        { key: 'name', label: 'Empresa', render: r => `<div class="concept">${esc(r.name)}<span class="cell-sub">${esc(r.h.market || '')}</span></div>` },
        { key: 'ticker', label: 'Ticker', sort: r => r.h.ticker, render: r => `<span class="num">${esc(r.h.ticker || '—')}</span>` },
        { key: 'units', label: 'Nº acciones', cls: 'r', render: r => r.h.noUnits ? '<span class="muted" title="Valor importado del Excel, sin participaciones">—</span>' : numFmt(r.units, 4) },
        { key: 'avg', label: 'Precio medio', cls: 'r', render: r => r.h.noUnits ? '<span class="muted">—</span>' : M(r.avg) },
        { key: 'price', label: 'Precio actual', cls: 'r', sort: r => r.h.price, render: r => M(r.h.price) },
        { key: 'value', label: 'Valor de mercado', cls: 'r', render: r => M(r.value) },
        { key: 'gain', label: 'Ganancia / pérdida', cls: 'r', render: r => gainCell(r.gain, r.gainPct) }
      ],
      actions: holdingActions, onEdit: r => holdingForm(r.h),
      onDelete: ids => withUndo('Acción eliminada', () => { S.holdings = S.holdings.filter(h => !ids.includes(h.id)); S.tx = S.tx.filter(t => !ids.includes(t.holdingId)); }),
      empty: emptyState('building', 'Sin acciones', 'Añade las empresas en las que inviertes directamente.')
    });
  }
};

function bondYield(h) {
  if (!h.maturity || !h.nominal) return null;
  const yrs = D.diff(TODAY, h.maturity) / 365.25; if (yrs <= 0) return 0;
  const P = h.price, F = h.nominal, C = F * (h.coupon || 0) / 100;
  if (!C) return Math.pow(F / P, 1 / yrs) - 1;
  return (C + (F - P) / yrs) / ((F + P) / 2);
}
VIEWS.bonos = {
  title: 'Bonos', crumb: 'Inversiones',
  html() {
    const rows = holdingRows(h => HOLDING_KINDS[h.kind].cls === 'rf');
    const nominal = sum(rows.filter(r => r.h.nominal), r => r.units * r.h.nominal);
    const couponsYear = sum(rows, r => r.units * (r.h.nominal || 0) * (r.h.coupon || 0) / 100);
    const wy = (() => { const rs = rows.filter(r => bondYield(r.h) != null); const v = sum(rs, r => r.value); return v ? sum(rs, r => bondYield(r.h) * r.value) / v : 0; })();
    const next = rows.filter(r => r.h.maturity && r.h.maturity >= TODAY).sort((a, b) => a.h.maturity < b.h.maturity ? -1 : 1)[0];
    return `${pageHead('Bonos y renta fija', 'Bonos gubernamentales, letras del Tesoro, bonos corporativos y fondos de renta fija, con sus vencimientos y cupones.', `<button class="btn" data-newh type="button">${I('plus', 'sm')}Nuevo bono</button><button class="btn primary" data-add="inversion" type="button">${I('trend', 'sm')}Comprar</button>`)}
    <div class="kpis">
      ${kpi('Valor actual', M(sum(rows, r => r.value)), `${rows.length} posiciones`, 'var(--s3)')}
      ${kpi('Nominal total', M(nominal), 'lo que recibirás al vencimiento')}
      ${kpi('Cupones anuales', M(couponsYear), 'según cupón y nominal', 'var(--c-income)')}
      ${kpi('Rentabilidad estimada', pct(wy, 2), 'TIR aproximada ponderada')}
      ${kpi('Próximo vencimiento', next ? fdate(next.h.maturity) : '—', next ? `${esc(next.name)} · ${relDays(next.h.maturity)}` : 'Sin vencimientos', 'var(--c-saving)')}
    </div><div class="section-gap"></div>
    <div class="grid"><section class="card c-12"><div class="card-h"><div><h2>Escalera de vencimientos</h2><div class="sub">Nominal que vence cada año</div></div></div><div id="ladder"></div></section>
    <section class="card flush c-12"><div id="bTbl"></div></section></div>`;
  },
  after() {
    on('[data-add]', 'click', (e, el) => openAdd(el.dataset.add));
    on('[data-newh]', 'click', () => holdingForm(null, 'bono'));
    bindHoldingActions();
    const rows = holdingRows(h => HOLDING_KINDS[h.kind].cls === 'rf');
    const y0 = +TODAY.slice(0, 4); const years = []; for (let y = y0; y <= y0 + 10; y++) years.push(y);
    barChart($('#ladder'), { labels: years.map(String), height: 190, maxBar: 34, series: [{ name: 'Nominal', color: 'var(--s3)', values: years.map(y => sum(rows.filter(r => r.h.maturity && +r.h.maturity.slice(0, 4) === y), r => r.units * (r.h.nominal || 0))) }], tipExtra: i => rows.filter(r => r.h.maturity && +r.h.maturity.slice(0, 4) === years[i]).map(r => `<div class="tr" style="font-size:11.5px">${esc(r.name)}</div>`).join('') });
    dataTable($('#bTbl'), {
      id: 'bonos', rows, placeholder: 'Buscar por nombre, país o emisor…', search: r => `${r.name} ${r.h.country || ''} ${r.h.issuer || ''} ${r.h.bondType || ''}`, label: r => r.name, defaultSort: { key: 'maturity', dir: 1 },
      columns: [
        { key: 'name', label: 'Bono', render: r => `<div class="concept">${esc(r.name)}<span class="cell-sub">${esc(r.h.bondType || HOLDING_KINDS[r.kind].label)}</span></div>` },
        { key: 'country', label: 'País', sort: r => r.h.country || '', render: r => esc(r.h.country || '—') },
        { key: 'issuer', label: 'Emisor', sort: r => r.h.issuer || '', hideSm: true, render: r => esc(r.h.issuer || r.h.manager || '—') },
        { key: 'firstBuy', label: 'Compra', hideSm: true, render: r => fdate(r.firstBuy) },
        { key: 'maturity', label: 'Vencimiento', sort: r => r.h.maturity || '9999', render: r => r.h.maturity ? `${fdate(r.h.maturity)}<span class="cell-sub">${relDays(r.h.maturity)}</span>` : '—' },
        { key: 'coupon', label: 'Cupón', cls: 'r', sort: r => r.h.coupon || 0, render: r => r.h.coupon != null && r.h.nominal ? numFmt(r.h.coupon, 2) + ' %' : '—' },
        { key: 'nominal', label: 'Nominal', cls: 'r', sort: r => r.units * (r.h.nominal || 0), render: r => r.h.nominal ? M(r.units * r.h.nominal) : '—' },
        { key: 'value', label: 'Valor actual', cls: 'r', render: r => `${M(r.value)}<span class="cell-sub" style="text-align:right">${gainCell(r.gain).replace('<span', '<span style="font-size:11.5px"')}</span>` },
        { key: 'ytm', label: 'Rentab. estimada', cls: 'r', sort: r => bondYield(r.h) || 0, render: r => bondYield(r.h) != null ? pct(bondYield(r.h), 2) : '—' }
      ],
      actions: holdingActions, onEdit: r => holdingForm(r.h),
      onDelete: ids => withUndo('Bono eliminado', () => { S.holdings = S.holdings.filter(h => !ids.includes(h.id)); S.tx = S.tx.filter(t => !ids.includes(t.holdingId)); }),
      empty: emptyState('shield', 'Sin renta fija', 'Añade bonos o letras con su cupón y vencimiento.')
    });
  }
};

/* ---------- rentabilidad ---------- */
VIEWS.rentabilidad = {
  title: 'Rentabilidad', crumb: 'Inversiones',
  html() {
    const pf = portfolio(); const mr = monthlyReturns();
    const last12 = mr.slice(-12), ytd = mr.filter(x => x.ym.slice(0, 4) === TODAY.slice(0, 4));
    const lastFull = mr.length > 1 ? mr[mr.length - 2] : mr[mr.length - 1];
    const totalPct = pf.cost ? pf.totalReturn / pf.cost : 0;
    const UIr = UIS.retRange || '1A';
    return `${pageHead('Rentabilidad', 'Lo que han generado tus inversiones, separado de lo que has aportado. Las aportaciones aumentan tu cartera, pero no son ganancias.')}
    <div class="kpis">
      ${kpi('Rentabilidad total', `<span class="${pf.totalReturn >= 0 ? 'pos' : 'neg'}">${M(pf.totalReturn, { sign: true })}</span>`, `${pct(totalPct, 2, true)} sobre lo aportado`, 'var(--c-invest)', 'Plusvalías latentes + dividendos + cupones')}
      ${kpi('Rentabilidad anual', pct(chain(last12), 2, true), 'últimos 12 meses, ponderada en el tiempo', 'var(--c-invest)')}
      ${kpi(`En ${TODAY.slice(0, 4)}`, pct(chain(ytd), 2, true), 'en lo que va de año')}
      ${kpi('Rentabilidad mensual', lastFull ? pct(lastFull.r, 2, true) : '—', lastFull ? monthLabel(lastFull.ym) : '')}
      ${kpi('Ganancias latentes', `<span class="${pf.gain >= 0 ? 'pos' : 'neg'}">${M(pf.gain, { sign: true })}</span>`, 'no realizadas')}
      ${kpi('Dividendos', M(pf.dividends), 'cobrados', 'var(--c-income)')}
      ${kpi('Intereses', M(pf.interest), `${M(pf.couponInt)} de cupones`, 'var(--c-income)')}
    </div>
    <div class="section-gap"></div>
    <div class="grid">
      <section class="card c-12"><div class="card-h"><div><h2>Aportaciones frente a rentabilidad</h2><div class="sub">Área morada: valor de mercado. Línea discontinua: dinero aportado.</div></div><div class="right">${seg('retRange', RANGES.filter(r => r[0] !== '5A').map(([k]) => [k, k]), UIr)}</div></div>
        ${legend([{ label: 'Valor de la cartera', color: 'var(--c-invest)', line: true }, { label: 'Capital aportado', color: 'var(--ink-2)', dash: true }])}<div id="retChart"></div>
        <div class="split3" style="grid-template-columns:repeat(3,minmax(0,1fr))"><div><span class="l">Aportado</span><div class="v">${M(pf.cost, { dec: 0 })}</div></div><div><span class="l">Generado (plusvalías)</span><div class="v ${pf.gain >= 0 ? 'pos' : 'neg'}">${M(pf.gain, { sign: true, dec: 0 })}</div></div><div><span class="l">Valor actual</span><div class="v">${M(pf.value, { dec: 0 })}</div></div></div>
      </section>
      <section class="card c-12"><div class="card-h"><div><h2>Resultado mensual</h2><div class="sub">Cambio de valor descontando las aportaciones del mes</div></div></div><div id="mrChart"></div></section>
      <section class="card flush c-12"><div id="rTbl"></div></section>
    </div>`;
  },
  after() {
    bindSeg('retRange', v => { UIS.retRange = v; render(); });
    const ser = investSeries(UIS.retRange || '1A');
    lineChart($('#retChart'), { series: [{ name: 'Valor de la cartera', color: 'var(--c-invest)', data: ser.value, area: true }, { name: 'Capital aportado', color: 'var(--ink-2)', data: ser.cost, dash: true, noEnd: true }], height: 270, xfmt: xfmtFor(UIS.retRange || '1A'), tipExtra: i => { const g = ser.value[i][1] - ser.cost[i][1]; return `<div class="tsep"></div>${tipRow(g >= 0 ? 'var(--c-income)' : 'var(--c-expense)', 'Rentabilidad generada', M(g, { sign: true }))}`; } });
    const mr = monthlyReturns().slice(-18);
    barChart($('#mrChart'), { labels: mr.map(x => monthLabel(x.ym, true)), height: 210, series: [{ name: 'Resultado', color: v => v >= 0 ? 'var(--c-income)' : 'var(--c-expense)', values: mr.map(x => x.gain) }], tipTitle: i => monthLabel(mr[i].ym), tipExtra: i => `${tipRow('var(--ink-2)', 'Rentabilidad', pct(mr[i].r, 2, true))}${tipRow('var(--c-invest)', 'Aportado ese mes', M(mr[i].c))}` });
    const rows = holdingRows(() => true);
    dataTable($('#rTbl'), {
      id: 'rentab', rows, select: false, placeholder: 'Buscar inversión…', search: r => r.name, defaultSort: { key: 'gainPct', dir: -1 },
      columns: [
        { key: 'name', label: 'Inversión', render: r => `<div class="concept">${esc(r.name)}<span class="cell-sub">${esc(HOLDING_KINDS[r.kind].label)}</span></div>` },
        { key: 'cost', label: 'Aportado', cls: 'r', render: r => M(r.cost) },
        { key: 'value', label: 'Valor actual', cls: 'r', render: r => M(r.value) },
        { key: 'gain', label: 'Ganancia / pérdida', cls: 'r', render: r => `<span class="${r.gain >= 0 ? 'pos' : 'neg'}">${M(r.gain, { sign: true })}</span>` },
        { key: 'gainPct', label: 'Rentabilidad', cls: 'r', render: r => `<span class="${r.gainPct >= 0 ? 'pos' : 'neg'}">${pct(r.gainPct, 2, true)}</span>` }
      ]
    });
  }
};

/* ---------- asignación de activos ---------- */
VIEWS.asignacion = {
  title: 'Asignación de activos', crumb: 'Inversiones',
  html() {
    const al = allocation(); const tg = S.settings.target;
    const keys = ['rv', 'rf', 'liq', 'otros']; const color = { rv: 'var(--c-invest)', rf: 'var(--s3)', liq: 'var(--c-saving)', otros: 'var(--c-goal)' };
    return `${pageHead('Asignación de activos', 'Cómo se reparte tu patrimonio financiero (cuentas, inversiones y cripto; sin inmuebles ni vehículos) y cuánto se aleja de la cartera que te has marcado.')}
    <div class="grid">
      <section class="card c-5"><div class="card-h"><h2>Asignación actual</h2><span class="sub">${M(al.total, { dec: 0 })}</span></div>
        <div class="donut-wrap"><div id="alDonut"></div><div class="dleg">${keys.map(k => `<button type="button" tabindex="-1"><i style="background:${color[k]}"></i><span class="n">${CLS_LABEL[k]}</span><span class="p">${M(al.abs[k], { dec: 0 })}</span><span class="v">${pct(al[k], 0)}</span></button>`).join('')}</div></div></section>
      <section class="card c-7"><div class="card-h"><div><h2>Actual frente a objetivo</h2><div class="sub">Barra sólida: actual · contorno discontinuo: objetivo</div></div><div class="right"><button class="btn sm" data-edit-target type="button">${I('edit', 'sm')}Editar objetivo</button></div></div>
        <div class="alloc-row muted" style="font-size:12px;padding-top:0"><span>Clase</span><span class="hide-sm"></span><span class="r" style="text-align:right">Actual</span><span style="text-align:right">Objetivo</span><span style="text-align:right">Desviación</span></div>
        ${keys.map(k => { const dev = al[k] * 100 - tg[k]; const adj = tg[k] / 100 * al.total - al.abs[k]; return `<div class="alloc-row"><span><span class="cat-dot" style="background:${color[k]};display:inline-block;margin-right:8px"></span>${CLS_LABEL[k]}</span><div class="alloc-bars"><div class="a-cur" style="width:${clamp(al[k], 0, 1) * 100}%;background:${color[k]}"></div><div class="a-tgt" style="width:${clamp(tg[k] / 100, 0, 1) * 100}%"></div></div><span class="num" style="text-align:right">${pct(al[k], 1)}</span><span class="num" style="text-align:right">${numFmt(tg[k], 1)} %</span><span style="text-align:right"><span class="pill ${Math.abs(dev) < 2 ? 'flat' : Math.abs(dev) < 5 ? 'warn' : 'crit'}">${dev > 0 ? '+' : dev < 0 ? '−' : ''}${numFmt(Math.abs(dev), 1)} pp</span><span class="cell-sub" style="display:block;font-size:11px;color:var(--muted);margin-top:2px">${adj >= 0 ? 'Añadir' : 'Reducir'} ${M(Math.abs(adj), { dec: 0 })}</span></span></div>`; }).join('')}
        <div class="note" style="margin-top:12px">${I('info', 'sm')}<span>La columna de importes indica cuánto tendrías que mover a cada clase para volver exactamente al objetivo. Puedes reequilibrar con nuevas aportaciones en lugar de vender.</span></div>
      </section>
      <section class="card c-12"><div class="card-h"><h2>Evolución de la asignación</h2><span class="sub">Peso de cada clase, último año</span></div>${legend(keys.map(k => ({ label: CLS_LABEL[k], color: color[k] })))}<div id="alHist"></div></section>
    </div>`;
  },
  after() {
    const al = allocation();
    const color = { rv: 'var(--c-invest)', rf: 'var(--s3)', liq: 'var(--c-saving)', otros: 'var(--c-goal)' };
    donut($('#alDonut'), { items: ['rv', 'rf', 'liq', 'otros'].map(k => ({ key: k, label: CLS_LABEL[k], value: al.abs[k], color: color[k] })), centerLabel: 'Financiero' });
    on('[data-edit-target]', 'click', targetForm);
    const ms = monthsBack(12); const als = ms.map(m => allocation(m === D.ym(TODAY) ? TODAY : D.monthEnd(m)));
    barChart($('#alHist'), { labels: ms.map(m => monthLabel(m, true)), stacked: true, height: 220, yfmt: v => pct(v, 0), vfmt: v => pct(v, 1), series: ['rv', 'rf', 'liq', 'otros'].map(k => ({ name: CLS_LABEL[k], color: color[k], values: als.map(a => a[k]) })), tipTitle: i => monthLabel(ms[i]) });
  }
};
function targetForm() {
  const t = S.settings.target;
  const m = openModal({
    title: 'Asignación objetivo', size: 'sm', body: `<form id="tgf" class="stack" novalidate>${['rv', 'rf', 'liq', 'otros'].map(k => `<div class="row"><span style="flex:1">${CLS_LABEL[k]}</span><input class="input sm" name="${k}" inputmode="decimal" style="width:100px;text-align:right" value="${fmtIn(t[k])}" aria-label="${CLS_LABEL[k]} en porcentaje"/><span class="muted">%</span></div>`).join('')}<div class="row"><b>Total</b><span class="spacer"></span><b class="num" data-tot></b></div><span class="err" data-err></span></form>`,
    foot: `<span class="spacer"></span><button class="btn" type="button" data-cancel>Cancelar</button><button class="btn primary" type="submit" form="tgf">Guardar</button>`
  });
  const f = m.el.querySelector('form'); m.el.querySelector('[data-cancel]').onclick = m.close;
  const tot = () => { const s = sum(['rv', 'rf', 'liq', 'otros'], k => numVal(f[k].value) || 0); f.querySelector('[data-tot]').textContent = numFmt(s, 1) + ' %'; return s; };
  f.oninput = tot; tot();
  f.onsubmit = e => {
    e.preventDefault(); const s = tot();
    if (Math.abs(s - 100) > 0.05) { f.querySelector('[data-err]').textContent = `Los porcentajes deben sumar 100 % (ahora suman ${numFmt(s, 1)} %).`; return; }
    ['rv', 'rf', 'liq', 'otros'].forEach(k => S.settings.target[k] = numVal(f[k].value) || 0);
    m.close(); commit(); toast('Asignación objetivo guardada');
  };
}

/* =====================================================================
   PLANIFICACIÓN
   ===================================================================== */
VIEWS.presupuestos = {
  title: 'Presupuestos', crumb: 'Planificación',
  html() {
    const ym = UIS.budMonth || refMonth();
    const bs = budgetStatus(ym); const ms = monthStats(ym);
    const plannedInc = sum(S.recurring.filter(r => r.active && r.kind === 'ingreso'), monthlyEq) + ((+ym.slice(5) === 6 || +ym.slice(5) === 12) ? sum(S.recurring.filter(r => r.active && r.kind === 'ingreso' && r.category === 'Salario'), r => r.amount) : 0);
    const plannedExp = sum(Object.values(S.budgets));
    const plannedSave = plannedInc - plannedExp;
    const unb = Object.entries(ms.byCat).filter(([c]) => !S.budgets[c]);
    const dim = D.dim(ym); const dayN = ym === D.ym(TODAY) ? +TODAY.slice(8) : dim;
    return `${pageHead('Presupuestos', 'Un límite mensual por categoría. Las barras cambian de color al acercarte al límite y al superarlo.', `${monthSwitch(ym, 'bud')}<button class="btn primary" data-editb type="button">${I('edit', 'sm')}Editar límites</button>`)}
    <div class="grid">
      <section class="card c-12"><div class="card-h"><h2>Presupuesto mensual</h2><span class="sub">${monthLabel(ym)} · día ${dayN} de ${dim}</span></div>
        <div class="kpis">
          ${kpi('Ingresos previstos', M(plannedInc, { dec: 0 }), `Reales: ${M(ms.inc, { dec: 0 })}`, 'var(--c-income)')}
          ${kpi('Gastos previstos', M(plannedExp, { dec: 0 }), `Reales: ${M(ms.exp, { dec: 0 })} (${pct(plannedExp ? ms.exp / plannedExp : 0, 0)})`, 'var(--c-expense)')}
          ${kpi('Ahorro previsto', M(plannedSave, { dec: 0 }), `Real: ${M(ms.save, { dec: 0 })}`, 'var(--c-saving)')}
          ${kpi('Tasa de ahorro prevista', pct(plannedInc ? plannedSave / plannedInc : 0), `Real: ${pct(ms.rate)}`)}
        </div>
        <div style="margin-top:16px" class="prog ${plannedExp && ms.exp / plannedExp > 1 ? 'over' : plannedExp && ms.exp / plannedExp > 0.85 ? 'near' : ''}"><div class="prog-h"><span class="t">Gasto total frente a presupuesto</span><span class="v">${M(ms.exp, { dec: 0 })} / ${M(plannedExp, { dec: 0 })}</span></div><div class="prog-track"><div class="prog-fill" style="width:${clamp(plannedExp ? ms.exp / plannedExp : 0, 0, 1) * 100}%;background:var(--c-networth)"></div><div style="position:absolute;top:-3px;bottom:-3px;width:2px;background:var(--ink);left:${dayN / dim * 100}%" title="Día del mes"></div></div><div class="prog-meta"><span>La marca vertical indica en qué punto del mes estás.</span></div></div>
      </section>
    </div>
    <div class="section-gap"></div>
    ${bs.length ? `<div class="budgets">${bs.map(b => `<div class="bcard ${b.state}"><div class="row"><span class="cat-ic" style="background:var(--surface-3);color:${catColor(b.cat)}">${I(catIcon(b.cat), 'sm')}</span><b style="font-weight:600">${esc(b.cat)}</b><span class="spacer"></span>${b.state === 'over' ? `<span class="pill crit">${I('alert')}Superado</span>` : b.state === 'near' ? `<span class="pill warn">${I('info')}Cerca del límite</span>` : `<span class="pill up">${I('check')}En orden</span>`}</div>
      <div class="b-nums"><div><span>Presupuesto</span><b>${M(b.limit, { dec: 0 })}</b></div><div><span>Gastado</span><b>${M(b.spent)}</b></div><div><span>${b.left >= 0 ? 'Disponible' : 'Exceso'}</span><b class="${b.left < 0 ? 'neg' : ''}">${M(Math.abs(b.left))}</b></div></div>
      <div class="prog ${b.state}"><div class="prog-track"><div class="prog-fill" style="width:${clamp(b.pct, 0, 1) * 100}%;background:${catColor(b.cat)}"></div></div><div class="prog-meta"><span>${pct(b.pct, 0)} usado</span>${ym === D.ym(TODAY) && b.left > 0 ? `<span>${M(b.left / Math.max(1, dim - dayN + 1))}/día hasta fin de mes</span>` : ''}</div></div></div>`).join('')}</div>` : `<div class="card">${emptyState('target', 'Sin presupuestos', 'Define un límite mensual por categoría para controlar tus gastos.', `<button class="btn primary" data-editb type="button">Crear presupuestos</button>`)}</div>`}
    ${unb.length ? `<div class="section-gap"></div><section class="card"><div class="card-h"><h2>Gasto sin presupuesto</h2><span class="sub">Categorías con gasto este mes y sin límite</span></div>${hbars(unb.map(([c, v]) => ({ label: c, value: v, color: catColor(c) })))}</section>` : ''}`;
  },
  after() {
    bindMonthSwitch(() => UIS.budMonth || refMonth(), v => UIS.budMonth = v);
    on('[data-editb]', 'click', budgetForm);
  }
};

VIEWS.objetivos = {
  title: 'Objetivos', crumb: 'Planificación',
  html() {
    const gs = S.goals.map(g => Object.assign({ g }, goalStats(g)));
    return `${pageHead('Objetivos financieros', 'Cada objetivo muestra cuánto llevas, cuánto te falta y cuánto deberías ahorrar al mes para llegar a tiempo.', `<button class="btn primary" data-newg type="button">${I('plus', 'sm')}Nuevo objetivo</button>`)}
    <div class="kpis" style="margin-bottom:16px">
      ${kpi('Objetivos activos', String(gs.filter(x => !x.done).length), `${gs.filter(x => x.done).length} conseguidos`, 'var(--c-goal)')}
      ${kpi('Ahorro mensual necesario', M(sum(gs.filter(x => !x.done), x => x.need), { dec: 0 }), 'para cumplir todos a tiempo')}
      ${kpi('Aportación prevista', M(sum(S.goals, g => g.monthly || 0), { dec: 0 }), 'al mes, según tus planes')}
    </div>
    ${gs.length ? `<div class="goals">${gs.map(x => `<div class="goal">
      <div class="goal-h"><span class="goal-ic">${I((GOAL_KINDS[x.g.kind] || GOAL_KINDS.otro).icon)}</span><div style="min-width:0;flex:1"><div class="li-t">${esc(x.g.name)}</div><div class="li-s">${esc((GOAL_KINDS[x.g.kind] || GOAL_KINDS.otro).label)}${x.g.accountId ? ' · vinculado a ' + esc(accName(x.g.accountId)) : x.g.linkInvest ? ' · vinculado a tus inversiones' : ''}</div></div><button class="mini-btn" data-editg="${x.g.id}" type="button" aria-label="Editar objetivo">${I('edit', 'sm')}</button></div>
      <div class="row" style="align-items:flex-end"><span class="goal-pct">${pct(x.pct, 0)}</span><span class="spacer"></span><span class="num ink2">${M(x.cur, { dec: 0 })} / ${M(x.g.target, { dec: 0 })}</span></div>
      <div class="prog"><div class="prog-track"><div class="prog-fill" style="width:${clamp(x.pct, 0, 1) * 100}%;background:var(--c-goal)"></div></div></div>
      <div class="goal-grid"><div><span>Te falta</span><b>${M(x.rem, { dec: 0 })}</b></div><div><span>Fecha objetivo</span><b>${fdate(x.g.date)}</b></div><div><span>Deberías ahorrar</span><b>${x.done ? '—' : M(x.need, { dec: 0 }) + '/mes'}</b></div><div><span>Aportación prevista</span><b>${M(x.g.monthly || 0, { dec: 0 })}/mes</b></div></div>
      <div>${x.done ? `<span class="pill up">${I('check')}Conseguido</span>` : x.onTrack ? `<span class="pill up">${I('check')}Vas a tiempo</span> <span class="muted" style="font-size:12px">${x.eta ? 'Llegarías en ' + monthLabel(x.eta).toLowerCase() : ''}</span>` : `<span class="pill warn">${I('info')}Necesitas ${M(x.need - (x.g.monthly || 0), { dec: 0 })} más al mes</span>`}</div>
    </div>`).join('')}</div>` : `<div class="card">${emptyState('flag', 'Sin objetivos todavía', 'Un fondo de emergencia de 3 a 6 meses de gastos es un buen primer objetivo.', `<button class="btn primary" data-newg type="button">Crear objetivo</button>`)}</div>`}`;
  },
  after() {
    on('[data-newg]', 'click', () => goalForm());
    on('[data-editg]', 'click', (e, el) => goalForm(S.goals.find(g => g.id === el.dataset.editg)));
  }
};

VIEWS.ahorro = {
  title: 'Ahorro', crumb: 'Planificación',
  html() {
    const ym = refMonth(); const m = monthStats(ym);
    const y = TODAY.slice(0, 4); const ytd = rangeStats(`${y}-01-01`, TODAY);
    const ms = monthsBack(12); const st = ms.map(monthStats);
    const avg = sum(st, x => x.inc) ? sum(st, x => x.save) / sum(st, x => x.inc) : 0;
    const prevM = monthStats(D.ymAdd(ym, -1));
    return `${pageHead('Ahorro', 'Lo que queda tras tus gastos. La tasa de ahorro es el porcentaje de tus ingresos que no gastas.')}
    <div class="kpis">
      ${kpi('Ahorro del mes', M(m.save), `${monthLabel(ym)} · ${deltaPill(prevM.save ? m.save / prevM.save - 1 : NaN)}`, 'var(--c-saving)')}
      ${kpi(`Ahorro ${y}`, M(ytd.save, { dec: 0 }), 'en lo que va de año', 'var(--c-saving)')}
      ${kpi('Tasa de ahorro', pct(m.rate), `media 12 meses ${pct(avg)}`)}
      ${kpi('Ahorro medio mensual', M(sum(st, x => x.save) / 12, { dec: 0 }), 'últimos 12 meses')}
    </div><div class="section-gap"></div>
    <div class="grid">
      <section class="card c-12"><div class="card-h"><h2>Ingresos, gastos y ahorro</h2><span class="sub">Últimos 12 meses</span></div>${legend([{ label: 'Ingresos', color: 'var(--c-income)' }, { label: 'Gastos', color: 'var(--c-expense)' }, { label: 'Ahorro', color: 'var(--c-saving)' }])}<div id="savBars"></div></section>
      <section class="card c-6"><div class="card-h"><h2>Tasa de ahorro</h2><span class="sub">La línea discontinua marca tu media</span></div><div id="rateLine"></div></section>
      <section class="card c-6"><div class="card-h"><h2>Ahorro acumulado</h2><span class="sub">Últimos 12 meses</span></div><div id="cumLine"></div></section>
    </div>`;
  },
  after() {
    const ms = monthsBack(12); const st = ms.map(monthStats);
    barChart($('#savBars'), { labels: ms.map(m => monthLabel(m, true)), series: [{ name: 'Ingresos', color: 'var(--c-income)', values: st.map(x => x.inc) }, { name: 'Gastos', color: 'var(--c-expense)', values: st.map(x => x.exp) }, { name: 'Ahorro', color: 'var(--c-saving)', values: st.map(x => x.save) }], tipTitle: i => monthLabel(ms[i]), tipExtra: i => tipRow('var(--c-saving)', 'Tasa de ahorro', pct(st[i].rate)) });
    const avg = sum(st, x => x.inc) ? sum(st, x => x.save) / sum(st, x => x.inc) : 0;
    const pts = ms.map((m, i) => [D.mk(m, 15), st[i].rate]);
    lineChart($('#rateLine'), { series: [{ name: 'Tasa de ahorro', color: 'var(--c-saving)', data: pts, area: true }, { name: 'Media', color: 'var(--ink-2)', data: pts.map(p => [p[0], avg]), dash: true, noEnd: true }], height: 210, yfmt: v => pct(v, 0), vfmt: v => pct(v), xfmt: d => monthLabel(D.ym(d), true), tipTitle: d => monthLabel(D.ym(d)) });
    let acc = 0; const cum = ms.map((m, i) => { acc += st[i].save; return [D.monthEnd(m), acc]; });
    lineChart($('#cumLine'), { series: [{ name: 'Ahorro acumulado', color: 'var(--c-saving)', data: cum, area: true }], height: 210, zero: true, xfmt: d => monthLabel(D.ym(d), true), tipTitle: d => monthLabel(D.ym(d)) });
  }
};

VIEWS.recurrentes = {
  title: 'Recurrentes', crumb: 'Planificación',
  html() {
    const act = S.recurring.filter(r => r.active);
    const exp = act.filter(r => r.kind === 'gasto');
    const subs = exp.filter(r => r.group === 'suscripcion');
    const soon = exp.map(r => ({ r, n: nextOccurrence(r) })).filter(x => x.n && D.diff(TODAY, x.n) <= 7);
    return `${pageHead('Suscripciones y gastos recurrentes', 'Lo que tienes comprometido cada mes antes de gastar un euro.', `<button class="btn primary" data-newr type="button">${I('plus', 'sm')}Añadir recurrente</button>`)}
    <div class="kpis">
      ${kpi('Comprometido al mes', M(sum(exp, monthlyEq)), `${exp.length} gastos recurrentes`, 'var(--c-debt)')}
      ${kpi('Coste anual de tus suscripciones', M(sum(subs, r => monthlyEq(r) * 12)), `${subs.length} suscripciones · ${M(sum(subs, monthlyEq))}/mes`, 'var(--c-expense)')}
      ${kpi('Coste anual total', M(sum(exp, r => monthlyEq(r) * 12), { dec: 0 }), 'todos los gastos recurrentes')}
      ${kpi('Próximos 7 días', M(sum(soon, x => x.r.amount)), soon.length ? soon.map(x => esc(x.r.name)).join(', ') : 'Sin cobros cercanos')}
    </div><div class="section-gap"></div>
    <div class="grid"><section class="card c-12"><div class="card-h"><h2>Comprometido por grupo</h2><span class="sub">Coste mensual equivalente</span></div>${hbars(Object.entries(exp.reduce((a, r) => { a[r.group] = (a[r.group] || 0) + monthlyEq(r); return a; }, {})).sort((a, b) => b[1] - a[1]).map(([g, v], i) => ({ label: REC_GROUPS[g] || g, value: v, color: `var(--s${i + 1})` })))}</section>
    <section class="card flush c-12"><div id="recTbl"></div></section></div>`;
  },
  after() {
    on('[data-newr]', 'click', () => recurringForm());
    const rows = S.recurring.map(r => Object.assign({ next: r.active ? nextOccurrence(r) : null }, r));
    dataTable($('#recTbl'), {
      id: 'recurrentes', rows, placeholder: 'Buscar recurrente…', search: r => `${r.name} ${REC_GROUPS[r.group] || ''} ${r.category || ''}`, label: r => r.name, defaultSort: { key: 'next', dir: 1 },
      filters: [{ key: 'kind', label: 'Todos los tipos', options: [['gasto', 'Gastos'], ['ingreso', 'Ingresos'], ['aportacion', 'Aportaciones'], ['transferencia', 'Transferencias']], test: (r, v) => r.kind === v }, { key: 'group', label: 'Todos los grupos', options: Object.entries(REC_GROUPS), test: (r, v) => r.group === v }],
      columns: [
        { key: 'name', label: 'Nombre', render: r => `<div class="concept">${esc(r.name)}<span class="cell-sub">${esc(r.kind === 'gasto' ? (r.category + (r.sub ? ' › ' + r.sub : '')) : r.kind === 'aportacion' ? holdingName(r.holdingId) : r.kind === 'transferencia' ? `${accName(r.account)} → ${accName(r.toAccount)}` : r.category || '')}</span></div>` },
        { key: 'group', label: 'Grupo', render: r => `<span class="tag">${esc(REC_GROUPS[r.group] || r.group)}</span>` },
        { key: 'freq', label: 'Frecuencia', hideSm: true, render: r => FREQS[r.freq].label },
        { key: 'amount', label: 'Importe', cls: 'r', render: r => `${r.kind === 'ingreso' ? '<span class="pos">' + M(r.amount, { sign: true }) + '</span>' : M(r.amount)}${r.variable ? '<span class="cell-sub">estimado</span>' : ''}` },
        { key: 'monthly', label: 'Coste mensual', cls: 'r', sort: r => monthlyEq(r), render: r => M(monthlyEq(r)) },
        { key: 'annual', label: 'Coste anual', cls: 'r', sort: r => monthlyEq(r) * 12, hideSm: true, render: r => M(monthlyEq(r) * 12) },
        { key: 'next', label: 'Próximo pago', sort: r => r.next || '9999', render: r => r.next ? `${fdate(r.next)}<span class="cell-sub">${relDays(r.next)}</span>` : '<span class="muted">Pausado</span>' },
        { key: 'account', label: 'Cuenta', hideSm: true, sort: r => accName(r.account), render: r => esc(accName(r.account)) }
      ],
      actions: r => r.active ? `<button class="mini-btn" data-reg="${r.id}" type="button" title="Registrar ahora como movimiento" aria-label="Registrar ahora">${I('check', 'sm')}</button>` : '',
      onEdit: r => recurringForm(S.recurring.find(x => x.id === r.id)),
      onDelete: ids => withUndo('Recurrente eliminado', () => { S.recurring = S.recurring.filter(r => !ids.includes(r.id)); }),
      afterDraw: el => el.querySelectorAll('[data-reg]').forEach(b => b.onclick = async () => { const r = S.recurring.find(x => x.id === b.dataset.reg); if (await confirmDialog({ title: 'Registrar movimiento', text: `Se registrará «${esc(r.name)}» por ${money(r.amount)} con fecha de hoy.`, ok: 'Registrar' })) registerRecurring(r); })
    });
  }
};

/* ---------- calendario financiero ---------- */
function calEvents(from, to) {
  const ev = [];
  const cls = { gasto: 'expense', ingreso: 'income', aportacion: 'invest', transferencia: 'bond' };
  // pasado: movimientos reales recurrentes, nóminas y aportaciones
  ledger().txs.filter(t => t.date >= from && t.date <= to && t.date < TODAY && (t.recurring || t.type === 'inversion' || (t.type === 'ingreso' && t.amount > 100))).forEach(t => {
    ev.push({ date: t.date, label: t.concept, amount: t.amount, cls: t.type === 'gasto' ? 'expense' : t.type === 'ingreso' ? 'income' : t.type === 'inversion' ? 'invest' : 'bond', kind: t.type === 'gasto' ? (t.tags || []).includes('suscripción') ? 'Suscripción' : 'Pago' : t.type === 'ingreso' ? 'Ingreso' : t.type === 'inversion' ? 'Aportación' : 'Transferencia', done: true });
  });
  // futuro: previsiones de recurrentes
  S.recurring.filter(r => r.active).forEach(r => occurrencesBetween(r, D.max(from, TODAY), to).forEach(d => ev.push({ date: d, label: r.name, amount: r.amount, cls: cls[r.kind], kind: r.kind === 'gasto' ? (r.group === 'suscripcion' ? 'Suscripción' : 'Pago previsto') : r.kind === 'ingreso' ? 'Ingreso previsto' : r.kind === 'aportacion' ? 'Aportación' : 'Transferencia', planned: true })));
  S.holdings.filter(h => unitsAt(h) > 0).forEach(h => {
    if (h.maturity && h.maturity >= from && h.maturity <= to) ev.push({ date: h.maturity, label: `Vence ${h.name}`, amount: unitsAt(h) * (h.nominal || 0), cls: 'bond', kind: 'Vencimiento de bono' });
    if (h.coupon && h.couponMonth) { let y = +from.slice(0, 4); for (; y <= +to.slice(0, 4); y++) { const d = D.monthEnd(`${y}-${pad(h.couponMonth)}`); if (d >= from && d <= to && d >= TODAY && (!h.maturity || d <= h.maturity)) ev.push({ date: d, label: `Cupón ${h.name}`, amount: unitsAt(h) * h.nominal * h.coupon / 100, cls: 'income', kind: 'Cupón', planned: true }); } }
  });
  S.goals.filter(g => g.date >= from && g.date <= to).forEach(g => ev.push({ date: g.date, label: `Objetivo: ${g.name}`, amount: g.target, cls: 'goal', kind: 'Fecha objetivo' }));
  return ev.sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
}
VIEWS.calendario = {
  title: 'Calendario', crumb: 'Planificación',
  html() {
    const mode = UIS.calMode; const ref = UIS.calRef || TODAY;
    let from, to, label;
    if (mode === 'semana') { from = D.add(ref, -D.dow(ref)); to = D.add(from, 6); label = `${fdateLong(from)} – ${fdateLong(to)}`; }
    else { const ym = D.ym(ref); from = `${ym}-01`; to = D.monthEnd(ym); label = monthLabel(ym); }
    const ev = calEvents(mode === 'mes' ? D.add(from, -D.dow(from)) : from, mode === 'mes' ? D.add(to, 6 - D.dow(to)) : to);
    const inRange = ev.filter(e => e.date >= from && e.date <= to);
    const evHtml = e => `<button class="ev ${e.cls}" type="button" title="${esc(e.kind)} · ${esc(e.label)} · ${esc(money(e.amount))}"><i style="background:${e.cls === 'income' ? 'var(--c-income)' : e.cls === 'expense' ? 'var(--c-expense)' : e.cls === 'invest' ? 'var(--c-invest)' : e.cls === 'goal' ? 'var(--c-goal)' : 'var(--c-saving)'}"></i><span>${esc(e.label)}</span></button>`;
    let body = '';
    if (mode === 'mes') {
      const start = D.add(from, -D.dow(from)); const end = D.add(to, 6 - D.dow(to));
      body = `<div class="cal">${DOW.map(d => `<div class="cal-dow">${d}</div>`).join('')}`;
      for (let d = start; d <= end; d = D.add(d, 1)) {
        const de = ev.filter(e => e.date === d);
        body += `<div class="cal-day${d < from || d > to ? ' out' : ''}${d === TODAY ? ' today' : ''}"><span class="cal-n">${+d.slice(8)}</span>${de.slice(0, 3).map(evHtml).join('')}${de.length > 3 ? `<span class="ev-more">+${de.length - 3} más</span>` : ''}</div>`;
      }
      body += '</div>';
    } else if (mode === 'semana') {
      body = `<div class="week">${[0, 1, 2, 3, 4, 5, 6].map(k => { const d = D.add(from, k); const de = ev.filter(e => e.date === d); return `<div class="week-col${d === TODAY ? ' today' : ''}"><h5>${DOW[k]} ${+d.slice(8)}</h5>${de.map(e => `${evHtml(e)}<span class="num muted" style="font-size:11px;padding-left:6px">${M(e.amount)}</span>`).join('') || '<span class="muted" style="font-size:12px">—</span>'}</div>`; }).join('')}</div>`;
    } else {
      const lf = TODAY, lt = D.addMonthsISO(TODAY, 2);
      const le = calEvents(lf, lt);
      body = le.length ? `<div class="list">${le.map(e => `<div class="li"><span class="li-ic" style="background:var(--surface-3)"><span class="num" style="font-size:12px;font-weight:600">${+e.date.slice(8)}<br><span style="font-size:9.5px;font-weight:500;color:var(--muted)">${MONTHS_S[+e.date.slice(5, 7) - 1]}</span></span></span><span class="li-main"><span class="li-t">${esc(e.label)}</span><span class="li-s">${esc(e.kind)} · ${relDays(e.date)}</span></span><span class="li-v ${e.cls === 'income' ? 'pos' : ''}">${M(e.amount)}</span></div>`).join('')}</div>` : emptyState('calendar', 'Nada previsto', 'Añade recurrentes para ver aquí los próximos cobros y pagos.');
      label = 'Próximos 60 días';
    }
    const sumBy = c => sum(inRange.filter(e => e.cls === c), e => e.amount);
    return `${pageHead('Calendario financiero', 'Nóminas, recibos, suscripciones, aportaciones, cupones y vencimientos en una sola vista.')}
    <section class="card"><div class="card-h"><div class="row" style="gap:4px">${mode !== 'lista' ? `<button class="btn xs ghost" data-cal="-1" type="button" aria-label="Anterior">${I('left', 'sm')}</button><button class="btn xs" data-cal="0" type="button">Hoy</button><button class="btn xs ghost" data-cal="1" type="button" aria-label="Siguiente">${I('right', 'sm')}</button>` : ''}<h2 style="margin-left:8px">${label}</h2></div><div class="right">${seg('calMode', [['mes', 'Mes'], ['semana', 'Semana'], ['lista', 'Lista']], mode)}</div></div>
      ${mode !== 'lista' ? `<div class="legend">${[['Ingresos', 'var(--c-income)', sumBy('income')], ['Pagos', 'var(--c-expense)', sumBy('expense')], ['Aportaciones', 'var(--c-invest)', sumBy('invest')], ['Bonos y transferencias', 'var(--c-saving)', sumBy('bond')]].map(([l, c, v]) => `<span><i style="background:${c}"></i>${l} <b class="num" style="font-weight:500">${M(v, { dec: 0 })}</b></span>`).join('')}</div>` : ''}
      <div style="overflow-x:auto">${body}</div></section>`;
  },
  after() {
    bindSeg('calMode', v => { UIS.calMode = v; render(); });
    on('[data-cal]', 'click', (e, el) => {
      const d = +el.dataset.cal; const ref = UIS.calRef || TODAY;
      UIS.calRef = d === 0 ? TODAY : UIS.calMode === 'semana' ? D.add(ref, 7 * d) : D.mk(D.ymAdd(D.ym(ref), d), 1);
      render();
    });
  }
};
