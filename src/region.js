// Where the reader buys from. Picks store search links, the currency for the
// code calculator and price reports, and local-language search links.
// Guessed from the browser's time zone on this device only; never sent anywhere.

const q = encodeURIComponent;
const shopee = (host) => ["Shopee", (n) => `https://${host}/search?keyword=${q(n)}`];
const lazada = (host) => ["Lazada", (n) => `https://${host}/catalog/?q=${q(n)}`];
const amazon = (host) => [host.replace(/^www\./, "").replace(/^amazon/, "Amazon"), (n) => `https://${host}/s?k=${q(n)}`];
const ebay = (host) => ["eBay", (n) => `https://${host}/sch/i.html?_nkw=${q(n)}`];
// Munkong Gadget: Thai headphone shop with no public feed, so a search link only.
const munkong = ["Munkong", (n) => `https://www.munkonggadget.com/product?search=${q(n)}`];
// Soundproof Bros (MBK): its terms bar copying site text, so a search link only.
const soundproof = ["Soundproof Bros", (n) => `https://www.soundproofbrosaudio.com/search.php?keyword=${q(n)}`];
// More Thai shops with no product feed: search links taken from each site's own search box.
const piyanas = ["Piyanas", (n) => `https://www.piyanas.com/th/search?q=${q(n)}`];
const progadgets = ["Pro Gadgets", (n) => `https://www.progadgets.co.th/search/${q(n)}`];
const thevolume = ["The Volume", (n) => `https://www.thevolume.store/th/search/product?s=${q(n)}`];
// ProPlugin: its robots.txt bars the per_page and category queries a feed crawl would need.
const proplugin = ["ProPlugin", (n) => `https://proplugin.com/?s=${q(n)}&post_type=product`];
// HolySai (LnwShop): no product feed and /api/ is closed to bots, so a search link only.
const holysai = ["HolySai", (n) => `https://www.holysai.com/search?q=${q(n)}`];
// Thai IT chains that also sell headphones; search links from each site's own search box.
const banana = ["Banana", (n) => `https://www.bnn.in.th/th/p?q=${q(n)}`];
const itcity = ["IT City", (n) => `https://www.itcity.in.th/product-category?search=${q(n)}`];
// Stores whose prices Sotto already tracks, as search links in their own country.
const shop = (label, host) => [label, (n) => `https://${host}/search?q=${q(n)}`];
const ali = ["AliExpress", (n) => `https://www.aliexpress.com/wholesale?SearchText=${q(n)}`];

