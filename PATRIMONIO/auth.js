/* Patrimonia — cuentas de usuario locales con datos cifrados (PBKDF2 + AES-GCM)
   Cada usuario tiene su propio espacio en este navegador. Los datos se guardan cifrados
   con una clave derivada de su contraseña: sin ella no se pueden leer. */
'use strict';

const AUTH = { users: [], user: null, key: null, fails: 0, waitUntil: 0 };
const USERS_KEY = 'patrimonia:users', DATA_PREFIX = 'patrimonia:data:', LAST_KEY = 'patrimonia:last';
const KDF_ITER = 310000;
const te = new TextEncoder(), td = new TextDecoder();

function toB64(buf) { const b = new Uint8Array(buf); let s = ''; for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000)); return btoa(s); }
function fromB64(s) { const bin = atob(s); const out = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i); return out; }
function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
function lsSet(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } }
function lsDel(k) { try { localStorage.removeItem(k); } catch (e) { } }
function storageOK() { try { const k = '__p_test'; localStorage.setItem(k, '1'); localStorage.removeItem(k); return true; } catch (e) { return false; } }
function loadUsers() { try { const u = JSON.parse(lsGet(USERS_KEY) || '[]'); return Array.isArray(u) ? u : []; } catch (e) { return []; } }
function saveUsers() { return lsSet(USERS_KEY, JSON.stringify(AUTH.users)); }
const findUser = name => AUTH.users.find(u => norm(u.username) === norm(name));

async function deriveKey(password, salt, iter = KDF_ITER) {
  const base = await crypto.subtle.importKey('raw', te.encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: iter, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
async function encryptObj(key, obj) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, te.encode(JSON.stringify(obj)));
  return JSON.stringify({ v: 1, iv: toB64(iv), ct: toB64(ct) });
}
async function decryptObj(key, raw) {
  const o = JSON.parse(raw);
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(o.iv) }, key, fromB64(o.ct));
  return JSON.parse(td.decode(pt));
}
/* comprueba la contraseña descifrando los datos guardados: el cifrado autenticado falla si no coincide */
async function openWith(user, password) {
  const key = await deriveKey(password, fromB64(user.salt), user.iter || KDF_ITER);
  const raw = lsGet(DATA_PREFIX + user.id);
  if (!raw) throw new Error('missing');
  const data = await decryptObj(key, raw);
  return { key, data };
}

let saving = Promise.resolve();
function saveEncrypted() {
  if (!AUTH.key || !AUTH.user || !S) return;
  const key = AUTH.key, id = AUTH.user.id, snapshot = S;
  saving = saving.then(async () => {
    const blob = await encryptObj(key, snapshot);
    if (!lsSet(DATA_PREFIX + id, blob)) toast('No queda espacio en este navegador. Descarga una copia de seguridad.');
  }).catch(() => toast('No se han podido guardar los cambios'));
}

function startSession(user, key, data) {
  AUTH.user = user; AUTH.key = key; AUTH.fails = 0;
  S = data; S.settings = Object.assign(defaultSettings(), S.settings || {});
  memo.v++; memo.L = null; memo.bd.clear(); resetFormatters();
  lsSet(LAST_KEY, user.username);
  startApp();
}
async function logout() {
  clearTimeout(saveTimer); saveEncrypted();
  try { await saving; } catch (e) { }
  AUTH.key = null; S = null;
  location.hash = '';
  location.reload();
}
function renameUser(name) { const u = AUTH.users.find(x => x.id === AUTH.user.id); u.name = name; AUTH.user.name = name; saveUsers(); }
async function verifyPassword(password) { try { await openWith(AUTH.user, password); return true; } catch (e) { return false; } }

