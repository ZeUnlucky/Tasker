import { h, icon, avatar, openModal, confirmDialog, toast, fmtDate, tint } from './ui.js';
import { configured } from './firebase-config.js';
import { ROLES, ROLE_LABEL, PALETTE, roleOf, can, newId } from './model.js';
import { compressImage } from './media.js';

const demo = new URLSearchParams(location.search).has('demo') || !configured;
const api = await import(demo ? './backend-demo.js' : './backend-firebase.js');

const root = document.getElementById('app');

const state = {
    user: undefined, // undefined = checking sign-in, null = signed out
    route: { name: 'home' },
    boards: null,
    board: undefined, // undefined = loading, null = missing or no access
    tasks: null,
    filter: { cats: new Set(), mine: false },
    showFinished: true,
};

let watchers = [];
const liveViews = new Set(); // modal bodies that redraw when the board changes

// ---------- Helpers ----------

function run(promise, okMessage) {
    return Promise.resolve(promise).then((result) => {
        if (okMessage) toast(okMessage);
        return result;
    }).catch((err) => {
        console.error(err);
        toast(err.code === 'permission-denied' ? 'You do not have permission to do that.' : err.message || 'Something went wrong.', 'error');
    });
}

const pill = (cat) => h('span', { class: 'pill', style: { '--c': cat.color, background: tint(cat.color, '26'), borderColor: tint(cat.color, '66') } },
    h('i'), cat.title);

const roleBadge = (role) => h('span', { class: `badge role-${role}` }, ROLE_LABEL[role]);

// ---------- Routing and data ----------

