/* Patrimonia — gráficos SVG propios (línea/área, barras, donut, sparkline) con tooltips */
'use strict';

const NS = 'http://www.w3.org/2000/svg';
let tipEl = null;
function tip() { if (!tipEl) { tipEl = document.createElement('div'); tipEl.className = 'tip'; tipEl.setAttribute('role', 'tooltip'); document.body.appendChild(tipEl); } return tipEl; }
function showTip(html, x, y) {
  const t = tip(); t.innerHTML = html; t.classList.add('on');
  const w = t.offsetWidth, h = t.offsetHeight, vw = window.innerWidth, vh = window.innerHeight;
  let left = x + 14, top = y - h - 12;
  if (left + w > vw - 8) left = x - w - 14;
  if (left < 8) left = 8;
  if (top < 8) top = y + 16;
  if (top + h > vh - 8) top = vh - h - 8;
  t.style.left = left + 'px'; t.style.top = top + 'px';
}
function hideTip() { if (tipEl) tipEl.classList.remove('on'); }
const tipRow = (color, label, val, line) => `<div class="tr"><i style="background:${color};${line ? 'height:2px;width:10px;border-radius:1px' : ''}"></i><span>${esc(label)}</span><b>${val}</b></div>`;

function niceTicks(min, max, count = 4) {
  if (min === max) { max = min + 1; }
  const span = max - min;
  const step0 = span / count;
  const mag = Math.pow(10, Math.floor(Math.log10(step0)));
  const err = step0 / mag;
  const step = (err >= 7.5 ? 10 : err >= 3.5 ? 5 : err >= 1.5 ? 2 : 1) * mag;
  const lo = Math.floor(min / step) * step, hi = Math.ceil(max / step) * step;
  const ticks = []; for (let v = lo; v <= hi + step / 2; v += step) ticks.push(+v.toFixed(10));
  return ticks;
}

/* re-dibujo al cambiar de tamaño */
const chartRO = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(entries => {
  for (const e of entries) {
    const el = e.target; const w = Math.round(e.contentRect.width);
    if (el._draw && w && Math.abs(w - (el._w || 0)) > 4) { el._w = w; el._draw(false); }
  }
}) : null;
function mount(el, draw) {
  el.classList.add('chart'); el._draw = draw; el._w = el.clientWidth; draw(true);
  if (chartRO) chartRO.observe(el);
}

