/* Patrimonia — vistas: Análisis, Informes y Configuración */
'use strict';

/* el periodo del informe vive dentro de UIS.rep; este alias permite reutilizar el selector */
Object.defineProperty(UIS, 'repP', { configurable: true, get: () => (UIS.rep ? UIS.rep.p : { mode: 'mes', ym: refMonth() }), set: v => { if (UIS.rep) UIS.rep.p = v; } });

/* ---------- selector de periodo ---------- */
function periodOf(p) {
  if (p.mode === 'custom') {
    const len = D.diff(p.from, p.to) + 1;
    return { from: p.from, to: p.to, label: `${fdate(p.from)} – ${fdate(p.to)}`, prev: { mode: 'custom', from: D.add(p.from, -len), to: D.add(p.from, -1) } };
  }
  const ym = p.ym;
  if (p.mode === 'trimestre') {
    const m = +ym.slice(5); const qs = Math.floor((m - 1) / 3) * 3 + 1; const s = `${ym.slice(0, 4)}-${pad(qs)}`;
    return { from: `${s}-01`, to: D.monthEnd(D.ymAdd(s, 2)), label: `${(qs - 1) / 3 + 1}.º trimestre ${ym.slice(0, 4)}`, prev: { mode: 'trimestre', ym: D.ymAdd(s, -3) } };
  }
  if (p.mode === 'año') return { from: `${ym.slice(0, 4)}-01-01`, to: `${ym.slice(0, 4)}-12-31`, label: `Año ${ym.slice(0, 4)}`, prev: { mode: 'año', ym: D.ymAdd(ym, -12) } };
  return { from: `${ym}-01`, to: D.monthEnd(ym), label: monthLabel(ym), prev: { mode: 'mes', ym: D.ymAdd(ym, -1) } };
}
function periodPicker(key) {
  const p = UIS[key];
  const navStep = { mes: 1, trimestre: 3, año: 12 }[p.mode];
  return `<div class="row wrap" style="gap:8px">${seg(key + 'Mode', [['mes', 'Mes'], ['trimestre', 'Trimestre'], ['año', 'Año'], ['custom', 'Personalizado']], p.mode)}
    ${p.mode === 'custom' ? `<input class="input sm" type="date" data-pf="${key}" value="${p.from}" aria-label="Desde" style="width:auto"/><span class="muted">a</span><input class="input sm" type="date" data-pt="${key}" value="${p.to}" aria-label="Hasta" style="width:auto"/>`
      : `<div class="row" style="gap:2px"><button class="btn xs ghost" data-pnav="${key}" data-d="-${navStep}" type="button" aria-label="Periodo anterior">${I('left', 'sm')}</button><span style="font-weight:560;min-width:140px;text-align:center">${esc(periodOf(p).label)}</span><button class="btn xs ghost" data-pnav="${key}" data-d="${navStep}" type="button" aria-label="Periodo siguiente" ${D.ymAdd(p.ym, navStep) > D.ym(TODAY) && periodOf({ mode: p.mode, ym: D.ymAdd(p.ym, navStep) }).from > TODAY ? 'disabled' : ''}>${I('right', 'sm')}</button></div>`}</div>`;
}
function bindPeriod(key) {
  bindSeg(key + 'Mode', v => { const p = UIS[key]; if (v === 'custom') { const r = periodOf(p); UIS[key] = { mode: 'custom', from: r.from, to: D.min(r.to, TODAY), ym: p.ym }; } else UIS[key] = { mode: v, ym: p.ym || refMonth() }; render(); });
  on(`[data-pnav="${key}"]`, 'click', (e, el) => { UIS[key].ym = D.ymAdd(UIS[key].ym, +el.dataset.d); render(); });
  on(`[data-pf="${key}"],[data-pt="${key}"]`, 'change', () => {
    const f = $(`[data-pf="${key}"]`).value, t = $(`[data-pt="${key}"]`).value;
    if (f && t && f <= t) { UIS[key] = { mode: 'custom', from: f, to: t, ym: UIS[key].ym }; render(); } else toast('La fecha inicial debe ser anterior a la final');
  });
}

/* =====================================================================
   ANÁLISIS › GASTOS
   ===================================================================== */
