/* Patrimonia — vistas: Inicio, Movimientos, Patrimonio */
'use strict';

const UIS = { dashMonth: null, range: '1A', donutSel: null, accSel: null, cashSel: null, params: {}, an: null, anInc: null, rep: null, calMode: 'mes', calRef: null, budMonth: null };
const VIEWS = {};
const on = (sel, ev, fn) => $$(sel, $('#content')).forEach(el => el.addEventListener(ev, e => fn(e, el)));

/* ---------- piezas comunes ---------- */
function pageHead(title, desc, right = '') {
  return `<div class="page-head"><div><h1 class="page-h" style="font-size:24px;white-space:normal">${esc(title)}</h1>${desc ? `<p>${desc}</p>` : ''}</div>${right ? `<div class="right">${right}</div>` : ''}</div>`;
}
function kpi(label, value, sub = '', color, tipText) {
  return `<div class="kpi"${tipText ? ` title="${esc(tipText)}"` : ''}><span class="k-l">${color ? `<span class="k-dot" style="background:${color}"></span>` : ''}${esc(label)}</span><span class="k-v">${value}</span>${sub ? `<span class="k-s">${sub}</span>` : ''}</div>`;
}
function signedAmount(t, opts = {}) {
  if (t.type === 'gasto') return `<span class="neg">${M(-t.amount)}</span>`;
  if (t.type === 'ingreso') return `<span class="pos">${M(t.amount, { sign: true })}</span>`;
  if (t.type === 'venta') return `<span class="pos">${M(t.amount, { sign: true })}</span>`;
  if (t.type === 'ajuste') return `<span class="ink2">${M(t.amount, { sign: true })}</span>`;
  return `<span class="ink2">${M(t.amount)}</span>`;
}
const TYPE_META = {
  gasto: { label: 'Gasto', icon: 'dn', pill: 'down' }, ingreso: { label: 'Ingreso', icon: 'up', pill: 'up' },
  transferencia: { label: 'Transferencia', icon: 'transfer', pill: 'info' }, inversion: { label: 'Inversión', icon: 'trend', pill: 'info' },
  'compra-activo': { label: 'Compra de activo', icon: 'box', pill: 'flat' }, venta: { label: 'Venta', icon: 'up', pill: 'up' },
  ajuste: { label: 'Ajuste de saldo', icon: 'scale', pill: 'flat' }
};
function txIcon(t) {
  if (t.type === 'gasto') return `<span class="li-ic" style="color:${catColor(t.category)}">${I(catIcon(t.category), 'sm')}</span>`;
  if (t.type === 'ingreso') return `<span class="li-ic" style="color:var(--c-income);background:var(--c-income-soft)">${I(catIcon(t.category, 'ingreso'), 'sm')}</span>`;
  if (t.type === 'inversion') return `<span class="li-ic" style="color:var(--c-invest);background:var(--c-invest-soft)">${I('trend', 'sm')}</span>`;
  return `<span class="li-ic" style="color:var(--c-saving);background:var(--c-saving-soft)">${I(TYPE_META[t.type] ? TYPE_META[t.type].icon : 'transfer', 'sm')}</span>`;
}
function txSubline(t) {
  const parts = [fdate(t.date, true)];
  if (t.type === 'gasto') parts.push(t.category + (t.sub ? ' › ' + t.sub : ''), accName(t.account));
  else if (t.type === 'ingreso') parts.push(t.category, accName(t.account));
  else if (t.type === 'transferencia') parts.push(`${accName(t.account)} → ${accName(t.toAccount)}`);
  else if (t.type === 'inversion') parts.push(`${accName(t.account)} → ${holdingName(t.holdingId)}`);
  else parts.push(accName(t.account));
  return parts.join(' · ');
}
function txList(txs, { empty } = {}) {
  if (!txs.length) return empty || emptyState('moves', 'Sin movimientos todavía', 'Registra tu primer gasto o ingreso con «Añadir».');
  return `<div class="list">${txs.map(t => `<button class="li" type="button" data-tx="${t.id}">${txIcon(t)}<span class="li-main"><span class="li-t">${esc(t.concept)}</span><span class="li-s">${esc(txSubline(t))}</span></span><span class="li-v">${signedAmount(t)}<span class="li-s" style="text-align:right">${TYPE_META[t.type] ? TYPE_META[t.type].label : ''}</span></span></button>`).join('')}</div>`;
}
function bindTxList() { on('[data-tx]', 'click', (e, el) => { const t = S.tx.find(x => x.id === el.dataset.tx); if (t) editTx(t); }); }
function monthSwitch(ym, key) {
  return `<div class="row" style="gap:4px"><button class="btn xs ghost" data-ms="${key}" data-d="-1" type="button" aria-label="Mes anterior">${I('left', 'sm')}</button><span style="font-weight:560;min-width:118px;text-align:center">${monthLabel(ym)}</span><button class="btn xs ghost" data-ms="${key}" data-d="1" type="button" aria-label="Mes siguiente" ${ym >= D.ym(TODAY) ? 'disabled' : ''}>${I('right', 'sm')}</button></div>`;
}
function bindMonthSwitch(getter, setter) {
  on('[data-ms]', 'click', (e, el) => { const nv = D.ymAdd(getter(), +el.dataset.d); if (nv <= D.ym(TODAY)) { setter(nv); render(); } });
}
function seg(name, options, cur) {
  return `<div class="seg" role="tablist" data-seg="${name}">${options.map(([k, l]) => `<button type="button" role="tab" data-v="${k}" class="${k === cur ? 'on' : ''}" aria-selected="${k === cur}">${esc(l)}</button>`).join('')}</div>`;
}
function bindSeg(name, fn) { on(`[data-seg="${name}"] button`, 'click', (e, el) => fn(el.dataset.v)); }

/* series de patrimonio para el selector de rango */
const RANGES = [['1M', '1 mes'], ['3M', '3 meses'], ['6M', '6 meses'], ['1A', '1 año'], ['5A', '5 años'], ['Todo', 'Todo']];
function nwSeries(range, fn = nwAt) {
  const pts = [];
  if (range === '5A' || range === 'Todo') {
    const first = range === 'Todo' ? firstDate() : D.addMonthsISO(TODAY, -60);
    let ym = D.ym(D.max(first, firstDate()));
    while (ym < D.ym(TODAY)) { const v = fn(D.monthEnd(ym)); if (v != null) pts.push([D.monthEnd(ym), v]); ym = D.ymAdd(ym, 1); }
    pts.push([TODAY, fn(TODAY)]);
    return pts;
  }
  const months = { '1M': 1, '3M': 3, '6M': 6, '1A': 12 }[range];
  const step = { '1M': 1, '3M': 2, '6M': 4, '1A': 7 }[range];
  const start = D.addMonthsISO(TODAY, -months);
  const n = D.diff(start, TODAY);
  for (let k = n % step; k <= n; k += step) { const d = D.add(start, k); const v = fn(d); if (v != null) pts.push([d, v]); }
  if (!pts.length || pts[pts.length - 1][0] !== TODAY) pts.push([TODAY, fn(TODAY)]);
  return pts;
}
const xfmtFor = range => (['5A', 'Todo'].includes(range) ? d => monthLabel(D.ym(d), true) : range === '1A' ? d => monthLabel(D.ym(d), true) : d => fdate(d, true));

/* clases para la distribución */
function distItems(b) {
  return [
    { key: 'fondos', label: 'Fondos indexados y ETF', value: b.fondos, color: 'var(--s1)', route: 'fondos', icon: 'layers', f: x => x.fondos },
    { key: 'acciones', label: 'Acciones', value: b.acciones, color: 'var(--s2)', route: 'acciones', icon: 'building', f: x => x.acciones },
    { key: 'bonos', label: 'Bonos y renta fija', value: b.bonos, color: 'var(--s3)', route: 'bonos', icon: 'shield', f: x => x.bonos },
    { key: 'bancos', label: 'Bancos', value: b.bancos, color: 'var(--s4)', route: 'cuentas', icon: 'bank', f: x => x.bancos },
    { key: 'efectivo', label: 'Efectivo', value: b.efectivo, color: 'var(--s5)', route: 'efectivo', icon: 'cash', f: x => x.efectivo },
    { key: 'otros', label: 'Otros activos', value: b.otros, color: 'var(--s6)', route: 'activos', icon: 'box', f: x => x.otros }
  ];
}

