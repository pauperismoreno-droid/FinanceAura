/* Patrimonia — núcleo: utilidades, iconos, estado y motor de cálculo */
'use strict';

/* ---------- utilidades ---------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const uid = (p = '') => p + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-3);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const sum = (arr, f = x => x) => arr.reduce((a, x) => a + (+f(x) || 0), 0);
const round2 = v => Math.round((v + Number.EPSILON) * 100) / 100;
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = n => String(n).padStart(2, '0');
const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/* ---------- fechas (cadenas ISO AAAA-MM-DD, aritmética en UTC) ---------- */
const D = {
  parse(s) { const [y, m, d] = s.split('-').map(Number); return Date.UTC(y, m - 1, d || 1); },
  fromMs(ms) { return new Date(ms).toISOString().slice(0, 10); },
  add(s, n) { return D.fromMs(D.parse(s) + n * 864e5); },
  diff(a, b) { return Math.round((D.parse(b) - D.parse(a)) / 864e5); },
  ym(s) { return s.slice(0, 7); },
  ymAdd(ym, n) {
    let [y, m] = ym.split('-').map(Number); m += n;
    y += Math.floor((m - 1) / 12); m = ((m - 1) % 12 + 12) % 12 + 1;
    return `${y}-${pad(m)}`;
  },
  ymDiff(a, b) { const [y1, m1] = a.split('-').map(Number), [y2, m2] = b.split('-').map(Number); return (y2 - y1) * 12 + (m2 - m1); },
  dim(ym) { const [y, m] = ym.split('-').map(Number); return new Date(Date.UTC(y, m, 0)).getUTCDate(); },
  mk(ym, d) { return `${ym}-${pad(Math.max(1, Math.min(d, D.dim(ym))))}`; },
  monthEnd(ym) { return D.mk(ym, 31); },
  dow(s) { return (new Date(D.parse(s)).getUTCDay() + 6) % 7; },
  today() { const t = new Date(); return `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`; },
  addMonthsISO(s, n) { const ym = D.ymAdd(D.ym(s), n); return D.mk(ym, +s.slice(8, 10)); },
  min(a, b) { return a < b ? a : b; },
  max(a, b) { return a > b ? a : b; }
};
const TODAY = D.today();
const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const MONTHS_S = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic'];
const DOW = ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom'];
const cap = s => s ? s[0].toUpperCase() + s.slice(1) : s;
const monthLabel = (ym, short) => { const [y, m] = ym.split('-').map(Number); return short ? `${MONTHS_S[m - 1]} ${String(y).slice(2)}` : `${cap(MONTHS[m - 1])} ${y}`; };