/* ---------- línea / área ---------- */
function lineChart(el, o) {
  if (!el) return;
  const series = o.series.filter(s => s.data && s.data.length);
  if (!series.length) { el.innerHTML = emptyState('chart', 'Sin datos en este periodo', 'Cuando registres movimientos aparecerán aquí.'); return; }
  const H = o.height || 260;
  const yfmt = o.yfmt || compact, vfmt = o.vfmt || (v => M(v)), xfmt = o.xfmt || (d => fdate(d, true));
  mount(el, animate => {
    const W = Math.max(280, el.clientWidth || 600);
    const pl = o.padLeft || 56, pr = 14, pt = 12, pb = 26;
    const xs = series[0].data.map(p => D.parse(p[0]));
    const x0 = Math.min(...series.map(s => D.parse(s.data[0][0]))), x1 = Math.max(...series.map(s => D.parse(s.data[s.data.length - 1][0])));
    let ymin = Infinity, ymax = -Infinity;
    series.forEach(s => s.data.forEach(p => { if (p[1] != null) { ymin = Math.min(ymin, p[1]); ymax = Math.max(ymax, p[1]); } }));
    if (o.zero) ymin = Math.min(0, ymin);
    else { const pad = (ymax - ymin) * 0.12 || Math.abs(ymax) * 0.05 || 1; ymin -= pad; ymax += pad * 0.4; }
    const ticks = niceTicks(ymin, ymax, H < 200 ? 3 : 4);
    const ylo = ticks[0], yhi = ticks[ticks.length - 1];
    const X = t => pl + (x1 === x0 ? 0.5 : (t - x0) / (x1 - x0)) * (W - pl - pr);
    const Y = v => pt + (1 - (v - ylo) / (yhi - ylo || 1)) * (H - pt - pb);
    let svg = `<svg viewBox="0 0 ${W} ${H}" height="${H}" role="img" aria-label="${esc(o.label || 'Gráfico de evolución')}"><defs>`;
    series.forEach((s, i) => { if (s.area) svg += `<linearGradient id="g${el.id || 'c'}${i}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:${s.color};stop-opacity:.22"/><stop offset="1" style="stop-color:${s.color};stop-opacity:0"/></linearGradient>`; });
    svg += '</defs>';
    ticks.forEach(t => { svg += `<line class="gridl" x1="${pl}" x2="${W - pr}" y1="${Y(t)}" y2="${Y(t)}"/><text class="ax yv" x="${pl - 8}" y="${Y(t) + 4}" text-anchor="end">${esc(yfmt(t))}</text>`; });
    if (ylo < 0 && yhi > 0) svg += `<line class="base" x1="${pl}" x2="${W - pr}" y1="${Y(0)}" y2="${Y(0)}"/>`;
    // ticks del eje X
    const nT = Math.max(2, Math.min(o.xTicks || 6, Math.floor((W - pl) / 90)));
    const idxs = []; for (let k = 0; k < nT; k++) idxs.push(Math.round(k * (xs.length - 1) / (nT - 1)));
    [...new Set(idxs)].forEach((ix, k, arr) => {
      const anchor = k === 0 ? 'start' : k === arr.length - 1 ? 'end' : 'middle';
      svg += `<text class="ax" x="${X(xs[ix])}" y="${H - 6}" text-anchor="${anchor}">${esc(xfmt(series[0].data[ix][0]))}</text>`;
    });
    series.forEach((s, i) => {
      const pts = s.data.filter(p => p[1] != null).map(p => [X(D.parse(p[0])), Y(p[1])]);
      if (!pts.length) return;
      const d = 'M' + pts.map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join('L');
      if (s.area) { const base = Y(Math.max(ylo, Math.min(0, yhi))); svg += `<path d="${d}L${pts[pts.length - 1][0].toFixed(1)},${base}L${pts[0][0].toFixed(1)},${base}Z" style="fill:url(#g${el.id || 'c'}${i})"/>`; }
      svg += `<path class="ln${animate && !s.dash ? ' draw' : ''}" d="${d}" style="stroke:${s.color};stroke-width:${s.width || 2}px;${s.dash ? 'stroke-dasharray:5 4;' : ''}"/>`;
      const lp = pts[pts.length - 1];
      if (!s.noEnd) svg += `<circle cx="${lp[0]}" cy="${lp[1]}" r="4" style="fill:${s.color};stroke:var(--surface);stroke-width:2"/>`;
    });
    svg += `<g class="hov" style="display:none"><line class="xh" y1="${pt}" y2="${H - pb}"/>${series.map(s => `<circle r="4.5" style="fill:${s.color};stroke:var(--surface);stroke-width:2"/>`).join('')}</g>`;
    svg += `<rect class="hit" x="${pl}" y="0" width="${W - pl - pr}" height="${H}"/></svg>`;
    el.innerHTML = svg;
    el.querySelectorAll('.ln.draw').forEach(p => { const len = p.getTotalLength ? p.getTotalLength() : 1000; p.style.setProperty('--len', Math.ceil(len)); });
    const hov = el.querySelector('.hov'), xh = hov.querySelector('line'), dots = hov.querySelectorAll('circle');
    const hit = el.querySelector('.hit');
    const svgEl = el.querySelector('svg');
    const move = ev => {
      const r = svgEl.getBoundingClientRect(); const sx = (ev.clientX - r.left) * (W / r.width);
      const t = x0 + (sx - pl) / (W - pl - pr) * (x1 - x0);
      let bi = 0, bd = Infinity; xs.forEach((v, i) => { const dd = Math.abs(v - t); if (dd < bd) { bd = dd; bi = i; } });
      const xd = X(xs[bi]);
      hov.style.display = ''; xh.setAttribute('x1', xd); xh.setAttribute('x2', xd);
      let rows = '';
      series.forEach((s, i) => {
        const p = s.data[bi] || s.data[s.data.length - 1];
        if (p && p[1] != null) { dots[i].setAttribute('cx', X(D.parse(p[0]))); dots[i].setAttribute('cy', Y(p[1])); dots[i].style.display = ''; rows += tipRow(s.color, s.name, vfmt(p[1], s), true); }
        else dots[i].style.display = 'none';
      });
      const title = o.tipTitle ? o.tipTitle(series[0].data[bi][0], bi) : fdateLong(series[0].data[bi][0]);
      showTip(`<div class="tt">${title}</div>${rows}${o.tipExtra ? o.tipExtra(bi) : ''}`, ev.clientX, ev.clientY);
    };
    hit.addEventListener('pointermove', move);
    hit.addEventListener('pointerdown', move);
    hit.addEventListener('pointerleave', () => { hov.style.display = 'none'; hideTip(); });
  });
}

