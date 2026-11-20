import { el } from '../utils.js';

let hideTimer = null;

export function showToast(text, duration = 1700) {
  const root = document.getElementById('overlay-root');
  if (!root) return;
  let toast = root.querySelector('.toast');
  if (toast) toast.remove();
  toast = el('div', 'toast', '');
  toast.textContent = text;
  root.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('is-open'));
  clearTimeout(hideTimer);
  hideTimer = setTimeout(() => {
    toast.classList.remove('is-open');
    setTimeout(() => toast.remove(), 220);
  }, duration);
}
