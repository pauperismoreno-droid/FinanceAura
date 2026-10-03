/* Patrimonia — arranque, navegación, tema, privacidad y atajos */
'use strict';

const NAV = [
  { g: 'Inicio', icon: 'home', items: [['resumen', 'Resumen'], ['balance', 'Patrimonio'], ['flujo', 'Flujo de caja']] },
  { g: 'Movimientos', icon: 'moves', items: [['gastos', 'Gastos'], ['ingresos', 'Ingresos'], ['transferencias', 'Transferencias']] },
  { g: 'Patrimonio', icon: 'bank', items: [['cuentas', 'Cuentas'], ['efectivo', 'Efectivo'], ['activos', 'Activos'], ['pasivos', 'Pasivos']] },
  { g: 'Inversiones', icon: 'trend', items: [['cartera', 'Cartera'], ['fondos', 'Fondos indexados'], ['acciones', 'Acciones'], ['bonos', 'Bonos'], ['rentabilidad', 'Rentabilidad'], ['asignacion', 'Asignación de activos']] },
  { g: 'Planificación', icon: 'target', items: [['presupuestos', 'Presupuestos'], ['objetivos', 'Objetivos'], ['ahorro', 'Ahorro'], ['recurrentes', 'Recurrentes'], ['calendario', 'Calendario']] },
  { g: 'Análisis', icon: 'pie', items: [['an-gastos', 'Gastos'], ['an-ingresos', 'Ingresos'], ['an-patrimonio', 'Patrimonio'], ['an-rentabilidad', 'Rentabilidad'], ['informes', 'Informes']] },
  { single: 'ajustes', label: 'Configuración', icon: 'sliders' }
];
const BRAND_MARK = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M5 19V13M10 19V9M15 19V11M20 19V5" style="fill:none;stroke:currentColor;stroke-width:2.4;stroke-linecap:round"/></svg>';
let currentRoute = null;
const initials = n => (String(n || '').trim().split(/\s+/).slice(0, 2).map(w => w[0] || '').join('') || '·').toUpperCase();
let hostTheme = null;

function routeFromHash() { const h = decodeURIComponent(location.hash.replace('#', '')); return VIEWS[h] ? h : 'resumen'; }
function groupOf(r) { const g = NAV.find(x => x.items && x.items.some(i => i[0] === r)); return g ? g.g : null; }
function navigate(r, params) {
  UIS.params = params || {};
  closePop(); closeNav();
  if (routeFromHash() === r && location.hash) render(); else location.hash = r;
}

