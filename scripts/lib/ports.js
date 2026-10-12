// Rear-panel ports from store spec lines: digital inputs/outputs (USB,
// optical, coaxial, Bluetooth) and analog line inputs/outputs (RCA, XLR).
// Headphone jacks are handled elsewhere. Each port keeps its verbatim line.
// When a store doesn't list a port we say "not stated", never "absent".

import { textify } from "./specs.js";

const PORTS = {
  usb: /\busb(?:[- ]?(?:b|c|type[- ]?[bc]))?\b(?![- ]?(?:power|charg))/i,
  optical: /\b(?:optical|toslink|opt)\b/i,
  coax: /\bcoax(?:ial)?\b/i,
  // I2S between boxes, usually on an HDMI or RJ45 socket ("I2S over HDMI").
  i2s: /\bi2s\b|\biis\b/i,
  aes: /\baes(?:\/ebu|3)?\b/i,
  bt: /\bbluetooth\b/i,
  rca: /\brca\b/i,
  xlr: /\bxlr\b(?![- ]?4)|\bbalanced (?:line|xlr)\b/i,
  phono: /\bphono\b/i,
  line: /\bline[- ]?(?:in|out|level|input|output)s?\b|\bpre[- ]?outs?\b/i,
};
const IN = /\b(?:inputs?|in)\b/i;
const OUT = /\b(?:outputs?|out|pre[- ]?outs?)\b/i;
const HEADPHONE_CTX = /\b(headphone|phones?|4[- ]?pin|iem|earphone)\b/i;

// Switches worth knowing before buying, each with the line that states it.
const FEATURES = {
  // USB Audio Class 1.0 mode: no driver needed on consoles, older Windows, some phones.
  uac1: /\buac\s?1(?:\.0)?\b|usb audio class 1(?:\.0)?\b/i,
  // Non-oversampling / oversampling filter switch (common on R2R DACs).
  nos: /\bnos\b|non[- ]?over[- ]?sampling/i,
  // Network streaming: what apps can play to it without a computer in between.
  roon: /\broon ready\b|\broon (?:tested|certified)\b/i,
  airplay: /\bairplay\b/i,
  spotify: /\bspotify connect\b/i,
  tidal: /\btidal connect\b/i,
  upnp: /\bupnp\b|\bdlna\b/i,
  chromecast: /\bchromecast\b|\bgoogle cast\b/i,
  asio: /\basio\b/i,
  // A turntable with its own phono stage gives line level (no separate phono preamp needed).
  phono_pre: /built[- ]in (?:switchable )?(?:mm )?phono (?:pre-?amp\w*|stage)|switchable (?:phono )?pre-?amp|(?:phono\/line|line\/phono) (?:switch|output)|integrated phono (?:pre-?amp\w*|stage)/i,
};

/** {uac1: quote, nos: quote} for the switches a store mentions. */
export function extractFeatures(html) {
  const res = {};
  for (const line of textify(html)) {
    if (line.length > 260) continue;
    for (const [k, re] of Object.entries(FEATURES)) if (re.test(line)) res[k] ??= line;
  }
  return res;
}

/** {in: {usb: quote, ...}, out: {...}} or null. */
export function extractPorts(html) {
  const res = { in: {}, out: {} };
  for (const line of textify(html)) {
    if (line.length > 260) continue;
    for (const seg of line.split(/[;|•]|\s[-–]\s/)) {
      const hasIn = IN.test(seg);
      const hasOut = OUT.test(seg);
      if (!hasIn && !hasOut) continue;
      for (const [port, re] of Object.entries(PORTS)) {
        const m = seg.match(re);
        if (!m) continue;
        // Direction word closest after the port name ("Optical In", "USB/Coax Inputs"), else before it.
        const after = seg.slice(m.index + m[0].length);
        const before = seg.slice(0, m.index);
        const nextIn = after.search(IN), nextOut = after.search(OUT);
        let dir = null;
        if (nextIn >= 0 || nextOut >= 0) dir = nextOut < 0 || (nextIn >= 0 && nextIn < nextOut) ? "in" : "out";
        else dir = OUT.test(before) && !IN.test(before) ? "out" : IN.test(before) && !OUT.test(before) ? "in" : null;
        if (!dir) continue;
        // An analog "output" in a headphone sentence is a headphone jack, not a line out.
        if ((port === "xlr" || port === "line") && dir === "out" && HEADPHONE_CTX.test(seg)) continue;
        if (port === "usb" && dir === "out") continue; // "USB out" is usually power or a host port
        res[dir][port] ??= line;
      }
    }
  }
  return Object.keys(res.in).length || Object.keys(res.out).length ? res : null;
}
