# ISANPOWER888 Web

Next.js App Router + React + TypeScript. ใช้ Node.js 24 ตาม CI ของโปรเจกต์

```bash
npm ci
npm run dev
```

เปิด **http://localhost:3000/workspace** สำหรับเดโม่สมาชิก (US-1 / US-2) และ **http://localhost:3000/ta/queue** สำหรับเดโม่พื้นที่จัดการ TA (US-3) โดยไม่ต้องเปิด API หรือฐานข้อมูล ทั้งสองฝั่งแยก layout และเมนู ไม่ได้เป็นระบบ login / authorization จริง

| Feature | Route | Entry component |
| --- | --- | --- |
| US-1 Request Submission | `/workspace/requests/new` | `src/features/request-submission/RequestSubmission.tsx` |
| US-2 My Requests | `/workspace/my-requests` | `src/features/my-requests/MyRequests.tsx` |
| US-3 TA Queue | `/ta/queue` | `src/features/ta-queue/TaQueue.tsx` |

ส่วนกลางอยู่ใน `src/components/workspace/` และ `src/features/requests/` โดย route เรียก component ของแต่ละฟีเจอร์เท่านั้น ฝั่งสมาชิกใช้ `src/app/workspace/layout.tsx` ส่วน TA ใช้ `src/app/ta/layout.tsx` และ `src/components/ta/TaShell.tsx`

US-1 ส่งข้อมูลจำลองให้ US-2 ดูได้ใน session เดียวกัน เมื่อ refresh จะรีเซ็ต ส่วน US-3 ใช้ sample data ของตัวเอง ไม่มีการส่งข้อมูลข้ามฝั่งหรือดำเนินการจัดการจริง URL เดิม `/workspace/ta-queue` redirect ไป `/ta/queue` เพื่อรองรับลิงก์เก่า

หน้า `/` เป็นหน้าทดลอง API เดิม ใช้ `API_BASE_URL` จาก `.env.example` และต้องมี Express API พร้อม PostgreSQL

อ่าน [คู่มือส่งต่องานและแตก branch](../../docs/development/US1-US3-HANDOFF.md) สำหรับขอบเขตงานแต่ละคน, API contract ที่ยังไม่ตรงกับ mockup และขั้นตอนรวม foundation ก่อนแยกฟีเจอร์

## ตรวจงาน

```bash
npm run lint
npm run typecheck
npm run build
```
