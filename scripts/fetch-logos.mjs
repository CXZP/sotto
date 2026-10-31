// Brand logos Simple Icons doesn't have, taken from each brand's own homepage: the header
// logo (inline SVG or an <img> marked "logo") and the square app icon. One request per
// homepage. Results land in data/logos/ for review (scripts/logo-sheet.html shows them);
// only the ones listed in data/logos-ok.json are used on the site. The marks stay their
// owners' trademarks and are used only to identify the brand.
//
// Run: node scripts/fetch-logos.mjs [brand…]

import { mkdir, writeFile } from "node:fs/promises";

const SITES = {
  FiiO: "https://www.fiio.com/",
  Moondrop: "https://moondroplab.com/en",
  SMSL: "https://www.smsl-audio.com/",
  "Final Audio": "https://final-audio.com/",
  iFi: "https://ifi-audio.com/",
  HIFIMAN: "https://hifiman.com/",
  Grado: "https://gradolabs.com/",
  "Pro-Ject": "https://www.project-audio.com/en/",
  KZ: "https://www.kzearphone.com/",
  Noble: "https://nobleaudio.com/",
  xDuoo: "https://www.xduoo.net/",
  TOPPING: "https://www.toppingaudio.com/",
  "Astell&Kern": "https://www.astellnkern.com/",
  Beyerdynamic: "https://www.beyerdynamic.com/",
  Audeze: "https://www.audeze.com/",
  Focal: "https://www.focal.com/",
  DUNU: "https://www.dunu-topsound.com/",
  Fostex: "https://www.fostex.jp/",
  "64 Audio": "https://www.64audio.com/",
  Rega: "https://www.rega.co.uk/",
  TRN: "https://www.trnaudio.com/",
  BGVP: "https://www.bgvp.com/",
  "Campfire Audio": "https://www.campfireaudio.com/",
  "Cambridge Audio": "https://www.cambridgeaudio.com/",
  Cayin: "https://en.cayin.cn/",
  SIVGA: "https://www.sivgaaudio.com/",
  iBasso: "https://www.ibasso.com/",
  "Bowers & Wilkins": "https://www.bowerswilkins.com/",
  Hiby: "https://store.hiby.com/",
  Shanling: "https://en.shanling.com/",
  TANGZU: "https://tangzu.net/",
  Kinera: "https://www.kineraaudio.com/",
  "Vision Ears": "https://vision-ears.de/",
  Ortofon: "https://www.ortofon.com/",
  TANCHJIM: "https://www.tanchjim.com/",
  "Woo Audio": "https://wooaudio.com/",
  Clearaudio: "https://www.clearaudio.de/en/",
  KBEAR: "https://www.kbearaudio.com/",
  NAD: "https://nadelectronics.com/",
  TINHIFI: "https://www.tinhifi.com/",
  "Meze Audio": "https://mezeaudio.com/",
  "Kiwi Ears": "https://kiwiears.com/",
  QDC: "https://www.qdc.hk/",
  Shure: "https://www.shure.com/en-US",
  Naim: "https://www.naimaudio.com/",
  KEF: "https://us.kef.com/",
  STAX: "https://stax.co.jp/en/",
  Questyle: "https://www.questyle.com/",
  Technics: "https://www.technics.com/global/",
  "Chord Electronics": "https://chordelectronics.co.uk/",
  "Burson Audio": "https://www.bursonaudio.com/",
  Ferrum: "https://ferrum.audio/",
  LETSHUOER: "https://letshuoer.net/",
  Klipsch: "https://www.klipsch.com/",
  "MoFi Electronics": "https://www.mofielectronics.com/",
  Softears: "https://www.softears.net/",
  Simgot: "https://www.simgot.com/",
  "Empire Ears": "https://empireears.com/",
  Denon: null,
  "Unique Melody": "https://www.uniquemelody.co/",
  Sendy: "https://www.sendyaudio.com/",
  Dan: null,
  "Feliks Audio": "https://feliksaudio.pl/",
  "Schiit Audio": "https://www.schiit.com/",
  Hidizs: "https://www.hidizs.net/",
  Tripowin: null,
  JDS: null,
  "JDS Labs": "https://jdslabs.com/",
  "Monoprice": "https://www.monoprice.com/",
  Ultrasone: "https://www.ultrasone.com/",
  "Dan Clark Audio": "https://danclarkaudio.com/",
  Sony: null,
};

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";
const out = new URL("../data/logos/", import.meta.url);
await mkdir(out, { recursive: true });
const slug = (b) => b.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const abs = (u, base) => new URL(u.replace(/&amp;/g, "&"), base).href;

