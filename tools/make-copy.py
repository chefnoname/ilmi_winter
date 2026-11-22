"""Builds the standalone site's index.html from the old ilmi.online/winter page.
Everything not listed here is byte-for-byte the old page."""
import re, sys
OLD, NEW = sys.argv[1], sys.argv[2]
out = open(OLD, encoding="utf-8").read()

def rep(old, new, count=1):
    global out
    n = out.count(old)
    assert n == count, (old[:70], "found", n, "expected", count)
    out = out.replace(old, new)

# --- head: source comment
rep("""    /winter: free winter webinar registration page. A standalone page (it does not load the React app)
    so it stays fast on phones coming from Instagram. Settings (date, links) are in the
    CONFIG block near the bottom of this file.""",
"""    Free winter webinar registration page, on its own site. It is a like-for-like copy of
    ilmi.online/winter: the same design, wording and features. Only the date, the Meta pixel,
    the sign-up endpoint and the page description differ. One file, no build step.
    Settings (date, links) are in the CONFIG block near the bottom of this file.""")

# --- head: plain description and share title (what Meta and Google read)
rep("Your Ramadan starts in winter. A free live webinar with Ustadh Yasin Munye on 3 habits of the Salaf: fasting, night prayer and guarding Fajr and Asr.",
    "Your Ramadan starts in winter. A free live webinar with Yasin Munye on 3 winter habits to start before Ramadan arrives.", 3)
rep('<meta property="og:title" content="The Winter Before Ramadan: The Salaf\'s Game Plan" />',
    '<meta property="og:title" content="The Winter Before Ramadan: Free Live Webinar" />')
rep('<meta name="twitter:title" content="The Winter Before Ramadan: The Salaf\'s Game Plan" />',
    '<meta name="twitter:title" content="The Winter Before Ramadan: Free Live Webinar" />')

# --- head: canonical and og:url point at this site's own domain
rep('<link rel="canonical" href="https://ilmi.online/winter" />', '<link rel="canonical" href="https://ilmi-winter.app/" />')
rep('<meta property="og:url" content="https://ilmi.online/winter" />', '<meta property="og:url" content="https://ilmi-winter.app/" />')
rep('<link rel="icon" href="/favicon.ico" />', '<link rel="icon" type="image/png" href="/favicon.png" />')

# --- head: Meta pixel
rep("</head>", """  <script>
  /* Meta pixel. It loads on the live site only: not on a local copy and not on Vercel preview links.
     PageView fires here. Lead fires further down, once a sign-up has been saved. */
  (function(){
    var PIXEL_ID = "1004320156067073";
    var host = location.hostname;
    if (!host || host === "localhost" || host === "127.0.0.1" || /-chefnonames-projects\\.vercel\\.app$/.test(host)) return;
    !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
    /* One PageView per visit. Without this the pixel sends another each time the address changes,
       which it does when someone taps "Save my free seat" (the address gains #register). */
    fbq.disablePushState = true;
    fbq('init', PIXEL_ID);
    fbq('track', 'PageView');
  })();
  </script>
</head>""")

# --- assets: same calligraphy tile and logo, served as small SVG files
rep("/images/monogram-pattern-white-spaced.png", "/images/monogram-pattern-white-spaced.svg", 2)
out, n = re.subn(r'<img class="logo" alt="" src="data:image/svg\+xml;base64,[A-Za-z0-9+/=]+">',
                 '<img class="logo" alt="" src="/images/ilmi-logo.svg" width="56" height="56">', out)
assert n == 1

# --- date
rep("Wednesday 2 December", "Wednesday 9 December", 3)

# --- event details for search engines: built from CONFIG so the address always matches the live site
start = out.index('<script type="application/ld+json">')
end = out.index("</script>", start) + len("</script>\n\n")
out = out[:start] + out[end:]

# --- settings
rep('startUTC: "2026-12-02T19:00:00Z",            // Wed 2 Dec, 7pm UK (GMT)',
    'startUTC: "2026-12-09T19:00:00Z",            // Wed 9 Dec, 7pm UK (GMT)')