/* ---------- iconos (trazos propios, 24x24) ---------- */
const ICONS = {
  home: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z',
  moves: 'M7 4v16M3 8l4-4 4 4M17 20V4M13 16l4 4 4-4',
  bank: 'M3 21h18M5 21v-9M9.5 21v-9M14.5 21v-9M19 21v-9M2 10l10-6 10 6z',
  trend: 'M3 17l6-6 4 4 8-8M15 7h6v6',
  target: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10zM12 11.2a.8.8 0 1 0 0 1.6.8.8 0 0 0 0-1.6z',
  pie: 'M21 12A9 9 0 1 1 12 3v9zM15 3.5A9 9 0 0 1 20.5 9H15z',
  sliders: 'M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1M15 4v4M9 10v4M17 16v4',
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4',
  eye: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  eyeoff: 'M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4.1M6.6 6.6C3.8 8.4 2 12 2 12s3.5 7 10 7c1.7 0 3.2-.4 4.5-1.1M9.9 9.9a3 3 0 0 0 4.2 4.2',
  sun: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
  moon: 'M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z',
  bell: 'M6 8a6 6 0 1 1 12 0c0 7 3 8 3 8H3s3-1 3-8M10 20a2 2 0 0 0 4 0',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  x: 'M6 6l12 12M18 6 6 18',
  down: 'M6 9l6 6 6-6',
  left: 'M15 6l-6 6 6 6',
  right: 'M9 6l6 6-6 6',
  edit: 'M4 20h4L19 9l-4-4L4 16zM14 6l4 4',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  up: 'M7 17 17 7M8 7h9v9',
  dn: 'M7 7l10 10M17 8v9H8',
  transfer: 'M4 8h14l-3-3M20 16H6l3 3',
  wallet: 'M3 7a2 2 0 0 1 2-2h13v4M3 7v10a2 2 0 0 0 2 2h15V9H5a2 2 0 0 1-2-2zM16 14h.01',
  cash: 'M3 6h18v12H3zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM6 9h.01M18 15h.01',
  layers: 'M12 3 2 8l10 5 10-5zM2 13l10 5 10-5M2 17.5l10 5 10-5',
  building: 'M4 21V5l8-3v19M12 9h8v12M8 8h.01M8 12h.01M8 16h.01M16 13h.01M16 17h.01M2 21h20',
  shield: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z',
  box: 'M21 8l-9-5-9 5v8l9 5 9-5zM3 8l9 5 9-5M12 13v8',
  car: 'M3 13l2-6h14l2 6v4H3zM5 17v2M19 17v2M3 13h18M7 15h.01M17 15h.01',
  card: 'M3 6h18v12H3zM3 10h18M7 15h3',
  calendar: 'M4 5h16v16H4zM4 9h16M8 3v4M16 3v4',
  repeat: 'M17 2l4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4M21 13v2a3 3 0 0 1-3 3H3',
  flag: 'M5 21V4M5 4h11l-2 4 2 4H5',
  piggy: 'M19 11c0-3.3-3.1-6-7-6s-7 2.7-7 6c0 2 1.1 3.7 2.8 4.8V19h3v-2h2.4v2h3v-3.2A6 6 0 0 0 18.6 13H21v-3h-2.2M15 10h.01M3 9c0 1.5 1 2 2 2',
  report: 'M6 3h9l5 5v13H6zM14 3v6h6M9 13h6M9 17h6',
  lock: 'M6 11h12v10H6zM8 11V7a4 4 0 0 1 8 0v4',
  info: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 11v5M12 8h.01',
  alert: 'M12 3 2 20h20zM12 10v4M12 17h.01',
  check: 'M5 12l5 5L20 7',
  download: 'M12 4v12M7 11l5 5 5-5M4 20h16',
  upload: 'M12 20V8M7 13l5-5 5 5M4 4h16',
  menu: 'M4 6h16M4 12h16M4 18h16',
  grid: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z',
  tag: 'M3 12V3h9l9 9-9 9zM7.5 7.5h.01',
  basket: 'M4 9h16l-2 11H6zM9 9l3-6 3 6M9 13v4M15 13v4',
  film: 'M4 4h16v16H4zM10 9l5 3-5 3z',
  bag: 'M5 8h14l-1 13H6zM9 8V6a3 3 0 0 1 6 0v2',
  heart: 'M12 20s-7-4.5-9-9a5 5 0 0 1 9-3 5 5 0 0 1 9 3c-2 4.5-9 9-9 9z',
  book: 'M4 5a2 2 0 0 1 2-2h14v16H6a2 2 0 0 0-2 2zM4 19V5M8 7h8',
  percent: 'M19 5 5 19M7 5a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM17 15a2 2 0 1 0 0 4 2 2 0 0 0 0-4z',
  dots: 'M5 12h.01M12 12h.01M19 12h.01',
  briefcase: 'M3 8h18v12H3zM8 8V5h8v3M3 13h18',
  gift: 'M4 11h16v9H4zM3 7h18v4H3zM12 7v13M12 7c-2-4-6-3-5 0M12 7c2-4 6-3 5 0',
  coin: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM14.5 9H11a1.5 1.5 0 0 0 0 3h2a1.5 1.5 0 0 1 0 3H9.5M12 7.5V9M12 15v1.5',
  laptop: 'M4 5h16v11H4zM2 19h20',
  spark: 'M12 3v5M12 16v5M3 12h5M16 12h5M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6',
  btc: 'M8 5h6a3 3 0 0 1 0 6H8zM8 11h7a3 3 0 0 1 0 6H8zM8 3v16M11 3v2M11 17v2',
  keyboard: 'M3 6h18v12H3zM7 10h.01M11 10h.01M15 10h.01M7 14h10',
  scale: 'M12 3v18M5 21h14M4 8h16M4 8l-2 6a3 3 0 0 0 6 0zM20 8l-2 6a3 3 0 0 0 6 0zM12 3l-8 5M12 3l8 5',
  globe: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM3 12h18M12 3c3 3.2 3 14.8 0 18M12 3c-3 3.2-3 14.8 0 18',
  palette: 'M12 3a9 9 0 0 0 0 18c1 0 1.5-.8 1.5-1.5 0-1.2-1-1.5-1-2.5s.7-1.5 1.7-1.5H17a4 4 0 0 0 4-4c0-4.7-4-8.5-9-8.5zM7.5 11h.01M10 7.5h.01M15 7.5h.01',
  refresh: 'M20 11a8 8 0 0 0-14.6-4.6L3 9M3 4v5h5M4 13a8 8 0 0 0 14.6 4.6L21 15M21 20v-5h-5',
  house: 'M3 10.5 12 3l9 7.5V21H3zM9 21v-6h6v6',
  list: 'M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01',
  week: 'M4 5h16v16H4zM4 9h16M9.3 9v12M14.6 9v12'
};
const I = (n, cls = '') => `<svg class="i ${cls}" viewBox="0 0 24 24" aria-hidden="true"><path d="${ICONS[n] || ICONS.dots}"/></svg>`;