VIEWS['an-gastos'] = {
  title: 'Análisis de gastos', crumb: 'Análisis',
  html() {
    UIS.an = UIS.an || { mode: 'mes', ym: refMonth() };
    const P = periodOf(UIS.an); const r = rangeStats(P.from, P.to); const pr = rangeStats(P.prev.from || periodOf(P.prev).from, periodOf(P.prev).to);
    const yr = rangeStats(`${P.to.slice(0, 4)}-01-01`, D.min(P.to, TODAY));
    const days = Math.max(1, D.diff(P.from, D.min(P.to, TODAY)) + 1);
    const m12 = monthsBack(12, D.ymAdd(D.ym(TODAY), -1)).map(monthStats); const avgM = sum(m12, x => x.exp) / 12;
    const cats = Object.entries(r.byCat).sort((a, b) => b[1] - a[1]);
    const topCat = cats[0];
    const recM = sum(S.recurring.filter(x => x.active && x.kind === 'gasto'), monthlyEq);
    return `${pageHead('Análisis de gastos', 'En qué se va el dinero, cómo evoluciona y qué parte está comprometida de antemano.', periodPicker('an'))}
    <div class="kpis">
      ${kpi('Gastos del periodo', M(r.exp), `${deltaPill(pr.exp ? r.exp / pr.exp - 1 : NaN, { invert: true })} vs periodo anterior`, 'var(--c-expense)')}
      ${kpi(`Gastos del año ${P.to.slice(0, 4)}`, M(yr.exp, { dec: 0 }), 'acumulado')}
      ${kpi('Gasto medio mensual', M(avgM, { dec: 0 }), 'últimos 12 meses cerrados')}
      ${kpi('Gasto diario medio', M(r.exp / days), `${days} días del periodo`)}
      ${kpi('Mayor gasto', r.max ? M(r.max.amount) : '—', r.max ? esc(r.max.concept) + ' · ' + fdate(r.max.date, true) : '')}
      ${kpi('Categoría principal', topCat ? esc(topCat[0]) : '—', topCat ? `${M(topCat[1], { dec: 0 })} · ${pct(topCat[1] / (r.exp || 1), 0)}` : '', topCat ? catColor(topCat[0]) : null)}
      ${kpi('Gastos recurrentes', M(r.rec, { dec: 0 }), `${M(recM, { dec: 0 })}/mes comprometidos`, 'var(--c-debt)')}
    </div>
    <div class="section-gap"></div>
    <div class="grid">
      <section class="card c-7"><div class="card-h"><h2>Gastos por categoría</h2><span class="sub">${esc(P.label)} · pulsa para ver los movimientos</span></div>${hbars(cats.map(([c, v]) => ({ label: c, value: v, color: catColor(c) })), { onClickAttr: it => `data-gocat="${esc(it.label)}" role="button" tabindex="0" style="cursor:pointer"` })}</section>
      <section class="card c-5"><div class="card-h"><h2>Reparto</h2></div><div id="catDonut" style="max-width:210px;margin:0 auto"></div>
        <div class="split3" style="grid-template-columns:repeat(2,minmax(0,1fr))"><div><span class="l"><span class="k-dot" style="width:8px;height:8px;border-radius:3px;background:var(--c-saving)"></span>Necesidades</span><div class="v">${pct(r.exp ? r.nec / r.exp : 0, 0)}</div><span class="muted num" style="font-size:12px">${M(r.nec, { dec: 0 })}</span></div><div><span class="l"><span class="k-dot" style="width:8px;height:8px;border-radius:3px;background:var(--c-goal)"></span>Ocio</span><div class="v">${pct(r.exp ? r.ocio / r.exp : 0, 0)}</div><span class="muted num" style="font-size:12px">${M(r.ocio, { dec: 0 })}</span></div></div>
        <div class="compbar"><span style="flex-grow:${r.nec};background:var(--c-saving)"></span><span style="flex-grow:${r.ocio};background:var(--c-goal)"></span></div></section>
      <section class="card c-8"><div class="card-h"><h2>Evolución mensual</h2><span class="sub">12 meses · la línea discontinua es tu media</span></div>${legend([{ label: 'Gastos', color: 'var(--c-expense)', line: true }, { label: 'Media', color: 'var(--ink-2)', dash: true }])}<div id="evoLine"></div></section>
      <section class="card c-4"><div class="card-h"><h2>Gastos recurrentes</h2><span class="sub">Comprometidos cada mes</span></div>
        <div class="row" style="align-items:center;gap:14px">${ring(recM / (avgM || 1), 'var(--c-debt)', 64, 7)}<div><div class="num" style="font-size:24px;letter-spacing:-.03em">${M(recM)}</div><div class="muted" style="font-size:12px">${pct(recM / (avgM || 1), 0)} de tu gasto medio mensual</div></div></div>
        <div class="divider" style="margin:14px 0"></div>
        ${hbars(S.recurring.filter(x => x.active && x.kind === 'gasto').sort((a, b) => monthlyEq(b) - monthlyEq(a)).slice(0, 6).map(x => ({ label: x.name, value: monthlyEq(x), color: 'var(--c-debt)' })))}</section>
      <section class="card c-6"><div class="card-h"><h2>Necesidades frente a ocio</h2><span class="sub">12 meses</span></div>${legend([{ label: 'Necesidades', color: 'var(--c-saving)' }, { label: 'Ocio', color: 'var(--c-goal)' }])}<div id="needBars"></div></section>
      <section class="card c-6"><div class="card-h"><h2>Recurrentes frente a variables</h2><span class="sub">12 meses</span></div>${legend([{ label: 'Recurrentes', color: 'var(--c-debt)' }, { label: 'Variables', color: 'var(--s1)' }])}<div id="recBars"></div></section>
      <section class="card c-6"><div class="card-h"><h2>Subcategorías principales</h2><span class="sub">${esc(P.label)}</span></div>${hbars(Object.entries(r.bySub).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => ({ label: k.split(' › ')[1], value: v, color: catColor(k.split(' › ')[0]) })), { total: r.exp })}</section>
      <section class="card c-6"><div class="card-h"><h2>Por etiqueta</h2><span class="sub">Un gasto puede tener varias</span></div>${hbars(Object.entries(r.byTag).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v], i) => ({ label: '#' + k, value: v, color: 'var(--accent)' })), { total: r.exp })}</section>
    </div>`;
  },
  after() {
    bindPeriod('an');
    const P = periodOf(UIS.an); const r = rangeStats(P.from, P.to);
    donut($('#catDonut'), { items: Object.entries(r.byCat).sort((a, b) => b[1] - a[1]).map(([c, v]) => ({ key: c, label: c, value: v, color: catColor(c) })), centerLabel: 'Gastos' });
    on('[data-gocat]', 'click', (e, el) => navigate('gastos', { cat: el.dataset.gocat }));
    const endYM = D.min(D.ym(P.to), D.ym(TODAY)); const ms = monthsBack(12, endYM); const st = ms.map(monthStats);
    const avg = sum(st, x => x.exp) / 12;
    const pts = ms.map((m, i) => [D.mk(m, 15), st[i].exp]);
    lineChart($('#evoLine'), { series: [{ name: 'Gastos', color: 'var(--c-expense)', data: pts, area: true }, { name: 'Media', color: 'var(--ink-2)', data: pts.map(p => [p[0], avg]), dash: true, noEnd: true }], height: 230, xfmt: d => monthLabel(D.ym(d), true), tipTitle: d => monthLabel(D.ym(d)) });
    barChart($('#needBars'), { labels: ms.map(m => monthLabel(m, true)), stacked: true, height: 210, series: [{ name: 'Necesidades', color: 'var(--c-saving)', values: st.map(x => x.nec) }, { name: 'Ocio', color: 'var(--c-goal)', values: st.map(x => x.ocio) }], tipTitle: i => monthLabel(ms[i]), tipExtra: i => tipRow('var(--ink-2)', '% ocio', pct(st[i].exp ? st[i].ocio / st[i].exp : 0, 0)) });
    barChart($('#recBars'), { labels: ms.map(m => monthLabel(m, true)), stacked: true, height: 210, series: [{ name: 'Recurrentes', color: 'var(--c-debt)', values: st.map(x => x.rec) }, { name: 'Variables', color: 'var(--s1)', values: st.map(x => x.exp - x.rec) }], tipTitle: i => monthLabel(ms[i]) });
  }
};

/* =====================================================================
   ANÁLISIS › INGRESOS
   ===================================================================== */
