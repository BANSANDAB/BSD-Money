# ระบบบริหารงบประมาณ โรงเรียนบ้านสันดาบ (School Budget Management System V.2)

ระบบบริหารงบประมาณและแผนปฏิบัติการประจำปี โรงเรียนบ้านสันดาบ รองรับการทำงานทั้งบน **Google Apps Script Web App**, **GitHub Pages**, เว็บเซิร์ฟเวอร์ และเปิดใช้งานแบบ **Standalone / Offline Application** บนเครื่องคอมพิวเตอร์และมือถือได้ทุกแพลตฟอร์ม

---

## 🌟 ฟีเจอร์เด่นของระบบ

1. **รองรับ Multi-Platform & GitHub Pages**
   - สามารถเปิดผ่าน GitHub Pages (`https://<username>.github.io/<repo>/`) หรือโฮสต์บนเซิร์ฟเวอร์ใดๆ ได้ทันที
   - มีระบบ Hybrid API ซิงค์ข้อมูลกับ Google Apps Script และ Google Sheets แบบสองทิศทาง
   - ทำงานแบบ Offline First พร้อมฐานข้อมูลสำรองในตัว (Offline Mock & LocalStorage Cache) หากไม่มีอินเทอร์เน็ตยังเปิดใช้งานและดูข้อมูลได้ครบถ้วน
   - ติดตั้งเป็นแอปบนมือถือหรือคอมพิวเตอร์ได้ผ่าน PWA (Progressive Web App)

2. **ระบบเสียงเอฟเฟกต์ตอบสนองการใช้งาน (UI Audio Feedback System)**
   - สร้างเสียงตอบสนองด้วย **Web Audio API** โดยตรง ไม่ต้องพึ่งพาไฟล์เสียงภายนอก โหลดเร็ว ไร้ปัญหา 404 หรือ CORS
   - **เสียงพิมพ์ป้อนข้อมูล (Soft Typing Tick)**: มีเสียงพิมพ์สัมผัสคล้ายคีย์บอร์ดที่นุ่มนวลและเป็นธรรมชาติ
   - **เสียงคลิกปุ่ม (Modern UI Click/Tap)**: เสียงคลิกปุ่ม ลิงก์ และแท็บต่างๆ ที่คมชัด สบายหู
   - **เสียงแจ้งเตือนบันทึกสำเร็จ (Success Chime)**: เสียงคอร์ดแจ้งเตือนเมื่อบันทึกข้อมูลเรียบร้อย
   - **เสียงลบ/ยกเลิก (Subtle Low Tone)**: เสียงแจ้งเตือนเมื่อลบรายการ
   - **ปุ่มเปิด/ปิดเสียง (Sound Toggle)**: สามารถเปิดหรือปิดเสียงได้ตามต้องการจากแถบเมนูด้านบน และจดจำการตั้งค่าอัตโนมัติ

3. **บริหารจัดการงบประมาณครบวงจร**
   - **Dashboard**: แสดงยอดคงเหลือเงินอุดหนุน, เงินรายได้สถานศึกษา, อาหารกลางวัน, ดอกเบี้ย และกราฟสรุปรายไตรมาส
   - **บันทึกขอเบิกงบประมาณ**: ออกเอกสารขอเบิก (Google Docs) พร้อมคำนวณยอดเงินสะสมและคงเหลืออัตโนมัติ
   - **ติดตามค่าใช้จ่ายโครงการ**: ตรวจสอบการใช้จ่ายจริงเทียบกับงบประมาณโครงการ
   - **ทะเบียนคุมหลักฐานการขอเบิก (บจ./บค.) และ จัดซื้อ/จัดจ้าง**
   - **รายงาน Ebudget**: คำนวณยอดรับ-จ่าย และคงเหลือแยกตามหมวดและงวด (ต.ค. - มี.ค. และ เม.ย. - ก.ย.)
   - **รองรับหลายปีงบประมาณ**: รองรับปี 2569, 2570 และเปลี่ยนปีงบประมาณได้ทันที

