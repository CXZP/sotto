# Contributing

The database is the product. A good PR adds one model with clean sources.

## Rules

1. **Every value has an `https` source.** Manufacturer page first, then a retailer that reproduces the spec sheet, then an independent measurement.
2. **Mark what it is.** `"kind": "claimed"` for spec sheets, `"kind": "measured"` for lab measurements (RTINGS, Reference Audio Analyzer, HiFi News, Audio Science Review, …).
3. **Keep disagreements.** If two sources differ, add both entries. The validator reports the spread and the UI shows it. Don't average.
4. **Units matter.** Sensitivity is `"dB/V"` or `"dB/mW"`. If a spec sheet gives no unit, use your best reading and say so in a `note`.
5. **Facts and links only.** Don't copy review text, graphs or images.
6. **No scraping.** Community knowledge (Reddit, Head-Fi, Facebook groups) goes in as a `note`: a link to the original post plus a one-line summary in your own words, in Thai and English.
7. **No guessing.** Unknown fields stay `null`. The UI says "unknown" — that's better than a wrong number.

## Headphone entry

```json
{
  "id": "brand-model",
  "brand": "Brand",
  "model": "Model",
  "type": "iem",                       // "iem" | "over-ear"
  "back": "open",                      // over-ear only: "open" | "closed"
  "driver": "hybrid",                  // "dynamic" | "planar" | "hybrid" | "ba" | "electrostatic"
  "drivers": "1DD + 3BA",              // optional, free text
  "impedance": [{ "value": 20.5, "kind": "claimed", "source": "https://…" }],
  "sensitivity": [{ "value": 120, "unit": "dB/V", "kind": "claimed", "source": "https://…" }],
  "cable": { "detachable": true, "connector": "2pin-0.78", "source": "https://…" },
  "stockPlug": "3.5",                  // or null if you can't source it
  "stockPlugSource": "https://…",
  "notes": [{ "th": "…", "en": "…", "source": "https://…" }]
}
```

## Amp / dongle entry

```json
{
  "id": "brand-model",
  "brand": "Brand",
  "model": "Model",
  "kind": "dongle",                    // "dongle" | "desktop"
  "input": "usb-c",                    // "usb-c" | "usb-a" | "usb"
  "price": { "usd": 59.99, "source": "https://…" },   // or null
  "outputs": [
    {
      "jack": "4.4",                   // "3.5" | "6.35" | "4.4" | "2.5" | "xlr4"
      "kind": "claimed",
      "source": "https://…",
      "power": [{ "load": 32, "mw": 240 }, { "load": 300, "mw": 56 }],   // per channel
      "vmax": 2.7,                     // max output voltage (Vrms), optional
      "zout": 0.7                      // output impedance (Ω), or null
    }
  ]
}
```

Power figures are per channel, at the THD the manufacturer rates (usually < 1 %). If only peak-to-peak voltage is given, `Vrms = Vpp / (2·√2)` and say so in a `note`.

## Check before you open the PR

```sh
npm run check
```

Errors block the PR in CI. Warnings (e.g. "output impedance unknown") are fine, they just tell reviewers what's missing.

By contributing data you agree to license it under [CC BY-SA 4.0](DATA_LICENSE.md); code contributions are under [MIT](LICENSE).