/* =====================================================================
   INICIO › RESUMEN
   ===================================================================== */
VIEWS.resumen = {
  title: 'Resumen financiero', crumb: 'Inicio',
  html() {
    const b = breakdown();
    const mAgo = D.addMonthsISO(TODAY, -1), yAgo = D.addMonthsISO(TODAY, -12);
    const nwM = nwAt(mAgo), nwY = nwAt(yAgo);
    const dM = nwM ? b.nw / nwM - 1 : NaN, dY = nwY ? b.nw / nwY - 1 : NaN;
    const ym = UIS.dashMonth || refMonth();
    const ms = monthStats(ym);
    const avgRate = (() => { const r = monthsBack(12, D.ymAdd(ym, -1)).map(monthStats).filter(x => x.inc > 0); return r.length ? sum(r, x => x.save) / sum(r, x => x.inc) : 0; })();
    const mx = Math.max(ms.inc, ms.exp, 1);
    const items = distItems(b);
    const months12 = monthsBack(12);
    const bds = months12.map(m => breakdown(m === D.ym(TODAY) ? TODAY : D.monthEnd(m)));
    const budgets = budgetStatus(ym).sort((x, y) => y.pct - x.pct).slice(0, 4);
    const goals = S.goals.slice(0, 3);
    const alerts = computeAlerts().slice(0, 3);
    const recent = ledger().desc.filter(t => t.date <= TODAY).slice(0, 8);
    const rangeLbl = (RANGES.find(r => r[0] === UIS.range) || [])[1];
    const ser = nwSeries(UIS.range);
    const ch = ser.length > 1 ? b.nw - ser[0][1] : 0;
    const fresh = !S.tx.length && !S.holdings.length && !S.assets.length;
    const steps = [
      { done: S.accounts.some(a => a.initial), t: 'Ajusta tus cuentas y saldos', s: 'Indica cuánto tienes hoy en cada banco y en efectivo.', go: 'cuentas', btn: 'Ir a cuentas' },
      { done: S.tx.length > 0, t: 'Registra o importa tus movimientos', s: 'Añade un gasto (tecla G) o trae tu historial desde un Excel o el extracto del banco.', act: 'excel', btn: 'Importar Excel' },
      { done: S.holdings.length + S.assets.length + S.liabilities.length > 0, t: 'Añade inversiones, bienes y deudas', s: 'Fondos, acciones, bonos, vivienda, coche o hipoteca.', act: 'inversion', btn: 'Añadir inversión' },
      { done: Object.keys(S.budgets).length + S.goals.length > 0, t: 'Marca presupuestos y objetivos', s: 'Límites por categoría y metas de ahorro.', go: 'presupuestos', btn: 'Crear presupuestos' }
    ];
    return `
    <div class="grid">
      ${fresh || steps.some(s => !s.done) && S.tx.length < 5 ? `<section class="card c-12 onboard" aria-label="Primeros pasos"><div class="card-h"><div><h2>Hola${AUTH.user ? ', ' + esc(AUTH.user.name.split(' ')[0]) : ''}. Empecemos</h2><div class="sub">Cuatro pasos para tener tu situación financiera completa. Todo se calcula solo a partir de aquí.</div></div><div class="right"><span class="pill info">${steps.filter(s => s.done).length} de 4</span></div></div>
        <div class="steps">${steps.map((s, i) => `<div class="step${s.done ? ' done' : ''}"><span class="step-n">${s.done ? I('check', 'sm') : i + 1}</span><div style="min-width:0;flex:1"><div class="li-t">${s.t}</div><div class="li-s" style="white-space:normal">${s.s}</div></div>${s.done ? '' : `<button class="btn sm" type="button" ${s.go ? `data-sgo="${s.go}"` : `data-sadd="${s.act}"`}>${s.btn}</button>`}</div>`).join('')}</div></section>` : ''}
      <section class="card hero c-7" aria-label="Patrimonio neto">
        <div class="hero-top"><div style="min-width:0">
          <div class="eyebrow">Patrimonio neto</div>
          <div class="hero-num nw-amt">${M(b.nw)}</div>
          <div class="hero-vars">${deltaPill(dM)} <span>vs mes anterior</span><span style="width:6px"></span>${deltaPill(dY)} <span>vs hace un año (${M(b.nw - (nwY || 0), { sign: true, dec: 0 })})</span></div>
        </div></div>
        <div class="split3">
          <div><span class="l"><span class="k-dot" style="width:8px;height:8px;border-radius:3px;background:var(--c-invest)"></span>Invertido</span><div class="v">${M(b.invested, { dec: 0 })}</div></div>
          <div><span class="l"><span class="k-dot" style="width:8px;height:8px;border-radius:3px;background:var(--c-saving)"></span>Líquido</span><div class="v">${M(b.liq, { dec: 0 })}</div></div>
          <div><span class="l"><span class="k-dot" style="width:8px;height:8px;border-radius:3px;background:var(--c-goal)"></span>No líquido</span><div class="v">${M(b.fisicos, { dec: 0 })}</div></div>
        </div>
        <div class="compbar" aria-hidden="true"><span style="flex-grow:${b.invested};background:var(--c-invest)"></span><span style="flex-grow:${b.liq};background:var(--c-saving)"></span><span style="flex-grow:${b.fisicos};background:var(--c-goal)"></span></div>
        <div class="equation" title="El patrimonio neto se calcula restando lo que debes de lo que tienes">
          <span>Activos</span><span class="num">${M(b.assets, { dec: 0 })}</span><span class="op">−</span><span>Pasivos</span><span class="num">${M(b.liab, { dec: 0 })}</span><span class="op">=</span><span>Patrimonio neto</span><span class="num nw-amt">${M(b.nw, { dec: 0 })}</span>
        </div>
      </section>

      <section class="card c-5" aria-label="Flujo del mes">
        <div class="card-h"><h2>Este mes</h2><div class="right">${monthSwitch(ym, 'dash')}</div></div>
        <div class="flow-rows">
          <div class="flow-row"><span class="fl">${I('up', 'sm')}Ingresos</span><div class="bar-track"><div class="bar-fill" style="width:${ms.inc / mx * 100}%;background:var(--c-income)"></div></div><span class="fv">${M(ms.inc)}</span></div>
          <div class="flow-row"><span class="fl">${I('dn', 'sm')}Gastos</span><div class="bar-track"><div class="bar-fill" style="width:${ms.exp / mx * 100}%;background:var(--c-expense)"></div></div><span class="fv">${M(ms.exp)}</span></div>
          <div class="flow-row"><span class="fl">${I('piggy', 'sm')}Ahorro</span><div class="bar-track"><div class="bar-fill" style="width:${Math.max(0, ms.save) / mx * 100}%;background:var(--c-saving)"></div></div><span class="fv ${ms.save < 0 ? 'neg' : ''}">${M(ms.save)}</span></div>
        </div>
        <div class="rate-ring">${ring(ms.rate, 'var(--c-saving)', 54, 6)}<div><div class="muted" style="font-size:12px">Tasa de ahorro</div><div class="num" style="font-size:22px;letter-spacing:-.03em">${pct(ms.rate)}</div><div class="muted" style="font-size:12px">Media últimos 12 meses: ${pct(avgRate)} <span class="pill ${Math.abs(ms.rate - avgRate) < 0.005 ? 'flat' : ms.rate > avgRate ? 'up' : 'down'}">${ms.rate >= avgRate ? '+' : '−'}${numFmt(Math.abs(ms.rate - avgRate) * 100, 1)} pp</span></div></div></div>
        ${ms.invest ? `<p class="muted" style="font-size:12px;margin:10px 0 0">Además has aportado ${M(ms.invest)} a tus inversiones este mes (no cuenta como gasto).</p>` : ''}
      </section>

      <section class="c-12" aria-label="Resumen de activos"><div class="tiles">
        ${items.map(it => {
          const vals = bds.map(it.f); const first = vals[vals.length - 2] || 0; const ch1 = first ? it.value / first - 1 : NaN;
          return `<a class="tile" href="#${it.route}"><span class="t-h"><span class="t-ic" style="background:var(--surface-3);color:${it.color}">${I(it.icon, 'sm')}</span>${esc(it.label.replace(' y ETF', '').replace(' y renta fija', ''))}</span><span class="t-v">${M(it.value, { dec: 0 })}</span><span class="t-f"><span>${isFinite(ch1) ? `<span class="${ch1 >= 0 ? 'pos' : 'neg'}">${pct(ch1, 1, true)}</span> mes` : '—'}</span>${sparkline(vals, it.color)}</span></a>`;
        }).join('')}
      </div></section>

      <section class="card c-8" aria-label="Evolución del patrimonio">
        <div class="card-h"><div><h2>Evolución del patrimonio</h2><div class="sub">${rangeLbl}: <span class="${ch >= 0 ? 'pos' : 'neg'}">${M(ch, { sign: true, dec: 0 })}</span></div></div><div class="right">${seg('range', RANGES.map(([k]) => [k, k]), UIS.range)}</div></div>
        <div id="nwChart"></div>
        ${UIS.range === 'Todo' || UIS.range === '5A' ? `<p class="legend-note">Antes de ${monthLabel(D.ym(ledger().start)).toLowerCase()} se muestra el histórico mensual importado.</p>` : ''}
      </section>

      <section class="card c-4" aria-label="Distribución patrimonial">
        <div class="card-h"><h2>Distribución</h2><span class="sub">Pulsa una categoría</span></div>
        <div class="donut-wrap" style="grid-template-columns:minmax(0,1fr)"><div id="distDonut" style="max-width:190px;margin:0 auto;width:100%"></div>
        <div class="dleg">${items.map(it => `<button type="button" data-dk="${it.key}" class="${UIS.donutSel === it.key ? 'on' : ''}"><i style="background:${it.color}"></i><span class="n">${esc(it.label)}</span><span class="p">${pct(it.value / (b.assets || 1), 0)}</span><span class="v">${M(it.value, { dec: 0 })}</span></button>`).join('')}</div></div>
        ${(() => {
          const it = items.find(i => i.key === UIS.donutSel); if (!it) return '';
          const y0 = it.f(breakdown(yAgo)); const evo = y0 ? it.value / y0 - 1 : NaN;
          return `<div class="detail-panel"><div><span>Importe</span><b>${M(it.value)}</b></div><div><span>% de tus activos</span><b>${pct(it.value / (b.assets || 1))}</b></div><div><span>Evolución 12 meses</span><b class="${evo >= 0 ? 'pos' : 'neg'}">${isFinite(evo) ? pct(evo, 1, true) : '—'}</b></div><div style="grid-column:1/-1">${sparkline(bds.map(it.f), it.color, 260, 36).replace('class="spark"', 'class="spark" style="width:100%;height:36px"')}</div><div style="grid-column:1/-1"><a href="#${it.route}">Ver detalle ${I('right', 'sm')}</a></div></div>`;
        })()}
      </section>

      <section class="card c-7" aria-label="Últimos movimientos">
        <div class="card-h"><h2>Últimos movimientos</h2><div class="right"><a class="btn sm ghost" href="#gastos">Ver gastos</a><a class="btn sm ghost" href="#ingresos">Ver ingresos</a></div></div>
        ${txList(recent)}
      </section>

      <section class="c-5 stack">
        <div class="card"><div class="card-h"><h2>Presupuestos</h2><span class="sub">${monthLabel(ym)}</span><div class="right"><a class="btn sm ghost" href="#presupuestos">Ver todos</a></div></div>
          <div class="stack">${budgets.length ? budgets.map(budgetRow).join('') : emptyState('target', 'Sin presupuestos', 'Define límites por categoría para ver aquí tu progreso.')}</div></div>
        <div class="card"><div class="card-h"><h2>Objetivos</h2><div class="right"><a class="btn sm ghost" href="#objetivos">Ver todos</a></div></div>
          <div class="stack">${goals.length ? goals.map(g => { const st = goalStats(g); return `<div class="prog"><div class="prog-h"><span class="t">${esc(g.name)}</span><span class="v">${M(st.cur, { dec: 0 })} / ${M(g.target, { dec: 0 })}</span></div><div class="prog-track"><div class="prog-fill" style="width:${clamp(st.pct, 0, 1) * 100}%;background:var(--c-goal)"></div></div><div class="prog-meta"><span>${pct(st.pct, 0)}</span><span>${st.done ? 'Conseguido' : `${M(st.need, { dec: 0 })}/mes hasta ${fdate(g.date)}`}</span></div></div>`; }).join('') : emptyState('flag', 'Sin objetivos', 'Crea un objetivo para seguir tu progreso.')}</div></div>
        ${alerts.length ? `<div class="card"><div class="card-h"><h2>Avisos</h2></div><div class="alert-list" style="margin:0 -20px -20px">${alerts.map(a => `<a class="alert ${a.lvl}" href="#${a.go}" style="text-decoration:none;color:inherit"><span class="a-ic">${I(a.icon, 'sm')}</span><span><span class="a-t" style="display:block">${esc(a.t)}</span><span class="a-s" style="display:block">${esc(a.s)}</span></span></a>`).join('')}</div></div>` : ''}
      </section>
    </div>`;
  },
  after() {
    bindMonthSwitch(() => UIS.dashMonth || refMonth(), v => UIS.dashMonth = v);
    bindSeg('range', v => { UIS.range = v; render(); });
    on('[data-sgo]', 'click', (e, el) => navigate(el.dataset.sgo));
    on('[data-sadd]', 'click', (e, el) => el.dataset.sadd === 'excel' ? importWizard() : openAdd(el.dataset.sadd));
    bindTxList();
    const ser = nwSeries(UIS.range);
    lineChart($('#nwChart'), {
      series: [{ name: 'Patrimonio neto', color: 'var(--c-networth)', data: ser, area: true }],
      height: 270, xfmt: xfmtFor(UIS.range), label: 'Evolución del patrimonio neto',
      tipTitle: d => ['5A', 'Todo'].includes(UIS.range) ? monthLabel(D.ym(d)) : fdateLong(d),
      tipExtra: i => { const d = ser[i][0]; if (d < ledger().start) return ''; const b = breakdown(d); return `<div class="tsep"></div>${tipRow('var(--c-invest)', 'Invertido', M(b.invested, { dec: 0 }))}${tipRow('var(--c-saving)', 'Líquido', M(b.liq, { dec: 0 }))}${tipRow('var(--c-debt)', 'Pasivos', M(-b.liab, { dec: 0 }))}`; }
    });
    const b = breakdown();
    donut($('#distDonut'), { items: distItems(b), selected: UIS.donutSel, centerLabel: 'Activos totales', onSelect: k => { UIS.donutSel = k; render(); } });
    on('[data-dk]', 'click', (e, el) => { UIS.donutSel = UIS.donutSel === el.dataset.dk ? null : el.dataset.dk; render(); });
  }
};
function budgetRow(b) {
  return `<div class="prog ${b.state}"><div class="prog-h"><span class="t"><span class="cat-dot" style="background:${catColor(b.cat)}"></span>${esc(b.cat)}</span><span class="v">${M(b.spent, { dec: 0 })} / ${M(b.limit, { dec: 0 })}</span></div><div class="prog-track"><div class="prog-fill" style="width:${clamp(b.pct, 0, 1) * 100}%;background:${catColor(b.cat)}"></div></div><div class="prog-meta">${b.state === 'over' ? `<span class="pill crit">${I('alert')}Superado en ${M(-b.left, { dec: 0 })}</span>` : b.state === 'near' ? `<span class="pill warn">${I('info')}Quedan ${M(b.left, { dec: 0 })}</span>` : `<span>Disponible ${M(b.left, { dec: 0 })}</span>`}<span>${pct(b.pct, 0)}</span></div></div>`;
}

