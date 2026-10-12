// Demo backend: same API as backend-firebase.js, but everything lives in this browser (localStorage).
// Used while js/firebase-config.js is empty, or when the page is opened with ?demo.

import { defaultCategories, newId } from './model.js';
import { kindOf } from './media.js';

export const isDemo = true;

const KEY = 'tasker-demo-v1';
const USER_KEY = 'tasker-demo-user';

const ME = { uid: 'demo-me', name: 'You (demo)', email: 'you@example.com', photoURL: '' };
const DIRECTORY = [
    ME,
    { uid: 'u-maya', name: 'Maya Cohen', email: 'maya@example.com', photoURL: '' },
    { uid: 'u-jonas', name: 'Jonas Weber', email: 'jonas@example.com', photoURL: '' },
    { uid: 'u-priya', name: 'Priya Nair', email: 'priya@example.com', photoURL: '' },
];
const person = (u) => ({ name: u.name, email: u.email, photoURL: u.photoURL || '' });

function seed() {
    const cats = [
        { id: 'c-feat', title: 'Feature', color: '#ffb62e' },
        { id: 'c-bug', title: 'Bug', color: '#e5484d' },
        { id: 'c-ui', title: 'Design', color: '#a78bfa' },
        { id: 'c-ops', title: 'Ops', color: '#3fb98a' },
    ];
    const day = 86400000;
    const now = Date.now();
    const t = (title, content, categoryIds, creator, workerId, ago, finished) => ({
        id: newId(), title, content, categoryIds, creatorId: creator.uid, creatorName: creator.name, creatorPhoto: '',
        workerId, finished: !!finished, createdAt: now - ago * day, finishedAt: finished ? now - (ago - 1) * day : null,
    });
    return {
        boards: {
            'demo-board': {
                id: 'demo-board', title: 'Launch checklist', ownerId: ME.uid, createdAt: now - 9 * day, categories: cats,
                members: {
                    [ME.uid]: { role: 'owner', ...person(ME) },
                    'u-maya': { role: 'admin', ...person(DIRECTORY[1]) },
                    'u-jonas': { role: 'member', ...person(DIRECTORY[2]) },
                    'u-priya': { role: 'viewer', ...person(DIRECTORY[3]) },
                },
                memberIds: [ME.uid, 'u-maya', 'u-jonas', 'u-priya'],
            },
        },
        tasks: {
            'demo-board': [
                t('Fix login redirect loop', 'Safari users get bounced between /login and /home after the OAuth callback.\nRepro: fresh profile, block third-party cookies.', ['c-bug'], DIRECTORY[1], 'u-jonas', 2),
                t('Landing page copy', 'Draft the hero headline, three feature blurbs and the pricing FAQ.', ['c-feat', 'c-ui'], ME, null, 3),
                t('Set up uptime alerts', 'Ping /health every minute and page the on-call channel after 3 misses.', ['c-ops'], DIRECTORY[2], ME.uid, 5),
                t('Onboarding email sequence', '', ['c-feat'], ME, null, 6),
                t('Pick a colour palette', 'Ember: warm blacks with an orange accent.', ['c-ui'], DIRECTORY[1], 'u-maya', 8, true),
            ],
        },
    };
}

let data;
try { data = JSON.parse(localStorage.getItem(KEY)); } catch { data = null; }
if (!data || !data.boards) data = seed();

const listeners = new Set();
function emit() {
    try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* storage unavailable */ }
    listeners.forEach((fn) => fn());
}
function watch(fn) {
    listeners.add(fn);
    queueMicrotask(fn);
    return () => listeners.delete(fn);
}
const clone = (v) => JSON.parse(JSON.stringify(v));

// ---------- Auth ----------

let user = null;
try { user = JSON.parse(localStorage.getItem(USER_KEY)); } catch { user = null; }
const authListeners = new Set();
const setUser = (u) => {
    user = u;
    try { u ? localStorage.setItem(USER_KEY, JSON.stringify(u)) : localStorage.removeItem(USER_KEY); } catch { /* ignore */ }
    authListeners.forEach((fn) => fn(user));
};

