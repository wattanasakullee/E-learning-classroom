// ข้อมูลตัวอย่างสำหรับโหมดทดลอง — นักศึกษาทั้งหมดเป็นบุคคลสมมติ
import { loginKey, courseId, resultId, computeScore, semId, teacherKey, teacherFirstKey, TEACHER_DOMAIN } from "./common.js";
import { transcript, summaryOf } from "./transcript.js";

const SEM0 = "68/2", SEM = "69/1", SEM2 = "69/2"; // 68/2 จบแล้ว · 69/1 ปัจจุบัน · 69/2 เตรียมล่วงหน้า
const SEED_VERSION = 10;
// กลุ่มสมมติ 2 กลุ่ม: 99/3 (ครูสมศรี) และ 98/3 (ครูประภา — ยังไม่มีบัญชี ใช้ทดลองสร้างจากรายชื่อที่ปรึกษา)
const GROUPS = { "99/3": { name: "กลุ่มทดลอง ก (ข้อมูลสมมติ)", advisor: "ครูสมศรี มีสุข" }, "98/3": { name: "กลุ่มทดลอง ข (ข้อมูลสมมติ)", advisor: "นางประภา ดีงาม" } };
const GROUP_OF = sid => (Number(sid.slice(-1)) <= 4 ? "99/3" : "98/3");
export const DEMO_TEACHERS = [
  ["ครูสมศรี มีสุข", "0811111111", ["99/3"], "somsri.demo@example.com"],
  ["นายวิชัย ใจงาม", "0822222222", []],
];
export const DEMO_ACCOUNTS = [
  ["6913999001", "1100000000001", "นายสมชาย ใจดี"],
  ["6913999002", "1100000000002", "นางสาวมาลี ศรีสุข"],
  ["6913999003", "1100000000003", "นายประยูร ทองคำ"],
  ["6913999004", "1100000000004", "นางบุญมี แสงจันทร์"],
  ["6913999005", "G100000000005", "Mr. Aung Kyaw"],
  ["6913999006", "1100000000006", "นางสาวพรทิพย์ วงศ์ไทย"],
];
const SUBJECTS0 = [
  ["ทช31002", "ประวัติศาสตร์", 2],
  ["สค31002", "เศรษฐกิจพอเพียงกับการพัฒนาชุมชน", 2],
];
const SUBJECTS2 = [
  ["ทร31001", "ทักษะการเรียนรู้", 5],
  ["สค31001", "ศาสนาและหน้าที่พลเมือง", 3],
  ["พว31001", "วิทยาศาสตร์", 4],
];
const SUBJECTS = [
  ["อช31002", "ทักษะการขยายอาชีพ", 4],
  ["ทช31001", "เศรษฐกิจพอเพียง", 1],
  ["พค31001", "คณิตศาสตร์", 5],
  ["พว32023", "การใช้พลังงานไฟฟ้าในชีวิตประจำวัน", 3], // วิชาเลือก (มีข้อสอบปลายภาค)
];

