# Winter webinar sign-up page

Standalone site for the free winter webinar on Wednesday 9 December 2026, 7pm UK, used for paid Meta traffic.
It is a like-for-like copy of ilmi.online/winter: the same design, wording and features. One page and one
small function, no build step.

| File | What it is |
|---|---|
| `index.html` | The whole page: styles, markup and script. Settings are in the `CONFIG` block near the bottom |
| `images/` | Ilmi logo, the calligraphy background tile and the teacher's photo |
| `api/register.js` | Saves a sign-up (Vercel function) |
| `test/register.test.js` | Tests for the function: `npm test` |
| `tools/make-copy.py` | Rebuilds `index.html` from the old page. It lists every difference from ilmi.online/winter |

## What differs from ilmi.online/winter

Only these: the date (9 December), the Meta pixel, the sign-up endpoint (`/api/register`), the page
description, share title and address in `<head>`, and the logo and background tile being served as small SVG files.

## How a sign-up is saved

The form posts to `/api/register`. The function checks the details, tidies the WhatsApp number to the
country code with no plus (447...), creates or updates the lead in Chakra and adds the number to the
"Winter webinar 2026" campaign, which sends the confirmation and the reminders.

Set the variables from `.env.example` in Vercel under Settings, Environment Variables. Never commit a real key.

## Meta pixel

The snippet in `<head>` loads the pixel (PageView) on the live site only, not on a local copy or a Vercel preview link. The form sends
the `Lead` event once the sign-up has been saved, so failed or invalid submissions are never counted.

## Deploy

Live at https://ilmi-winter.app. Vercel project `ilmi_winter`, connected to this repository: every push to
`main` deploys. Framework preset: Other. No build command, output is the repo root.
