// Shared by the app and both backends: roles, permissions, default categories.

export const ROLES = ['owner', 'admin', 'member', 'viewer'];

export const ROLE_LABEL = {
    owner: 'Owner',
    admin: 'Admin',
    member: 'Member',
    viewer: 'Viewer',
};

// Ember-friendly swatches for new categories
export const PALETTE = ['#ff7a1a', '#ffb62e', '#e5484d', '#3fb98a', '#4c9aff', '#a78bfa', '#f472b6', '#9ca3af'];

export const newId = () => (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2)).slice(0, 8);

export const defaultCategories = () => [
    { id: newId(), title: 'Feature', color: PALETTE[1] },
    { id: newId(), title: 'Bug', color: PALETTE[2] },
    { id: newId(), title: 'Chore', color: PALETTE[4] },
];

export const roleOf = (board, uid) => (board && board.members && board.members[uid] ? board.members[uid].role : null);

// work: create, claim, assign, finish and edit tasks. manage: categories, members, rename board.
export const can = {
    work: (role) => role === 'owner' || role === 'admin' || role === 'member',
    manage: (role) => role === 'owner' || role === 'admin',
};