/* =====================================================================
   INICIO › PATRIMONIO (balance)
   ===================================================================== */
function balanceGroups(iso = TODAY) {
  const groups = { liq: [], rf: [], rv: [], otros: [] };
  S.accounts.forEach(a => groups.liq.push({ name: a.name, sub: (ACCOUNT_TYPES[a.type] || {}).label, v: balAt(a.id, iso), icon: (ACCOUNT_TYPES[a.type] || {}).icon, route: a.type === 'efectivo' ? 'efectivo' : 'cuentas' }));
  S.holdings.forEach(h => { const v = valueAt(h, iso); if (v > 0.004) groups[HOLDING_KINDS[h.kind].cls].push({ name: h.name, sub: HOLDING_KINDS[h.kind].label, v, icon: HOLDING_KINDS[h.kind].icon, route: HOLDING_KINDS[h.kind].group === 'otros' ? 'cartera' : HOLDING_KINDS[h.kind].group }); });
  S.assets.forEach(a => { const v = assetValueAt(a, iso); if (v > 0) groups.otros.push({ name: a.name, sub: ASSET_KINDS[a.kind].label, v, icon: ASSET_KINDS[a.kind].icon, route: 'activos' }); });
  return groups;
}
VIEWS.balance = {
  title: 'Patrimonio', crumb: 'Inicio',
  html() {
    const b = breakdown(); const g = balanceGroups();
    const clsColor = { liq: 'var(--c-saving)', rf: 'var(--s3)', rv: 'var(--c-invest)', otros: 'var(--c-goal)' };
    const ratio = b.assets ? b.liab / b.assets : 0;
    return `${pageHead('Tu patrimonio', 'Todo lo que tienes y todo lo que debes, en un único balance. Se recalcula con cada movimiento.', `<button class="btn" data-add="activo" type="button">${I('plus', 'sm')}Activo</button><button class="btn" data-add="pasivo" type="button">${I('plus', 'sm')}Pasivo</button>`)}
    <div class="kpis">
      ${kpi('Patrimonio neto', `<span class="nw-amt">${M(b.nw, { dec: 0 })}</span>`, `${deltaPill(nwAt(D.addMonthsISO(TODAY, -12)) ? b.nw / nwAt(D.addMonthsISO(TODAY, -12)) - 1 : NaN)} en 12 meses`, 'var(--c-networth)')}
      ${kpi('Activos totales', M(b.assets, { dec: 0 }), `${S.accounts.length + S.holdings.filter(h => unitsAt(h) > 0).length + S.assets.length} elementos`, 'var(--c-income)')}
      ${kpi('Pasivos totales', M(b.liab, { dec: 0 }), `${pct(ratio)} de tus activos`, 'var(--c-debt)')}
      ${kpi('Liquidez', M(b.liq, { dec: 0 }), `${numFmt(b.liq / Math.max(1, avgMonthlyExpense()), 1)} meses de gastos`, 'var(--c-saving)')}
    </div>
    <div class="section-gap"></div>
    <div class="grid">
      <section class="card c-7"><div class="card-h"><h2>Activos</h2><span class="sub">${M(b.assets)}</span></div>
        ${['liq', 'rf', 'rv', 'otros'].map(k => { const list = g[k]; const tot = sum(list, x => x.v); return `<div style="margin-bottom:14px"><div class="row" style="padding:6px 0;border-bottom:1px solid var(--line)"><span class="cat-dot" style="background:${clsColor[k]}"></span><b style="font-weight:600">${CLS_LABEL[k]}</b><span class="muted" style="font-size:12px">${pct(tot / (b.assets || 1), 0)}</span><span class="spacer"></span><span class="num">${M(tot)}</span></div>
          ${list.length ? `<div class="list">${list.sort((x, y) => y.v - x.v).map(x => `<a class="li" href="#${x.route}" style="text-decoration:none;color:inherit"><span class="li-ic">${I(x.icon, 'sm')}</span><span class="li-main"><span class="li-t">${esc(x.name)}</span><span class="li-s">${esc(x.sub || '')}</span></span><span class="li-v">${M(x.v)}</span></a>`).join('')}</div>` : '<p class="muted" style="font-size:12.5px;margin:8px 0">Sin activos en esta clase.</p>'}</div>`; }).join('')}
      </section>
      <section class="c-5 stack">
        <div class="card"><div class="card-h"><h2>Pasivos</h2><span class="sub">${M(b.liab)}</span><div class="right"><a class="btn sm ghost" href="#pasivos">Gestionar</a></div></div>
          ${S.liabilities.length ? `<div class="list">${S.liabilities.map(l => `<a class="li" href="#pasivos" style="text-decoration:none;color:inherit"><span class="li-ic" style="color:var(--c-debt);background:var(--c-debt-soft)">${I(LIAB_KINDS[l.kind].icon, 'sm')}</span><span class="li-main"><span class="li-t">${esc(l.name)}</span><span class="li-s">${esc(LIAB_KINDS[l.kind].label)}${l.rate ? ' · ' + numFmt(l.rate) + ' % TIN' : ''}</span></span><span class="li-v neg">${M(-liabBalanceAt(l))}</span></a>`).join('')}</div>` : emptyState('scale', 'Sin deudas registradas', 'Si tienes hipoteca, préstamos o tarjetas, añádelos para calcular tu patrimonio neto real.')}
        </div>
        <div class="card"><div class="card-h"><h2>Balance</h2></div>
          <dl class="kv"><dt>Liquidez</dt><dd>${M(b.liq)}</dd><dt>Renta fija</dt><dd>${M(b.rf)}</dd><dt>Renta variable</dt><dd>${M(b.rv)}</dd><dt>Otros (cripto y bienes)</dt><dd>${M(b.crypto + b.fisicos)}</dd><dt style="color:var(--ink);font-weight:600">Activos</dt><dd style="font-weight:600">${M(b.assets)}</dd><dt>Pasivos</dt><dd class="neg">${M(-b.liab)}</dd><dt style="color:var(--ink);font-weight:600">Patrimonio neto</dt><dd style="font-weight:600" class="nw-amt">${M(b.nw)}</dd></dl>
        </div>
      </section>
      <section class="card c-12"><div class="card-h"><div><h2>Composición mes a mes</h2><div class="sub">Activos por clase sobre el eje; los pasivos restan por debajo de cero</div></div></div>
        ${legend([{ label: 'Liquidez', color: clsColor.liq }, { label: 'Renta fija', color: clsColor.rf }, { label: 'Renta variable', color: clsColor.rv }, { label: 'Otros', color: clsColor.otros }, { label: 'Pasivos', color: 'var(--c-debt)' }])}
        <div id="compChart"></div></section>
    </div>`;
  },
  after() {
    on('[data-add]', 'click', (e, el) => openAdd(el.dataset.add));
    const ms = monthsBack(Math.min(24, D.ymDiff(D.ym(ledger().start), D.ym(TODAY)) + 1));
    const bds = ms.map(m => breakdown(m === D.ym(TODAY) ? TODAY : D.monthEnd(m)));
    barChart($('#compChart'), {
      labels: ms.map(m => monthLabel(m, true)), stacked: true, height: 280,
      series: [{ name: 'Liquidez', color: 'var(--c-saving)', values: bds.map(b => b.liq) }, { name: 'Renta fija', color: 'var(--s3)', values: bds.map(b => b.rf) }, { name: 'Renta variable', color: 'var(--c-invest)', values: bds.map(b => b.rv) }, { name: 'Otros', color: 'var(--c-goal)', values: bds.map(b => b.crypto + b.fisicos) }, { name: 'Pasivos', color: 'var(--c-debt)', values: bds.map(b => -b.liab) }],
      tipTitle: i => monthLabel(ms[i]), tipExtra: i => `<div class="tsep"></div>${tipRow('var(--ink)', 'Patrimonio neto', M(bds[i].nw, { dec: 0 }))}`
    });
  }
};
function avgMonthlyExpense() { const r = monthsBack(12, D.ymAdd(D.ym(TODAY), -1)).map(monthStats); return sum(r, x => x.exp) / Math.max(1, r.filter(x => x.exp > 0).length); }