rep('pageUrl: "https://ilmi.online/winter",', 'pageUrl: location.origin + "/",              // this site, used in share links and calendar invites')
rep('ustadhPhoto: "/images/winter/ustadh-yasin.jpg",', 'ustadhPhoto: "/images/host.webp",')
rep("""  // Sign-ups go to our own endpoint, which passes them to Zapier -> Chakra (see api/winter-register.ts).
  registerUrl: "/api/winter-register\"""",
"""  // Sign-ups go to our own endpoint, which saves them in Chakra (see api/register.js).
  registerUrl: "/api/register\"""")
rep('/* send the sign-up to /api/winter-register (-> Zapier -> Chakra). Only show "You\'re in" once it\'s saved. */',
    """/* One ID per sign-up. The browser gives it to Meta with the Lead and the server does the same
   (Conversions API), so Meta sees one sign-up, not two. */
const leadId = () => (window.crypto && crypto.randomUUID) ? crypto.randomUUID()
  : Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 12);

/* send the sign-up to /api/register (-> Chakra). Only show "You're in" once it's saved. */""")
rep("""    website: $("website").value      // honeypot: real people leave this empty
  };
""", """    website: $("website").value,     // honeypot: real people leave this empty
    event_id: leadId()               // see leadId above
  };
""")

# --- Lead: the conversion the ads optimise for, only after the sign-up is saved
rep("""      $("submitErr").hidden = false;
      return;
    }
  }
""", """      $("submitErr").hidden = false;
      return;
    }
    if (window.fbq) fbq("track", "Lead", {content_name: "winter-webinar"}, {eventID: data.event_id});   // saved: count it for the ads
  }
""")

# --- event details for search engines (was a fixed block pointing at ilmi.online/winter)
rep("""const stamp = d => d.toISOString().replace(/[-:]/g,"").replace(/\\.\\d{3}/,"");
""", """const stamp = d => d.toISOString().replace(/[-:]/g,"").replace(/\\.\\d{3}/,"");
(function(){
  const s = document.createElement("script"); s.type = "application/ld+json";
  s.textContent = JSON.stringify({"@context":"https://schema.org","@type":"Event","name":"The Winter Before Ramadan: Free Live Webinar","description":"A free live webinar with Yasin Munye on 3 winter habits to start before Ramadan arrives.","startDate":start.toISOString(),"endDate":end.toISOString(),"eventAttendanceMode":"https://schema.org/OnlineEventAttendanceMode","eventStatus":"https://schema.org/EventScheduled","location":{"@type":"VirtualLocation","url":CONFIG.pageUrl},"isAccessibleForFree":true,"offers":{"@type":"Offer","price":"0","priceCurrency":"GBP","availability":"https://schema.org/InStock","url":CONFIG.pageUrl},"organizer":{"@type":"Organization","name":"Ilmi Online","url":"https://ilmi.online"},"performer":{"@type":"Person","name":"Yasin Munye"}});
  document.head.appendChild(s);
})();
""")

# ===== Country picker for the WhatsApp number (21 Nov 2026) =====
# The visitor picks their country and the page adds its dialling code, so every number reaches
# Chakra with a country code. Nothing is chosen at the start, and choosing is required.

# --- styles for the picker and the dialling code box
rep(r"""input:focus{outline:none;border-color:var(--steel);box-shadow:0 0 0 3px var(--ice-soft)}
""",
r"""input:focus{outline:none;border-color:var(--steel);box-shadow:0 0 0 3px var(--ice-soft)}
/* country picker beside the WhatsApp number: one small box that shows the flag and dialling code.
   The real select lies invisibly on top of it, so a tap opens the phone's own list of countries. */
.tel{display:flex;gap:8px}
.tel input{min-width:0}
.cc{position:relative;flex:none}
.dial{display:flex;align-items:center;min-height:52px;padding:0 34px 0 14px;border:1.5px solid var(--mist);border-radius:12px;background:var(--snow) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1.5l5 5 5-5' fill='none' stroke='%235C6B7C' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E") no-repeat right 12px center;color:var(--slate);font-size:16px;font-weight:500;white-space:nowrap}
.dial.on{color:var(--ink)}
.cc select{position:absolute;top:0;left:0;width:100%;height:100%;margin:0;padding:0;border:0;opacity:0;font:inherit;font-size:16px;cursor:pointer;-webkit-appearance:none;appearance:none}
.cc:focus-within .dial{border-color:var(--steel);box-shadow:0 0 0 3px var(--ice-soft)}
@media (max-width:359px){.tel{gap:6px}.tel input{padding-inline:8px}.dial{padding:0 24px 0 8px;background-position:right 7px center;font-size:15px}}   /* the narrowest phones */
""")

