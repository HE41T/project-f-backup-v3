# 🛠️ แผนพัฒนาเว็บระบบ Resize Image (React + Node.js + Python + MySQL)

> ระบบ multiuser: superuser, admin, user + resize ภาพ + จำกัดการใช้งานต่อวัน + Docker environment

---

## 🔰 สัปดาห์ที่ 1: Backend & Database

### ✅ วันที่ 1: Docker + Database
- [] ติดตั้ง Docker และ Docker Compose
- [] เขียน `docker-compose.yml` สำหรับ:
  - [✅] Node.js backend
  - [✅] MySQL database
  - [ ] Python API (mock)
- [ ] สร้าง MySQL schema:
  - [ ] users (id, username, password, role)
  - [ ] resize_quota (user_id, date, used_count)
  - [ ] image_logs (optional)

---

### ✅ วันที่ 2–3: Node.js Backend (Express)
- [ ] ตั้งค่า Express + JWT Auth
- [ ] API:
  - [ ] POST /register
  - [ ] POST /login
  - [ ] GET /me (ข้อมูลตนเอง)
  - [ ] POST /resize (mock ส่งไป Python)
  - [ ] POST /reset-quota/:userId (เฉพาะ admin/superuser)

---

### ✅ วันที่ 4: ระบบจำกัด quota
- [ ] Middleware ตรวจ quota (5 ครั้ง/วัน/คน)
- [ ] Insert/Update quota หลังใช้งาน
- [ ] API แสดง quota ที่เหลือ

---

## 💻 สัปดาห์ที่ 2: React Frontend

### ✅ วันที่ 5–6: React Auth & Layout
- [ ] สร้าง React app (Vite หรือ CRA)
- [ ] หน้า Login / Register
- [ ] JWT Token ใน localStorage
- [ ] Routing แยก role (admin/user/superuser)

---

### ✅ วันที่ 7: หน้าใช้งาน user
- [ ] ปุ่มอัปโหลดภาพ (ส่งไป `/resize`)
- [ ] แสดง quota คงเหลือ

---

### ✅ วันที่ 8: หน้า admin/superuser
- [ ] ดูรายชื่อ user ทั้งหมด
- [ ] ปุ่ม reset quota
- [ ] เงื่อนไขสิทธิ์: superuser เท่านั้นที่ลบ admin/superuser ได้

---

## 🧠 สัปดาห์ที่ 3: Python API เชื่อม Node

### ✅ วันที่ 9: สร้าง Python backend
- [ ] FastAPI หรือ Flask รับภาพ + ขนาด
- [ ] Resize และส่งภาพกลับ
- [ ] ทดสอบแยกด้วย curl หรือ Postman

---

### ✅ วันที่ 10: เชื่อม Node.js → Python
- [ ] ส่งภาพจาก Node ไป Python
- [ ] รับผลลัพธ์ (image) กลับมาส่ง React
- [ ] ให้ React แสดง/ดาวน์โหลดภาพที่ resize

---

## 🧩 สัปดาห์ที่ 4: ปรับปรุงระบบ

### ✅ วันที่ 11–12:
- [ ] Modal ยืนยันก่อนลบหรือแก้ไข
- [ ] เพิ่มระบบ log (optional)
- [ ] Validation form (React Hook Form, Yup)

---

### ✅ วันที่ 13–14:
- [ ] ปรับ UI ให้สวยงาม (TailwindCSS)
- [ ] Toast / แจ้งเตือน / Loading UI
- [ ] ตรวจสอบความปลอดภัย & ความเสถียร

---

## 🎁 เสริมในอนาคต (Optional)
- [ ] Email Verification / Reset Password
- [ ] รองรับไฟล์หลากหลาย (.jpg/.png/.webp)
- [ ] Resize เป็น batch (หลายภาพ)
- [ ] ระบบ dark mode / multi-language