/* ---------- estructura ---------- */
function shell() {
  $('#app').innerHTML = `
    <aside class="side" id="side" aria-label="Navegación principal">
      <div class="brand"><span class="brand-mark">${BRAND_MARK}</span><div><div class="brand-name">Patrimonia</div><div class="brand-sub">Finanzas y patrimonio</div></div></div>
      <nav class="nav" id="nav"></nav>
      <div class="side-foot" id="sideFoot"></div>
    </aside>
    <div class="side-scrim" id="sideScrim"></div>
    <div class="main">
      <header class="top" id="top">
        <button class="icon-btn menu-btn" id="menuBtn" type="button" aria-label="Abrir menú">${I('menu')}</button>
        <div class="top-title"><div class="crumb" id="crumb"></div><h1 class="page-h" id="pageH"></h1></div>
        <div class="top-actions">
          <button class="search-btn" id="searchBtn" type="button" aria-label="Buscar (Ctrl+K)">${I('search', 'sm')}<span class="sb-t">Buscar…</span><kbd>Ctrl K</kbd></button>
          <button class="icon-btn" id="privBtn" type="button" aria-label="Ocultar importes" title="Ocultar importes (H)"></button>
          <button class="icon-btn hide-sm" id="themeBtn" type="button" aria-label="Cambiar tema" title="Modo claro / oscuro"></button>
          <button class="icon-btn" id="bellBtn" type="button" aria-label="Avisos" title="Avisos">${I('bell')}<span class="dot" id="bellDot" hidden></span></button>
          <button class="btn primary add-btn" id="addBtn" type="button" aria-haspopup="menu">${I('plus', 'sm')}Añadir</button>
          <button class="avatar-btn" id="userBtn" type="button" aria-haspopup="menu" aria-label="Tu cuenta">${esc(initials(AUTH.user ? AUTH.user.name : ''))}</button>
        </div>
      </header>
      <main class="content" id="content" tabindex="-1"></main>
    </div>
    <nav class="bottom-nav" aria-label="Navegación rápida">
      <a href="#resumen" data-bn="resumen">${I('home')}<span>Inicio</span></a>
      <a href="#gastos" data-bn="Movimientos">${I('moves')}<span>Movimientos</span></a>
      <button class="fab" id="fabBtn" type="button" aria-label="Añadir"><span class="fab-c">${I('plus')}</span></button>
      <a href="#cartera" data-bn="Inversiones">${I('trend')}<span>Inversiones</span></a>
      <button type="button" id="moreBtn" data-bn="more">${I('grid')}<span>Más</span></button>
    </nav>`;
  $('#menuBtn').onclick = openNav; $('#moreBtn').onclick = openNav; $('#sideScrim').onclick = closeNav;
  $('#searchBtn').onclick = openSearch;
  $('#privBtn').onclick = togglePrivacy;
  $('#themeBtn').onclick = () => { S.settings.theme = effectiveDark() ? 'light' : 'dark'; applyTheme(); persist(); render(); };
  $('#bellBtn').onclick = e => { if (openPop && openPop.anchor === $('#bellBtn')) closePop(); else alertsPanel($('#bellBtn')); };
  $('#addBtn').onclick = () => { if (openPop && openPop.anchor === $('#addBtn')) closePop(); else addMenu($('#addBtn')); };
  $('#fabBtn').onclick = () => addMenu($('#fabBtn'));
  $('#userBtn').onclick = () => {
    const b = $('#userBtn'); if (openPop && openPop.anchor === b) { closePop(); return; }
    popover(b, `<div style="padding:10px 10px 8px"><div class="mi-t">${esc(AUTH.user.name)}</div><div class="mi-s">${esc(AUTH.user.username)}</div></div><div class="divider"></div>
      <button class="menu-item" data-um="ajustes" type="button"><span class="mi-ic" style="background:var(--surface-3)">${I('sliders', 'sm')}</span><span class="mi-t">Configuración</span></button>
      <button class="menu-item" data-um="lock" type="button"><span class="mi-ic" style="background:var(--surface-3)">${I('lock', 'sm')}</span><span class="mi-t">Bloquear</span><kbd>L</kbd></button>
      <button class="menu-item" data-um="out" type="button"><span class="mi-ic" style="background:var(--surface-3)">${I('right', 'sm')}</span><span class="mi-t">Cerrar sesión</span></button>`, {
      onMount: p => p.querySelectorAll('[data-um]').forEach(x => x.onclick = () => { closePop(); const a = x.dataset.um; if (a === 'ajustes') navigate('ajustes'); else if (a === 'lock') lockNow(); else logout(); })
    });
  };
  window.addEventListener('scroll', () => $('#top').classList.toggle('scrolled', window.scrollY > 4), { passive: true });
}
function renderNav(route) {
  const ag = groupOf(route);
  $('#nav').innerHTML = NAV.map(g => {
    if (g.single) return `<a class="nav-single${route === g.single ? ' active' : ''}" href="#${g.single}" style="margin-top:8px">${I(g.icon)}${esc(g.label)}</a>`;
    const closed = S.settings.navClosed[g.g] && ag !== g.g;
    return `<div class="nav-group${closed ? ' closed' : ''}${ag === g.g ? ' active' : ''}"><button class="nav-group-h" type="button" data-ng="${esc(g.g)}" aria-expanded="${!closed}">${I(g.icon)}${esc(g.g)}${I('down', 'sm chev')}</button>
      <div class="nav-items">${g.items.map(([k, l]) => `<a class="nav-link${route === k ? ' active' : ''}" href="#${k}"${route === k ? ' aria-current="page"' : ''}>${esc(l)}</a>`).join('')}</div></div>`;
  }).join('');
  $$('[data-ng]').forEach(b => b.onclick = () => { const g = b.dataset.ng; S.settings.navClosed[g] = !b.parentElement.classList.contains('closed'); b.parentElement.classList.toggle('closed'); b.setAttribute('aria-expanded', !S.settings.navClosed[g]); persist(); });
  $$('#nav a').forEach(a => a.addEventListener('click', closeNav));
  $('#sideFoot').innerHTML = `<div class="demo-badge" style="background:var(--accent-soft)">${I('lock', 'sm')}<div><b>${esc(AUTH.user ? AUTH.user.name : '')}</b>Datos cifrados con tu contraseña en este dispositivo.</div></div><button class="btn sm ghost" type="button" data-sideout style="justify-content:flex-start">${I('right', 'sm')}Cerrar sesión</button>`;
  const so = $('[data-sideout]'); if (so) so.onclick = logout;
  $$('[data-bn]').forEach(a => a.classList.toggle('on', a.dataset.bn === route || a.dataset.bn === groupOf(route) || (a.dataset.bn === 'resumen' && groupOf(route) === 'Inicio')));
}
function openNav() { $('#app').classList.add('nav-open'); }
function closeNav() { const a = $('#app'); if (a) a.classList.remove('nav-open'); }