/* ---------- barras (agrupadas, apiladas o con signo) ---------- */
function barPath(x, y0, w, y1, r) {
  // barra anclada en y0 con la punta (y1) redondeada
  const h = Math.abs(y1 - y0); r = Math.min(r, w / 2, h);
  if (h < 0.5) return '';
  if (y1 < y0) return `M${x},${y0}V${y1 + r}Q${x},${y1} ${x + r},${y1}H${x + w - r}Q${x + w},${y1} ${x + w},${y1 + r}V${y0}Z`;
  return `M${x},${y0}V${y1 - r}Q${x},${y1} ${x + r},${y1}H${x + w - r}Q${x + w},${y1} ${x + w},${y1 - r}V${y0}Z`;
}
function barChart(el, o) {
  if (!el) return;
  const H = o.height || 240, yfmt = o.yfmt || compact, vfmt = o.vfmt || (v => M(v));
  const L = o.labels;
  if (!L.length) { el.innerHTML = emptyState('chart', 'Sin datos', ''); return; }
  mount(el, animate => {
    const W = Math.max(280, el.clientWidth || 600);
    const pl = o.padLeft || 52, pr = 8, pt = 10, pb = 26;
    let ymin = 0, ymax = 0;
    if (o.stacked) L.forEach((_, i) => { let p = 0, n = 0; o.series.forEach(s => { const v = s.values[i] || 0; if (v >= 0) p += v; else n += v; }); ymax = Math.max(ymax, p); ymin = Math.min(ymin, n); });
    else o.series.forEach(s => s.values.forEach(v => { ymax = Math.max(ymax, v || 0); ymin = Math.min(ymin, v || 0); }));
    if (o.refLine != null) ymax = Math.max(ymax, o.refLine);
    const ticks = niceTicks(ymin, ymax || 1, H < 200 ? 3 : 4);
    const ylo = ticks[0], yhi = ticks[ticks.length - 1];
    const Y = v => pt + (1 - (v - ylo) / (yhi - ylo || 1)) * (H - pt - pb);
    const band = (W - pl - pr) / L.length;
    const groupN = o.stacked ? 1 : o.series.length;
    const bw = Math.max(3, Math.min(o.maxBar || 26, (band * 0.68 - (groupN - 1) * 2) / groupN));
    const gw = bw * groupN + (groupN - 1) * 2;
    let svg = `<svg viewBox="0 0 ${W} ${H}" height="${H}" role="img" aria-label="${esc(o.label || 'Gráfico de barras')}">`;
    ticks.forEach(t => { svg += `<line class="gridl" x1="${pl}" x2="${W - pr}" y1="${Y(t)}" y2="${Y(t)}"/><text class="ax yv" x="${pl - 8}" y="${Y(t) + 4}" text-anchor="end">${esc(yfmt(t))}</text>`; });
    const every = Math.ceil(L.length / Math.max(2, Math.floor((W - pl) / 54)));
    L.forEach((lab, i) => {
      const gx = pl + band * i + (band - gw) / 2;
      svg += `<g class="bg" data-i="${i}">`;
      if (o.stacked) {
        let pos = 0, neg = 0;
        o.series.forEach((s, si) => {
          const v = s.values[i] || 0; if (!v) return;
          const from = v >= 0 ? pos : neg; const to = from + v;
          const isTop = v >= 0 ? o.series.slice(si + 1).every(s2 => (s2.values[i] || 0) <= 0) : o.series.slice(si + 1).every(s2 => (s2.values[i] || 0) >= 0);
          const y0 = Y(from), y1 = Y(to);
          const gap = from !== 0 ? (v >= 0 ? -1 : 1) : 0;
          svg += `<path class="bar${v < 0 ? ' negb' : ''}" d="${isTop ? barPath(gx, y0 + gap, bw, y1, 4) : `M${gx},${y0 + gap}V${y1}H${gx + bw}V${y0 + gap}Z`}" style="fill:${s.color};${animate ? `animation-delay:${i * 18}ms` : 'animation:none'}"/>`;
          if (v >= 0) pos = to; else neg = to;
        });
      } else {
        o.series.forEach((s, si) => {
          const v = s.values[i] || 0;
          const color = typeof s.color === 'function' ? s.color(v, i) : s.color;
          const x = gx + si * (bw + 2);
          svg += `<path class="bar${v < 0 ? ' negb' : ''}" d="${barPath(x, Y(0), bw, Y(v), 4)}" style="fill:${color};${animate ? `animation-delay:${i * 18}ms` : 'animation:none'}"/>`;
        });
      }
      svg += `<rect class="hit" x="${pl + band * i}" y="${pt}" width="${band}" height="${H - pt - pb}"/></g>`;
      if (i % every === 0 || i === L.length - 1 && L.length < 14) svg += `<text class="ax" x="${pl + band * i + band / 2}" y="${H - 7}" text-anchor="middle">${esc(lab)}</text>`;
    });
    if (ylo < 0) svg += `<line class="base" x1="${pl}" x2="${W - pr}" y1="${Y(0)}" y2="${Y(0)}"/>`;
    else svg += `<line class="base" x1="${pl}" x2="${W - pr}" y1="${Y(ylo)}" y2="${Y(ylo)}"/>`;
    if (o.refLine != null) svg += `<line x1="${pl}" x2="${W - pr}" y1="${Y(o.refLine)}" y2="${Y(o.refLine)}" style="stroke:var(--ink-2);stroke-dasharray:4 4;stroke-width:1"/>`;
    svg += '</svg>';
    el.innerHTML = svg;
    el.querySelectorAll('.bg').forEach(g => {
      const i = +g.dataset.i;
      const show = ev => {
        el.classList.add('dim'); el.querySelectorAll('.bar.hl').forEach(b => b.classList.remove('hl')); g.querySelectorAll('.bar').forEach(b => b.classList.add('hl'));
        const rows = o.series.map(s => { const v = s.values[i] || 0; const c = typeof s.color === 'function' ? s.color(v, i) : s.color; return tipRow(c, s.name, vfmt(v, s)); }).join('');
        showTip(`<div class="tt">${o.tipTitle ? o.tipTitle(i) : esc(L[i])}</div>${rows}${o.tipExtra ? o.tipExtra(i) : ''}`, ev.clientX, ev.clientY);
      };
      g.addEventListener('pointermove', show); g.addEventListener('pointerdown', show);
      g.addEventListener('pointerleave', () => { el.classList.remove('dim'); g.querySelectorAll('.bar').forEach(b => b.classList.remove('hl')); hideTip(); });
      if (o.onClick) g.addEventListener('click', () => o.onClick(i));
    });
  });
}