export function onUser(cb) {
    authListeners.add(cb);
    queueMicrotask(() => cb(user));
    return () => authListeners.delete(cb);
}
export const signIn = async () => setUser(ME);
export const signOut = async () => setUser(null);

// ---------- Boards ----------

export const watchBoards = (uid, cb) => watch(() => cb(
    Object.values(data.boards).filter((b) => b.memberIds.includes(uid)).sort((a, b) => b.createdAt - a.createdAt).map(clone),
));
export const watchBoard = (id, cb) => watch(() => cb(data.boards[id] ? clone(data.boards[id]) : null));

export async function createBoard(u, title) {
    const id = newId();
    data.boards[id] = {
        id, title, ownerId: u.uid, createdAt: Date.now(), categories: defaultCategories(),
        members: { [u.uid]: { role: 'owner', ...person(u) } }, memberIds: [u.uid],
    };
    data.tasks[id] = [];
    emit();
    return id;
}
export async function renameBoard(id, title) { data.boards[id].title = title; emit(); }
export async function deleteBoard(id) { delete data.boards[id]; delete data.tasks[id]; emit(); }
export async function saveCategories(id, categories) { data.boards[id].categories = clone(categories); emit(); }

// ---------- Members ----------

export async function addMember(board, email, role) {
    const u = DIRECTORY.find((d) => d.email === email.trim().toLowerCase());
    if (!u) throw new Error('Nobody with that email has signed in to Tasker yet. (Demo people: maya@, jonas@, priya@example.com)');
    const b = data.boards[board.id];
    if (b.members[u.uid]) throw new Error(`${u.name} is already on this board.`);
    b.members[u.uid] = { role, ...person(u) };
    b.memberIds.push(u.uid);
    emit();
}
export async function setMemberRole(id, uid, role) { data.boards[id].members[uid].role = role; emit(); }
export async function removeMember(id, uid) {
    const b = data.boards[id];
    delete b.members[uid];
    b.memberIds = b.memberIds.filter((m) => m !== uid);
    emit();
}

// ---------- Tasks ----------

export const watchTasks = (boardId, cb) => watch(() => cb(clone(data.tasks[boardId] || [])));

export async function createTask(boardId, u, d) {
    (data.tasks[boardId] ||= []).push({
        id: newId(), title: d.title, content: d.content || '', categoryIds: d.categoryIds || [],
        creatorId: u.uid, creatorName: u.name, creatorPhoto: u.photoURL || '',
        workerId: d.workerId || null, media: d.media || null, finished: false, createdAt: Date.now(), finishedAt: null,
    });
    emit();
}
export async function updateTask(boardId, taskId, patch) {
    const task = data.tasks[boardId].find((x) => x.id === taskId);
    Object.assign(task, patch);
    if ('finished' in patch) task.finishedAt = patch.finished ? Date.now() : null;
    emit();
}
export async function deleteTask(boardId, taskId) {
    data.tasks[boardId] = data.tasks[boardId].filter((x) => x.id !== taskId);
    emit();
}

// ---------- Media ----------
// Demo keeps the file inside the task as a data: URL, so videos have to be small.

const DEMO_VIDEO_MAX = 3 * 1024 * 1024;

export function uploadMedia(boardId, file, onProgress) {
    const type = kindOf(file);
    if (type === 'video' && file.size > DEMO_VIDEO_MAX) {
        return Promise.reject(new Error('Demo mode keeps files in this browser, so videos are limited to 3 MB here.'));
    }
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onprogress = (e) => onProgress && e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
        reader.onerror = () => reject(reader.error);
        reader.onload = () => resolve({ url: reader.result, path: `demo-${newId()}`, type, name: file.name, size: file.size });
        reader.readAsDataURL(file);
    });
}

export async function deleteMedia() { /* nothing to clean up: the file lives in the task */ }
