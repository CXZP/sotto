// Weekly price history. Each crawl overwrites catalog.json, so the history is
// kept in its own file and only grows when something changes:
// { id: { store: [[day, price, inStock], ...] } } in USD-or-store currency as listed.

/** Lowest new-condition price per store for one item: { store: [price, inStock] }. */
function storePrices(item) {
  const out = {};
  for (const o of item.offers ?? []) {
    if (o.condition !== "new" || o.suspect || !(o.price > 0)) continue;
    const cur = out[o.store];
    if (!cur || o.price < cur[0]) out[o.store] = [o.price, o.available ? 1 : 0];
  }
  return out;
}

/** Append today's prices where they differ from the last recorded point. Returns a new object. */
export function appendHistory(prev, items, day) {
  const next = structuredClone(prev ?? {});
  for (const item of items) {
    for (const [store, [price, stock]] of Object.entries(storePrices(item))) {
      const rows = ((next[item.id] ??= {})[store] ??= []);
      const last = rows.at(-1);
      if (last && last[0] === day) rows[rows.length - 1] = [day, price, stock];
      else if (!last || last[1] !== price || last[2] !== stock) rows.push([day, price, stock]);
    }
  }
  return next;
}