// codes: the market runs on stacked shop + platform vouchers (the #deal calculator).
export const REGIONS = {
  th: { iso: ["TH"], th: "ไทย", en: "Thailand", currency: "THB", codes: true, stores: [shopee("shopee.co.th"), lazada("www.lazada.co.th"), munkong, soundproof, piyanas, progadgets, thevolume, proplugin, holysai, banana, itcity, ["Jaben", (n) => `https://www.jaben.co.th/?s=${q(n)}&post_type=product`]], local: [["ดีไหม", "{n} ดีไหม"], ["Pantip", "{n} site:pantip.com"]] },
  sg: { iso: ["SG"], th: "สิงคโปร์", en: "Singapore", currency: "SGD", codes: true, stores: [shopee("shopee.sg"), lazada("www.lazada.sg"), shop("The Hangout", "hangout.audio"), shop("Stereo Electronics", "www.stereo.com.sg"), amazon("www.amazon.sg")], local: [["HardwareZone", "{n} site:hardwarezone.com.sg"]] },
  my: { iso: ["MY"], th: "มาเลเซีย", en: "Malaysia", currency: "MYR", codes: true, stores: [shopee("shopee.com.my"), lazada("www.lazada.com.my")], local: [["Lowyat", "{n} site:lowyat.net"]] },
  ph: { iso: ["PH"], th: "ฟิลิปปินส์", en: "Philippines", currency: "PHP", codes: true, stores: [shopee("shopee.ph"), lazada("www.lazada.com.ph")], local: [] },
  id: { iso: ["ID"], th: "อินโดนีเซีย", en: "Indonesia", currency: "IDR", codes: true, stores: [shopee("shopee.co.id"), ["Tokopedia", (n) => `https://www.tokopedia.com/search?q=${q(n)}`]], local: [["Kaskus", "{n} site:kaskus.co.id"]] },
  vn: { iso: ["VN"], th: "เวียดนาม", en: "Vietnam", currency: "VND", codes: true, stores: [shopee("shopee.vn"), lazada("www.lazada.vn")], local: [["Tinh tế", "{n} site:tinhte.vn"]] },
  us: { iso: ["US"], th: "สหรัฐฯ", en: "United States", currency: "USD", codes: false, stores: [amazon("www.amazon.com"), ebay("www.ebay.com")], local: [] },
  ca: { iso: ["CA"], th: "แคนาดา", en: "Canada", currency: "CAD", codes: false, stores: [amazon("www.amazon.ca"), ebay("www.ebay.ca")], local: [] },
  uk: { iso: ["GB"], th: "สหราชอาณาจักร", en: "United Kingdom", currency: "GBP", codes: false, stores: [shop("hifiheadphones", "hifiheadphones.co.uk"), amazon("www.amazon.co.uk"), ebay("www.ebay.co.uk")], local: [] },
  eu: { iso: ["DE", "FR", "IT", "ES", "NL", "BE", "AT", "IE", "PT", "FI", "SE", "DK", "PL", "CZ", "GR"], th: "ยุโรป", en: "Europe", currency: "EUR", codes: false, stores: [amazon("www.amazon.de"), ["Thomann", (n) => `https://www.thomann.de/intl/search_dir.html?sw=${q(n)}`], ebay("www.ebay.de")], local: [] },
  au: { iso: ["AU"], th: "ออสเตรเลีย", en: "Australia", currency: "AUD", codes: false, stores: [shop("Addicted To Audio", "addictedtoaudio.com.au"), amazon("www.amazon.com.au"), ebay("www.ebay.com.au")], local: [] },
  jp: { iso: ["JP"], th: "ญี่ปุ่น", en: "Japan", currency: "JPY", codes: false, stores: [amazon("www.amazon.co.jp"), ["e☆イヤホン", (n) => `https://www.e-earphone.jp/search?q=${q(n)}`], ["Rakuten", (n) => `https://search.rakuten.co.jp/search/mall/${q(n)}/`]], local: [["レビュー", "{n} レビュー"], ["価格.com", "{n} site:kakaku.com"]] },
  kr: { iso: ["KR"], th: "เกาหลีใต้", en: "South Korea", currency: "KRW", codes: false, stores: [["Coupang", (n) => `https://www.coupang.com/np/search?q=${q(n)}`]], local: [["후기", "{n} 후기"]] },
  other: { iso: [], th: "ที่อื่น", en: "Elsewhere", currency: "USD", codes: false, stores: [ali, amazon("www.amazon.com"), ebay("www.ebay.com")], local: [] },
};

const TZ = [
  [/^Asia\/(Bangkok)$/, "th"],
  [/^Asia\/Singapore$/, "sg"],
  [/^Asia\/(Kuala_Lumpur|Kuching)$/, "my"],
  [/^Asia\/Manila$/, "ph"],
  [/^Asia\/(Jakarta|Makassar|Jayapura|Pontianak)$/, "id"],
  [/^Asia\/(Ho_Chi_Minh|Saigon)$/, "vn"],
  [/^Asia\/Tokyo$/, "jp"],
  [/^Asia\/Seoul$/, "kr"],
  [/^Europe\/(London|Belfast)$/, "uk"],
  [/^Europe\//, "eu"],
  [/^Australia\//, "au"],
  [/^America\/(Toronto|Vancouver|Edmonton|Winnipeg|Halifax|Regina|St_Johns|Montreal)$/, "ca"],
  [/^(America\/(New_York|Chicago|Denver|Los_Angeles|Phoenix|Anchorage|Detroit|Boise|Indiana\/.*|Kentucky\/.*)|Pacific\/Honolulu)$/, "us"],
];

export function guessRegion(lang) {
  let tz = "";
  try {
    tz = Intl.DateTimeFormat().resolvedOptions().timeZone ?? "";
  } catch {}
  for (const [re, r] of TZ) if (re.test(tz)) return r;
  return lang === "th" ? "th" : "other";
}

/**
 * Whether a tracked store ships to the reader's region, from the store's own
 * Shopify shipping zones: true, false, or null when we don't know.
 */
export function shipsTo(store, region) {
  const iso = REGIONS[region]?.iso ?? [];
  if (!store?.ships || !iso.length) return null;
  return iso.some((c) => store.ships.includes(c));
}

export function storeLinks(region, name) {
  return (REGIONS[region] ?? REGIONS.other).stores.map(([label, url]) => [label, url(name)]);
}