/* ---------- pantalla de acceso ---------- */
function pwStrength(p) {
  let s = 0; if (p.length >= 8) s++; if (p.length >= 12) s++; if (/[A-Z]/.test(p) && /[a-z]/.test(p)) s++; if (/\d/.test(p)) s++; if (/[^A-Za-z0-9]/.test(p)) s++;
  return Math.min(4, s);
}
const PW_LABELS = ['Muy débil', 'Débil', 'Aceptable', 'Buena', 'Fuerte'];
function pwField(id, label, autocomplete, extra = '') {
  return `<div class="field"><label for="${id}">${label}</label><div class="pw-wrap"><input class="input" type="password" id="${id}" name="${id}" autocomplete="${autocomplete}" ${extra}/><button type="button" class="pw-eye" data-eye="${id}" aria-label="Mostrar contraseña">${I('eye', 'sm')}</button></div><span class="err"></span></div>`;
}
function authScreen(mode) {
  if (!mode) mode = AUTH.users.length ? 'login' : 'register';
  const last = lsGet(LAST_KEY) || '';
  const noStore = !storageOK();
  const noCrypto = !(window.crypto && crypto.subtle);
  $('#app').className = 'auth';
  $('#app').innerHTML = `
    <section class="auth-side" aria-hidden="true">
      <div class="brand"><span class="brand-mark">${BRAND_MARK}</span><div><div class="brand-name">Patrimonia</div><div class="brand-sub">Finanzas y patrimonio</div></div></div>
      <div class="auth-pitch">
        <h2>Tu patrimonio, en orden y en un solo lugar.</h2>
        <ul>
          <li>${I('home', 'sm')}<span>Ingresos, gastos, ahorro y presupuestos al día</span></li>
          <li>${I('trend', 'sm')}<span>Fondos, acciones y bonos, separando lo aportado de lo ganado</span></li>
          <li>${I('lock', 'sm')}<span>Datos cifrados con tu contraseña en tu dispositivo</span></li>
        </ul>
      </div>
      <div class="auth-eq"><span>Activos</span><span class="op">−</span><span>Pasivos</span><span class="op">=</span><b>Patrimonio neto</b></div>
    </section>
    <main class="auth-main">
      <div class="auth-card">
        <div class="brand auth-brand-sm"><span class="brand-mark">${BRAND_MARK}</span><div class="brand-name">Patrimonia</div></div>
        <div class="seg auth-tabs" role="tablist">
          <button type="button" role="tab" data-mode="login" class="${mode === 'login' ? 'on' : ''}" aria-selected="${mode === 'login'}">Iniciar sesión</button>
          <button type="button" role="tab" data-mode="register" class="${mode === 'register' ? 'on' : ''}" aria-selected="${mode === 'register'}">Crear cuenta</button>
        </div>
        ${noStore || noCrypto ? `<div class="note" style="border-color:var(--crit)">${I('alert', 'sm')}<span>${noCrypto ? 'Este navegador no permite cifrar datos. Prueba con una versión reciente de Chrome, Edge, Firefox o Safari.' : 'Este navegador no permite guardar datos (¿modo privado?). Podrás entrar, pero no se conservará nada al cerrar.'}</span></div>` : ''}
        ${mode === 'login' ? `
        <form id="authF" class="stack" novalidate>
          <div><h1 class="auth-h">Bienvenido de nuevo</h1><p class="muted" style="margin:4px 0 0">Entra para ver tus finanzas.</p></div>
          ${field('Usuario o correo', `<input class="input" id="lUser" name="lUser" autocomplete="username" value="${esc(last)}" ${last ? '' : 'autofocus'}/>`, { id: 'lUser' })}
          ${pwField('lPass', 'Contraseña', 'current-password', last ? 'autofocus' : '')}
          <span class="err" data-ferr></span>
          <button class="btn primary auth-submit" type="submit">Entrar</button>
          <p class="hint" style="margin:0">¿Olvidaste la contraseña? Por seguridad no se puede recuperar: tus datos solo se abren con ella. Puedes crear una cuenta nueva y restaurar una copia de seguridad.</p>
        </form>` : `
        <form id="authF" class="stack" novalidate>
          <div><h1 class="auth-h">Crea tu cuenta</h1><p class="muted" style="margin:4px 0 0">Empezarás con todo vacío, listo para tus cifras.</p></div>
          ${field('Nombre', '<input class="input" id="rName" name="rName" autocomplete="name" autofocus placeholder="Cómo quieres que te llamemos"/>', { id: 'rName' })}
          ${field('Usuario o correo', '<input class="input" id="rUser" name="rUser" autocomplete="username" placeholder="Lo usarás para entrar"/>', { id: 'rUser' })}
          ${pwField('rPass', 'Contraseña', 'new-password')}
          <div class="pw-meter" aria-live="polite"><div class="pw-bars"><i></i><i></i><i></i><i></i></div><span class="hint" data-pwl>Mínimo 8 caracteres</span></div>
          ${pwField('rPass2', 'Repite la contraseña', 'new-password')}
          <label class="check" style="font-size:12.5px;align-items:flex-start"><input type="checkbox" id="rAck" name="rAck" style="margin-top:2px"/><span>Entiendo que si olvido la contraseña no podré recuperar mis datos.</span></label>
          <span class="err" data-ferr></span>
          <button class="btn primary auth-submit" type="submit">Crear cuenta</button>
        </form>`}
        <div class="note">${I('lock', 'sm')}<span>Cada usuario tiene su propio espacio. Los datos se cifran en este dispositivo con tu contraseña y no se envían a ningún servidor: para usar la app en otro dispositivo, exporta una copia de seguridad.</span></div>
      </div>
    </main>`;
  $$('[data-mode]').forEach(b => b.onclick = () => authScreen(b.dataset.mode));
  $$('[data-eye]').forEach(b => b.onclick = () => { const i = $('#' + b.dataset.eye); const show = i.type === 'password'; i.type = show ? 'text' : 'password'; b.innerHTML = I(show ? 'eyeoff' : 'eye', 'sm'); b.setAttribute('aria-label', show ? 'Ocultar contraseña' : 'Mostrar contraseña'); });
  const f = $('#authF');
  const busy = (on, label) => { const b = f.querySelector('.auth-submit'); b.disabled = on; if (label) b.textContent = label; };
  const ferr = msg => { f.querySelector('[data-ferr]').textContent = msg || ''; };
  const af = f.querySelector('[autofocus]'); if (af) setTimeout(() => af.focus(), 30);
  if (mode === 'register') {
    const p = $('#rPass');
    p.oninput = () => { const s = p.value ? pwStrength(p.value) : 0; $$('.pw-bars i').forEach((i, k) => i.className = k < s ? 'on s' + s : ''); f.querySelector('[data-pwl]').textContent = p.value ? PW_LABELS[s] + (p.value.length < 8 ? ' · mínimo 8 caracteres' : '') : 'Mínimo 8 caracteres'; };
    f.onsubmit = async e => {
      e.preventDefault(); clearErrs(f); ferr('');
      const name = $('#rName').value.trim(), username = $('#rUser').value.trim(), pw = $('#rPass').value, pw2 = $('#rPass2').value;
      let ok = true;
      if (!name) { setErr(f, 'rName', 'Escribe tu nombre.'); ok = false; }
      if (username.length < 3) { setErr(f, 'rUser', 'Usa al menos 3 caracteres.'); ok = false; }
      else if (findUser(username)) { setErr(f, 'rUser', 'Ya existe una cuenta con ese usuario en este dispositivo. Inicia sesión o elige otro.'); ok = false; }
      if (pw.length < 8) { setErr(f, 'rPass', 'La contraseña necesita al menos 8 caracteres.'); ok = false; }
      else if (pwStrength(pw) < 2) { setErr(f, 'rPass', 'Es demasiado fácil de adivinar: mezcla letras, números o símbolos.'); ok = false; }
      if (pw2 !== pw) { setErr(f, 'rPass2', 'Las contraseñas no coinciden.'); ok = false; }
      if (!$('#rAck').checked) { ferr('Marca la casilla para confirmar que lo entiendes.'); ok = false; }
      if (!ok) { const inv = f.querySelector('.invalid'); if (inv) inv.focus(); return; }
      busy(true, 'Creando tu cuenta…');
      try {
        const salt = crypto.getRandomValues(new Uint8Array(16));
        const key = await deriveKey(pw, salt);
        const user = { id: uid('u'), name, username, salt: toB64(salt), iter: KDF_ITER, created: TODAY };
        const data = emptyState0();
        if (!lsSet(DATA_PREFIX + user.id, await encryptObj(key, data))) throw new Error('storage');
        AUTH.users.push(user); saveUsers();
        startSession(user, key, data);
        toast(`Cuenta creada. Bienvenido, ${name}`);
      } catch (err) { busy(false, 'Crear cuenta'); ferr(err && err.message === 'storage' ? 'Este navegador no deja guardar datos. Revisa que no estés en modo privado.' : 'No se ha podido crear la cuenta. Inténtalo de nuevo.'); }
    };
  } else {
    f.onsubmit = async e => {
      e.preventDefault(); clearErrs(f); ferr('');
      const now = Date.now();
      if (AUTH.waitUntil > now) { ferr(`Demasiados intentos. Espera ${Math.ceil((AUTH.waitUntil - now) / 1000)} segundos.`); return; }
      const username = $('#lUser').value.trim(), pw = $('#lPass').value;
      if (!username) { setErr(f, 'lUser', 'Escribe tu usuario.'); $('#lUser').focus(); return; }
      if (!pw) { setErr(f, 'lPass', 'Escribe tu contraseña.'); $('#lPass').focus(); return; }
      busy(true, 'Comprobando…');
      const user = findUser(username);
      try {
        if (!user) throw new Error('nouser');
        const { key, data } = await openWith(user, pw);
        startSession(user, key, data);
      } catch (err) {
        AUTH.fails++;
        if (AUTH.fails >= 5) { AUTH.waitUntil = Date.now() + 30000; AUTH.fails = 0; }
        busy(false, 'Entrar');
        ferr('Usuario o contraseña incorrectos.');
        $('#lPass').value = ''; $('#lPass').focus();
      }
    };
  }
}

