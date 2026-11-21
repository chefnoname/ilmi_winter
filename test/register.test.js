// Run with: npm test. Uses a local fake server in place of the main site / Chakra, so nothing real is contacted.
import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import handler, { normalisePhone, campaignFor } from "../api/register.js";

let server, base, hits = [], nextStatus = 200;
before(async () => {
  server = http.createServer((req, res) => {
    let body = "";
    req.on("data", c => (body += c));
    req.on("end", () => {
      hits.push({ url: req.url, auth: req.headers.authorization, body: JSON.parse(body || "{}") });
      res.writeHead(nextStatus, { "Content-Type": "application/json" });
      res.end("{}");
    });
  });
  await new Promise(r => server.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());
beforeEach(() => {
  hits = []; nextStatus = 200;
  for (const k of ["CHAKRA_API_KEY", "CHAKRA_WINTER_CAMPAIGN_ID", "CHAKRA_ATTR_EVENT", "CHAKRA_ATTR_TRIAL", "CHAKRA_ATTR_SOURCE", "REGISTER_FORWARD_URL", "CHAKRA_WINTER_CAMPAIGN_ID_48H", "CHAKRA_WINTER_CAMPAIGN_ID_24H"]) delete process.env[k];
});

const call = (body, method = "POST") =>
  handler.fetch(new Request("http://x/api/register", {
    method, headers: { "Content-Type": "application/json" },
    body: method === "POST" ? (typeof body === "string" ? body : JSON.stringify(body)) : undefined,
  }));
const good = { first_name: " Amina ", email: "Amina@Example.com", whatsapp: "07700 900123", trial_interest: "Maybe", source: "meta" };

test("phone numbers are tidied to country code + digits", () => {
  assert.equal(normalisePhone("+44 7700 900123"), "447700900123");
  assert.equal(normalisePhone("07700 900123"), "447700900123");
  assert.equal(normalisePhone("0044 7700 900123"), "447700900123");
  assert.equal(normalisePhone("+1 (415) 555-0123"), "14155550123");
  assert.equal(normalisePhone("12345"), null);
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
  assert.deepEqual(hits[0].body, { data: { name: "Amina", phone_number: "447700900123", email: "amina@example.com", event: "winter-webinar-2026", trial_interest: "Maybe", source: "meta" } });
  assert.deepEqual(hits[1].body, { campaignId: "camp-1", phoneNumber: "447700900123" });
});

test("rejects bad input and sends nothing on", async () => {
  process.env.REGISTER_FORWARD_URL = `${base}/x`;
  assert.equal((await call({ ...good, first_name: "" })).status, 400);
  assert.equal((await call({ ...good, email: "nope" })).status, 400);
  assert.equal((await call({ ...good, whatsapp: "123" })).status, 400);
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
