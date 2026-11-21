/* Settings (date, links, pixel) live in /config.js */
const $ = id => document.getElementById(id);
const start = new Date(CONFIG.startUTC);
const end = new Date(start.getTime() + CONFIG.durationMin*60000);
const fmt = (tz, opts) => new Intl.DateTimeFormat("en-GB", Object.assign({timeZone: tz}, opts)).format(start);
const t = tz => fmt(tz,{hour:"numeric",minute:"2-digit",hour12:true}).replace(/\s/g,"").toLowerCase();
const dayUK = fmt("Europe/London",{weekday:"long",day:"numeric",month:"long"});
const timeUK = t("Europe/London");
$("dateLine").textContent = dayUK;
$("zones").textContent = `${timeUK} UK time`;
$("regSub").textContent = `${CONFIG.title}, ${dayUK} at ${timeUK} UK`;
$("faqTime").textContent = `${dayUK} at ${timeUK} UK time.`;
try {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const offset = z => new Intl.DateTimeFormat("en-GB",{timeZone:z,timeZoneName:"shortOffset"}).formatToParts(start).find(p => p.type==="timeZoneName").value;
  if (tz && offset(tz) !== offset("Europe/London")) {
    const local = new Intl.DateTimeFormat("en-GB",{weekday:"long",hour:"numeric",minute:"2-digit",hour12:true}).format(start).replace(/\s(am|pm)/i,"$1").toLowerCase().replace(/^./,c => c.toUpperCase());
    $("localTime").textContent = `Your time: ${local}`;
    $("faqTime").textContent = `${dayUK} at ${timeUK} UK time. Where you are, that's ${local}.`;
  }
} catch(e){}
$("fYear").textContent = new Date().getFullYear();

/* where the visitor came from: ?src=... or utm_source */
try {
  const q = new URLSearchParams(location.search);
  const src = q.get("src") || q.get("utm_source") || CONFIG.defaultSource;
  $("source").value = src.slice(0,60);
} catch(e){}

/* validation */
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

/* send the sign-up to /api/register. Only show "You're in" once it's saved. */
async function register(data){
  const res = await fetch(CONFIG.registerUrl, {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error("register " + res.status);
}

let sending = false;
$("regForm").addEventListener("submit", async ev => {
  ev.preventDefault();
  if (sending || !validate()) return;
  const name = $("fname").value.trim();
  const data = {
    first_name: name,
    email: $("email").value.trim(),
    whatsapp: $("wa").value.trim(),
    source: $("source").value,
    website: $("website").value      // honeypot: real people leave this empty
  };
  $("submitErr").hidden = true;
  sending = true; $("submitBtn").disabled = true; $("submitBtn").textContent = "Saving your seat…";
  try { await register(data); }
  catch (e) {
    sending = false; $("submitBtn").disabled = false; $("submitBtn").textContent = "Save my free seat";
    $("submitErr").hidden = false;
    return;
  }
  /* The sign-up is saved: this is the conversion the ads optimise for. */
  if (window.fbq) fbq("track", "Lead", {content_name: "winter-lock-in"});
  $("regForm").hidden = true;
  $("regTitle").hidden = true; $("regSub").hidden = true;
  $("thanksTitle").textContent = `You're in, ${name}.`;
  $("thanksWhen").textContent = `See you on ${dayUK} at ${timeUK} UK time. Check WhatsApp for your confirmation. The join link comes on the day.`;
  $("thanks").hidden = false;
  $("thanksTitle").focus();
});

/* thank-you actions */
const details = `Free live session with Yasin Munye. The join link comes by WhatsApp on the day. ${CONFIG.pageUrl}`;
const stamp = d => d.toISOString().replace(/[-:]/g,"").replace(/\.\d{3}/,"");
$("gcal").href = "https://calendar.google.com/calendar/render?action=TEMPLATE&text=" + encodeURIComponent(CONFIG.title) + "&dates=" + stamp(start) + "/" + stamp(end) + "&details=" + encodeURIComponent(details);
$("ics").onclick = () => {
  const ics = ["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//The Winter Lock-In//EN","BEGIN:VEVENT","UID:winter-lock-in-2026@"+location.hostname,"DTSTAMP:"+stamp(new Date()),"DTSTART:"+stamp(start),"DTEND:"+stamp(end),"SUMMARY:"+CONFIG.title,"DESCRIPTION:"+details,"BEGIN:VALARM","TRIGGER:-PT60M","ACTION:DISPLAY","DESCRIPTION:Starts in 1 hour","END:VALARM","END:VEVENT","END:VCALENDAR"].join("\r\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([ics],{type:"text/calendar"}));
  a.download = "winter-lock-in.ics"; document.body.appendChild(a); a.click(); a.remove();
};
$("waJoin").href = CONFIG.whatsappChannelUrl;
$("trialBtn").href = CONFIG.trialUrl;
const shareText = `I'm joining The Winter Lock-In, a free live session on three winter habits to build before Ramadan. Come with me: ${CONFIG.pageUrl}?src=friend`;
$("waShare").href = "https://wa.me/?text=" + encodeURIComponent(shareText);
$("copyLink").onclick = () => {
  const done = msg => { $("copyMsg").textContent = msg; $("copyMsg").hidden = false; };
  const link = CONFIG.pageUrl + "?src=friend";
  if (navigator.clipboard) navigator.clipboard.writeText(link).then(() => done("Link copied."), () => done(link));
  else done(link);
};

/* reveal on scroll: only items below the first screen start hidden */
(function(){
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce || !("IntersectionObserver" in window)) return;
  const els = document.querySelectorAll("section.band h2, section.band .lead, .clock, .habit, .host, .facts li, .steps li, details");
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.remove("pre"); io.unobserve(e.target); } }), {rootMargin:"0px 0px -8% 0px"});
  els.forEach(el => {
    if (el.closest("#formCard")) return;
    el.classList.add("reveal");
    if (el.getBoundingClientRect().top > innerHeight) {
      el.classList.add("pre");
      const sib = el.parentElement ? [...el.parentElement.children].indexOf(el) : 0;
      el.style.transitionDelay = Math.min(sib,4)*70 + "ms";
      io.observe(el);
    }
  });
})();

