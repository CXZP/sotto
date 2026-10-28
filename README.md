# Sotto

**Will it connect? Is it loud enough? Do you need a separate amp, or is your phone, dongle or DAP already enough?**

Sotto checks a headphone setup — phone or computer → dongle / DAC-amp → headphones — and answers the questions that *have* answers:

- **Connections**: which jacks match, which adapter you need, and which adapter is unsafe (single-ended plug into a balanced output).
- **Power**: the voltage, current and power your headphones need at your listening level, against what the source can deliver. Usually the answer is "you don't need an amp".
- **Output impedance**: the 1/8 rule, with a stronger warning for multi-driver (BA) IEMs.
- **Sources for everything**: every number links to where it came from, marked *spec sheet* or *measured*. Measured values win. When sources disagree, you see all of them.

It deliberately does **not** tell you what sounds good. That's taste; go to [squig.link](https://squig.link/), read reviews, listen.

No AI in the checks. No tracking. No build step. No dependencies.

AI appears in one place only: an optional helper that turns review text a signed-in person pastes into a draft post. Every point it keeps must quote the pasted text word for word, or it is dropped. The calculations never use it.

## Run it

```sh
node scripts/serve.mjs      # http://localhost:8080
npm test                    # calculation tests
npm run validate            # data checks
```

Any static host works (GitHub Pages, Cloudflare Pages): it's `index.html`, `style.css`, `src/` and `data/`.

## How the power check works

1. Sensitivity is normalised to dB SPL per 1 Vrms: `dB/V = dB/mW + 10·log10(1000 / Z)`.
2. Required voltage at a target level: `V = 10^((SPL − S) / 20)`; current `I = V / Z`; power `P = V² / Z`.
3. Available voltage comes from the manufacturer's power-per-load figures (`V = √(P·R)`), interpolated on log-log axes between rated loads. Below the lowest rated load the output is treated as current-limited; above the highest it may rise only to the published maximum voltage. Voltage-only specs get the output-impedance divider applied. The UI says which of these was used.
4. Default level: 80 dB average (WHO safe-listening guidance) with 15 dB for peaks.

All of it lives in [`src/calc.js`](src/calc.js), with tests in [`tests/calc.test.mjs`](tests/calc.test.mjs).

## Where the catalog comes from

```sh
node scripts/crawl.mjs          # public Shopify feeds → cache/raw/ (git-ignored)
node scripts/build-catalog.mjs  # → data/catalog.json
```

1. **Crawl.** `scripts/stores.json` lists stores with public `/products.json` feeds. The crawler follows each store's `robots.txt` delay, asks for USD, and records the currency each response actually used (Shopify localises prices by visitor location).
2. **Classify.** Plain rules on title/type/tags sort listings into IEM, over-ear, dongle, desktop, DAP; cables, tips, cases and speakers are dropped.
3. **Extract.** Regex pulls impedance, sensitivity (+ unit), output power and output impedance from spec lines.
4. **Verify.** Every value keeps `quote`, the exact line it came from. `verify()` checks the quote exists in the store text, the number re-parses from it, and it's physically plausible. Anything else is dropped. Any future AI extractor must pass the same check — it can point at numbers, never invent them.
5. **Merge.** Same model across stores becomes one entry; equal values gain sources, different values are kept side by side. Hand-checked entries in `data/headphones.json` / `data/amps.json` join and take priority.
6. **Prices.** Accessory variants ("case only") don't set the price; a price more than 3× away from other stores' is flagged, not trusted.

Only facts, links and the one spec line per value are published. Store descriptions and images stay out of the repo.

## Add or fix data

See [CONTRIBUTING.md](CONTRIBUTING.md). Short version: edit `data/*.json`, every value needs an `https` source, run `npm run check`, open a PR.

## License

- Code: [MIT](LICENSE)
- Data (`data/*.json`): [CC BY-SA 4.0](DATA_LICENSE.md)

Brand and model names are trademarks of their owners and are used only to identify products. Sotto is not affiliated with or endorsed by any manufacturer, retailer or reviewer it cites.