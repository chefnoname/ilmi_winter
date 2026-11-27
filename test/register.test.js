// Run with: npm test. Uses a local fake server in place of the main site / Chakra, so nothing real is contacted.
import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { createHash } from "node:crypto";
import handler, { normalisePhone, campaignFor } from "../api/register.js";

let server, base, hits = [], nextStatus = 200, metaStatus = 200, metaReply = "{}", chakraReply = null;
before(async () => {
  server = http.createServer((req, res) => {
    let body = "";
    req.on("data", c => (body += c));
    req.on("end", () => {
      hits.push({ url: req.url, auth: req.headers.authorization, body: JSON.parse(body || "{}") });
      const meta = req.url.endsWith("/events");
      res.writeHead(meta ? metaStatus : nextStatus, { "Content-Type": "application/json" });
      res.end(meta ? metaReply : JSON.stringify(chakraReply?.(req.url) ?? {}));
    });
  });
  await new Promise(r => server.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());
beforeEach(() => {
  hits = []; nextStatus = 200; metaStatus = 200; metaReply = "{}"; chakraReply = null;
  for (const k of ["CHAKRA_API_KEY", "CHAKRA_WINTER_CAMPAIGN_ID", "CHAKRA_ATTR_EVENT", "CHAKRA_ATTR_TRIAL", "CHAKRA_ATTR_SOURCE", "REGISTER_FORWARD_URL", "CHAKRA_WINTER_CAMPAIGN_ID_48H", "CHAKRA_WINTER_CAMPAIGN_ID_24H", "META_CAPI_TOKEN"]) delete process.env[k];
});

const call = (body, method = "POST", headers = {}) =>
  handler.fetch(new Request("http://x/api/register", {
    method, headers: { "Content-Type": "application/json", ...headers },
    body: method === "POST" ? (typeof body === "string" ? body : JSON.stringify(body)) : undefined,
  }));
const good = { first_name: " Amina ", email: "Amina@Example.com", whatsapp: "+44 7700 900123", trial_interest: "Maybe", source: "meta" };

test("phone numbers are tidied to country code + digits", () => {
  assert.equal(normalisePhone("+44 7700 900123"), "447700900123");
  assert.equal(normalisePhone("+447700900123"), "447700900123");
  assert.equal(normalisePhone("0044 7700 900123"), "447700900123");
  assert.equal(normalisePhone("+1 (415) 555-0123"), "14155550123");
  assert.equal(normalisePhone("+12345"), null);
});

test("a number without a country code is refused, not guessed", () => {
  assert.equal(normalisePhone("07700 900123"), null);      // UK style, no code
  assert.equal(normalisePhone("7700900123"), null);
  assert.equal(normalisePhone("416 555 0123"), null);       // Canada style, no code
  assert.equal(normalisePhone("447700900123"), null);       // looks like a code, but nothing says so
  assert.equal(normalisePhone("+0 7700 900123"), null);     // no country code starts with 0
});

test("forwards a valid sign-up to the main site", async () => {
  process.env.REGISTER_FORWARD_URL = `${base}/api/winter-register`;
  const res = await call(good);
  assert.equal(res.status, 200);
  assert.equal(hits.length, 1);
  assert.deepEqual(hits[0].body, { first_name: "Amina", email: "amina@example.com", whatsapp: "+447700900123", trial_interest: "Maybe", source: "meta" });
  assert.equal(hits[0].auth, undefined);
});

test("uses a default source when none is given", async () => {
  process.env.REGISTER_FORWARD_URL = `${base}/x`;
  await call({ ...good, source: "" });
  assert.equal(hits[0].body.source, "direct");
});

test("shows an error to the visitor when the save fails", async () => {
  process.env.REGISTER_FORWARD_URL = `${base}/x`;
  nextStatus = 502;
  assert.equal((await call(good)).status, 502);
});

test("goes straight to Chakra when this project has its own key", async (t) => {
  process.env.CHAKRA_API_KEY = "test-key";
  process.env.CHAKRA_WINTER_CAMPAIGN_ID = "camp-1";
  process.env.CHAKRA_ATTR_EVENT = "event";
  process.env.CHAKRA_ATTR_TRIAL = "trial_interest";
  process.env.CHAKRA_ATTR_SOURCE = "source";
  process.env.REGISTER_FORWARD_URL = `${base}/should-not-be-used`;
  const realFetch = globalThis.fetch;
  t.after(() => (globalThis.fetch = realFetch));
  globalThis.fetch = (url, init) => realFetch(String(url).replace("https://api.chakrahq.com", base), init);
  const res = await call(good);
  assert.equal(res.status, 200);
  assert.deepEqual(hits.map(h => h.url), ["/v1/ext/procedure/lead/process", "/v1/ext/procedure/lead/add-phone-number-to-campaign"]);
  assert.equal(hits[0].auth, "Bearer test-key");
  assert.deepEqual(hits[0].body, { data: { name: "Amina", phone_number: "+447700900123", email: "amina@example.com", event: "winter-webinar-2026", trial_interest: "Maybe", source: "meta" } });
  assert.deepEqual(hits[1].body, { campaignId: "camp-1", phoneNumber: "447700900123" });
});

test("an overseas number reaches Chakra with its own country code, not read as a UK number", async (t) => {
  process.env.CHAKRA_API_KEY = "test-key";
  process.env.CHAKRA_WINTER_CAMPAIGN_ID = "camp-1";
  const realFetch = globalThis.fetch;
  t.after(() => (globalThis.fetch = realFetch));
  globalThis.fetch = (url, init) => realFetch(String(url).replace("https://api.chakrahq.com", base), init);
  for (const [typed, digits] of [["+1 212 555 0100", "12125550100"], ["+61 412 345 678", "61412345678"], ["+971 50 123 4567", "971501234567"]]) {
    hits = [];
    assert.equal((await call({ ...good, whatsapp: typed })).status, 200);
    assert.equal(hits[0].body.data.phone_number, "+" + digits);
    assert.deepEqual(hits[1].body, { campaignId: "camp-1", phoneNumber: digits });
  }
});

test("rejects bad input and sends nothing on", async () => {
  process.env.REGISTER_FORWARD_URL = `${base}/x`;
  assert.equal((await call({ ...good, first_name: "" })).status, 400);
  assert.equal((await call({ ...good, email: "nope" })).status, 400);
  assert.equal((await call({ ...good, whatsapp: "+123" })).status, 400);
  assert.equal((await call({ ...good, whatsapp: "07700 900123" })).status, 400);
  assert.equal((await call({ ...good, whatsapp: "416 555 0123" })).status, 400);
  assert.equal((await call("not json")).status, 400);
  assert.equal((await call("x".repeat(3000))).status, 413);
  assert.equal((await call(null, "GET")).status, 405);
  assert.equal(hits.length, 0);
});

test("honeypot: bots get a fake success and nothing is saved", async () => {
  process.env.REGISTER_FORWARD_URL = `${base}/x`;
  const res = await call({ ...good, website: "http://spam" });
  assert.equal(res.status, 200);
  assert.equal(hits.length, 0);
});

test("says so when nothing is configured", async () => {
  assert.equal((await call(good)).status, 503);
});

test("ignores a trial answer that isn't Yes, Maybe or No", async () => {
  process.env.REGISTER_FORWARD_URL = `${base}/x`;
  await call({ ...good, trial_interest: "<script>" });
  assert.equal(hits[0].body.trial_interest, "");
});

// --- late sign-ups: the campaign is picked by the time left before Wed 9 Dec 2026, 7pm UK (19:00 UTC)
const CAMPAIGNS = { CHAKRA_WINTER_CAMPAIGN_ID: "full", CHAKRA_WINTER_CAMPAIGN_ID_48H: "under48", CHAKRA_WINTER_CAMPAIGN_ID_24H: "under24" };
const at = iso => Date.parse(iso);

test("late sign-ups: the campaign changes exactly at 48 and 24 hours before the start", () => {
  assert.equal(campaignFor(at("2026-11-21T20:00:00Z"), CAMPAIGNS), "full");
  assert.equal(campaignFor(at("2026-12-07T18:59:59Z"), CAMPAIGNS), "full");
  assert.equal(campaignFor(at("2026-12-07T19:00:00Z"), CAMPAIGNS), "under48");
  assert.equal(campaignFor(at("2026-12-08T18:59:59Z"), CAMPAIGNS), "under48");
  assert.equal(campaignFor(at("2026-12-08T19:00:00Z"), CAMPAIGNS), "under24");
  assert.equal(campaignFor(at("2026-12-09T18:30:00Z"), CAMPAIGNS), "under24");
  assert.equal(campaignFor(at("2026-12-09T19:00:00Z"), CAMPAIGNS), "under24");   // webinar has started
  assert.equal(campaignFor(at("2026-12-12T09:00:00Z"), CAMPAIGNS), "under24");   // after it
});

test("late sign-ups: a late campaign that is not set falls back to the next longer one", () => {
  const late = at("2026-12-09T12:00:00Z"), mid = at("2026-12-08T12:00:00Z");
  assert.equal(campaignFor(late, { CHAKRA_WINTER_CAMPAIGN_ID: "full" }), "full");
  assert.equal(campaignFor(mid, { CHAKRA_WINTER_CAMPAIGN_ID: "full" }), "full");
  assert.equal(campaignFor(late, { CHAKRA_WINTER_CAMPAIGN_ID: "full", CHAKRA_WINTER_CAMPAIGN_ID_48H: "under48" }), "under48");
  assert.equal(campaignFor(mid, { CHAKRA_WINTER_CAMPAIGN_ID: "full", CHAKRA_WINTER_CAMPAIGN_ID_24H: "under24" }), "full");
  assert.equal(campaignFor(late, { CHAKRA_WINTER_CAMPAIGN_ID: "full", CHAKRA_WINTER_CAMPAIGN_ID_24H: "under24", CHAKRA_WINTER_CAMPAIGN_ID_48H: "" }), "under24");
});

for (const [when, expected] of [["2026-12-01T10:00:00Z", "full"], ["2026-12-08T10:00:00Z", "under48"], ["2026-12-09T10:00:00Z", "under24"]]) {
  test(`late sign-ups: a sign-up at ${when} is added to the "${expected}" campaign in Chakra`, async (t) => {
    Object.assign(process.env, CAMPAIGNS, { CHAKRA_API_KEY: "test-key" });
    const realFetch = globalThis.fetch;
    t.after(() => (globalThis.fetch = realFetch));
    globalThis.fetch = (url, init) => realFetch(String(url).replace("https://api.chakrahq.com", base), init);
    t.mock.timers.enable({ apis: ["Date"], now: at(when) });
    assert.equal((await call(good)).status, 200);
    assert.deepEqual(hits.map(h => h.url), ["/v1/ext/procedure/lead/process", "/v1/ext/procedure/lead/add-phone-number-to-campaign"]);
    assert.deepEqual(hits[1].body, { campaignId: expected, phoneNumber: "447700900123" });
  });
}
// --- Meta Conversions API. Calls to graph.facebook.com are pointed at the local fake server.
const sha = v => createHash("sha256").update(v).digest("hex");
const EVENT_ID = "3f1c2a9e-5b7d-4c1a-9e2f-000000000001";
function withMeta(t) {
  process.env.REGISTER_FORWARD_URL = `${base}/api/winter-register`;
  process.env.META_CAPI_TOKEN = "test-meta-token";
  const realFetch = globalThis.fetch;
  t.after(() => (globalThis.fetch = realFetch));
  globalThis.fetch = (url, init) => realFetch(String(url).replace("https://graph.facebook.com", base), init);
}
const metaHits = () => hits.filter(h => h.url.endsWith("/events"));

test("reports a saved sign-up to Meta as a Lead, with hashed details and the page's event ID", async (t) => {
  withMeta(t);
  const res = await call({ ...good, event_id: EVENT_ID }, "POST", {
    "user-agent": "TestBrowser/1.0", "x-real-ip": "203.0.113.7", referer: "https://ilmi-winter.app/?utm_source=meta",
    cookie: "other=1; _fbp=fb.1.1700000000.123; _fbc=fb.1.1700000000.AbC",
  });
  assert.equal(res.status, 200);
  assert.equal(metaHits().length, 1);
  const hit = metaHits()[0];
  assert.equal(hit.url, "/1004320156067073/events");
  assert.equal(hit.body.access_token, "test-meta-token");
  assert.equal(hit.auth, undefined);
  const [ev] = hit.body.data;
  assert.equal(hit.body.data.length, 1);
  assert.equal(ev.event_name, "Lead");
  assert.equal(ev.event_id, EVENT_ID);
  assert.equal(ev.action_source, "website");
  assert.equal(ev.event_source_url, "https://ilmi-winter.app/?utm_source=meta");
  assert.ok(Math.abs(ev.event_time - Date.now() / 1000) < 60);
  assert.deepEqual(ev.user_data, {
    em: [sha("amina@example.com")], ph: [sha("447700900123")],
    client_ip_address: "203.0.113.7", client_user_agent: "TestBrowser/1.0",
    fbp: "fb.1.1700000000.123", fbc: "fb.1.1700000000.AbC",
  });
  // nothing personal leaves in the clear
  const sent = JSON.stringify(hit.body);
  for (const plain of ["amina@example.com", "Amina", "447700900123", "7700"]) assert.ok(!sent.includes(plain), plain);
});

test("the sign-up is saved before Meta is told", async (t) => {
  withMeta(t);
  await call({ ...good, event_id: EVENT_ID });
  assert.deepEqual(hits.map(h => h.url), ["/api/winter-register", "/1004320156067073/events"]);
});

test("a sign-up still succeeds when Meta rejects the Lead, and the token is not logged", async (t) => {
  withMeta(t);
  metaStatus = 400;
  metaReply = JSON.stringify({ error: { message: "Invalid OAuth access token test-meta-token", code: 190, error_subcode: 463 } });
  const logged = [];
  const realWarn = console.warn;
  t.after(() => (console.warn = realWarn));
  console.warn = (...a) => logged.push(a.join(" "));
  assert.equal((await call({ ...good, event_id: EVENT_ID })).status, 200);
  assert.equal(logged.length, 1);
  assert.match(logged[0], /status 400, code 190, subcode 463/);
  assert.ok(!logged[0].includes("test-meta-token"));
  assert.ok(!logged[0].includes("OAuth"));
});

test("a sign-up still succeeds when Meta cannot be reached", async (t) => {
  withMeta(t);
  const realFetch = globalThis.fetch;
  globalThis.fetch = (url, init) => String(url).includes("/events") ? Promise.reject(new TypeError("fetch failed")) : realFetch(url, init);
  const realWarn = console.warn;
  t.after(() => (console.warn = realWarn));
  console.warn = () => {};
  assert.equal((await call({ ...good, event_id: EVENT_ID })).status, 200);
});

test("Meta is not told when the page sent no event ID, or a bad one", async (t) => {
  withMeta(t);
  await call(good);
  await call({ ...good, event_id: "x" });
  await call({ ...good, event_id: "has spaces and <tags>" });
  assert.equal(metaHits().length, 0);
  assert.equal(hits.length, 3);
});

test("Meta is not told when there is no token", async (t) => {
  withMeta(t);
  delete process.env.META_CAPI_TOKEN;
  assert.equal((await call({ ...good, event_id: EVENT_ID })).status, 200);
  assert.equal(metaHits().length, 0);
});

test("Meta is not told when the sign-up could not be saved, or for bots and bad input", async (t) => {
  withMeta(t);
  nextStatus = 502;
  assert.equal((await call({ ...good, event_id: EVENT_ID })).status, 502);
  nextStatus = 200;
  await call({ ...good, event_id: EVENT_ID, website: "http://spam" });
  await call({ ...good, event_id: EVENT_ID, email: "nope" });
  assert.equal(metaHits().length, 0);
});

// ---- What Chakra answered, in the logs

function withChakra(t) {
  process.env.CHAKRA_API_KEY = "test-key";
  process.env.CHAKRA_WINTER_CAMPAIGN_ID = "camp-1";
  const realFetch = globalThis.fetch;
  const logged = [], realLog = console.log, realWarn = console.warn;
  t.after(() => { globalThis.fetch = realFetch; console.log = realLog; console.warn = realWarn; });
  globalThis.fetch = (url, init) => realFetch(String(url).replace("https://api.chakrahq.com", base), init);
  console.log = (...a) => logged.push("log: " + a.join(" "));
  console.warn = (...a) => logged.push("warn: " + a.join(" "));
  return logged;
}
const lead = (id, fields = {}) => ({ data: { lead_id: id, name: "Amina", ...fields }, contact: null, contacts: null });

test("logs that Chakra kept the number, as yes/no facts and nothing personal", async (t) => {
  const logged = withChakra(t);
  chakraReply = url => url.endsWith("/lead/process")
    ? { _data: lead("LEAD-000052", { phone_number: "+447700900123", email: "amina@example.com" }) }
    : { _data: { wasCreated: false, process: lead("LEAD-000052", { phone_number: "+447700900123" }) } };
  assert.equal((await call(good)).status, 200);
  assert.deepEqual(logged, ["log: register: saved in Chakra (number on the saved lead: yes; campaign used the same lead, number on it: yes, contact linked: no)"]);
});

test("warns when Chakra saved the lead without the number", async (t) => {
  const logged = withChakra(t);
  chakraReply = url => url.endsWith("/lead/process")
    ? { _data: lead("LEAD-000052", { email: "amina@example.com" }) }
    : { _data: { wasCreated: true, process: lead("LEAD-000053") } };
  assert.equal((await call(good)).status, 200);
  assert.equal(logged.length, 1);
  assert.match(logged[0], /^warn: register: saved in Chakra, but check the lead \(number on the saved lead: no; campaign used a new lead, number on it: no, contact linked: no\)$/);
  for (const personal of ["447700900123", "7700", "amina", "Amina", "LEAD-", "test-key"]) assert.ok(!logged[0].includes(personal), personal);
});

test("a reply from Chakra that is not what we expect never breaks the sign-up", async (t) => {
  const logged = withChakra(t);
  chakraReply = () => ["unexpected"];
  assert.equal((await call(good)).status, 200);
  assert.match(logged[0], /^warn: register: saved in Chakra, but check the lead/);
});