/* =====================================================================
   INICIO › FLUJO DE CAJA
   ===================================================================== */
VIEWS.flujo = {
  title: 'Flujo de caja', crumb: 'Inicio',
  html() {
    const ms = monthsBack(12); const st = ms.map(monthStats);
    const inc = sum(st, x => x.inc), exp = sum(st, x => x.exp), inv = sum(st, x => x.invest);
    const ym = UIS.dashMonth || refMonth(); const m = monthStats(ym);
    const left = m.save - m.invest;
    return `${pageHead('Flujo de caja', 'Cuánto entra, cuánto sale y a dónde va el dinero cada mes. Las transferencias entre tus cuentas no cuentan como ingreso ni como gasto.')}
    <div class="kpis">
      ${kpi('Ingresos 12 meses', M(inc, { dec: 0 }), `${M(inc / 12, { dec: 0 })} de media al mes`, 'var(--c-income)')}
      ${kpi('Gastos 12 meses', M(exp, { dec: 0 }), `${M(exp / 12, { dec: 0 })} de media al mes`, 'var(--c-expense)')}
      ${kpi('Ahorro 12 meses', M(inc - exp, { dec: 0 }), `Tasa media ${pct(inc ? (inc - exp) / inc : 0)}`, 'var(--c-saving)')}
      ${kpi('Aportado a inversiones', M(inv, { dec: 0 }), `${pct(inc - exp > 0 ? inv / (inc - exp) : 0, 0)} de lo ahorrado`, 'var(--c-invest)')}
    </div><div class="section-gap"></div>
    <div class="grid">
      <section class="card c-8"><div class="card-h"><h2>Ingresos y gastos</h2><span class="sub">Últimos 12 meses</span></div>
        ${legend([{ label: 'Ingresos', color: 'var(--c-income)' }, { label: 'Gastos', color: 'var(--c-expense)' }])}<div id="flowBars"></div></section>
      <section class="card c-4"><div class="card-h"><h2>A dónde fue el dinero</h2><div class="right">${monthSwitch(ym, 'flow')}</div></div>
        <div class="stack">
          <div class="row"><span class="ink2">Ingresos</span><span class="spacer"></span><span class="num pos">${M(m.inc)}</span></div>
          <div class="divider"></div>
          ${Object.entries(m.byCat).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([c, v]) => `<div class="row" style="font-size:13px"><span class="cat-dot" style="background:${catColor(c)}"></span><span>${esc(c)}</span><span class="spacer"></span><span class="num">${M(-v)}</span></div>`).join('')}
          ${Object.keys(m.byCat).length > 5 ? `<div class="row" style="font-size:13px"><span class="cat-dot" style="background:var(--s-other)"></span><span>Resto de categorías</span><span class="spacer"></span><span class="num">${M(-sum(Object.entries(m.byCat).sort((a, b) => b[1] - a[1]).slice(5), x => x[1]))}</span></div>` : ''}
          <div class="divider"></div>
          <div class="row"><span class="ink2">Ahorro del mes</span><span class="spacer"></span><span class="num">${M(m.save)}</span></div>
          <div class="row" style="font-size:13px"><span class="cat-dot" style="background:var(--c-invest)"></span><span>Aportado a inversiones</span><span class="spacer"></span><span class="num">${M(-m.invest)}</span></div>
          <div class="row" style="font-size:13px"><span class="cat-dot" style="background:var(--c-saving)"></span><span>Queda en tus cuentas</span><span class="spacer"></span><span class="num ${left < 0 ? 'neg' : ''}">${M(left)}</span></div>
        </div></section>
      <section class="card c-12"><div class="card-h"><h2>Ahorro neto mensual</h2><span class="sub">Ingresos menos gastos</span></div><div id="netBars"></div></section>
      <section class="card flush c-12"><div id="flowTbl"></div></section>
    </div>`;
  },
  after() {
    bindMonthSwitch(() => UIS.dashMonth || refMonth(), v => UIS.dashMonth = v);
    const ms = monthsBack(12); const st = ms.map(monthStats);
    barChart($('#flowBars'), { labels: ms.map(m => monthLabel(m, true)), series: [{ name: 'Ingresos', color: 'var(--c-income)', values: st.map(x => x.inc) }, { name: 'Gastos', color: 'var(--c-expense)', values: st.map(x => x.exp) }], tipTitle: i => monthLabel(ms[i]), tipExtra: i => `<div class="tsep"></div>${tipRow('var(--c-saving)', 'Ahorro', M(st[i].save))}${tipRow('var(--c-saving)', 'Tasa', pct(st[i].rate))}` });
    barChart($('#netBars'), { labels: ms.map(m => monthLabel(m, true)), height: 200, series: [{ name: 'Ahorro neto', color: v => v >= 0 ? 'var(--c-saving)' : 'var(--c-expense)', values: st.map(x => x.save) }], tipTitle: i => monthLabel(ms[i]) });
    const rows = ms.slice().reverse().map((m, i) => { const s = monthStats(m); return { id: m, m, inc: s.inc, exp: s.exp, save: s.save, rate: s.rate, inv: s.invest }; });
    dataTable($('#flowTbl'), {
      id: 'flujo', rows, select: false, noBar: true, pageSize: 12,
      columns: [
        { key: 'm', label: 'Mes', render: r => monthLabel(r.m) },
        { key: 'inc', label: 'Ingresos', cls: 'r', render: r => `<span class="pos">${M(r.inc)}</span>` },
        { key: 'exp', label: 'Gastos', cls: 'r', render: r => `<span class="neg">${M(-r.exp)}</span>` },
        { key: 'save', label: 'Ahorro', cls: 'r', render: r => M(r.save) },
        { key: 'rate', label: 'Tasa de ahorro', cls: 'r', render: r => pct(r.rate) },
        { key: 'inv', label: 'Invertido', cls: 'r', hideSm: true, render: r => M(r.inv) }
      ],
      footer: rows => `<tr class="tfoot-sum"><td>Total</td><td class="r num">${M(sum(rows, r => r.inc))}</td><td class="r num">${M(-sum(rows, r => r.exp))}</td><td class="r num">${M(sum(rows, r => r.save))}</td><td class="r num">${pct(sum(rows, r => r.save) / (sum(rows, r => r.inc) || 1))}</td><td class="r num hide-sm">${M(sum(rows, r => r.inv))}</td></tr>`
    });
  }
};

