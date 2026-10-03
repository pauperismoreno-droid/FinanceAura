/* Patrimonia — importación de movimientos desde Excel (.xlsx, .xls, .ods) o CSV
   Lee TODAS las hojas en el navegador y reconoce dos formatos:
   · Lista de movimientos (una fila por movimiento), con títulos en cualquier fila.
   · Tabla por meses (conceptos en filas y meses en columnas), típica de los presupuestos.
   Nada se descarta en silencio: cada fila no importada aparece en la revisión con su motivo. */
'use strict';

const XLSX_SRC = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
const IMP_FIELDS = [
  { k: 'date', label: 'Fecha', kw: ['fecha', 'date', 'f valor', 'f operacion', 'fecha valor', 'fecha operacion', 'fecha contable', 'dia', 'day'] },
  { k: 'concept', label: 'Concepto', kw: ['concepto', 'descripcion', 'detalle', 'movimiento', 'description', 'nombre', 'comercio', 'establecimiento', 'gasto', 'item', 'articulo'] },
  { k: 'amount', label: 'Importe', kw: ['importe', 'cantidad', 'monto', 'amount', 'valor', 'euros', 'eur', 'precio', 'coste', 'costo', 'total'] },
  { k: 'debit', label: 'Cargo (salida)', kw: ['cargo', 'cargos', 'debe', 'salida', 'salidas', 'debito', 'retirada', 'pagos'] },
  { k: 'credit', label: 'Abono (entrada)', kw: ['abono', 'abonos', 'haber', 'entrada', 'entradas', 'credito', 'ingresado', 'cobros'] },
  { k: 'type', label: 'Tipo (gasto o ingreso)', kw: ['tipo', 'type', 'clase', 'naturaleza', 'ingreso gasto', 'ingreso/gasto'] },
  { k: 'sub', label: 'Subcategoría', kw: ['subcategoria', 'subcategory', 'sub categoria', 'subtipo'] },
  { k: 'category', label: 'Categoría', kw: ['categoria', 'category', 'rubro', 'partida', 'grupo', 'familia'] },
  { k: 'account', label: 'Cuenta', kw: ['cuenta', 'account', 'banco', 'tarjeta', 'entidad'] },
  { k: 'method', label: 'Método de pago', kw: ['metodo', 'forma de pago', 'medio de pago', 'metodo de pago', 'pagado con'] },
  { k: 'tags', label: 'Etiquetas', kw: ['etiquetas', 'etiqueta', 'tags', 'tag'] },
  { k: 'notes', label: 'Notas', kw: ['notas', 'nota', 'observaciones', 'comentario', 'comentarios', 'notes'] }
];
const MONTH_RE = [/^ene|^jan/, /^feb/, /^mar/, /^abr|^apr/, /^may/, /^jun/, /^jul/, /^ago|^aug/, /^sep|^set/, /^oct/, /^nov/, /^dic|^dec/];
const TOTAL_RE = /^(total|totales|subtotal|suma|sumas|saldo|balance|diferencia|neto|resultado|ahorro|media|promedio|acumulado)\b/;
const INCOME_RE = /ingreso|nomina|salario|sueldo|paga extra|cobro|devolucion|reembolso|dividendo|interes|abono|beneficio|venta|alquiler cobrado|freelance|factura emitida|pension|subsidio|prestacion|bizum recibido|transferencia recibida/;
const colLetter = i => { let s = ''; i++; while (i > 0) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; };
const isBlank = v => v == null || String(v).trim() === '';
const txt = v => isBlank(v) ? '' : String(v).trim();

/* ---------- CSV: separador ; , o tabulador, con comillas ---------- */
function parseCSV(text) {
  const lines = text.split(/\r?\n/).slice(0, 20);
  const delim = [';', ',', '\t', '|'].map(d => [d, lines.reduce((a, l) => a + (l.split(d).length - 1), 0)]).sort((a, b) => b[1] - a[1])[0][0];
  const rows = []; let row = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; }
    else if (ch === '"') q = true;
    else if (ch === delim) { row.push(cur.trim()); cur = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cur.trim()); rows.push(row); row = []; cur = ''; }
    else cur += ch;
  }
  row.push(cur.trim()); rows.push(row);
  while (rows.length && rows[rows.length - 1].every(isBlank)) rows.pop();
  return rows;
}