/* ---------- donut ---------- */
function arcPath(cx, cy, r0, r1, a0, a1) {
  const large = a1 - a0 > Math.PI ? 1 : 0;
  const p = (r, a) => [cx + r * Math.sin(a), cy - r * Math.cos(a)];
  const [x0, y0] = p(r1, a0), [x1, y1] = p(r1, a1), [x2, y2] = p(r0, a1), [x3, y3] = p(r0, a0);
  return `M${x0},${y0}A${r1},${r1} 0 ${large} 1 ${x1},${y1}L${x2},${y2}A${r0},${r0} 0 ${large} 0 ${x3},${y3}Z`;
}
function donut(el, o) {
  if (!el) return;
  const items = o.items.filter(i => i.value > 0.004);
  const total = sum(items, i => i.value);
  const S0 = 200, cx = 100, cy = 100, r1 = 96, r0 = 96 - (o.thickness || 22);
  el.classList.add('donut');
  if (!total) { el.innerHTML = emptyState('pie', 'Sin datos', ''); return; }
  let a = 0; const gap = 2 / r1;
  let svg = `<svg viewBox="0 0 ${S0} ${S0}" role="img" aria-label="${esc(o.label || 'Distribución')}">`;
  items.forEach(it => {
    const span = it.value / total * Math.PI * 2;
    const a0 = a + (items.length > 1 ? gap / 2 : 0), a1 = a + span - (items.length > 1 ? gap / 2 : 0);
    const d = span >= Math.PI * 2 - 0.001 ? arcPath(cx, cy, r0, r1, 0, Math.PI * 2 - 0.0001) : arcPath(cx, cy, r0, r1, a0, Math.max(a0 + 0.001, a1));
    svg += `<path d="${d}" data-k="${esc(it.key)}" style="fill:${it.color}" class="${o.selected === it.key ? 'sel' : ''}" tabindex="0" role="button" aria-label="${esc(it.label)}"/>`;
    a += span;
  });
  const sel = items.find(i => i.key === o.selected);
  const cl = sel ? sel.label : (o.centerLabel || 'Total');
  const cv = sel ? sel.value : total;
  svg += `<text x="100" y="94" text-anchor="middle" style="fill:var(--muted);font-size:11px">${esc(cl.length > 22 ? cl.slice(0, 21) + '…' : cl)}</text>`;
  svg += `<text x="100" y="116" text-anchor="middle" class="amt donut-center" style="fill:var(--ink);font-size:${money(cv, { dec: 0 }).length > 9 ? 16 : 19}px;font-weight:500">${esc(money(cv, { dec: 0 }))}</text>`;
  if (sel) svg += `<text x="100" y="134" text-anchor="middle" style="fill:var(--ink-2);font-size:11px;font-family:var(--font-num)">${pct(sel.value / total)}</text>`;
  svg += '</svg>';
  el.innerHTML = svg;
  el.classList.toggle('has-sel', !!sel);
  el.querySelectorAll('path').forEach(p => {
    const it = items.find(i => String(i.key) === p.dataset.k);
    p.addEventListener('pointermove', ev => showTip(`<div class="tt">${esc(it.label)}</div>${tipRow(it.color, 'Importe', M(it.value))}${tipRow(it.color, 'Peso', pct(it.value / total))}`, ev.clientX, ev.clientY));
    p.addEventListener('pointerleave', hideTip);
    const pick = () => { hideTip(); o.onSelect && o.onSelect(o.selected === it.key ? null : it.key); };
    p.addEventListener('click', pick);
    p.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); } });
  });
}

