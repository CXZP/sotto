import { test } from "node:test";
import assert from "node:assert/strict";
import { renderMd } from "../src/markdown.js";

test("inline formatting", () => {
  assert.equal(renderMd("**b** *i* ~~s~~ `c`"), "<p><strong>b</strong> <em>i</em> <del>s</del> <code>c</code></p>");
  assert.equal(renderMd("snake_case_name stays"), "<p>snake_case_name stays</p>");
  assert.equal(renderMd("`**not bold**`"), "<p><code>**not bold**</code></p>");
  assert.match(renderMd("||spoiler||"), /class="spoiler"/);
});

test("blocks", () => {
  assert.equal(renderMd("- a\n- b"), "<ul><li>a</li><li>b</li></ul>");
  assert.equal(renderMd("1. a\n2. b"), "<ol><li>a</li><li>b</li></ol>");
  assert.equal(renderMd("> quoted\n> more"), "<blockquote><p>quoted<br>more</p></blockquote>");
  assert.equal(renderMd("# Title"), "<h3>Title</h3>");
  assert.equal(renderMd("```\n<b>x</b>\n```"), "<pre><code>&lt;b&gt;x&lt;/b&gt;</code></pre>");
  assert.equal(renderMd("line1\nline2\n\npara2"), "<p>line1<br>line2</p><p>para2</p>");
});

test("links are https only and marked ugc", () => {
  assert.match(renderMd("[site](https://example.com)"), /<a href="https:\/\/example\.com" target="_blank" rel="nofollow ugc noopener">site<\/a>/);
  assert.doesNotMatch(renderMd("[x](javascript:alert(1))"), /<a/);
  assert.doesNotMatch(renderMd("[x](http://example.com)"), /<a/);
  assert.match(renderMd("see https://example.com/a."), /href="https:\/\/example\.com\/a"/);
});

test("no HTML or attribute injection", () => {
  for (const evil of [
    "<script>alert(1)</script>",
    "<img src=x onerror=alert(1)>",
    '[x](https://a.com" onmouseover="alert(1))',
    "**<b onclick=x>**",
    "https://a.com/\"onmouseover=alert(1)",
    "> <svg onload=alert(1)>",
  ]) {
    const html = renderMd(evil);
    assert.doesNotMatch(html, /<(script|img|svg|b )/i, evil);
    // escaped text like "&lt;img onerror=" is harmless; a real tag with on*= is not
    assert.doesNotMatch(html, /<[a-z][^>]*\son\w+=/i, evil);
  }
});