---

## 🚀 วิธีการนำขึ้นใช้งานบน GitHub Pages

1. **สร้าง Repository บน GitHub**
   - ไปที่ [GitHub](https://github.com) แล้วสร้าง Repository ใหม่ (เช่น `school-budget-system`)
2. **อัปโหลดไฟล์ขึ้น GitHub**
   - อัปโหลดไฟล์ทั้งหมดในโฟลเดอร์นี้ขึ้นไป (โดยเฉพาะ `index.html`, `Code.gs`, `manifest.json`, โฟลเดอร์ `fonts/`)
3. **เปิดใช้งาน GitHub Pages**
   - ไปที่เมนู **Settings** ของ Repository
   - เลือกหัวข้อ **Pages** (ทางซ้ายมือ)
   - ในส่วน **Build and deployment > Branch**: เลือก `main` หรือ `master` และโฟลเดอร์ `/ (root)`
   - กด **Save**
4. **เข้าใช้งาน**
   - รอประมาณ 1-2 นาที คุณจะได้ URL ประจำเว็บ เช่น `https://<ชื่อผู้ใช้>.github.io/<ชื่อ-repo>/` สามารถเปิดใช้งานได้จากทุกอุปกรณ์ทันที!

---

## ⚙️ การตั้งค่า Google Sheets และ Google Apps Script

- **Google Sheet Database ID**: `1NTmGmRPlnsOEuRzt4chpBR4AIoYnfVTbJN9x12NTTgA`
- **Active Web App URL**: `https://script.google.com/macros/s/AKfycbztl6GD61UIfL8iaCtkV8fHTN_4vI0BtxPeJjbx9VIKPq2Rv126xg600bPT-pOwUnVB6w/exec`
- **Deployment ID**: `AKfycbztl6GD61UIfL8iaCtkV8fHTN_4vI0BtxPeJjbx9VIKPq2Rv126xg600bPT-pOwUnVB6w`
- **ไฟล์สคริปต์ [Code.gs](Code.gs)**: 
  1. นำโค้ดใน `Code.gs` ไปวางในโปรเจกต์ Google Apps Script (ส่วนขยาย > Apps Script ใน Google Sheets)
  2. กด **ทำให้ใช้งานได้ (Deploy)** > **การทำให้ใช้งานได้รายการใหม่ (New Deployment)**
  3. เลือกประเภท: **เว็บแอป (Web App)**
  4. กำหนดให้:
     - ปฏิบัติการในฐานะ: **ฉัน (Me)**
     - ผู้ที่มีสิทธิ์เข้าถึง: **ทุกคน (Anyone)**
  5. คัดลอก Web App URL ที่ได้มาใส่ในปุ่ม **"เชื่อมต่อ API"** บนแถบหัวเว็บ เพื่อให้หน้า GitHub Pages ซิงค์ข้อมูลกับชีตได้แบบสดๆ

---

## 📁 โครงสร้างไฟล์ในโครงการ

```
├── index.html          # หน้าเว็บหลัก Single Page Application (UI + Logic ทั้งหมด)
├── Code.gs             # โค้ด Google Apps Script ฝั่งเซิร์ฟเวอร์
├── manifest.json       # ไฟล์ตั้งค่า Web App สำหรับติดตั้งลงบนอุปกรณ์ (PWA)
├── .gitignore          # ระบุไฟล์ที่ไม่ต้องนำขึ้น GitHub
├── README.md           # คู่มือและเอกสารการใช้งานระบบ
└── fonts/              # ฟอนต์ TH Sarabun PSK สำหรับพิมพ์รายงาน A4
    ├── THSarabun.ttf
    ├── THSarabun Bold.ttf
    ├── THSarabun Italic.ttf
    └── THSarabun BoldItalic.ttf
```