/* =====================================================================
   MOVIMIENTOS › GASTOS
   ===================================================================== */
function monthOptions(n = 24) { return monthsBack(n).reverse().map(m => [m, monthLabel(m)]); }
VIEWS.gastos = {
  title: 'Gastos', crumb: 'Movimientos',
  html() {
    const ym = refMonth(); const m = monthStats(ym), p = monthStats(D.ymAdd(ym, -1));
    const tagTotals = {}; ledger().txs.filter(t => t.type === 'gasto' && D.ym(t.date) === ym).forEach(t => (t.tags || []).forEach(g => tagTotals[g] = (tagTotals[g] || 0) + t.amount));
    const st = tblState.gastos; const curTag = st && st.filters.tag;
    return `${pageHead('Gastos', 'Registra, edita y analiza cada gasto. Usa etiquetas para agrupar lo que las categorías no cubren.', `<button class="btn" data-import type="button">${I('upload', 'sm')}Importar Excel</button><button class="btn primary" data-new type="button">${I('plus', 'sm')}Añadir gasto <kbd style="margin-left:4px;background:transparent;color:inherit;border-color:currentColor;opacity:.6">G</kbd></button>`)}
    <div class="kpis">
      ${kpi(`Gastos de ${MONTHS[+ym.slice(5) - 1]}`, M(m.exp), `${deltaPill(p.exp ? m.exp / p.exp - 1 : NaN, { invert: true })} vs mes anterior`, 'var(--c-expense)')}
      ${kpi('Recurrentes del mes', M(m.rec), `${pct(m.exp ? m.rec / m.exp : 0, 0)} del gasto`, 'var(--c-debt)')}
      ${kpi('Necesidades / ocio', `${pct(m.exp ? m.nec / m.exp : 0, 0)} / ${pct(m.exp ? m.ocio / m.exp : 0, 0)}`, `${M(m.nec, { dec: 0 })} · ${M(m.ocio, { dec: 0 })}`, 'var(--c-saving)')}
      ${kpi('Movimientos', String(m.count), `en ${monthLabel(ym).toLowerCase()}`)}
    </div>
    <div class="section-gap"></div>
    <div class="card" style="padding:14px 16px"><div class="row wrap"><span class="lbl" style="margin-right:4px">${I('tag', 'sm')} Filtrar por etiqueta</span><div class="chips">${S.tags.map(t => `<button class="chip${curTag === t ? ' on' : ''}" data-tagf="${esc(t)}" type="button">#${esc(t)}${tagTotals[t] ? `<span class="muted num" style="font-size:11px">${M(tagTotals[t], { dec: 0 })}</span>` : ''}</button>`).join('')}</div></div></div>
    <div class="section-gap"></div>
    <section class="card flush"><div id="gTbl"></div></section>`;
  },
  after() {
    on('[data-new]', 'click', () => txForm('gasto'));
    on('[data-import]', 'click', () => importWizard());
    if (UIS.params.cat) { tblState.gastos = null; }
    const rows = ledger().desc.filter(t => t.type === 'gasto');
    dataTable($('#gTbl'), txTableCfg('gastos', rows, 'gasto', UIS.params.cat ? { cat: UIS.params.cat } : null));
    UIS.params = {};
    on('[data-tagf]', 'click', (e, el) => { const st = tblState.gastos; st.filters.tag = st.filters.tag === el.dataset.tagf ? '' : el.dataset.tagf; st.page = 0; render(); });
  }
};
function txTableCfg(id, rows, type, initial) {
  const cols = [
    { key: 'date', label: 'Fecha', render: r => `<span class="num">${fdate(r.date)}</span>` },
    { key: 'concept', label: 'Concepto', sort: r => norm(r.concept), render: r => `<div class="concept">${esc(r.concept)}${r.recurring ? ` <span title="Recurrente" class="muted">${I('repeat', 'sm')}</span>` : ''}${r.notes ? `<span class="cell-sub">${esc(r.notes)}</span>` : ''}</div>` }
  ];
  if (type === 'gasto') cols.push({ key: 'category', label: 'Categoría', render: r => `<span class="cat-cell"><span class="cat-dot" style="background:${catColor(r.category)}"></span>${esc(r.category)}<span class="muted">${r.sub ? ' › ' + esc(r.sub) : ''}</span></span>` });
  if (type === 'ingreso') cols.push({ key: 'category', label: 'Categoría', render: r => `<span class="cat-cell"><span class="cat-dot" style="background:${catColor(r.category, 'ingreso')}"></span>${esc(r.category)}</span>` });
  if (type === 'transferencia') cols.push({ key: 'account', label: 'Desde → hacia', sort: r => accName(r.account), render: r => `${esc(accName(r.account))} <span class="muted">→</span> ${esc(accName(r.toAccount))}` });
  else cols.push({ key: 'account', label: 'Cuenta', sort: r => accName(r.account), render: r => esc(accName(r.account)), hideSm: true });
  if (type === 'gasto') {
    cols.push({ key: 'method', label: 'Método', hideSm: true });
    cols.push({ key: 'tags', label: 'Etiquetas', sortable: false, hideSm: true, render: r => (r.tags || []).map(t => `<span class="tag">#${esc(t)}</span>`).join(' ') });
  }
  cols.push({ key: 'amount', label: 'Importe', cls: 'r', render: r => signedAmount(r) });
  const filters = [{ key: 'month', label: 'Todos los meses', options: monthOptions(), test: (r, v) => D.ym(r.date) === v }];
  if (type === 'gasto') {
    filters.unshift({ key: 'cat', label: 'Todas las categorías', options: S.categories.map(c => [c.name, c.name]), test: (r, v) => r.category === v });
    filters.push({ key: 'tag', label: 'Todas las etiquetas', options: S.tags.map(t => [t, '#' + t]), test: (r, v) => (r.tags || []).includes(v) });
    filters.push({ key: 'method', label: 'Cualquier método', options: METHODS.map(m => [m, m]), test: (r, v) => r.method === v });
  }
  if (type === 'ingreso') filters.unshift({ key: 'cat', label: 'Todas las categorías', options: S.incomeCategories.map(c => [c.name, c.name]), test: (r, v) => r.category === v });
  filters.push({ key: 'acc', label: 'Todas las cuentas', options: S.accounts.map(a => [a.id, a.name]), test: (r, v) => r.account === v || r.toAccount === v });
  if (type !== 'transferencia') filters.push({ key: 'rec', label: 'Recurrente o no', options: [['si', 'Solo recurrentes'], ['no', 'Solo puntuales']], test: (r, v) => v === 'si' ? !!r.recurring : !r.recurring });
  return {
    id, rows, columns: cols, filters, initialFilters: initial || {}, forceFilters: initial || null,
    defaultSort: { key: 'date', dir: -1 }, placeholder: 'Buscar por concepto, nota, etiqueta o importe…',
    search: r => `${r.concept} ${r.category || ''} ${r.sub || ''} ${r.notes || ''} ${(r.tags || []).join(' ')} ${accName(r.account)} ${String(r.amount).replace('.', ',')}`,
    label: r => r.concept,
    onEdit: r => editTx(r),
    onRow: r => editTx(r),
    onDelete: ids => withUndo(ids.length > 1 ? `${ids.length} movimientos eliminados` : 'Movimiento eliminado', () => { S.tx = S.tx.filter(t => !ids.includes(t.id)); }),
    bulkSum: sel => `Suma ${M(sum(sel, t => t.amount))}`,
    footer: rows => `<tr class="tfoot-sum"><td></td><td colspan="${cols.length - 1}">Total filtrado · ${rows.length} movimientos</td><td class="r num">${M(sum(rows, r => r.amount))}</td><td></td></tr>`
  };
}