# --- the field: country picker, dialling code box, number box, new hint and messages
rep(r"""            <input type="tel" id="wa" name="whatsapp" autocomplete="tel" inputmode="tel" placeholder="+44 7700 900123" required>
            <p class="hint">With your country code. We only use it for the reminder and the replay link.</p>
            <p class="err" id="waErr" hidden>Please add your number with the country code, for example +44 7700 900123.</p>""",
r"""            <div class="tel">
              <div class="cc">
                <span class="dial" id="dial" aria-hidden="true">Country</span>
                <select id="cc" name="country" autocomplete="tel-country-code" aria-label="Country of your WhatsApp number" required>
                  <option value="">Choose your country</option>
                </select>
              </div>
              <input type="tel" id="wa" name="whatsapp" autocomplete="tel-national" inputmode="tel" placeholder="Phone number" required>
            </div>
            <p class="hint">Choose your country and we add the code for you. We only use it for the reminder and the replay link.</p>
            <p class="err" id="ccErr" hidden>Please choose your country.</p>
            <p class="err" id="waErr" hidden>Please check your WhatsApp number. It should match the country you chose.</p>""")

# --- the number checker, loaded on the side
rep(r"""<script>
/* ===== Settings: change these, nothing else ===== */""",
r"""<!-- Checks phone numbers against each country's rules (libphonenumber-js 1.13.17, MIT, unchanged from npm).
     Loaded on the side: the form still works with simpler checks if it has not arrived. -->
<script async src="/vendor/libphonenumber-min-1.13.17.js"></script>
<script>
/* ===== Settings: change these, nothing else ===== */""")