const ARTICLE_JOB = `
<h2>การวิเคราะห์ศักยภาพเพื่อขยายอาชีพ</h2>
<p>การขยายอาชีพให้มั่นคง ต้องเริ่มจากการรู้จัก <b>ศักยภาพ</b> ของตนเองและชุมชน ว่ามีจุดแข็งอะไรที่นำมาใช้ได้ หลักสูตร กศน. แบ่งศักยภาพที่ใช้วิเคราะห์ไว้ 5 ด้าน ดังนี้</p>
<table><thead><tr><th>ศักยภาพ</th><th>ตัวอย่างคำถามที่ควรถาม</th></tr></thead><tbody>
<tr><td>1. ทรัพยากรธรรมชาติ</td><td>ในพื้นที่มีวัตถุดิบอะไรมาก เช่น ไผ่ ชา กาแฟ ข้าว</td></tr>
<tr><td>2. ทำเลที่ตั้ง</td><td>อยู่ใกล้ตลาด ถนนสายหลัก หรือแหล่งท่องเที่ยวหรือไม่</td></tr>
<tr><td>3. ลักษณะภูมิอากาศ</td><td>อากาศเหมาะกับพืชหรือสัตว์ชนิดใด</td></tr>
<tr><td>4. ภูมิประเทศและภูมิสังคม</td><td>คนในชุมชนมีความรู้ ภูมิปัญญา หรือรวมกลุ่มกันได้ดีเพียงใด</td></tr>
<tr><td>5. ประวัติศาสตร์และวัฒนธรรม</td><td>มีประเพณี เรื่องเล่า หรือของดีประจำถิ่นที่นำมาเพิ่มมูลค่าได้หรือไม่</td></tr>
</tbody></table>
<h3>ขั้นตอนการขยายอาชีพ</h3>
<ol>
<li><b>ศึกษาความต้องการของตลาด</b> — ลูกค้าคือใคร ต้องการสินค้าแบบใด ราคาเท่าไร</li>
<li><b>วิเคราะห์ทรัพยากรและเงินทุน</b> — ใช้เงินทุนของตนเองเป็นหลัก ไม่กู้เกินกำลัง และคำนวณจุดคุ้มทุน</li>
<li><b>วางแผนและทดลองขยายทีละขั้น</b> — เริ่มขนาดเล็ก จดบันทึกรายรับรายจ่าย แล้วปรับแผนตามผลจริง</li>
</ol>
<blockquote>ตัวอย่าง: กลุ่มแม่บ้านที่ปลูกกาแฟอยู่แล้ว ขยายอาชีพโดยคั่วและบรรจุถุงขายเอง แทนการขายเมล็ดดิบ ทำให้ได้กำไรต่อกิโลกรัมสูงขึ้นหลายเท่า</blockquote>
<p>สิ่งสำคัญคือ <u>ขยายเท่าที่ตลาดรองรับ</u> และมีข้อมูลประกอบการตัดสินใจทุกครั้ง</p>`;

const ARTICLE_SUFF = `
<h2>หลักปรัชญาของเศรษฐกิจพอเพียง</h2>
<p>เศรษฐกิจพอเพียงเป็นแนวทางการดำเนินชีวิตที่ยึด <b>ทางสายกลาง</b> ประกอบด้วย 3 ห่วง 2 เงื่อนไข</p>
<h3>3 ห่วง</h3>
<ul><li><b>ความพอประมาณ</b> — ไม่น้อยเกินไป ไม่มากเกินไป ไม่เบียดเบียนตนเองและผู้อื่น</li>
<li><b>ความมีเหตุผล</b> — ตัดสินใจโดยคิดถึงเหตุปัจจัยและผลที่จะเกิดขึ้น</li>
<li><b>การมีภูมิคุ้มกันที่ดีในตัว</b> — เตรียมพร้อมรับการเปลี่ยนแปลง เช่น มีเงินออม</li></ul>
<h3>2 เงื่อนไข</h3>
<ul><li><b>เงื่อนไขความรู้</b> — รอบรู้ รอบคอบ ระมัดระวัง</li>
<li><b>เงื่อนไขคุณธรรม</b> — ซื่อสัตย์ สุจริต ขยัน อดทน แบ่งปัน</li></ul>
<blockquote>เป้าหมายคือ ชีวิต เศรษฐกิจ สังคม และสิ่งแวดล้อม ที่สมดุล มั่นคง และยั่งยืน</blockquote>`;