/* =====================================================================
   MOVIMIENTOS › INGRESOS
   ===================================================================== */
VIEWS.ingresos = {
  title: 'Ingresos', crumb: 'Movimientos',
  html() {
    const ym = refMonth(); const m = monthStats(ym);
    const y = TODAY.slice(0, 4); const ytd = rangeStats(`${y}-01-01`, TODAY);
    const st12 = monthsBack(12, D.ymAdd(ym, 0)).map(monthStats);
    const recInc = sum(S.recurring.filter(r => r.active && r.kind === 'ingreso'), monthlyEq);
    return `${pageHead('Ingresos', 'Nómina, pagas extra, rendimientos y trabajos adicionales en un mismo sitio.', `<button class="btn" data-import type="button">${I('upload', 'sm')}Importar Excel</button><button class="btn primary" data-new type="button">${I('plus', 'sm')}Añadir ingreso <kbd style="margin-left:4px;background:transparent;color:inherit;border-color:currentColor;opacity:.6">I</kbd></button>`)}
    <div class="kpis">
      ${kpi(`Ingresos de ${MONTHS[+ym.slice(5) - 1]}`, M(m.inc), `${Object.keys(m.byInc).length} fuentes`, 'var(--c-income)')}
      ${kpi(`Ingresos ${y}`, M(ytd.inc, { dec: 0 }), 'en lo que va de año', 'var(--c-income)')}
      ${kpi('Media mensual', M(sum(st12, x => x.inc) / 12, { dec: 0 }), 'últimos 12 meses')}
      ${kpi('Ingresos recurrentes', M(recInc, { dec: 0 }), 'previstos cada mes')}
    </div><div class="section-gap"></div>
    <div class="grid">
      <section class="card c-8"><div class="card-h"><h2>Evolución de ingresos</h2><span class="sub">Por fuente, últimos 12 meses</span></div>${legend(S.incomeCategories.map(c => ({ label: c.name, color: catColor(c.name, 'ingreso') })))}<div id="incBars"></div></section>
      <section class="card c-4"><div class="card-h"><h2>Por fuente</h2><span class="sub">Últimos 12 meses</span></div><div id="incDonut" style="max-width:180px;margin:0 auto 12px"></div><div id="incLeg"></div></section>
      <section class="card flush c-12"><div id="iTbl"></div></section>
    </div>`;
  },
  after() {
    on('[data-new]', 'click', () => txForm('ingreso'));
    on('[data-import]', 'click', () => importWizard({ sign: 'ingresos' }));
    const ms = monthsBack(12); const st = ms.map(monthStats);
    barChart($('#incBars'), { labels: ms.map(m => monthLabel(m, true)), stacked: true, series: S.incomeCategories.map(c => ({ name: c.name, color: catColor(c.name, 'ingreso'), values: st.map(x => x.byInc[c.name] || 0) })).filter(s => s.values.some(Boolean)), tipTitle: i => monthLabel(ms[i]), tipExtra: i => `<div class="tsep"></div>${tipRow('var(--ink)', 'Total', M(st[i].inc))}` });
    const tot = {}; st.forEach(x => Object.entries(x.byInc).forEach(([k, v]) => tot[k] = (tot[k] || 0) + v));
    const items = S.incomeCategories.map(c => ({ key: c.name, label: c.name, value: tot[c.name] || 0, color: catColor(c.name, 'ingreso') })).filter(i => i.value > 0);
    donut($('#incDonut'), { items, centerLabel: '12 meses' });
    $('#incLeg').innerHTML = hbars(items.sort((a, b) => b.value - a.value));
    dataTable($('#iTbl'), txTableCfg('ingresos', ledger().desc.filter(t => t.type === 'ingreso'), 'ingreso'));
  }
};