# --- the picker itself, reading the number, and the checks before sending
rep(r"""/* validation */
const show = (id, bad) => { $(id).hidden = !bad; return bad; };
function validate(){
  const f = $("fname").value.trim(), e = $("email").value.trim(), w = $("wa").value.replace(/[\s()-]/g,"");
  const bad = [
    show("fnameErr", f.length < 1),
    show("emailErr", !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e)),
    show("waErr", !/^\+?\d{8,15}$/.test(w))
  ];
  const first = ["fname","email","wa"][bad.indexOf(true)];
  if (first) $(first).focus();
  return !bad.includes(true);
}
""",
r"""/* country picker for the WhatsApp number. No country is chosen at the start: the visitor picks theirs
   and we add its dialling code, so every number reaches us with a country code.
   Each entry is country:dialling code:name. TOP lists the four that also sit at the top of the picker. */
const COUNTRIES = "AF:93:Afghanistan|AX:358:Aland Islands|AL:355:Albania|DZ:213:Algeria|AS:1:American Samoa|AD:376:Andorra|AO:244:Angola|AI:1:Anguilla|AG:1:Antigua & Barbuda|AR:54:Argentina|AM:374:Armenia|AW:297:Aruba|AC:247:Ascension Island|AU:61:Australia|AT:43:Austria|AZ:994:Azerbaijan|BS:1:Bahamas|BH:973:Bahrain|BD:880:Bangladesh|BB:1:Barbados|BY:375:Belarus|BE:32:Belgium|BZ:501:Belize|BJ:229:Benin|BM:1:Bermuda|BT:975:Bhutan|BO:591:Bolivia|BA:387:Bosnia & Herzegovina|BW:267:Botswana|BR:55:Brazil|IO:246:British Indian Ocean Territory|VG:1:British Virgin Islands|BN:673:Brunei|BG:359:Bulgaria|BF:226:Burkina Faso|BI:257:Burundi|KH:855:Cambodia|CM:237:Cameroon|CA:1:Canada|CV:238:Cape Verde|BQ:599:Caribbean Netherlands|KY:1:Cayman Islands|CF:236:Central African Republic|TD:235:Chad|CL:56:Chile|CN:86:China|CX:61:Christmas Island|CC:61:Cocos (Keeling) Islands|CO:57:Colombia|KM:269:Comoros|CD:243:Congo (DRC)|CG:242:Congo (Republic)|CK:682:Cook Islands|CR:506:Costa Rica|HR:385:Croatia|CU:53:Cuba|CW:599:Curacao|CY:357:Cyprus|CZ:420:Czechia|DK:45:Denmark|DJ:253:Djibouti|DM:1:Dominica|DO:1:Dominican Republic|EC:593:Ecuador|EG:20:Egypt|SV:503:El Salvador|GQ:240:Equatorial Guinea|ER:291:Eritrea|EE:372:Estonia|SZ:268:Eswatini|ET:251:Ethiopia|FK:500:Falkland Islands|FO:298:Faroe Islands|FJ:679:Fiji|FI:358:Finland|FR:33:France|GF:594:French Guiana|PF:689:French Polynesia|GA:241:Gabon|GM:220:Gambia|GE:995:Georgia|DE:49:Germany|GH:233:Ghana|GI:350:Gibraltar|GR:30:Greece|GL:299:Greenland|GD:1:Grenada|GP:590:Guadeloupe|GU:1:Guam|GT:502:Guatemala|GG:44:Guernsey|GN:224:Guinea|GW:245:Guinea-Bissau|GY:592:Guyana|HT:509:Haiti|HN:504:Honduras|HK:852:Hong Kong|HU:36:Hungary|IS:354:Iceland|IN:91:India|ID:62:Indonesia|IR:98:Iran|IQ:964:Iraq|IE:353:Ireland|IM:44:Isle of Man|IL:972:Israel|IT:39:Italy|CI:225:Ivory Coast|JM:1:Jamaica|JP:81:Japan|JE:44:Jersey|JO:962:Jordan|KZ:7:Kazakhstan|KE:254:Kenya|KI:686:Kiribati|XK:383:Kosovo|KW:965:Kuwait|KG:996:Kyrgyzstan|LA:856:Laos|LV:371:Latvia|LB:961:Lebanon|LS:266:Lesotho|LR:231:Liberia|LY:218:Libya|LI:423:Liechtenstein|LT:370:Lithuania|LU:352:Luxembourg|MO:853:Macao|MG:261:Madagascar|MW:265:Malawi|MY:60:Malaysia|MV:960:Maldives|ML:223:Mali|MT:356:Malta|MH:692:Marshall Islands|MQ:596:Martinique|MR:222:Mauritania|MU:230:Mauritius|YT:262:Mayotte|MX:52:Mexico|FM:691:Micronesia|MD:373:Moldova|MC:377:Monaco|MN:976:Mongolia|ME:382:Montenegro|MS:1:Montserrat|MA:212:Morocco|MZ:258:Mozambique|MM:95:Myanmar|NA:264:Namibia|NR:674:Nauru|NP:977:Nepal|NL:31:Netherlands|NC:687:New Caledonia|NZ:64:New Zealand|NI:505:Nicaragua|NE:227:Niger|NG:234:Nigeria|NU:683:Niue|NF:672:Norfolk Island|KP:850:North Korea|MK:389:North Macedonia|MP:1:Northern Mariana Islands|NO:47:Norway|OM:968:Oman|PK:92:Pakistan|PW:680:Palau|PS:970:Palestine|PA:507:Panama|PG:675:Papua New Guinea|PY:595:Paraguay|PE:51:Peru|PH:63:Philippines|PL:48:Poland|PT:351:Portugal|PR:1:Puerto Rico|QA:974:Qatar|RE:262:Reunion|RO:40:Romania|RU:7:Russia|RW:250:Rwanda|WS:685:Samoa|SM:378:San Marino|ST:239:Sao Tome & Principe|SA:966:Saudi Arabia|SN:221:Senegal|RS:381:Serbia|SC:248:Seychelles|SL:232:Sierra Leone|SG:65:Singapore|SX:1:Sint Maarten|SK:421:Slovakia|SI:386:Slovenia|SB:677:Solomon Islands|SO:252:Somalia|ZA:27:South Africa|KR:82:South Korea|SS:211:South Sudan|ES:34:Spain|LK:94:Sri Lanka|BL:590:St Barthelemy|SH:290:St Helena|KN:1:St Kitts & Nevis|LC:1:St Lucia|MF:590:St Martin|PM:508:St Pierre & Miquelon|VC:1:St Vincent & the Grenadines|SD:249:Sudan|SR:597:Suriname|SJ:47:Svalbard & Jan Mayen|SE:46:Sweden|CH:41:Switzerland|SY:963:Syria|TW:886:Taiwan|TJ:992:Tajikistan|TZ:255:Tanzania|TH:66:Thailand|TL:670:Timor-Leste|TG:228:Togo|TK:690:Tokelau|TO:676:Tonga|TT:1:Trinidad & Tobago|TA:290:Tristan da Cunha|TN:216:Tunisia|TR:90:Turkey|TM:993:Turkmenistan|TC:1:Turks & Caicos Islands|TV:688:Tuvalu|UG:256:Uganda|UA:380:Ukraine|AE:971:United Arab Emirates|GB:44:United Kingdom|US:1:United States|UY:598:Uruguay|VI:1:US Virgin Islands|UZ:998:Uzbekistan|VU:678:Vanuatu|VA:39:Vatican City|VE:58:Venezuela|VN:84:Vietnam|WF:681:Wallis & Futuna|EH:212:Western Sahara|YE:967:Yemen|ZM:260:Zambia|ZW:263:Zimbabwe".split("|").map(c => c.split(":"));
const TOP = ["GB","US","CA","AU"];
const MAIN = {1:"US",7:"RU",39:"IT",44:"GB",47:"NO",61:"AU",212:"MA",262:"RE",290:"SH",358:"FI",590:"GP",599:"CW"};  // codes shared by several countries
const dialOf = iso => (COUNTRIES.find(c => c[0] === iso) || [])[1] || "";
const flagOf = iso => String.fromCodePoint(...[...iso].map(ch => 127397 + ch.charCodeAt(0)));   // "GB" -> its flag
/* the small box shows the flag and code of the chosen country, or the word Country before one is chosen */
const showDial = () => { const iso = $("cc").value, d = dialOf(iso); $("dial").textContent = d ? flagOf(iso) + " +" + d : "Country"; $("dial").classList.toggle("on", !!d); };
(function(){
  const opt = c => new Option(`${c[2]} (+${c[1]})`, c[0]);
  const all = document.createElement("optgroup"); all.label = "All countries";
  TOP.forEach(iso => $("cc").add(opt(COUNTRIES.find(c => c[0] === iso))));
  COUNTRIES.forEach(c => all.appendChild(opt(c)));
  $("cc").appendChild(all);
  $("cc").addEventListener("change", showDial);
})();
/* set the picker from a number typed with its own code, e.g. +44... */
function pickCountry(iso, code){
  if (!dialOf(iso)) iso = MAIN[code] || (COUNTRIES.find(c => c[1] === String(code)) || [])[0];
  if (iso) { $("cc").value = iso; showDial(); }
}
/* A country code typed into the number box (+44..., 0044...) is taken out as soon as it is recognised and
   the picker is set to that country, so the code only ever shows once: in the small box.
   lifted remembers that a code has already been taken out of the number in the box;
   last is the digits that were in the box when we last looked. */
let lifted = false, last = "";
const digitsOf = s => s.replace(/\D/g, "");
function liftCode(){
  const box = $("wa"), now = digitsOf(box.value);
  if (box.value === "" || (now && !now.startsWith(last) && !last.startsWith(now))) lifted = false;   // emptied, or replaced by another number
  const atEnd = box.selectionStart == null || box.selectionStart === box.value.length;   // typing forwards or pasting, not editing the middle
  const m = atEnd && box.value.match(/^[\s(]*(?:\+|00)(.*)$/);
  if (m) {
    const rest = m[1], c = COUNTRIES.find(c => digitsOf(rest).startsWith(c[1]));
    if (c) {                                          // a whole code: take it out
      let i = 0;
      for (let seen = 0; seen < c[1].length; i++) if (/\d/.test(rest[i])) seen++;
      box.value = rest.slice(i); lifted = true;
      if (dialOf($("cc").value) !== c[1]) pickCountry("", c[1]);   // keep a chosen country that has this code
    }
  }
  if (atEnd && !/^[\s(]*(?:\+|00)/.test(box.value)) {   // no code in front: clear a stray space or dash, and the "(0)" of "+44 (0)7..."
    const clean = box.value.replace(/^[\s).-]+/, "").replace(lifted ? /^\(0\)\s*(?=\d)/ : /^$/, "");
    if (clean !== box.value) box.value = clean;
  }
  last = digitsOf(box.value);
}
$("wa").addEventListener("input", liftCode);
/* Reads the picker and the number box. Gives back the full number with its country code
   ("+447700900123"), or "" when it does not make a real number for that country.
   A number typed with its own code (+44... or 0044...) is taken as typed and sets the picker.
   With tidy, a code typed in the box is removed from it, because the code is already in the small box. */
function waNumber(tidy){
  const raw = $("wa").value.trim(), typed = /^(\+|00)/.test(raw), iso = $("cc").value;
  if (!raw || (!typed && !iso)) return "";
  const text = typed ? raw.replace(/^00/, "+") : raw;
  if (window.libphonenumber) {
    const read = (t, c) => { try { return libphonenumber.parsePhoneNumberFromString(t, c); } catch(e){ return null; } };
    const d = digitsOf(raw), code = dialOf(iso);
    let p = read(text, typed ? undefined : iso);
    /* the chosen country's own code typed again with no plus (49 151...): read it as the code when what is left is a real number */
    if (!typed && !lifted && d.startsWith(code) && d[code.length] !== "0") { const q = read("+" + d); if (q && q.isValid() && q.countryCallingCode === code) p = q; }
    if (!p || !p.isValid()) return "";
    if (typed || (p.country && p.country !== iso)) pickCountry(p.country, p.countryCallingCode);
    const coded = typed || (d.startsWith(p.countryCallingCode) && d.length > p.nationalNumber.length && d.endsWith(p.nationalNumber));   // a code was typed in the box
    if (tidy && coded && dialOf($("cc").value) === p.countryCallingCode) { $("wa").value = p.formatInternational().replace("+" + p.countryCallingCode, "").trim(); lifted = true; last = digitsOf($("wa").value); }
    return p.number;
  }
  /* the checker has not loaded: simpler rules */
  let digits = text.replace(/\D/g, "");
  if (typed) {
    const c = COUNTRIES.filter(c => digits.startsWith(c[1])).sort((a, b) => b[1].length - a[1].length)[0];
    if (!c) return "";
    pickCountry("", c[1]);
  } else digits = dialOf(iso) + digits.replace(/^0+/, "");
  return /^[1-9]\d{7,14}$/.test(digits) ? "+" + digits : "";
}
$("wa").addEventListener("change", () => waNumber(true));

/* validation */
const show = (id, bad) => { $(id).hidden = !bad; return bad; };
let waFull = "";   // the checked number, with its country code, as it is sent
function validate(){
  const f = $("fname").value.trim(), e = $("email").value.trim(), w = $("wa").value.trim();
  waFull = waNumber(false);
  const noCountry = !$("cc").value && !/^(\+|00)/.test(w);
  const bad = [
    show("fnameErr", f.length < 1),
    show("emailErr", !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e)),
    show("ccErr", noCountry),
    show("waErr", !w || (!noCountry && !waFull))
  ];
  const first = ["fname","email","cc","wa"][bad.indexOf(true)];
  if (first) $(first).focus();
  return !bad.includes(true);
}
""")

# --- send the checked number, with its country code
rep(r"""    whatsapp: $("wa").value.trim(),""",
r"""    whatsapp: waFull,                // country code + number, from the picker (see waNumber above)""")

open(NEW, "w", encoding="utf-8").write(out)
print("written", NEW, len(out.encode("utf-8")), "bytes")
