# KNIEID — standalone Cloudflare deployment

This is a separate deployment package for **your own Cloudflare account**. It does not modify the current Sites deployment and does not use ChatGPT sign-in. The existing public website under `../public/` is reused and built with a new account portal.

## What it implements

- `/committee`, `/members`, `/admin`: KNIEID username/password sign-in and role-based information.
- `SuperAdmin`: permanent full-access owner, bootstrapped from a runtime secret at first successful sign-in.
- Create member, Vorstand (`committee`) and administrator accounts; edit roles, block/unblock, and reset temporary passwords. Only SuperAdmin can create or edit administrators. SuperAdmin cannot be downgraded or blocked.
- New/reset passwords require a password change before protected information or administration is accessible. Users change their own passwords. No self-registration and no email sending.
- Bilingual German/English portal, public/member/committee/admin information visibility and audit log.
- Server-side password verification and permissions, random opaque sessions stored as token hashes, eight-hour expiry, Secure/HttpOnly/SameSite=Strict cookies, exact-Origin checks for writes, and persistent account/IP login-attempt limits.
- Blocking an account or changing its permissions immediately invalidates its sessions. Password changes revoke previous sessions. User blocking is used instead of deleting account/audit history.

No password, password hash, live token, Cloudflare API credential or private configuration is committed here. The public website remains accessible without an account.

## Setup — no paid plan required

You need your own verified Cloudflare account and Node.js 22.13+ to use the command-line path. Remain on **Workers Free**. Do not enable Workers Paid or paid add-ons. A free `workers.dev` address is enough; you do not need a domain.

### Command-line path

1. Download/clone this GitHub repository, open a terminal in `cloudflare/`, and install the pinned tool:

   ```sh
   npm ci
   npx wrangler login
   npx wrangler d1 create knieid-users
   ```

2. Copy the returned D1 database ID into `database_id` in `cloudflare/wrangler.jsonc`, replacing the placeholder. The database must belong to the same Cloudflare account as the Worker. Do not reuse the existing Sites database ID; it belongs to a different deployment.

3. Apply the initial schema:

   ```sh
   npx wrangler d1 migrations apply DB --remote
   ```

4. Enter the following runtime secrets privately. These prompts do not put secret values in shell arguments or source files:

   ```sh
   npx wrangler secret put AUTH_PEPPER
   npx wrangler secret put BOOTSTRAP_ADMIN_PASSWORD
   npx wrangler secret put OWNER_EMAIL
   ```

   - `AUTH_PEPPER`: generate 64 random hex characters with your password manager. Save a secure backup. Changing it later makes every stored password unverifiable; do not rotate it casually.
   - `BOOTSTRAP_ADMIN_PASSWORD`: choose the temporary password for `SuperAdmin`. Prefer a new unique password rather than a value shared in chat.
   - `OWNER_EMAIL`: your chosen contact email. It is not used as the login identifier.

5. Deploy:

   ```sh
   npm run deploy
   ```

   If Wrangler asks to create the named Worker before setting secrets, create/deploy it first; its portal fails closed until all secrets and the schema are configured. Public assets can still be served. Finish setting the secrets before attempting SuperAdmin login.

6. Open the returned `workers.dev` URL followed by `/admin`. Sign in as `SuperAdmin`, then change the temporary password when prompted. Verify member and Vorstand access using disposable test accounts before storing real member information. After confirming the permanent owner password works, remove the bootstrap secret:

   ```sh
   npx wrangler secret delete BOOTSTRAP_ADMIN_PASSWORD
   ```

   Existing owner accounts never re-bootstrap, even if the secret is accidentally retained. There is no public account-creation or reset endpoint.

### GitHub-connected dashboard path

You can instead create the D1 database in Cloudflare's dashboard, paste/run `migrations/0001_accounts.sql` in its SQL console, and update the database ID in `wrangler.jsonc` on GitHub. Run the schema **once**, not on every deployment.

In **Workers & Pages**, create an application connected to `nav-reh/KNIEID-Website`:

- Root directory: `cloudflare`
- Worker name: `knieid-website` (must match Wrangler configuration)
- Build command: `npm run build`
- Deploy command: `npx wrangler deploy`

Add the three values above as **runtime secrets** in the Worker settings, not as plaintext GitHub files or frontend/build variables. Keep GitHub app access limited to this repository. Set up the database and secrets before the first real login. Do not configure the old Next/Vinext build for this deployment: this package uses a small native Worker with static assets.

After the new site passes its checks, share its actual returned URL. The existing `chatgpt.site` address does not automatically move or redirect; leave it running until the new deployment is verified. A custom domain can be attached later.

## Free-plan and security acceptance checks

Static files are served asset-first; only API and portal routes invoke the Worker. The code uses only Workers, static assets and D1, with no paid queues, storage add-ons, email provider or external authentication subscription.

**Important:** free-plan CPU limits still apply. Password verification must be checked in the real Cloudflare account's request metrics. Local test times are not Cloudflare CPU measurements. A dry-run is not a live deployment. Do not lower password costs to make a failing free-plan deployment appear to work; stop and revisit the authentication design if it exceeds limits. Free plans and quotas are not a lifetime price guarantee.

The password implementation uses PBKDF2-HMAC-SHA256 with a random 256-bit salt and a separate HMAC server pepper. The 100,000-iteration setting accommodates the hosted Workers PBKDF2 ceiling; it is below OWASP's general 600,000-iteration PBKDF2 recommendation. The pepper is therefore mandatory and kept outside D1. This is a platform/security tradeoff, not a claim of OWASP compliance or an independent security audit. Production security review and measured runtime acceptance remain necessary before putting sensitive member data into this system.

Required checks after deployment:

1. `/` works without signing in; static styles and logo load.
2. `SuperAdmin` must change its temporary password and can create test member/Vorstand users.
3. Members cannot read committee/admin information even by requesting `/api/portal?action=admin` directly.
4. Blocked users lose existing sessions, cannot sign in, and receive no protected content.
5. Password resets invalidate previous sessions and require another change at next login.
6. Worker CPU usage fits the Free plan under repeated successful and failed logins.
7. Check mobile display and user-management forms on your phone.

No existing users, documents, information items or session records have been exported from Sites. Migration of real records would be a separate, explicit step. The association still needs to supply its full legal notice, privacy policy, retention rules and appropriate contact information before collecting personal data.

## Development and verification

```sh
npm test
npm run build
npx wrangler deploy --dry-run
```

Tests use actual SQLite in memory and check owner bootstrap, mandatory password change, role hierarchy, member/committee/admin information filtering, revocation, blocking, resets, password storage, rate limits and cross-origin write rejection. Test fixtures contain synthetic test-only credentials, never the requested production password.

Files:

- `src/worker.mjs`: server routes, account management, sessions and information API.
- `src/security.mjs`: password/session helpers and permission rules.
- `portal/`: bilingual portal UI and style source.
- `migrations/0001_accounts.sql`: standalone D1 schema.
- `scripts/build.mjs`: copies public assets and changes hosting-specific login wording in generated output only.
- `wrangler.jsonc`: Worker/static-asset/D1 configuration.
- `SECRETS.example`: required secret names with placeholders only.

Keep backups of D1 and your password manager. This version has administrator-controlled password resets but no automated recovery email; protect the permanent SuperAdmin password carefully.
