// Firebase backend: Google sign-in + Firestore.
//
// Firestore layout
//   users/{uid}                 profile, so people can be added to a board by email
//   boards/{boardId}            title, ownerId, members{uid:{role,name,email,photoURL}}, memberIds[], categories[]
//   boards/{boardId}/tasks/{id} title, content, categoryIds[], creatorId/Name/Photo, workerId, finished, createdAt

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import {
    getAuth, GoogleAuthProvider, signInWithPopup, signOut as fbSignOut, onAuthStateChanged,
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import {
    getFirestore, collection, doc, query, where, onSnapshot, addDoc, setDoc, updateDoc, deleteDoc,
    getDocs, writeBatch, serverTimestamp, arrayUnion, arrayRemove, deleteField,
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { firebaseConfig } from './firebase-config.js';
import { defaultCategories } from './model.js';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const ms = (v) => (v && v.toMillis ? v.toMillis() : typeof v === 'number' ? v : null);
const read = (snap) => ({ id: snap.id, ...snap.data({ serverTimestamps: 'estimate' }) });
const person = (u) => ({ name: u.name, email: u.email, photoURL: u.photoURL || '' });

// ---------- Auth ----------

export const isDemo = false;

export function onUser(cb) {
    return onAuthStateChanged(auth, (u) => {
        if (!u) return cb(null);
        const user = {
            uid: u.uid,
            name: u.displayName || u.email || 'Unnamed',
            email: (u.email || '').toLowerCase(),
            photoURL: u.photoURL || '',
        };
        cb(user);
        setDoc(doc(db, 'users', user.uid), { ...user, updatedAt: serverTimestamp() }, { merge: true })
            .catch((e) => console.error('Could not save profile', e));
    });
}

export const signIn = () => signInWithPopup(auth, new GoogleAuthProvider());
export const signOut = () => fbSignOut(auth);

// ---------- Boards ----------

const boardOf = (snap) => {
    const b = read(snap);
    b.createdAt = ms(b.createdAt);
    return b;
};

export function watchBoards(uid, cb, onError) {
    const q = query(collection(db, 'boards'), where('memberIds', 'array-contains', uid));
    return onSnapshot(q, (snap) => {
        cb(snap.docs.map(boardOf).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)));
    }, onError);
}

export function watchBoard(id, cb) {
    return onSnapshot(doc(db, 'boards', id), (snap) => cb(snap.exists() ? boardOf(snap) : null), (e) => {
        console.error(e);
        cb(null);
    });
}

export async function createBoard(user, title) {
    const ref = await addDoc(collection(db, 'boards'), {
        title,
        ownerId: user.uid,
        members: { [user.uid]: { role: 'owner', ...person(user) } },
        memberIds: [user.uid],
        categories: defaultCategories(),
        createdAt: serverTimestamp(),
    });
    return ref.id;
}

export const renameBoard = (id, title) => updateDoc(doc(db, 'boards', id), { title });

export async function deleteBoard(id) {
    const tasks = await getDocs(collection(db, 'boards', id, 'tasks'));
    for (let i = 0; i < tasks.docs.length; i += 400) {
        const batch = writeBatch(db);
        tasks.docs.slice(i, i + 400).forEach((d) => batch.delete(d.ref));
        await batch.commit();
    }
    await deleteDoc(doc(db, 'boards', id));
}

export const saveCategories = (id, categories) => updateDoc(doc(db, 'boards', id), { categories });

// ---------- Members ----------

export async function addMember(board, email, role) {
    const snap = await getDocs(query(collection(db, 'users'), where('email', '==', email.trim().toLowerCase())));
    if (snap.empty) throw new Error('Nobody with that email has signed in to Tasker yet.');
    const u = snap.docs[0].data();
    if (board.members[u.uid]) throw new Error(`${u.name} is already on this board.`);
    await updateDoc(doc(db, 'boards', board.id), {
        [`members.${u.uid}`]: { role, ...person(u) },
        memberIds: arrayUnion(u.uid),
    });
}

export const setMemberRole = (id, uid, role) => updateDoc(doc(db, 'boards', id), { [`members.${uid}.role`]: role });

export const removeMember = (id, uid) => updateDoc(doc(db, 'boards', id), {
    [`members.${uid}`]: deleteField(),
    memberIds: arrayRemove(uid),
});

// ---------- Tasks ----------

export function watchTasks(boardId, cb, onError) {
    return onSnapshot(collection(db, 'boards', boardId, 'tasks'), (snap) => {
        cb(snap.docs.map((d) => {
            const t = read(d);
            t.createdAt = ms(t.createdAt);
            t.finishedAt = ms(t.finishedAt);
            return t;
        }));
    }, onError);
}

export const createTask = (boardId, user, data) => addDoc(collection(db, 'boards', boardId, 'tasks'), {
    title: data.title,
    content: data.content || '',
    categoryIds: data.categoryIds || [],
    creatorId: user.uid,
    creatorName: user.name,
    creatorPhoto: user.photoURL || '',
    workerId: data.workerId || null,
    image: data.image || null, // optional photo as a JPEG data URL (see js/media.js)
    finished: false,
    createdAt: serverTimestamp(),
});

export function updateTask(boardId, taskId, patch) {
    const data = { ...patch };
    if ('finished' in patch) data.finishedAt = patch.finished ? serverTimestamp() : deleteField();
    return updateDoc(doc(db, 'boards', boardId, 'tasks', taskId), data);
}

export const deleteTask = (boardId, taskId) => deleteDoc(doc(db, 'boards', boardId, 'tasks', taskId));