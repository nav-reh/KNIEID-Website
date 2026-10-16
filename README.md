# KNIEID e.V. website and access portal

Live: https://knieid-community.farhadshaikh11.chatgpt.site

- `/`: public German/English association website, mobile-friendly layout and floating Go to Top button after scrolling.
- `/admin`: user permissions, bilingual information publishing and audit log.
- `/members`: approved members' information.
- `/committee`: approved committee information.
- `/api/portal`: server-authorised JSON API. Administrators use `?action=admin` for management data. Writes require verified administrator identity and a matching request Origin.

## Source files

Public page source is now under `public/`, replacing the previous tracked `dist/` source:

- `public/index.html`: page structure.
- `public/app.js`: public-site translations, events and interactions.
- `public/style.css`: responsive design and Go to Top button.
- `public/assets/`: supplied logo asset.
- `app/portal-client.tsx`: bilingual admin/member/committee interfaces.
- `app/api/portal/route.ts`: management and content API.
- `lib/portal.ts`: database access, stable account binding and owner bootstrap.
- `lib/policy.mjs`: permission rules.
- `db/schema.ts` and `drizzle/`: D1 schema and immutable migrations.
- `.openai/hosting.json`: existing Sites identity and DB binding.
- `tests/`: policy and API integration tests.

`dist/` is generated build output and is no longer source code.

## Access model

The website stays public without an account. Protected areas use platform-owned Sign in with ChatGPT; no website passwords are stored.

The hosting secret `ADMIN_OWNER_EMAIL` identifies the initial owner by verified sign-in email. On first matching login, the stable platform user ID is saved as the permanent owner. After that, another account with the same email cannot take ownership. The configured owner uses their existing site-owner ChatGPT account.

Roles:

| Role | Public | Member information | Committee information | Admin information / management |
|---|---|---|---|---|
| Anonymous / pending | Yes | No | No | No |
| Member | Yes | Yes | No | No |
| Committee | Yes | Yes | Yes | No |
| Admin / owner | Yes | Yes | Yes | Yes |

Blocked accounts can read only public information. Only the owner can grant or revoke administrator roles. The owner cannot be blocked or downgraded. Administrators cannot change their own permissions. Changes are checked on every request, not just in the interface.

Users can sign in to create a pending account. Administrators can also pre-authorise a verified email before first sign-in; the first matching account is bound to its stable ID. Pre-authorising does not send an invitation email. Accounts are blocked rather than deleted so access can be restored and the audit history retained.

Visibility controls apply to information items published in the admin area. The association's public marketing sections remain public. Information is plain text, with separate German and English fields. Private information is returned only to permitted identities, and never stored in the public JS bundle.

## Development

Requires Node >=22.13.0 and pnpm. Use the lockfile's package manager version.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

The Sites plugin's installer/build helpers are used in the managed environment. The supplied starter includes local development sign-in simulation only for the portable profile; production identity is provided by Sites.

```sh
node --test tests/policy.test.mjs
node tests/api.integration.mjs
pnpm exec tsc --noEmit
pnpm build
```

The API integration test uses real in-memory SQLite and test-only platform stubs. It verifies invitations, role hierarchy, public/private information, blocked identities, immutable ownership, admin escalation prevention and CSRF rejection.

Generate schema migrations with `pnpm db:generate` after editing `db/schema.ts`. Inspect generated SQL. Publishing with Sites applies pending migrations before deployment. Never edit an already applied migration.

## Hosting and secrets

Deploy through Sites as a Worker with `d1: "DB"`. Configure `ADMIN_OWNER_EMAIL` as a hosting secret, outside source. `.env.example` documents the name without a real value. This project now requires a server and D1 and cannot be deployed as plain GitHub Pages.

The GitHub repository is the source copy; publishing to Sites is a separate step. Requested changes are pushed and deployed together by the assistant. No GitHub Actions deployment integration is currently configured.

## Remaining content work

The legal notice still needs the association's representative and registry details. The privacy notice needs the association's final legal bases, retention policy and contact details. No board identities, credentials, payment destinations or registry numbers are invented. Google Fonts are loaded externally; Facebook and map links open only on interaction. See `SOURCES.md` for source provenance.

The logo and supplied materials retain their existing rights. No open-source licence is assigned.
