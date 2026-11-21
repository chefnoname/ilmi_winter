/* The Winter Lock-In settings. Change these, nothing else. */
var CONFIG = {
  startUTC: "2026-12-09T19:00:00Z",            // Wed 9 Dec, 7pm UK (GMT)
  durationMin: 60,
  title: "The Winter Lock-In",
  pageUrl: location.origin + "/",              // used in share links and calendar invites
  whatsappChannelUrl: "https://whatsapp.com/channel/0029Vb7X3MMD38CXUTOq4G1m",
  trialUrl: "https://www.ilmcourses.uk/offers/G3Ba6yDk?utm_source=winter-lockin&utm_medium=thank-you",
  defaultSource: "winterlockin",               // saved with the sign-up when the link has no ?src= or utm_source
  registerUrl: "/api/register",                // see api/register.js
  pixelId: "1004320156067073",                 // Meta pixel "Winter Lock-In"
  // The pixel only loads on these hosts, so local and preview copies of the page never send events.
  pixelHosts: ["winterlockin.com", "www.winterlockin.com", "winterlockin.vercel.app"]
};

/* Meta pixel: PageView here, Lead in index.html once a sign-up has been saved. */
if (CONFIG.pixelId && CONFIG.pixelHosts.indexOf(location.hostname) !== -1) {
  !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
  fbq('init', CONFIG.pixelId);
  fbq('track', 'PageView');
}
