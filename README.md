# Video Editor Portfolio

This project now supports three content modes:

- `backend` mode for real password-protected editing with persistent JSON storage
- `firebase` mode for Google sign-in plus Firestore
- `demo` mode for browser-only local editing

The app will automatically use the backend API when you run `server.js`. If no backend is available, it falls back to Firebase or demo mode.

## Files

- `index.html` - Portfolio website
- `admin.html` - Admin panel
- `styles.css` - Styling for site and admin panel
- `app.js` - Frontend rendering logic
- `admin.js` - Admin panel logic
- `firebase.js` - Runtime data layer that picks backend, Firebase, or demo mode
- `server.js` - Node backend and static file server
- `data/portfolio-data.json` - Local content data used by the backend
- `firebase-config.js` - Active Firebase config for the fallback Firebase mode
- `.env.example` - Environment variables for backend deployment
- `render.yaml` - Render blueprint with persistent disk settings

## Local start

1. Set an admin password in your shell.
2. Start the server.
3. Open the portfolio or admin page in your browser.

PowerShell:

```powershell
$env:ADMIN_PASSWORD="choose-a-strong-password"
$env:DATA_DIR="./data"
npm start
```

URLs:

- `http://127.0.0.1:5500`
- `http://127.0.0.1:5500/admin.html`

## Backend mode

When `ADMIN_PASSWORD` is set and `server.js` is running:

- the portfolio reads from `DATA_DIR/portfolio-data.json`
- the admin page asks for the password
- successful login creates a secure HTTP-only session cookie
- saved edits persist on the server

Important:

- This is much safer than putting a password in frontend code.
- For production, always deploy behind HTTPS.
- Anyone with file or server access can still read `portfolio-data.json`.

## Firebase fallback mode

If you want Google sign-in plus Firestore instead of the built-in backend:

1. Open `firebase-config.js`.
2. Replace the example values.
3. Set `enabled: true`.
4. Set `allowedAdminEmail` to the editor email.

Example:

```js
export const firebaseSettings = {
  enabled: true,
  mode: "firebase",
  allowedAdminEmail: "you@example.com",
  firebaseConfig: {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT.appspot.com",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID",
  },
};
```

## Deployment

This app is ready to deploy as a Node service on platforms like Render or Railway.

Important: for edits to survive redeploys and restarts, your host must provide persistent storage. By default, services on Render use an ephemeral filesystem, so local file changes are lost unless you attach a persistent disk. Railway also requires a Volume for persistent local files.

Render:

- The included `render.yaml` defines:
- `npm start` as the start command
- a health check at `/api/health`
- `DATA_DIR=/var/data`
- a persistent disk mounted at `/var/data`

Render setup:

1. Deploy the repo as a Node web service.
2. Use the included `render.yaml` when creating the service.
3. Set `ADMIN_PASSWORD` in the Render dashboard.
4. Keep the disk mount path at `/var/data`.
5. Visit `/admin.html` and log in with that password.
6. Add videos or shorts from the admin panel. They will remain after refresh, restart, and redeploy because the data file is stored on the persistent disk.

Railway:

1. Deploy the repo as a Node service.
2. Add `ADMIN_PASSWORD` in the Railway dashboard.
3. Attach a Volume and mount it to `/app/data` or another writable directory.
4. Set `DATA_DIR` to that same mount path if you do not use Railway's auto-provided volume path.
5. Start the app with `npm start`.

## Notes

- `data/portfolio-data.json` is the default local content source in backend mode.
- In production, the real source becomes `DATA_DIR/portfolio-data.json`.
- `admin.html` remains available, but editing is locked until authentication succeeds.
- The app still works as a static site if you prefer Firebase or demo mode.
- Render persistent disk docs: https://render.com/docs/disks
- Render Blueprint spec: https://render.com/docs/blueprint-spec
- Railway Volumes docs: https://docs.railway.com/deploy/volumes