/* ---------- pintado ---------- */
function render() {
  const r = routeFromHash();
  const changed = r !== currentRoute; currentRoute = r;
  const v = VIEWS[r];
  if (chartRO) chartRO.disconnect();
  hideTip();
  const y = window.scrollY;
  const content = $('#content');
  let html;
  try { html = v.html(); } catch (e) { console.error(e); html = emptyState('alert', 'No se ha podido mostrar esta sección', 'Prueba a recargar la página. Tus datos siguen guardados.'); }
  content.innerHTML = `<div class="${changed ? 'view' : ''}">${html}</div>`;
  try { v.after && v.after(); } catch (e) { console.error(e); }
  renderNav(r);
  $('#crumb').textContent = v.crumb || '';
  $('#pageH').textContent = v.title;
  const n = computeAlerts().length; const dot = $('#bellDot'); dot.hidden = !n; dot.textContent = n;
  $('#privBtn').innerHTML = I(S.settings.hideAmounts ? 'eyeoff' : 'eye'); $('#privBtn').classList.toggle('on', S.settings.hideAmounts);
  $('#privBtn').setAttribute('aria-pressed', S.settings.hideAmounts);
  $('#themeBtn').innerHTML = I(effectiveDark() ? 'sun' : 'moon');
  if (changed) { window.scrollTo(0, 0); } else window.scrollTo(0, y);
}

/* ---------- tema ---------- */
function effectiveDark() {
  const t = S.settings.theme;
  if (t === 'dark') return true; if (t === 'light') return false;
  if (hostTheme) return hostTheme === 'dark';
  return window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches;
}
function applyTheme() {
  const t = S.settings.theme, root = document.documentElement;
  if (t === 'system') { if (hostTheme) root.dataset.theme = hostTheme; else delete root.dataset.theme; }
  else root.dataset.theme = t;
}

