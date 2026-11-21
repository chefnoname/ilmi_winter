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

open(NEW, "w", encoding="utf-8").write(out)
print("written", NEW, len(out.encode("utf-8")), "bytes")
