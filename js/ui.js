// Small DOM helpers: element builder, icons, avatars, modals, toasts.

export function h(tag, props, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(props || {})) {
        if (v == null || v === false) continue;
        if (k === 'class') el.className = v;
        else if (k === 'style' && typeof v === 'object') {
            for (const [name, val] of Object.entries(v)) {
                if (name.startsWith('--')) el.style.setProperty(name, val);
                else el.style[name] = val;
            }
        } else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
        else if (k.startsWith('aria-') || k === 'role' || k === 'for') el.setAttribute(k, v === true ? '' : v);
        else if (k in el) el[k] = v;
        else el.setAttribute(k, v === true ? '' : v);
    }
    const add = (kid) => {
        if (kid == null || kid === false) return;
        if (Array.isArray(kid)) kid.forEach(add);
        else el.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
    };
    kids.forEach(add);
    return el;
}

// ---------- Icons (24px stroke set) ----------

const ICONS = {
    flame: '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>',
    plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
    edit: '<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>',
    trash: '<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    tag: '<path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z"/><circle cx="7.5" cy="7.5" r=".5" fill="currentColor"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>',
    back: '<path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>',
    image: '<rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>',
    chevron:'<path d="m6 9 6 6 6-6"/>',
    undo:'<path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/>',
    userPlus: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" x2="19" y1="8" y2="14"/><line x1="22" x2="16" y1="11" y2="11"/>',
    userCheck: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><polyline points="16 11 18 13 22 9"/>',
    google: '<path d="M21.35 11.1H12v3.8h5.35c-.5 2.4-2.5 3.8-5.35 3.8a6 6 0 1 1 0-12c1.5 0 2.8.55 3.85 1.45l2.7-2.7A9.8 9.8 0 0 0 12 2.2a9.8 9.8 0 1 0 0 19.6c5.6 0 9.4-3.9 9.4-9.5 0-.4-.03-.8-.1-1.2z"/>',
};

export function icon(name) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '2');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.setAttribute('aria-hidden', 'true');
    svg.innerHTML = ICONS[name] || '';
    return svg;
}

// ---------- People and dates ----------

export function avatar(person, size = 'md') {
    const name = (person && person.name) || '?';
    if (person && person.photoURL) {
        return h('img', { class: `avatar ${size}`, src: person.photoURL, alt: '', referrerPolicy: 'no-referrer' });
    }
    return h('span', { class: `avatar ${size}`, 'aria-hidden': 'true' }, name.trim().charAt(0).toUpperCase() || '?');
}

const dateFmt = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
export const fmtDate = (ms) => (ms ? dateFmt.format(new Date(ms)) : 'just now');

// category colour -> translucent fill / border (colours are #rrggbb)
export const tint = (hex, alpha) => `${hex}${alpha}`;

// ---------- Modals ----------

const overlay = document.getElementById('overlay');
const stack = [];

export function openModal({ title, content, size = '', onClose }) {
    const previousFocus = document.activeElement;
    const backdrop = h('div', { class: 'backdrop' });
    const entry = { close };

    function close() {
        const i = stack.indexOf(entry);
        if (i === -1) return;
        stack.splice(i, 1);
        backdrop.remove();
        if (onClose) onClose();
        if (previousFocus && previousFocus.focus) previousFocus.focus();
    }

    const dialog = h('div', { class: `modal ${size}`, role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
        h('header', { class: 'modal-head' },
            h('h2', null, title),
            h('button', { class: 'btn-icon', type: 'button', 'aria-label': 'Close', onclick: close }, icon('x'))),
        h('div', { class: 'modal-body' }, content));

    backdrop.append(dialog);
    // mousedown, so dragging a text selection out of an input does not dismiss the dialog
    backdrop.addEventListener('mousedown', (e) => { if (e.target === backdrop) close(); });
    overlay.append(backdrop);
    stack.push(entry);

    const first = dialog.querySelector('input:not([type=hidden]), textarea, select, .pick, .btn-primary, .btn');
    (first || dialog.querySelector('.btn-icon')).focus();
    return entry;
}

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && stack.length) stack[stack.length - 1].close();
});

export function confirmDialog({ title, message, confirmLabel = 'Confirm', danger = false }) {
    return new Promise((resolve) => {
        let answer = false;
        const modal = openModal({
            title,
            size: 'small',
            onClose: () => resolve(answer),
            content: [
                h('p', { class: 'modal-text' }, message),
                h('div', { class: 'modal-actions' },
                    h('button', { class: 'btn', type: 'button', onclick: () => modal.close() }, 'Cancel'),
                    h('button', {
                        class: `btn ${danger ? 'btn-danger-solid' : 'btn-primary'}`,
                        type: 'button',
                        onclick: () => { answer = true; modal.close(); },
                    }, confirmLabel)),
            ],
        });
    });
}

// ---------- Toasts ----------

export function toast(message, kind = 'info') {
    const el = h('div', { class: `toast ${kind}` }, message);
    document.getElementById('toasts').append(el);
    setTimeout(() => el.classList.add('out'), 3800);
    setTimeout(() => el.remove(), 4200);
}
