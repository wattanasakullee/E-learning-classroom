// อ่าน/แก้ไขไฟล์ DBF (Visual FoxPro) ของ ITW51 ทั้งหมดทำในเบราว์เซอร์ ไม่ส่งไฟล์ขึ้นอินเทอร์เน็ต
const TH = new TextDecoder("windows-874");

export class DBF {
  constructor(buffer, name = "") {
    this.name = name;
    this.u8 = new Uint8Array(buffer);
    const dv = new DataView(buffer);
    this.count = dv.getUint32(4, true);
    this.headerLen = dv.getUint16(8, true);
    this.recLen = dv.getUint16(10, true);
    this.fields = [];
    let off = 32, pos = 1, nullBit = 0;
    while (off + 32 <= this.headerLen && this.u8[off] !== 0x0d) {
      const raw = this.u8.subarray(off, off + 11);
      let end = raw.indexOf(0); if (end < 0) end = 11;
      const name = String.fromCharCode(...raw.subarray(0, end)).toUpperCase();
      const f = {
        name, type: String.fromCharCode(this.u8[off + 11]),
        len: this.u8[off + 16], dec: this.u8[off + 17], flags: this.u8[off + 18], offset: pos,
      };
      if (f.flags & 0x02) f.nullBit = nullBit++;
      this.fields.push(f);
      pos += f.len; off += 32;
    }
    this.byName = Object.fromEntries(this.fields.map(f => [f.name, f]));
    const avail = Math.floor((this.u8.length - this.headerLen) / this.recLen);
    if (avail < this.count) this.count = avail;
  }
  has(name) { return !!this.byName[name]; }
  recStart(i) { return this.headerLen + i * this.recLen; }
  isDeleted(i) { return this.u8[this.recStart(i)] === 0x2a; }
  raw(i, name) {
    const f = this.byName[name]; const s = this.recStart(i) + f.offset;
    return this.u8.subarray(s, s + f.len);
  }
  isNull(i, name) {
    const f = this.byName[name], nf = this.byName["_NULLFLAGS"];
    if (!f || f.nullBit === undefined || !nf) return false;
    const byte = this.u8[this.recStart(i) + nf.offset + (f.nullBit >> 3)];
    return !!(byte & (1 << (f.nullBit & 7)));
  }
  str(i, name) {
    if (!this.byName[name]) return "";
    return TH.decode(this.raw(i, name)).replace(/\0/g, "").trim();
  }
  num(i, name) {
    if (!this.byName[name] || this.isNull(i, name)) return null;
    const s = this.str(i, name);
    if (s === "") return null;
    const n = Number(s); return Number.isFinite(n) ? n : null;
  }
  // วนอ่านทุกระเบียน (ข้ามที่ถูกลบ) คืนค่าเฉพาะฟิลด์ที่ต้องการ
  *rows(names) {
    for (let i = 0; i < this.count; i++) {
      if (this.isDeleted(i)) continue;
      const r = { _i: i };
      for (const n of names) {
        const f = this.byName[n]; if (!f) { r[n] = null; continue; }
        r[n] = f.type === "N" || f.type === "F" ? this.num(i, n) : this.str(i, n);
      }
      yield r;
    }
  }
  // เขียนค่าตัวเลขลงฟิลด์ (ชิดขวา ขนาดเท่าเดิม) และล้าง null flag
  setNum(i, name, value) {
    const f = this.byName[name]; if (!f) throw new Error("ไม่พบฟิลด์ " + name);
    const s = this.recStart(i) + f.offset;
    let txt = value === null || value === undefined ? "" : String(Math.round(value));
    if (txt.length > f.len) throw new Error(`ค่า ${txt} ยาวเกินฟิลด์ ${name}`);
    txt = txt.padStart(f.len, " ");
    for (let k = 0; k < f.len; k++) this.u8[s + k] = txt.charCodeAt(k);
    const nf = this.byName["_NULLFLAGS"];
    if (f.nullBit !== undefined && nf) {
      const at = this.recStart(i) + nf.offset + (f.nullBit >> 3), bit = 1 << (f.nullBit & 7);
      if (value === null || value === undefined) this.u8[at] |= bit; else this.u8[at] &= ~bit;
    }
  }
  touchHeader(d = new Date()) {
    this.u8[1] = d.getFullYear() - 1900; this.u8[2] = d.getMonth() + 1; this.u8[3] = d.getDate();
  }
  bytes() { return this.u8; }
}

export async function readDBF(file) {
  const buf = await file.arrayBuffer();
  return new DBF(buf, file.name);
}