VIEWS['an-ingresos'] = {
  title: 'Análisis de ingresos', crumb: 'Análisis',
  html() {
    UIS.anInc = UIS.anInc || { mode: 'año', ym: refMonth() };
    const P = periodOf(UIS.anInc); const r = rangeStats(P.from, P.to); const pr = rangeStats(periodOf(P.prev).from, periodOf(P.prev).to);
    const passive = sum(INVEST_INCOME, c => r.byInc[c] || 0);
    const sal = (r.byInc['Salario'] || 0) + (r.byInc['Pagas extra'] || 0);
    const m24 = monthsBack(24).map(monthStats);
    const vol = (() => { const xs = m24.slice(-12).map(x => x.inc); const mu = sum(xs) / xs.length; return mu ? Math.sqrt(sum(xs, x => (x - mu) ** 2) / xs.length) / mu : 0; })();
    return `${pageHead('Análisis de ingresos', 'De dónde viene tu dinero, cuánto depende de la nómina y cuánto generan tus inversiones.', periodPicker('anInc'))}
    <div class="kpis">
      ${kpi('Ingresos del periodo', M(r.inc), `${deltaPill(pr.inc ? r.inc / pr.inc - 1 : NaN)} vs periodo anterior`, 'var(--c-income)')}
      ${kpi('Dependencia del salario', pct(r.inc ? sal / r.inc : 0, 0), 'nómina y pagas extra')}
      ${kpi('Ingresos pasivos', M(passive), `dividendos e intereses · ${pct(r.inc ? passive / r.inc : 0, 1)}`, 'var(--c-invest)')}
      ${kpi('Trabajos adicionales', M(r.byInc['Trabajos adicionales'] || 0), 'en el periodo')}
      ${kpi('Estabilidad', vol < 0.15 ? 'Alta' : vol < 0.35 ? 'Media' : 'Baja', `variación mensual ${pct(vol, 0)}`)}
    </div><div class="section-gap"></div>
    <div class="grid">
      <section class="card c-8"><div class="card-h"><h2>Evolución de ingresos</h2><span class="sub">24 meses</span></div>${legend([{ label: 'Ingresos', color: 'var(--c-income)', line: true }, { label: 'Ingresos pasivos', color: 'var(--c-invest)', line: true }])}<div id="incEvo"></div></section>
      <section class="card c-4"><div class="card-h"><h2>Por fuente</h2><span class="sub">${esc(P.label)}</span></div><div id="incSrc" style="max-width:190px;margin:0 auto 12px"></div>${hbars(Object.entries(r.byInc).sort((a, b) => b[1] - a[1]).map(([c, v]) => ({ label: c, value: v, color: catColor(c, 'ingreso') })))}</section>
      <section class="card flush c-12"><div class="tbl-bar" style="border:0;padding-bottom:0"><h2 style="margin:0;font-size:15px">Ingresos del periodo</h2></div><div id="aiTbl"></div></section>
    </div>`;
  },
  after() {
    bindPeriod('anInc');
    const P = periodOf(UIS.anInc); const r = rangeStats(P.from, P.to);
    const ms = monthsBack(24); const st = ms.map(monthStats);
    lineChart($('#incEvo'), { series: [{ name: 'Ingresos', color: 'var(--c-income)', data: ms.map((m, i) => [D.mk(m, 15), st[i].inc]), area: true }, { name: 'Ingresos pasivos', color: 'var(--c-invest)', data: ms.map((m, i) => [D.mk(m, 15), sum(INVEST_INCOME, c => st[i].byInc[c] || 0)]) }], height: 250, zero: true, xfmt: d => monthLabel(D.ym(d), true), tipTitle: d => monthLabel(D.ym(d)) });
    donut($('#incSrc'), { items: Object.entries(r.byInc).map(([c, v]) => ({ key: c, label: c, value: v, color: catColor(c, 'ingreso') })), centerLabel: 'Ingresos' });
    dataTable($('#aiTbl'), Object.assign(txTableCfg('an-ingresos', ledger().desc.filter(t => t.type === 'ingreso' && t.date >= P.from && t.date <= P.to), 'ingreso'), { filters: [] }));
  }
};

/* =====================================================================
   ANÁLISIS › PATRIMONIO
   ===================================================================== */
VIEWS['an-patrimonio'] = {
  title: 'Análisis del patrimonio', crumb: 'Análisis',
  html() {
    const b = breakdown();
    const ser = nwSeries('Todo');
    const first = ser[0];
    const years = Math.max(0.1, D.diff(first[0], TODAY) / 365.25);
    const cagr = first[1] > 0 ? Math.pow(b.nw / first[1], 1 / years) - 1 : NaN;
    const ms = monthsBack(24); const deltas = ms.map(m => { const e = m === D.ym(TODAY) ? TODAY : D.monthEnd(m); const s = D.monthEnd(D.ymAdd(m, -1)); return { m, d: (nwAt(e) || 0) - (nwAt(s) || 0) }; });
    const best = deltas.reduce((a, x) => x.d > a.d ? x : a, deltas[0]), worst = deltas.reduce((a, x) => x.d < a.d ? x : a, deltas[0]);
    const y12 = nwAt(D.addMonthsISO(TODAY, -12));
    // reparto del crecimiento de 12 meses: ahorro vs rentabilidad
    const save12 = sum(monthsBack(12).map(monthStats), x => x.save);
    const growth12 = b.nw - (y12 || 0);
    return `${pageHead('Análisis del patrimonio', 'Cómo ha crecido tu patrimonio neto y de dónde viene ese crecimiento.')}
    <div class="kpis">
      ${kpi('Patrimonio neto', `<span class="nw-amt">${M(b.nw, { dec: 0 })}</span>`, '', 'var(--c-networth)')}
      ${kpi('Crecimiento 12 meses', M(growth12, { sign: true, dec: 0 }), deltaPill(y12 ? b.nw / y12 - 1 : NaN))}
      ${kpi('Crecimiento anual compuesto', pct(cagr, 1, true), `desde ${monthLabel(D.ym(first[0])).toLowerCase()}`)}
      ${kpi('Mejor mes', M(best.d, { sign: true, dec: 0 }), monthLabel(best.m), 'var(--c-income)')}
      ${kpi('Peor mes', M(worst.d, { sign: true, dec: 0 }), monthLabel(worst.m), 'var(--c-expense)')}
    </div><div class="section-gap"></div>
    <div class="grid">
      <section class="card c-8"><div class="card-h"><h2>Patrimonio neto desde el inicio</h2></div><div id="nwAll"></div></section>
      <section class="card c-4"><div class="card-h"><h2>Origen del crecimiento</h2><span class="sub">Últimos 12 meses</span></div>
        <div class="stack">
          <div class="row"><span class="cat-dot" style="background:var(--c-saving)"></span><span>Ahorro (ingresos − gastos)</span><span class="spacer"></span><span class="num">${M(save12, { sign: true, dec: 0 })}</span></div>
          <div class="row"><span class="cat-dot" style="background:var(--c-invest)"></span><span>Rentabilidad y revalorización</span><span class="spacer"></span><span class="num">${M(growth12 - save12, { sign: true, dec: 0 })}</span></div>
          <div class="divider"></div>
          <div class="row"><b>Crecimiento total</b><span class="spacer"></span><b class="num">${M(growth12, { sign: true, dec: 0 })}</b></div>
          <div class="compbar"><span style="flex-grow:${Math.max(0, save12)};background:var(--c-saving)"></span><span style="flex-grow:${Math.max(0, growth12 - save12)};background:var(--c-invest)"></span></div>
          <p class="muted" style="font-size:12px;margin:0">La rentabilidad incluye plusvalías, dividendos reinvertidos y la depreciación de bienes como el coche, y la amortización de deudas.</p>
        </div></section>
      <section class="card c-12"><div class="card-h"><h2>Variación mensual del patrimonio</h2><span class="sub">24 meses</span></div><div id="nwDelta"></div></section>
      <section class="card flush c-12"><div id="yrTbl"></div></section>
    </div>`;
  },
  after() {
    const ser = nwSeries('Todo');
    lineChart($('#nwAll'), { series: [{ name: 'Patrimonio neto', color: 'var(--c-networth)', data: ser, area: true }], height: 260, xfmt: d => monthLabel(D.ym(d), true), tipTitle: d => monthLabel(D.ym(d)) });
    const ms = monthsBack(24); const deltas = ms.map(m => { const e = m === D.ym(TODAY) ? TODAY : D.monthEnd(m); const s = D.monthEnd(D.ymAdd(m, -1)); return (nwAt(e) || 0) - (nwAt(s) || 0); });
    barChart($('#nwDelta'), { labels: ms.map(m => monthLabel(m, true)), height: 210, series: [{ name: 'Variación', color: v => v >= 0 ? 'var(--c-income)' : 'var(--c-expense)', values: deltas }], tipTitle: i => monthLabel(ms[i]) });
    const y0 = +firstDate().slice(0, 4), y1 = +TODAY.slice(0, 4); const rows = [];
    for (let y = y1; y >= y0; y--) {
      const end = y === y1 ? TODAY : `${y}-12-31`; const start = `${y - 1}-12-31`;
      const v = nwAt(end), v0 = nwAt(start); if (v == null) continue;
      const fl = rangeStats(`${y}-01-01`, end);
      rows.push({ id: String(y), y, v, d: v0 != null ? v - v0 : null, p: v0 ? v / v0 - 1 : null, save: fl.inc || fl.exp ? fl.save : null });
    }
    dataTable($('#yrTbl'), {
      id: 'yr', rows, select: false, noBar: true, pageSize: 10,
      columns: [{ key: 'y', label: 'Año', render: r => `${r.y}${r.y === y1 ? ' (hasta hoy)' : ''}` }, { key: 'v', label: 'Patrimonio al cierre', cls: 'r', render: r => M(r.v, { dec: 0 }) }, { key: 'd', label: 'Variación', cls: 'r', render: r => r.d == null ? '—' : `<span class="${r.d >= 0 ? 'pos' : 'neg'}">${M(r.d, { sign: true, dec: 0 })}</span>` }, { key: 'p', label: '%', cls: 'r', render: r => r.p == null ? '—' : pct(r.p, 1, true) }, { key: 'save', label: 'Ahorro del año', cls: 'r', render: r => r.save == null ? '<span class="muted">Histórico</span>' : M(r.save, { dec: 0 }) }]
    });
  }
};
VIEWS['an-rentabilidad'] = Object.assign({}, VIEWS.rentabilidad, { crumb: 'Análisis' });

