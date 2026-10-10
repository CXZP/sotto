// Long-form pages (Learn, Licenses). Plain HTML strings per language.
// Claims here must stay factual and link a source where a reader could doubt them.

const REPO = "https://github.com/CXZP/sotto";

export const LEARN = {
  th: `
<h1>ความรู้พื้นฐาน</h1>
<p class="lead">สิ่งที่ควรรู้ก่อนจ่ายเงินซื้อหูฟังหรือแอมป์ เขียนให้คนทั่วไปอ่านเข้าใจ — ตัวเลขทุกตัวมีที่มาหรือคำนวณซ้ำเองได้</p>

<section>
<h2>เสียงเดินทางยังไง</h2>
<div class="chain-figure" aria-hidden="true"><span>ไฟล์เพลง</span><i></i><span>DAC</span><i></i><span>แอมป์</span><i></i><span>หูฟัง</span></div>
<p><b>DAC</b> แปลงตัวเลขดิจิทัลเป็นสัญญาณไฟฟ้า <b>แอมป์</b> ขยายสัญญาณให้แรงพอจะขยับไดรเวอร์หูฟัง มือถือ คอม และ dongle ล้วนมีทั้งสองอย่างอยู่ในตัว — dongle คือ DAC + แอมป์ตัวจิ๋ว คำถามจริงจึงไม่ใช่ "ต้องมี DAC ไหม" แต่คือ "ตัวที่มีอยู่จ่ายแรงดันพอหรือเปล่า"</p>
</section>

<section>
<h2>Impedance สูง ≠ ขับยาก</h2>
<p>ต้องดู <b>sensitivity</b> คู่กันเสมอ sensitivity บอกว่าป้อนไฟเท่านี้แล้วดังเท่าไหร่ ส่วน impedance บอกว่าหูฟังจะดึงกระแสมากหรือน้อย</p>
<ul>
<li>HD 600: 300 Ω, 97 dB/V → ฟังดังระดับ 95 dB ต้องการแรงดันประมาณ 0.8 V แต่กระแสน้อยมาก</li>
<li>Edition XS: 18 Ω, ~105 dB/V → ต้องการแรงดันแค่ ~0.3 V แต่ต้องดึงกระแสมากกว่า</li>
</ul>
<p class="formula">V = 10<sup>(SPL − S) / 20</sup> &nbsp;·&nbsp; I = V / Z &nbsp;·&nbsp; P = V² / Z</p>
</section>

<section>
<h2>dB/mW กับ dB/V ไม่ใช่หน่วยเดียวกัน</h2>
<p>ผู้ผลิตบางรายให้ sensitivity เทียบกับกำลัง 1 mW บางรายเทียบกับแรงดัน 1 V ตัวเลขดูคล้ายกันแต่เทียบกันตรงๆ ไม่ได้ แปลงได้ด้วย</p>
<p class="formula">dB/V = dB/mW + 10·log₁₀(1000 / Z)</p>
<p>ตัวอย่าง: Simgot EA500LM ระบุทั้ง 107 dB/mW และ 123 dB/V ที่ 21 Ω — แปลงแล้วได้ 123.8 dB/V ตรงกัน แต่หลายรุ่นไม่ตรงกัน เว็บนี้จึงแสดงทุกแหล่งและบอกว่าใช้ค่าไหนคำนวณ</p>
</section>

<section>
<h2>Balanced (4.4 mm) คืออะไร</h2>
<p>ช่อง balanced ขับหูฟังด้วยวงจรขยายสองชุดต่อข้าง ได้แรงดันสูงสุดราว 2 เท่าของช่องธรรมดา มีประโยชน์กับหูฟังที่ขับยาก แต่<b>ไม่ได้แปลว่าเสียงดีขึ้นเสมอ</b> ถ้าช่องธรรมดาก็ดังพออยู่แล้ว</p>
<ul>
<li><b>สาย balanced → ช่องธรรมดา</b> ผ่านหัวแปลง 4.4 → 3.5: ใช้ได้ ปลอดภัย</li>
<li><b>สายธรรมดา → ช่อง balanced</b> ผ่านหัวแปลง 3.5 → 4.4: <b>อันตราย</b> ขั้วลบของแอมป์ทั้งสองข้างจะถูกต่อลงกราวด์ แอมป์ที่ไม่ได้ออกแบบรองรับอาจเสียหาย — ให้ซื้อสายใหม่แทน</li>
</ul>
</section>

<section>
<h2>Output impedance และกฎ 1/8</h2>
<p>ทุกแอมป์มีความต้านทานขาออก (output impedance, Zout) ถ้า Zout สูงเมื่อเทียบกับ impedance ของหูฟัง แรงดันจะแบ่งไม่เท่ากันในแต่ละความถี่ กฎที่ใช้กันคือ <b>impedance หูฟัง ÷ Zout ควรมากกว่า 8</b></p>
<p>หูฟังไดรเวอร์เดียวที่กราฟ impedance เกือบแบน แทบไม่มีผลนอกจากเบาลงนิดหน่อย แต่ IEM หลายไดรเวอร์ที่มี BA impedance จะเปลี่ยนตามความถี่ โทนเสียงจึงเพี้ยนได้ — บางคนชอบความเพี้ยนแบบนี้และเรียกว่า "แอมป์ตัวนี้เสียงอุ่น" ตัวอย่างที่ตั้งใจใช้ผลนี้คือ Truthear Zero:RED ที่แถมตัวต้านทาน 10 Ω มาเพื่อลดเบส</p>
</section>

<section>
<h2>ฟังดังแค่ไหนถึงปลอดภัย</h2>
<p>WHO แนะนำว่าผู้ใหญ่ฟังที่ระดับ 80 dB ได้ไม่เกินประมาณ 40 ชั่วโมงต่อสัปดาห์ ดังขึ้นทุก 3 dB เวลาที่ปลอดภัยลดลงครึ่งหนึ่ง ค่าเริ่มต้นของเว็บนี้ (เฉลี่ย 80 dB) จึงอิงจากตัวเลขนี้ <a href="https://www.who.int/activities/making-listening-safe" target="_blank" rel="noopener">WHO — Make Listening Safe</a></p>
</section>

<section>
<h2>ของที่ไม่ต้องจ่ายเพิ่ม</h2>
<ul>
<li><b>สาย LAN / network switch "audiophile"</b> — ข้อมูลเพลงวิ่งเป็นแพ็กเก็ตที่มีระบบตรวจความถูกต้อง ถ้าแพ็กเก็ตเสียจะถูกส่งใหม่ ข้อมูลที่ถึงปลายทางจึงเป็นตัวเลขชุดเดิมทุกบิต <a href="https://en.wikipedia.org/wiki/Transmission_Control_Protocol" target="_blank" rel="noopener">TCP</a></li>
<li><b>ไฟล์ความละเอียดเกิน 16-bit/44.1 kHz สำหรับฟังอย่างเดียว</b> — 44.1 kHz เก็บความถี่ได้ถึง ~22 kHz ซึ่งเกินช่วงการได้ยินของคนแล้ว ไฟล์ hi-res มีประโยชน์ในงานอัดและมิกซ์ <a href="https://en.wikipedia.org/wiki/Nyquist%E2%80%93Shannon_sampling_theorem" target="_blank" rel="noopener">Nyquist–Shannon</a></li>
<li><b>แอมป์ที่แรงเกินหูฟังหลายสิบเท่า</b> — ถ้าเว็บบอกว่า "ดังพอ" แล้ว แอมป์ที่แรงกว่านี้ไม่ได้ทำให้ดังได้มากขึ้นในการใช้งานจริง</li>
</ul>
</section>

<section>
<h2>สิ่งที่เว็บนี้ตั้งใจไม่ตอบ</h2>
<p>"ชุดนี้เสียงเพราะไหม" "เข้ากันไหม (synergy)" "เหมาะกับแนวเพลงฉันไหม" — เป็นเรื่องรสนิยม ไม่มีสูตร ให้ดูกราฟเทียบที่ <a href="https://squig.link/" target="_blank" rel="noopener">squig.link</a> อ่านรีวิวหลายๆ แหล่ง และถ้าเป็นไปได้ ลองฟังเอง</p>
</section>
`,
  en: `
<h1>The basics</h1>
<p class="lead">What to know before you pay for headphones or an amp, written for normal people. Every number has a source or can be recalculated.</p>

<section>
<h2>How the signal travels</h2>
<div class="chain-figure" aria-hidden="true"><span>Music file</span><i></i><span>DAC</span><i></i><span>Amp</span><i></i><span>Headphones</span></div>
<p>The <b>DAC</b> turns digital numbers into an electrical signal. The <b>amp</b> makes it strong enough to move the drivers. Phones, computers and dongles all contain both — a dongle is a tiny DAC + amp. So the real question isn't "do I need a DAC" but "does what I have deliver enough voltage".</p>
</section>

<section>
<h2>High impedance ≠ hard to drive</h2>
<p>Always read <b>sensitivity</b> together with impedance. Sensitivity says how loud it gets for a given input; impedance says how much current it draws.</p>
<ul>
<li>HD 600: 300 Ω, 97 dB/V → 95 dB needs about 0.8 V, but very little current</li>
<li>Edition XS: 18 Ω, ~105 dB/V → needs only ~0.3 V, but draws more current</li>
</ul>
<p class="formula">V = 10<sup>(SPL − S) / 20</sup> &nbsp;·&nbsp; I = V / Z &nbsp;·&nbsp; P = V² / Z</p>
</section>

<section>
<h2>dB/mW and dB/V are different units</h2>
<p>Some makers quote sensitivity per 1 mW, others per 1 V. The numbers look alike but can't be compared directly. Convert with</p>
<p class="formula">dB/V = dB/mW + 10·log₁₀(1000 / Z)</p>
<p>Example: Simgot quotes the EA500LM as both 107 dB/mW and 123 dB/V at 21 Ω — converted, that's 123.8 dB/V, consistent. Many models aren't, so this site shows every source and says which one it used.</p>
</section>

<section>
<h2>What balanced (4.4 mm) means</h2>
<p>A balanced output drives each side with two amplifier halves and reaches roughly twice the voltage of a single-ended jack. Useful for hard-to-drive headphones, but <b>not automatically better sound</b> if single-ended is already loud enough.</p>
<ul>
<li><b>Balanced cable → single-ended jack</b> with a 4.4 → 3.5 adapter: works, safe</li>
<li><b>Single-ended cable → balanced jack</b> with a 3.5 → 4.4 adapter: <b>dangerous</b>. Both negative amp outputs get tied to ground; amps not designed for it can be damaged. Buy a balanced cable instead.</li>
</ul>
</section>

<section>
<h2>Output impedance and the 1/8 rule</h2>
<p>Every amp has an output impedance (Zout). If it's high relative to the headphone's impedance, the voltage divides unevenly across frequencies. Rule of thumb: <b>headphone impedance ÷ Zout should exceed 8</b>.</p>
<p>Single-driver headphones with a flat impedance curve barely change except for a small level drop. Multi-driver IEMs with balanced armatures have impedance that varies with frequency, so their tonality can shift — some people like that and call the amp "warm". The Truthear Zero:RED uses this on purpose: it ships with a 10 Ω adapter to reduce bass.</p>
</section>

<section>
<h2>How loud is safe</h2>
<p>WHO guidance: adults can listen at 80 dB for about 40 hours a week; every +3 dB halves the safe time. That's why this site defaults to an 80 dB average. <a href="https://www.who.int/activities/making-listening-safe" target="_blank" rel="noopener">WHO — Make Listening Safe</a></p>
</section>

<section>
<h2>Things you don't need to pay extra for</h2>
<ul>
<li><b>"Audiophile" LAN cables and network switches</b> — music data travels in checksummed packets; damaged packets are resent, so what arrives is the same bits. <a href="https://en.wikipedia.org/wiki/Transmission_Control_Protocol" target="_blank" rel="noopener">TCP</a></li>
<li><b>Beyond 16-bit/44.1 kHz for playback</b> — 44.1 kHz captures up to ~22 kHz, past the range of human hearing. Hi-res matters when recording and mixing. <a href="https://en.wikipedia.org/wiki/Nyquist%E2%80%93Shannon_sampling_theorem" target="_blank" rel="noopener">Nyquist–Shannon</a></li>
<li><b>An amp many times stronger than needed</b> — once this site says "loud enough", more power doesn't make real listening louder.</li>
</ul>
</section>

<section>
<h2>What this site deliberately doesn't answer</h2>
<p>"Does it sound good", "synergy", "is it right for my music" — that's taste, there's no formula. Compare graphs on <a href="https://squig.link/" target="_blank" rel="noopener">squig.link</a>, read several reviews, and listen yourself if you can.</p>
</section>
`,
};

