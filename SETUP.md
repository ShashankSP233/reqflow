# Running ReqFlow — what kind of software this is

This is **not** a program you install like Word or an app on your phone. It's
a *web application*: a website (the part you click around in) plus a server
behind it (the part that saves and fetches data) plus a database (where the
data actually lives). All three pieces have to be running together, somewhere,
for it to work. There's no single downloadable file that replaces that.

The good news: it was built to run on **Replit**, which handles all three
pieces for you automatically. That's by far the easiest path.

## Option A — Run it on Replit (recommended, no technical setup)

1. Go to replit.com and create a new Repl (or open the one this project
   originally came from).
2. Upload/import this folder (or ask whoever manages your Replit account to
   do it).
3. Replit will detect the two services already configured here — the
   **web** app and the **API Server** — and provision a Postgres database for
   you automatically (the `DATABASE_URL`, `PORT`, and `BASE_PATH` values are
   all set up already in this project's `.replit-artifact` config files).
4. Click **Run**. Replit installs everything and starts both services.
5. Before first use, run the database setup once from Replit's shell:
   ```
   pnpm --filter @workspace/db run push
   ```
   This creates all the tables (including the new `holidays` table).

That's it — Replit gives you a live web address you (and your team) can open
in any browser, on any device, no installation needed on their end either.

## Option B — Run it yourself on a computer/server (technical)

If you'd rather host it elsewhere (or hand this to a developer), you'll need:

- **Node.js** (v20 or newer) and **pnpm** installed (`npm install -g pnpm`)
- A **PostgreSQL** database — see "Setting up a local database on Windows
  (no Docker)" below if you don't have one yet.

### Setting up a local database on Windows (no Docker)

1. Download the installer from
   [postgresql.org/download/windows](https://www.postgresql.org/download/windows/)
   → "Download the installer" → pick the latest version for Windows x86-64.
2. Run it, keeping defaults for everything, with two things to note:
   - You'll be asked to set a **password** for the `postgres` user — write
     it down, you'll need it below.
   - Keep the **port** at the default `5432`.
   - You can skip "Stack Builder" if prompted at the end — not needed here.
3. That's it — Postgres now runs quietly in the background as a Windows
   service (no need to manually start it each time, unlike Docker).
4. Set your connection string **persistently** (so you don't have to retype
   it in every new terminal):
   ```powershell
   setx DATABASE_URL "postgres://postgres:YOUR_PASSWORD@localhost:5432/postgres"
   ```
   Replace `YOUR_PASSWORD` with what you set in step 2. **Close and reopen
   PowerShell** afterward — `setx` only affects new terminal windows, not
   the one you ran it in.
   
   *(If your password contains symbols like `@`, `#`, `%`, or `/`, and you
   get a connection error later, that's why — those need URL-encoding. Tell
   me the symbol and I'll give you the encoded version.)*

With that done, `DATABASE_URL` is available in every terminal from now on —
you can skip setting it again in the steps below.

```bash
# 1. Install dependencies
pnpm install

# 2. Generate the API client from openapi.yaml — REQUIRED before anything
#    else will run; see the note right after this code block.
pnpm --filter @workspace/api-spec run codegen

# 3. Create the database tables
pnpm --filter @workspace/db run push

# 4. Create the first login (see "Real login" section below)
pnpm --filter @workspace/db run seed

# 5. Start everything — both the API server and the website, in one window
pnpm dev
```

That last command (`pnpm dev`) replaces the old two-separate-terminal setup —
both servers now run together in a single window, each line prefixed
`[API]` or `[WEB]` in a different color so you can tell them apart. Press
`Ctrl+C` once to stop both.

Then open the website's address in a browser (by default `http://localhost:21455`).

### Real login (added — replaces the old demo user-switcher)

This app now has actual username/password login instead of the "pick who
you are" dropdown. Since nobody can reach Setup → Users to create accounts
without already being logged in, there's a one-time seed step to create the
first account:

```bash
pnpm --filter @workspace/db run seed
```

This prints a name and password for one **Purchase Head** account — log in
with those, then use Setup → Users to add everyone else on the real team,
setting each person's own password there (or leave the password blank for
someone who won't log in themselves, like a Director used only as a
reference name on approval notes).

Whenever the schema changes (like this one did — added `password_hash` and
made `name` unique), re-run `pnpm --filter @workspace/db run push` before
the seed step.

**Before the "proper launch" (remote access) phase**, a few things here
need upgrading from their current pilot-appropriate defaults:
- **Sessions are stored in memory** on the server — fine for one shared
  local machine, but everyone gets logged out if the server restarts, and
  it won't work at all across multiple server instances. Needs a real
  session store (e.g. Postgres-backed) before going remote.
- **`SESSION_SECRET`** isn't set explicitly yet — the server generates a
  random one at startup (you'll see a warning about this in the terminal).
  Set it to a fixed value as a real environment variable before launch, or
  every restart logs everyone out.
- **Cookies aren't marked `secure`** yet, since local testing runs over
  plain `http`. Once this is served over `https` for real, that needs
  turning on, or login won't work correctly.

None of these block the 5-day local pilot — they're specifically the
"before opening this up beyond one dedicated computer" list.

### About `lib/api-client-react` and `lib/api-zod`

These two packages weren't in your original export at all — they've been
reconstructed and are now confirmed working:

- **`custom-fetch.ts`** (the part that actually makes API calls) — written
  to match your app's real behavior (`{ error: "message" }` on failure,
  204-with-no-body on several endpoints), and verified by running it against
  a local test server before ever handing it to you.
- **The barrel files** (`index.ts` in each package) — confirmed against a
  real `pnpm --filter @workspace/api-spec run codegen` run: `api-client-react`
  was right on the first guess, and `api-zod` needed one filename correction
  (`generated/api.ts`, not `generated/api.zod.ts`), now fixed.

Run `pnpm --filter @workspace/api-spec run codegen` (step 2 above) to
generate the actual content these barrel files point at.

## Troubleshooting

**"Ignored build scripts: esbuild" / `ERR_PNPM_IGNORED_BUILDS`** — pnpm
blocks install scripts from dependencies it hasn't been told to trust. This
project declares the ones it needs in `pnpm-workspace.yaml` under
`allowBuilds` (this used to be a different, now-removed setting called
`onlyBuiltDependencies` — if you ever see that name again in an older
backup of this file, it's stale and won't do anything on pnpm v11). If you
still see this warning (e.g. a brand-new dependency was added later), run:
```powershell
pnpm approve-builds --all
```
then `pnpm install` again. This should only be needed once per new
dependency that runs install scripts, not on every install.

## What you already have

The zip I've been sharing with you *is* the complete, current source code —
that's the "download." Every change discussed is already in it.
