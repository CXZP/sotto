// Terms, privacy notice (PDPA) and contact / takedown page.
// Plain language. This is a student open-source project, not legal advice;
// a lawyer should review before any commercial launch.

import { REPO } from "./content.js?v=mv5aiq0l";

export const LEGAL_UPDATED = "2026-10-11";
const issue = (template, title) => `${REPO}/issues/new?template=${template}&title=${encodeURIComponent(title)}`;

export const LEGAL = {
  terms: {
    th: `
<h1>ข้อตกลงการใช้งาน</h1>
<p class="muted">อัปเดต ${LEGAL_UPDATED}</p>
<h2>Sotto คืออะไร</h2>
<p>Sotto เป็นโปรเจกต์ open source ของนักศึกษา (วิชา GEN354 มจธ.) ช่วยเช็กว่าหูฟังกับแหล่งเสียงเข้ากันไหม แสดงสเปกพร้อมที่มา ราคาจากร้าน และพื้นที่ให้ผู้ใช้แลกเปลี่ยน ใช้ฟรี ไม่มีโฆษณา</p>
<h2>ข้อมูลและผลคำนวณ</h2>
<ul>
<li>สเปกและราคามาจากฟีดสาธารณะของร้าน และข้อมูลที่ตรวจด้วยมือ ทุกค่ามีลิงก์ที่มา แต่อาจผิด ล้าสมัย หรือร้านแก้ไขภายหลัง</li>
<li>ผลคำนวณเป็นการประมาณจากตัวเลขที่ผู้ผลิตบอก ไม่ใช่การรับประกัน ก่อนซื้อให้ตรวจกับร้านหรือผู้ผลิตอีกครั้ง</li>
<li>เราให้บริการ "ตามสภาพ" ไม่รับผิดชอบความเสียหายจากการใช้ข้อมูล รวมถึงอุปกรณ์เสียหรือการได้ยินเสียหาย เปิดเสียงเบาก่อนเสมอ</li>
</ul>
<h2>สิ่งที่คุณโพสต์</h2>
<ul>
<li>คุณเป็นเจ้าของสิ่งที่โพสต์ และอนุญาตให้ Sotto แสดง จัดเก็บ และเผยแพร่ภายใต้ <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noopener">CC BY-SA 4.0</a> เหมือนข้อมูลส่วนอื่นของเว็บ</li>
<li>โพสต์ได้เฉพาะสิ่งที่คุณมีสิทธิ์ อย่าคัดลอกรีวิว บทความ หรือรูปของคนอื่นมาโพสต์ ให้ใส่ลิงก์แทน</li>
<li>รายงานปัญหาของสินค้าต้องมาจากประสบการณ์จริงและมีหลักฐาน ไม่กล่าวหาเกินจริง (กฎหมายหมิ่นประมาทของไทยมีโทษทางอาญา)</li>
<li>ห้าม: สแปม โฆษณาแฝงโดยไม่บอก ข้อมูลส่วนตัวของคนอื่น เนื้อหาผิดกฎหมาย คุกคาม หรือเกลียดชัง</li>
<li>ถ้าได้ของฟรีหรือได้ค่าตอบแทนจากแบรนด์ ต้องบอกทุกครั้ง</li>
</ul>
<h2>การดูแลชุมชน</h2>
<p>ทีมงานซ่อนหรือลบโพสต์ที่ผิดข้อตกลง และระงับบัญชีที่ทำผิดซ้ำได้ ใครก็กด "แจ้งไม่เหมาะสม" ได้ ถ้าคิดว่าเราตัดสินผิด ติดต่อผ่าน<a href="#contact">หน้าติดต่อ</a></p>
<h2>การแจ้งให้ลบ (notice and takedown)</h2>
<ol>
<li>ใครก็แจ้งได้ 2 ทาง: กด "แจ้งไม่เหมาะสม" ที่โพสต์ หรือยื่นคำขอใน<a href="#contact">หน้าติดต่อ</a> (แบรนด์หรือร้าน: ขอแก้หรือขอลบ) บอกลิงก์โพสต์และเหตุผล ถ้ามีหลักฐานว่าข้อมูลผิด แนบมาด้วย</li>
<li>โพสต์ที่ถูกแจ้งจาก 3 บัญชีขึ้นไปจะถูกซ่อนอัตโนมัติระหว่างที่ทีมงานตรวจ</li>
<li>ทีมงานตรวจภายใน 7 วัน ถ้าไม่มีหลักฐานรองรับ หรือเกินกว่าหลักฐาน จะลบหรือแก้ ถ้ามีหลักฐานรองรับ จะเปิดกลับพร้อมบันทึกเหตุผล และแบรนด์ตอบใต้โพสต์ได้ด้วยบัญชีที่ยืนยันแล้ว</li>
<li>เจ้าของโพสต์ได้รับแจ้งและชี้แจงได้ เราไม่เปิดเผยตัวตนผู้แจ้งโดยไม่มีเหตุตามกฎหมาย</li>
</ol>
<h2>ความเป็นอิสระ</h2>
<p>Sotto ไม่มีส่วนเกี่ยวข้องและไม่ได้รับการรับรองจากแบรนด์หรือร้านใด ลิงก์ร้านไม่มี affiliate ถ้าวันหนึ่งมี จะติดป้ายทุกลิงก์ และลำดับจะไม่เปลี่ยนตามค่าคอมมิชชัน ชื่อแบรนด์และรุ่นเป็นเครื่องหมายการค้าของเจ้าของ</p>
<h2>การเปลี่ยนแปลง</h2>
<p>ถ้าแก้ข้อตกลงนี้ เราจะเปลี่ยนวันที่ด้านบน และบันทึกประวัติการแก้ไขทั้งหมดไว้ใน <a href="${REPO}/commits/main/src/legal.js?v=mv5aiq0l" target="_blank" rel="noopener">GitHub</a></p>`,
    en: `
<h1>Terms of use</h1>
<p class="muted">Updated ${LEGAL_UPDATED}</p>
<h2>What Sotto is</h2>
<p>Sotto is an open-source student project (GEN354, KMUTT) that checks whether headphones and sources work together, shows sourced specs and store prices, and hosts a community. It is free and has no ads.</p>
<h2>Data and results</h2>
<ul>
<li>Specs and prices come from stores' public feeds and hand-checked data. Every value links to its source, but it can be wrong, outdated or changed by the store.</li>
<li>Results are estimates from manufacturers' figures, not guarantees. Check with the store or maker before buying.</li>
<li>The service is provided "as is". We aren't liable for damage from using it, including damaged equipment or hearing. Always start at low volume.</li>
</ul>
<h2>What you post</h2>
<ul>
<li>You own what you post and license it to Sotto to display, store and share under <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noopener">CC BY-SA 4.0</a>, like the rest of the site's data.</li>
<li>Only post what you have the right to. Don't copy other people's reviews, articles or photos; link to them instead.</li>
<li>Product problem reports must come from real experience, with evidence, without overstating (defamation is a criminal offence in Thailand).</li>
<li>Not allowed: spam, undisclosed advertising, other people's personal data, illegal content, harassment or hate.</li>
<li>If a brand gave you the product or paid you, say so every time.</li>
</ul>
<h2>Moderation</h2>
<p>Maintainers may hide or remove posts that break these terms and suspend repeat offenders. Anyone can press "Report post". If you think we got it wrong, use the <a href="#contact">contact page</a>.</p>
<h2>Notice and takedown</h2>
<ol>
<li>Anyone can notify us two ways: press "Report post" on the post, or file a request on the <a href="#contact">contact page</a> (brands and stores: correction or removal) with the post's link and the reason, plus any evidence the post is wrong.</li>
<li>A post reported by 3 or more accounts is hidden automatically while we review it.</li>
<li>We review within 7 days. Posts without supporting evidence, or that go beyond it, are removed or corrected. Posts the evidence supports come back with a note, and the brand can answer under it with a verified account.</li>
<li>The author is told and can respond. We don't reveal who reported unless the law requires it.</li>
</ol>
<h2>Independence</h2>
<p>Sotto is not affiliated with or endorsed by any brand or store. Store links are not affiliate links; if that ever changes, every such link will be labelled and ordering will never depend on commission. Brand and model names are trademarks of their owners.</p>
<h2>Changes</h2>
<p>If these terms change, the date above changes and the full history stays on <a href="${REPO}/commits/main/src/legal.js?v=mv5aiq0l" target="_blank" rel="noopener">GitHub</a>.</p>`,
  },
  privacy: {
    th: `
<h1>นโยบายความเป็นส่วนตัว</h1>
<p class="muted">อัปเดต ${LEGAL_UPDATED} · ตาม พ.ร.บ.คุ้มครองข้อมูลส่วนบุคคล (PDPA)</p>
<h2>ถ้าคุณแค่เข้ามาดู</h2>
<p>ไม่มีโฆษณา และไม่มีคุกกี้ติดตาม เรานับสถิติแบบไม่ระบุตัวตน: ทุกครั้งที่เปิดหน้า กดไปร้านค้า หรือเกิด error จะบันทึกชื่อหน้า รุ่นที่ดู โดเมนเว็บที่ส่งมา ภาษา และประเภทอุปกรณ์ (มือถือ/คอม) <b>ไม่เก็บ IP</b> แต่ใช้ IP + เบราว์เซอร์ + รหัสสุ่มประจำวัน มาเข้ารหัสทางเดียว เพื่อนับคนไม่ซ้ำภายในวันนั้น รหัสสุ่มถูกลบทุกวัน จึงย้อนหาตัวคนหรือตามข้ามวันไม่ได้ ผลรวมเปิดให้ทุกคนดูที่<a href="#stats">หน้าสถิติ</a> ถ้าเบราว์เซอร์ตั้ง Do Not Track หรือ GPC ไว้ เราไม่นับเลย</p>
<p>การตั้งค่า (ภาษา โหมด ธีม) กับ bookmark ตอนยังไม่ล็อกอิน เก็บไว้ในเบราว์เซอร์ของคุณเอง</p>
<p>แต่บริการเหล่านี้เห็น IP และข้อมูลเบราว์เซอร์ของคุณ เพราะเบราว์เซอร์ต้องโหลดไฟล์จากเขา: GitHub Pages (ตัวเว็บ), Google Fonts (ฟอนต์), เซิร์ฟเวอร์รูปของร้านค้า, jsDelivr และ Supabase (ส่วน community)</p>
<h2>ถ้าคุณล็อกอิน</h2>
<table class="legal-table"><tr><th>ข้อมูล</th><th>ใช้ทำอะไร</th><th>ใครเห็น</th></tr>
<tr><td>อีเมล</td><td>ส่งลิงก์เข้าสู่ระบบ</td><td>คุณเท่านั้น (เก็บใน Supabase)</td></tr>
<tr><td>ชื่อที่แสดง</td><td>แสดงกับโพสต์</td><td>ทุกคน</td></tr>
<tr><td>โพสต์ ความเห็น รูป รายงานราคา</td><td>แสดงบนเว็บ</td><td>ทุกคน</td></tr>
<tr><td>โหวต "เจอเหมือนกัน" bookmark</td><td>นับคะแนน / ใช้งานของคุณ</td><td>bookmark เห็นคนเดียว ส่วนโหวตนับรวม</td></tr></table>
<p>บอทสรุป: เมื่อคุณกด "ร่างให้" ข้อความที่คุณวางจะถูกส่งไปที่ผู้ให้บริการ AI ที่เราใช้ (Google Gemini หรือ Anthropic Claude) เพื่อร่างข้อความ ถ้าเป็น Gemini แบบฟรี Google อาจใช้ข้อความนั้นปรับปรุงบริการของเขา เราไม่เก็บข้อความนั้น เก็บแค่จำนวนครั้งที่ใช้ต่อวัน (ลบเองภายใน 2 วัน) อย่าวางข้อมูลส่วนตัวลงไป</p>
<p>ฐานทางกฎหมาย: ความยินยอมและการให้บริการตามที่คุณขอ เราไม่ขาย ไม่ให้เช่า และไม่ใช้ข้อมูลเพื่อโฆษณา ข้อมูลเก็บในบริการของ Supabase (อาจอยู่นอกประเทศไทย)</p>
<h2>รูปที่อัปโหลด</h2>
<p>เว็บย่อรูปและบันทึกใหม่ก่อนอัปโหลด ข้อมูลในไฟล์ เช่น พิกัด GPS จะถูกลบ และมีเครื่องมือให้ปิดดำชื่อ ที่อยู่ เบอร์โทร รูปที่อัปโหลดแล้วทุกคนเห็นได้</p>
<h2>สิทธิของคุณ</h2>
<ul><li>ดูทุกอย่างที่คุณโพสต์ และแก้หรือลบทีละรายการได้ที่<a href="#account">หน้าบัญชี</a></li>
<li>ลบบัญชีได้เองทันที: อีเมล ชื่อ โหวต รายงาน และราคาจะถูกลบ ส่วนกระทู้และความเห็นจะแสดงเป็น "บัญชีที่ลบแล้ว"</li>
<li>ขอสำเนาข้อมูล ร้องเรียน หรือคัดค้านการประมวลผล ทำได้ผ่าน<a href="#contact">หน้าติดต่อ</a></li></ul>`,
    en: `
<h1>Privacy notice</h1>
<p class="muted">Updated ${LEGAL_UPDATED} · under Thailand's Personal Data Protection Act (PDPA)</p>
<h2>If you only browse</h2>
<p>No ads and no tracking cookies. We count usage anonymously: each page view, store click or script error records the page, the product viewed, the referring site's domain, language and device class (phone/computer). <b>Your IP isn't stored</b>; a one-way hash of IP + browser + a daily random salt counts unique visitors within that day, and the salt is deleted daily, so it can't be reversed or linked across days. Totals are public on the <a href="#stats">stats page</a>. If your browser sends Do Not Track or GPC, nothing is counted.</p>
<p>Preferences (language, mode, theme) and signed-out bookmarks stay in your own browser.</p>
<p>These services do see your IP and browser details because your browser loads files from them: GitHub Pages (the site), Google Fonts (fonts), store image servers, jsDelivr and Supabase (community features).</p>
<h2>If you sign in</h2>
<table class="legal-table"><tr><th>Data</th><th>Used for</th><th>Who sees it</th></tr>
<tr><td>Email</td><td>Sending sign-in links</td><td>Only you (stored in Supabase)</td></tr>
<tr><td>Display name</td><td>Shown with your posts</td><td>Everyone</td></tr>
<tr><td>Posts, comments, photos, price reports</td><td>Shown on the site</td><td>Everyone</td></tr>
<tr><td>Votes, "me too", bookmarks</td><td>Scores / your own use</td><td>Bookmarks are private; votes are counted</td></tr></table>
<p>Summariser: when you press "Draft it", the text you pasted is sent to the AI provider we use (Google Gemini or Anthropic Claude) to write the draft. On Gemini's free tier, Google may use that text to improve its services. We don't keep that text, only a count of uses per day (deleted within 2 days). Don't paste personal data into it.</p>
<p>Legal basis: consent and providing the service you ask for. We don't sell, rent or use data for advertising. Data is stored with Supabase (possibly outside Thailand).</p>
<h2>Uploaded photos</h2>
<p>The page resizes and re-encodes photos before upload, which removes file metadata such as GPS, and offers a tool to black out names, addresses and phone numbers. Uploaded photos are public.</p>
<h2>Your rights</h2>
<ul><li>See everything you've posted, and edit or delete each item, on your <a href="#account">account page</a></li>
<li>Delete your account yourself, instantly: email, name, votes, reports and prices are deleted; threads and comments show as "deleted account"</li>
<li>Request a copy of your data, complain, or object to processing via the <a href="#contact">contact page</a></li></ul>`,
  },
  contact: {
    th: `
<h1>ติดต่อ แจ้งแก้ และขอลบข้อมูล</h1>
<p>Sotto เป็นโปรเจกต์ open source ทุกคำขอทำผ่าน GitHub เพื่อให้ตรวจสอบย้อนหลังได้ ถ้าเรื่องมีข้อมูลส่วนตัว อย่าใส่ข้อมูลนั้นในคำขอ ให้บอกแค่ว่าต้องการให้ติดต่อกลับ</p>
<div class="contact-grid">
<a class="card pad" href="${issue("correction.yml", "Data: ")}" target="_blank" rel="noopener"><b>ข้อมูลสินค้าผิด</b><span class="muted small">สเปก ราคา หมวด รุ่นซ้ำ พร้อมลิงก์ที่มาที่ถูกต้อง</span></a>
<a class="card pad" href="${issue("takedown.yml", "Takedown: ")}" target="_blank" rel="noopener"><b>แบรนด์หรือร้าน: ขอแก้หรือขอลบ</b><span class="muted small">โพสต์ที่คิดว่าไม่ถูกต้อง หรือข้อมูลที่ไม่ต้องการให้แสดง</span></a>
<a class="card pad" href="${issue("brand.yml", "Brand account: ")}" target="_blank" rel="noopener"><b>แบรนด์: ขอบัญชียืนยันเพื่อตอบรายงาน</b><span class="muted small">ตอบรายงานปัญหาของสินค้าตัวเองในนามแบรนด์ พร้อมป้าย ✓ ยืนยันผ่านช่องทางทางการของแบรนด์</span></a>
<a class="card pad" href="${issue("privacy.yml", "Privacy request")}" target="_blank" rel="noopener"><b>คำขอเรื่องข้อมูลส่วนบุคคล</b><span class="muted small">ขอสำเนา คัดค้าน หรือร้องเรียน (ลบบัญชีทำเองได้ที่หน้าบัญชี)</span></a>
<a class="card pad" href="${REPO}/issues" target="_blank" rel="noopener"><b>อื่นๆ / เสนอฟีเจอร์</b><span class="muted small">GitHub Issues</span></a>
</div>
<p class="muted small">โพสต์ของผู้ใช้ทุกอันมีปุ่ม "แจ้งไม่เหมาะสม" ซึ่งเร็วกว่าสำหรับเรื่องสแปมหรือคำหยาบ</p>`,
    en: `
<h1>Contact, corrections and takedowns</h1>
<p>Sotto is open source, so requests go through GitHub where they can be tracked. If your request involves personal data, don't include it; just say you'd like to be contacted.</p>
<div class="contact-grid">
<a class="card pad" href="${issue("correction.yml", "Data: ")}" target="_blank" rel="noopener"><b>Wrong product data</b><span class="muted small">Specs, prices, category, duplicates, with the correct source link</span></a>
<a class="card pad" href="${issue("takedown.yml", "Takedown: ")}" target="_blank" rel="noopener"><b>Brands and stores: correction or removal</b><span class="muted small">Posts you believe are wrong, or data you don't want shown.</span></a>
<a class="card pad" href="${issue("brand.yml", "Brand account: ")}" target="_blank" rel="noopener"><b>Brands: get a verified account to answer reports</b><span class="muted small">Answer user reports about your products as the brand, with a ✓ badge. Verified through the brand's official channel.</span></a>
<a class="card pad" href="${issue("privacy.yml", "Privacy request")}" target="_blank" rel="noopener"><b>Personal data request</b><span class="muted small">Copy, objection or complaint (delete your account yourself on the account page)</span></a>
<a class="card pad" href="${REPO}/issues" target="_blank" rel="noopener"><b>Anything else / feature ideas</b><span class="muted small">GitHub Issues</span></a>
</div>
<p class="muted small">Every user post has a "Report post" button, which is faster for spam or abuse.</p>`,
  },
  compiled: {
    th: `
<h1>โพสต์ที่ Sotto รวบรวม</h1>
<p>โพสต์ที่ขึ้นว่า "รวบรวมโดย Sotto" ไม่ได้มาจากผู้ใช้ เราใส่ไว้ก่อน เพื่อให้คนที่กำลังจะซื้อเห็นปัญหาที่มีคนพูดถึงแล้ว</p>
<h2>ทำยังไง</h2>
<ol><li><b>ร่าง:</b> AI (Claude) อ่านแหล่งสาธารณะแล้วร่างโพสต์ พร้อมยกประโยคจากแหล่งมาแบบคำต่อคำ</li>
<li><b>ตรวจ:</b> คนในทีม Sotto อ่านแหล่งเอง ตรวจว่าประโยคที่ยกมามีอยู่จริงและโพสต์ไม่พูดเกินแหล่ง แล้วจึงเผยแพร่</li>
<li><b>ระบุสถานะ:</b> ปัญหาที่แก้แล้วบอกว่าแก้ในเฟิร์มแวร์เวอร์ชันไหน ปัญหาที่ยังไม่ชัดขึ้นว่า "ยังไม่ชัด" และทุกโพสต์มีวันที่ตรวจล่าสุด</li></ol>
<h2>ใช้แหล่งไหน</h2>
<p>บันทึกการอัปเดตเฟิร์มแวร์และหน้าซัพพอร์ตของผู้ผลิต (ผู้ผลิตยอมรับเองว่ามีปัญหาและแก้แล้ว), รายการเรียกคืนสินค้า, เว็บวัดค่า และกระทู้ที่คนในทีมอ่านเอง เราไม่ใช้บอทดูดเว็บที่ห้ามไว้ (Head-Fi, Reddit, Audio Science Review)</p>
<h2>ไม่ใช่ข้อสรุปของ Sotto</h2>
<p>เราเขียนว่าใครรายงานอะไร ไม่ได้ฟันธงว่าสินค้าเสีย ถ้าคุณเป็นเจ้าของแล้วเจอเหมือนกัน กด "เจอเหมือนกัน" ถ้าไม่เจอหรือโพสต์ผิด กด "รายงานโพสต์" หรือแจ้งผ่าน<a href="#contact">หน้าติดต่อ</a> แบรนด์ที่ยืนยันตัวตนแล้วตอบใต้โพสต์ได้</p>
<p class="muted small">โพสต์ที่รวบรวมไม่นับเป็นยอดของผู้ใช้ในสถิติใด ๆ</p>`,
    en: `
<h1>Posts compiled by Sotto</h1>
<p>Posts marked "Compiled by Sotto" are not from users. We add them so people about to buy can see problems that have already been reported.</p>
<h2>How</h2>
<ol><li><b>Draft:</b> an AI (Claude) reads public sources and drafts the post, quoting the source word for word.</li>
<li><b>Check:</b> a person on the Sotto team reads the source, checks that the quote is really there and that the post doesn't say more than the source, and only then publishes it.</li>
<li><b>Status:</b> a fixed problem says which firmware fixed it; an unclear one says "unclear"; every post shows when it was last checked.</li></ol>
<h2>Sources</h2>
<p>Makers' firmware release notes and support pages (the maker itself acknowledging and fixing a problem), recalls, measurement sites, and threads a person on the team has read. We don't run bots on sites that forbid it (Head-Fi, Reddit, Audio Science Review).</p>
<h2>Not Sotto's conclusion</h2>
<p>We say who reported what; we don't declare a product faulty. If you own one and see the same thing, press "Me too". If you don't, or the post is wrong, press "Report post" or use the <a href="#contact">contact page</a>. Verified brands can reply under the post.</p>
<p class="muted small">Compiled posts are never counted as user activity in any statistic.</p>`,
  },
};