/* ---------- catálogos ---------- */
const EXPENSE_CATS = [
  { name: 'Vivienda', icon: 'home', nature: 'necesidad', subs: ['Alquiler', 'Hipoteca', 'Comunidad', 'Electricidad', 'Agua', 'Gas', 'Internet', 'Mantenimiento'] },
  { name: 'Alimentación', icon: 'basket', nature: 'necesidad', subs: ['Supermercado', 'Restaurantes', 'Comida a domicilio', 'Cafés'], ocioSubs: ['Restaurantes', 'Comida a domicilio', 'Cafés'] },
  { name: 'Transporte', icon: 'car', nature: 'necesidad', subs: ['Combustible', 'Transporte público', 'Parking', 'Mantenimiento', 'Seguro', 'Coche'] },
  { name: 'Ocio', icon: 'film', nature: 'ocio', subs: ['Cine', 'Viajes', 'Juegos', 'Suscripciones', 'Restaurantes', 'Actividades'] },
  { name: 'Compras', icon: 'bag', nature: 'ocio', subs: ['Ropa', 'Tecnología', 'Hogar', 'Otros'] },
  { name: 'Salud', icon: 'heart', nature: 'necesidad', subs: ['Farmacia', 'Médico', 'Dentista', 'Seguro médico'] },
  { name: 'Educación', icon: 'book', nature: 'necesidad', subs: ['Cursos', 'Libros', 'Formación'] },
  { name: 'Finanzas', icon: 'percent', nature: 'necesidad', subs: ['Comisiones', 'Impuestos', 'Intereses'] },
  { name: 'Otros', icon: 'dots', nature: 'ocio', subs: ['Otros'] }
];
const INCOME_CATS = [
  { name: 'Salario', icon: 'briefcase' }, { name: 'Pagas extra', icon: 'gift' }, { name: 'Ingresos por inversiones', icon: 'trend' },
  { name: 'Dividendos', icon: 'coin' }, { name: 'Intereses', icon: 'percent' }, { name: 'Trabajos adicionales', icon: 'laptop' },
  { name: 'Otros ingresos', icon: 'spark' }
];
const INVEST_INCOME = ['Dividendos', 'Intereses', 'Ingresos por inversiones'];
const ACCOUNT_TYPES = {
  corriente: { label: 'Cuenta corriente', icon: 'bank' }, remunerada: { label: 'Cuenta remunerada', icon: 'percent' },
  ahorro: { label: 'Cuenta de ahorro', icon: 'piggy' }, deposito: { label: 'Depósito', icon: 'lock' },
  efectivo: { label: 'Efectivo', icon: 'cash' }, broker: { label: 'Broker (liquidez)', icon: 'trend' }
};
const HOLDING_KINDS = {
  fondo: { label: 'Fondo indexado', cls: 'rv', group: 'fondos', icon: 'layers' },
  etf: { label: 'ETF', cls: 'rv', group: 'fondos', icon: 'layers' },
  accion: { label: 'Acción', cls: 'rv', group: 'acciones', icon: 'building' },
  bono: { label: 'Bono gubernamental', cls: 'rf', group: 'bonos', icon: 'shield' },
  letra: { label: 'Letra del Tesoro', cls: 'rf', group: 'bonos', icon: 'shield' },
  'bono-corp': { label: 'Bono corporativo', cls: 'rf', group: 'bonos', icon: 'shield' },
  'fondo-rf': { label: 'Fondo de renta fija', cls: 'rf', group: 'bonos', icon: 'shield' },
  cripto: { label: 'Criptomoneda', cls: 'otros', group: 'otros', icon: 'btc' }
};
const ASSET_KINDS = { inmueble: { label: 'Inmueble', icon: 'house' }, vehiculo: { label: 'Vehículo', icon: 'car' }, otro: { label: 'Otro activo', icon: 'box' } };
const LIAB_KINDS = { hipoteca: { label: 'Hipoteca', icon: 'house' }, prestamo: { label: 'Préstamo', icon: 'wallet' }, tarjeta: { label: 'Tarjeta de crédito', icon: 'card' }, personal: { label: 'Deuda personal', icon: 'scale' }, otro: { label: 'Otro pasivo', icon: 'dots' } };
const GOAL_KINDS = { emergencia: { label: 'Fondo de emergencia', icon: 'shield' }, coche: { label: 'Comprar coche', icon: 'car' }, vivienda: { label: 'Comprar vivienda', icon: 'house' }, viaje: { label: 'Viaje', icon: 'globe' }, fi: { label: 'Independencia financiera', icon: 'flag' }, inversion: { label: 'Inversión', icon: 'trend' }, otro: { label: 'Otro', icon: 'target' } };
const METHODS = ['Tarjeta', 'Domiciliación', 'Transferencia', 'Bizum', 'Efectivo'];
const REC_GROUPS = { suscripcion: 'Suscripción', seguro: 'Seguro', vivienda: 'Vivienda', servicio: 'Suministro', prestamo: 'Préstamo', salud: 'Salud', otro: 'Otro', ingreso: 'Ingreso', aportacion: 'Aportación', transferencia: 'Transferencia' };
const FREQS = { mensual: { label: 'Mensual', perYear: 12 }, trimestral: { label: 'Trimestral', perYear: 4 }, anual: { label: 'Anual', perYear: 1 } };
const CLS_LABEL = { liq: 'Liquidez', rf: 'Renta fija', rv: 'Renta variable', otros: 'Otros' };
const CURRENCIES = { EUR: 'Euro (€)', USD: 'Dólar estadounidense ($)', GBP: 'Libra esterlina (£)', CHF: 'Franco suizo (CHF)', MXN: 'Peso mexicano (MXN)' };
const COUNTRIES = { ES: { label: 'España', locale: 'es-ES' }, MX: { label: 'México', locale: 'es-MX' }, AR: { label: 'Argentina', locale: 'es-AR' }, US: { label: 'Estados Unidos', locale: 'es-US' }, GB: { label: 'Reino Unido', locale: 'en-GB' }, DE: { label: 'Alemania', locale: 'de-DE' } };

/* ---------- estado ---------- */
let S = null;
const memo = { v: 0, L: null, bd: new Map() };