/* =====================================================================
   INFORMES y exportación
   ===================================================================== */
const REPORTS = [['mensual', 'Mensual'], ['trimestral', 'Trimestral'], ['anual', 'Anual'], ['patrimonio', 'Patrimonio'], ['inversiones', 'Inversiones'], ['gastos', 'Gastos']];
function buildReport() {
  const R = UIS.rep; const type = R.type;
  const out = { title: '', sub: '', kpis: [], tables: [], chart: null };
  const flowReport = P => {
    const r = rangeStats(P.from, P.to); const pr = rangeStats(periodOf(P.prev).from, periodOf(P.prev).to);
    out.kpis = [['Ingresos', r.inc, 'money'], ['Gastos', r.exp, 'money'], ['Ahorro', r.save, 'money'], ['Tasa de ahorro', r.rate, 'pct'], ['Gastos vs periodo anterior', pr.exp ? r.exp / pr.exp - 1 : null, 'pct'], ['Patrimonio neto al cierre', nwAt(D.min(P.to, TODAY)), 'money']];
    out.tables.push({ name: 'Gastos por categoría', head: ['Categoría', 'Importe', '% del gasto', 'Presupuesto', 'Diferencia'], fmt: ['t', 'money', 'pct', 'money', 'money'], rows: Object.entries(r.byCat).sort((a, b) => b[1] - a[1]).map(([c, v]) => { const months = Math.max(1, D.ymDiff(D.ym(P.from), D.ym(P.to)) + 1); const bud = (S.budgets[c] || 0) * months; return [c, v, v / (r.exp || 1), bud || null, bud ? bud - v : null]; }) });
    out.tables.push({ name: 'Ingresos por fuente', head: ['Fuente', 'Importe', '% de ingresos'], fmt: ['t', 'money', 'pct'], rows: Object.entries(r.byInc).sort((a, b) => b[1] - a[1]).map(([c, v]) => [c, v, v / (r.inc || 1)]) });
    out.tables.push({ name: 'Movimientos', head: ['Fecha', 'Tipo', 'Concepto', 'Categoría', 'Subcategoría', 'Cuenta', 'Etiquetas', 'Importe'], fmt: ['d', 't', 't', 't', 't', 't', 't', 'money'], rows: r.txs.slice().sort((a, b) => a.date < b.date ? -1 : 1).map(t => [t.date, t.type === 'gasto' ? 'Gasto' : 'Ingreso', t.concept, t.category, t.sub || '', accName(t.account), (t.tags || []).map(x => '#' + x).join(' '), t.type === 'gasto' ? -t.amount : t.amount]) });
    const ms = []; for (let m = D.ym(P.from); m <= D.ym(D.min(P.to, TODAY)); m = D.ymAdd(m, 1)) ms.push(m);
    if (ms.length > 1) out.chart = el => barChart(el, { labels: ms.map(m => monthLabel(m, true)), series: [{ name: 'Ingresos', color: 'var(--c-income)', values: ms.map(m => monthStats(m).inc) }, { name: 'Gastos', color: 'var(--c-expense)', values: ms.map(m => monthStats(m).exp) }], height: 220, tipTitle: i => monthLabel(ms[i]) });
    else out.chart = el => { el.innerHTML = hbars(Object.entries(r.byCat).sort((a, b) => b[1] - a[1]).map(([c, v]) => ({ label: c, value: v, color: catColor(c) }))); };
  };
  if (type === 'mensual' || type === 'trimestral' || type === 'anual' || type === 'gastos') {
    const P = periodOf(R.p); out.sub = P.label;
    out.title = { mensual: 'Informe mensual', trimestral: 'Informe trimestral', anual: 'Informe anual', gastos: 'Informe de gastos' }[type];
    flowReport(P);
    if (type === 'gastos') { out.tables = [out.tables[0], { name: 'Gastos', head: out.tables[2].head, fmt: out.tables[2].fmt, rows: out.tables[2].rows.filter(r => r[1] === 'Gasto') }]; out.kpis = out.kpis.filter(k => ['Gastos', 'Gastos vs periodo anterior'].includes(k[0])).concat([['Gasto diario medio', rangeStats(P.from, P.to).exp / Math.max(1, D.diff(P.from, D.min(P.to, TODAY)) + 1), 'money']]); }
  } else if (type === 'patrimonio') {
    const b = breakdown(); out.title = 'Informe de patrimonio'; out.sub = `A ${fdateLong(TODAY)}`;
    out.kpis = [['Patrimonio neto', b.nw, 'money'], ['Activos', b.assets, 'money'], ['Pasivos', b.liab, 'money'], ['Liquidez', b.liq, 'money'], ['Invertido', b.invested, 'money'], ['No líquido', b.fisicos, 'money']];
    const g = balanceGroups();
    out.tables.push({ name: 'Activos', head: ['Clase', 'Activo', 'Tipo', 'Valor', '% de activos'], fmt: ['t', 't', 't', 'money', 'pct'], rows: ['liq', 'rf', 'rv', 'otros'].flatMap(k => g[k].map(x => [CLS_LABEL[k], x.name, x.sub || '', x.v, x.v / (b.assets || 1)])) });
    out.tables.push({ name: 'Pasivos', head: ['Pasivo', 'Tipo', 'Saldo pendiente', 'Interés %'], fmt: ['t', 't', 'money', 'num'], rows: S.liabilities.map(l => [l.name, LIAB_KINDS[l.kind].label, liabBalanceAt(l), l.rate || null]) });
    const ms = monthsBack(24);
    out.tables.push({ name: 'Evolución mensual', head: ['Mes', 'Activos', 'Pasivos', 'Patrimonio neto'], fmt: ['t', 'money', 'money', 'money'], rows: ms.map(m => { const x = breakdown(m === D.ym(TODAY) ? TODAY : D.monthEnd(m)); return [monthLabel(m), x.assets, x.liab, x.nw]; }) });
    out.chart = el => lineChart(el, { series: [{ name: 'Patrimonio neto', color: 'var(--c-networth)', data: nwSeries('Todo'), area: true }], height: 220, xfmt: d => monthLabel(D.ym(d), true) });
  } else if (type === 'inversiones') {
    const pf = portfolio(); const mr = monthlyReturns();
    out.title = 'Informe de inversiones'; out.sub = `A ${fdateLong(TODAY)}`;
    out.kpis = [['Valor actual', pf.value, 'money'], ['Capital aportado', pf.cost, 'money'], ['Ganancia latente', pf.gain, 'money'], ['Rentabilidad sobre aportado', pf.gainPct, 'pct'], ['Rentabilidad 12 meses', chain(mr.slice(-12)), 'pct'], ['Dividendos e intereses', pf.dividends + pf.couponInt + pf.other, 'money']];
    out.tables.push({ name: 'Posiciones', head: ['Inversión', 'Tipo', 'ISIN/Ticker', 'Participaciones', 'Precio medio', 'Valor actual', 'Aportado', 'Valor de mercado', 'Ganancia', 'Rentabilidad'], fmt: ['t', 't', 't', 'num', 'money', 'money', 'money', 'money', 'money', 'pct'], rows: pf.hs.map(x => [x.h.name, HOLDING_KINDS[x.h.kind].label, x.h.isin || x.h.ticker || '', +x.units.toFixed(6), x.avg, x.h.price, x.cost, x.value, x.gain, x.gainPct]) });
    const al = allocation(); const tg = S.settings.target;
    out.tables.push({ name: 'Asignación', head: ['Clase', 'Importe', 'Actual', 'Objetivo', 'Desviación (pp)'], fmt: ['t', 'money', 'pct', 'pct', 'num'], rows: ['rv', 'rf', 'liq', 'otros'].map(k => [CLS_LABEL[k], al.abs[k], al[k], tg[k] / 100, +(al[k] * 100 - tg[k]).toFixed(2)]) });
    out.tables.push({ name: 'Rentabilidad mensual', head: ['Mes', 'Valor inicial', 'Aportaciones', 'Valor final', 'Resultado', 'Rentabilidad'], fmt: ['t', 'money', 'money', 'money', 'money', 'pct'], rows: mr.map(x => [monthLabel(x.ym), x.v0, x.c, x.v1, x.gain, x.r]) });
    const ser = investSeries('1A');
    out.chart = el => lineChart(el, { series: [{ name: 'Valor', color: 'var(--c-invest)', data: ser.value, area: true }, { name: 'Aportado', color: 'var(--ink-2)', data: ser.cost, dash: true, noEnd: true }], height: 220, xfmt: d => monthLabel(D.ym(d), true) });
  }
  return out;
}
const fmtCell = (v, f) => v == null || v === '' ? '—' : f === 'money' ? M(v) : f === 'pct' ? pct(v, 2) : f === 'num' ? numFmt(v, 4) : f === 'd' ? fdate(v) : esc(v);
VIEWS.informes = {
  title: 'Informes', crumb: 'Análisis',
  html() {
    UIS.rep = UIS.rep || { type: 'mensual', p: { mode: 'mes', ym: refMonth() } };
    const R = UIS.rep; const rep = buildReport();
    const needsPeriod = ['mensual', 'trimestral', 'anual', 'gastos'].includes(R.type);
    return `${pageHead('Informes', 'Genera un informe, revísalo aquí y expórtalo para guardarlo o compartirlo con tu asesor.', `<button class="btn" data-exp="csv" type="button">${I('download', 'sm')}CSV</button><button class="btn" data-exp="xlsx" type="button">${I('download', 'sm')}Excel</button><button class="btn primary" data-exp="pdf" type="button">${I('download', 'sm')}PDF</button>`)}
    <div class="card" style="padding:14px 16px;margin-bottom:16px"><div class="row wrap" style="gap:12px">${seg('repType', REPORTS, R.type)}${needsPeriod ? `<span class="spacer"></span>${periodPicker('repP')}` : ''}</div></div>
    <section class="card"><div class="card-h"><div><div class="eyebrow">${esc(rep.sub)}</div><h2 style="font-size:20px;margin-top:4px">${esc(rep.title)}</h2></div><div class="right"><span class="muted" style="font-size:12px">Generado el ${fdate(TODAY)}${S.demo ? ' · datos de demostración' : ''}</span></div></div>
      <div class="kpis">${rep.kpis.map(([l, v, f]) => kpi(l, fmtCell(v, f))).join('')}</div>
      ${rep.chart ? '<div class="section-gap"></div><div id="repChart"></div>' : ''}
      ${rep.tables.map((t, ti) => `<div class="section-gap"></div><h3 style="font-size:14px;margin:0 0 8px">${esc(t.name)} <span class="muted" style="font-weight:400">· ${t.rows.length} filas</span></h3><div class="tbl-wrap" style="border:1px solid var(--line);border-radius:12px;max-height:${t.rows.length > 14 ? '420px' : 'none'};overflow:auto"><table class="tbl"><thead><tr>${t.head.map((h, i) => `<th class="${['money', 'pct', 'num'].includes(t.fmt[i]) ? 'r' : ''}">${esc(h)}</th>`).join('')}</tr></thead><tbody>${t.rows.length ? t.rows.map(r => `<tr>${r.map((v, i) => `<td class="${['money', 'pct', 'num'].includes(t.fmt[i]) ? 'r' : ''}">${fmtCell(v, t.fmt[i])}</td>`).join('')}</tr>`).join('') : `<tr><td colspan="${t.head.length}" class="muted">Sin datos en este periodo</td></tr>`}</tbody></table></div>`).join('')}
    </section>
    <p class="legend-note">Las exportaciones incluyen todas las filas. Excel y PDF se generan en tu navegador; tus datos no salen de este dispositivo.</p>`;
  },
  after() {
    bindSeg('repType', v => { const modes = { mensual: 'mes', trimestral: 'trimestre', anual: 'año', gastos: 'mes' }; UIS.rep = { type: v, p: { mode: modes[v] || 'mes', ym: refMonth() } }; render(); });
    bindPeriod('repP');
    const rep = buildReport();
    if (rep.chart && $('#repChart')) rep.chart($('#repChart'));
    on('[data-exp]', 'click', (e, el) => exportReport(el.dataset.exp, rep, el));
  }
};