export async function seedDemo(store) {
  const existing = await store.get("settings/app");
  if (existing && existing.seedVersion === SEED_VERSION) return;
  if (existing && store.reset) await store.reset(); // ข้อมูลทดลองรูปแบบเก่า: เริ่มใหม่
  const term = (sem, subjects, grp) => {
    const cids = subjects.map(([code]) => courseId(sem, code));
    const subj = Object.fromEntries(subjects.map(([code, name, credit]) => [courseId(sem, code), { code, name, credit }]));
    return { sem, level: "3", grp, grpName: GROUPS[grp].name, courses: cids, subj };
  };
  const ops = [], keys = {};
  for (const [sid, card, name] of DEMO_ACCOUNTS) {
    const k = await loginKey(sid, card); keys[sid] = k;
    const t0 = term(SEM0, SUBJECTS0, GROUP_OF(sid)), t1 = term(SEM, SUBJECTS, GROUP_OF(sid));
    ops.push({ type: "set", path: "logins/" + k, data: { sid, name, terms: { [semId(SEM0)]: t0, [semId(SEM)]: t1 }, courses: [...t0.courses, ...t1.courses] } });
  }
  const roster = (sem, subjects) => ({
    sem, demo: true,
    students: Object.fromEntries(DEMO_ACCOUNTS.map(([sid, , n]) => [sid, { n, g: GROUP_OF(sid), l: "3" }])),
    groups: GROUPS,
    courses: Object.fromEntries(subjects.map(([code, name, credit]) => [courseId(sem, code), { code, name, level: "3", credit, sids: DEMO_ACCOUNTS.map(a => a[0]) }])),
  });
  ops.push({ type: "set", path: "admin/roster-" + semId(SEM), data: roster(SEM, SUBJECTS) });
  ops.push({ type: "set", path: "admin/roster-" + semId(SEM0), data: roster(SEM0, SUBJECTS0) });
  // 69/2 เตรียมล่วงหน้า: มีรายวิชาแต่ยังไม่มีนักศึกษาลงทะเบียน
  ops.push({ type: "set", path: "admin/roster-" + semId(SEM2), data: { sem: SEM2, demo: true, prepared: true, students: {},
    courses: Object.fromEntries(SUBJECTS2.map(([code, name, credit]) => [courseId(SEM2, code), { code, name, level: "3", credit, sids: [], manual: true }])) } });
  ops.push({ type: "set", path: "settings/app", data: { semesters: [SEM0, SEM, SEM2], current: SEM, semester: SEM, demo: true, seedVersion: SEED_VERSION,
    // ช่วงเวลาสอบปลายภาค (วิชาเลือก) ภาคเรียน 1/2569: เปิดแล้ว ปิดอีก 30 วัน
    finalWindows: { [semId(SEM)]: { openAt: new Date(Date.now() - 864e5).toISOString(), closeAt: new Date(Date.now() + 30 * 864e5).toISOString() } } } });
  // บัญชีครูทดลอง (ชื่อผู้ใช้ = ชื่อ-สกุล, รหัสผ่าน = เบอร์โทร)
  for (const [name, phone, groups, realEmail] of DEMO_TEACHERS) {
    const email = realEmail || `demo${phone}@${TEACHER_DOMAIN}`;
    const uid = await store.admin.createUser(email, phone).catch(() => "u" + phone);
    const nameKey = await teacherKey(name);
    ops.push({ type: "set", path: "staff/" + uid, data: { name, nameKey, email, phone, groups, role: "teacher", active: true, pwChanged: false } });
    ops.push({ type: "set", path: "teacherLogin/" + nameKey, data: { email } });
    ops.push({ type: "set", path: "teacherLogin/" + await teacherFirstKey(name), data: { email } });
  }

  // ภาคเรียนที่ 2/2569 (เตรียมล่วงหน้า): ครูสร้างบทเรียนรอไว้ 1 วิชา
  const cLearn = courseId(SEM2, "ทร31001");
  ops.push({ type: "set", path: "courses/" + cLearn, data: {
    sem: SEM2, code: "ทร31001", name: "ทักษะการเรียนรู้", level: "3", published: true,
    video: { url: "", title: "", desc: "", questions: [] },
    article: { title: "ใบความรู้ การเรียนรู้ด้วยตนเอง", html: `<h2>การเรียนรู้ด้วยตนเอง</h2><p>การเรียนรู้ด้วยตนเอง คือการที่ผู้เรียน <b>ริเริ่มวางแผนการเรียนเอง</b> ตั้งเป้าหมาย เลือกแหล่งเรียนรู้ และประเมินผลการเรียนของตนเอง</p><h3>ขั้นตอน</h3><ol><li>วิเคราะห์ความต้องการในการเรียนรู้</li><li>กำหนดเป้าหมาย</li><li>วางแผนและเลือกแหล่งเรียนรู้</li><li>ลงมือเรียนรู้</li><li>ประเมินผล</li></ol><blockquote>แหล่งเรียนรู้มีทั้ง ห้องสมุดประชาชน อินเทอร์เน็ต ภูมิปัญญาท้องถิ่น และ กศน.ตำบล</blockquote>`, attach: "" },
    quiz: { title: "แบบทดสอบ การเรียนรู้ด้วยตนเอง", questions: [
      { id: "q1", text: "ขั้นแรกของการเรียนรู้ด้วยตนเองคือข้อใด", choices: ["ประเมินผล", "วิเคราะห์ความต้องการในการเรียนรู้", "ลงมือเรียนรู้", "เลือกแหล่งเรียนรู้"] },
      { id: "q2", text: "ข้อใดเป็นแหล่งเรียนรู้ภูมิปัญญาท้องถิ่น", choices: ["ปราชญ์ชาวบ้านในชุมชน", "เกมออนไลน์", "โฆษณาสินค้า", "ข่าวลือ"] },
    ] },
  } }, { type: "set", path: "keys/" + cLearn, data: { video: {}, quiz: { q1: 1, q2: 0 } } });

  // วิชาที่ 1: ครบทั้งวิดีโอ ใบความรู้ แบบทดสอบ
  const cJob = courseId(SEM, "อช31002");
  const job = {
    sem: SEM, code: "อช31002", name: "ทักษะการขยายอาชีพ", level: "3", published: true,
    video: { url: "demo-lesson.mp4", title: "บทที่ 1 การวิเคราะห์ศักยภาพเพื่อขยายอาชีพ", desc: "วิดีโอตัวอย่างความยาว 45 วินาที", questions: [
      { id: "v1", t: 15, text: "ก่อนขยายอาชีพ ควรทำสิ่งใดเป็นอันดับแรก", choices: ["ซื้ออุปกรณ์เพิ่มทันที", "ศึกษาความต้องการของตลาด", "กู้เงินให้ได้มากที่สุด", "ทำตามที่เพื่อนบ้านทำ"] },
      { id: "v2", t: 28, text: "ข้อใดเป็นการใช้เงินทุนอย่างเหมาะสม", choices: ["กู้เงินเกินกำลังเพื่อขยายให้เร็ว", "ไม่ต้องคำนวณต้นทุน", "ใช้เงินทุนของตนเองเป็นหลัก ไม่กู้เกินกำลัง", "ใช้เงินทั้งหมดที่มีในครั้งเดียว"] },
      { id: "v3", t: 40, text: "การขยายอาชีพที่ดีควรเริ่มอย่างไร", choices: ["เริ่มขยายในขนาดเล็ก แล้วปรับแผนจากผลจริง", "ขยายใหญ่ครั้งเดียวให้จบ", "รอให้คู่แข่งเลิกกิจการก่อน", "ไม่ต้องจดบันทึกรายรับรายจ่าย"] },
    ] },
    article: { title: "ใบความรู้ที่ 1 การวิเคราะห์ศักยภาพเพื่อขยายอาชีพ", html: ARTICLE_JOB, attach: "" },
    quiz: { title: "แบบทดสอบหลังเรียน บทที่ 1", questions: [
      { id: "q1", text: "ศักยภาพในการขยายอาชีพตามหลักสูตร กศน. มีกี่ด้าน", choices: ["3 ด้าน", "4 ด้าน", "5 ด้าน", "6 ด้าน"] },
      { id: "q2", text: "การอยู่ใกล้ตลาดหรือแหล่งท่องเที่ยว จัดเป็นศักยภาพด้านใด", choices: ["ทำเลที่ตั้ง", "ภูมิอากาศ", "ทรัพยากรธรรมชาติ", "ประวัติศาสตร์"] },
      { id: "q3", text: "ข้อใดเป็นตัวอย่างการเพิ่มมูลค่าสินค้า", choices: ["ขายเมล็ดกาแฟดิบให้พ่อค้าคนกลาง", "คั่วกาแฟและบรรจุถุงขายเอง", "เลิกปลูกกาแฟ", "ลดราคาให้ต่ำที่สุด"] },
      { id: "q4", text: "\"ขยายเท่าที่ตลาดรองรับ\" หมายถึงข้อใด", choices: ["ผลิตให้มากที่สุดเท่าที่ทำได้", "ผลิตตามจำนวนที่ลูกค้าต้องการซื้อจริง", "ผลิตเท่าเดิมตลอดไป", "ผลิตตามคู่แข่ง"] },
      { id: "q5", text: "ประเพณีและของดีประจำถิ่น จัดเป็นศักยภาพด้านใด", choices: ["ภูมิอากาศ", "ทำเลที่ตั้ง", "ภูมิประเทศ", "ประวัติศาสตร์และวัฒนธรรม"] },
    ] },
  };
  const jobKey = { video: { v1: 1, v2: 2, v3: 0 }, quiz: { q1: 2, q2: 0, q3: 1, q4: 1, q5: 3 } };
  ops.push({ type: "set", path: "courses/" + cJob, data: job }, { type: "set", path: "keys/" + cJob, data: jobKey });

  // วิชาที่ 2: ใบความรู้ + แบบทดสอบ (ไม่มีวิดีโอ)
  const cSuff = courseId(SEM, "ทช31001");
  ops.push({ type: "set", path: "courses/" + cSuff, data: {
    sem: SEM, code: "ทช31001", name: "เศรษฐกิจพอเพียง", level: "3", published: true,
    video: { url: "", title: "", desc: "", questions: [] },
    article: { title: "ใบความรู้ 3 ห่วง 2 เงื่อนไข", html: ARTICLE_SUFF, attach: "" },
    quiz: { title: "แบบทดสอบเศรษฐกิจพอเพียง", full: 10, questions: [
      { id: "q1", text: "ข้อใดไม่ใช่ 1 ใน 3 ห่วง", choices: ["ความพอประมาณ", "ความมีเหตุผล", "ความร่ำรวย", "การมีภูมิคุ้มกันที่ดี"] },
      { id: "q2", text: "การมีเงินออมไว้ใช้ยามจำเป็น ตรงกับห่วงใด", choices: ["การมีภูมิคุ้มกันที่ดี", "ความพอประมาณ", "เงื่อนไขคุณธรรม", "ความมีเหตุผล"] },
      { id: "q3", text: "ความซื่อสัตย์สุจริต จัดอยู่ในเงื่อนไขใด", choices: ["เงื่อนไขความรู้", "เงื่อนไขคุณธรรม"] },
    ] },
  } }, { type: "set", path: "keys/" + cSuff, data: { video: {}, quiz: { q1: 2, q2: 0, q3: 1 } } });

  // วิชาที่ 3: วิชาเลือก — กลางภาค + ข้อสอบปลายภาค (เปิดสอบแล้ว)
  const cElec = courseId(SEM, "พว32023");
  ops.push({ type: "set", path: "courses/" + cElec, data: {
    sem: SEM, code: "พว32023", name: "การใช้พลังงานไฟฟ้าในชีวิตประจำวัน", level: "3", published: true,
    video: { url: "", title: "", desc: "", questions: [] },
    article: { title: "ใบความรู้ การประหยัดพลังงานไฟฟ้าในบ้าน", html: `<h2>ประหยัดไฟฟ้าในบ้าน</h2><p>เครื่องใช้ไฟฟ้าที่ให้ <b>ความร้อน</b> เช่น เตารีด หม้อหุงข้าว กินไฟมาก ควรใช้เท่าที่จำเป็น</p><ul><li>เลือกหลอด LED แทนหลอดไส้</li><li>ตั้งเครื่องปรับอากาศที่ 25–26 องศา</li><li>ถอดปลั๊กเมื่อเลิกใช้งาน</li><li>ดูฉลากประหยัดไฟเบอร์ 5 ก่อนซื้อ</li></ul>` , attach: "" },
    quiz: { title: "แบบทดสอบกลางภาค", questions: [
      { id: "q1", text: "หลอดไฟชนิดใดประหยัดไฟที่สุด", choices: ["หลอดไส้", "หลอด LED", "หลอดฮาโลเจน"] },
      { id: "q2", text: "ควรตั้งเครื่องปรับอากาศที่กี่องศาเพื่อประหยัดไฟ", choices: ["18–20 องศา", "25–26 องศา", "30 องศา"] },
    ] },
    final: { title: "ข้อสอบปลายภาค", timeLimit: 0, full: 40, questions: [
      { id: "f1", text: "เครื่องใช้ไฟฟ้าใดกินไฟมากที่สุด", choices: ["พัดลม", "เตารีด", "หลอด LED", "วิทยุ"] },
      { id: "f2", text: "ฉลากประหยัดไฟเบอร์ใดประหยัดที่สุด", choices: ["เบอร์ 1", "เบอร์ 3", "เบอร์ 5"] },
      { id: "f3", text: "ข้อใดเป็นการประหยัดไฟที่ถูกต้อง", choices: ["เปิดตู้เย็นบ่อย ๆ", "ถอดปลั๊กเมื่อเลิกใช้", "เปิดไฟทิ้งไว้ทั้งคืน"] },
      { id: "f4", text: "หน่วยวัดพลังงานไฟฟ้าที่ใช้คิดค่าไฟคือข้อใด", choices: ["โวลต์", "แอมแปร์", "กิโลวัตต์-ชั่วโมง (หน่วย)"] },
    ] },
  } }, { type: "set", path: "keys/" + cElec, data: { video: {}, quiz: { q1: 1, q2: 1 }, final: { f1: 1, f2: 2, f3: 1, f4: 2 } } });

  // ผลการเรียนตัวอย่างของนักศึกษาบางคน
  const now = new Date().toISOString();
  const sample = [
    ["6913999002", { video: { v1: 1, v2: 2, v3: 0 }, videoDone: true, articleAt: now, quiz: { q1: 2, q2: 0, q3: 1, q4: 1, q5: 0 }, quizAt: now }, true],
    ["6913999003", { video: { v1: 1, v2: 0 } }, false],
    ["6913999004", { video: { v1: 0, v2: 2, v3: 0 }, videoDone: true, articleAt: now, quiz: { q1: 2, q2: 1, q3: 1, q4: 0, q5: 3 }, quizAt: now }, false],
  ];
  for (const [sid, r, pub] of sample) {
    const data = { sid, courseId: cJob, sem: SEM, ...r, updatedAt: now };
    if (pub) { const s = computeScore(job, jobKey, data); data.score = { video: s.video, quiz: s.quiz, total: s.total, itw: s.itw, quizCorrect: s.quizCorrect, quizCount: s.quizCount, at: now }; }
    ops.push({ type: "set", path: "results/" + resultId(keys[sid], cJob), data });
  }
  // ข้อมูลนักศึกษา (ผลการเรียนย้อนหลัง · กพช. · คุณธรรม) — สมมติ
  const SUBS = {
    "พท31001": "ภาษาไทย|5|core", "พค31001": "คณิตศาสตร์|5|core", "พว31001": "วิทยาศาสตร์|5|core", "พต31001": "ภาษาอังกฤษ|5|core",
    "สค31001": "สังคมศึกษา|3|core", "สค31002": "ศาสนาและหน้าที่พลเมือง|2|core", "ทช31001": "เศรษฐกิจพอเพียง|1|core", "ทช31002": "ประวัติศาสตร์|2|core",
    "ทร31001": "ทักษะการเรียนรู้|5|core", "อช31002": "ทักษะการขยายอาชีพ|4|core", "พว32023": "การใช้พลังงานไฟฟ้าในชีวิตประจำวัน|3|elective",
    "อช02015": "การเกษตรผสมผสาน|3|elective", "อช02018": "การขายและการตลาด|2|elective", "พว02020": "การใช้คอมพิวเตอร์เบื้องต้น|3|elective",
  };
  const RULE = { req: 44, elec: 32, act: 200, tim: 4 };
  await store.batch(ops); ops.length = 0;
  ops.push({ type: "set", path: "admin/subjects-3", data: { subs: SUBS, rule: RULE } });
  const hist = { "67/1": ["พท31001", "พค31001", "สค31001", "อช02015"], "67/2": ["พว31001", "พต31001", "สค31002", "อช02018"], "68/1": ["ทร31001", "ทช31002", "พว02020"], "68/2": ["ทช31002", "สค31002"] };
  const gradeSet = ["4", "3.5", "3", "2.5", "2", "1.5", "1", "0", "ข"];
  const sum = {};
  DEMO_ACCOUNTS.forEach(([sid, , name], i) => {
    const gr = [];
    Object.entries(hist).forEach(([s, codes], k) => codes.forEach((c, j) => gr.push(`${s}|${c}|${gradeSet[(i * 3 + j + k) % (i === 0 ? 3 : gradeSet.length)]}|${60 + ((i + j * 7 + k * 3) % 35)}`)));
    SUBJECTS.forEach(([c]) => gr.push(`69/1|${c}||`)); // ภาคปัจจุบัน ยังไม่มีผล
    const act = [`67/2|${40 + i * 10}|โครงการปลูกป่าชุมชน (สมมติ)`, `68/1|${30 + i * 15}|เผยแพร่ความรู้การทำปุ๋ยหมัก (สมมติ)`, ...(i === 0 ? ["68/2|140|ค่ายพัฒนาโรงเรียน (สมมติ)"] : [])];
    const vir = [`67/2|2`, `68/1|${i === 3 ? 0 : 2}`, `68/2|${i % 2 ? 3 : 2}`];
    const p = { gr, act, vir };
    const g = GROUP_OF(sid);
    ops.push({ type: "set", path: "profiles/" + sid, data: { sid, n: name, g, l: "3", ...p } });
    sum[sid] = summaryOf(transcript(p, SUBS, RULE));
  });
  ops.push({ type: "set", path: "admin/profiles-" + semId(SEM), data: { sem: SEM, sum, at: new Date().toISOString() } });
  await store.batch(ops);
}
