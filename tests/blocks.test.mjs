import { test } from "node:test";
import assert from "node:assert/strict";
import { parseBlocks, reviewPost, problemPosts } from "../src/blocks.js";

const sample = `Here you go:
\`\`\`json
{"sotto": 1, "product": "Moondrop Blessing 3", "source": "https://www.head-fi.org/showcase/moondrop-blessing-3.26409/reviews",
 "reviewer": "monkonomics", "date": "2026-03-11", "rating": "2.5/5", "summary": "เบสฟุ้งเมื่อเพลงแน่น เสียงกลางบาง",
 "pros": [{"point": "บิลด์แน่น", "quote": "Overall build feels solid and well put together"}, {"point": "no quote"}],
 "cons": [{"point": "เสียงกลางบาง", "quote": "Midrange often comes across thin and underfed"}],
 "problems": [], "ports_in": ["usb", "hdmi"], "features": ["nos"]}
\`\`\`
{"sotto": 1, "product": "X", "source": "http://insecure", "pros": [], "cons": []}`;

test("parses fenced and bare blocks, drops unquoted points and unknown ports", () => {
  const b = parseBlocks(sample);
  assert.equal(b.length, 2);
  assert.equal(b[0].pros.length, 1);
  assert.deepEqual(b[0].ports_in, ["usb"]);
  assert.equal(b[1].source, "");
});

test("review post keeps the rating and the quotes", () => {
  const { title, body } = reviewPost(parseBlocks(sample)[0]);
  assert.match(title, /เบสฟุ้ง/);
  assert.match(body, /2\.5\/5/);
  assert.match(body, /“Midrange often comes across thin and underfed”/);
  assert.equal(problemPosts(parseBlocks(sample)[0]).length, 0);
});