/* ---------- gestión de la cuenta ---------- */
function changePasswordForm() {
  const m = openModal({
    title: 'Cambiar contraseña', size: 'sm',
    body: `<form id="cpf" class="stack" novalidate>${pwField('cpOld', 'Contraseña actual', 'current-password', 'autofocus')}${pwField('cpNew', 'Nueva contraseña', 'new-password')}${pwField('cpNew2', 'Repite la nueva contraseña', 'new-password')}</form>`,
    foot: `<span class="spacer"></span><button class="btn" type="button" data-cancel>Cancelar</button><button class="btn primary" type="submit" form="cpf">Cambiar</button>`
  });
  const f = m.el.querySelector('form'); m.el.querySelector('[data-cancel]').onclick = m.close;
  bindEyes(m.el);
  f.onsubmit = async e => {
    e.preventDefault(); clearErrs(f);
    const o = f.cpOld.value, n = f.cpNew.value, n2 = f.cpNew2.value;
    if (n.length < 8 || pwStrength(n) < 2) { setErr(f, 'cpNew', 'Usa al menos 8 caracteres mezclando letras, números o símbolos.'); return; }
    if (n !== n2) { setErr(f, 'cpNew2', 'Las contraseñas no coinciden.'); return; }
    if (!(await verifyPassword(o))) { setErr(f, 'cpOld', 'La contraseña actual no es correcta.'); return; }
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const key = await deriveKey(n, salt);
    await saving;
    if (!lsSet(DATA_PREFIX + AUTH.user.id, await encryptObj(key, S))) { toast('No se ha podido guardar. Revisa el espacio del navegador.'); return; }
    const u = AUTH.users.find(x => x.id === AUTH.user.id); u.salt = toB64(salt); u.iter = KDF_ITER; saveUsers();
    AUTH.user = u; AUTH.key = key;
    m.close(); toast('Contraseña cambiada');
  };
}
function deleteAccountForm() {
  const m = openModal({
    title: 'Eliminar cuenta', size: 'sm',
    body: `<form id="daf" class="stack" novalidate><p style="margin:0;color:var(--ink-2)">Se borrarán de este dispositivo tu usuario y todos tus datos. Esta acción no se puede deshacer. Si quieres conservarlos, descarga antes una copia de seguridad.</p>${pwField('daPass', 'Escribe tu contraseña para confirmar', 'current-password', 'autofocus')}</form>`,
    foot: `<span class="spacer"></span><button class="btn" type="button" data-cancel>Cancelar</button><button class="btn danger solid" type="submit" form="daf">Eliminar definitivamente</button>`
  });
  const f = m.el.querySelector('form'); m.el.querySelector('[data-cancel]').onclick = m.close;
  bindEyes(m.el);
  f.onsubmit = async e => {
    e.preventDefault(); clearErrs(f);
    if (!(await verifyPassword(f.daPass.value))) { setErr(f, 'daPass', 'La contraseña no es correcta.'); return; }
    const id = AUTH.user.id;
    clearTimeout(saveTimer); AUTH.key = null; S = null;
    lsDel(DATA_PREFIX + id);
    AUTH.users = AUTH.users.filter(u => u.id !== id); saveUsers();
    lsDel(LAST_KEY);
    location.hash = ''; location.reload();
  };
}
function bindEyes(root) {
  root.querySelectorAll('[data-eye]').forEach(b => b.onclick = () => { const i = root.querySelector('#' + b.dataset.eye); const show = i.type === 'password'; i.type = show ? 'text' : 'password'; b.innerHTML = I(show ? 'eyeoff' : 'eye', 'sm'); });
}
