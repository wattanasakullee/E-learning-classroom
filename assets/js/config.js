// =====================================================================
//  ตั้งค่าระบบห้องเรียนออนไลน์ (สร้างจากคู่มือติดตั้ง)
// =====================================================================
export const CONFIG = {
  firebase: {
    apiKey: "AIzaSyCfVBpHc77wC5jWMsx_VWukW4w222Z1NOo",
    authDomain: "wattanasakullee-87bb6.firebaseapp.com",
    projectId: "wattanasakullee-87bb6",
    storageBucket: "wattanasakullee-87bb6.firebasestorage.app",
    messagingSenderId: "83812338135",
    appId: "1:83812338135:web:9d85622b1174627565e392",
  },

  // ชื่อสถานศึกษาที่แสดงบนหน้าเว็บ
  schoolName: "ศูนย์ส่งเสริมการเรียนรู้ระดับอำเภอเทิง",
  schoolSub: "ห้องเรียนออนไลน์",
  schoolCode: "1257040000",

  // อีเมลเจ้าของระบบ (ต้องตรงกับ isOwner() ในไฟล์ firestore.rules)
  // admin คนอื่นเพิ่มได้ในระบบ: หน้า "ครูผู้สอน" → แก้ไข → ติ๊ก "ผู้ดูแลระบบ (admin)"
  adminEmails: ["lee973489@gmail.com"],

  // ค่าลับสำหรับสร้างรหัสเข้าระบบของนักศึกษา — ห้ามเปลี่ยนหลังนำเข้าข้อมูล
  keySalt: "teng-2v1k305q6o34533o4s",

  // คะแนนเต็มของแต่ละส่วน (วิดีโอ 5 + แบบทดสอบ 5 = 10)
  videoFull: 5,
  quizFull: 5,
};
