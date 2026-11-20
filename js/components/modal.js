import { el } from '../utils.js';

function getOverlay() {
  return document.getElementById('overlay-root');
}

export function openModal(options = {}) {
  const {
    title = '',
    content = '',
    className = '',
    dismissible = true,
    actions = [],
    onClose = null,
  } = options;

  const mask = el('div', 'modal-mask');
  const card = el('div', `modal-card ${className}`.trim());

  if (title) {
    const head = el('div', 'modal-head');
    head.appendChild(el('h3', 'modal-title', title));
    if (dismissible) {
      const closeBtn = el('button', 'modal-close', '×');
      closeBtn.type = 'button';
      closeBtn.setAttribute('aria-label', '关闭');
      closeBtn.addEventListener('click', () => close(false));
      head.appendChild(closeBtn);
    }
    card.appendChild(head);
  }

  if (typeof content === 'string') {
    const body = el('div', 'modal-body');
    body.innerHTML = content;
    card.appendChild(body);
  } else if (content) {
    card.appendChild(content);
  }

  if (actions.length) {
    const row = el('div', 'modal-actions');
    for (const action of actions) {
      const btn = el('button', `modal-btn ${action.className || ''}`.trim(), action.label);
      btn.type = 'button';
      btn.addEventListener('click', () => {
        const result = action.onClick ? action.onClick() : undefined;
        if (action.close !== false) close(result);
      });
      row.appendChild(btn);
    }
    card.appendChild(row);
  }

  mask.appendChild(card);
  getOverlay().appendChild(mask);
  requestAnimationFrame(() => mask.classList.add('is-open'));

  let closed = false;
  function close(result = null) {
    if (closed) return;
    closed = true;
    mask.classList.remove('is-open');
    setTimeout(() => mask.remove(), 220);
    if (onClose) onClose(result);
  }

  if (dismissible) {
    mask.addEventListener('click', (event) => {
      if (event.target === mask) close(null);
    });
  }

  return { mask, card, close };
}

export function confirmModal(options = {}) {
  const {
    title = '提示',
    message = '',
    okText = '确定',
    cancelText = '取消',
    okClassName = 'primary',
    onOpen = null,
    onClose = null,
  } = options;

  return new Promise(resolve => {
    let settled = false;
    const content = `<p class="modal-message">${message}</p>`;
    const modal = openModal({
      title,
      content,
      dismissible: false,
      actions: [
        { label: cancelText, className: 'ghost', onClick: () => { settled = true; resolve(false); } },
        { label: okText, className: okClassName, onClick: () => { settled = true; resolve(true); } },
      ],
      onClose: (result) => {
        if (!settled) resolve(false);
        if (onClose) onClose(result);
      },
    });
    if (onOpen) onOpen(modal);
  });
}

export function storyModal(title, story) {
  const content = el('div', 'story-scroll');
  content.innerHTML = `<p>${String(story || '').replace(/\n/g, '</p><p>')}</p>`;
  return openModal({
    title: title || '成语故事',
    content,
    className: 'story-modal',
    dismissible: true,
  });
}

export function closeAllModals() {
  const root = getOverlay();
  if (!root) return;
  for (const mask of Array.from(root.querySelectorAll('.modal-mask'))) {
    mask.remove();
  }
}