/* ---------- sparkline ---------- */
function sparkline(vals, color, w = 64, h = 22) {
  const v = vals.filter(x => x != null);
  if (v.length < 2) return `<svg class="spark" viewBox="0 0 ${w} ${h}"></svg>`;
  const mn = Math.min(...v), mx = Math.max(...v), rg = mx - mn || 1;
  const pts = v.map((x, i) => [i / (v.length - 1) * (w - 4) + 2, h - 3 - (x - mn) / rg * (h - 6)]);
  const d = 'M' + pts.map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join('L');
  const lp = pts[pts.length - 1];
  return `<svg class="spark" viewBox="0 0 ${w} ${h}" aria-hidden="true"><path d="${d}" style="fill:none;stroke:${color};stroke-width:1.6;stroke-linejoin:round;stroke-linecap:round"/><circle cx="${lp[0]}" cy="${lp[1]}" r="2.2" style="fill:${color}"/></svg>`;
}

/* ---------- barras horizontales (HTML) ---------- */
function hbars(items, { total, max, kind = 'gasto', onClickAttr } = {}) {
  if (!items.length) return emptyState('pie', 'Sin gastos en este periodo', 'Registra un gasto para ver el reparto por categoría.');
  const mx = max || Math.max(...items.map(i => i.value)) || 1;
  const tot = total || sum(items, i => i.value) || 1;
  return `<div class="hbars">${items.map(it => `
    <div class="hbar"${onClickAttr ? ` ${onClickAttr(it)}` : ''}>
      <span class="n"><span class="cat-dot" style="background:${it.color}"></span>${esc(it.label)}</span>
      <div class="bar-track"><div class="bar-fill" style="width:${(it.value / mx * 100).toFixed(1)}%;background:${it.color}"></div></div>
      <span class="v">${M(it.value)}</span><span class="p">${pct(it.value / tot, 0)}</span>
    </div>`).join('')}</div>`;
}

/* ---------- anillo de progreso ---------- */
function ring(p, color, size = 56, stroke = 6) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r, v = clamp(p, 0, 1);
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true" style="flex:none"><circle cx="${size / 2}" cy="${size / 2}" r="${r}" style="fill:none;stroke:var(--surface-3);stroke-width:${stroke}"/><circle cx="${size / 2}" cy="${size / 2}" r="${r}" style="fill:none;stroke:${color};stroke-width:${stroke};stroke-linecap:round;stroke-dasharray:${c};stroke-dashoffset:${c * (1 - v)};transform:rotate(-90deg);transform-origin:center;transition:stroke-dashoffset .8s"/></svg>`;
}

function emptyState(icon, title, text, action) {
  return `<div class="empty"><div class="e-ic">${I(icon, 'lg')}</div><h4>${esc(title)}</h4>${text ? `<p>${esc(text)}</p>` : ''}${action || ''}</div>`;
}
function legend(items) {
  return `<div class="legend">${items.map(i => `<span><i class="${i.line ? 'line' : ''}${i.dash ? ' dash' : ''}" style="background:${i.color};${i.dash ? `border-color:${i.color}` : ''}"></i>${esc(i.label)}</span>`).join('')}</div>`;
}