/* ---------- lectura de valores ---------- */
function monthOf(s) { const n = norm(s).replace(/[^a-z]/g, ''); if (n.length < 3) return 0; const i = MONTH_RE.findIndex(re => re.test(n)); return i + 1; }
/* etiqueta de mes: «Enero», «ene-26», «Septiembre 2026», «2026-01», «01/2026» o una fecha de Excel */
function parseMonthLabel(v) {
  if (isBlank(v)) return null;
  if (typeof v === 'number') { if (v > 20000 && v < 80000) { const d = D.fromMs(Date.UTC(1899, 11, 30) + Math.round(v) * 864e5); return { m: +d.slice(5, 7), y: +d.slice(0, 4) }; } return null; }
  const s = norm(v).trim();
  if (s.length > 22) return null;
  let m = s.match(/^(\d{4})[-/.](\d{1,2})$/); if (m && +m[2] >= 1 && +m[2] <= 12) return { m: +m[2], y: +m[1] };
  m = s.match(/^(\d{1,2})[-/.](\d{4})$/); if (m && +m[1] >= 1 && +m[1] <= 12) return { m: +m[1], y: +m[2] };
  m = s.match(/^([a-z]{3,11})\.?[\s\-/']*(?:de\s+)?(\d{2,4})?$/);
  if (m) { const mo = monthOf(m[1]); if (mo && (m[1].length <= 4 || MONTHS.some(x => norm(x) === m[1]) || /^(january|february|march|april|june|july|august|september|october|november|december|setiembre)$/.test(m[1]))) { let y = m[2] ? +m[2] : null; if (y && y < 100) y += 2000; return { m: mo, y }; } }
  return null;
}
function impDate(v, ctx = {}) {
  if (isBlank(v)) return null;
  if (typeof v === 'number') { if (v > 1 && v < 100000) return D.fromMs(Date.UTC(1899, 11, 30) + Math.round(v) * 864e5); return null; }
  if (v instanceof Date && !isNaN(v)) return `${v.getFullYear()}-${pad(v.getMonth() + 1)}-${pad(v.getDate())}`;
  const s = String(v).trim();
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  let y, mo, d;
  if (m) { y = +m[1]; mo = +m[2]; d = +m[3]; }
  else if ((m = s.match(/^(\d{1,2})[-/.](\d{1,2})(?:[-/.](\d{2,4}))?(?:\s|$|T)/))) {
    const us = S.settings.dateFormat === 'mm/dd/aaaa';
    d = +(us ? m[2] : m[1]); mo = +(us ? m[1] : m[2]); y = m[3] ? +m[3] : (ctx.y || +TODAY.slice(0, 4)); if (y < 100) y += 2000;
    if (mo > 12 && d <= 12) { const t = d; d = mo; mo = t; }
  } else if ((m = norm(s).match(/^(?:[a-z]+,?\s+)?(\d{1,2})\s*(?:de\s+|[-/.\s])?\s*([a-z]{3,11})\.?\s*(?:de\s+|[-/.\s])?\s*(\d{2,4})?/))) {
    d = +m[1]; mo = monthOf(m[2]); y = m[3] ? +m[3] : (ctx.y || +TODAY.slice(0, 4)); if (y < 100) y += 2000;
    if (!mo) return null;
  } else if ((m = norm(s).match(/^([a-z]{3,11})\.?\s+(\d{1,2}),?\s+(\d{4})/))) { mo = monthOf(m[1]); d = +m[2]; y = +m[3]; if (!mo) return null; }
  else return null;
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || y < 1950 || y > 2100) return null;
  const iso = `${y}-${pad(mo)}-${pad(d)}`;
  return d <= D.dim(iso.slice(0, 7)) ? iso : null;
}
function impAmount(v) {
  if (isBlank(v)) return NaN;
  if (typeof v === 'number') return isFinite(v) ? v : NaN;
  if (typeof v === 'boolean') return NaN;
  let s = String(v).trim();
  if (!/\d/.test(s)) return NaN;
  if (/^[^\d\-−(+]*[a-z]{4,}/i.test(norm(s)) && !/^(eur|usd|gbp)/i.test(s)) return NaN; // texto con números (p. ej. «Factura 23»)
  const neg = /^\(.*\)$/.test(s) || /^[^\d]*[-−]/.test(s) || /[-−]\s*(€|eur)?$/i.test(s) || /\bdr\b|\bdeb/i.test(s);
  s = s.replace(/[^\d,.]/g, '');
  if (!s) return NaN;
  const lc = s.lastIndexOf(','), ld = s.lastIndexOf('.');
  if (lc > ld) s = s.replace(/\./g, '').replace(',', '.');
  else if (lc === -1 && /^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
  else s = s.replace(/,/g, '');
  const n = parseFloat(s);
  return isNaN(n) ? NaN : neg ? -Math.abs(n) : n;
}
function impType(v) {
  const s = norm(v);
  if (!s) return null;
  if (/^(g|gasto|gastos|cargo|debito|salida|pago|expense|compra|e)$/.test(s) || /gasto|cargo|debito|salida|expense/.test(s)) return 'gasto';
  if (/^(i|ingreso|ingresos|abono|credito|entrada|cobro|income)$/.test(s) || /ingreso|abono|credito|entrada|cobro|income/.test(s)) return 'ingreso';
  return null;
}
const isNumericCell = v => typeof v === 'number' || (!isBlank(v) && !isNaN(impAmount(v)) && !/[a-z]{3,}/i.test(norm(v).replace(/eur/g, '')));

/* subcategoría a partir del concepto; vacía si no hay pista */
const SUB_HINTS = [[/\bluz\b|electric|endesa|iberdrola|naturgy|holaluz/, 'Electricidad'], [/\bagua\b|canal de isabel/, 'Agua'], [/\bgas\b|butano/, 'Gas'], [/internet|fibra|movil|telefon|movistar|vodafone|orange|digi|jazztel|yoigo/, 'Internet'], [/alquiler/, 'Alquiler'], [/hipoteca/, 'Hipoteca'], [/comunidad/, 'Comunidad'], [/gasolin|combustible|repsol|cepsa|galp|bp\b|shell|diesel/, 'Combustible'], [/parking|aparcamiento|zona azul|ora\b/, 'Parking'], [/metro|autobus|renfe|cercanias|abono transporte|taxi|uber|cabify|bus\b/, 'Transporte público'], [/seguro coche|seguro del coche|mutua|mapfre|linea directa/, 'Seguro'], [/taller|itv|neumatic/, 'Mantenimiento'], [/farmacia/, 'Farmacia'], [/dentista|dental/, 'Dentista'], [/medico|clinica|hospital/, 'Médico'], [/sanitas|adeslas|dkv|asisa|seguro medico|seguro de salud/, 'Seguro médico'], [/netflix|spotify|hbo|max\b|disney|prime video|amazon prime|youtube premium|apple|icloud|suscripcion/, 'Suscripciones'], [/cine/, 'Cine'], [/viaje|hotel|vuelo|ryanair|vueling|iberia|booking|airbnb/, 'Viajes'], [/gimnasio|gym|padel|deporte/, 'Actividades'], [/glovo|just eat|uber eats|deliveroo|telepizza|a domicilio/, 'Comida a domicilio'], [/restaurante|cena|comida|bar\b|tapas|menu/, 'Restaurantes'], [/cafe|cafeteria|starbucks/, 'Cafés'], [/supermercado|mercadona|carrefour|lidl|\bdia\b|aldi|eroski|alcampo|consum|hipercor|ahorramas|bonpreu|mercado|fruteria|carniceria|panaderia/, 'Supermercado'], [/zara|primark|ropa|calzado|zapat|h&m|mango|decathlon/, 'Ropa'], [/amazon|mediamarkt|fnac|pccomponentes|tecnolog/, 'Tecnología'], [/ikea|leroy|bricolaje|hogar/, 'Hogar'], [/comision/, 'Comisiones'], [/impuesto|hacienda|irpf|ibi\b|agencia tributaria/, 'Impuestos'], [/libro|libreria/, 'Libros'], [/curso|academia|matricula|formacion/, 'Cursos']];
function guessSub(c, concept) {
  const n = norm(concept);
  if (!n) return '';
  const direct = c.subs.find(s => n.includes(norm(s)));
  if (direct) return direct;
  const hint = SUB_HINTS.find(([re, s]) => re.test(n) && c.subs.includes(s));
  if (hint) return hint[1];
  const g = guessFromConcept(concept, 'gasto');
  return g && g.category === c.name && g.sub ? g.sub : '';
}

/* ---------- análisis de cada hoja ---------- */
function guessHeaderRow(rows) {
  const all = IMP_FIELDS.flatMap(f => f.kw);
  let best = -1, bestHits = 1;
  for (let i = 0; i < Math.min(25, rows.length); i++) {
    const hits = (rows[i] || []).filter(c => typeof c === 'string' && all.some(k => { const h = norm(c).replace(/[^a-z0-9 /]/g, ' ').trim(); return h === k || h.startsWith(k + ' ') || h.includes(k); })).length;
    if (hits > bestHits) { best = i; bestHits = hits; }
  }
  return best;
}
function guessMap(header, rows) {
  const map = {}; const used = new Set();
  const H = header.map(h => norm(h).replace(/[^a-z0-9 /]/g, ' ').replace(/\s+/g, ' ').trim());
  IMP_FIELDS.forEach(f => {
    let best = -1;
    H.forEach((h, i) => { if (best === -1 && !used.has(i) && h && f.kw.includes(h)) best = i; });
    if (best === -1) H.forEach((h, i) => { if (best !== -1 || used.has(i) || !h) return; if (f.kw.some(k => h.startsWith(k) || (k.length > 4 && h.includes(k)))) best = i; });
    if (best !== -1) { map[f.k] = best; used.add(best); }
  });
  if (map.amount != null && (map.debit != null || map.credit != null)) { delete map.debit; delete map.credit; }
  // sin títulos reconocibles: deducir por el contenido de las columnas
  const body = rows.slice(0, 200);
  const ncol = Math.max(0, ...body.map(r => r.length));
  const stat = Array.from({ length: ncol }, (_, c) => {
    let dates = 0, nums = 0, texts = 0;
    body.forEach(r => { const v = r[c]; if (isBlank(v)) return; if (typeof v === 'number' ? (v > 30000 && v < 60000 && Number.isInteger(v)) : (String(v).trim().length >= 6 && impDate(v))) dates++; else if (isNumericCell(v)) nums++; else texts++; });
    return { c, dates, nums, texts };
  });
  if (map.date == null) { const s = stat.filter(x => !used.has(x.c) && x.dates > 0).sort((a, b) => b.dates - a.dates)[0]; if (s) { map.date = s.c; used.add(s.c); } }
  if (map.amount == null && map.debit == null && map.credit == null) { const s = stat.filter(x => !used.has(x.c) && x.nums > 0).sort((a, b) => b.nums - a.nums)[0]; if (s) { map.amount = s.c; used.add(s.c); } }
  // columnas de texto: tipo (gasto/ingreso), cuenta (pocos valores tipo banco/efectivo), categoría (valores repetidos) y concepto (el más variado)
  const textCols = stat.filter(x => !used.has(x.c) && x.texts > 0).map(x => {
    const vals = body.map(r => txt(r[x.c])).filter(Boolean);
    const distinct = new Set(vals.map(norm));
    return { c: x.c, n: vals.length, distinct: distinct.size, typeHits: vals.filter(v => impType(v)).length, accHits: vals.filter(v => /^(efectivo|banco|cuenta|caja|metalico|tarjeta|bizum|cash)/.test(norm(v)) || S.accounts.some(a => norm(a.name) === norm(v))).length };
  });
  const take = (k, pick) => { if (map[k] != null) return; const s = textCols.filter(x => !used.has(x.c)).filter(pick).sort((a, b) => a.distinct - b.distinct)[0]; if (s) { map[k] = s.c; used.add(s.c); } };
  take('type', x => x.typeHits >= x.n * 0.8 && x.distinct <= 4);
  take('account', x => x.accHits >= x.n * 0.6 && x.distinct <= 8);
  if (map.concept == null) { const s = textCols.filter(x => !used.has(x.c)).sort((a, b) => b.distinct - a.distinct)[0]; if (s) { map.concept = s.c; used.add(s.c); } }
  take('category', x => x.distinct <= Math.max(3, x.n * 0.5));
  // una columna «Método/Medio» con valores Banco/Efectivo es en realidad la cuenta
  if (map.account == null && map.method != null) {
    const vals = body.map(r => norm(r[map.method])).filter(Boolean);
    if (vals.length && vals.filter(v => /banco|cuenta|efectivo|caja/.test(v) || S.accounts.some(a => norm(a.name) === v)).length >= vals.length * 0.6) { map.account = map.method; delete map.method; }
  }
  return map;
}
const SUMMARY_NAME_RE = /resumen|panel|dashboard|summary|informe|totales|grafico|estadistic|indicadores|categor|presupuesto anual/;

/* ---------- hoja de patrimonio ----------
   Busca tablas cuya primera columna es «Mes»: la principal tiene columnas de cuentas y clases de activo
   (Banco, Efectivo, Fondos, Renta fija, Criptos…); otra opcional desglosa los fondos (Indie, MSCI World,
   Aportaciones, Ajustes, Total fondos). Una tabla «Producto | Capital | Tipo interés | Vencimiento»
   aporta los datos de los bonos. */
function patColClass(h) {
  const n = norm(h).trim();
  if (!n) return null;
  if (/^(total fondos?|total)$/.test(n)) return 'total';
  if (/variacion|^var\b|^%|diferencia|rentabilidad/.test(n)) return 'skip';
  if (/aportacion/.test(n)) return 'aport';
  if (/ajuste|sin desglose/.test(n)) return 'ajuste';
  if (/fondo/.test(n)) return 'fondos';
  if (/renta fija|bono|letra|deposito|plazo fijo/.test(n)) return 'rf';
  if (/cripto|bitcoin|btc|ethereum/.test(n)) return 'cripto';
  if (/accion|bolsa|etf|broker/.test(n)) return 'acciones';
  if (/inmueble|vivienda|piso|casa|coche|vehiculo|moto/.test(n)) return 'bien';
  if (/hipoteca|prestamo|deuda|credito|tarjeta de credito/.test(n)) return 'deuda';
  if (/banco|cuenta|efectivo|caja|ahorro|metalico|monedero|nomina/.test(n) || (S && S.accounts.some(a => norm(a.name) === n))) return 'cuenta';
  return 'item';
}
function parsePatrimonio(rows) {
  const tables = [], products = [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i] || []; const fi = r.findIndex(c => !isBlank(c)); if (fi < 0) continue;
    const first = norm(r[fi]).trim();
    if (/^(mes|meses|periodo|month)$/.test(first) && r.filter(c => !isBlank(c)).length >= 3) {
      const cols = []; r.forEach((c, j) => { if (j > fi && !isBlank(c)) cols.push({ j, name: txt(c), cls: patColClass(c) }); });
      const body = [];
      for (let k = i + 1; k < rows.length; k++) {
        const b = rows[k] || []; if (b.every(isBlank)) break;
        const ml = parseMonthLabel(b[fi]); if (!ml) break;
        body.push({ ml, line: k + 1, vals: Object.fromEntries(cols.map(c => [c.j, impAmount(b[c.j])])) });
      }
      if (body.length) tables.push({ start: fi, cols, body });
    } else if (/^(producto|activo|inversion|nombre|bono)$/.test(first) && r.some(c => /capital|importe|nominal|valor/.test(norm(c)))) {
      const head = r.map(c => norm(c));
      const ci = k => head.findIndex(h => k.test(h));
      const cName = fi, cCap = ci(/capital|importe|nominal|valor/), cRate = ci(/interes|tipo|cupon|tae|tin/), cMat = ci(/vencimiento|fecha fin|hasta/);
      for (let k = i + 1; k < rows.length; k++) {
        const b = rows[k] || []; if (b.every(isBlank) || isBlank(b[cName])) break;
        let rate = cRate >= 0 ? b[cRate] : null; rate = typeof rate === 'number' ? (rate < 1 ? rate * 100 : rate) : impAmount(rate);
        if (!isNaN(rate) && rate != null) rate = Math.round(rate * 10000) / 10000;
        products.push({ name: txt(b[cName]), capital: cCap >= 0 ? impAmount(b[cCap]) : NaN, rate: isNaN(rate) ? null : rate, maturity: cMat >= 0 ? impDate(b[cMat]) : null, line: k + 1 });
      }
    }
  }
  const main = tables.find(t => t.cols.some(c => c.cls === 'cuenta') && t.cols.filter(c => ['cuenta', 'fondos', 'rf', 'cripto', 'acciones', 'bien', 'deuda', 'item'].includes(c.cls)).length >= 2);
  if (!main) return null;
  const detail = tables.find(t => t !== main && t.cols.some(c => c.cls === 'item') && t.cols.some(c => ['total', 'aport', 'ajuste'].includes(c.cls)));
  const totalCol = main.cols.find(c => c.cls === 'total');
  const valCols = main.cols.filter(c => !['total', 'skip'].includes(c.cls));
  // un mes cuenta si tiene total o al menos la mitad de las columnas con valor
  const rowsOut = [], partial = [];
  main.body.forEach(b => {
    const filledN = valCols.filter(c => !isNaN(b.vals[c.j])).length;
    const complete = totalCol ? !isNaN(b.vals[totalCol.j]) : filledN >= Math.ceil(valCols.length / 2);
    if (complete) rowsOut.push({ m: b.ml.m, y: b.ml.y, line: b.line, vals: b.vals, total: totalCol ? b.vals[totalCol.j] : null });
    else if (filledN) partial.push({ m: b.ml.m, line: b.line, text: valCols.filter(c => !isNaN(b.vals[c.j])).map(c => `${c.name}: ${money(b.vals[c.j])}`).join(' · ') });
  });
  if (!rowsOut.length) return null;
  const det = detail ? {
    funds: detail.cols.filter(c => c.cls === 'item' || c.cls === 'fondos').map(c => ({ j: c.j, name: c.name })),
    aport: detail.cols.find(c => c.cls === 'aport'), ajuste: detail.cols.find(c => c.cls === 'ajuste'), total: detail.cols.find(c => c.cls === 'total'),
    byMonth: Object.fromEntries(detail.body.map(b => [b.ml.m, b]))
  } : null;
  return { main, rows: rowsOut, partial, valCols, det, products };
}

function analyzeSheet(name, rows) {
  const sh = { name, rows, include: true, layout: 'rows', headerRow: -1, map: {}, labelCol: 0, monthCols: [], year: null, sign: 'auto', day: 1, sheetMonth: parseMonthLabel(name) || (() => { const m = norm(name).match(/([a-z]{3,11})\D*(\d{4})?/); return m && monthOf(m[1]) ? { m: monthOf(m[1]), y: m[2] ? +m[2] : null } : null; })() };
  const filled = rows.filter(r => r && r.some(c => !isBlank(c)));
  if (filled.length < 1 || !rows.some(r => r && r.some(isNumericCell))) { sh.include = false; sh.layout = 'empty'; return sh; }
  // hojas de resumen, panel o totales por categoría: sus cifras salen de los movimientos
  if (SUMMARY_NAME_RE.test(norm(name))) { sh.include = false; sh.layout = 'summary'; return sh; }
  // ¿hoja de patrimonio? (tabla «Mes | Banco | Efectivo | Fondos…» con saldos de cada mes)
  const pat = parsePatrimonio(rows);
  if (pat) { sh.layout = 'patrimonio'; sh.pat = pat; sh.year = (pat.rows.find(r => r.y) || {}).y || +TODAY.slice(0, 4); return sh; }
  // ¿tabla por meses? buscar una fila con 3 o más meses
  for (let i = 0; i < Math.min(30, rows.length); i++) {
    const r = rows[i] || [];
    const mc = []; r.forEach((c, j) => { const ml = parseMonthLabel(c); if (ml) mc.push({ col: j, m: ml.m, y: ml.y }); });
    if (mc.length >= 3) {
      const below = rows.slice(i + 1).filter(x => x && mc.some(m => isNumericCell(x[m.col])));
      if (below.length) {
        sh.layout = 'wide'; sh.headerRow = i; sh.monthCols = mc;
        const firstCol = Math.min(...mc.map(m => m.col));
        let bestC = 0, bestN = -1;
        for (let c = 0; c < firstCol; c++) { const n = rows.slice(i + 1).filter(x => x && typeof x[c] === 'string' && x[c].trim()).length; if (n > bestN) { bestN = n; bestC = c; } }
        sh.labelCol = bestC;
        sh.year = mc.find(m => m.y) ? mc.find(m => m.y).y : (sh.sheetMonth && sh.sheetMonth.y) || +TODAY.slice(0, 4);
        return sh;
      }
    }
  }
  sh.headerRow = guessHeaderRow(rows);
  const header = sh.headerRow >= 0 ? rows[sh.headerRow] : [];
  sh.map = guessMap(header || [], rows.slice(sh.headerRow + 1));
  // hojas de resumen o panel: sus cifras salen de los movimientos, importarlas los duplicaría
  const firstCells = filled.map(r => r.find(c => !isBlank(c)));
  const monthRows = firstCells.filter(c => typeof c === 'string' && parseMonthLabel(c)).length;
  const dated = sh.map.date != null && rows.slice(sh.headerRow + 1).filter(r => r && impDate(r[sh.map.date])).length;
  if (monthRows >= 3 || (!dated && !sh.sheetMonth)) {
    sh.include = false; sh.layout = 'summary';
  }
  return sh;
}

/* ---------- conversión a movimientos ---------- */
function newPending() { return { acc: new Map(), cat: new Map(), inc: new Set(), subs: new Map(), tags: new Set() }; }
function resolveCategory(type, catTxt, subTxt, concept, ctxCat, o, P) {
  let category, sub = '';
  const natureOf = n => /ocio|regalo|viaje|suscrip|ropa|fiesta|juego|capricho|restaurante|bar|alcohol|tabaco|vacacion/.test(norm(n)) ? 'ocio' : 'necesidad';
  if (type === 'gasto') {
    const findCat = t => t && (S.categories.find(x => norm(x.name) === norm(t)) || P.cat.get(norm(t)));
    let c = findCat(catTxt);
    // la categoría escrita en el Excel se respeta tal cual (se crea si no existe)
    if (!c && catTxt && o.createCat) { const nc = { id: uid('c'), name: cap(catTxt), icon: 'tag', nature: natureOf(catTxt), subs: [], ocioSubs: [] }; P.cat.set(norm(catTxt), nc); c = nc; }
    if (!c && catTxt) { const bySub = S.categories.find(x => x.subs.some(s => norm(s) === norm(catTxt))); if (bySub) { c = bySub; sub = bySub.subs.find(s => norm(s) === norm(catTxt)); } }
    if (!c && subTxt) { const bySub = S.categories.find(x => x.subs.some(s => norm(s) === norm(subTxt))); if (bySub) c = bySub; }
    if (!c && catTxt && o.createCat) { const nc = { id: uid('c'), name: cap(catTxt), icon: 'tag', nature: 'necesidad', subs: [], ocioSubs: [] }; P.cat.set(norm(catTxt), nc); c = nc; }
    if (!c && ctxCat) { c = findCat(ctxCat); if (!c) { const bySub = S.categories.find(x => x.subs.some(s => norm(s) === norm(ctxCat))); if (bySub) { c = bySub; sub = bySub.subs.find(s => norm(s) === norm(ctxCat)); } } if (!c && o.createCat) { const nc = { id: uid('c'), name: cap(ctxCat), icon: 'tag', nature: 'necesidad', subs: [], ocioSubs: [] }; P.cat.set(norm(ctxCat), nc); c = nc; } }
    if (!c && concept) { const bySub = S.categories.find(x => x.subs.some(s => norm(s) === norm(concept))); if (bySub) { c = bySub; sub = bySub.subs.find(s => norm(s) === norm(concept)); } }
    if (!c && concept) { const g = guessFromConcept(concept, 'gasto'); if (g) { c = S.categories.find(x => x.name === g.category); sub = g.sub || ''; } }
    if (!c && concept) { const h = SUB_HINTS.find(([re]) => re.test(norm(concept))); if (h) { c = S.categories.find(x => x.subs.includes(h[1])); if (c) sub = h[1]; } }
    if (!c) c = S.categories.find(x => x.name === 'Otros') || S.categories[S.categories.length - 1];
    category = c.name;
    if (subTxt && !sub) {
      const hit = c.subs.find(s => norm(s) === norm(subTxt));
      if (hit) sub = hit; else if (o.createCat) { sub = subTxt; const set = P.subs.get(c.name) || new Set(); set.add(subTxt); P.subs.set(c.name, set); }
    }
    if (!sub) sub = guessSub(c, concept);
  } else {
    const t = catTxt || ctxCat;
    const c = t && S.incomeCategories.find(x => norm(x.name) === norm(t));
    if (c) category = c.name;
    else if (catTxt && o.createCat && !/^ingresos?$/.test(norm(catTxt))) { category = cap(catTxt); P.inc.add(category); }
    else {
      const n = norm(`${concept} ${t || ''}`);
      category = /nomina|salario|sueldo/.test(n) ? 'Salario' : /paga extra/.test(n) ? 'Pagas extra' : /dividend/.test(n) ? 'Dividendos' : /interes|cupon/.test(n) ? 'Intereses' : /freelance|factura|autonomo|extra\b|clases/.test(n) ? 'Trabajos adicionales' : (guessFromConcept(concept, 'ingreso') || {}).category || null;
      if (!category && catTxt && o.createCat && !/^ingresos?$/.test(norm(catTxt))) { category = cap(catTxt); P.inc.add(category); }
      if (!category) category = 'Otros ingresos';
    }
  }
  return { category, sub };
}
function sectionOf(text) {
  const n = norm(text).replace(/[^a-z ]/g, ' ').trim();
  if (!n) return {};
  if (/^(ingresos?|entradas|cobros|income)( |$)/.test(n)) return { type: 'ingreso' };
  if (/^(gastos?|salidas|pagos|egresos|expenses?)( |$)/.test(n)) return { type: 'gasto', cat: n.replace(/^(gastos?|salidas|pagos|egresos|expenses?)\s*(de|del|en)?\s*/, '') || null };
  const ml = parseMonthLabel(text); if (ml) return { month: ml };
  return { cat: String(text).trim() };
}

function buildImport(st) {
  const o = st.opts;
  const out = { items: [], errors: [], totals: [], perSheet: [], pats: [], P: newPending(), dups: 0 };
  const existing = new Set(S.tx.map(t => `${t.date}|${round2(t.amount)}|${t.type}|${norm(t.concept)}`));
  const P = out.P;
  const push = (sh, line, tx, accLabel, flags = {}) => {
    const dup = existing.has(`${tx.date}|${tx.amount}|${tx.type}|${norm(tx.concept)}`);
    if (dup) out.dups++;
    out.items.push({ tx, dup, line, sheet: sh.name, accLabel, fallbackDate: !!flags.fallbackDate });
  };
  const accountFor = (accTxt, date) => {
    let account = o.defAcc, accLabel = accName(o.defAcc);
    if (accTxt) {
      const a = S.accounts.find(x => norm(x.name) === norm(accTxt));
      if (a) { account = a.id; accLabel = a.name; }
      else if (o.createAcc) { const key = norm(accTxt); if (!P.acc.has(key)) P.acc.set(key, { id: uid('a'), name: accTxt, type: /efectivo|cash|metalico/.test(key) ? 'efectivo' : 'corriente', institution: '', initial: 0, openDate: date }); const na = P.acc.get(key); if (date < na.openDate) na.openDate = date; account = na.id; accLabel = accTxt + ' (nueva)'; }
    }
    return { account, accLabel };
  };
  const decideType = (explicit, amt, ctxType, sh, text) => {
    if (explicit) return explicit;
    if (sh.sign === 'gastos') return 'gasto';
    if (sh.sign === 'ingresos') return 'ingreso';
    if (sh.sign === 'signo') return amt < 0 ? 'gasto' : 'ingreso';
    if (amt < 0) return 'gasto';
    if (ctxType) return ctxType;
    if (sh.hasNeg && !sh.allNegIsExpenseOnly) return 'ingreso';
    return INCOME_RE.test(norm(text)) ? 'ingreso' : 'gasto';
  };

  st.sheets.forEach(sh => {
    const before = out.items.length, errBefore = out.errors.length, totBefore = out.totals.length;
    if (!sh.include || sh.layout === 'empty' || sh.layout === 'summary') { out.perSheet.push({ sh, n: 0, err: 0, tot: 0 }); return; }
    if (sh.layout === 'patrimonio') {
      out.pats.push(sh);
      sh.pat.partial.forEach(p => out.errors.push({ sheet: sh.name, line: p.line, msg: `${cap(MONTHS[p.m - 1])} está incompleto: no se usa como saldo`, text: p.text }));
      out.perSheet.push({ sh, n: sh.pat.rows.length, err: sh.pat.partial.length, tot: 0 });
      return;
    }
    const ctx = { type: null, cat: null, month: sh.sheetMonth, lastDate: null };
    if (sh.layout === 'wide') {
      const monthCols = sh.monthCols.filter(m => m.col !== sh.labelCol);
      for (let i = sh.headerRow + 1; i < sh.rows.length; i++) {
        const r = sh.rows[i] || []; const line = i + 1;
        if (r.every(isBlank)) continue;
        const label = txt(r[sh.labelCol]) || r.slice(0, Math.min(...monthCols.map(m => m.col))).map(txt).filter(Boolean).join(' ');
        const nums = monthCols.filter(m => !isNaN(impAmount(r[m.col])) && impAmount(r[m.col]) !== 0);
        if (!nums.length) {
          const textCells = r.map(txt).filter(Boolean);
          if (textCells.length) { const sec = sectionOf(textCells[0]); if (sec.type) { ctx.type = sec.type; ctx.cat = sec.cat || null; } else if (sec.cat) ctx.cat = sec.cat; }
          continue;
        }
        if (TOTAL_RE.test(norm(label)) && !o.includeTotals) { out.totals.push({ sheet: sh.name, line, text: label, amount: sum(nums, m => impAmount(r[m.col])) }); continue; }
        // columnas extra (no son meses ni la etiqueta) van a las notas
        const hdr = sh.rows[sh.headerRow] || [];
        const extra = r.map((c, j) => j !== sh.labelCol && !monthCols.some(m => m.col === j) && !isBlank(c) && !TOTAL_RE.test(norm(hdr[j])) && !/^(anual|ano|year|media|promedio)$/.test(norm(hdr[j])) && !(isNumericCell(c) && j > Math.max(...monthCols.map(m => m.col))) ? `${txt(hdr[j]) || 'Col. ' + colLetter(j)}: ${typeof c === 'number' ? numFmt(c) : txt(c)}` : '').filter(Boolean);
        nums.forEach(m => {
          const amt = impAmount(r[m.col]);
          const y = m.y || sh.year || +TODAY.slice(0, 4);
          const ym = `${y}-${pad(m.m)}`;
          const date = sh.day === 'end' ? D.monthEnd(ym) : `${ym}-01`;
          const type = decideType(null, amt, ctx.type, sh, `${label} ${ctx.cat || ''}`);
          const { category, sub } = resolveCategory(type, '', '', label, ctx.cat, o, P);
          const { account, accLabel } = accountFor('', date);
          const tx = { id: uid('t'), type, date, amount: round2(Math.abs(amt)), concept: label || category, category, account, notes: extra.join(' · '), recurring: false, imported: true };
          if (type === 'gasto') Object.assign(tx, { sub, method: '', tags: [] });
          push(sh, line, tx, accLabel);
        });
      }
    } else {
      const mp = sh.map;
      const cell = (r, k) => mp[k] == null ? '' : r[mp[k]];
      const header = sh.headerRow >= 0 ? (sh.rows[sh.headerRow] || []) : [];
      const usedCols = new Set(Object.values(mp));
      const hasAmountCol = mp.amount != null || mp.debit != null || mp.credit != null;
      for (let i = sh.headerRow + 1; i < sh.rows.length; i++) {
        const r = sh.rows[i] || []; const line = i + 1;
        if (r.every(isBlank)) continue;
        const textCells = r.map(txt).filter(Boolean);
        let amt = NaN, explicit = null;
        if (mp.amount != null) amt = impAmount(cell(r, 'amount'));
        else {
          const de = impAmount(cell(r, 'debit')), cr = impAmount(cell(r, 'credit'));
          if (!isNaN(de) && de !== 0) { amt = -Math.abs(de); explicit = 'gasto'; }
          else if (!isNaN(cr) && cr !== 0) { amt = Math.abs(cr); explicit = 'ingreso'; }
        }
        const rawDate = cell(r, 'date');
        const conceptRaw = txt(cell(r, 'concept'));
        // fila de sección («Gastos», «Vivienda», «Enero 2026»…): da contexto a las siguientes
        if (isNaN(amt) && textCells.length === 1 && !impDate(rawDate, {})) {
          const sec = sectionOf(textCells[0]);
          if (sec.type) { ctx.type = sec.type; ctx.cat = sec.cat || null; }
          else if (sec.month) { ctx.month = { m: sec.month.m, y: sec.month.y || (ctx.month && ctx.month.y) || sh.year }; ctx.lastDate = null; }
          else if (sec.cat) ctx.cat = sec.cat;
          continue;
        }
        const rowText = norm(textCells.filter(t => !isNumericCell(t)).join(' '));
        if (TOTAL_RE.test(norm(conceptRaw) || rowText) && !o.includeTotals && (!conceptRaw || TOTAL_RE.test(norm(conceptRaw)))) { out.totals.push({ sheet: sh.name, line, text: textCells.join(' · ').slice(0, 80), amount: isNaN(amt) ? null : amt }); continue; }
        if (!hasAmountCol) { out.errors.push({ sheet: sh.name, line, msg: 'no hay columna de importe elegida', text: textCells.join(' · ').slice(0, 90) }); continue; }
        if (isNaN(amt) || amt === 0) { out.errors.push({ sheet: sh.name, line, msg: isNaN(amt) ? 'sin importe numérico' : 'importe cero', text: textCells.join(' · ').slice(0, 90) }); continue; }
        // fecha: la de la fila, la anterior, la del mes de la sección u hoja, o la fecha por defecto
        const ctxY = (ctx.month && ctx.month.y) || sh.year || (ctx.lastDate ? +ctx.lastDate.slice(0, 4) : null) || +TODAY.slice(0, 4);
        let date = impDate(rawDate, { y: ctxY }), fallbackDate = false;
        const badDate = !date && !isBlank(rawDate); // fecha escrita de forma que no se entiende: se conserva en las notas
        if (!date && isBlank(rawDate) && ctx.lastDate && o.carryDate) date = ctx.lastDate;
        if (!date && ctx.month) date = `${ctx.month.y || ctxY}-${pad(ctx.month.m)}-01`;
        if (!date) { date = o.fallbackDate; fallbackDate = true; }
        else if (!badDate) ctx.lastDate = date;
        if (badDate) fallbackDate = true;
        if (!explicit) explicit = impType(cell(r, 'type'));
        const catTxt = txt(cell(r, 'category')), subTxt = txt(cell(r, 'sub'));
        const type = decideType(explicit, amt, ctx.type, sh, `${conceptRaw} ${catTxt}`);
        const { account, accLabel } = accountFor(txt(cell(r, 'account')), date);
        const { category, sub } = resolveCategory(type, catTxt, subTxt, conceptRaw, ctx.cat, o, P);
        const methodTxt = norm(cell(r, 'method'));
        const accObj = S.accounts.find(a => a.id === account) || [...P.acc.values()].find(a => a.id === account);
        const method = METHODS.find(m => methodTxt && norm(m).startsWith(methodTxt.slice(0, 5))) || (type === 'gasto' && accObj && accObj.type === 'efectivo' ? 'Efectivo' : '');
        const tags = txt(cell(r, 'tags')).split(/[,;#\s]+/).map(x => x.trim().toLowerCase()).filter(Boolean);
        // «Gasto» con importe positivo (o «Ingreso» negativo) en una hoja que usa signos: se respeta el signo para que los totales cuadren con el Excel
        const typeFromCol = mp.type != null && impType(cell(r, 'type'));
        const flip = !!typeFromCol && sh.hasNeg && ((type === 'gasto' && amt > 0) || (type === 'ingreso' && amt < 0));
        if ((fallbackDate || flip) && !tags.includes('revisar')) tags.push('revisar');
        tags.forEach(t => { if (!S.tags.includes(t)) P.tags.add(t); });
        // todo lo que no tiene columna asignada se guarda en las notas
        const extras = r.map((c, j) => !usedCols.has(j) && !isBlank(c) ? `${txt(header[j]) || 'Col. ' + colLetter(j)}: ${typeof c === 'number' && !Number.isInteger(c) ? String(c).replace('.', ',') : txt(c)}` : '').filter(Boolean);
        if (methodTxt && !METHODS.some(m => norm(m).startsWith(methodTxt.slice(0, 5)))) extras.unshift(`Pago: ${txt(cell(r, 'method'))}`);
        if (badDate) extras.unshift(`Fecha original: ${txt(rawDate)}`);
        if (flip) extras.unshift(`En el Excel: ${txt(cell(r, 'type'))} con importe ${money(amt, { sign: true })} (resta del total de ${type === 'gasto' ? 'gastos' : 'ingresos'})`);
        const notes = [txt(cell(r, 'notes'))].concat(extras).filter(Boolean).join(' · ');
        const concept = conceptRaw || txt(cell(r, 'category')) || textCells.find(t => !isNumericCell(t) && t !== txt(rawDate)) || category || 'Movimiento importado';
        const tx = { id: uid('t'), type, date, amount: flip ? -round2(Math.abs(amt)) : round2(Math.abs(amt)), concept, category, account, notes, recurring: false, imported: true };
        if (type === 'gasto') Object.assign(tx, { sub, method, tags }); else if (tags.length) tx.tags = tags;
        push(sh, line, tx, accLabel, { fallbackDate });
      }
    }
    out.perSheet.push({ sh, n: out.items.length - before, err: out.errors.length - errBefore, tot: out.totals.length - totBefore });
  });
  return out;
}

/* ---------- aplicar la hoja de patrimonio (después de guardar los movimientos) ----------
   · Cuentas: el saldo de cada mes queda exactamente como en el Excel. El primer mes fija el saldo
     inicial y los siguientes añaden un «ajuste de saldo» si los movimientos no explican la diferencia.
   · Fondos, renta fija, criptos…: se crean como inversiones con el valor de cada mes. */
function applyPatrimonio(sh) {
  const pat = sh.pat, Y = sh.year;
  const months = pat.rows.map(r => Object.assign({}, r, { ym: `${r.y || Y}-${pad(r.m)}` })).sort((a, b) => a.ym < b.ym ? -1 : 1);
  if (!months.length) return;
  const end = ym => D.min(D.monthEnd(ym), TODAY);
  const reset = () => { memo.v++; memo.L = null; memo.bd.clear(); };
  const first = months[0].ym;
  S.startDate = D.min(S.startDate || TODAY, `${first}-01`);
  const series = c => months.map(mo => [mo.ym, mo.vals[c.j]]);
  // cuentas
  pat.valCols.filter(c => c.cls === 'cuenta').forEach(c => {
    let acc = S.accounts.find(a => norm(a.name) === norm(c.name));
    if (!acc) { acc = { id: uid('a'), name: c.name, type: /efectivo|metalico|caja|monedero/.test(norm(c.name)) ? 'efectivo' : /ahorro/.test(norm(c.name)) ? 'ahorro' : 'corriente', institution: '', initial: 0, openDate: `${first}-01` }; S.accounts.push(acc); }
    S.tx = S.tx.filter(t => !(t.type === 'ajuste' && t.account === acc.id && t.importedPat));
    const pts = months.filter(mo => !isNaN(mo.vals[c.j]));
    if (!pts.length) return;
    acc.initial = 0; acc.openDate = D.min(acc.openDate || `${pts[0].ym}-01`, `${pts[0].ym}-01`);
    pts.forEach((mo, k) => {
      reset();
      const diff = round2(mo.vals[c.j] - balAt(acc.id, end(mo.ym)));
      if (k === 0) acc.initial = diff;
      else if (Math.abs(diff) >= 0.01) S.tx.push({ id: uid('t'), type: 'ajuste', date: end(mo.ym), amount: diff, account: acc.id, concept: `Ajuste de saldo de ${MONTHS[mo.m - 1]}`, notes: 'Para que el saldo coincida con tu hoja de patrimonio (dinero que no aparece en los movimientos: traspasos, aportaciones…)', tags: [], importedPat: true });
    });
  });
  reset();
  const mkHolding = (name, kind, ser, cost, extraLots = [], details = {}) => {
    ser = ser.filter(p => !isNaN(p[1]) && p[1] > 0);
    if (!ser.length) return;
    let h = S.holdings.find(x => norm(x.name) === norm(name));
    if (!h) { h = { id: uid('h'), kind, name }; S.holdings.push(h); }
    Object.assign(h, details, {
      kind, noUnits: true, imported: true,
      hist: ser.map(([ym, v]) => [end(ym), round2(v)]), price: round2(ser[ser.length - 1][1]),
      opening: [{ date: `${ser[0][0]}-01`, units: 1, price: round2(cost != null ? cost : ser[0][1]), fee: 0 }].concat(extraLots)
    });
  };
  // fondos: con desglose por fondo si existe; las aportaciones y ajustes se suman al fondo principal
  const fondosCol = pat.valCols.find(c => c.cls === 'fondos');
  const det = pat.det;
  // traspasos entre clases: si un mes los fondos suben lo que baja la renta fija (o al revés), es dinero movido, no rentabilidad
  const clsCols = ['fondos', 'rf', 'cripto', 'acciones'].map(k => pat.valCols.filter(c => c.cls === k));
  const clsVal = (mo, i) => sum(clsCols[i], c => isNaN(mo.vals[c.j]) ? 0 : mo.vals[c.j]);
  const fundMove = {};
  months.forEach((mo, k) => {
    if (!k) return;
    const d = clsCols.map((_, i) => clsVal(mo, i) - clsVal(months[k - 1], i));
    const inc = sum(d.filter(x => x > 0)), dec = -sum(d.filter(x => x < 0));
    const moved = Math.min(inc, dec);
    if (moved > 0.5 && d[0]) fundMove[mo.ym] = d[0] > 0 ? moved * d[0] / inc : -moved * (-d[0]) / dec;
  });
  if (det && det.funds.length) {
    const per = det.funds.map(f => ({ name: f.name, series: [], lots: [] }));
    let ratio = null, prevAlloc = null;
    for (const mo of months) { const b = det.byMonth[mo.m]; if (!b) continue; const vs = det.funds.map(f => isNaN(b.vals[f.j]) ? 0 : b.vals[f.j]); const s = sum(vs); if (s > 0) { ratio = vs.map(v => v / s); break; } }
    months.forEach(mo => {
      const b = det.byMonth[mo.m];
      const vs = det.funds.map(f => b && !isNaN(b.vals[f.j]) ? b.vals[f.j] : 0);
      const s = sum(vs);
      const ap = b && det.aport && !isNaN(b.vals[det.aport.j]) ? b.vals[det.aport.j] : 0;
      const aj = b && det.ajuste && !isNaN(b.vals[det.ajuste.j]) ? b.vals[det.ajuste.j] : 0;
      let T = fondosCol ? mo.vals[fondosCol.j] : NaN;
      if (isNaN(T) && b && det.total && !isNaN(b.vals[det.total.j])) T = b.vals[det.total.j];
      if (isNaN(T)) T = s + ap + aj;
      if (!(T > 0)) return;
      let alloc, main = 0;
      if (s > 0) { alloc = vs.slice(); main = vs.indexOf(Math.max(...vs)); alloc[main] += T - s; }
      else if (ratio) { alloc = ratio.map(r => T * r); main = ratio.indexOf(Math.max(...ratio)); }
      else return;
      alloc.forEach((v, i) => { if (v > 0) per[i].series.push([mo.ym, v]); });
      if (ap > 0) per[main].lots.push({ date: end(mo.ym), units: 0, price: 0, fee: ap });
      const mv = fundMove[mo.ym];
      if (mv) {
        // el dinero traspasado se reparte según lo que cambió cada fondo ese mes (o según su peso)
        const deltas = alloc.map((v, i) => v - (prevAlloc ? prevAlloc[i] : 0)).map(x => mv > 0 ? Math.max(0, x) : Math.max(0, -x));
        const tot = sum(deltas);
        const shares = tot > 0 ? deltas.map(x => x / tot) : alloc.map(v => v / (sum(alloc) || 1));
        shares.forEach((s, i) => { if (s > 0) per[i].lots.push({ date: end(mo.ym), units: 0, price: 0, fee: round2(mv * s) }); });
      }
      prevAlloc = alloc;
    });
    per.forEach(f => mkHolding(f.name, 'fondo', f.series, null, f.lots, { index: '', manager: '' }));
  } else if (fondosCol) mkHolding(fondosCol.name, 'fondo', series(fondosCol), null, Object.entries(fundMove).map(([ym, v]) => ({ date: end(ym), units: 0, price: 0, fee: round2(v) })));
  // renta fija (con los datos del bono si hay tabla de productos)
  const rfCol = pat.valCols.find(c => c.cls === 'rf');
  if (rfCol) {
    const prods = pat.products; const p = prods.length === 1 ? prods[0] : null;
    const capital = prods.length ? sum(prods.filter(x => !isNaN(x.capital)), x => x.capital) : null;
    mkHolding(p ? p.name : rfCol.name, p && /letra/.test(norm(p.name)) ? 'letra' : 'bono', series(rfCol), capital || null, [], { nominal: capital || undefined, coupon: p && p.rate != null ? +p.rate : undefined, maturity: (p && p.maturity) || undefined, bondType: prods.length > 1 ? prods.map(x => x.name).join(', ') : 'Renta fija', country: '', issuer: '' });
  }
  pat.valCols.filter(c => c.cls === 'cripto').forEach(c => mkHolding(c.name, 'cripto', series(c), null));
  pat.valCols.filter(c => c.cls === 'acciones').forEach(c => mkHolding(c.name, 'accion', series(c), null));
  // otros bienes, columnas sin clasificar y deudas: valor del último mes
  const lastVal = c => { const p = months.filter(mo => !isNaN(mo.vals[c.j])); return p.length ? { v: p[p.length - 1].vals[c.j], ym: p[0].ym } : null; };
  pat.valCols.filter(c => c.cls === 'bien' || c.cls === 'item').forEach(c => { const lv = lastVal(c); if (!lv || !(lv.v > 0)) return; let a = S.assets.find(x => norm(x.name) === norm(c.name)); if (!a) { a = { id: uid('o'), name: c.name }; S.assets.push(a); } Object.assign(a, { kind: /coche|vehiculo|moto/.test(norm(c.name)) ? 'vehiculo' : /inmueble|vivienda|piso|casa/.test(norm(c.name)) ? 'inmueble' : 'otro', value: round2(lv.v), acquired: `${lv.ym}-01`, annualChange: 0, notes: 'Importado de tu hoja de patrimonio' }); });
  pat.valCols.filter(c => c.cls === 'deuda').forEach(c => { const lv = lastVal(c); if (!lv || !lv.v) return; let l = S.liabilities.find(x => norm(x.name) === norm(c.name)); if (!l) { l = { id: uid('l'), name: c.name }; S.liabilities.push(l); } Object.assign(l, { kind: /hipoteca/.test(norm(c.name)) ? 'hipoteca' : /tarjeta/.test(norm(c.name)) ? 'tarjeta' : 'prestamo', revolving: true, balance: round2(Math.abs(lv.v)), start: `${lv.ym}-01`, lender: '' }); });
  reset();
}
function patSummary(sh) {
  const p = sh.pat; const last = p.rows[p.rows.length - 1];
  const kinds = { cuenta: 'saldos de cuenta', fondos: 'fondos', rf: 'renta fija', cripto: 'criptos', acciones: 'acciones', bien: 'bienes', deuda: 'deudas', item: 'otros' };
  return { months: p.rows.map(r => cap(MONTHS[r.m - 1])), cols: p.valCols.map(c => `${c.name} (${kinds[c.cls] || c.cls})`), funds: p.det ? p.det.funds.map(f => f.name) : [], products: p.products, last, lastLabel: `${cap(MONTHS[last.m - 1])} ${last.y || sh.year}` };
}

/* ---------- asistente ---------- */
function importWizard(preset = {}) {
  const st = { step: 1, sheets: [], active: 0, fileName: '', opts: { defAcc: (S.accounts[0] || {}).id, createAcc: true, createCat: true, skipDup: true, keepBal: null, includeTotals: false, carryDate: true, fallbackDate: TODAY }, presetSign: preset.sign || null };
  const m = openModal({ title: 'Importar desde Excel', size: 'wide', body: '<div id="impB" class="stack"></div>', foot: '<span class="spacer"></span>' });
  const B = m.el.querySelector('#impB'), F = m.el.querySelector('.modal-f');
  const polarity = sh => {
    if (sh.layout !== 'rows') return;
    const col = sh.map.amount; if (col == null) { sh.hasNeg = false; return; }
    const vals = sh.rows.slice(sh.headerRow + 1).map(r => impAmount((r || [])[col])).filter(v => !isNaN(v) && v !== 0);
    sh.hasNeg = vals.some(v => v < 0);
  };
  const readFile = async file => {
    if (!file) return;
    if (file.size > 25 * 1024 * 1024) { toast('El archivo es demasiado grande (máximo 25 MB)'); return; }
    B.innerHTML = `<div class="empty"><div class="e-ic">${I('refresh', 'lg')}</div><h4>Leyendo «${esc(file.name)}»…</h4></div>`;
    try {
      await loadScript(XLSX_SRC);
      const buf = await file.arrayBuffer();
      if (/\.(csv|txt|tsv)$/i.test(file.name) || /^text\//.test(file.type)) {
        let text = new TextDecoder('utf-8').decode(buf);
        if (text.includes(String.fromCharCode(0xFFFD))) text = new TextDecoder('windows-1252').decode(buf);
        st.sheets = [analyzeSheet(file.name.replace(/\.[^.]+$/, ''), parseCSV(text.replace(/^﻿/, '')))];
      } else {
        const wb = XLSX.read(buf, { type: 'array', cellDates: false, cellFormula: false });
        st.sheets = wb.SheetNames.map(n => {
          const ws = wb.Sheets[n];
          if (!ws || !ws['!ref']) return analyzeSheet(n, []);
          // celdas combinadas: se repite el valor en todo el rango para no perder fechas ni categorías
          (ws['!merges'] || []).forEach(rg => { const v = ws[XLSX.utils.encode_cell(rg.s)]; if (!v) return; for (let R = rg.s.r; R <= rg.e.r; R++) for (let C = rg.s.c; C <= rg.e.c; C++) { const a = XLSX.utils.encode_cell({ r: R, c: C }); if (!ws[a]) ws[a] = Object.assign({}, v); } });
          // se lee desde A1 para que filas y columnas coincidan con las de Excel
          const end = XLSX.utils.decode_range(ws['!ref']).e;
          return analyzeSheet(n, XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '', blankrows: true, range: { s: { r: 0, c: 0 }, e: end } }));
        });
      }
      st.sheets.forEach(sh => { if (st.presetSign && sh.layout === 'rows' && sh.map.type == null && sh.map.debit == null) sh.sign = st.presetSign; polarity(sh); });
      // si hay una lista de movimientos con fechas, las tablas por meses suelen ser resúmenes de ella
      if (st.sheets.some(s => s.include && s.layout === 'rows' && s.map.date != null)) st.sheets.forEach(s => { if (s.layout === 'wide') { s.include = false; s.note = 'parece un resumen de tus movimientos'; } });
      st.fileName = file.name;
      st.active = Math.max(0, st.sheets.findIndex(s => s.include));
      if (!st.sheets.some(s => s.include)) { st.step = 1; draw(); toast('No he encontrado importes en ninguna hoja del archivo'); return; }
      st.step = 2; draw();
    } catch (e) { console.error(e); st.step = 1; draw(); toast('No se ha podido leer el archivo. Comprueba que es un Excel (.xlsx, .xls, .ods) o un CSV.'); }
  };

  function sheetEditor(sh) {
    if (sh.layout === 'empty') return `<p class="muted" style="margin:0">Esta hoja no tiene importes, así que no hay nada que importar.</p>`;
    if (sh.layout === 'summary') return `<div class="note">${I('info', 'sm')}<span>Esta hoja resume datos que salen de tus movimientos (totales, medias, gastos por categoría…). La web los calcula sola a partir de los movimientos, así que importarla los contaría dos veces. Si de verdad contiene movimientos sueltos, márcala en la lista de arriba.</span></div>`;
    if (sh.layout === 'patrimonio') {
      const ps = patSummary(sh);
      return `<div class="note">${I('bank', 'sm')}<span>Hoja de patrimonio: el saldo de tus cuentas y el valor de tus inversiones de cada mes. Al importarla, cada cuenta tendrá exactamente el saldo que anotaste cada mes (si los movimientos no lo explican, se añade un «ajuste de saldo») y cada inversión tendrá su valor mes a mes. Como la hoja no dice cuánto pusiste en cada fondo, el capital aportado se calcula con el primer valor, la columna «Aportaciones» y los traspasos entre renta fija y fondos del mismo mes.</span></div>
        <dl class="kv" style="grid-template-columns:auto 1fr">
          <dt>Meses</dt><dd style="text-align:left;font-family:inherit">${esc(ps.months.join(', '))}</dd>
          <dt>Columnas</dt><dd style="text-align:left;font-family:inherit">${esc(ps.cols.join(' · '))}</dd>
          ${ps.funds.length ? `<dt>Fondos</dt><dd style="text-align:left;font-family:inherit">${esc(ps.funds.join(', '))}</dd>` : ''}
          ${ps.products.length ? `<dt>Renta fija</dt><dd style="text-align:left;font-family:inherit">${ps.products.map(p => `${esc(p.name)}${!isNaN(p.capital) ? ' · ' + money(p.capital) : ''}${p.rate != null ? ' · ' + numFmt(p.rate, 2) + ' %' : ''}${p.maturity ? ' · vence ' + fdate(p.maturity) : ''}`).join('; ')}</dd>` : ''}
          ${ps.last.total != null ? `<dt>Total en ${esc(ps.lastLabel)}</dt><dd style="text-align:left">${M(ps.last.total)}</dd>` : ''}
        </dl>
        ${field('Año de estos meses', `<select class="input sm" data-sh="year" style="width:auto">${Array.from({ length: 12 }, (_, i) => +TODAY.slice(0, 4) - 9 + i).map(y => opt(y, y, sh.year)).join('')}</select>`, { err: false })}`;
    }
    const head = sh.rows[sh.headerRow] || [];
    if (sh.layout === 'wide') {
      return `<div class="note">${I('calendar', 'sm')}<span>Tabla por meses: cada fila es un concepto y cada columna un mes (${sh.monthCols.map(x => MONTHS_S[x.m - 1]).join(', ')}). Se creará un movimiento por cada celda con importe. Las filas sin importes se usan como sección (por ejemplo «Gastos» o «Vivienda») y las de totales se omiten para no contar dos veces.</span></div>
        <div class="form-grid">
          ${field('Columna con los conceptos', `<select class="input sm" data-sh="labelCol">${Array.from({ length: Math.max(...sh.monthCols.map(x => x.col)) }, (_, i) => opt(i, `${colLetter(i)} · ${txt(head[i]) || 'sin título'}`, sh.labelCol)).join('')}</select>`, { err: false })}
          ${field('Año', `<select class="input sm" data-sh="year">${Array.from({ length: 12 }, (_, i) => +TODAY.slice(0, 4) - 9 + i).map(y => opt(y, y, sh.year)).join('')}</select>`, { err: false, hint: sh.monthCols.some(x => x.y) ? 'Los meses que traen año usan el suyo' : '' })}
          ${field('Fecha de cada movimiento', `<select class="input sm" data-sh="day">${opt(1, 'Día 1 del mes', sh.day)}${opt('end', 'Último día del mes', sh.day)}</select>`, { err: false })}
          ${field('Importes positivos son…', `<select class="input sm" data-sh="sign">${opt('auto', 'Automático (por sección y concepto)', sh.sign)}${opt('gastos', 'Gastos', sh.sign)}${opt('ingresos', 'Ingresos', sh.sign)}${opt('signo', 'Ingresos (negativos = gastos)', sh.sign)}</select>`, { err: false })}
        </div>`;
    }
    const sample = sh.rows.slice(sh.headerRow + 1).find(r => r && r.some(c => !isBlank(c))) || [];
    const ncol = Math.max(head.length, ...sh.rows.slice(0, 80).map(r => (r || []).length), 0);
    const colOpts = sel => opt('', '— No importar —', sel == null ? '' : sel) + Array.from({ length: ncol }, (_, i) => opt(i, `${colLetter(i)} · ${String(txt(head[i]) || 'sin título').slice(0, 26)}${!isBlank(sample[i]) ? ` (ej.: ${String(sample[i]).slice(0, 18)})` : ''}`, sel == null ? '' : sel)).join('');
    const signNeeded = sh.map.type == null && sh.map.debit == null && sh.map.credit == null;
    return `<div class="row wrap" style="gap:10px"><label class="row" style="gap:6px;font-size:13px">Fila de títulos <select class="input sm" data-sh="headerRow" style="width:auto">${opt(-1, 'Sin títulos', sh.headerRow)}${Array.from({ length: Math.min(30, sh.rows.length) }, (_, i) => opt(i, `Fila ${i + 1}`, sh.headerRow)).join('')}</select></label>
        ${signNeeded ? `<label class="row" style="gap:6px;font-size:13px">Gastos e ingresos <select class="input sm" data-sh="sign" style="width:auto">${opt('auto', sh.hasNeg ? 'Negativos = gastos, positivos = ingresos' : 'Automático (por concepto y sección)', sh.sign)}${opt('gastos', 'Todas las filas son gastos', sh.sign)}${opt('ingresos', 'Todas las filas son ingresos', sh.sign)}${opt('signo', 'Negativos = gastos, positivos = ingresos', sh.sign)}</select></label>` : ''}</div>
      <div class="map-grid">${IMP_FIELDS.map(f => `<label class="map-row"><span>${f.label}</span><select class="input sm" data-map="${f.k}">${colOpts(sh.map[f.k])}</select></label>`).join('')}</div>
      <p class="hint" style="margin:0">Solo hace falta el importe (en una columna, o en «Cargo» y «Abono»). Las columnas que no asignes se guardan en las notas de cada movimiento, así no se pierde nada.</p>`;
  }

  function draw() {
    if (st.step === 1) {
      B.innerHTML = `
        <label class="dropzone" id="impDrop"><input type="file" id="impFile" accept=".xlsx,.xls,.xlsm,.xlsb,.csv,.ods,.txt,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv" hidden/>
          <span class="e-ic">${I('upload', 'lg')}</span><b>Arrastra aquí tu Excel o pulsa para elegirlo</b><span class="muted">.xlsx, .xls, .ods o .csv · todas las hojas a la vez · también extractos bancarios</span></label>
        <div class="note">${I('info', 'sm')}<span>Tu hoja no necesita un formato fijo. Reconozco listas de movimientos (una fila por gasto o ingreso) y tablas por meses (conceptos en filas y meses en columnas). Antes de importar verás qué entra, qué no y por qué. El archivo se lee en tu navegador y no se envía a ningún sitio.</span></div>
        <div class="row wrap"><span class="muted" style="font-size:13px">¿Empiezas de cero?</span><button class="btn sm" type="button" data-tpl>${I('download', 'sm')}Descargar plantilla de Excel</button></div>`;
      F.innerHTML = `<span class="spacer"></span><button class="btn" type="button" data-cancel>Cancelar</button>`;
      F.querySelector('[data-cancel]').onclick = m.close;
      const inp = B.querySelector('#impFile'), dz = B.querySelector('#impDrop');
      inp.onchange = () => readFile(inp.files[0]);
      ['dragenter', 'dragover'].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.add('over'); }));
      ['dragleave', 'drop'].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.remove('over'); }));
      dz.addEventListener('drop', e => { const f = e.dataTransfer.files[0]; if (f) readFile(f); });
      B.querySelector('[data-tpl]').onclick = downloadTemplate;
      return;
    }
    const res = buildImport(st);
    const toImport = res.items.filter(x => !(st.opts.skipDup && x.dup));
    const nG = toImport.filter(x => x.tx.type === 'gasto'), nI = toImport.filter(x => x.tx.type === 'ingreso');
    const touched = new Set(toImport.map(x => x.tx.account));
    const existingWithBal = S.accounts.filter(a => touched.has(a.id) && (+a.initial || 0) !== 0);
    if (st.opts.keepBal == null) st.opts.keepBal = existingWithBal.length > 0;
    const sh = st.sheets[st.active];
    const fb = toImport.filter(x => x.fallbackDate).length;
    const hasAcc = st.sheets.some(s => s.include && s.layout === 'rows' && s.map.account != null);
    const hasCat = st.sheets.some(s => s.include && (s.layout === 'wide' || s.map.category != null || s.map.sub != null));
    const layoutLbl = s => s.layout === 'wide' ? 'Tabla por meses' : s.layout === 'empty' ? 'Sin importes' : s.layout === 'summary' ? 'Resumen calculado' : s.layout === 'patrimonio' ? 'Patrimonio mensual' : 'Lista de movimientos';
    B.innerHTML = `
      <div class="row wrap" style="gap:10px"><span class="pill info">${I('report')}${esc(st.fileName)}</span><span class="muted" style="font-size:12.5px">${st.sheets.length} hoja${st.sheets.length > 1 ? 's' : ''}</span><span class="spacer"></span><button class="btn xs ghost" type="button" data-other>${I('left', 'sm')}Otro archivo</button></div>
      <div><div class="eyebrow" style="margin-bottom:8px">1 · Hojas del archivo</div>
        <div class="sheet-list">${res.perSheet.map(({ sh: s, n, err, tot }, i) => `<div class="sheet-item${i === st.active ? ' on' : ''}"><label class="check"><input type="checkbox" data-inc="${i}" ${s.include ? 'checked' : ''} ${s.layout === 'empty' ? 'disabled' : ''}/></label><button type="button" data-act="${i}" class="sheet-btn"><b>${esc(s.name)}</b><span>${layoutLbl(s)} · ${s.include ? (s.layout === 'patrimonio' ? `${n} meses de saldos y valores${err ? ` · ${err} mes incompleto` : ''}` : `${n} movimiento${n !== 1 ? 's' : ''}${err ? ` · ${err} sin importar` : ''}${tot ? ` · ${tot} totales` : ''}`) : s.layout === 'summary' ? 'no se importa: sus cifras ya salen de tus movimientos' : s.note ? 'no se importa: ' + s.note : 'no se importa'}</span></button></div>`).join('')}</div></div>
      <div><div class="eyebrow" style="margin-bottom:8px">2 · Columnas de «${esc(sh.name)}»</div><div class="stack" style="gap:10px">${sheetEditor(sh)}</div></div>
      <div><div class="eyebrow" style="margin-bottom:8px">3 · Opciones</div><div class="stack" style="gap:8px">
        <label class="row" style="gap:8px;font-size:13px;flex-wrap:wrap"><span style="min-width:180px">Cuenta para los movimientos</span><select class="input sm" id="impAcc" style="width:auto">${accountOptions(st.opts.defAcc)}</select>${hasAcc ? '<span class="hint">si la fila no indica cuenta</span>' : ''}</label>
        ${hasAcc ? `<label class="check" style="font-size:13px"><input type="checkbox" id="impCA" ${st.opts.createAcc ? 'checked' : ''}/>Crear las cuentas que aún no existan</label>` : ''}
        ${hasCat ? `<label class="check" style="font-size:13px"><input type="checkbox" id="impCC" ${st.opts.createCat ? 'checked' : ''}/>Crear las categorías que aún no existan (si no, van a la más parecida u «Otros»)</label>` : ''}
        <label class="check" style="font-size:13px"><input type="checkbox" id="impCarry" ${st.opts.carryDate ? 'checked' : ''}/>Si una fila no tiene fecha, usar la de la fila anterior</label>
        <label class="row" style="gap:8px;font-size:13px;flex-wrap:wrap"><span style="min-width:180px">Fecha para filas sin fecha reconocible</span><input class="input sm" type="date" id="impFb" value="${st.opts.fallbackDate}" style="width:auto"/><span class="hint">se marcan con #revisar</span></label>
        <label class="check" style="font-size:13px"><input type="checkbox" id="impTot" ${st.opts.includeTotals ? 'checked' : ''}/>Importar también las filas de totales y saldos (no recomendado: contarían dos veces)</label>
        <label class="check" style="font-size:13px"><input type="checkbox" id="impDup" ${st.opts.skipDup ? 'checked' : ''}/>Saltar movimientos que ya tengo registrados (misma fecha, importe y concepto)</label>
        ${existingWithBal.length ? `<label class="check" style="font-size:13px;align-items:flex-start"><input type="checkbox" id="impKeep" ${st.opts.keepBal ? 'checked' : ''} style="margin-top:2px"/><span>Mantener el saldo actual de ${existingWithBal.map(a => esc(a.name)).join(', ')}<span class="hint" style="display:block">Márcalo si ya pusiste el saldo de hoy: el saldo inicial se ajusta para que el histórico importado no lo descuadre.</span></span></label>` : ''}
      </div></div>
      <div><div class="eyebrow" style="margin-bottom:8px">4 · Revisión</div>
        <div class="kpis">${kpi('Gastos', String(nG.length), M(sum(nG, x => x.tx.amount)), 'var(--c-expense)')}${kpi('Ingresos', String(nI.length), M(sum(nI, x => x.tx.amount)), 'var(--c-income)')}${res.pats.map(s => { const ps = patSummary(s); return kpi('Patrimonio', `${ps.months.length} meses`, ps.last.total != null ? `${M(ps.last.total, { dec: 0 })} en ${esc(ps.lastLabel)}` : 'saldos y valores', 'var(--c-networth)'); }).join('')}${kpi('Ya registrados', String(res.dups), st.opts.skipDup ? 'se saltarán' : 'se importarán igualmente')}${kpi('No importadas', String(res.errors.length + res.totals.length), `${res.errors.length} sin importe · ${res.totals.length} totales`)}</div>
        ${fb ? `<p class="hint" style="margin:10px 0 0">${fb} movimiento${fb > 1 ? 's' : ''} sin fecha reconocible usarán el ${fdate(st.opts.fallbackDate)} y llevarán la etiqueta #revisar para que los encuentres en Gastos.</p>` : ''}
        ${res.P.acc.size || res.P.cat.size || res.P.inc.size || res.P.subs.size ? `<p class="hint" style="margin:8px 0 0">Se crearán: ${[res.P.acc.size ? `${res.P.acc.size} cuenta${res.P.acc.size > 1 ? 's' : ''} (${[...res.P.acc.values()].map(a => esc(a.name)).join(', ')})` : '', res.P.cat.size + res.P.inc.size ? `${res.P.cat.size + res.P.inc.size} categoría${res.P.cat.size + res.P.inc.size > 1 ? 's' : ''} (${[...res.P.cat.values()].map(c => esc(c.name)).concat([...res.P.inc].map(esc)).join(', ')})` : '', res.P.subs.size ? `${sum([...res.P.subs.values()], s => s.size)} subcategorías` : ''].filter(Boolean).join(' · ')}.</p>` : ''}
        ${res.errors.length || res.totals.length ? `<details style="margin-top:10px;font-size:12.5px" ${res.errors.length ? 'open' : ''}><summary style="cursor:pointer;font-weight:560">Filas que no se importarán (${res.errors.length + res.totals.length})</summary>
          <div class="tbl-wrap" style="border:1px solid var(--line);border-radius:10px;margin-top:6px;max-height:200px;overflow:auto"><table class="tbl"><thead><tr><th>Hoja</th><th>Fila</th><th>Motivo</th><th>Contenido</th></tr></thead><tbody>
          ${res.errors.map(e => `<tr><td>${esc(e.sheet)}</td><td class="muted">${e.line}</td><td>${esc(e.msg)}</td><td class="muted" style="white-space:normal">${esc(e.text)}</td></tr>`).join('')}
          ${res.totals.map(e => `<tr><td>${esc(e.sheet)}</td><td class="muted">${e.line}</td><td>fila de total o saldo</td><td class="muted" style="white-space:normal">${esc(e.text)}${e.amount != null ? ' · ' + money(e.amount) : ''}</td></tr>`).join('')}
          </tbody></table></div><p class="hint" style="margin:6px 0 0">Si alguna sí debía entrar, revisa qué columna es el importe en esa hoja o marca «Importar también las filas de totales».</p></details>` : `<p class="hint" style="margin:10px 0 0">${I('check', 'sm')} Todas las filas con importe entran.</p>`}
        <div class="tbl-wrap" style="border:1px solid var(--line);border-radius:12px;margin-top:10px;max-height:300px;overflow:auto"><table class="tbl"><thead><tr><th>Hoja · fila</th><th>Fecha</th><th>Concepto</th><th>Categoría</th><th class="hide-sm">Cuenta</th><th class="r">Importe</th></tr></thead><tbody>
          ${res.items.slice(0, 150).map(x => `<tr style="${x.dup && st.opts.skipDup ? 'opacity:.45' : ''}"><td class="muted">${esc(x.sheet)} · ${x.line}</td><td>${fdate(x.tx.date)}${x.fallbackDate ? ' <span class="pill warn">revisar</span>' : ''}</td><td><span class="concept">${esc(x.tx.concept)}</span>${x.dup ? ' <span class="pill flat">Ya registrado</span>' : ''}${x.tx.notes ? `<span class="cell-sub" style="max-width:280px;overflow:hidden;text-overflow:ellipsis">${esc(x.tx.notes)}</span>` : ''}</td><td><span class="cat-cell"><span class="cat-dot" style="background:${x.tx.type === 'gasto' ? catColor(x.tx.category) : catColor(x.tx.category, 'ingreso')}"></span>${esc(x.tx.category)}${x.tx.sub ? `<span class="muted"> › ${esc(x.tx.sub)}</span>` : ''}</span></td><td class="hide-sm">${esc(x.accLabel)}</td><td class="r">${signedAmount(x.tx)}</td></tr>`).join('') || `<tr><td colspan="6" class="muted">No hay movimientos con esta configuración. Revisa qué columna es el importe.</td></tr>`}
        </tbody></table></div>${res.items.length > 150 ? `<p class="hint" style="margin:6px 0 0">Vista previa de 150 de ${res.items.length} movimientos. Se importarán todos.</p>` : ''}
      </div>`;
    F.innerHTML = `<span class="hint">Podrás deshacer la importación justo después.</span><span class="spacer"></span><button class="btn" type="button" data-cancel>Cancelar</button><button class="btn primary" type="button" data-go ${toImport.length || res.pats.length ? '' : 'disabled'}>${I('upload', 'sm')}Importar ${toImport.length ? `${toImport.length} movimiento${toImport.length !== 1 ? 's' : ''}` : ''}${toImport.length && res.pats.length ? ' y ' : ''}${res.pats.length ? 'patrimonio' : ''}${!toImport.length && !res.pats.length ? '0 movimientos' : ''}</button>`;
    F.querySelector('[data-cancel]').onclick = m.close;
    B.querySelector('[data-other]').onclick = () => { st.step = 1; draw(); };
    B.querySelectorAll('[data-act]').forEach(b => b.onclick = () => { st.active = +b.dataset.act; draw(); });
    B.querySelectorAll('[data-inc]').forEach(c => c.onchange = () => {
      const s = st.sheets[+c.dataset.inc]; s.include = c.checked;
      if (c.checked && s.layout === 'summary') { s.layout = 'rows'; s.headerRow = guessHeaderRow(s.rows); s.map = guessMap(s.headerRow >= 0 ? (s.rows[s.headerRow] || []) : [], s.rows.slice(s.headerRow + 1)); polarity(s); }
      st.active = +c.dataset.inc; draw();
    });
    B.querySelectorAll('[data-sh]').forEach(s => s.onchange = () => {
      const k = s.dataset.sh; let v = s.value;
      if (k === 'headerRow') { sh.headerRow = +v; sh.map = guessMap(sh.headerRow >= 0 ? (sh.rows[sh.headerRow] || []) : [], sh.rows.slice(sh.headerRow + 1)); polarity(sh); }
      else if (k === 'labelCol' || k === 'year') sh[k] = +v;
      else if (k === 'day') sh.day = v === 'end' ? 'end' : 1;
      else sh[k] = v;
      draw();
    });
    B.querySelectorAll('[data-map]').forEach(s => s.onchange = () => {
      const k = s.dataset.map; const v = s.value === '' ? null : +s.value;
      Object.keys(sh.map).forEach(x => { if (sh.map[x] === v && x !== k) delete sh.map[x]; });
      if (v == null) delete sh.map[k]; else sh.map[k] = v;
      if (k === 'amount' && v != null) { delete sh.map.debit; delete sh.map.credit; }
      if ((k === 'debit' || k === 'credit') && v != null) delete sh.map.amount;
      polarity(sh); draw();
    });
    const bind = (id, fn) => { const el = B.querySelector(id); if (el) el.onchange = () => { fn(el); draw(); }; };
    bind('#impAcc', el => st.opts.defAcc = el.value);
    bind('#impCA', el => st.opts.createAcc = el.checked);
    bind('#impCC', el => st.opts.createCat = el.checked);
    bind('#impCarry', el => st.opts.carryDate = el.checked);
    bind('#impFb', el => { if (el.value) st.opts.fallbackDate = el.value; });
    bind('#impTot', el => st.opts.includeTotals = el.checked);
    bind('#impDup', el => st.opts.skipDup = el.checked);
    bind('#impKeep', el => st.opts.keepBal = el.checked);
    const go = F.querySelector('[data-go]');
    if (go) go.onclick = () => {
      const r = buildImport(st);
      const list = r.items.filter(x => !(st.opts.skipDup && x.dup)).map(x => x.tx);
      if (!list.length && !r.pats.length) return;
      m.close();
      withUndo(list.length ? `${list.length} movimientos importados${r.pats.length ? ' y patrimonio actualizado' : ''}` : 'Patrimonio importado', () => {
        const newAccs = [...r.P.acc.values()];
        newAccs.forEach(a => S.accounts.push(a));
        r.P.cat.forEach(c => { if (!c.subs.length) c.subs.push('General'); S.categories.splice(Math.max(0, S.categories.length - 1), 0, c); });
        r.P.subs.forEach((set, cat) => { const c = S.categories.find(x => x.name === cat); if (c) set.forEach(s => { if (!c.subs.includes(s)) c.subs.push(s); }); });
        r.P.inc.forEach(n => { if (!S.incomeCategories.some(c => c.name === n)) S.incomeCategories.splice(Math.max(0, S.incomeCategories.length - 1), 0, { id: uid('ic'), name: n, icon: 'spark' }); });
        r.P.tags.forEach(t => { if (!S.tags.includes(t)) S.tags.push(t); });
        if (st.opts.keepBal) {
          const net = {}; list.forEach(t => { net[t.account] = (net[t.account] || 0) + (t.type === 'gasto' ? -t.amount : t.amount); });
          S.accounts.forEach(a => { if (net[a.id] && !newAccs.includes(a) && (+a.initial || 0) !== 0) a.initial = round2(a.initial - net[a.id]); });
        }
        S.tx = list.concat(S.tx);
        if (list.length) S.startDate = D.min(S.startDate || TODAY, list.reduce((a, t) => D.min(a, t.date), TODAY));
        r.pats.forEach(applyPatrimonio);
        // la cuenta vacía que se crea al registrarse sobra si el Excel trae sus propias cuentas
        if (r.P.acc.size || r.pats.length) S.accounts = S.accounts.filter(a => !(a.name === 'Cuenta principal' && !(+a.initial) && !S.tx.some(t => t.account === a.id || t.toAccount === a.id) && !S.recurring.some(x => x.account === a.id || x.toAccount === a.id) && !S.goals.some(g => g.accountId === a.id) && S.accounts.length > 1));
      });
      UIS.params = {}; tblState.gastos = null; tblState.ingresos = null;
      navigate(r.pats.length ? 'balance' : list.some(t => t.type === 'gasto') ? 'gastos' : 'ingresos');
    };
  }
  draw();
}

/* plantilla de Excel con las columnas que la app reconoce */
async function downloadTemplate() {
  try {
    await loadScript(XLSX_SRC);
    const wb = XLSX.utils.book_new();
    const rows = [['Fecha', 'Concepto', 'Importe', 'Tipo', 'Categoría', 'Subcategoría', 'Cuenta', 'Método de pago', 'Etiquetas', 'Notas'],
      ['01/10/2026', 'Ejemplo: supermercado', -54.2, 'Gasto', 'Alimentación', 'Supermercado', 'Cuenta principal', 'Tarjeta', 'necesario', 'Borra estas filas de ejemplo'],
      ['28/09/2026', 'Ejemplo: nómina', 2100, 'Ingreso', 'Salario', '', 'Cuenta principal', '', '', '']];
    const ws = XLSX.utils.aoa_to_sheet(rows); ws['!cols'] = [12, 30, 12, 10, 16, 18, 18, 16, 18, 30].map(w => ({ wch: w }));
    XLSX.utils.book_append_sheet(wb, ws, 'Movimientos');
    const help = [['Cómo rellenar la plantilla'], [''], ['Fecha', 'dd/mm/aaaa.'], ['Importe', 'Obligatorio. Gastos en negativo o indica el Tipo.'], ['Tipo', 'Gasto o Ingreso. Opcional si usas el signo del importe.'], ['Categoría', `Gastos: ${S.categories.map(c => c.name).join(', ')}. Ingresos: ${S.incomeCategories.map(c => c.name).join(', ')}.`], ['Cuenta', `Tus cuentas: ${S.accounts.map(a => a.name).join(', ')}. Si pones otra, se puede crear al importar.`], ['Etiquetas', 'Separadas por comas, sin #.'], ['', ''], ['También puedes importar tu propio Excel tal cual, aunque tenga otro formato o una tabla por meses.']];
    const wh = XLSX.utils.aoa_to_sheet(help); wh['!cols'] = [{ wch: 14 }, { wch: 100 }];
    XLSX.utils.book_append_sheet(wb, wh, 'Instrucciones');
    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    await saveFile('plantilla-patrimonia.xlsx', new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  } catch (e) { toast('No se ha podido generar la plantilla. Revisa tu conexión.'); }
}
