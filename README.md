# KNIEID e.V. website

Responsive German/English website for KNIEID e.V., Fellbach, with public information, programme areas, past events, contact links, and member/committee area previews.

Live website: https://knieid-community.farhadshaikh11.chatgpt.site

## Run locally

No build step or dependency installation is needed. With Python 3 installed, run:

```sh
python -m http.server 8000 --directory dist
```

Open http://localhost:8000 in your browser.

## Files

- `dist/index.html`: page structure and navigation.
- `dist/style.css`: responsive layout, original logo framing and brand colours.
- `dist/app.js`: German/English copy, activity filters, past event dialogs, browser bookmarks, message drafts and area previews.
- `dist/assets/knieid-brand-original.png`: supplied original brand screenshot, framed with CSS without changing the artwork.
- `SOURCES.md`: content provenance and verification notes.
- `.openai/hosting.json`: existing Sites identity and static hosting directory; contains no credentials.

## Editing

Edit German and English copy together in `dist/app.js`. Event information is in the `events` array. Keep past events clearly labelled and add only confirmed details. Styling and logo colours are in `dist/style.css`.

## Current functionality and limits

- Language preference and event bookmarks are stored in the visitor's browser.
- Message drafts download locally; the email link opens the visitor's own email app. The website does not send email.
- Member and executive committee areas are labelled previews. No member authentication, roles, protected documents, shared records or backend are implemented.
- The legal notice and privacy text require the association's final details and review.
- Google Fonts are loaded externally. Facebook and Google Maps are links, not embedded integrations.

## Validation

```sh
node --check dist/app.js
```

The initial implementation also passed content and interaction-structure checks for both languages, programme filters, event dialogs, area previews, legal dialogs and internal links. Visual browser testing was unavailable in the creation environment.

## Hosting

The existing Sites deployment remains independent of this GitHub copy. GitHub pushes do not automatically update Sites. To use another static host, publish the contents of `dist/`. No secrets or runtime environment variables are required.

The association's logo and supplied materials retain their existing rights. No open-source licence has been assigned.