/* ---------- privacidad ---------- */
function applyPrivacy() {
  document.body.classList.toggle('privacy', !!S.settings.hideAmounts);
  document.body.classList.toggle('hide-nw', !!S.settings.hideNetWorth);
  const b = $('#privBtn'); if (b) { b.innerHTML = I(S.settings.hideAmounts ? 'eyeoff' : 'eye'); b.classList.toggle('on', S.settings.hideAmounts); b.setAttribute('aria-pressed', S.settings.hideAmounts); }
}
function togglePrivacy() { S.settings.hideAmounts = !S.settings.hideAmounts; applyPrivacy(); persist(); toast(S.settings.hideAmounts ? 'Importes ocultos' : 'Importes visibles'); }
let lockTimer = null;
function lockNow() {
  if ($('.lock')) return;
  closePop(); hideTip();
  const l = document.createElement('div'); l.className = 'lock'; l.setAttribute('role', 'dialog'); l.setAttribute('aria-label', 'Información bloqueada');
  l.innerHTML = `<form class="lk" novalidate><span class="lk-ic">${I('lock', 'lg')}</span><h2 style="margin:6px 0 0;font-size:20px">Sesión bloqueada</h2><p class="muted" style="margin:0;max-width:34ch">${esc(AUTH.user ? AUTH.user.name : '')}, escribe tu contraseña para volver a ver tus cifras.</p>
    <input class="input" type="password" id="unlockPw" autocomplete="current-password" aria-label="Contraseña" style="max-width:280px"/><span class="err" data-uerr></span>
    <div class="row"><button class="btn" type="button" data-out>Cerrar sesión</button><button class="btn primary" type="submit">${I('eye', 'sm')}Desbloquear</button></div></form>`;
  document.body.appendChild(l);
  const f = l.querySelector('form'), pw = l.querySelector('#unlockPw');
  setTimeout(() => pw.focus(), 30);
  l.querySelector('[data-out]').onclick = logout;
  f.onsubmit = async e => {
    e.preventDefault();
    const b = f.querySelector('[type=submit]'); b.disabled = true;
    if (await verifyPassword(pw.value)) { l.remove(); armLock(); }
    else { f.querySelector('[data-uerr]').textContent = 'Contraseña incorrecta.'; pw.value = ''; pw.focus(); b.disabled = false; }
  };
}
function armLock() {
  clearTimeout(lockTimer);
  const m = +S.settings.autoLock || 0;
  if (m > 0 && !$('.lock')) lockTimer = setTimeout(lockNow, m * 60000);
}

/* ---------- atajos ---------- */
function onKey(e) {
  armLock();
  if (e.key === 'Escape') {
    if (closePop()) return; if (closeTopModal()) return;
    if ($('#app').classList.contains('nav-open')) { closeNav(); return; }
    return;
  }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); openSearch(); return; }
  const t = e.target;
  if (t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable)) return;
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (modalStack.length || $('.palette') || $('.lock')) return;
  const k = e.key.toLowerCase();
  const map = { g: 'gasto', i: 'ingreso', t: 'transferencia', v: 'inversion', a: 'activo', p: 'pasivo' };
  if (map[k]) { e.preventDefault(); closePop(); openAdd(map[k]); return; }
  if (k === 'n') { e.preventDefault(); const b = $('#addBtn').offsetParent ? $('#addBtn') : $('#fabBtn'); addMenu(b); return; }
  if (k === '/') { e.preventDefault(); openSearch(); return; }
  if (k === 'h') { togglePrivacy(); return; }
  if (k === 'l') { lockNow(); return; }
}

/* ---------- arranque ---------- */
function init() {
  hostTheme = document.documentElement.dataset.theme || null;
  lsDel('patrimonia:v1'); // datos de la versión anterior (demostración), sin cifrar
  AUTH.users = loadUsers();
  authScreen();
}
let appStarted = false;
function startApp() {
  applyTheme(); applyPrivacy();
  $('#app').className = 'app';
  shell();
  if (!appStarted) {
    appStarted = true;
    window.addEventListener('hashchange', () => { if (S) render(); });
    document.addEventListener('keydown', onKey);
    ['pointerdown', 'scroll'].forEach(ev => document.addEventListener(ev, armLock, { passive: true }));
    if (window.matchMedia) matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { if (S && S.settings.theme === 'system') render(); });
    // el visor puede cambiar el tema desde fuera: lo respetamos en modo «Sistema»
    new MutationObserver(() => {
      const cur = document.documentElement.dataset.theme || null;
      if (S && S.settings.theme === 'system' && cur !== hostTheme) { hostTheme = cur; const b = $('#themeBtn'); if (b) b.innerHTML = I(effectiveDark() ? 'sun' : 'moon'); }
    }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    window.addEventListener('pagehide', () => { if (S) { clearTimeout(saveTimer); saveEncrypted(); } });
  }
  currentRoute = null;
  render();
  armLock();
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