function defaultSettings() {
  return { currency: 'EUR', country: 'ES', dateFormat: 'dd/mm/aaaa', theme: 'system', hideAmounts: false, hideNetWorth: false, autoLock: 0, target: { rv: 60, rf: 25, liq: 10, otros: 5 }, navClosed: {} };
}

/* estado inicial de una cuenta nueva: sin movimientos, con categorías y dos cuentas vacías */
function emptyState0() {
  return {
    version: 1, demo: false, createdAt: TODAY, startDate: TODAY, settings: defaultSettings(),
    categories: EXPENSE_CATS.map((c, i) => ({ id: 'c' + i, name: c.name, icon: c.icon, nature: c.nature, subs: c.subs.slice(), ocioSubs: (c.ocioSubs || []).slice() })),
    incomeCategories: INCOME_CATS.map((c, i) => ({ id: 'ic' + i, name: c.name, icon: c.icon })),
    tags: ['necesario', 'ocio', 'viaje', 'coche', 'casa', 'suscripción', 'pareja', 'estudios', 'extraordinario'],
    accounts: [{ id: uid('a'), name: 'Cuenta principal', institution: '', type: 'corriente', initial: 0, openDate: TODAY }, { id: uid('a'), name: 'Efectivo', institution: 'Cartera', type: 'efectivo', initial: 0, openDate: TODAY }],
    tx: [], holdings: [], assets: [], liabilities: [], budgets: {}, goals: [], recurring: [], history: []
  };
}
/* el guardado cifrado lo hace auth.js (saveEncrypted) con la clave de la sesión */
let saveTimer = null;
function persist() {
  if (typeof saveEncrypted !== 'function') return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveEncrypted, 300);
}
/* Cada cambio de datos pasa por aquí: invalida cachés, guarda y repinta */
function commit(opts = {}) {
  memo.v++; memo.L = null; memo.bd.clear();
  persist();
  if (!opts.silent && typeof render === 'function') render();
}

/* ---------- formato ---------- */
let _nf = null, _nf0 = null, _pf = null;
function locale() { return (COUNTRIES[S.settings.country] || COUNTRIES.ES).locale; }
function resetFormatters() { _nf = _nf0 = _pf = null; }
function nf(dec = 2) {
  const mk = d => { try { return new Intl.NumberFormat(locale(), { style: 'currency', currency: S.settings.currency, minimumFractionDigits: d, maximumFractionDigits: d, useGrouping: 'always' }); } catch (e) { return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: d, maximumFractionDigits: d }); } };
  if (dec === 0) return _nf0 || (_nf0 = mk(0));
  return _nf || (_nf = mk(2));
}
function money(v, o = {}) {
  const dec = o.dec != null ? o.dec : 2;
  let s = nf(dec).format(Math.abs(v) < 0.005 ? 0 : (o.abs ? Math.abs(v) : v));
  s = s.replace('-', '−');
  if (o.sign && v > 0.004) s = '+' + s;
  return s;
}
/* importe protegido por el modo privacidad */
const M = (v, o = {}) => `<span class="amt${o.cls ? ' ' + o.cls : ''}">${money(v, o)}</span>`;
function compact(v) {
  const a = Math.abs(v), sym = (nf(0).formatToParts(0).find(p => p.type === 'currency') || { value: '€' }).value;
  let s;
  if (a >= 1e6) s = (v / 1e6).toFixed(1).replace('.', ',') + ' M';
  else if (a >= 1e4) s = Math.round(v / 1e3) + ' k';
  else if (a >= 1e3) s = (v / 1e3).toFixed(1).replace('.', ',').replace(',0', '') + ' k';
  else s = Math.round(v) + ' ';
  return (s + sym).replace('-', '−').replace('  ', ' ');
}
function pct(v, dec = 1, sign = false) {
  if (!isFinite(v)) return '—';
  const s = new Intl.NumberFormat(locale(), { style: 'percent', minimumFractionDigits: dec, maximumFractionDigits: dec }).format(v).replace('-', '−');
  return sign && v > 0.00005 ? '+' + s : s;
}
function numFmt(v, dec = 2) { return new Intl.NumberFormat(locale(), { minimumFractionDigits: 0, maximumFractionDigits: dec }).format(v); }
function fdate(s, short) {
  if (!s) return '—';
  const [y, m, d] = s.split('-');
  const f = S.settings.dateFormat;
  if (f === 'aaaa-mm-dd') return short ? `${m}-${d}` : s;
  if (f === 'mm/dd/aaaa') return short ? `${m}/${d}` : `${m}/${d}/${y}`;
  return short ? `${d}/${m}` : `${d}/${m}/${y}`;
}
function fdateLong(s) { const [y, m, d] = s.split('-').map(Number); return `${d} ${MONTHS_S[m - 1]} ${y}`; }
function relDays(s) {
  const n = D.diff(TODAY, s);
  if (n === 0) return 'hoy'; if (n === 1) return 'mañana'; if (n === -1) return 'ayer';
  return n > 0 ? `en ${n} días` : `hace ${-n} días`;
}
function deltaPill(v, { pctMode = true, invert = false, dec = 1 } = {}) {
  if (!isFinite(v)) return '<span class="pill flat">—</span>';
  const good = invert ? v < 0 : v > 0;
  const cls = Math.abs(v) < (pctMode ? 0.0005 : 0.5) ? 'flat' : good ? 'up' : 'down';
  const ic = v > 0 ? I('up') : v < 0 ? I('dn') : '';
  return `<span class="pill ${cls}">${ic}${pctMode ? pct(v, dec, true) : M(v, { sign: true, dec: 0 })}</span>`;
}

