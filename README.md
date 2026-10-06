# Command Centre

Command Centre is a macOS-first, local-first personal productivity desktop app for IIT Madras academics, Manipal academics, Exora work, and personal obligations. It contains no AI service or chatbot dependency.

Phase 2 adds read-only Google account ingestion. OAuth credentials are stored in macOS Keychain and are never written to SQLite or exposed to the renderer.

Gmail ingestion is intentionally selective. Configure per-account mail routing under **Settings → Connected Accounts → Mail routing**, then use **Re-evaluate Inbox** to safely archive existing records that no longer match. IIT Madras forwarding detection uses database-backed institution domains plus sender and original-recipient/forwarding headers; it does not depend on a hard-coded personal address.

## Prerequisites

- macOS (the architecture is portable, but Phase 1 is designed and tested for macOS)
- Node.js 22 or newer
- npm 10 or newer

## Install and run

```bash
npm install
npm run dev
```

## Google Cloud setup

1. Create or select a dedicated project in Google Cloud Console.
2. In **APIs & Services → Library**, enable **Gmail API** and **Google Calendar API**.
3. Configure the OAuth consent screen. If the app is in Testing, add the IITM address under **Test users**. Workspace administrator policy can still prevent consent.
4. Configure only: `openid`, `email`, `profile`, `https://www.googleapis.com/auth/gmail.readonly`, and `https://www.googleapis.com/auth/calendar.readonly`.
5. In **APIs & Services → Credentials**, create an OAuth client ID with application type **Desktop app**. Do not create a Web application client.
6. Copy `.env.example` into a private shell configuration. Supply `GOOGLE_OAUTH_CLIENT_ID`; if the downloaded Desktop client JSON includes a client secret, supply `GOOGLE_OAUTH_CLIENT_SECRET`. Never commit real values.
7. Start development with the values in the environment:

```bash
GOOGLE_OAUTH_CLIENT_ID='…apps.googleusercontent.com' \
GOOGLE_OAUTH_CLIENT_SECRET='…' \
npm run dev
```

The Desktop client uses Google's supported ephemeral loopback callback at `http://127.0.0.1:<random-port>/oauth/google/callback`; there is no fixed redirect URI to register. Authorization opens in the normal browser and uses state validation plus PKCE. The app never receives the user's password.

Development loads Google OAuth client configuration from the project-root `.env` into **Electron main only**. The renderer and preload never receive OAuth client credentials, and nothing OAuth-related is exposed through IPC. User tokens remain in macOS Keychain.

### Packaged app OAuth configuration

Before `npm run build` or `npm run package`, create a private `.env.packaged` file (gitignored) from `.env.packaged.example`:

```bash
cp .env.packaged.example .env.packaged
# edit .env.packaged — set GOOGLE_OAUTH_CLIENT_ID only unless your Desktop client JSON includes a secret
```

Only `GOOGLE_OAUTH_CLIENT_ID` and, when required, `GOOGLE_OAUTH_CLIENT_SECRET` belong in `.env.packaged`. `electron-builder.config.cjs` copies this file into the app bundle as `Contents/Resources/google-oauth.env` when the file exists at build time. Main process loads **only those keys** at startup; the file is not part of renderer assets and is never logged.

If `.env.packaged` is missing, the build still succeeds but the packaged app will not include OAuth configuration until you add the file and rebuild.

`gmail.readonly` is a restricted Google scope. Testing with configured test users is supported; broader distribution may require Google verification and additional review.

The Vite renderer runs on port 5173 in development. Electron main and preload code compile to `dist-electron/`.

## Local data locations

Command Centre stores SQLite and Electron profile data under macOS Application Support.

| Environment | Application Support folder | Default database |
|-------------|---------------------------|------------------|
| **Production** (`Command Centre.app`) | `~/Library/Application Support/Command Centre/` | `command-centre.sqlite` |
| **Development** (`npm run dev`) | `~/Library/Application Support/Command Centre Dev/` | `command-centre.sqlite` |

**Legacy development data:** an earlier bug pinned development to `~/Library/Application Support/command-centre/`. New development sessions no longer use that folder. Your existing working database may still be there until you migrate it manually into the production location.

Optional override for either environment: set `COMMAND_CENTRE_DB=/absolute/path.sqlite` to use a specific SQLite file (useful for isolated smoke tests).

### One-time migration from legacy dev data to production

Do this only with **both** the dev Electron instance and **Command Centre.app** fully quit.

1. Quit the dev app (Electron).
2. Quit **Command Centre.app**.
3. Back up both locations (preserve originals; do not delete the legacy folder):

```bash
backup_root="$HOME/Desktop/command-centre-data-backup-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$backup_root"
cp -R "$HOME/Library/Application Support/command-centre" "$backup_root/legacy-command-centre"
cp -R "$HOME/Library/Application Support/Command Centre" "$backup_root/production-command-centre" 2>/dev/null || true
```

4. Copy the **known working** legacy database into the canonical production folder (creates the folder if needed):

```bash
mkdir -p "$HOME/Library/Application Support/Command Centre"
cp "$HOME/Library/Application Support/command-centre/command-centre.sqlite" \
  "$HOME/Library/Application Support/Command Centre/command-centre.sqlite"
```

The legacy copy under `command-centre/` remains untouched.

5. Launch **Command Centre.app** (not `npm run dev`).
6. Verify local data and that **Settings → Connected Accounts** shows your Google account row.
7. Confirm the Keychain entry still matches that account UUID (service `com.commandcentre.google.oauth`; account attribute equals the integration account id in SQLite). Reconnect only if sync fails with an authentication error after migration.
8. Use **Sync Now** and confirm mail/calendar ingestion works.

Alternatively, export a backup from the working app via **Settings → Data / Backup → Export backup**, quit both apps, replace `~/Library/Application Support/Command Centre/command-centre.sqlite` with the exported file, then launch **Command Centre.app**.

## Database

SQLite is owned exclusively by Electron main. Default path: `userData/command-centre.sqlite` (see table above). Set `COMMAND_CENTRE_DB=/absolute/path.sqlite` for an isolated database. Migrations use SQLite `user_version`, are additive, and never reset user data. Seeds use stable IDs plus `INSERT OR IGNORE`, so they are safe to run repeatedly.

Use **Settings → Data / Backup → Export backup** to create a consistent online SQLite backup.

## Quality and build

```bash
npm run typecheck
npm run lint
npm test
npm run build       # unpacked app in release/mac-*/
npm run package     # distributable DMG/ZIP
```

SQLite uses the runtime's built-in driver, so there is no native addon to rebuild when Electron changes.

## Project structure

- `electron/main/` — Electron lifecycle, hardened window, validated IPC
- `electron/preload/` — narrow typed context bridge
- `electron/database/` — relational schema, migrations, idempotent seed data
- `electron/services/` — application service shared by UI and future adapters
- `electron/integrations/google/` — installed-app OAuth and read-only Gmail/Calendar provider
- `electron/integrations/keychain-credential-store.ts` — macOS Keychain credential boundary
- `electron/services/integration-service.ts` — account lifecycle, idempotent ingestion and proposals
- `electron/classification/` — deterministic proposal interface
- `electron/portals/` — secure future remote-view boundary
- `electron/mcp/` — non-running read-only adapter shape
- `shared/` — IPC contracts and runtime schemas
- `src/` — React renderer and design system

See [SPEC.md](./SPEC.md) for the product and architecture specification.