// Sources page. One disclaimer at the top instead of one per row.
export function aboutPage(lang, sites, stores) {
  const th = lang === "th";
  const storeRows = Object.entries(stores)
    .map(
      ([id, s]) => `<a class="row link-row" href="https://${s.host ?? hostOf(id)}/" target="_blank" rel="noopener">
      <div><div class="row-title">${esc(s.name)}</div><div class="row-sub">${s.products.toLocaleString()} ${th ? "รายการ" : "listings"} · ${new Date(s.fetchedAt).toISOString().slice(0, 10)}</div></div><span class="ext" aria-hidden="true"></span></a>`,
    )
    .join("");
  const siteRows = sites
    .map(
      (s) => `<a class="row link-row compact" href="https://${s.host}/" target="_blank" rel="noopener"><div><span class="row-title">${esc(s.host)}</span> <span class="muted">${s.count}</span></div><span class="ext" aria-hidden="true"></span></a>`,
    )
    .join("");
  return `
<h1>${th ? "ข้อมูลมาจากไหน" : "Where the data comes from"}</h1>
<p class="lead">${
    th
      ? "ราคา สต็อก และสเปกดึงจากฟีดสินค้าสาธารณะของร้าน (Shopify /products.json) เก็บเฉพาะตัวเลขกับลิงก์ และข้อความสเปกบรรทัดที่ตัวเลขมาจาก ไม่คัดลอกคำบรรยายหรือรูป ทุกค่าต้องผ่านการตรวจว่าข้อความนั้นมีอยู่จริงในหน้าร้านและมีตัวเลขเดียวกัน Sotto ไม่มีส่วนเกี่ยวข้องและไม่ได้รับการรับรองจากร้านหรือแบรนด์ใด"
      : "Prices, stock and specs come from stores' public product feeds (Shopify /products.json). Only numbers, links and the single spec line each number came from are kept — no descriptions or images. Every value must be found verbatim in the store text with the same number. Sotto is not affiliated with or endorsed by any store or brand."
  }</p>

<h3 class="group">${th ? "ร้านค้า" : "Stores"}</h3>
<div class="card">${storeRows}</div>

<h3 class="group">${th ? "แหล่งของค่าสเปก (จำนวนค่า)" : "Spec sources (values cited)"}</h3>
<div class="card">${siteRows}</div>

<h3 class="group">License</h3>
<div class="card">
  <a class="row link-row" href="${REPO}" target="_blank" rel="noopener"><div><div class="row-title">${th ? "โค้ด — MIT" : "Code — MIT"}</div><div class="row-url">${REPO}</div></div><span class="ext" aria-hidden="true"></span></a>
  <a class="row link-row" href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noopener"><div><div class="row-title">${th ? "ข้อมูล — CC BY-SA 4.0" : "Data — CC BY-SA 4.0"}</div><div class="row-sub">${th ? "ใช้ได้ ให้เครดิต และเปิดต่อด้วย license เดียวกัน" : "Use it, credit it, share alike"}</div></div><span class="ext" aria-hidden="true"></span></a>
  <a class="row link-row" href="https://fonts.google.com/specimen/IBM+Plex+Sans+Thai" target="_blank" rel="noopener"><div><div class="row-title">IBM Plex Sans Thai, Inter</div><div class="row-sub">SIL Open Font License 1.1</div></div><span class="ext" aria-hidden="true"></span></a>
  <div class="row"><div><div class="row-sub">${th ? "ชื่อแบรนด์และรุ่นเป็นเครื่องหมายการค้าของเจ้าของ ใช้เพื่อระบุสินค้าเท่านั้น" : "Brand and model names are trademarks of their owners, used only to identify products."}</div></div></div>
</div>`;
}

const HOSTS = { audio46: "audio46.com", hifigo: "hifigo.com", bloomaudio: "bloomaudio.com", shenzhenaudio: "shenzhenaudio.com", linsoul: "linsoul.com", "headphones-com": "headphones.com", apos: "apos.audio", hangout: "hangout.audio" };
const hostOf = (id) => HOSTS[id] ?? id;
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

export { REPO };