/* ---------- categorías ---------- */
function catByName(name, kind = 'gasto') { return (kind === 'ingreso' ? S.incomeCategories : S.categories).find(c => c.name === name); }
function catColor(name, kind = 'gasto') {
  const list = kind === 'ingreso' ? S.incomeCategories : S.categories;
  const i = list.findIndex(c => c.name === name);
  if (i < 0 || i > 7 || name === 'Otros' || name === 'Otros ingresos') return 'var(--s-other)';
  return `var(--s${i + 1})`;
}
function catIcon(name, kind = 'gasto') { const c = catByName(name, kind); return c ? c.icon : 'dots'; }
function txNature(t) {
  const c = catByName(t.category);
  if (!c) return 'ocio';
  if (c.ocioSubs && c.ocioSubs.includes(t.sub)) return 'ocio';
  return c.nature || 'necesidad';
}
const accName = id => (S.accounts.find(a => a.id === id) || { name: '—' }).name;
const holdingName = id => (S.holdings.find(h => h.id === id) || { name: '—' }).name;

/* =====================================================================
   MOTOR DE CÁLCULO
   ===================================================================== */
function txEffects(t) {
  // efecto de cada operación sobre el saldo de las cuentas
  switch (t.type) {
    case 'gasto': return [[t.account, -t.amount]];
    case 'ingreso': return [[t.account, t.amount]];
    case 'transferencia': return [[t.account, -t.amount], [t.toAccount, t.amount]];
    case 'inversion': return [[t.account, -t.amount]];
    case 'compra-activo': return t.account ? [[t.account, -t.amount]] : [];
    case 'venta': return [[t.account, t.amount]];
    case 'ajuste': return [[t.account, t.amount]]; // corrección de saldo (con signo): no es ingreso ni gasto
    default: return [];
  }
}

function ledger() {
  if (memo.L) return memo.L;
  const txs = S.tx.slice().sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
  let start = S.startDate;
  if (txs.length && txs[0].date < start) start = txs[0].date;
  const end = D.max(TODAY, txs.length ? txs[txs.length - 1].date : TODAY);
  const n = D.diff(start, end) + 1;
  const bal = {};
  S.accounts.forEach(a => { bal[a.id] = new Float64Array(n); });
  const months = {};
  const mk = ym => months[ym] || (months[ym] = { inc: 0, exp: 0, byCat: {}, byInc: {}, invest: 0, nec: 0, ocio: 0, rec: 0, count: 0 });
  for (const t of txs) {
    const i = clamp(D.diff(start, t.date), 0, n - 1);
    for (const [acc, v] of txEffects(t)) if (bal[acc]) bal[acc][i] += v;
    const m = mk(D.ym(t.date));
    if (t.type === 'gasto') {
      m.exp += t.amount; m.byCat[t.category] = (m.byCat[t.category] || 0) + t.amount; m.count++;
      if (txNature(t) === 'ocio') m.ocio += t.amount; else m.nec += t.amount;
      if (t.recurring) m.rec += t.amount;
    } else if (t.type === 'ingreso') { m.inc += t.amount; m.byInc[t.category] = (m.byInc[t.category] || 0) + t.amount; }
    else if (t.type === 'inversion') m.invest += t.amount;
  }
  for (const a of S.accounts) {
    const arr = bal[a.id]; let run = +a.initial || 0;
    for (let i = 0; i < n; i++) { run += arr[i]; arr[i] = run; }
  }
  const lots = {};
  S.holdings.forEach(h => { lots[h.id] = (h.opening || []).map(l => ({ date: l.date, units: +l.units, cost: l.units * l.price + (l.fee || 0) })); });
  for (const t of txs) {
    if (t.type === 'inversion' && lots[t.holdingId]) lots[t.holdingId].push({ date: t.date, units: +t.units, cost: +t.amount });
    if (t.type === 'venta' && lots[t.holdingId]) lots[t.holdingId].push({ date: t.date, units: -t.units, cost: -(t.costBasis || 0) });
  }
  Object.values(lots).forEach(l => l.sort((a, b) => a.date < b.date ? -1 : 1));
  const recSet = new Set(txs.filter(t => t.recurringId).map(t => t.recurringId + '|' + t.date));
  memo.L = { start, end, n, bal, months, lots, txs, recSet, desc: txs.slice().reverse() };
  return memo.L;
}
function balAt(accId, iso = TODAY) {
  const L = ledger(); const a = L.bal[accId];
  if (!a) return 0;
  if (iso < L.start) { const acc = S.accounts.find(x => x.id === accId); return acc ? +acc.initial : 0; }
  return a[clamp(D.diff(L.start, iso), 0, L.n - 1)];
}
function priceAtRaw(h, iso) {
  const pts = (h.hist || []).concat([[TODAY, h.price]]);
  if (!pts.length) return h.price || 0;
  if (iso <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) {
    if (iso <= pts[i][0]) {
      const [d0, p0] = pts[i - 1], [d1, p1] = pts[i];
      const span = D.diff(d0, d1) || 1;
      return p0 + (p1 - p0) * (D.diff(d0, iso) / span);
    }
  }
  return h.price;
}
const priceAt = priceAtRaw;
function unitsAt(h, iso = TODAY) { return sum((ledger().lots[h.id] || []).filter(l => l.date <= iso), l => l.units); }
function costAt(h, iso = TODAY) { return sum((ledger().lots[h.id] || []).filter(l => l.date <= iso), l => l.cost); }
function valueAt(h, iso = TODAY) { const u = unitsAt(h, iso); return u ? u * priceAt(h, iso) : 0; }
function assetValueAt(a, iso = TODAY) {
  if (a.acquired && iso < a.acquired) return 0;
  const years = D.diff(TODAY, iso) / 365.25;
  return a.value * Math.pow(1 + (a.annualChange || 0) / 100, years);
}
function liabBalanceAt(l, iso = TODAY) {
  if (l.revolving || !l.months) return iso < (l.start || '0000') ? 0 : +l.balance || 0;
  if (iso < l.start) return 0;
  const r = l.rate / 100 / 12;
  let b = l.principal;
  const k = Math.min(l.months, Math.max(0, D.ymDiff(D.ym(l.start), D.ym(iso)) + (+iso.slice(8) >= +l.start.slice(8) ? 1 : 0) - 1));
  for (let i = 0; i < k; i++) { const interest = b * r; b = Math.max(0, b - (l.payment - interest)); }
  return round2(b);
}
function liabSchedule(l) {
  if (l.revolving || !l.months) return null;
  const r = l.rate / 100 / 12; let b = l.principal; const out = [];
  for (let i = 0; i < l.months && b > 0.01; i++) { const interest = b * r; const princ = Math.min(b, l.payment - interest); b -= princ; out.push({ n: i + 1, date: D.addMonthsISO(l.start, i + 1), interest, princ, bal: b }); }
  return out;
}