/* =====================================================================
   MOVIMIENTOS › TRANSFERENCIAS
   ===================================================================== */
VIEWS.transferencias = {
  title: 'Transferencias', crumb: 'Movimientos',
  html() {
    const ym = refMonth();
    const tr = ledger().desc.filter(t => t.type === 'transferencia');
    const mTr = tr.filter(t => D.ym(t.date) === ym);
    const inv = ledger().desc.filter(t => t.type === 'inversion' && D.ym(t.date) === ym);
    return `${pageHead('Transferencias', 'Movimientos entre tus propias cuentas. Cambian dónde está el dinero, no cuánto tienes.', `<button class="btn primary" data-new type="button">${I('transfer', 'sm')}Nueva transferencia <kbd style="margin-left:4px;background:transparent;color:inherit;border-color:currentColor;opacity:.6">T</kbd></button>`)}
    <div class="note" style="margin-bottom:16px">${I('info', 'sm')}<span>Regla contable: una transferencia entre cuentas propias no es un ingreso ni un gasto, así que no altera tu tasa de ahorro ni tu patrimonio. Las aportaciones a inversiones tampoco son gasto: se registran en <a href="#cartera">Inversiones</a>.</span></div>
    <div class="kpis">
      ${kpi(`Transferido en ${MONTHS[+ym.slice(5) - 1]}`, M(sum(mTr, t => t.amount)), `${mTr.length} transferencias`, 'var(--c-saving)')}
      ${kpi('Aportado a inversiones', M(sum(inv, t => t.amount)), `${inv.length} aportaciones este mes`, 'var(--c-invest)')}
      ${kpi('Efecto en el patrimonio', M(0), 'Las transferencias son neutras')}
    </div><div class="section-gap"></div>
    <section class="card flush"><div id="tTbl"></div></section>`;
  },
  after() {
    on('[data-new]', 'click', () => txForm('transferencia'));
    dataTable($('#tTbl'), txTableCfg('transferencias', ledger().desc.filter(t => t.type === 'transferencia'), 'transferencia'));
  }
};

/* =====================================================================
   PATRIMONIO › CUENTAS y EFECTIVO
   ===================================================================== */
function accountsView(filter, selKey, title, desc) {
  const accs = S.accounts.filter(filter);
  if (!accs.length) return `${pageHead(title, desc, `<button class="btn primary" data-newacc type="button">${I('plus', 'sm')}Nueva cuenta</button>`)}<div class="card">${emptyState('bank', 'Todavía no hay cuentas aquí', 'Crea una cuenta con su saldo inicial para empezar a registrar movimientos.', `<button class="btn primary" data-newacc type="button">${I('plus', 'sm')}Crear cuenta</button>`)}</div>`;
  const sel = accs.find(a => a.id === UIS[selKey]) || accs[0];
  UIS[selKey] = sel.id;
  const total = sum(accs, a => balAt(a.id));
  const ym = D.ym(TODAY);
  const accTx = ledger().desc.filter(t => t.account === sel.id || t.toAccount === sel.id);
  const mIn = sum(accTx.filter(t => D.ym(t.date) === ym), t => { const e = txEffects(t).find(x => x[0] === sel.id); return e && e[1] > 0 ? e[1] : 0; });
  const mOut = sum(accTx.filter(t => D.ym(t.date) === ym), t => { const e = txEffects(t).find(x => x[0] === sel.id); return e && e[1] < 0 ? -e[1] : 0; });
  return `${pageHead(title, desc, `<button class="btn" data-transfer type="button">${I('transfer', 'sm')}Transferir</button><button class="btn primary" data-newacc type="button">${I('plus', 'sm')}Nueva cuenta</button>`)}
    <div class="kpis" style="margin-bottom:16px">${kpi('Saldo total', M(total), `${accs.length} cuenta${accs.length > 1 ? 's' : ''}`, 'var(--c-saving)')}${kpi('Variación 30 días', M(total - sum(accs, a => balAt(a.id, D.add(TODAY, -30))), { sign: true }), 'incluye transferencias')}</div>
    <div class="acc-grid">${accs.map(a => {
      const vals = monthsBack(6).map(m => balAt(a.id, m === ym ? TODAY : D.monthEnd(m)));
      return `<button class="card acc-card${a.id === sel.id ? ' on' : ''}" data-acc="${a.id}" type="button" aria-pressed="${a.id === sel.id}"><div class="row"><span class="cat-ic" style="background:var(--surface-3);color:var(--c-saving)">${I((ACCOUNT_TYPES[a.type] || {}).icon || 'bank', 'sm')}</span><div style="min-width:0"><div class="li-t">${esc(a.name)}</div><div class="li-s">${esc((ACCOUNT_TYPES[a.type] || {}).label)}${a.institution ? ' · ' + esc(a.institution) : ''}</div></div></div><div class="row"><span class="acc-bal">${M(balAt(a.id))}</span><span class="spacer"></span>${sparkline(vals, 'var(--c-saving)')}</div></button>`;
    }).join('')}</div>
    <div class="section-gap"></div>
    <div class="grid">
      <section class="card c-8"><div class="card-h"><div><h2>${esc(sel.name)}</h2><div class="sub">Evolución del saldo, últimos 12 meses</div></div><div class="right"><button class="btn sm" data-editacc="${sel.id}" type="button">${I('edit', 'sm')}Editar</button></div></div><div id="accChart"></div></section>
      <section class="card c-4"><div class="card-h"><h2>Detalle</h2></div>
        <dl class="kv"><dt>Saldo actual</dt><dd>${M(balAt(sel.id))}</dd><dt>Saldo inicial</dt><dd>${M(sel.initial)}</dd><dt>Desde</dt><dd>${fdate(sel.openDate || ledger().start)}</dd><dt>Entradas este mes</dt><dd class="pos">${M(mIn, { sign: true })}</dd><dt>Salidas este mes</dt><dd class="neg">${M(-mOut)}</dd>${sel.rate ? `<dt>Interés anual</dt><dd>${numFmt(sel.rate)} %</dd>` : ''}<dt>Movimientos</dt><dd>${accTx.length}</dd></dl></section>
      <section class="card c-12"><div class="card-h"><h2>Últimos movimientos</h2></div>${txList(accTx.filter(t => t.date <= TODAY).slice(0, 10))}</section>
    </div>`;
}
function accountsAfter(selKey) {
  on('[data-newacc]', 'click', () => accountForm());
  on('[data-transfer]', 'click', () => txForm('transferencia', null, { account: UIS[selKey] }));
  on('[data-acc]', 'click', (e, el) => { UIS[selKey] = el.dataset.acc; render(); });
  on('[data-editacc]', 'click', (e, el) => accountForm(S.accounts.find(a => a.id === el.dataset.editacc)));
  bindTxList();
  const id = UIS[selKey]; if (!id) return;
  const pts = []; const start = D.max(D.addMonthsISO(TODAY, -12), ledger().start);
  for (let d = start; d <= TODAY; d = D.add(d, 3)) pts.push([d, balAt(id, d)]);
  if (pts[pts.length - 1][0] !== TODAY) pts.push([TODAY, balAt(id)]);
  lineChart($('#accChart'), { series: [{ name: 'Saldo', color: 'var(--c-saving)', data: pts, area: true }], height: 230, xfmt: d => monthLabel(D.ym(d), true) });
}
VIEWS.cuentas = {
  title: 'Cuentas', crumb: 'Patrimonio',
  html: () => accountsView(a => a.type !== 'efectivo', 'accSel', 'Cuentas', 'Saldo, evolución y movimientos de cada cuenta bancaria, de ahorro o de bróker.'),
  after: () => accountsAfter('accSel')
};
VIEWS.efectivo = {
  title: 'Efectivo', crumb: 'Patrimonio',
  html: () => accountsView(a => a.type === 'efectivo', 'cashSel', 'Efectivo', 'El dinero en mano también cuenta. Registra las retiradas de cajero como transferencia desde tu banco y los pagos en efectivo como gastos de esta cuenta.'),
  after: () => accountsAfter('cashSel')
};

