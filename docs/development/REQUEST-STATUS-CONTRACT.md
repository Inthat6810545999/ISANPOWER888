# Request status contract

Frontend และ backend ใช้สถานะตรงกันแล้ว หน้า `/workspace` และ `/ta` อ่าน/เขียน API และ PostgreSQL เดียวกัน ดู [คู่มือ local](LOCAL-DEMO.md)

## แยกสองสถานะ

| Field | Values | ความหมาย |
| --- | --- | --- |
| `status` | `pending`, `assigned`, `in_progress`, `closed`, `cancelled` | สถานะการดำเนินงาน |
| `approvalStatus` | `not_required`, `submitted`, `under_review`, `approved`, `rejected`, `cancelled` | สถานะอนุมัติ |

การอนุมัติ (`approved`) ไม่ได้หมายความว่างานเสร็จ (`closed`) การ PATCH สถานะหนึ่งจะไม่เปลี่ยนอีกสถานะอัตโนมัติ `cancelled` ใน `status` คือยกเลิกงาน ส่วนใน `approvalStatus` คือยกเลิกขั้นตอนอนุมัติ

- คำขอใหม่เริ่ม `status: pending`
- `requiresApproval: false` → `approvalStatus: not_required`
- `requiresApproval: true` → `approvalStatus: submitted`
- frontend ใช้ `src/lib/request-status.ts` ร่วมกันทั้ง API client และหน้าตัวอย่าง
- `npm --prefix apps/web run test:contracts` (Node.js 24) ตรวจ enum ระหว่าง frontend, API และ Prisma เพื่อจับการแก้สถานะไม่ครบทุกฝั่ง

## API

`POST /api/requests` รับ:

```json
{
  "title": "Calibrate oscilloscope",
  "description": "Prepare equipment for the next session.",
  "type": "equipment",
  "requesterEmail": "student@example.com",
  "priority": "high",
  "location": "Lab B2",
  "neededBy": "2026-10-15",
  "requiresApproval": true
}
```

`priority` ใช้ `low | medium | high` (default `medium`), `location` default `""`, `requiresApproval` default `false` ค่าเริ่มต้นของสองสถานะถูกกำหนดโดย server; ห้ามส่ง `status` หรือ `approvalStatus` มากับ POST

| Method | URL | Body / query |
| --- | --- | --- |
| PATCH | `/api/requests/:id/status` | `{ "status": "in_progress" }` |
| PATCH | `/api/requests/:id/approval-status` | `{ "approvalStatus": "approved" }` |
| GET | `/api/requests` | `?status=pending&approvalStatus=submitted&type=equipment` (เลือกกรองเฉพาะบางฟิลด์ได้) |

ค่าผิดประเภท เช่น `status: approved` หรือ `approvalStatus: closed` จะตอบ 400 การเปลี่ยน approval ต้องสอดคล้องกับ `requiresApproval` ของรายการด้วย

**Breaking change:** client เดิมที่ส่ง `status: approved` ต้องเปลี่ยนไปใช้ `/approval-status` และ `{ approvalStatus: "approved" }` ก่อนใช้งานร่วมกับ API เวอร์ชันนี้

## ย้ายข้อมูลเดิม

Migration `20260912000000_separate_request_status`:

1. ย้ายสถานะเดิมไป `approvalStatus` โดยรักษาทุกค่าไว้
2. ตั้ง `status` ของข้อมูลเดิมเป็น `pending` เพราะฐานข้อมูลเดิมไม่มีข้อมูลความคืบหน้างานให้อนุมาน ส่วนรายการที่เคย `cancelled` จะมีสถานะงาน `cancelled`
3. ตั้ง `requiresApproval: true` สำหรับข้อมูลเดิม เพื่อรักษา workflow อนุมัติที่ระบบเดิมใช้ ข้อมูลเดิมที่ได้รับอนุมัติจะยัง `approvalStatus: approved` และไม่ถูกทำให้ `closed`
4. เติม `priority: medium` และ `location: ""` ให้ข้อมูลเดิม

ควรตรวจสถานะงานของรายการเก่าหลัง migration โดยเฉพาะรายการที่งานอาจดำเนินไปแล้ว แต่ระบบเดิมไม่ได้เก็บข้อมูลนั้น

เมื่อพร้อมอัปเดตฐานข้อมูลเป้าหมาย ให้หยุด API เดิมชั่วคราว ตั้ง `DATABASE_URL` ให้ถูกต้อง แล้วรันจาก `apps/api`:

```bash
npx prisma migrate deploy
npx prisma generate
npm run dev
```

ไม่ต้อง `migrate reset` และไม่ต้องลบ volume ข้อมูล การทดสอบของงานนี้จะใช้ฐานข้อมูลแยก ไม่ deploy migration เข้า database ของผู้ใช้โดยอัตโนมัติ

## Member และ TA integration

เพิ่ม `assigneeEmail` (nullable) และ index ใน migration `20260912010000_request_assignment` ข้อมูลเดิมยังอยู่ ผู้รับงานเดิมที่ไม่เคยบันทึกจะเป็น null

GET `/api/requests?requesterEmail=...` กรองคำขอของสมาชิก (email lowercase)

PATCH `/api/requests/:id/ta-action` รับ `{ assigneeEmail, action }`:
- `claim`: pending + ไม่มีผู้รับงาน → assigned + ผู้รับงาน
- `start`: assigned + ผู้รับงานตรงกัน → in_progress
- `close`: in_progress + ผู้รับงานตรงกัน → closed

ตรวจสถานะเดิมและผู้รับงานด้วย atomic update; action ซ้ำ/เจ้าของไม่ตรงคืน 409, ไม่พบคืน 404 โดยไม่เปลี่ยนข้อมูล สถานะอนุมัติยังคงเดิม

Server Action เลือก fixed demo member/TA; ยังต้องเพิ่ม authenticated session และ role checks รวมถึงตกลง approval gate ก่อนใช้งานจริง endpoint `/status` เดิมยังคงไว้สำหรับหน้า API ทดลอง `/` ไม่ใช่ TA workflow

## ตรวจงาน

```bash
npm --prefix apps/web run test:contracts
npm --prefix apps/web run lint
npm --prefix apps/web run typecheck
npm --prefix apps/web run build
npm --prefix apps/api run lint
npm --prefix apps/api run typecheck
npm --prefix apps/api run build
```

API integration tests ต้องตั้ง `DATABASE_URL` ไปฐานข้อมูลทดสอบชื่อที่ลงท้าย `_test` แล้ว `npm --prefix apps/api test` ชุดทดสอบล้างรายการระหว่าง test จึงห้ามชี้ไปฐานข้อมูลใช้งานจริง

ผลตรวจงานรอบนี้: lint / typecheck / build ผ่านทั้ง web และ API, contract tests 4 ข้อผ่าน, API integration tests 20 ข้อผ่านบน PostgreSQL 16 ชั่วคราว และทดสอบ migration กับข้อมูลเก่าครบ 5 ค่าแล้ว สถานะอนุมัติและจำนวนแถวคงเดิม รวมถึงรายการ approved ไม่ถูกปิดงานอัตโนมัติ apply migration กับฐานข้อมูล local เดโม่แยกที่พอร์ต 55432 แล้ว โดยไม่แตะฐานข้อมูลเดิมของผู้ใช้