/* desglose patrimonial en una fecha */
function breakdown(iso = TODAY) {
  const key = iso + '|' + memo.v;
  if (memo.bd.has(key)) return memo.bd.get(key);
  const b = { liq: 0, rf: 0, rv: 0, crypto: 0, fisicos: 0, liab: 0, bancos: 0, efectivo: 0, fondos: 0, acciones: 0, bonos: 0, otros: 0, acc: {}, hold: {} };
  for (const a of S.accounts) {
    const v = balAt(a.id, iso); b.acc[a.id] = v; b.liq += v;
    if (a.type === 'efectivo') b.efectivo += v; else b.bancos += v;
  }
  for (const h of S.holdings) {
    const v = valueAt(h, iso); b.hold[h.id] = v;
    const k = HOLDING_KINDS[h.kind] || HOLDING_KINDS.fondo;
    if (k.cls === 'rv') b.rv += v; else if (k.cls === 'rf') b.rf += v; else b.crypto += v;
    if (k.group === 'fondos') b.fondos += v; else if (k.group === 'acciones') b.acciones += v; else if (k.group === 'bonos') b.bonos += v; else b.otros += v;
  }
  for (const a of S.assets) { const v = assetValueAt(a, iso); b.fisicos += v; b.otros += v; }
  for (const l of S.liabilities) b.liab += liabBalanceAt(l, iso);
  b.invested = b.rv + b.rf + b.crypto;
  b.assets = b.liq + b.invested + b.fisicos;
  b.nw = b.assets - b.liab;
  b.financial = b.liq + b.invested;
  memo.bd.set(key, b);
  return b;
}
/* patrimonio neto en una fecha, usando el histórico importado si es anterior a los movimientos */
function nwAt(iso) {
  const L = ledger();
  if (iso < L.start && S.history.length) {
    const ym = D.ym(iso); const h = S.history.find(x => x.m === ym) || S.history[0];
    return iso < D.mk(S.history[0].m, 1) ? null : h.nw;
  }
  return breakdown(iso).nw;
}
function firstDate() { return S.history.length ? D.monthEnd(S.history[0].m) : ledger().start; }

/* flujos de un mes */
function monthStats(ym) {
  const m = ledger().months[ym] || { inc: 0, exp: 0, byCat: {}, byInc: {}, invest: 0, nec: 0, ocio: 0, rec: 0, count: 0 };
  return Object.assign({}, m, { save: m.inc - m.exp, rate: m.inc > 0 ? (m.inc - m.exp) / m.inc : 0 });
}
function rangeStats(from, to) {
  const out = { inc: 0, exp: 0, byCat: {}, byInc: {}, bySub: {}, byTag: {}, nec: 0, ocio: 0, rec: 0, txs: [], max: null };
  for (const t of ledger().txs) {
    if (t.date < from || t.date > to) continue;
    if (t.type === 'gasto') {
      out.exp += t.amount; out.byCat[t.category] = (out.byCat[t.category] || 0) + t.amount;
      const sk = t.category + ' › ' + (t.sub || '—'); out.bySub[sk] = (out.bySub[sk] || 0) + t.amount;
      (t.tags || []).forEach(g => { out.byTag[g] = (out.byTag[g] || 0) + t.amount; });
      if (txNature(t) === 'ocio') out.ocio += t.amount; else out.nec += t.amount;
      if (t.recurring) out.rec += t.amount;
      if (!out.max || t.amount > out.max.amount) out.max = t;
      out.txs.push(t);
    } else if (t.type === 'ingreso') { out.inc += t.amount; out.byInc[t.category] = (out.byInc[t.category] || 0) + t.amount; out.txs.push(t); }
  }
  out.save = out.inc - out.exp; out.rate = out.inc > 0 ? out.save / out.inc : 0;
  return out;
}
/* mes de referencia: el de la última nómina registrada (evita mostrar un mes recién empezado vacío) */
function refMonth() {
  const cur = D.ym(TODAY);
  const day = +TODAY.slice(8);
  const curInc = monthStats(cur).inc;
  if (curInc > 0 || day >= 25) return cur;
  const prev = monthStats(D.ymAdd(cur, -1));
  return prev.inc > 0 || prev.exp > 0 ? D.ymAdd(cur, -1) : cur;
}
function monthsBack(n, endYM = D.ym(TODAY)) { const out = []; for (let i = n - 1; i >= 0; i--) out.push(D.ymAdd(endYM, -i)); return out; }