/* smooth FAQ open and close */
document.querySelectorAll("details").forEach(d => {
  const sum = d.querySelector("summary"), ans = d.querySelector(".ans");
  sum.addEventListener("click", ev => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !ans.animate) return;
    ev.preventDefault();
    if (d.open) {
      const h = ans.offsetHeight;
      ans.animate([{height:h+"px",opacity:1},{height:"0px",opacity:0}],{duration:260,easing:"ease-out"}).onfinish = () => d.open = false;
    } else {
      d.open = true;
      const h = ans.offsetHeight;
      ans.animate([{height:"0px",opacity:0},{height:h+"px",opacity:1}],{duration:300,easing:"cubic-bezier(.2,.7,.2,1)"});
    }
  });
});

/* back to top */
(function(){
  const b = $("toTop"), hero = document.querySelector(".hero");
  const check = () => b.classList.toggle("off", scrollY < hero.offsetHeight);
  addEventListener("scroll", check, {passive:true}); check();
  b.onclick = () => window.scrollTo({top:0, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth"});
})();

/* light snowfall in the hero */
(function(){
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const c = $("snow"), x = c.getContext("2d"); let w, h, flakes = [];
  const size = () => { w = c.width = c.offsetWidth * devicePixelRatio; h = c.height = c.offsetHeight * devicePixelRatio; };
  size(); addEventListener("resize", size);
  const count = Math.round(Math.min(110, Math.max(45, c.offsetWidth/8)));
  for (let i = 0; i < count; i++) flakes.push({x: Math.random(), y: Math.random(), r: Math.random()*1.6 + .5, s: Math.random()*.0007 + .0003, d: Math.random()*6.28});
  (function tick(){
    x.clearRect(0,0,w,h); x.fillStyle = "rgba(220,235,246,.55)";
    flakes.forEach(f => { f.y += f.s; f.d += .01; if (f.y > 1) f.y = 0;
      x.beginPath(); x.arc((f.x + Math.sin(f.d)*.01)*w, f.y*h, f.r*devicePixelRatio, 0, 6.28); x.fill(); });
    requestAnimationFrame(tick);
  })();
})();
