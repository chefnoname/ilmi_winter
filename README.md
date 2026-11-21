# The Winter Lock-In

Standalone sign-up page for the free live session on Wednesday 9 December 2026, 7pm UK.
Built for paid Meta traffic. Static files and one small function, no build step.

| File | What it is |
|---|---|
| `index.html` | The page |
| `styles.css` | Styles |
| `config.js` | Settings: date, links, Meta pixel id and the hosts the pixel may load on |
| `app.js` | Form, thank-you state, calendar links |
| `privacy.html` | Privacy notice (served at `/privacy`) |
| `api/register.js` | Saves a sign-up (Vercel function) |
| `test/register.test.js` | Tests for the function: `npm test` |

## How a sign-up is saved

The form posts to `/api/register`. The function checks the details and tidies the WhatsApp number, then either:

1. passes the sign-up to the main site's endpoint (`REGISTER_FORWARD_URL`), which holds the Chakra key, or
2. talks to Chakra directly, if `CHAKRA_API_KEY` and `CHAKRA_WINTER_CAMPAIGN_ID` are set on this project.

Set these in Vercel under Settings, Environment Variables. See `.env.example`. Never commit a real key.

## Meta pixel

`config.js` loads the pixel (PageView) only on the hosts in `pixelHosts`. `app.js` sends the `Lead`
event once the sign-up has been saved, so failed or invalid submissions are never counted.

## Deploy

Vercel project `winterlockin`. Framework preset: Other. No build command, output is the repo root.