/* recurrentes */
function monthlyEq(r) { return r.amount * (FREQS[r.freq] || FREQS.mensual).perYear / 12; }
function nextOccurrence(r, from = TODAY) {
  const freq = r.freq || 'mensual';
  let ym = D.ym(from);
  for (let i = 0; i < 26; i++) {
    const mo = +ym.slice(5);
    const ok = freq === 'mensual' || (freq === 'anual' && mo === (r.month || 1)) || (freq === 'trimestral' && ((mo - (r.month || 1)) % 3 + 3) % 3 === 0);
    if (ok) { const d = D.mk(ym, r.day || 1); if (d >= from && !ledger().recSet.has(r.id + '|' + d)) return d; }
    ym = D.ymAdd(ym, 1);
  }
  return null;
}
function occurrencesBetween(r, from, to) {
  const out = []; let d = nextOccurrence(r, from);
  let guard = 0;
  while (d && d <= to && guard++ < 60) { out.push(d); d = nextOccurrence(r, D.add(d, 1)); }
  return out;
}

/* inversiones */
function holdingStats(h) {
  const units = unitsAt(h), cost = costAt(h), value = units * h.price;
  const gain = value - cost;
  return { units, cost, value, gain, gainPct: cost > 0 ? gain / cost : 0, avg: units ? cost / units : 0 };
}
function portfolio() {
  const hs = S.holdings.map(h => Object.assign({ h }, holdingStats(h))).filter(x => x.units > 0.0000001);
  const cost = sum(hs, x => x.cost), value = sum(hs, x => x.value);
  const L = ledger();
  const brokerIds = S.accounts.filter(a => a.type === 'broker').map(a => a.id);
  const inv = L.txs.filter(t => t.type === 'ingreso' && (t.category === 'Dividendos' || t.category === 'Ingresos por inversiones' || (t.category === 'Intereses' && (brokerIds.includes(t.account) || /cup[oó]n/i.test(t.concept)))));
  const dividends = sum(inv.filter(t => t.category === 'Dividendos'), t => t.amount);
  const interest = sum(L.txs.filter(t => t.type === 'ingreso' && t.category === 'Intereses'), t => t.amount);
  const couponInt = sum(inv.filter(t => t.category === 'Intereses'), t => t.amount);
  const other = sum(inv.filter(t => t.category === 'Ingresos por inversiones'), t => t.amount);
  return { hs, cost, value, gain: value - cost, gainPct: cost ? (value - cost) / cost : 0, dividends, interest, couponInt, other, totalReturn: value - cost + dividends + couponInt + other };
}
function investValueAt(iso) { const b = breakdown(iso); return b.invested; }
function contributedAt(iso) { return sum(S.holdings, h => costAt(h, iso)); }
/* rentabilidad mensual (Dietz modificado) de la cartera */
function monthlyReturns() {
  const L = ledger(); const out = [];
  const startYM = D.ym(L.start);
  const months = D.ymDiff(startYM, D.ym(TODAY));
  for (let i = 1; i <= months; i++) {
    const ym = D.ymAdd(startYM, i);
    const prevEnd = D.monthEnd(D.ymAdd(ym, -1));
    const end = ym === D.ym(TODAY) ? TODAY : D.monthEnd(ym);
    const v0 = investValueAt(prevEnd), v1 = investValueAt(end);
    const c = contributedAt(end) - contributedAt(prevEnd);
    const denom = v0 + c / 2;
    out.push({ ym, v0, v1, c, gain: v1 - v0 - c, r: denom > 0 ? (v1 - v0 - c) / denom : 0 });
  }
  return out;
}
function chain(rs) { return rs.reduce((a, x) => a * (1 + x.r), 1) - 1; }

/* asignación de activos (patrimonio financiero) */
function allocation(iso = TODAY) {
  const b = breakdown(iso);
  const tot = b.financial || 1;
  return { rv: b.rv / tot, rf: b.rf / tot, liq: b.liq / tot, otros: b.crypto / tot, total: b.financial, abs: { rv: b.rv, rf: b.rf, liq: b.liq, otros: b.crypto } };
}