/* =====================================================================
   PATRIMONIO › ACTIVOS
   ===================================================================== */
VIEWS.activos = {
  title: 'Activos', crumb: 'Patrimonio',
  html() {
    const b = breakdown(); const g = balanceGroups();
    const sub = { liq: 'Efectivo, cuentas corrientes, remuneradas y depósitos', rf: 'Bonos gubernamentales, letras, bonos corporativos y fondos de renta fija', rv: 'Fondos indexados, ETF y acciones', otros: 'Criptomonedas, inmuebles, vehículos y otros bienes' };
    const color = { liq: 'var(--c-saving)', rf: 'var(--s3)', rv: 'var(--c-invest)', otros: 'var(--c-goal)' };
    return `${pageHead('Activos', 'Todo lo que tienes, clasificado por tipo. Los inmuebles, vehículos y otros bienes se gestionan aquí.', `<button class="btn primary" data-add="activo" type="button">${I('plus', 'sm')}Añadir activo</button>`)}
    <div class="kpis">${['liq', 'rf', 'rv', 'otros'].map(k => kpi(CLS_LABEL[k], M(sum(g[k], x => x.v), { dec: 0 }), `${pct(sum(g[k], x => x.v) / (b.assets || 1), 0)} de tus activos`, color[k])).join('')}</div>
    <div class="section-gap"></div>
    <div class="grid">${['liq', 'rf', 'rv', 'otros'].map(k => `<section class="card c-6"><div class="card-h"><div><h2>${CLS_LABEL[k]}</h2><div class="sub">${sub[k]}</div></div><div class="right"><span class="num">${M(sum(g[k], x => x.v))}</span></div></div>
      ${g[k].length ? `<div class="list">${g[k].sort((x, y) => y.v - x.v).map(x => `<a class="li" href="#${x.route}" style="text-decoration:none;color:inherit"><span class="li-ic">${I(x.icon, 'sm')}</span><span class="li-main"><span class="li-t">${esc(x.name)}</span><span class="li-s">${esc(x.sub || '')}</span></span><span class="li-v">${M(x.v)}</span></a>`).join('')}</div>` : emptyState(k === 'otros' ? 'box' : 'layers', 'Nada en esta clase', '')}</section>`).join('')}
      <section class="card flush c-12"><div class="tbl-bar" style="border:0;padding-bottom:0"><h2 style="margin:0;font-size:15px">Inmuebles, vehículos y otros bienes</h2></div><div id="aTbl"></div></section>
    </div>`;
  },
  after() {
    on('[data-add]', 'click', (e, el) => openAdd(el.dataset.add));
    dataTable($('#aTbl'), {
      id: 'activos', rows: S.assets, placeholder: 'Buscar activo…', search: r => r.name + ' ' + (r.notes || ''), label: r => r.name,
      columns: [
        { key: 'name', label: 'Activo', render: r => `<div class="concept">${esc(r.name)}<span class="cell-sub">${esc(r.notes || '')}</span></div>` },
        { key: 'kind', label: 'Tipo', render: r => ASSET_KINDS[r.kind].label },
        { key: 'acquired', label: 'Adquirido', render: r => fdate(r.acquired), hideSm: true },
        { key: 'annualChange', label: 'Variación anual', cls: 'r', render: r => `${numFmt(r.annualChange || 0, 1)} %`, hideSm: true },
        { key: 'value', label: 'Valor actual', cls: 'r', sort: r => assetValueAt(r), render: r => M(assetValueAt(r)) }
      ],
      onEdit: r => assetForm(r), onDelete: ids => withUndo('Activo eliminado', () => { S.assets = S.assets.filter(a => !ids.includes(a.id)); }),
      empty: emptyState('box', 'Sin bienes registrados', 'Añade tu vivienda, coche u otros bienes para tener una foto completa de tu patrimonio.')
    });
  }
};

/* =====================================================================
   PATRIMONIO › PASIVOS
   ===================================================================== */
VIEWS.pasivos = {
  title: 'Pasivos', crumb: 'Patrimonio',
  html() {
    const b = breakdown();
    const monthlyPay = sum(S.liabilities.filter(l => !l.revolving && liabBalanceAt(l) > 0), l => l.payment || 0);
    const inc = sum(monthsBack(3, D.ymAdd(refMonth(), 0)).map(monthStats), x => x.inc) / 3;
    return `${pageHead('Pasivos', 'Lo que debes resta de tu patrimonio neto. Los préstamos se amortizan solos según su cuadro de cuotas.', `<button class="btn primary" data-add="pasivo" type="button">${I('plus', 'sm')}Añadir pasivo</button>`)}
    <div class="kpis">
      ${kpi('Deuda total', M(b.liab), `${S.liabilities.length} pasivos`, 'var(--c-debt)')}
      ${kpi('Cuotas mensuales', M(monthlyPay), `${pct(inc ? monthlyPay / inc : 0)} de tus ingresos`, 'var(--c-debt)')}
      ${kpi('Endeudamiento', pct(b.assets ? b.liab / b.assets : 0), 'pasivos sobre activos')}
    </div><div class="section-gap"></div>
    ${S.liabilities.length ? `<div class="goals">${S.liabilities.map(l => {
      const bal = liabBalanceAt(l); const sch = liabSchedule(l);
      const paid = l.revolving ? null : 1 - bal / l.principal;
      const endD = sch && sch.length ? sch[sch.length - 1].date : null;
      const left = sch ? sch.filter(x => x.date > TODAY).length : 0;
      const intLeft = sch ? sum(sch.filter(x => x.date > TODAY), x => x.interest) : 0;
      return `<div class="goal"><div class="goal-h"><span class="goal-ic" style="background:var(--c-debt-soft);color:var(--c-debt)">${I(LIAB_KINDS[l.kind].icon)}</span><div style="min-width:0;flex:1"><div class="li-t">${esc(l.name)}</div><div class="li-s">${esc(LIAB_KINDS[l.kind].label)}${l.lender ? ' · ' + esc(l.lender) : ''}</div></div><button class="mini-btn" data-editl="${l.id}" type="button" aria-label="Editar">${I('edit', 'sm')}</button></div>
        <div><div class="muted" style="font-size:12px">Saldo pendiente</div><div class="goal-pct neg">${M(bal)}</div></div>
        ${paid != null ? `<div class="prog"><div class="prog-track"><div class="prog-fill" style="width:${clamp(paid, 0, 1) * 100}%;background:var(--c-debt)"></div></div><div class="prog-meta"><span>${pct(paid, 0)} amortizado</span><span>${left} cuotas pendientes</span></div></div>
        <div class="goal-grid"><div><span>Cuota</span><b>${M(l.payment)}</b></div><div><span>Interés</span><b>${numFmt(l.rate)} % TIN</b></div><div><span>Fin previsto</span><b>${endD ? fdate(endD) : '—'}</b></div><div><span>Intereses pendientes</span><b>${M(intLeft)}</b></div></div>` : '<p class="muted" style="font-size:12.5px;margin:0">Saldo sin cuadro de amortización. Actualízalo cuando cambie.</p>'}
      </div>`;
    }).join('')}</div>` : `<div class="card">${emptyState('scale', 'Sin pasivos', 'Sin deudas registradas: tu patrimonio neto coincide con tus activos.')}</div>`}
    ${S.liabilities.some(l => !l.revolving) ? `<div class="section-gap"></div><section class="card"><div class="card-h"><h2>Evolución prevista de la deuda</h2><span class="sub">Saldo pendiente según las cuotas</span></div><div id="debtChart"></div></section>` : ''}`;
  },
  after() {
    on('[data-add]', 'click', (e, el) => openAdd(el.dataset.add));
    on('[data-editl]', 'click', (e, el) => liabilityForm(S.liabilities.find(l => l.id === el.dataset.editl)));
    if (!$('#debtChart')) return;
    const series = S.liabilities.filter(l => !l.revolving).map((l, i) => {
      const sch = liabSchedule(l); const pts = [[l.start, l.principal]].concat(sch.map(x => [x.date, round2(x.bal)]));
      return { name: l.name, color: `var(--s${(i % 8) + 1})`, data: pts };
    });
    lineChart($('#debtChart'), { series, height: 220, zero: true, xfmt: d => monthLabel(D.ym(d), true), tipTitle: d => monthLabel(D.ym(d)) });
  }
};
