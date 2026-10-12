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
7. **Build > Storage > Get started** (only needed for task photos/videos, which are optional). Firebase requires the pay-as-you-go **Blaze** plan to create a Storage bucket; it still includes a free monthly quota, and you can set a budget alert. Then **Storage > Rules**: paste [`storage.rules`](storage.rules) and publish. Re-publish `firestore.rules` too, since it changed.

## Deploy to GitHub Pages

Push to GitHub, then **Settings > Pages > Deploy from a branch > `main` / root**. The site is at `https://<user>.github.io/<repo>/`. Routing uses `#/board/<id>`, so no 404 workaround is needed.

## How it works

| Thing | Where |
| --- | --- |
| Board | `boards/{id}`: `title`, `ownerId`, `members{uid: {role, name, email, photoURL}}`, `memberIds[]`, `categories[{id, title, color}]` |
| Task | `boards/{id}/tasks/{id}`: `title`, `content`, `categoryIds[]`, `creatorId/Name/Photo`, `workerId`, `media` (optional: `{url, path, type, name, size}`), `finished`, `createdAt`, `finishedAt` |
| Task photo/video | Storage `boards/{id}/media/{file}`. Photos up to 10 MB (anything over 1920 px is shrunk in the browser first), videos up to 50 MB. Deleted with the task, or when replaced or removed. |
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
- Photo/video links are Firebase download URLs: anyone who has the exact URL can open the file, even without signing in. Uploading and deleting follow the board roles. In demo mode files live inside the task in your browser, so videos are capped at 3 MB there.

## Files

```
index.html            page shell
css/style.css         Ember theme (tokens shared with the ze-* / qb-* UIs)
js/app.js             routing, views, modals
js/ui.js              DOM helpers, icons, modals, toasts
js/model.js           roles, permissions, default categories
js/media.js           photo/video validation, size limits, photo downscaling
js/backend-firebase.js  Google auth + Firestore
js/backend-demo.js    same API, in-browser storage
js/firebase-config.js your Firebase config
firestore.rules       security rules (database)
storage.rules         security rules (photos and videos)
dev/serve.ps1         local static server
```
