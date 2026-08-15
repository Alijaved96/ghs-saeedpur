const toggle = document.querySelector('.menu-toggle');
const nav = document.querySelector('.nav');
if (toggle && nav) {
  const setMenuState = (open) => {
    nav.classList.toggle('open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    toggle.textContent = open ? '✕' : '☰';
  };
  toggle.addEventListener('click', () => setMenuState(!nav.classList.contains('open')));
  nav.addEventListener('click', e => { if (e.target.closest('a')) setMenuState(false); });
  document.addEventListener('click', e => { if (!nav.contains(e.target) && !toggle.contains(e.target)) setMenuState(false); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') setMenuState(false); });
}
document.querySelectorAll('[data-current-year]').forEach(el => el.textContent = new Date().getFullYear());
