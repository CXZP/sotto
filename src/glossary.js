// Glossary: one page per term. Each term says what it is, what it means in a
// real headphone chain (with numbers), what people get wrong, and links out.
// `tool` names an interactive calculator rendered on the page (see app.js).

export const GLOSSARY_UPDATED = "2026-10-12";

const W = (page) => ({ label: `Wikipedia: ${page.replace(/_/g, " ")}`, url: `https://en.wikipedia.org/wiki/${page}` });

export const TERMS = [
  {
    id: "impedance",
    tool: null,
    related: ["sensitivity", "power", "output-impedance", "drivers"],
    refs: [W("Electrical_impedance")],
    th: {
      title: "อิมพีแดนซ์ (Impedance)",
      short: "ความต้านทานไฟฟ้าของหูฟัง หน่วยโอห์ม (Ω) บอกว่าต้องใช้แรงดันหรือกระแสมากแค่ไหน",
      body: `<h2>คืออะไร</h2>
<p>อิมพีแดนซ์คือความต้านทานไฟฟ้าของหูฟัง วัดเป็นโอห์ม (Ω) หูฟังทั่วไปอยู่ราว 16–600 Ω: IEM ส่วนใหญ่ 8–50 Ω, หูฟังครอบหูทั่วไป 32–80 Ω, รุ่นสตูดิโอบางรุ่น 250–600 Ω เช่น Sennheiser HD 600 (300 Ω), Beyerdynamic DT 770 รุ่น 250 Ω</p>
<h2>ในชุดของคุณ</h2>
<p>อิมพีแดนซ์<b>อย่างเดียวไม่ได้บอกว่าขับยากไหม</b> ต้องดูคู่กับ <a href="#learn/sensitivity">ความไว</a> ตัวอย่าง: หูฟัง 300 Ω ที่ความไว 97 dB/V ต้องการแรงดันราว 0.14 V ต่อการฟัง 80 dB ซึ่งมือถือส่วนใหญ่ให้ได้ ส่วนหูฟังแพลนาร์ 32 Ω ที่ความไว 90 dB/V ต้องการ 0.32 V และกระแสสูงกว่ามาก</p>
<ul>
<li><b>อิมพีแดนซ์สูง</b> → ต้องการ<b>แรงดัน</b> (Vrms) มาก แต่กระแสน้อย</li>
<li><b>อิมพีแดนซ์ต่ำ</b> → ต้องการ<b>กระแส</b> มาก แหล่งเสียงเล็กๆ อาจจ่ายกระแสไม่ไหวก่อนแรงดันจะหมด</li>
</ul>
<h2>เข้าใจผิดบ่อย</h2>
<ul>
<li>"300 Ω ต้องใช้แอมป์เสมอ" — ไม่จริงเสมอไป ขึ้นกับความไวและฟังดังแค่ไหน</li>
<li>ตัวเลขบนกล่องคือค่าที่ 1 kHz เท่านั้น IEM แบบ BA หลายไดรเวอร์มีอิมพีแดนซ์ที่ขึ้นลงตามความถี่มาก (เช่น 5–40 Ω) ทำให้เสียงเปลี่ยนตามแหล่งเสียง ดู <a href="#learn/output-impedance">อิมพีแดนซ์ขาออก</a></li>
</ul>`,
    },
    en: {
      title: "Impedance",
      short: "A headphone's electrical resistance in ohms (Ω); tells you whether it needs voltage or current",
      body: `<h2>What it is</h2>
<p>Impedance is the headphone's electrical load, in ohms (Ω). Typical values run 16–600 Ω: most IEMs 8–50 Ω, most over-ears 32–80 Ω, some studio models 250–600 Ω, e.g. Sennheiser HD 600 (300 Ω) or Beyerdynamic DT 770 (250 Ω version).</p>
<h2>In your chain</h2>
<p>Impedance <b>alone doesn't tell you how hard a headphone is to drive</b>; you need <a href="#learn/sensitivity">sensitivity</a> too. A 300 Ω headphone at 97 dB/V needs about 0.14 V for an 80 dB average, which most phones can deliver. A 32 Ω planar at 90 dB/V needs 0.32 V and far more current.</p>
<ul>
<li><b>High impedance</b> → needs <b>voltage</b> (Vrms), little current</li>
<li><b>Low impedance</b> → needs <b>current</b>; small sources can run out of current before they run out of voltage</li>
</ul>
<h2>Common mistakes</h2>
<ul>
<li>"300 Ω always needs an amp": not necessarily; it depends on sensitivity and how loud you listen</li>
<li>The box figure is at 1 kHz only. Multi-driver BA IEMs can swing widely across frequency (say 5–40 Ω), so their sound changes with the source; see <a href="#learn/output-impedance">output impedance</a></li>
</ul>`,
    },
  },
  {
    id: "sensitivity",
    tool: "sens",
    related: ["impedance", "power", "spl"],
    refs: [W("Headphones")],
    th: {
      title: "ความไว (Sensitivity): dB/mW กับ dB/V",
      short: "ใส่สัญญาณเท่ากันแล้วดังแค่ไหน มีสองหน่วยที่ห้ามเทียบกันตรงๆ",
      body: `<h2>คืออะไร</h2>
<p>ความไวบอกว่าหูฟังดังแค่ไหน (dB SPL) เมื่อป้อนสัญญาณขนาดมาตรฐาน มีสองแบบ:</p>
<ul>
<li><b>dB/mW</b> — ดังเท่าไรเมื่อป้อนกำลัง 1 มิลลิวัตต์</li>
<li><b>dB/V</b> — ดังเท่าไรเมื่อป้อนแรงดัน 1 Vrms</li>
</ul>
<p>แปลงกันได้ด้วยอิมพีแดนซ์: <code>dB/V = dB/mW + 10·log10(1000 / Z)</code></p>
<h2>ในชุดของคุณ</h2>
<p>ตัวเลขเดียวกันแต่คนละหน่วยต่างกันได้มาก หูฟัง 300 Ω ค่า dB/V จะสูงกว่าค่า dB/mW ราว 5 dB แต่ที่ 16 Ω จะสูงกว่าถึงราว 18 dB ถ้าร้านเขียน "110 dB" เฉยๆ โดยไม่บอกหน่วย ผลคำนวณอาจผิดไปหลายเท่า Sotto จึงคิดทั้งสองแบบและบอกว่าผลตรงกันไหม</p>
<h2>เข้าใจผิดบ่อย</h2>
<ul>
<li>เอา dB/mW ของรุ่นหนึ่งไปเทียบกับ dB/V ของอีกรุ่น</li>
<li>ความไวสูงไม่ได้แปลว่าเสียงดีกว่า แค่ดังง่ายกว่า และได้ยินเสียงซ่า (hiss) ของแหล่งเสียงง่ายกว่าด้วย ดู <a href="#learn/noise">เสียงรบกวน</a></li>
</ul>`,
    },
    en: {
      title: "Sensitivity: dB/mW vs dB/V",
      short: "How loud it gets for a standard signal; two units that must not be compared directly",
      body: `<h2>What it is</h2>
<p>Sensitivity is how loud (dB SPL) a headphone plays for a standard input. Two conventions exist:</p>
<ul>
<li><b>dB/mW</b>: loudness at 1 milliwatt of power</li>
<li><b>dB/V</b>: loudness at 1 Vrms</li>
</ul>
<p>They convert through impedance: <code>dB/V = dB/mW + 10·log10(1000 / Z)</code></p>
<h2>In your chain</h2>
<p>The same number in different units can mean very different things. At 300 Ω the dB/V figure is about 5 dB higher than the dB/mW figure; at 16 Ω it is about 18 dB higher. When a store writes "110 dB" with no unit, a calculation can be off several-fold, so Sotto computes both readings and tells you whether they agree.</p>
<h2>Common mistakes</h2>
<ul>
<li>Comparing one model's dB/mW with another's dB/V</li>
<li>Higher sensitivity isn't better sound, just easier loudness, and it also makes source hiss easier to hear; see <a href="#learn/noise">noise</a></li>
</ul>`,
    },
  },
  {
    id: "power",
    tool: "spl",
    related: ["impedance", "sensitivity", "spl", "gain"],
    refs: [W("Audio_power"), W("Root_mean_square")],
    th: {
      title: "กำลังขับ แรงดัน กระแส (mW @ Ω, Vrms)",
      short: "ทำไม \"250 mW @ 32 Ω\" ไม่ได้บอกว่าขับหูฟัง 300 Ω ได้แค่ไหน",
      body: `<h2>คืออะไร</h2>
<p>แหล่งเสียงมักบอกกำลังเป็น <b>mW ที่โหลดหนึ่ง</b> เช่น 250 mW @ 32 Ω ความสัมพันธ์: <code>P = V² / Z</code> และ <code>I = V / Z</code> ดังนั้น 250 mW @ 32 Ω = แรงดัน √(0.25 × 32) ≈ 2.83 Vrms</p>
<h2>ในชุดของคุณ</h2>
<p>ที่ 300 Ω แหล่งเสียงเดียวกันมักให้แรงดันได้ไม่เกินค่าสูงสุดของมัน (สมมติ 2.83 V) จึงได้แค่ 2.83² / 300 ≈ 27 mW ตัวเลข mW จึงลดลงมากเมื่ออิมพีแดนซ์สูงขึ้น ทั้งที่ยังขับได้สบาย เพราะหูฟัง 300 Ω ส่วนใหญ่ต้องการแค่ไม่กี่ mW</p>
<p>ในทางกลับกัน ที่ 16 Ω หรือต่ำกว่า แหล่งเสียงเล็กๆ มักติดเพดาน<b>กระแส</b>ก่อน กำลังจึงไม่เพิ่มขึ้นตามสูตร Sotto จึงถือว่าต่ำกว่าโหลดที่ร้านระบุคือ "จำกัดด้วยกระแส" และติดป้ายว่าเป็นค่าประมาณ</p>
<h2>เข้าใจผิดบ่อย</h2>
<ul>
<li>"กำลังเยอะ = เสียงดีขึ้น" — ถ้าดังพอแล้ว กำลังที่เกินมาไม่ได้ทำให้เสียงดีขึ้น และกับ IEM อาจทำให้ปรับเสียงยากและได้ยินเสียงซ่ามากขึ้น</li>
<li>เทียบ mW ของแหล่งเสียงสองตัวที่ระบุคนละโหลด (เช่น @16 Ω กับ @32 Ω)</li>
</ul>`,
    },
    en: {
      title: "Power, voltage, current (mW @ Ω, Vrms)",
      short: "Why \"250 mW @ 32 Ω\" doesn't tell you how it drives a 300 Ω headphone",
      body: `<h2>What it is</h2>
<p>Sources usually quote <b>mW into a given load</b>, e.g. 250 mW @ 32 Ω. The relations: <code>P = V² / Z</code> and <code>I = V / Z</code>, so 250 mW @ 32 Ω = √(0.25 × 32) ≈ 2.83 Vrms.</p>
<h2>In your chain</h2>
<p>Into 300 Ω the same source usually can't exceed its maximum voltage (say 2.83 V), giving 2.83² / 300 ≈ 27 mW. The mW figure collapses at high impedance even though it drives the load fine, because most 300 Ω headphones need only a few mW.</p>
<p>At 16 Ω and below, small sources usually hit a <b>current</b> ceiling first, so power stops rising with the formula. Below the lowest rated load Sotto treats the output as current-limited and labels the result as estimated.</p>
<h2>Common mistakes</h2>
<ul>
<li>"More power = better sound": once it's loud enough, extra power adds nothing, and with IEMs it can make volume harder to set and hiss more audible</li>
<li>Comparing two sources rated into different loads (@16 Ω vs @32 Ω)</li>
</ul>`,
    },
  },
  {
    id: "spl",
    tool: "spl",
    related: ["hearing", "power", "sensitivity"],
    refs: [W("Sound_pressure_level"), W("Crest_factor")],
    th: {
      title: "dB SPL, เผื่อพีค (Headroom)",
      short: "ความดังเป็นเดซิเบล และทำไมต้องเผื่อแรงดันไว้ 15–20 dB",
      body: `<h2>คืออะไร</h2>
<p>dB SPL คือความดังของเสียงที่หู ทุก +6 dB ต้องใช้<b>แรงดันเพิ่ม 2 เท่า</b> (หรือกำลังเพิ่ม 4 เท่า) และทุก +10 dB หูรับรู้ว่าดังขึ้นราว 2 เท่า แต่ต้องใช้กำลังเพิ่ม 10 เท่า</p>
<h2>ในชุดของคุณ</h2>
<p>เพลงไม่ได้ดังเท่ากันตลอด ช่วงพีค (กลองกระแทก) ดังกว่าค่าเฉลี่ยราว 10–20 dB (เรียกว่า crest factor) Sotto ตั้งให้ฟังเฉลี่ย 80 dB และเผื่อพีคอีก 15 dB จึงต้องการแรงดันพอสำหรับ 95 dB ถ้าแหล่งเสียงไปไม่ถึง พีคจะถูกตัด (clipping) และได้ยินเป็นเสียงแตก</p>
<h2>เข้าใจผิดบ่อย</h2>
<ul>
<li>"ปรับวอลุ่ม 50% = ใช้กำลังครึ่งเดียว" — วอลุ่มส่วนใหญ่เป็นสเกล log ตำแหน่งปุ่มบอกอะไรไม่ได้</li>
<li>ความดังสูงสุดที่ 130 dB ขึ้นไปไม่ได้เป็นข้อดี Sotto ถือว่า "แรงเกิน" เพราะใช้ได้แค่ช่วงต้นของวอลุ่ม และพลาดนิดเดียวก็อันตราย</li>
</ul>`,
    },
    en: {
      title: "dB SPL and headroom",
      short: "Loudness in decibels, and why you need 15–20 dB spare",
      body: `<h2>What it is</h2>
<p>dB SPL is sound pressure at the ear. Every +6 dB needs <b>twice the voltage</b> (four times the power); every +10 dB sounds roughly twice as loud but needs ten times the power.</p>
<h2>In your chain</h2>
<p>Music isn't constant: peaks (a drum hit) sit 10–20 dB above the average, the crest factor. Sotto assumes an 80 dB average plus 15 dB for peaks, so the source must reach 95 dB. If it can't, peaks clip and you hear distortion.</p>
<h2>Common mistakes</h2>
<ul>
<li>"Volume at 50% = half the power": most volume controls are logarithmic; knob position says little</li>
<li>A 130 dB+ maximum is not a feature. Sotto flags it as "too powerful": only the bottom of the volume range is usable and a slip is dangerous</li>
</ul>`,
    },
  },
  {
    id: "hearing",
    tool: "dose",
    related: ["spl", "gain"],
    refs: [{ label: "WHO: Make Listening Safe", url: "https://www.who.int/activities/making-listening-safe" }, W("Noise-induced_hearing_loss")],
    th: {
      title: "ความปลอดภัยของหู",
      short: "80 dB ได้ 40 ชั่วโมงต่อสัปดาห์ ทุก +3 dB เวลาลดครึ่ง",
      body: `<h2>คืออะไร</h2>
<p>แนวทางฟังอย่างปลอดภัยขององค์การอนามัยโลก (WHO/ITU H.870) สำหรับผู้ใหญ่คือ <b>80 dB ไม่เกิน 40 ชั่วโมงต่อสัปดาห์</b> และทุกครั้งที่ดังขึ้น 3 dB เวลาที่ปลอดภัยจะลดลงครึ่งหนึ่ง: 83 dB = 20 ชม., 86 dB = 10 ชม., 89 dB = 5 ชม. ต่อสัปดาห์</p>
<h2>ในชุดของคุณ</h2>
<p>หูฟังและแอมป์ที่ "แรงเกิน" (ดังได้เกิน 130 dB) อันตรายเพราะช่วงวอลุ่มที่ใช้ได้สั้นมาก ใช้ low gain ถ้ามี และเริ่มที่วอลุ่มต่ำสุดทุกครั้งที่เปลี่ยนหูฟัง</p>
<h2>เข้าใจผิดบ่อย</h2>
<ul>
<li>"ไม่เจ็บหู = ไม่เป็นไร" — การสูญเสียการได้ยินจากเสียงดังสะสมโดยไม่รู้ตัวและไม่กลับคืน</li>
<li>เสียงรอบข้างดังทำให้เราเร่งวอลุ่มตาม IEM ที่ปิดเสียงรอบข้างได้ดี (จุกแน่น) ช่วยให้ฟังเบาลงได้</li>
</ul>`,
    },
    en: {
      title: "Hearing safety",
      short: "80 dB for 40 hours a week; every +3 dB halves the time",
      body: `<h2>What it is</h2>
<p>The WHO/ITU H.870 safe-listening guidance for adults is <b>80 dB for up to 40 hours a week</b>, and every 3 dB louder halves the safe time: 83 dB = 20 h, 86 dB = 10 h, 89 dB = 5 h per week.</p>
<h2>In your chain</h2>
<p>An "overkill" pairing (130 dB+ possible) is dangerous because the usable volume range is tiny. Use low gain if available and start at minimum volume whenever you swap headphones.</p>
<h2>Common mistakes</h2>
<ul>
<li>"It doesn't hurt, so it's fine": noise-induced hearing loss accumulates silently and is permanent</li>
<li>Loud surroundings make you turn up. IEMs that isolate well (a good tip seal) let you listen quieter</li>
</ul>`,
    },
  },
  {
    id: "output-impedance",
    tool: "zout",
    related: ["impedance", "drivers", "power"],
    refs: [W("Output_impedance"), W("Damping_factor")],
    th: {
      title: "อิมพีแดนซ์ขาออก (Output impedance) และกฎ 1/8",
      short: "ถ้าแหล่งเสียงมีอิมพีแดนซ์ขาออกสูงเกิน 1/8 ของหูฟัง เสียงอาจเพี้ยน",
      body: `<h2>คืออะไร</h2>
<p>ทุกแหล่งเสียงมีความต้านทานภายในที่ช่องเสียบ (Zout) มันต่ออนุกรมกับหูฟังเหมือนตัวแบ่งแรงดัน ถ้าอิมพีแดนซ์ของหูฟังเปลี่ยนตามความถี่ (พบมากใน IEM แบบ BA หลายไดรเวอร์) เสียงก็จะเปลี่ยนตาม</p>
<h2>ในชุดของคุณ</h2>
<p>กฎคร่าวๆ: <b>Zout ไม่ควรเกิน 1/8 ของอิมพีแดนซ์หูฟัง</b> เช่น IEM 16 Ω ควรใช้แหล่งเสียงที่ Zout ≤ 2 Ω แหล่งเสียงส่วนใหญ่ปัจจุบันต่ำกว่า 1 Ω แต่บางตัว (แอมป์หลอด, DAP รุ่นเก่า, บางโหมด) สูงถึง 10 Ω ขึ้นไป</p>
<h2>เข้าใจผิดบ่อย</h2>
<ul>
<li>กฎ 1/8 เป็นแนวทาง ไม่ใช่เส้นตาย หูฟังไดนามิกไดรเวอร์เดียวที่อิมพีแดนซ์แทบไม่เปลี่ยน แทบไม่ได้รับผลกระทบ</li>
<li>"Damping factor" สูงๆ บนสเปกแอมป์คือเรื่องเดียวกัน (Z หูฟัง ÷ Zout) ไม่ได้ทำให้เบสแน่นขึ้นถ้าเกิน 8 แล้ว</li>
</ul>`,
    },
    en: {
      title: "Output impedance and the 1/8 rule",
      short: "If a source's output impedance exceeds 1/8 of the headphone's, the sound can shift",
      body: `<h2>What it is</h2>
<p>Every source has an internal resistance at its jack (Zout). It sits in series with the headphone like a voltage divider. If the headphone's impedance varies with frequency (common in multi-driver BA IEMs), the frequency response shifts too.</p>
<h2>In your chain</h2>
<p>Rule of thumb: <b>Zout should be at most 1/8 of the headphone impedance</b>. A 16 Ω IEM wants Zout ≤ 2 Ω. Most modern sources are under 1 Ω; some (tube amps, older DAPs, certain modes) reach 10 Ω or more.</p>
<h2>Common mistakes</h2>
<ul>
<li>1/8 is a guide, not a cliff. A single dynamic driver with a flat impedance curve barely cares</li>
<li>A huge "damping factor" on an amp spec is the same ratio (headphone Z ÷ Zout); past about 8 it doesn't tighten bass</li>
</ul>`,
    },
  },
  {
    id: "balanced",
    tool: null,
    related: ["connectors", "power", "dc-protection"],
    refs: [W("Balanced_audio"), W("Phone_connector_(audio)")],
    th: {
      title: "บาลานซ์ (Balanced) 4.4 / 2.5 / XLR",
      short: "แยกขั้วลบซ้ายขวา ได้แรงดันเพิ่มราว 2 เท่า แต่เสียบผิดทางอาจพัง",
      body: `<h2>คืออะไร</h2>
<p>ช่อง single-ended (3.5 / 6.35 มม.) ใช้กราวด์ร่วมกันระหว่างซ้ายขวา ช่องบาลานซ์ (4.4 มม. Pentaconn, 2.5 มม., XLR 4 ขา) แยกขั้ว + และ − ของแต่ละข้าง แอมป์ขับทั้งสองขั้ว จึงได้<b>แรงดันราว 2 เท่า (+6 dB)</b> และแยกช่องซ้ายขวาได้ดีกว่า</p>
<h2>ในชุดของคุณ</h2>
<ul>
<li>ใช้ได้เมื่อหูฟังมีสายถอดเปลี่ยนได้ และซื้อสายหัวบาลานซ์มาใช้</li>
<li><b>อันตราย:</b> ใช้ตัวแปลงเสียบหูฟัง 3.5 มม. (single-ended) เข้าช่องบาลานซ์ จะทำให้ขั้วลบของสองข้างต่อกัน แอมป์บางตัวพังได้ ทางกลับกัน (หูฟังบาลานซ์ → ช่อง 3.5) ใช้ตัวแปลงได้ปกติ</li>
</ul>
<h2>เข้าใจผิดบ่อย</h2>
<ul>
<li>"บาลานซ์เสียงดีกว่าเสมอ" — ได้แรงดันและแยกช่องดีขึ้น แต่ถ้าช่อง 3.5 ดังพออยู่แล้ว ความต่างมักเล็กมาก และช่องบาลานซ์บางรุ่นมีเสียงซ่ามากกว่า</li>
</ul>`,
    },
    en: {
      title: "Balanced: 4.4 / 2.5 / XLR",
      short: "Separate negatives for each side; about twice the voltage, but the wrong adapter can damage gear",
      body: `<h2>What it is</h2>
<p>Single-ended jacks (3.5 / 6.35 mm) share one ground between left and right. Balanced jacks (4.4 mm Pentaconn, 2.5 mm, 4-pin XLR) carry separate + and − for each side; the amp drives both, giving about <b>twice the voltage (+6 dB)</b> and better channel separation.</p>
<h2>In your chain</h2>
<ul>
<li>You need a headphone with a detachable cable and a balanced cable</li>
<li><b>Danger:</b> adapting a single-ended (3.5 mm) headphone into a balanced jack ties both negative outputs together, which can damage some amps. The other way (balanced headphone → 3.5 jack) is fine with an adapter</li>
</ul>
<h2>Common mistakes</h2>
<ul>
<li>"Balanced always sounds better": it adds voltage and separation, but if the 3.5 output is already loud enough the difference is usually tiny, and some balanced outputs hiss more</li>
</ul>`,
    },
  },
  {
    id: "dac-amp",
    tool: null,
    related: ["power", "gain", "noise", "bluetooth"],
    refs: [W("Digital-to-analog_converter"), W("Headphone_amplifier")],
    th: {
      title: "DAC, แอมป์, Dongle, DAP",
      short: "DAC แปลงดิจิทัลเป็นสัญญาณเสียง แอมป์ขยายให้ขับหูฟังได้",
      body: `<h2>คืออะไร</h2>
<ul>
<li><b>DAC</b> แปลงไฟล์ดิจิทัลเป็นสัญญาณไฟฟ้าแบบอนาล็อก</li>
<li><b>แอมป์หูฟัง</b> ขยายสัญญาณนั้นให้มีแรงดันและกระแสพอขับหูฟัง</li>
<li><b>Dongle</b> คือ DAC+แอมป์ ขนาดเล็กเสียบ USB-C/Lightning ใช้ไฟจากมือถือ</li>
<li><b>DAP</b> คือเครื่องเล่นเพลงพกพาที่มีทั้งสองอย่างในตัว</li>
<li><b>ตั้งโต๊ะ (desktop)</b> ใช้ไฟบ้าน ให้กำลังมากกว่า</li>
</ul>
<h2>ในชุดของคุณ</h2>
<p>มือถือสมัยนี้ส่วนใหญ่ไม่มีช่องหูฟัง เสียบหูฟังมีสายต้องใช้ dongle อยู่แล้ว ตัวแปลง USB-C ของ Apple (ราคาไม่กี่ร้อยบาท) ให้แรงดันราว 1 Vrms ซึ่งพอสำหรับ IEM และหูฟังจำนวนมาก ลองใช้ Sotto เช็กก่อนซื้อตัวแพง</p>
<h2>เข้าใจผิดบ่อย</h2>
<ul>
<li>ชิป DAC รุ่นแพงไม่ได้รับประกันว่าเสียงดีกว่า การออกแบบวงจรรอบชิปสำคัญกว่า</li>
<li>"ต้องมี DAC แยกถึงจะฟัง Hi-Res ได้" — dongle ราคาไม่กี่ร้อยบาทก็รองรับ 24-bit แล้ว</li>
</ul>`,
    },
    en: {
      title: "DAC, amp, dongle, DAP",
      short: "A DAC turns digital into an audio signal; an amp makes it strong enough for headphones",
      body: `<h2>What it is</h2>
<ul>
<li><b>DAC</b>: converts digital audio to an analog electrical signal</li>
<li><b>Headphone amp</b>: boosts that signal to the voltage and current the headphone needs</li>
<li><b>Dongle</b>: a tiny DAC+amp on a USB-C/Lightning plug, powered by the phone</li>
<li><b>DAP</b>: a portable music player with both built in</li>
<li><b>Desktop</b>: mains-powered units with more power</li>
</ul>
<h2>In your chain</h2>
<p>Most phones no longer have a headphone jack, so a wired headphone needs a dongle anyway. Apple's USB-C adapter (about $9) outputs roughly 1 Vrms, enough for IEMs and many headphones. Check with Sotto before buying an expensive one.</p>
<h2>Common mistakes</h2>
<ul>
<li>A pricier DAC chip doesn't guarantee better sound; the circuit around it matters more</li>
<li>"You need a separate DAC for hi-res": inexpensive dongles already handle 24-bit</li>
</ul>`,
    },
  },
  {
    id: "gain",
    tool: null,
    related: ["power", "noise", "hearing"],
    refs: [W("Gain_(electronics)")],
    th: {
      title: "Gain (ปรับอัตราขยาย)",
      short: "สวิตช์ low/high เปลี่ยนเพดานแรงดัน ไม่ได้เปลี่ยนคุณภาพเสียงโดยตรง",
      body: `<h2>คืออะไร</h2>
<p>Gain คือตัวคูณระหว่างสัญญาณเข้าและออก แหล่งเสียงหลายตัวมีสวิตช์ low/high gain ซึ่งเปลี่ยนแรงดันสูงสุดที่ออกได้ (มักต่างกัน 6–15 dB)</p>
<h2>ในชุดของคุณ</h2>
<ul>
<li><b>IEM:</b> ใช้ low gain ช่วงวอลุ่มที่ใช้ได้จะกว้างขึ้น และมักมีเสียงซ่าน้อยกว่า</li>
<li><b>หูฟังขับยาก:</b> ใช้ high gain ถ้า low gain ดังไม่พอ</li>
</ul>
<h2>เข้าใจผิดบ่อย</h2>
<ul>
<li>"High gain เสียงหนาขึ้น" — ถ้าปรับให้ดังเท่ากัน ส่วนใหญ่แยกไม่ออก เพราะสิ่งที่ได้ยินต่างคือความดังที่เพิ่มขึ้น</li>
</ul>`,
    },
    en: {
      title: "Gain",
      short: "A low/high switch changes the voltage ceiling, not sound quality directly",
      body: `<h2>What it is</h2>
<p>Gain is the multiplier between input and output. Many sources have a low/high gain switch that changes the maximum output voltage (often by 6–15 dB).</p>
<h2>In your chain</h2>
<ul>
<li><b>IEMs:</b> use low gain for a wider usable volume range and usually less hiss</li>
<li><b>Hard-to-drive headphones:</b> use high gain if low isn't loud enough</li>
</ul>
<h2>Common mistakes</h2>
<ul>
<li>"High gain sounds fuller": level-matched, most people can't tell; the difference heard is loudness</li>
</ul>`,
    },
  },
  {
    id: "noise",
    tool: "hiss",
    related: ["sensitivity", "gain", "measurements"],
    refs: [W("Signal-to-noise_ratio"), W("Noise_floor")],
    th: {
      title: "เสียงซ่า (Hiss) และ SNR",
      short: "IEM ความไวสูงได้ยินเสียงรบกวนของแหล่งเสียงได้ ดูค่าเป็นไมโครโวลต์",
      body: `<h2>คืออะไร</h2>
<p>แหล่งเสียงทุกตัวมีสัญญาณรบกวนพื้นฐานแม้ไม่ได้เล่นเพลง ปกติวัดเป็น<b>ไมโครโวลต์ (µV)</b> หรือบอกเป็น SNR (dB) เทียบกับกำลังสูงสุด</p>
<h2>ในชุดของคุณ</h2>
<p>ความดังของเสียงซ่า = ความไว (dB/V) + 20·log10(แรงดันรบกวน) เช่น เสียงรบกวน 5 µV กับ IEM 120 dB/V ≈ 14 dB SPL (แทบไม่ได้ยิน) แต่ 50 µV จะเป็น 34 dB SPL ซึ่งได้ยินในห้องเงียบ ลองคำนวณด้านล่าง</p>
<h2>เข้าใจผิดบ่อย</h2>
<ul>
<li>SNR สูงบนกล่องอาจวัดที่กำลังสูงสุด ซึ่งไม่ได้บอกว่าตอนฟังเบาๆ กับ IEM จะเงียบแค่ไหน ค่า µV ที่วัดจริง (เช่นจาก Audio Science Review) บอกได้ตรงกว่า</li>
</ul>`,
    },
    en: {
      title: "Hiss and SNR",
      short: "Sensitive IEMs reveal a source's noise; look at microvolts",
      body: `<h2>What it is</h2>
<p>Every source has a noise floor even with nothing playing, usually measured in <b>microvolts (µV)</b> or quoted as SNR (dB) relative to full output.</p>
<h2>In your chain</h2>
<p>Hiss loudness = sensitivity (dB/V) + 20·log10(noise voltage). 5 µV into a 120 dB/V IEM ≈ 14 dB SPL (barely audible); 50 µV is 34 dB SPL, audible in a quiet room. Try it below.</p>
<h2>Common mistakes</h2>
<ul>
<li>A big SNR on the box may be measured at full power, which says little about how quiet it is at low volume with IEMs. Measured µV figures (e.g. Audio Science Review) are more telling</li>
</ul>`,
    },
  },
  {
    id: "measurements",
    tool: null,
    related: ["noise", "frequency-response"],
    refs: [W("Total_harmonic_distortion"), W("Crosstalk")],
    th: {
      title: "THD, SINAD, Crosstalk: อ่านกราฟวัดผล",
      short: "ตัวเลขวัดของแหล่งเสียงส่วนใหญ่ดีเกินกว่าหูแยกได้แล้ว",
      body: `<h2>คืออะไร</h2>
<ul>
<li><b>THD+N</b> — ความเพี้ยนรวมเสียงรบกวน 0.01% = −80 dB, 0.001% = −100 dB</li>
<li><b>SINAD</b> — ตัวเลขเดียวกันกลับด้าน (สูงยิ่งดี)</li>
<li><b>Crosstalk</b> — เสียงข้างหนึ่งรั่วไปอีกข้างเท่าไร</li>
</ul>
<h2>ในชุดของคุณ</h2>
<p>DAC/แอมป์ปัจจุบันจำนวนมากมีความเพี้ยนต่ำกว่า −90 dB ซึ่งต่ำกว่าความเพี้ยนของหูฟังเองหลายเท่า (หูฟังมักมีความเพี้ยนในย่านเบสราว 0.1–1%) ตัวเลขที่ต่างกันระหว่าง −100 กับ −120 dB จึงไม่ใช่สิ่งที่ควรใช้ตัดสินใจหลัก ดูเรื่อง <a href="#learn/noise">เสียงซ่า</a>, กำลังขับ, ช่องต่อ และความน่าเชื่อถือ (QC) ก่อน</p>
<h2>เข้าใจผิดบ่อย</h2>
<ul>
<li>ใช้ SINAD เป็นคะแนนจัดอันดับเสียง — มันบอกความสะอาดของสัญญาณ ไม่ได้บอกว่าขับหูฟังคุณไหว</li>
</ul>`,
    },
    en: {
      title: "THD, SINAD, crosstalk: reading measurements",
      short: "Most sources already measure far beyond what ears can resolve",
      body: `<h2>What it is</h2>
<ul>
<li><b>THD+N</b>: distortion plus noise; 0.01% = −80 dB, 0.001% = −100 dB</li>
<li><b>SINAD</b>: the same figure flipped (higher is better)</li>
<li><b>Crosstalk</b>: how much one channel leaks into the other</li>
</ul>
<h2>In your chain</h2>
<p>Many current DACs/amps distort below −90 dB, several times lower than the headphone itself (headphones often run 0.1–1% in the bass). The gap between −100 and −120 dB shouldn't drive the decision; check <a href="#learn/noise">hiss</a>, power, ports and reliability (QC) first.</p>
<h2>Common mistakes</h2>
<ul>
<li>Treating SINAD as a sound-quality ranking: it describes signal cleanliness, not whether it drives your headphone</li>
</ul>`,
    },
  },
  {
    id: "frequency-response",
    tool: null,
    related: ["drivers", "eartips", "measurements"],
    refs: [W("Frequency_response"), { label: "Squiglink (community graph database)", url: "https://squig.link/" }],
    th: {
      title: "กราฟความถี่ (Frequency response) และ Target",
      short: "กราฟบอกเสียงของหูฟังได้มากที่สุด แต่ต้องเทียบจากเครื่องวัดเดียวกัน",
      body: `<h2>คืออะไร</h2>
<p>กราฟความถี่แสดงว่าหูฟังดังแต่ละย่าน (20 Hz–20 kHz) ต่างกันเท่าไร วัดด้วยหูจำลอง (coupler) เช่น IEC 60318-4 (711) หรือ B&K 5128 และมักเทียบกับเส้น "target" ที่งานวิจัยพบว่าคนส่วนใหญ่ชอบ เช่น Harman target</p>
<h2>ในชุดของคุณ</h2>
<ul>
<li>เทียบกราฟจาก<b>เครื่องวัดเดียวกัน</b>เท่านั้น ต่างเครื่องหรือต่างวิธีวางอาจต่างกันหลาย dB ในย่านแหลม</li>
<li>ยอดแหลมแถว 8 kHz ของ IEM มักเป็นผลจากเครื่องวัด (resonance) ไม่ใช่สิ่งที่หูได้ยินตรงๆ</li>
<li>เว็บรวมกราฟอย่าง squig.link ใช้เทียบหลายรุ่นได้ฟรี</li>
</ul>
<h2>เข้าใจผิดบ่อย</h2>
<ul>
<li>"กราฟตรง target = เสียงดีที่สุดสำหรับทุกคน" — target คือค่าเฉลี่ยความชอบ หูแต่ละคนและการใส่จุกต่างกัน</li>
<li>ช่วงความถี่บนกล่อง (เช่น 5 Hz–40 kHz) แทบไม่บอกอะไร ถ้าไม่มีค่าความคลาดเคลื่อน ±dB</li>
</ul>`,
    },
    en: {
      title: "Frequency response and targets",
      short: "The graph that says most about a headphone's sound, if compared on the same rig",
      body: `<h2>What it is</h2>
<p>A frequency response graph shows how loud a headphone is across 20 Hz–20 kHz, measured on an ear simulator (coupler) such as IEC 60318-4 (711) or B&K 5128, and usually compared with a research-based preference "target" such as the Harman target.</p>
<h2>In your chain</h2>
<ul>
<li>Compare graphs from the <b>same rig</b> only; different rigs or placement can differ by several dB in the treble</li>
<li>An IEM peak around 8 kHz is often a coupler resonance, not what you hear</li>
<li>Graph databases like squig.link let you overlay models for free</li>
</ul>
<h2>Common mistakes</h2>
<ul>
<li>"On target = best for everyone": a target is an average preference; ears and tip fit differ</li>
<li>A box range like 5 Hz–40 kHz means little without a ±dB tolerance</li>
</ul>`,
    },
  },
  {
    id: "drivers",
    tool: null,
    related: ["impedance", "output-impedance", "frequency-response"],
    refs: [W("Balanced_armature"), W("Headphones")],
    th: {
      title: "ประเภทไดรเวอร์: DD, BA, Planar, EST, ไฮบริด",
      short: "ไดรเวอร์ต่างชนิดมีพฤติกรรมไฟฟ้าต่างกัน ซึ่งส่งผลกับแหล่งเสียงที่เหมาะ",
      body: `<h2>คืออะไร</h2>
<ul>
<li><b>DD (ไดนามิก)</b> — กรวยกับขดลวด อิมพีแดนซ์ค่อนข้างคงที่</li>
<li><b>BA (Balanced armature)</b> — ชิ้นเล็ก มักใช้หลายตัวพร้อมครอสโอเวอร์ อิมพีแดนซ์ขึ้นลงตามความถี่มาก</li>
<li><b>Planar</b> — แผ่นฟิล์มบางทั้งแผ่น ความไวมักต่ำ ต้องการกระแสมาก</li>
<li><b>EST (อิเล็กโทรสแตติก)</b> — ใน IEM ใช้เสริมย่านแหลมสุด ต้องใช้ตัวแปลงแรงดันในตัว</li>
<li><b>ไฮบริด/ไตรบริด</b> — ผสมหลายชนิดในข้างเดียว</li>
</ul>
<h2>ในชุดของคุณ</h2>
<p>IEM ที่มี BA หลายตัวไวต่อ<a href="#learn/output-impedance">อิมพีแดนซ์ขาออก</a> หูฟังแพลนาร์ฟูลไซซ์มักต้องการแอมป์ที่จ่ายกระแสได้ดี</p>
<h2>เข้าใจผิดบ่อย</h2>
<ul>
<li>"ไดรเวอร์ยิ่งเยอะยิ่งดี" — จำนวนไดรเวอร์ไม่ได้บอกคุณภาพ IEM ไดนามิกตัวเดียวหลายรุ่นวัดผลดีกว่ารุ่น 8 ไดรเวอร์</li>
</ul>`,
    },
    en: {
      title: "Driver types: DD, BA, planar, EST, hybrid",
      short: "Different drivers behave differently electrically, which changes what source suits them",
      body: `<h2>What it is</h2>
<ul>
<li><b>DD (dynamic)</b>: cone and voice coil; fairly flat impedance</li>
<li><b>BA (balanced armature)</b>: tiny, often several with a crossover; impedance swings with frequency</li>
<li><b>Planar</b>: a thin diaphragm across the whole area; usually low sensitivity and current-hungry</li>
<li><b>EST (electrostatic)</b>: in IEMs, a super-tweeter with a built-in step-up transformer</li>
<li><b>Hybrid/tribrid</b>: several types in one shell</li>
</ul>
<h2>In your chain</h2>
<p>Multi-BA IEMs are sensitive to <a href="#learn/output-impedance">output impedance</a>. Full-size planars usually want an amp with plenty of current.</p>
<h2>Common mistakes</h2>
<ul>
<li>"More drivers is better": driver count isn't quality; plenty of single-DD IEMs measure better than 8-driver ones</li>
</ul>`,
    },
  },
  {
    id: "connectors",
    tool: null,
    related: ["balanced", "eartips"],
    refs: [W("Phone_connector_(audio)"), W("MMCX_connector")],
    th: {
      title: "ขั้วต่อสาย: 2-pin, MMCX, หัว 3.5 / 4.4 / 6.35",
      short: "เช็กขั้วต่อฝั่งหูฟังและหัวฝั่งแหล่งเสียงก่อนซื้อสาย",
      body: `<h2>คืออะไร</h2>
<ul>
<li><b>ฝั่งหูฟัง (IEM):</b> 0.78 มม. 2-pin, QDC (2-pin แบบมีบ่า), MMCX (หมุนได้)</li>
<li><b>ฝั่งแหล่งเสียง:</b> 3.5 มม. (TRS), 4.4 มม. บาลานซ์, 2.5 มม. บาลานซ์, 6.35 มม., XLR 4 ขา</li>
</ul>
<h2>ในชุดของคุณ</h2>
<p>สายเปลี่ยนต้องตรง<b>ทั้งสองด้าน</b> 2-pin ยังแยกเป็นแบบเว้า (recessed) กับแบบยื่น ใส่ผิดอาจหลวม สาย "modular" เปลี่ยนหัวได้ช่วยให้ใช้ได้ทั้ง 3.5 และ 4.4</p>
<h2>เข้าใจผิดบ่อย</h2>
<ul>
<li>สายราคาแพงทำให้เสียงเปลี่ยนมาก — ในการทดสอบแบบไม่รู้ว่าฟังอะไร (blind test) สายที่สร้างถูกต้องให้ผลแทบเหมือนกัน สิ่งที่สายเปลี่ยนจริงคือความทน ความนิ่ม และหัวที่ใช้ได้</li>
</ul>`,
    },
    en: {
      title: "Connectors: 2-pin, MMCX, 3.5 / 4.4 / 6.35 plugs",
      short: "Check both the headphone-side connector and the source-side plug before buying a cable",
      body: `<h2>What it is</h2>
<ul>
<li><b>Headphone side (IEM):</b> 0.78 mm 2-pin, QDC (shrouded 2-pin), MMCX (rotating)</li>
<li><b>Source side:</b> 3.5 mm (TRS), 4.4 mm balanced, 2.5 mm balanced, 6.35 mm, 4-pin XLR</li>
</ul>
<h2>In your chain</h2>
<p>A replacement cable must match <b>both ends</b>. 2-pin also comes recessed or flush; the wrong one can sit loose. "Modular" cables with swappable plugs work with both 3.5 and 4.4.</p>
<h2>Common mistakes</h2>
<ul>
<li>"Expensive cables change the sound a lot": in blind tests, correctly built cables are practically indistinguishable. What cables really change is durability, feel and which plug you get</li>
</ul>`,
    },
  },
  {
    id: "eartips",
    tool: null,
    related: ["frequency-response", "hearing", "connectors"],
    refs: [],
    th: {
      title: "จุกหูฟัง (Eartips) และการใส่ให้แน่น",
      short: "จุกที่ไม่แน่นทำเบสหายได้มากกว่าการเปลี่ยนแอมป์",
      body: `<h2>คืออะไร</h2>
<p>จุกคือส่วนที่ปิดรูหู ทำจากซิลิโคน โฟม หรือวัสดุผสม มีหลายขนาดและรูปทรง เช่น ทรงตื้น ทรงลึก รูกว้าง รูแคบ</p>
<h2>ในชุดของคุณ</h2>
<ul>
<li><b>ซีลไม่แน่น</b> = เบสหายได้ 10 dB ขึ้นไป และต้องเปิดดังขึ้นเพื่อชดเชย ซึ่งไม่ดีต่อหู</li>
<li>รูจุกกว้างมักทำให้แหลมชัดขึ้น รูแคบหรือโฟมมักนุ่มลง</li>
<li>หูซ้ายขวาอาจต้องใช้คนละขนาด ลองทุกขนาดที่แถมมาก่อนซื้อจุกเพิ่ม</li>
</ul>
<h2>เข้าใจผิดบ่อย</h2>
<ul>
<li>"IEM ตัวนี้เบสบาง" — บ่อยครั้งเกิดจากใส่ไม่แน่น ลองกดเบาๆ ด้วยนิ้วแล้วฟังว่าเบสเพิ่มไหม ถ้าเพิ่ม แปลว่าซีลยังไม่ดี</li>
</ul>`,
    },
    en: {
      title: "Eartips and seal",
      short: "A poor seal loses more bass than any amp change",
      body: `<h2>What it is</h2>
<p>Tips seal the ear canal. They come in silicone, foam and hybrids, in many sizes and shapes: shallow or deep, wide or narrow bore.</p>
<h2>In your chain</h2>
<ul>
<li><b>A poor seal</b> can lose 10 dB+ of bass and makes you turn the volume up to compensate, which is bad for hearing</li>
<li>Wide bores usually brighten the treble; narrow bores and foam usually soften it</li>
<li>Left and right ears may need different sizes; try every included size before buying more</li>
</ul>
<h2>Common mistakes</h2>
<ul>
<li>"This IEM is bass-light": often it's the seal. Press gently with a finger; if bass jumps, the seal isn't right</li>
</ul>`,
    },
  },
  {
    id: "burn-in",
    tool: null,
    related: ["frequency-response", "measurements"],
    refs: [W("Break-in_(mechanical_run-in)")],
    th: {
      title: "เบิร์นอิน (Burn-in)",
      short: "การวัดส่วนใหญ่พบการเปลี่ยนแปลงน้อยมาก สิ่งที่เปลี่ยนชัดคือหูและสมองที่ชินขึ้น",
      body: `<h2>คืออะไร</h2>
<p>ความเชื่อว่าหูฟังใหม่ต้อง "เบิร์น" เล่นทิ้งไว้หลายสิบชั่วโมงก่อน เสียงจึงจะดีขึ้น</p>
<h2>ข้อมูลที่มี</h2>
<p>การวัดก่อนและหลังเบิร์นที่เผยแพร่ส่วนใหญ่พบการเปลี่ยนแปลงเล็กมาก (มักต่ำกว่า 1 dB และส่วนใหญ่เกิดในช่วงแรกๆ) ส่วนที่เปลี่ยนชัดกว่าคือ<b>การปรับตัวของหูและสมอง</b> และการใส่ที่เข้าที่ขึ้น (จุก, ฟองน้ำครอบหูที่ยุบตัว)</p>
<h2>ใช้ยังไง</h2>
<ul>
<li>ถ้าฟังแล้วไม่ชอบเลย อย่ารอเบิร์นจนเลยกำหนดคืนสินค้า</li>
<li>ฟองน้ำครอบหูที่ยุบตัวลงทำให้เสียงเปลี่ยนได้จริง เพราะระยะจากไดรเวอร์ถึงหูเปลี่ยน</li>
</ul>`,
    },
    en: {
      title: "Burn-in",
      short: "Most measurements show very small changes; what changes clearly is your ear and brain adapting",
      body: `<h2>What it is</h2>
<p>The belief that new headphones must be played for tens of hours before they sound right.</p>
<h2>What the evidence shows</h2>
<p>Most published before/after measurements show very small changes (often under 1 dB, mostly early on). What changes more clearly is <b>your ear and brain adapting</b>, and fit settling (tips, ear pads compressing).</p>
<h2>How to use this</h2>
<ul>
<li>If you dislike them, don't wait out the return window hoping burn-in fixes it</li>
<li>Pads that compress over time really do change the sound, because the driver-to-ear distance changes</li>
</ul>`,
    },
  },
  {
    id: "bluetooth",
    tool: null,
    related: ["dac-amp"],
    refs: [W("LDAC_(codec)"), W("Advanced_Audio_Coding")],
    th: {
      title: "Bluetooth codec: SBC, AAC, aptX, LDAC",
      short: "codec ที่ใช้จริงคือตัวที่ทั้งมือถือและหูฟังรองรับร่วมกัน",
      body: `<h2>คืออะไร</h2>
<p>Bluetooth ต้องบีบอัดเสียงก่อนส่ง codec คือวิธีบีบอัด: SBC (พื้นฐาน), AAC (iPhone ใช้), aptX/aptX Adaptive (Qualcomm), LDAC (Sony, สูงสุด 990 kbps)</p>
<h2>ในชุดของคุณ</h2>
<ul>
<li>iPhone ส่งได้แค่ SBC/AAC ซื้อหูฟัง LDAC มาใช้กับ iPhone จะไม่ได้ LDAC</li>
<li>LDAC 990 kbps ต้องใช้สัญญาณดีมาก ในที่คนเยอะมักตกไป 330–660 kbps หรือกระตุก</li>
<li>ตัวรับ Bluetooth ที่มี DAC ในตัว (เช่น FiiO ซีรีส์ BTR) เป็นทางเลือกถ้าอยากใช้หูฟังมีสายแบบไร้สาย</li>
</ul>
<h2>เข้าใจผิดบ่อย</h2>
<ul>
<li>"LDAC = Hi-Res เท่าสาย" — ยังเป็นการบีบอัดแบบสูญเสียข้อมูล และในชีวิตจริงมักไม่ได้บิตเรตสูงสุด</li>
</ul>`,
    },
    en: {
      title: "Bluetooth codecs: SBC, AAC, aptX, LDAC",
      short: "The codec you get is the one both phone and headphone support",
      body: `<h2>What it is</h2>
<p>Bluetooth compresses audio before sending it. Codecs: SBC (baseline), AAC (what iPhones use), aptX/aptX Adaptive (Qualcomm), LDAC (Sony, up to 990 kbps).</p>
<h2>In your chain</h2>
<ul>
<li>iPhones only send SBC/AAC; an LDAC headphone on an iPhone won't use LDAC</li>
<li>LDAC at 990 kbps needs a very clean connection; in crowded places it often drops to 330–660 kbps or stutters</li>
<li>A Bluetooth receiver/DAC (e.g. FiiO BTR series) makes a wired headphone wireless</li>
</ul>
<h2>Common mistakes</h2>
<ul>
<li>"LDAC = wired hi-res": it's still lossy, and in daily use rarely runs at its top bitrate</li>
</ul>`,
    },
  },
  {
    id: "marketplace-prices",
    tool: null,
    related: [],
    refs: [],
    th: {
      title: "ราคาบน Shopee / Lazada / Taobao ทำงานยังไง",
      short: "ราคาที่จ่ายจริงขึ้นกับโค้ดที่คุณถือ ของในตะกร้า เวลา และช่องทางจ่าย ไม่มี \"ราคาเดียว\"",
      body: `<h2>Shopee / Lazada: โค้ดซ้อนกัน</h2>
<p>ตัวอย่างจากหน้าชำระเงินจริง (12 ต.ค. 2026): ราคาในตะกร้า ฿16,490 → โค้ดร้าน 20% (−฿3,298) ลดก่อน → โค้ด Shopee 30% ลดสูงสุด ฿4,000 ขั้นต่ำ ฿7,915 ซึ่งเช็คขั้นต่ำจากยอด<b>หลัง</b>โค้ดร้าน (−฿3,958) → จ่าย ฿9,234</p>
<ul>
<li><b>โค้ดแพลตฟอร์มใช้ได้ใบเดียวต่อคำสั่งซื้อ</b> แอปเลือกใบที่ "แนะนำ" ให้ตามของที่ติ๊กในตะกร้า ติ๊กของชิ้นอื่นแล้วโค้ดที่ดีที่สุดก็เปลี่ยน</li>
<li><b>โค้ดเป็นของเฉพาะคนและหมดเร็ว</b> มีโค้ด VIP โค้ดลูกค้าใหม่ โค้ดบัตรเครดิต บางใบใช้ได้แค่ 1 ชั่วโมงหลังเก็บ ราคาที่คนอื่นเห็นจึงไม่ใช่ราคาของคุณ</li>
<li><b>ไม่ใช่ทุกสินค้าใช้โค้ดได้</b> สินค้าใหม่หรือของหายากที่แบรนด์กำหนดอาจถูกยกเว้น</li>
<li>ร้านบางร้านแจ้งว่าค่าธรรมเนียมแพลตฟอร์มขึ้นมากในปี 2026 จึงตั้งราคาบนแพลตฟอร์มสูงกว่าเว็บหรือหน้าร้านของตัวเอง (เช่นประกาศของ HolySai บน Facebook 31 ก.ค. 2026) ลองเทียบกับเว็บร้านด้วย</li>
</ul>
<p>คิดเองได้ที่ <a href="#deal">คิดราคาจริง</a>: ใส่ราคาที่เห็นกับโค้ดที่มี แล้วดูว่าคู่ไหนคุ้มสุด</p>
<h2>Taobao ส่งไทย: ราคาหน้าสินค้าไม่ใช่ยอดตอนจ่าย</h2>
<ul>
<li>หน้าสินค้าบอก "券后约฿…" (ประมาณหลังคูปอง) แต่หน้าชำระเงินสูงกว่านั้น ในสองตัวอย่างที่เราเห็นสูงกว่าราว 9.1% ส่วนหนึ่งคือ <b>ภาษี 7%</b>: หน้าข้อมูลขนส่งของ Taobao (12 ต.ค. 2026) บอกว่าของเข้าไทยต้องเสีย VAT 7% และอากร 10% ขึ้นไป แต่ถ้าใช้ขนส่งทางการของ Taobao ผู้ซื้อจ่าย 7% ของมูลค่าสินค้า ส่วนต่างแพลตฟอร์มจ่ายให้</li>
<li>ขนส่ง: ส่งตรงทางบก (直邮) ฟรีเมื่อครบ ¥99 ราว 13–15 วัน หรือรวมกล่อง (集运) คิดตามน้ำหนัก (กรุงเทพฯ ¥15 กิโลแรก ¥14.5 กิโลต่อไป) ใช้น้ำหนักจริงหรือ กว้าง×ยาว×สูง/6000 แล้วแต่อันไหนมาก</li>
<li>ช่องทางจ่ายก็มีผล: ในตัวอย่างของเรา เปลี่ยนเป็น PromptPay ลดอีกราว 1%</li>
<li><b>ตั้งแอปเป็นภาษาจีน</b> โหมดภาษาอังกฤษซ่อนสินค้าบางชิ้น ("unavailable in the English interface") และบางชิ้นอยู่ในตะกร้าแต่จ่ายไม่ได้ ("Switch to Chinese version to checkout")</li>
<li>ยอดที่ถูกต้องที่สุดคือยอดในหน้าชำระเงิน ไม่ใช่ราคาหน้าสินค้า สินค้าที่มีหลายตัวเลือกจะขึ้นเป็นช่วง เช่น "券后约฿8,028–10,484"</li>
</ul>
<h2>ถูกกว่าเสมอไหม</h2>
<p>ไม่เสมอ ในวันเดียวกัน Moondrop DUSK บน Shopee ไทยหลังโค้ดอยู่ที่ ฿18,490 ส่วน Taobao ส่งไทยรวมภาษีอยู่ราว ฿13,956 แต่ Taobao ใช้เวลาส่งนานกว่าและประกันอาจไม่ใช่ศูนย์ไทย ราคาต้องดูคู่กับเวลารอและการรับประกัน</p>
<p class="small muted">ตัวเลขทั้งหมดมาจากหน้าจอแอปที่ผู้ใช้บันทึกไว้วันที่ 12 ต.ค. 2026 โค้ดและอัตราเปลี่ยนตลอด ใช้เป็นตัวอย่างวิธีคิด ไม่ใช่ราคาปัจจุบัน</p>`,
    },
    en: {
      title: "How Shopee / Lazada / Taobao prices work",
      short: "What you pay depends on your codes, your cart, the time and how you pay; there is no single price",
      body: `<h2>Shopee / Lazada: stacked codes</h2>
<p>From a real checkout (12 Oct 2026): cart price ฿16,490 → shop code 20% (−฿3,298) applies first → Shopee code 30%, capped at ฿4,000, minimum spend ฿7,915, checked on the price <b>after</b> the shop code (−฿3,958) → pay ฿9,234.</p>
<ul>
<li><b>One platform code per order.</b> The app picks a "recommended" code for whatever is ticked in the cart; tick another item and the best code changes.</li>
<li><b>Codes are personal and short-lived.</b> VIP codes, new-user codes, card codes; some last one hour after you collect them. The price someone else sees is not yours.</li>
<li><b>Not everything takes codes.</b> New or rare items set by the brand can be excluded.</li>
<li>Some shops say platform fees rose sharply in 2026, so their marketplace prices sit above their own website or store (e.g. HolySai's Facebook notice of 31 Jul 2026). Check the shop's own site too.</li>
</ul>
<p>Work it out with <a href="#deal">Real price</a>: enter the price you see and the codes you hold to see which pair wins.</p>
<h2>Taobao to Thailand: the product page isn't the checkout total</h2>
<ul>
<li>The product page shows "券后约฿…" (about this much after coupons); checkout came out higher, by about 9.1% in the two cases we saw. Part of that is <b>7% tax</b>: Taobao's own shipping page (12 Oct 2026) says imports into Thailand owe 7% VAT plus duty from 10%, and with Taobao's official logistics the buyer pays 7% of the goods' value while the platform covers the rest.</li>
<li>Shipping: direct by land (直邮) is free over ¥99, about 13–15 days; consolidated (集运) is charged by weight (Bangkok ¥15 for the first kg, ¥14.5 per extra kg), using the larger of actual weight and L×W×H/6000.</li>
<li>Payment method matters: in our example, paying by PromptPay took about 1% more off.</li>
<li><b>Use the app in Chinese.</b> The English interface hides some items ("unavailable in the English interface") and leaves others in the cart that won't check out ("Switch to Chinese version to checkout").</li>
<li>The checkout total is the number to trust, not the product page. Items with several options show a range, e.g. "券后约฿8,028–10,484".</li>
</ul>
<h2>Is it always cheaper?</h2>
<p>No. On the same day the Moondrop DUSK was ฿18,490 after codes on Shopee Thailand and about ฿13,956 from Taobao delivered with tax, but Taobao takes longer and the warranty may not be Thai. Weigh price against waiting time and warranty.</p>
<p class="small muted">All figures come from app screens a user recorded on 12 Oct 2026. Codes and rates change constantly: read them as a worked example, not current prices.</p>`,
    },
  },
  {
    id: "dc-protection",
    tool: null,
    related: ["balanced", "dac-amp"],
    refs: [W("DC_offset")],
    th: {
      title: "DC protection และ DC offset",
      short: "วงจรตัดไฟกระแสตรงไม่ให้ไหลเข้าหูฟังเมื่อแอมป์เสีย",
      body: `<h2>คืออะไร</h2>
<p>สัญญาณเสียงควรเป็นไฟสลับรอบศูนย์ ถ้าแอมป์เสียแล้วปล่อย<b>ไฟกระแสตรง (DC)</b> ออกมา ไดรเวอร์จะถูกดันค้างไว้และอาจไหม้ แอมป์หลายรุ่นจึงมีวงจรตัด (relay) เมื่อพบ DC</p>
<h2>ในชุดของคุณ</h2>
<ul>
<li>DC offset ปกติไม่กี่มิลลิโวลต์ไม่เป็นอันตราย</li>
<li>ถ้าได้ยินเสียง "ป๊อก" ดังตอนเปิดปิด หรือมีรายงานว่าระบบป้องกันไม่ทำงาน ให้ถอดหูฟังก่อนเปิดปิดเครื่อง</li>
<li>เรื่องแบบนี้สเปกไม่บอก มักรู้จากผู้ใช้ เช่นกรณี Topping DX5 II ที่มีผู้ใช้รายงานปัญหา ดูส่วน "จากผู้ใช้" ในหน้าสินค้า</li>
</ul>`,
    },
    en: {
      title: "DC protection and DC offset",
      short: "A circuit that stops direct current reaching your headphones if an amp fails",
      body: `<h2>What it is</h2>
<p>Audio should swing around zero volts. If an amp fails and outputs <b>direct current (DC)</b>, the driver is pushed and held and can burn out. Many amps have a relay that disconnects the output when DC appears.</p>
<h2>In your chain</h2>
<ul>
<li>A normal DC offset of a few millivolts is harmless</li>
<li>If you hear a loud pop at power on/off, or there are reports the protection doesn't work, unplug headphones before switching the device</li>
<li>Specs don't tell you this; users do, e.g. the reported Topping DX5 II issues. See "From users" on product pages</li>
</ul>`,
    },
  },
  {
    id: "phono",
    tool: null,
    related: ["power"],
    refs: [W("Phono_input"), W("RIAA_equalization"), W("Magnetic_cartridge")],
    th: {
      title: "Phono stage, หัวเข็ม MM / MC",
      short: "สัญญาณจากหัวเข็มเบาแค่มิลลิโวลต์และยังไม่ได้แก้ RIAA ต้องผ่าน phono stage ก่อนเข้าแอมป์",
      body: `<h2>คืออะไร</h2>
<p>หัวเข็มส่งสัญญาณเบามาก และแผ่นเสียงถูกตัดเสียงทุ้มลดลง/เสียงแหลมเพิ่มขึ้นตามมาตรฐาน <b>RIAA</b> ตอนผลิต <b>phono stage</b> (ปรีโฟโน) ทำสองอย่าง: ขยายสัญญาณขึ้นเป็นระดับ line และกลับ curve RIAA ให้เสียงสมดุล</p>
<ul>
<li><b>MM (moving magnet)</b> ราว 2–5 mV ใช้กับ phono stage ทั่วไป (ขยายราว 35–40 dB, โหลดมาตรฐาน 47 kΩ)</li>
<li><b>MC (moving coil)</b> ราว 0.2–0.6 mV เบากว่าราว 10 เท่า ต้องใช้ phono stage ที่รับ MC (ขยายราว 55–65 dB) หรือใส่ <b>step-up transformer (SUT)</b> หน้า phono stage แบบ MM</li>
<li><b>MC เอาต์พุตสูง</b> ราว 2 mV ใช้กับช่อง MM ได้</li>
</ul>
<h2>ในชุดของคุณ</h2>
<p>เครื่องเล่นแผ่นเสียง → phono stage → แอมป์หูฟัง → หูฟัง ถ้าเครื่องเล่นมี phono stage ในตัว (สวิตช์ PHONO/LINE) ตั้งเป็น LINE แล้วต่อเข้าแอมป์ได้เลย แอมป์หรืออินทิเกรตบางรุ่นมีช่อง PHONO ในตัว</p>
<h2>เข้าใจผิดบ่อย</h2>
<ul>
<li>ต่อเครื่องเล่นเข้าช่อง AUX ตรงๆ: เสียงเบามากและไม่มีเบส เพราะยังไม่ผ่าน RIAA</li>
<li>ต่อช่อง LINE ของเครื่องเล่นที่มีปรีในตัวเข้าช่อง PHONO อีกที: ขยายซ้ำสองชั้น เสียงแตก</li>
<li>เสียงฮัม: ต่อสายกราวด์ของเครื่องเล่นเข้าขั้ว GND ของ phono stage</li>
</ul>`,
    },
    en: {
      title: "Phono stage, MM / MC cartridges",
      short: "A cartridge gives millivolts with the RIAA curve still on it: it needs a phono stage before the amp",
      body: `<h2>What it is</h2>
<p>A cartridge's signal is tiny, and records are cut with the bass reduced and the treble raised (the <b>RIAA</b> curve). A <b>phono stage</b> does two things: amplifies the signal to line level and undoes the RIAA curve.</p>
<ul>
<li><b>MM (moving magnet)</b>: about 2–5 mV. Works with any phono stage (about 35–40 dB of gain, standard 47 kΩ load).</li>
<li><b>MC (moving coil)</b>: about 0.2–0.6 mV, roughly a tenth. Needs an MC-capable phono stage (about 55–65 dB of gain) or a <b>step-up transformer (SUT)</b> in front of an MM stage.</li>
<li><b>High-output MC</b>: about 2 mV, works on an MM input.</li>
</ul>
<h2>In your chain</h2>
<p>Turntable → phono stage → headphone amp → headphones. A turntable with a built-in phono stage (a PHONO/LINE switch) set to LINE goes straight into the amp. Some amps and integrated amps have a PHONO input built in.</p>
<h2>Common misunderstandings</h2>
<ul>
<li>Turntable straight into AUX: very quiet and thin, because the RIAA curve was never undone.</li>
<li>A turntable's LINE output into a PHONO input: amplified twice, it distorts.</li>
<li>Hum: connect the turntable's ground wire to the phono stage's GND post.</li>
</ul>`,
    },
  },
  {
    id: "uac1",
    tool: null,
    related: ["nos"],
    refs: [W("USB_Audio")],
    th: {
      title: "UAC 1.0 / UAC 2.0 (USB Audio Class)",
      short: "มาตรฐานเสียงผ่าน USB: UAC1 เสียบที่ไหนก็ติด แต่ความละเอียดจำกัด UAC2 ได้ความละเอียดสูงกว่า แต่บางอุปกรณ์ไม่รองรับ",
      body: `<h2>คืออะไร</h2>
<p>DAC แบบ USB คุยกับคอมหรือมือถือด้วยมาตรฐาน USB Audio Class มีสองรุ่นที่เจอบ่อย</p>
<ul>
<li><b>UAC 1.0</b> ใช้ USB ความเร็ว full-speed ปกติได้ถึงราว 24-bit/96 kHz ไม่ต้องลงไดรเวอร์ ใช้กับเครื่องเก่าหรือเครื่องเกมได้กว้างกว่า</li>
<li><b>UAC 2.0</b> ใช้ USB high-speed ได้ sample rate สูงกว่าและ DSD Windows 10 (ตั้งแต่เวอร์ชัน 1703), macOS, iOS และ Android รองรับในตัว Windows ที่เก่ากว่านั้นต้องลงไดรเวอร์ของแบรนด์</li>
</ul>
<h2>ในชุดของคุณ</h2>
<p>ถ้าเสียบแล้วเครื่องไม่เห็น DAC โดยเฉพาะ<b>เครื่องเกมคอนโซล</b>หรือคอมเก่า ให้ลองสลับเป็นโหมด UAC 1.0 (บางรุ่นมีสวิตช์หลังเครื่อง บางรุ่นตั้งในเมนู) ส่วนการฟังเพลงปกติที่ 44.1/48 kHz ทั้งสองโหมดส่งข้อมูลเสียงครบเท่ากัน</p>
<h2>เข้าใจผิดบ่อย</h2>
<ul><li>"UAC2 เสียงดีกว่า": สำหรับไฟล์ 44.1/48 kHz ข้อมูลที่ส่งเหมือนกัน ต่างกันแค่ความเข้ากันได้และ sample rate สูงสุด</li></ul>`,
    },
    en: {
      title: "UAC 1.0 / UAC 2.0 (USB Audio Class)",
      short: "The USB audio standard: UAC1 works almost anywhere at limited resolution; UAC2 goes higher but not every host supports it",
      body: `<h2>What it is</h2>
<p>A USB DAC talks to a computer or phone using the USB Audio Class standard. Two versions are common:</p>
<ul>
<li><b>UAC 1.0</b> runs over full-speed USB, typically up to about 24-bit/96 kHz. It needs no driver and works with more older devices and game consoles.</li>
<li><b>UAC 2.0</b> runs over high-speed USB for higher sample rates and DSD. Windows 10 (version 1703 on), macOS, iOS and Android support it built in; older Windows needs the brand's driver.</li>
</ul>
<h2>In your chain</h2>
<p>If the DAC isn't detected, especially on a <b>game console</b> or an old computer, try UAC 1.0 mode (a rear switch on some models, a menu setting on others). For normal 44.1/48 kHz music both modes carry the same data.</p>
<h2>Common misunderstandings</h2>
<ul><li>"UAC2 sounds better": for 44.1/48 kHz files the data sent is identical; the difference is compatibility and maximum sample rate.</li></ul>`,
    },
  },
  {
    id: "nos",
    tool: null,
    related: ["uac1"],
    refs: [W("Oversampling"), W("Zero-order_hold")],
    th: {
      title: "NOS / OS (ไม่ใช้ / ใช้ oversampling)",
      short: "สวิตช์บน DAC บางรุ่น (มักเป็น R2R) เลือกว่าจะใช้ฟิลเตอร์ดิจิทัลหรือไม่ มีผลกับช่วงเสียงสูงสุด",
      body: `<h2>คืออะไร</h2>
<ul>
<li><b>OS (oversampling)</b>: DAC เพิ่ม sample rate และใช้ฟิลเตอร์ดิจิทัลกรองสัญญาณสะท้อนเหนือ 20 kHz ผลคือการตอบสนองเรียบไปจนสุดย่านที่หูได้ยิน</li>
<li><b>NOS (non-oversampling)</b>: ไม่ใช้ฟิลเตอร์นี้ ผลที่วัดได้คือเสียงสูงตกลงเล็กน้อยใกล้ 20 kHz (ราว 3 dB สำหรับไฟล์ 44.1 kHz) และมีสัญญาณส่วนเกินเหนือย่านที่หูได้ยิน</li>
</ul>
<h2>ในชุดของคุณ</h2>
<p>ตามการวัด OS แม่นกว่า แต่บางคนชอบเสียงแบบ NOS ทั้งสองโหมดไม่ทำให้อุปกรณ์เสีย ลองสลับฟังเองได้ ก่อนเทียบควรปรับความดังให้เท่ากัน เพราะเสียงที่ดังกว่านิดเดียวมักฟังดูดีกว่า</p>`,
    },
    en: {
      title: "NOS / OS (non-oversampling / oversampling)",
      short: "A switch on some DACs (often R2R) that turns the digital filter on or off, changing the top octave",
      body: `<h2>What it is</h2>
<ul>
<li><b>OS (oversampling)</b>: the DAC raises the sample rate and uses a digital filter to remove images above 20 kHz. Response stays flat to the top of the audible band.</li>
<li><b>NOS (non-oversampling)</b>: no such filter. Measurably, treble rolls off slightly near 20 kHz (about 3 dB for 44.1 kHz files) and ultrasonic images remain.</li>
</ul>
<h2>In your chain</h2>
<p>By measurement OS is more accurate, but some people prefer NOS. Neither mode harms anything, so try both. Match the volume before comparing: slightly louder usually sounds better.</p>`,
    },
  },
  {
    id: "wasapi",
    tool: null,
    related: ["uac1", "streaming"],
    refs: [W("Windows_Audio_Session_API"), W("Audio_Stream_Input/Output")],
    th: {
      title: "WASAPI / ASIO (ส่งเสียงออกจาก Windows)",
      short: "วิธีที่โปรแกรมเล่นเพลงบน Windows ส่งเสียงไป DAC: แบบ shared ผ่านตัวผสมเสียงของ Windows หรือแบบ exclusive/ASIO ส่งตรง",
      body: `<h2>คืออะไร</h2>
<ul>
<li><b>WASAPI shared</b> (ค่าปกติ): ทุกโปรแกรมใช้ DAC ร่วมกัน Windows ผสมเสียงและแปลง sample rate ให้ตรงกับที่ตั้งไว้ในแผง Sound</li>
<li><b>WASAPI exclusive</b>: โปรแกรมเล่นเพลงยึด DAC ไว้คนเดียว ส่งไฟล์ที่ sample rate เดิมไปตรงๆ ไม่ผ่านตัวผสม เสียงแจ้งเตือนจากโปรแกรมอื่นจะไม่ดังระหว่างนั้น</li>
<li><b>ASIO</b>: ช่องทางส่งตรงอีกแบบที่ใช้กันในงานสตูดิโอ ต้องมีไดรเวอร์ ASIO ของแบรนด์ DAC (มักมากับไดรเวอร์ UAC2)</li>
</ul>
<h2>ในชุดของคุณ</h2>
<p>ถ้าอยากให้ไฟ sample rate บน DAC แสดงตรงกับไฟล์ หรือจะเล่น DSD ให้เลือก WASAPI exclusive หรือ ASIO ในโปรแกรมเล่นเพลง (foobar2000, MusicBee, Roon ฯลฯ) ถ้าฟังเพลงทั่วไปที่ 44.1/48 kHz และตั้ง Windows ไว้ตรงกัน แบบ shared ก็ไม่ได้ทำให้ข้อมูลเสียงหายไปมาก ข้อดีของ exclusive คือไม่มีการแปลงและไม่มีเสียงอื่นปน</p>
<h2>เข้าใจผิดบ่อย</h2>
<ul><li>"exclusive ทำให้เสียงดีขึ้นเสมอ": ถ้า sample rate ตรงกันอยู่แล้วและไม่ได้ปรับเสียงใน Windows ผลแทบไม่ต่าง ความต่างจะชัดเมื่อ Windows ต้องแปลง sample rate</li></ul>`,
    },
    en: {
      title: "WASAPI / ASIO (audio output on Windows)",
      short: "How a Windows music player sends audio to the DAC: shared through the Windows mixer, or exclusive/ASIO straight through",
      body: `<h2>What it is</h2>
<ul>
<li><b>WASAPI shared</b> (the default): every app shares the DAC; Windows mixes them and converts to the sample rate set in Sound settings.</li>
<li><b>WASAPI exclusive</b>: the music player takes the DAC for itself and sends the file at its own sample rate, bypassing the mixer. Other apps' sounds won't play meanwhile.</li>
<li><b>ASIO</b>: another direct path, common in studios. It needs the DAC brand's ASIO driver (often bundled with its UAC2 driver).</li>
</ul>
<h2>In your chain</h2>
<p>To have the DAC follow each file's sample rate, or to play DSD, choose WASAPI exclusive or ASIO in your player (foobar2000, MusicBee, Roon and so on). For ordinary 44.1/48 kHz music with Windows set to match, shared mode loses little; exclusive avoids conversion and other sounds mixing in.</p>
<h2>Common misunderstandings</h2>
<ul><li>"Exclusive always sounds better": if the sample rate already matches and Windows applies no processing, the difference is negligible. It matters when Windows would otherwise convert the sample rate.</li></ul>`,
    },
  },
  {
    id: "streaming",
    tool: null,
    related: ["wasapi"],
    refs: [W("Roon_(software)"), W("AirPlay"), W("Universal_Plug_and_Play"), W("Chromecast")],
    th: {
      title: "Roon Ready, AirPlay, Spotify/Tidal Connect, UPnP",
      short: "วิธีส่งเพลงผ่านเครือข่ายไปเครื่องสตรีม/DAC ที่มีช่อง LAN หรือ Wi-Fi โดยไม่ต้องเสียบสายจากคอม",
      body: `<h2>คืออะไร</h2>
<p>เครื่องที่มีช่อง LAN หรือ Wi-Fi รับเพลงจากแอปผ่านเครือข่ายได้ แต่ละแอปใช้มาตรฐานของตัวเอง ถ้าเครื่องไม่รองรับมาตรฐานของแอปที่คุณใช้ ก็ต้องกลับไปต่อผ่านคอมหรือมือถือ</p>
<ul>
<li><b>Roon Ready</b>: ใช้กับโปรแกรม Roon (เสียค่าสมาชิก) ต้องมีเครื่องหลัก (Roon Server) เปิดทิ้งไว้ในบ้าน</li>
<li><b>AirPlay</b>: ส่งจาก iPhone, iPad, Mac</li>
<li><b>Spotify Connect / Tidal Connect</b>: กดเลือกเครื่องในแอปนั้นได้เลย มือถือเป็นแค่รีโมต</li>
<li><b>UPnP/DLNA</b>: มาตรฐานเปิด ใช้กับแอปอย่าง BubbleUPnP, mconnect หรือเล่นไฟล์จาก NAS</li>
<li><b>Chromecast (Google Cast)</b>: ส่งจากแอปบน Android และ Chrome</li>
</ul>
<h2>ในชุดของคุณ</h2>
<p>ดูว่าแอปที่คุณใช้ทุกวันรองรับมาตรฐานไหน แล้วเลือกเครื่องที่รองรับมาตรฐานนั้น บางยี่ห้อเพิ่มให้ภายหลังด้วยเฟิร์มแวร์ ควรเช็กกับเว็บแบรนด์ด้วย</p>`,
    },
    en: {
      title: "Roon Ready, AirPlay, Spotify/Tidal Connect, UPnP",
      short: "Ways to send music over the network to a streamer or DAC with LAN or Wi-Fi, without a cable from a computer",
      body: `<h2>What it is</h2>
<p>A box with LAN or Wi-Fi can receive music from apps over the network, but each app speaks its own protocol. If the box doesn't support the one your app uses, you're back to a cable from a computer or phone.</p>
<ul>
<li><b>Roon Ready</b>: for Roon (paid subscription); needs a Roon Server running somewhere at home.</li>
<li><b>AirPlay</b>: from iPhone, iPad and Mac.</li>
<li><b>Spotify Connect / Tidal Connect</b>: pick the device inside that app; the phone is only a remote.</li>
<li><b>UPnP/DLNA</b>: an open standard, used by apps like BubbleUPnP or mconnect, or to play files from a NAS.</li>
<li><b>Chromecast (Google Cast)</b>: from Android apps and Chrome.</li>
</ul>
<h2>In your chain</h2>
<p>Check which protocol the app you use every day speaks, and pick a box that supports it. Some brands add protocols later by firmware, so check the brand's site too.</p>`,
    },
  },
];

export const TERM = new Map(TERMS.map((t) => [t.id, t]));
