/**
 * POST /api/register
 * Sign-ups from the winter webinar page. Checks the details, tidies the WhatsApp number
 * (country code, digits only, e.g. 447700900123) and saves the sign-up in Chakra.
 *
 * Body: { first_name, email, whatsapp, trial_interest?, source?, website? }
 * `website` is a hidden honeypot field: bots fill it in, people don't.
 *
 * Two ways to reach Chakra, chosen by the environment variables set in Vercel:
 *   1. Direct: CHAKRA_API_KEY + CHAKRA_WINTER_CAMPAIGN_ID are set on this project.
 *      Optional CHAKRA_ATTR_EVENT, CHAKRA_ATTR_TRIAL, CHAKRA_ATTR_SOURCE = keys of the custom
 *      lead attributes for event, trial_interest and source.
 *      Optional CHAKRA_WINTER_CAMPAIGN_ID_48H and CHAKRA_WINTER_CAMPAIGN_ID_24H = shorter copies of
 *      the campaign for people who sign up in the last 48 or 24 hours (see campaignFor below).
 *   2. Forward: REGISTER_FORWARD_URL is set. The sign-up is passed, server to server, to the
 *      main site's sign-up endpoint, which already holds the Chakra key. Nothing secret is
 *      needed on this project and the Chakra logic lives in one place.
 * The API key is only ever read from the environment. It is never logged.
 */

const MAX_BODY_BYTES = 2048;
const EVENT = "winter-webinar-2026";
const DEFAULT_SOURCE = "direct";
const TRIAL_ANSWERS = new Set(["Yes", "Maybe", "No"]);
const CHAKRA = "https://api.chakrahq.com/v1/ext/procedure";
const WEBINAR_START = Date.parse("2026-12-09T19:00:00Z");   // Wed 9 Dec, 7pm UK (GMT). Same as startUTC in index.html.
const HOUR = 60 * 60 * 1000;

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

const str = (v, max) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/** "+44 7700 900123", "0044...", "07700..." -> "447700900123". UK numbers without a code get 44. */
export function normalisePhone(input) {
  let digits = input.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.replace(/^00/, "");
  else if (!input.trim().startsWith("+") && digits.startsWith("0")) digits = "44" + digits.slice(1);
  return /^\d{8,15}$/.test(digits) ? digits : null;
}

function post(url, body, token) {
  return fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(8000),
  });
}

/**
 * Which Chakra campaign a sign-up made at `now` joins. Chakra sends each reminder at a fixed time,
 * so someone signing up with a day to go must not be put in the campaign that says "two days away".
 *   more than 48h before the start: the full campaign (confirm, 48h, 24h, join link, replay)
 *   48h to 24h before:              the "under 48h" copy (no 48h reminder)
 *   under 24h, or after the start:  the "under 24h" copy (no 48h or 24h reminder)
 * A late campaign that is not set falls back to the next longer one, so a sign-up is never dropped.
 */
export function campaignFor(now, env) {
  const full = env.CHAKRA_WINTER_CAMPAIGN_ID;
  const under48 = env.CHAKRA_WINTER_CAMPAIGN_ID_48H || full;
  const under24 = env.CHAKRA_WINTER_CAMPAIGN_ID_24H || under48;
  if (now >= WEBINAR_START - 24 * HOUR) return under24;
  if (now >= WEBINAR_START - 48 * HOUR) return under48;
  return full;
}

/** Create/update the lead, then add them to the winter campaign (which sends the confirmation). */
async function sendToChakra(p, env) {
  const key = env.CHAKRA_API_KEY;
  const data = { name: p.first_name, phone_number: p.phone, email: p.email };
  if (env.CHAKRA_ATTR_EVENT) data[env.CHAKRA_ATTR_EVENT] = p.event;
  if (env.CHAKRA_ATTR_TRIAL && p.trial_interest) data[env.CHAKRA_ATTR_TRIAL] = p.trial_interest;
  if (env.CHAKRA_ATTR_SOURCE) data[env.CHAKRA_ATTR_SOURCE] = p.source;

  const lead = await post(`${CHAKRA}/lead/process`, { data }, key);
  if (!lead.ok) throw new Error(`Chakra lead/process returned ${lead.status}`);

  const camp = await post(`${CHAKRA}/lead/add-phone-number-to-campaign`,
    { campaignId: campaignFor(Date.now(), env), phoneNumber: p.phone }, key);
  if (camp.status >= 500) throw new Error(`Chakra campaign add returned ${camp.status}`);
  // A 4xx here usually means they're already in the campaign (signed up twice): the lead
  // is saved, so don't show the person an error, just log it.
  if (!camp.ok) console.warn(`register: campaign add returned ${camp.status}`);
}

/** Pass the sign-up to the main site's endpoint, which saves it in Chakra. */
async function forward(p, url) {
  const res = await post(url, {
    first_name: p.first_name,
    email: p.email,
    whatsapp: `+${p.phone}`,
    trial_interest: p.trial_interest,
    source: p.source,
  });
  if (!res.ok) throw new Error(`Forward returned ${res.status}`);
}

async function handler(req) {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { Allow: "POST", "Content-Type": "application/json" },
    });
  }

  const length = Number(req.headers.get("content-length") ?? 0);
  if (length > MAX_BODY_BYTES) return json({ error: "Body too large" }, 413);

  let raw;
  try {
    const text = await req.text();
    if (text.length > MAX_BODY_BYTES) return json({ error: "Body too large" }, 413);
    raw = JSON.parse(text);
    if (!raw || typeof raw !== "object") throw new Error("not an object");
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  // Honeypot: pretend it worked so bots don't retry, but send nothing on.
  if (str(raw.website, 200)) return json({ ok: true });

  const firstName = str(raw.first_name, 60);
  const email = str(raw.email, 120).toLowerCase();
  const phone = normalisePhone(str(raw.whatsapp, 40));
  const trial = str(raw.trial_interest, 10);
  const source = str(raw.source, 60).replace(/[^\w.-]/g, "") || DEFAULT_SOURCE;

  if (!firstName) return json({ error: "First name is required" }, 400);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return json({ error: "Email is not valid" }, 400);
  if (!phone) return json({ error: "WhatsApp number is not valid" }, 400);

  const payload = {
    event: EVENT,
    first_name: firstName,
    email,
    phone,
    trial_interest: TRIAL_ANSWERS.has(trial) ? trial : "",
    source,
  };

  const env = process.env;
  try {
    if (env.CHAKRA_API_KEY && env.CHAKRA_WINTER_CAMPAIGN_ID) {
      await sendToChakra(payload, env);
    } else if (env.REGISTER_FORWARD_URL) {
      await forward(payload, env.REGISTER_FORWARD_URL);
    } else {
      console.error("register: set CHAKRA_API_KEY + CHAKRA_WINTER_CAMPAIGN_ID, or REGISTER_FORWARD_URL");
      return json({ error: "Registration not configured" }, 503);
    }
  } catch (err) {
    console.error("register: could not save sign-up:", err instanceof Error ? err.message : "unknown error");
    return json({ error: "Could not save sign-up" }, 502);
  }

  return json({ ok: true });
}

// Vercel treats this as a Web handler (Request in, Response out) only when exported as { fetch }.
export default { fetch: handler };
