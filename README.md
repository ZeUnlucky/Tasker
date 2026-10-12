# Tasker

Shared task boards for small teams. Static site (plain HTML/CSS/JS modules, no build step) that runs on GitHub Pages, with Google sign-in and Firestore for storage. Theme: Ember.

## Try it without Firebase

Until `js/firebase-config.js` has a project in it, the site runs in **demo mode**: the same UI, with data kept in your browser (localStorage) and a pretend "Google" sign-in. You can also force it with `?demo` on the URL.

```powershell
powershell -File dev\serve.ps1
```

Then open <http://localhost:8080/>. (ES modules need `http://`, not `file://`.)

## Connect Firebase

1. [Firebase console](https://console.firebase.google.com) > **Add project**.
2. **Build > Authentication > Sign-in method**: enable **Google**.
3. **Authentication > Settings > Authorized domains**: add `<your-user>.github.io` (`localhost` is there by default).
4. **Build > Firestore Database > Create database** (production mode).
5. **Firestore > Rules**: paste the contents of [`firestore.rules`](firestore.rules) and publish.
6. **Project settings > Your apps > Web (`</>`)**: register an app and copy the config into [`js/firebase-config.js`](js/firebase-config.js). These values are not secrets; the rules are what protect the data.
Everything above runs on the free Spark plan. Task photos are stored in Firestore itself, so Firebase Storage (which needs a paid plan) is not used.

## Deploy to GitHub Pages

Push to GitHub, then **Settings > Pages > Deploy from a branch > `main` / root**. The site is at `https://<user>.github.io/<repo>/`. Routing uses `#/board/<id>`, so no 404 workaround is needed.

## How it works

| Thing | Where |
| --- | --- |
| Board | `boards/{id}`: `title`, `ownerId`, `members{uid: {role, name, email, photoURL}}`, `memberIds[]`, `categories[{id, title, color}]` |
| Task | `boards/{id}/tasks/{id}`: `title`, `content`, `categoryIds[]`, `creatorId/Name/Photo`, `workerId`, `image` (optional photo), `finished`, `createdAt`, `finishedAt` |
| Task photo | The `image` field of the task: a JPEG data URL. The browser shrinks the picture (longest side 1280 px or less, lower quality if needed) until it is under about 280 KB, because a Firestore document is capped at 1 MiB. No videos. |
| Profile | `users/{uid}`: written at sign-in, used to find a teammate by email |

Roles (enforced in `firestore.rules`, mirrored in `js/model.js`):

| | Owner | Admin | Member | Viewer |
| --- | :-: | :-: | :-: | :-: |
| See the board | yes | yes | yes | yes |
| Create, edit, claim, assign, finish tasks | yes | yes | yes | |
| Delete tasks | all | all | own | |
| Categories, members, rename board | yes | yes | | |
| Delete board | yes | | | |

The board creator is always the owner and cannot be removed or demoted.

## Known limits

- **Adding a teammate** needs them to have signed in once, because the lookup is by email in `users/`. Any signed-in user can read `users/` (that is how the lookup works), so only share the site with people you trust.
- **Removing a member** keeps their tasks; their name shows as "Former member" on tasks assigned to them.
- **Deleting a category** leaves the id on old tasks, but it is no longer shown.
- No "leave board" for non-owners yet.
- Photos travel with their task, so loading a board downloads every photo on it (up to about 280 KB each). Firestore's free quota is 50,000 document reads a day and 10 GB of transfer a month, which is plenty for a small team. Animated GIFs become a still image, and transparent PNGs get a white background.

## Files

```
index.html            page shell
css/style.css         Ember theme (tokens shared with the ze-* / qb-* UIs)
js/app.js             routing, views, modals
js/ui.js              DOM helpers, icons, modals, toasts
js/model.js           roles, permissions, default categories
js/media.js           photo compression (shrinks a picture to fit a task document)
js/backend-firebase.js  Google auth + Firestore
js/backend-demo.js    same API, in-browser storage
js/firebase-config.js your Firebase config
firestore.rules       security rules
dev/serve.ps1         local static server
```