/* objetivos */
function goalCurrent(g) {
  if (g.accountId) return balAt(g.accountId);
  if (g.linkInvest) return breakdown().invested;
  return +g.current || 0;
}
function goalStats(g) {
  const cur = goalCurrent(g), rem = Math.max(0, g.target - cur);
  const months = Math.max(1, D.ymDiff(D.ym(TODAY), D.ym(g.date)));
  const need = rem / months;
  const projected = cur + (g.monthly || 0) * months;
  const pctv = g.target > 0 ? cur / g.target : 0;
  const onTrack = rem <= 0 || (g.monthly || 0) >= need - 0.5;
  const eta = g.monthly > 0 ? D.ymAdd(D.ym(TODAY), Math.ceil(rem / g.monthly)) : null;
  return { cur, rem, months, need, projected, pct: pctv, onTrack, eta, done: rem <= 0 };
}

/* presupuestos */
function budgetStatus(ym) {
  const ms = monthStats(ym);
  return Object.entries(S.budgets).filter(([, v]) => v > 0).map(([cat, limit]) => {
    const spent = ms.byCat[cat] || 0; const p = spent / limit;
    return { cat, limit, spent, left: limit - spent, pct: p, state: p > 1 ? 'over' : p >= 0.85 ? 'near' : 'ok' };
  });
}

/* alertas inteligentes, en tono informativo */
function computeAlerts() {
  const out = [];
  const ym = refMonth(); const prev = D.ymAdd(ym, -1);
  budgetStatus(ym).forEach(b => {
    if (b.state === 'over') out.push({ lvl: 'crit', icon: 'alert', t: `Has superado el presupuesto de ${b.cat.toLowerCase()}`, s: `${money(b.spent)} de ${money(b.limit)} en ${monthLabel(ym).toLowerCase()} (${money(-b.left)} por encima).`, go: 'presupuestos' });
    else if (b.state === 'near') out.push({ lvl: 'warn', icon: 'info', t: `${b.cat}: cerca del límite`, s: `Has usado el ${pct(b.pct, 0)} del presupuesto. Quedan ${money(b.left)}.`, go: 'presupuestos' });
  });
  const a = monthStats(ym), p = monthStats(prev);
  if (p.exp > 0 && a.exp > p.exp * 1.1) out.push({ lvl: 'info', icon: 'trend', t: 'Tus gastos han aumentado respecto al mes anterior', s: `${money(a.exp)} frente a ${money(p.exp)} (${pct(a.exp / p.exp - 1, 1, true)}).`, go: 'an-gastos' });
  const last3 = [1, 2, 3].map(k => monthStats(D.ymAdd(ym, -k)).rate);
  const avg3 = sum(last3) / 3;
  if (a.rate < avg3 - 0.03) out.push({ lvl: 'info', icon: 'piggy', t: 'Tu tasa de ahorro ha bajado', s: `${pct(a.rate)} este mes frente a una media de ${pct(avg3)} en los tres anteriores.`, go: 'ahorro' });
  const soon = S.recurring.filter(r => r.active && r.kind === 'gasto').map(r => ({ r, n: nextOccurrence(r) })).filter(x => x.n && D.diff(TODAY, x.n) <= 5).sort((a, b) => a.n < b.n ? -1 : 1);
  if (soon.length === 1) out.push({ lvl: 'info', icon: 'repeat', t: `${soon[0].r.name} se cobrará ${relDays(soon[0].n)}`, s: `${money(soon[0].r.amount)} desde ${accName(soon[0].r.account)}.`, go: 'recurrentes' });
  else if (soon.length > 1) out.push({ lvl: 'info', icon: 'repeat', t: `${soon.length} cobros recurrentes en los próximos días`, s: soon.map(x => `${x.r.name} ${relDays(x.n)} (${money(x.r.amount)})`).join(' · '), go: 'recurrentes' });
  const al = allocation(); const tg = S.settings.target;
  if (breakdown().invested > 0) ['rv', 'rf', 'liq', 'otros'].forEach(k => {
    const dev = al[k] * 100 - tg[k];
    if (Math.abs(dev) >= 5) out.push({ lvl: 'warn', icon: 'pie', t: `${CLS_LABEL[k]} se ha desviado de tu asignación objetivo`, s: `${pct(al[k])} actual frente a ${tg[k]} % objetivo (${dev > 0 ? '+' : '−'}${numFmt(Math.abs(dev), 1)} puntos).`, go: 'asignacion' });
  });
  S.holdings.filter(h => h.maturity && unitsAt(h) > 0).forEach(h => {
    const dd = D.diff(TODAY, h.maturity);
    if (dd >= 0 && dd <= 60) out.push({ lvl: 'info', icon: 'shield', t: `${h.name} vence ${relDays(h.maturity)}`, s: `Recibirás ${money(unitsAt(h) * (h.nominal || 0))} de nominal el ${fdate(h.maturity)}.`, go: 'bonos' });
  });
  S.goals.forEach(g => { const st = goalStats(g); if (!st.done && !st.onTrack && st.months < 24) out.push({ lvl: 'info', icon: 'flag', t: `${g.name}: el ritmo actual no llega a tiempo`, s: `Necesitas ${money(st.need)}/mes y tienes previsto ${money(g.monthly || 0)}/mes.`, go: 'objetivos' }); });
  const order = { crit: 0, warn: 1, info: 2 };
  return out.sort((x, y) => order[x.lvl] - order[y.lvl]);
}