function parseRoute() {
    const m = location.hash.match(/^#\/board\/([\w-]+)/);
    return m ? { name: 'board', id: m[1] } : { name: 'home' };
}

function startRoute() {
    watchers.forEach((stop) => stop());
    watchers = [];
    liveViews.clear();
    state.route = parseRoute();
    state.board = undefined;
    state.tasks = null;
    state.filter = { cats: new Set(), mine: false };
    if (state.user) {
        if (state.route.name === 'home') {
            watchers.push(api.watchBoards(state.user.uid, (boards) => { state.boards = boards; render(); }, (e) => {
                console.error(e);
                state.boards = [];
                render();
            }));
        } else {
            const { id } = state.route;
            watchers.push(
                api.watchBoard(id, (board) => { state.board = board; render(); }),
                api.watchTasks(id, (tasks) => { state.tasks = tasks; render(); }, (e) => {
                    console.error(e);
                    state.tasks = [];
                    render();
                }),
            );
        }
    }
    render();
}

window.addEventListener('hashchange', startRoute);
api.onUser((user) => {
    state.user = user;
    state.boards = null;
    startRoute();
});

// ---------- Rendering ----------

function render() {
    if (state.user === undefined) {
        root.replaceChildren(h('div', { class: 'splash' }, icon('flame')));
        return;
    }
    if (!state.user) {
        root.replaceChildren(loginView());
        return;
    }
    root.replaceChildren(topbar(), state.route.name === 'board' ? boardView() : homeView());
    liveViews.forEach((redraw) => redraw());
}

function topbar() {
    const { user } = state;
    return h('header', { class: 'topbar' },
        h('a', { class: 'brand', href: '#/' }, h('span', { class: 'brand-mark' }, icon('flame')), 'Tasker'),
        demo && h('span', { class: 'badge demo', title: 'Firebase is not configured, so data is stored in this browser only.' }, 'Demo mode'),
        h('span', { class: 'spacer' }),
        h('div', { class: 'user-chip' }, avatar(user, 'sm'), h('span', null, user.name)),
        h('button', {
            class: 'btn-icon', title: 'Sign out', 'aria-label': 'Sign out',
            onclick: () => { api.signOut(); location.hash = ''; },
        }, icon('logout')));
}

function loginView() {
    const signIn = () => api.signIn().catch((err) => {
        if (err.code === 'auth/popup-closed-by-user' || err.code === 'auth/cancelled-popup-request') return;
        console.error(err);
        toast(err.code === 'auth/unauthorized-domain'
            ? 'This domain is not authorised in Firebase (Authentication > Settings > Authorised domains).'
            : err.message, 'error');
    });
    return h('main', { class: 'login' },
        h('div', { class: 'login-card' },
            h('span', { class: 'brand-mark big' }, icon('flame')),
            h('h1', null, 'Tasker'),
            h('p', { class: 'tagline' }, 'Shared task boards for small teams. Claim work, hand it off, finish it.'),
            h('button', { class: 'btn btn-primary btn-lg', onclick: signIn },
                demo ? 'Enter demo' : [icon('google'), 'Continue with Google']),
            demo && h('p', { class: 'fineprint' },
                'Firebase is not configured yet, so this is demo mode: data stays in this browser. See the README to connect your project.')));
}

// ---------- Home: list of boards ----------

function homeView() {
    const { boards, user } = state;
    return h('main', { class: 'page' },
        h('div', { class: 'page-head' },
            h('div', null, h('p', { class: 'eyebrow' }, 'Workspace'), h('h1', null, 'Your boards')),
            h('button', { class: 'btn btn-primary', onclick: newBoardModal }, icon('plus'), 'New board')),
        boards === null
            ? h('p', { class: 'loading' }, 'Loading boards…')
            : boards.length === 0
                ? h('div', { class: 'empty' }, h('h3', null, 'No boards yet'), h('p', null, 'Create your first board, or ask a teammate to add you to theirs.'))
                : h('div', { class: 'boards' }, boards.map((b) => {
                    const members = Object.values(b.members);
                    return h('a', { class: 'board-card', href: `#/board/${b.id}` },
                        h('h3', null, b.title),
                        h('p', { class: 'muted' }, `${members.length} member${members.length === 1 ? '' : 's'}`),
                        h('div', { class: 'board-card-foot' },
                            h('div', { class: 'avatars' }, members.slice(0, 5).map((m) => avatar(m, 'sm'))),
                            roleBadge(roleOf(b, user.uid))));
                })));
}

function newBoardModal() {
    const title = h('input', { class: 'input', required: true, maxLength: 80, placeholder: 'e.g. Website relaunch' });
    const modal = openModal({
        title: 'New board',
        size: 'small',
        content: h('form', {
            onsubmit: async (e) => {
                e.preventDefault();
                if (!title.value.trim()) return;
                modal.close();
                const id = await run(api.createBoard(state.user, title.value.trim()));
                if (id) location.hash = `#/board/${id}`;
            },
        },
        h('label', { class: 'field' }, h('span', null, 'Board name'), title),
        h('p', { class: 'hint' }, 'You will be the owner. Add teammates from the board once it exists.'),
        h('div', { class: 'modal-actions' },
            h('button', { class: 'btn', type: 'button', onclick: () => modal.close() }, 'Cancel'),
            h('button', { class: 'btn btn-primary', type: 'submit' }, 'Create board'))),
    });
}

// ---------- Board ----------

function boardView() {
    const { board, tasks, user, filter } = state;
    if (board === null || (board && !roleOf(board, user.uid))) {
        return h('main', { class: 'page' },
            h('div', { class: 'empty' }, h('h3', null, 'Board not found'),
                h('p', null, 'It may have been deleted, or you are not a member of it.'),
                h('a', { class: 'btn', href: '#/' }, icon('back'), 'Back to boards')));
    }
    if (board === undefined || tasks === null) return h('main', { class: 'page' }, h('p', { class: 'loading' }, 'Loading board…'));

    const role = roleOf(board, user.uid);
    const cats = board.categories || [];
    const ctx = { board, user, role, work: can.work(role), manage: can.manage(role), cats, catMap: new Map(cats.map((c) => [c.id, c])) };

    const matches = (t) => (!filter.cats.size || (t.categoryIds || []).some((id) => filter.cats.has(id)))
        && (!filter.mine || t.workerId === user.uid);
    const active = tasks.filter((t) => !t.finished && matches(t)).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    const finished = tasks.filter((t) => t.finished && matches(t))
        .sort((a, b) => (b.finishedAt || b.createdAt || 0) - (a.finishedAt || a.createdAt || 0));
    const openCount = tasks.filter((t) => !t.finished).length;
    const filtering = filter.cats.size > 0 || filter.mine;

    const chip = (label, on, toggle, color) => h('button', {
        class: `chip${on ? ' on' : ''}`, type: 'button', 'aria-pressed': String(on),
        style: color ? { '--c': color } : null,
        onclick: () => { toggle(); render(); },
    }, color && h('i'), label);

    return h('main', { class: 'page' },
        h('div', { class: 'page-head' },
            h('div', null,
                h('a', { class: 'crumb', href: '#/' }, icon('back'), 'Boards'),
                h('h1', null, board.title),
                h('p', { class: 'muted' }, `${openCount} open · ${tasks.length - openCount} finished · `, roleBadge(role))),
            h('div', { class: 'head-actions' },
                h('button', { class: 'btn', onclick: () => membersModal() }, icon('users'), 'Members'),
                ctx.manage && h('button', { class: 'btn', onclick: () => categoriesModal(ctx) }, icon('tag'), 'Categories'),
                ctx.manage && h('button', { class: 'btn-icon', title: 'Board settings', 'aria-label': 'Board settings', onclick: () => settingsModal(ctx) }, icon('settings')),
                ctx.work && h('button', { class: 'btn btn-primary', onclick: () => taskModal(ctx, null) }, icon('plus'), 'New task'))),

        h('div', { class: 'filters', role: 'group', 'aria-label': 'Filter tasks' },
            chip('Assigned to me', filter.mine, () => { filter.mine = !filter.mine; }),
            cats.map((c) => chip(c.title, filter.cats.has(c.id), () => {
                if (!filter.cats.delete(c.id)) filter.cats.add(c.id);
            }, c.color))),

        h('section', null,
            h('h2', { class: 'section-title' }, 'Tasks', h('span', { class: 'count' }, active.length)),
            active.length
                ? h('div', { class: 'cards' }, active.map((t) => taskCard(ctx, t)))
                : h('div', { class: 'empty small' }, h('p', null, filtering ? 'No open tasks match these filters.'
                    : ctx.work ? 'Nothing to do. Add a task to get started.' : 'Nothing to do.'))),

        h('section', null,
            h('button', {
                class: 'section-toggle', type: 'button', 'aria-expanded': String(state.showFinished),
                onclick: () => { state.showFinished = !state.showFinished; render(); },
            }, h('span', { class: `chev${state.showFinished ? ' open' : ''}` }, icon('chevron')), 'Finished tasks', h('span', { class: 'count' }, finished.length)),
            state.showFinished && (finished.length
                ? h('div', { class: 'cards' }, finished.map((t) => taskCard(ctx, t)))
                : h('div', { class: 'empty small' }, h('p', null, 'Finished tasks show up here.')))));
}

function taskCard(ctx, task) {
    const { board, user, work, catMap } = ctx;
    const cats = (task.categoryIds || []).map((id) => catMap.get(id)).filter(Boolean);
    const worker = task.workerId ? board.members[task.workerId] || { name: 'Former member' } : null;
    const mine = task.workerId === user.uid;
    const update = (patch, ok) => run(api.updateTask(board.id, task.id, patch), ok);

    const actions = !work ? null : task.finished
        ? h('button', { class: 'btn btn-sm', onclick: () => update({ finished: false }) }, icon('undo'), 'Reopen')
        : [
            h('button', { class: 'btn btn-sm', onclick: () => update({ workerId: mine ? null : user.uid }) },
                icon('userCheck'), mine ? 'Unclaim' : 'Claim'),
            h('button', { class: 'btn btn-sm', onclick: () => assignModal(ctx, task) }, icon('userPlus'), 'Assign'),
            h('button', { class: 'btn btn-sm btn-primary', onclick: () => update({ finished: true }) }, icon('check'), 'Finished'),
        ];

    return h('article', { class: `card${task.finished ? ' done' : ''}` },
        h('div', { class: 'card-head' },
            h('h3', { class: 'card-title' }, task.title),
            work && h('button', { class: 'btn-icon', title: 'Edit task', 'aria-label': 'Edit task', onclick: () => taskModal(ctx, task) }, icon('edit'))),
        cats.length > 0 && h('div', { class: 'cats' }, cats.map(pill)),
        task.content && h('p', { class: 'card-content' }, task.content),
        task.image && h('button', { class: 'card-media-btn', type: 'button', 'aria-label': `View photo: ${task.title}`, onclick: () => photoModal(task) },
            h('img', { class: 'card-media', src: task.image, alt: '', loading: 'lazy' })),
        h('dl', { class: 'card-meta' },
            h('div', null, h('dt', null, 'Creator'),
                h('dd', null, avatar({ name: task.creatorName, photoURL: task.creatorPhoto }, 'xs'), task.creatorName, h('span', { class: 'sep' }, '·'), fmtDate(task.createdAt))),
            h('div', null, h('dt', null, 'Worker'),
                h('dd', { class: worker ? '' : 'muted' }, worker ? [avatar(worker, 'xs'), worker.name] : 'Unassigned'))),
        actions && h('div', { class: 'card-actions' }, actions));
}

// ---------- Task photo (optional) ----------

function photoModal(task) {
    openModal({ title: task.title, size: 'wide', content: h('img', { class: 'lightbox-img', src: task.image, alt: task.title }) });
}

// ---------- Task: create / edit ----------

function taskModal(ctx, task) {
    const { board, user, cats } = ctx;
    const picked = new Set(task ? task.categoryIds : []);

    // optional photo: `image` is what the task will hold when saved (a data URL, or null for none)
    let image = task && task.image ? task.image : null;
    const fileInput = h('input', { type: 'file', accept: 'image/*', hidden: true });
    const imageBox = h('div', { class: 'media-pick' });
    const drawImage = () => {
        imageBox.replaceChildren(image
            ? h('div', { class: 'media-chosen' },
                h('img', { src: image, alt: '' }),
                h('span', { class: 'media-name' }, 'Photo attached'),
                h('button', { class: 'btn btn-sm', type: 'button', onclick: () => fileInput.click() }, 'Replace'),
                h('button', { class: 'btn btn-sm btn-danger', type: 'button', onclick: () => { image = null; drawImage(); } }, icon('trash'), 'Remove'))
            : h('button', { class: 'media-add', type: 'button', onclick: () => fileInput.click() }, icon('image'), 'Add a photo'));
    };
    fileInput.addEventListener('change', async () => {
        const file = fileInput.files[0];
        fileInput.value = '';
        if (!file) return;
        try {
            image = await compressImage(file);
            drawImage();
        } catch (err) {
            toast(err.message, 'error');
        }
    });
    drawImage();

    const title = h('input', { class: 'input', required: true, maxLength: 120, value: task ? task.title : '', placeholder: 'What needs doing?' });
    const content = h('textarea', { class: 'input', rows: 5, maxLength: 4000, value: task ? task.content : '', placeholder: 'Details, links, acceptance criteria…' });
    const workers = Object.entries(board.members).filter(([, m]) => can.work(m.role));
    const worker = h('select', { class: 'input' },
        h('option', { value: '' }, 'Unassigned'),
        workers.map(([uid, m]) => h('option', { value: uid, selected: task && task.workerId === uid }, m.name)));

    const catPicker = cats.length
        ? h('div', { class: 'chips' }, cats.map((c) => {
            const btn = h('button', {
                class: `chip${picked.has(c.id) ? ' on' : ''}`, type: 'button', 'aria-pressed': String(picked.has(c.id)), style: { '--c': c.color },
                onclick: () => {
                    if (!picked.delete(c.id)) picked.add(c.id);
                    btn.classList.toggle('on', picked.has(c.id));
                    btn.setAttribute('aria-pressed', picked.has(c.id));
                },
            }, h('i'), c.title);
            return btn;
        }))
        : h('p', { class: 'hint' }, ctx.manage ? 'No categories yet. Add some from the Categories button.' : 'No categories on this board.');

    const modal = openModal({
        title: task ? 'Edit task' : 'New task',
        content: h('form', {
            onsubmit: (e) => {
                e.preventDefault();
                const data = { title: title.value.trim(), content: content.value.trim(), categoryIds: [...picked], workerId: worker.value || null, image };
                if (!data.title) return;
                modal.close();
                if (task) run(api.updateTask(board.id, task.id, data));
                else run(api.createTask(board.id, user, data));
            },
        },
        h('label', { class: 'field' }, h('span', null, 'Title'), title),
        h('label', { class: 'field' }, h('span', null, 'Content'), content),
        h('div', { class: 'field' }, h('span', null, 'Categories'), catPicker),
        h('div', { class: 'field' }, h('span', null, 'Photo (optional)'), imageBox, fileInput,
            h('p', { class: 'hint' }, 'Photos are shrunk automatically so they fit in the free database.')),
        h('label', { class: 'field' }, h('span', null, 'Worker'), worker),
        h('div', { class: 'modal-actions' },
            task && (ctx.manage || task.creatorId === user.uid) && h('button', {
                class: 'btn btn-danger', type: 'button',
                onclick: async () => {
                    if (!await confirmDialog({ title: 'Delete task', message: `Delete "${task.title}"? This cannot be undone.`, confirmLabel: 'Delete', danger: true })) return;
                    modal.close();
                    run(api.deleteTask(board.id, task.id));
                },
            }, icon('trash'), 'Delete'),
            h('span', { class: 'spacer' }),
            h('button', { class: 'btn', type: 'button', onclick: () => modal.close() }, 'Cancel'),
            h('button', { class: 'btn btn-primary', type: 'submit' }, task ? 'Save' : 'Add task'))),
    });
}

// ---------- Assign ----------

function assignModal(ctx, task) {
    const { board } = ctx;
    const choose = (workerId) => {
        modal.close();
        run(api.updateTask(board.id, task.id, { workerId }));
    };
    const option = (person, label, sub, selected, workerId) => h('button', {
        class: `pick${selected ? ' on' : ''}`, type: 'button', onclick: () => choose(workerId),
    }, person ? avatar(person, 'md') : h('span', { class: 'avatar md dashed' }, '–'),
    h('span', { class: 'pick-text' }, h('strong', null, label), h('small', null, sub)),
    selected && icon('check'));

    const people = Object.entries(board.members).filter(([, m]) => can.work(m.role));
    const modal = openModal({
        title: 'Assign worker',
        size: 'small',
        content: h('div', { class: 'picks' },
            option(null, 'Unassigned', 'Nobody is working on it', !task.workerId, null),
            people.map(([uid, m]) => option(m, m.name, ROLE_LABEL[m.role], task.workerId === uid, uid))),
    });
}

// ---------- Categories ----------

function categoriesModal(ctx) {
    const { board } = ctx;
    const rows = board.categories.map((c) => ({ ...c }));
    const list = h('div', { class: 'cat-list' });

    const draw = () => {
        list.replaceChildren(...rows.map((row, i) => h('div', { class: 'cat-row' },
            h('input', { class: 'color', type: 'color', value: row.color, 'aria-label': 'Colour', oninput: (e) => { row.color = e.target.value; } }),
            h('input', { class: 'input', value: row.title, maxLength: 30, placeholder: 'Category name', 'aria-label': 'Category name', oninput: (e) => { row.title = e.target.value; } }),
            h('button', { class: 'btn-icon', type: 'button', title: 'Remove', 'aria-label': 'Remove category', onclick: () => { rows.splice(i, 1); draw(); } }, icon('trash')))));
        if (!rows.length) list.append(h('p', { class: 'hint' }, 'No categories. Tasks can still be created without one.'));
    };
    draw();

    const modal = openModal({
        title: 'Categories',
        content: [
            list,
            h('button', {
                class: 'btn btn-sm', type: 'button',
                onclick: () => { rows.push({ id: newId(), title: '', color: PALETTE[rows.length % PALETTE.length] }); draw(); list.querySelector('.cat-row:last-of-type .input').focus(); },
            }, icon('plus'), 'Add category'),
            h('p', { class: 'hint' }, 'Removing a category takes it off every task that used it.'),
            h('div', { class: 'modal-actions' },
                h('button', { class: 'btn', type: 'button', onclick: () => modal.close() }, 'Cancel'),
                h('button', {
                    class: 'btn btn-primary', type: 'button',
                    onclick: () => {
                        const clean = rows.map((r) => ({ id: r.id, title: r.title.trim(), color: r.color })).filter((r) => r.title);
                        modal.close();
                        run(api.saveCategories(board.id, clean), 'Categories saved');
                    },
                }, 'Save')),
        ],
    });
}

// ---------- Members ----------

function membersModal() {
    const list = h('div', { class: 'member-list' });
    const email = h('input', { class: 'input', type: 'email', required: true, placeholder: 'teammate@gmail.com', 'aria-label': 'Email' });
    const roleSel = h('select', { class: 'input', 'aria-label': 'Role' },
        ['admin', 'member', 'viewer'].map((r) => h('option', { value: r, selected: r === 'member' }, ROLE_LABEL[r])));

    const draw = () => {
        const { board, user } = state;
        if (!board) return;
        const manage = can.manage(roleOf(board, user.uid));
        list.replaceChildren(...Object.entries(board.members)
            .sort(([, a], [, b]) => ROLES.indexOf(a.role) - ROLES.indexOf(b.role) || a.name.localeCompare(b.name))
            .map(([uid, m]) => h('div', { class: 'member' },
                avatar(m, 'md'),
                h('div', { class: 'member-text' }, h('strong', null, m.name, uid === user.uid && h('span', { class: 'you' }, ' (you)')), h('small', null, m.email)),
                manage && m.role !== 'owner'
                    ? h('select', {
                        class: 'input compact', 'aria-label': `Role of ${m.name}`,
                        onchange: (e) => run(api.setMemberRole(board.id, uid, e.target.value)),
                    }, ['admin', 'member', 'viewer'].map((r) => h('option', { value: r, selected: r === m.role }, ROLE_LABEL[r])))
                    : roleBadge(m.role),
                manage && m.role !== 'owner' && uid !== user.uid && h('button', {
                    class: 'btn-icon', type: 'button', title: 'Remove from board', 'aria-label': `Remove ${m.name}`,
                    onclick: async () => {
                        if (await confirmDialog({ title: 'Remove member', message: `Remove ${m.name} from this board? Their tasks stay on the board.`, confirmLabel: 'Remove', danger: true })) {
                            run(api.removeMember(board.id, uid));
                        }
                    },
                }, icon('x')))));
    };

    const canAdd = can.manage(roleOf(state.board, state.user.uid));
    liveViews.add(draw);
    openModal({
        title: 'Members',
        onClose: () => liveViews.delete(draw),
        content: [
            list,
            canAdd && h('form', {
                class: 'add-member',
                onsubmit: async (e) => {
                    e.preventDefault();
                    const added = await run(api.addMember(state.board, email.value, roleSel.value).then(() => true), 'Member added');
                    if (added) email.value = '';
                },
            },
            h('span', { class: 'field-label' }, 'Add by email'),
            h('div', { class: 'add-row' }, email, roleSel, h('button', { class: 'btn btn-primary', type: 'submit' }, icon('plus'), 'Add')),
            h('p', { class: 'hint' }, 'They need to have signed in to Tasker with that Google account at least once.')),
        ],
    });
    draw();
}

// ---------- Board settings ----------

function settingsModal(ctx) {
    const { board, user } = ctx;
    const title = h('input', { class: 'input', required: true, maxLength: 80, value: board.title });
    const isOwner = board.ownerId === user.uid;
    const modal = openModal({
        title: 'Board settings',
        size: 'small',
        content: [
            h('form', {
                onsubmit: (e) => {
                    e.preventDefault();
                    if (!title.value.trim()) return;
                    modal.close();
                    run(api.renameBoard(board.id, title.value.trim()));
                },
            },
            h('label', { class: 'field' }, h('span', null, 'Board name'), title),
            h('div', { class: 'modal-actions' },
                h('button', { class: 'btn', type: 'button', onclick: () => modal.close() }, 'Cancel'),
                h('button', { class: 'btn btn-primary', type: 'submit' }, 'Save'))),
            isOwner && h('div', { class: 'danger-zone' },
                h('h3', null, 'Delete board'),
                h('p', { class: 'hint' }, 'Removes the board and all of its tasks for everyone.'),
                h('button', {
                    class: 'btn btn-danger', type: 'button',
                    onclick: async () => {
                        if (!await confirmDialog({ title: 'Delete board', message: `Delete "${board.title}" and all of its tasks? This cannot be undone.`, confirmLabel: 'Delete board', danger: true })) return;
                        modal.close();
                        location.hash = '#/';
                        run(api.deleteBoard(board.id), 'Board deleted');
                    },
                }, icon('trash'), 'Delete board')),
        ],
    });
}
