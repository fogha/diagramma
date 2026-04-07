# Diagramma — Apps Script Deployment

## Prerequisites

- [clasp](https://github.com/google/clasp) installed globally: `npm install -g @google/clasp`
- A Google account logged in via `clasp login`

## Steps

### 1. Get your script ID

Open your target Google Doc → **Extensions → Apps Script** → copy the script ID from the URL bar (the long string after `/projects/`).

### 2. Create `.clasp.json`

In the repo root (not inside `appsscript/`), create:

```json
{
  "scriptId": "YOUR_SCRIPT_ID_HERE",
  "rootDir": "./appsscript"
}
```

### 3. Set the app URL

Store `DIAGRAMMA_APP_URL` in Apps Script Script Properties instead of hardcoding it in `Code.gs`:

1. Open the Apps Script editor.
2. Go to `Project Settings`.
3. Under `Script Properties`, add `DIAGRAMMA_APP_URL`.

Use your deployed app URL, for example:

```text
https://your-username.github.io/diagramma
```

For local development with ngrok, use the ngrok HTTPS URL:

```text
https://your-subdomain.ngrok-free.dev
```

### 4. Push the code

```bash
clasp push
# or: npm run deploy:gas
```

### 5. Authorise permissions

In the Apps Script editor, open the `onOpen` function and click **Run**. Accept the OAuth prompts for:
- `https://www.googleapis.com/auth/documents` — read/write the document
- `https://www.googleapis.com/auth/script.container.ui` — show sidebar and dialogs

### 6. Reload and use

Reload the Google Doc. A **Diagramma** menu will appear in the menu bar.

## Dev workflow

For rapid iteration, use the watcher script which auto-pushes on file changes:

```bash
npm run dev:gas
```

This watches the `appsscript/` directory and runs `clasp push` whenever a file changes (with 500 ms debounce).
