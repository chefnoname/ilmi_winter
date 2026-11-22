# Winter webinar sign-up page

Standalone site for the free winter webinar on Wednesday 9 December 2026, 7pm UK, used for paid Meta traffic.
It is a like-for-like copy of ilmi.online/winter: the same design, wording and features. One page and one
small function, no build step.

| File | What it is |
|---|---|
| `index.html` | The whole page: styles, markup and script. Settings are in the `CONFIG` block near the bottom |
| `images/` | Ilmi logo, the calligraphy background tile and the teacher's photo |
| `vendor/` | `libphonenumber-min-1.13.17.js`: checks phone numbers per country. The published libphonenumber-js bundle (MIT), unchanged |
| `api/register.js` | Saves a sign-up (Vercel function) |
| `test/register.test.js` | Tests for the function: `npm test` |
| `tools/make-copy.py` | Rebuilds `index.html` from the old page. It lists every difference from ilmi.online/winter |

## What differs from ilmi.online/winter

Only these: the date (9 December), the Meta pixel, the sign-up endpoint (`/api/register`), the page
description, share title and address in `<head>`, the logo and background tile being served as small SVG files,
and the country picker on the WhatsApp number (below).

## How a sign-up is saved

The form posts to `/api/register`. The function checks the details, tidies the WhatsApp number to the
country code with no plus (447...), creates or updates the lead in Chakra and adds the number to the
"Winter webinar 2026" campaign, which sends the confirmation and the reminders.

The WhatsApp number has a country picker: one small box beside the number that shows the chosen country's
flag and dialling code (the real select lies invisibly over it, so phones open their own country list).
Nothing is chosen at the start and choosing is required. The page adds the country's dialling code and checks the number against that country's rules, so the function always
receives the number with its country code ("+44..."). A number that arrives without one is refused rather
than guessed. A country code typed into the number box is removed from it automatically: "+44" or "0044" as
soon as it is typed (the picker switches to that country), and the chosen country's code typed again with no
plus ("44 7561...") when the visitor leaves the box. A plain number is left exactly as typed. If the checker file has not loaded, the page falls back to simpler checks so sign-ups never stop.

In Chakra, each campaign step's "To" must be set to "Phone Number (Lead)". Left empty, Chakra sends to the
lead's linked contact, which a lead saved through the API does not have, and the message fails.

After a save, the function logs what Chakra answered as yes/no facts only (was the number kept on the lead,
did the campaign use the same lead), never the number, name or email.

Late sign-ups join a shorter copy of that campaign, so nobody is told "two days away" with a day to go.
The function picks by the time left before the webinar starts (9 December, 7pm UK): the full campaign up to
48 hours before, `CHAKRA_WINTER_CAMPAIGN_ID_48H` from 48 to 24 hours before, and
`CHAKRA_WINTER_CAMPAIGN_ID_24H` after that. If a late one is not set, the next longer one is used.

Set the variables from `.env.example` in Vercel under Settings, Environment Variables. Never commit a real key.

## Meta pixel

The snippet in `<head>` loads the pixel (PageView) on the live site only, not on a local copy or a Vercel preview link. The form sends
the `Lead` event once the sign-up has been saved, so failed or invalid submissions are never counted.

### Conversions API

When `META_CAPI_TOKEN` is set in Vercel, `api/register.js` also reports each saved sign-up to Meta from the
server, so it still counts when an ad blocker or the browser stops the pixel. The page makes one ID per
sign-up and gives it to both the pixel and the function, and Meta uses it to count the pair once. The email
and WhatsApp number are sent hashed (SHA-256), never in the clear, along with the visitor's IP address,
browser and Meta cookies. If Meta refuses or cannot be reached the sign-up still succeeds, and the function
logs Meta's error code only. To check it, sign up once and look for `register: Meta accepted the Lead` in
the Vercel logs.

## Deploy

Live at https://ilmi-winter.app. Vercel project `ilmi_winter`, connected to this repository: every push to
`main` deploys. Framework preset: Other. No build command, output is the repo root.