async function get(url, type = "text") {
  const r = await fetch(url, { headers: { "user-agent": UA, accept: type === "text" ? "text/html" : "*/*" }, redirect: "follow", signal: AbortSignal.timeout(20000) });
  if (!r.ok) throw new Error(`${r.status}`);
  return type === "text" ? { body: await r.text(), url: r.url } : { body: Buffer.from(await r.arrayBuffer()), type: r.headers.get("content-type") ?? "", url: r.url };
}

const ext = (type, url) => (/svg/.test(type) || /\.svg(\?|$)/i.test(url) ? "svg" : /png/.test(type) || /\.png(\?|$)/i.test(url) ? "png" : /webp/.test(type) || /\.webp/i.test(url) ? "webp" : /jpe?g/.test(type) || /\.jpe?g/i.test(url) ? "jpg" : /gif/.test(type) ? "gif" : "bin");

function findLogo(html, base) {
  // Only the top of the page: the header, not product banners.
  const head = (html.match(/<header[\s\S]*?<\/header>/i)?.[0] ?? html.slice(0, 120000));
  // An inline SVG inside something called logo.
  const svg = head.match(/<(?:a|div|span|h1|figure)[^>]*(?:class|id)="[^"]*logo[^"]*"[^>]*>\s*(?:<[^>]+>\s*)*?(<svg[\s\S]*?<\/svg>)/i)?.[1] ?? head.match(/<svg[^>]*(?:class|id|aria-label)="[^"]*logo[^"]*"[\s\S]*?<\/svg>/i)?.[0];
  if (svg && svg.length > 200) return { svg };
  // An <img> marked as the logo (src, class, id or alt).
  for (const m of head.matchAll(/<img\b[^>]*>/gi)) {
    const tag = m[0];
    if (!/logo/i.test(tag)) continue;
    const src = tag.match(/\s(?:data-src|src)="([^"]+)"/i)?.[1] ?? tag.match(/\ssrcset="([^"\s,]+)/i)?.[1];
    if (src && !src.startsWith("data:")) return { img: abs(src.replace(/\{width\}/, "600"), base) };
  }
  return null;
}

function findIcon(html, base) {
  const m = html.match(/<link[^>]+rel="apple-touch-icon[^"]*"[^>]*>/i)?.[0] ?? html.match(/<link[^>]+rel="icon"[^>]+sizes="(?:1[5-9]\d|[2-9]\d\d)x[^"]*"[^>]*>/i)?.[0];
  const href = m?.match(/href="([^"]+)"/i)?.[1];
  return href ? abs(href, base) : null;
}

const want = process.argv.slice(2);
const report = {};
for (const [brand, site] of Object.entries(SITES)) {
  if (!site || (want.length && !want.includes(brand))) continue;
  const s = slug(brand);
  const r = (report[brand] = { site });
  try {
    const page = await get(site);
    const logo = findLogo(page.body, page.url);
    if (logo?.svg) {
      let x = logo.svg;
      if (!/xmlns=/.test(x)) x = x.replace(/<svg/i, '<svg xmlns="http://www.w3.org/2000/svg"');
      await writeFile(new URL(`${s}.logo.svg`, out), x);
      r.logo = `${s}.logo.svg`;
    } else if (logo?.img) {
      const f = await get(logo.img, "bin");
      const e = ext(f.type, f.url);
      await writeFile(new URL(`${s}.logo.${e}`, out), f.body);
      r.logo = `${s}.logo.${e}`;
      r.logoFrom = logo.img;
    }
    const icon = findIcon(page.body, page.url);
    if (icon) {
      const f = await get(icon, "bin");
      const e = ext(f.type, f.url);
      await writeFile(new URL(`${s}.icon.${e}`, out), f.body);
      r.icon = `${s}.icon.${e}`;
    }
  } catch (e) {
    r.error = String(e.message ?? e);
  }
  console.log(brand.padEnd(20), r.logo ?? "-", r.icon ?? "-", r.error ?? "");
}
await writeFile(new URL("_report.json", out), JSON.stringify(report, null, 1));