/* ---------- exportación ---------- */
const libCache = {};
function loadScript(src) {
  return libCache[src] || (libCache[src] = new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => { delete libCache[src]; rej(new Error('lib')); }; document.head.appendChild(s); }));
}
async function saveFile(filename, data, mime) {
  let dl = null;
  try { dl = window.claude && window.claude.use ? await window.claude.use('downloads') : null; } catch (e) { dl = null; }
  if (dl) {
    try { await dl.save({ filename, data }); toast(`Archivo listo: ${filename}`); }
    catch (e) {
      const c = e && e.code;
      if (c === 'declined') toast('Descarga cancelada');
      else if (c === 'rate_limited') toast('Ya hay una descarga pendiente de confirmar');
      else toast('No se ha podido guardar el archivo en esta vista');
    }
    return;
  }
  try {
    const blob = data instanceof Blob ? data : new Blob([data], { type: mime });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
    toast(`Descarga iniciada: ${filename}`);
  } catch (e) { toast('Esta vista no permite descargar archivos'); }
}
const plainVal = (v, f) => v == null ? '' : f === 'money' || f === 'num' ? round2(v) : f === 'pct' ? +(v * 100).toFixed(2) : String(v);
function slug(s) { return norm(s).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }
async function exportReport(kind, rep, btn) {
  const base = `${slug(rep.title)}-${slug(rep.sub) || TODAY}`;
  const prev = btn.innerHTML; btn.disabled = true; btn.innerHTML = `${I('refresh', 'sm')}Generando…`;
  try {
    if (kind === 'csv') {
      const cell = v => { const s = typeof v === 'number' ? String(v).replace('.', ',') : String(v); return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
      const lines = [[rep.title], [rep.sub], [], ['Indicador', 'Valor']].concat(rep.kpis.map(([l, v, f]) => [l + (f === 'pct' ? ' (%)' : ''), plainVal(v, f)]));
      rep.tables.forEach(t => { lines.push([], [t.name], t.head.map((h, i) => h + (t.fmt[i] === 'pct' ? ' (%)' : ''))); t.rows.forEach(r => lines.push(r.map((v, i) => plainVal(v, t.fmt[i])))); });
      await saveFile(base + '.csv', '﻿' + lines.map(l => l.map(cell).join(';')).join('\r\n'), 'text/csv');
    } else if (kind === 'xlsx') {
      await loadScript('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js');
      const wb = XLSX.utils.book_new();
      const kp = [[rep.title], [rep.sub], [], ['Indicador', 'Valor']].concat(rep.kpis.map(([l, v, f]) => [l + (f === 'pct' ? ' (%)' : ''), plainVal(v, f)]));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(kp), 'Resumen');
      rep.tables.forEach(t => { const ws = XLSX.utils.aoa_to_sheet([t.head.map((h, i) => h + (t.fmt[i] === 'pct' ? ' (%)' : ''))].concat(t.rows.map(r => r.map((v, i) => plainVal(v, t.fmt[i]))))); ws['!cols'] = t.head.map(() => ({ wch: 18 })); XLSX.utils.book_append_sheet(wb, ws, t.name.slice(0, 30)); });
      const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      await saveFile(base + '.xlsx', new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    } else if (kind === 'pdf') {
      await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
      await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js');
      const { jsPDF } = window.jspdf; const doc = new jsPDF({ unit: 'pt', format: 'a4' });
      const clean = s => String(s).replace(/−/g, '-').replace(/ | /g, ' ');
      const txt = (v, f) => clean(v == null || v === '' ? '-' : f === 'money' ? money(v) : f === 'pct' ? pct(v, 2) : f === 'num' ? numFmt(v, 4) : f === 'd' ? fdate(v) : v);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(18); doc.text(clean(rep.title), 40, 56);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(110); doc.text(clean(`${rep.sub} · generado el ${fdate(TODAY)}${S.demo ? ' · datos de demostración' : ''}`), 40, 74);
      doc.setTextColor(20);
      doc.autoTable({ startY: 92, head: [['Indicador', 'Valor']], body: rep.kpis.map(([l, v, f]) => [clean(l), txt(v, f)]), theme: 'grid', styles: { fontSize: 9 }, headStyles: { fillColor: [29, 92, 79] }, columnStyles: { 1: { halign: 'right' } }, margin: { left: 40, right: 40 } });
      rep.tables.forEach(t => {
        let y = doc.lastAutoTable.finalY + 26; if (y > 740) { doc.addPage(); y = 50; }
        doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.text(clean(t.name), 40, y);
        const cs = {}; t.fmt.forEach((f, i) => { if (['money', 'pct', 'num'].includes(f)) cs[i] = { halign: 'right' }; });
        doc.autoTable({ startY: y + 8, head: [t.head.map(clean)], body: t.rows.length ? t.rows.map(r => r.map((v, i) => txt(v, t.fmt[i]))) : [[{ content: 'Sin datos', colSpan: t.head.length }]], theme: 'striped', styles: { fontSize: t.head.length > 7 ? 7 : 8.5, cellPadding: 4 }, headStyles: { fillColor: [29, 92, 79] }, columnStyles: cs, margin: { left: 40, right: 40 } });
      });
      const pages = doc.internal.getNumberOfPages();
      for (let i = 1; i <= pages; i++) { doc.setPage(i); doc.setFontSize(8); doc.setTextColor(140); doc.text(`Patrimonia · página ${i} de ${pages}`, 40, 820); }
      await saveFile(base + '.pdf', doc.output('blob'), 'application/pdf');
    }
  } catch (e) { toast('No se pudo generar el archivo. Revisa tu conexión e inténtalo de nuevo.'); }
  btn.disabled = false; btn.innerHTML = prev;
}

/* =====================================================================
   CONFIGURACIÓN
   ===================================================================== */
VIEWS.ajustes = {
  title: 'Configuración', crumb: '',
  html() {
    const st = S.settings;
    const usedCat = c => S.tx.some(t => t.category === c);
    return `${pageHead('Configuración', 'Preferencias de la aplicación, privacidad, categorías y tus datos.')}
    <div class="card">
      <div class="settings-sec"><div><h3>Tu cuenta</h3><p>Tus datos se cifran con tu contraseña. Si la olvidas no se pueden recuperar, así que guarda una copia de seguridad de vez en cuando.</p></div><div class="stack">
        <div class="form-grid">
          ${field('Nombre', `<input class="input" id="setName" value="${esc(AUTH.user ? AUTH.user.name : '')}" autocomplete="name"/>`, { err: false, id: 'setName' })}
          ${field('Usuario', `<div class="input" style="display:flex;align-items:center;background:var(--surface-2)">${esc(AUTH.user ? AUTH.user.username : '')}</div>`, { err: false })}
        </div>
        <div class="row wrap"><button class="btn sm" data-chpw type="button">${I('lock', 'sm')}Cambiar contraseña</button><button class="btn sm" data-logout type="button">${I('right', 'sm')}Cerrar sesión</button><button class="btn sm danger" data-delacc type="button">${I('trash', 'sm')}Eliminar cuenta</button></div>
      </div></div>
      <div class="settings-sec"><div><h3>General</h3><p>Moneda, país y formato de fecha usados en toda la aplicación.</p></div><div class="form-grid">
        ${field('Moneda', `<select class="input" id="setCur">${Object.entries(CURRENCIES).map(([k, v]) => opt(k, v, st.currency)).join('')}</select>`, { err: false, id: 'setCur' })}
        ${field('País', `<select class="input" id="setCountry">${Object.entries(COUNTRIES).map(([k, v]) => opt(k, v.label, st.country)).join('')}</select>`, { err: false, id: 'setCountry', hint: 'Define el formato de números' })}
        ${field('Formato de fecha', `<select class="input" id="setDate">${['dd/mm/aaaa', 'mm/dd/aaaa', 'aaaa-mm-dd'].map(f => opt(f, f, st.dateFormat)).join('')}</select>`, { err: false, id: 'setDate' })}
        ${field('Vista previa', `<div class="input" style="display:flex;align-items:center;background:var(--surface-2)"><span class="num">${fdate(TODAY)} · ${money(64350.5)}</span></div>`, { err: false })}
      </div></div>
      <div class="settings-sec"><div><h3>Apariencia</h3><p>Modo claro, oscuro o el de tu sistema.</p></div><div>${seg('theme', [['system', 'Sistema'], ['light', 'Claro'], ['dark', 'Oscuro']], st.theme)}</div></div>
      <div class="settings-sec"><div><h3>Privacidad</h3><p>Oculta cifras cuando haya gente cerca. El bloqueo pide tu contraseña para volver a mostrar la información.</p></div><div>
        <div class="set-row"><label class="check" style="flex:1"><span class="switch"><input type="checkbox" id="setHide" ${st.hideAmounts ? 'checked' : ''}/><span></span></span>Ocultar todos los saldos e importes</label><kbd>H</kbd></div>
        <div class="set-row"><label class="check" style="flex:1"><span class="switch"><input type="checkbox" id="setHideNw" ${st.hideNetWorth ? 'checked' : ''}/><span></span></span>Ocultar siempre el patrimonio neto</label></div>
        <div class="set-row"><span style="flex:1">Bloquear la pantalla tras inactividad</span><select class="input sm" id="setLock" style="width:auto">${[[0, 'Nunca'], [1, '1 minuto'], [5, '5 minutos'], [15, '15 minutos']].map(([v, l]) => opt(v, l, st.autoLock)).join('')}</select></div>
        <div class="set-row"><span style="flex:1">Bloquear ahora la información sensible</span><button class="btn sm" data-lock type="button">${I('lock', 'sm')}Bloquear</button><kbd>L</kbd></div>
      </div></div>
      <div class="settings-sec"><div><h3>Categorías de gasto</h3><p>Renombra, añade subcategorías o crea categorías propias. La naturaleza alimenta el análisis «necesidades frente a ocio».</p></div><div class="cat-edit">
        ${S.categories.map((c, i) => `<div class="cat-edit-row" data-ci="${i}"><span class="cat-ic" style="background:var(--surface-3);color:${catColor(c.name)}">${I(c.icon, 'sm')}</span><input class="input sm" data-cname value="${esc(c.name)}" style="width:150px" aria-label="Nombre de la categoría"/><select class="input sm" data-cnat style="width:auto" aria-label="Naturaleza">${opt('necesidad', 'Necesidad', c.nature)}${opt('ocio', 'Ocio', c.nature)}</select>
          <div class="chips" style="flex:1 1 260px">${c.subs.map(s => `<span class="tag">${esc(s)}<button type="button" class="tag-x" data-rmsub="${esc(s)}" aria-label="Quitar ${esc(s)}">×</button></span>`).join('')}<input class="input sm" data-addsub placeholder="+ subcategoría" style="width:130px;height:24px" aria-label="Nueva subcategoría"/></div>
          <button class="mini-btn del" data-rmcat type="button" ${usedCat(c.name) ? 'disabled title="Tiene gastos asociados"' : ''} aria-label="Eliminar categoría">${I('trash', 'sm')}</button></div>`).join('')}
        <div class="row"><input class="input sm" id="newCat" placeholder="Nueva categoría" style="max-width:220px"/><button class="btn sm" data-addcat type="button">${I('plus', 'sm')}Añadir categoría</button></div>
      </div></div>
      <div class="settings-sec"><div><h3>Etiquetas</h3><p>Agrupan gastos de distintas categorías (un viaje, la pareja, el coche…).</p></div><div class="stack">
        <div class="chips">${S.tags.map(t => `<span class="chip">#${esc(t)}<span class="muted num" style="font-size:11px">${S.tx.filter(x => (x.tags || []).includes(t)).length}</span><button type="button" class="tag-x" data-rmtag="${esc(t)}" aria-label="Eliminar etiqueta ${esc(t)}">×</button></span>`).join('')}</div>
        <div class="row"><input class="input sm" id="newTag" placeholder="nueva-etiqueta" style="max-width:220px"/><button class="btn sm" data-addtag type="button">${I('plus', 'sm')}Añadir</button></div></div></div>
      <div class="settings-sec"><div><h3>Cuentas</h3><p>Bancos, ahorro, efectivo y bróker.</p></div><div><div class="list">${S.accounts.map(a => `<div class="li"><span class="li-ic">${I((ACCOUNT_TYPES[a.type] || {}).icon || 'bank', 'sm')}</span><span class="li-main"><span class="li-t">${esc(a.name)}</span><span class="li-s">${esc((ACCOUNT_TYPES[a.type] || {}).label)}</span></span><span class="row"><span class="li-v">${M(balAt(a.id))}</span><button class="mini-btn" data-eacc="${a.id}" type="button" aria-label="Editar ${esc(a.name)}">${I('edit', 'sm')}</button></span></div>`).join('')}</div><button class="btn sm" data-newacc type="button" style="margin-top:10px">${I('plus', 'sm')}Nueva cuenta</button></div></div>
      <div class="settings-sec"><div><h3>Planificación</h3><p>Presupuestos, objetivos y cartera objetivo.</p></div><div class="row wrap"><button class="btn sm" data-budgets type="button">${I('target', 'sm')}Presupuestos (${M(sum(Object.values(S.budgets)), { dec: 0 })}/mes)</button><a class="btn sm" href="#objetivos">${I('flag', 'sm')}Objetivos (${S.goals.length})</a><button class="btn sm" data-target type="button">${I('pie', 'sm')}Asignación objetivo: ${['rv', 'rf', 'liq', 'otros'].map(k => st.target[k]).join(' / ')}</button></div></div>
      <div class="settings-sec"><div><h3>Tus datos</h3><p>Se guardan cifrados en este navegador. La copia de seguridad sirve para pasarlos a otro dispositivo o recuperarlos si borras el navegador.</p></div><div class="stack">
        <div class="row wrap"><button class="btn sm primary" data-import type="button">${I('upload', 'sm')}Importar desde Excel o CSV</button><button class="btn sm" data-tpl type="button">${I('download', 'sm')}Plantilla de Excel</button></div>
        <div class="row wrap"><button class="btn sm" data-backup type="button">${I('download', 'sm')}Copia de seguridad (JSON)</button>
        <label class="btn sm" style="cursor:pointer">${I('upload', 'sm')}Restaurar copia<input type="file" accept="application/json,.json" id="restore" hidden/></label>
        <button class="btn sm danger" data-fresh type="button">${I('trash', 'sm')}Borrar todos mis datos</button></div>
        <span class="hint">La copia de seguridad se descarga sin cifrar: guárdala en un lugar seguro.</span></div></div>
      <div class="settings-sec"><div><h3>Atajos de teclado</h3><p>Para registrar operaciones en segundos.</p></div><div class="kv" style="grid-template-columns:auto 1fr;max-width:420px">${[['Ctrl + K  o  /', 'Búsqueda global'], ['N', 'Menú «Añadir»'], ['G', 'Nuevo gasto'], ['I', 'Nuevo ingreso'], ['T', 'Nueva transferencia'], ['V', 'Nueva aportación'], ['H', 'Ocultar o mostrar importes'], ['L', 'Bloquear pantalla'], ['Ctrl + Enter', 'Guardar formulario'], ['Esc', 'Cerrar ventana']].map(([k, d]) => `<dt><kbd>${esc(k)}</kbd></dt><dd style="text-align:left;font-family:inherit">${esc(d)}</dd>`).join('')}</div></div>
      <div class="settings-sec"><div><h3>Próximamente</h3><p>La estructura de datos ya está preparada para estas funciones.</p></div><div class="chips">${['Sincronización bancaria automática', 'Integración con brókers', 'Notificaciones', 'Categorización automática', 'Análisis con IA', 'Predicción de flujo de caja', 'Seguimiento de dividendos', 'Alertas de vencimientos'].map(x => `<span class="chip">${esc(x)}</span>`).join('')}</div></div>
    </div>`;
  },
  after() {
    const st = S.settings;
    $('#setCur').onchange = e => { st.currency = e.target.value; resetFormatters(); commit(); toast('Moneda actualizada'); };
    $('#setCountry').onchange = e => { st.country = e.target.value; resetFormatters(); commit(); };
    $('#setDate').onchange = e => { st.dateFormat = e.target.value; commit(); };
    bindSeg('theme', v => { st.theme = v; applyTheme(); commit(); });
    $('#setHide').onchange = e => { st.hideAmounts = e.target.checked; applyPrivacy(); persist(); };
    $('#setHideNw').onchange = e => { st.hideNetWorth = e.target.checked; applyPrivacy(); persist(); };
    $('#setLock').onchange = e => { st.autoLock = +e.target.value; persist(); armLock(); toast(st.autoLock ? `Bloqueo tras ${st.autoLock} min sin actividad` : 'Bloqueo automático desactivado'); };
    on('[data-lock]', 'click', lockNow);
    // categorías
    $$('[data-ci]').forEach(row => {
      const c = S.categories[+row.dataset.ci];
      row.querySelector('[data-cname]').onchange = e => {
        const nn = e.target.value.trim(); if (!nn || nn === c.name) return;
        if (S.categories.some(x => x.name === nn)) { toast('Ya existe una categoría con ese nombre'); e.target.value = c.name; return; }
        const old = c.name; c.name = nn;
        S.tx.forEach(t => { if (t.type === 'gasto' && t.category === old) t.category = nn; });
        S.recurring.forEach(r => { if (r.category === old) r.category = nn; });
        if (S.budgets[old] != null) { S.budgets[nn] = S.budgets[old]; delete S.budgets[old]; }
        commit(); toast('Categoría renombrada');
      };
      row.querySelector('[data-cnat]').onchange = e => { c.nature = e.target.value; commit(); };
      row.querySelectorAll('[data-rmsub]').forEach(b => b.onclick = () => { c.subs = c.subs.filter(s => s !== b.dataset.rmsub); commit(); });
      const add = row.querySelector('[data-addsub]');
      add.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); const v = add.value.trim(); if (v && !c.subs.includes(v)) { c.subs.push(v); commit(); toast('Subcategoría añadida'); } } };
      const rm = row.querySelector('[data-rmcat]');
      rm.onclick = async () => { if (await confirmDialog({ title: 'Eliminar categoría', text: `Se eliminará «${esc(c.name)}» y su presupuesto.`, ok: 'Eliminar', danger: true })) withUndo('Categoría eliminada', () => { S.categories = S.categories.filter(x => x !== c); delete S.budgets[c.name]; }); };
    });
    on('[data-addcat]', 'click', () => {
      const v = $('#newCat').value.trim(); if (!v) { toast('Escribe un nombre para la categoría'); return; }
      if (S.categories.some(x => norm(x.name) === norm(v))) { toast('Esa categoría ya existe'); return; }
      S.categories.splice(Math.max(0, S.categories.length - 1), 0, { id: uid('c'), name: v, icon: 'tag', nature: 'necesidad', subs: ['General'], ocioSubs: [] });
      commit(); toast(`Categoría «${v}» creada`);
    });
    on('[data-rmtag]', 'click', async (e, el) => {
      const t = el.dataset.rmtag; const n = S.tx.filter(x => (x.tags || []).includes(t)).length;
      if (await confirmDialog({ title: 'Eliminar etiqueta', text: `Se quitará #${esc(t)}${n ? ` de ${n} gastos` : ''}.`, ok: 'Eliminar', danger: true })) withUndo('Etiqueta eliminada', () => { S.tags = S.tags.filter(x => x !== t); S.tx.forEach(x => { if (x.tags) x.tags = x.tags.filter(y => y !== t); }); });
    });
    const addTag = () => { const v = $('#newTag').value.replace(/#/g, '').trim().toLowerCase(); if (!v) return; if (!S.tags.includes(v)) { S.tags.push(v); commit(); toast(`Etiqueta #${v} creada`); } };
    on('[data-addtag]', 'click', addTag); $('#newTag').onkeydown = e => { if (e.key === 'Enter') addTag(); };
    on('[data-eacc]', 'click', (e, el) => accountForm(S.accounts.find(a => a.id === el.dataset.eacc)));
    on('[data-newacc]', 'click', () => accountForm());
    on('[data-budgets]', 'click', budgetForm);
    on('[data-target]', 'click', targetForm);
    on('[data-backup]', 'click', () => saveFile(`patrimonia-copia-${TODAY}.json`, JSON.stringify(S, null, 1), 'application/json'));
    $('#restore').onchange = e => {
      const f = e.target.files[0]; if (!f) return;
      const rd = new FileReader();
      rd.onload = async () => {
        try {
          const d = JSON.parse(rd.result);
          if (!d || d.version !== 1 || !Array.isArray(d.tx) || !Array.isArray(d.accounts)) throw new Error('formato');
          if (await confirmDialog({ title: 'Restaurar copia', text: `Se sustituirán los datos actuales por la copia «${esc(f.name)}» (${d.tx.length} movimientos).`, ok: 'Restaurar' })) withUndo('Copia restaurada', () => { S = d; resetFormatters(); });
        } catch (err) { toast('El archivo no es una copia válida de Patrimonia'); }
      };
      rd.readAsText(f);
    };
    on('[data-fresh]', 'click', async () => {
      if (await confirmDialog({ title: 'Borrar todos mis datos', text: 'Se borrarán todos tus movimientos, cuentas, inversiones y objetivos. Tu usuario y tu contraseña se mantienen. Podrás deshacerlo justo después.', ok: 'Borrar datos', danger: true }))
        withUndo('Datos borrados', () => { const keep = S.settings; S = emptyState0(); S.settings = Object.assign(defaultSettings(), { theme: keep.theme, currency: keep.currency, country: keep.country, dateFormat: keep.dateFormat }); });
    });
    on('[data-import]', 'click', () => importWizard());
    on('[data-tpl]', 'click', downloadTemplate);
    on('[data-chpw]', 'click', changePasswordForm);
    on('[data-logout]', 'click', logout);
    on('[data-delacc]', 'click', deleteAccountForm);
    const nm = $('#setName'); if (nm) nm.onchange = () => { const v = nm.value.trim(); if (v) { renameUser(v); toast('Nombre actualizado'); render(); } };
  }
};
