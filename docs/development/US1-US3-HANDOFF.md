# US-1 / US-2 / US-3 — Frontend foundation

โครง Next.js App Router + TypeScript สำหรับเพื่อนแยกทำแต่ละ user story ต่อ โดยอ้างอิงภาพ mockup ที่ส่งมา โค้ดนี้เป็น **interactive mockup** ยังไม่ใช่ระบบพร้อมใช้งานจริง

## เริ่มงานโดยไม่ต้องเปิด API หรือฐานข้อมูล

ใช้ Node.js 24 ตาม CI ของ repository แล้วรันจาก root:

```bash
npm --prefix apps/web ci
npm --prefix apps/web run dev
```

เปิด http://localhost:3000/workspace สำหรับสมาชิก (จะไปหน้า My requests) หรือ http://localhost:3000/ta สำหรับพื้นที่จัดการ TA (จะไปหน้า TA Queue)

| User story | URL | โฟลเดอร์ที่เจ้าของฟีเจอร์แก้ |
| --- | --- | --- |
| US-1 Request Submission | `/workspace/requests/new` | `apps/web/src/features/request-submission/` |
| US-2 My Requests | `/workspace/my-requests` | `apps/web/src/features/my-requests/` |
| US-3 TA Queue | `/ta/queue` | `apps/web/src/features/ta-queue/` |

หน้า `/` และ `apps/web/src/lib/api.ts` เป็น integration เดิมที่ต้องเปิด Express API และ PostgreSQL ด้วย ส่วน `/workspace` และ `/ta` ใช้ mock data เท่านั้น

## ส่วนกลางและขอบเขตของ mockup

- `src/components/workspace/`: sidebar, header, dialog และ stylesheet ของ workspace
- `src/components/ta/TaShell.tsx`: sidebar และ header ของพื้นที่จัดการ TA แยกจากสมาชิก ไม่มีปุ่มสร้างคำขอ
- `src/features/requests/`: TypeScript contracts, sample data, provider และตาราง/filter/detail ที่ใช้ร่วมกัน
- `src/app/workspace/`: route ของ US-1 / US-2; `src/app/ta/`: route และ layout ของ US-3
- ข้อมูลเก็บใน React context เฉพาะฝั่งสมาชิก: submit แล้วเห็นรายการใหม่ใน My requests เมื่อ refresh จะกลับเป็น sample data ไม่มีการเขียน API, localStorage หรือฐานข้อมูล
- TA Queue ใช้ sample data แยกจาก session ของสมาชิก ไม่มีการส่งคำขอข้ามฝั่ง ไม่มี action มอบหมาย/เปลี่ยนสถานะจริง เหลือเพียงการลองดูตาราง กรอง และเปิดรายละเอียด
- `/workspace/ta-queue` เป็น redirect รองรับลิงก์เก่าเท่านั้น ไม่มีเมนู TA อยู่ใน workspace สมาชิก
- ตัวอย่าง My requests ใช้ Theewasu A. และคิว Assigned to me ใช้ Kantee L. เป็นผู้ใช้จำลอง ไม่ใช่ระบบ login หรือการตรวจสิทธิ์
- สี สถานะ ฟิลด์ และข้อความอ้างอิงภาพ; ไม่รวม login, approval actions, archive, export หรือส่วนงานของสมาชิกคนอื่น

## งานที่แต่ละคนทำต่อ

### US-1

เพิ่ม API adapter สำหรับ submit, สถานะ pending/error/success จริง, server-side validation และผู้สร้างจาก authenticated session แทน mock member ตรวจสอบข้อกำหนด category, priority, location, needed-by และ manager approval กับทีมก่อนเพิ่ม database migration

### US-2

โหลดคำขอของผู้ใช้ปัจจุบันจาก backend พร้อม loading/error/empty state, pagination จาก API และรายละเอียดคำขอจริง การกรองเจ้าของต้องบังคับที่ server; client filter ใน mockup ใช้สาธิตเท่านั้น

### US-3

ทำงานใน `/ta/queue` และ `src/features/ta-queue/` โดยใช้ layout ของ TA เอง โหลดคิว TA และงานที่ได้รับมอบหมายจาก backend เพิ่ม assignment/status workflow ตามขอบเขตที่ตกลงกับทีมและบังคับสิทธิ์ TA ที่ server (มี TODO ใน `src/app/ta/layout.tsx`) การแยก URL ไม่ใช่การป้องกันสิทธิ์ ปุ่ม All requests / Assigned to me ใน mockup เป็นเพียงการกรอง sample data

## API contract ที่ต้องตกลงร่วมกันก่อนเชื่อมจริง

API ปัจจุบันใช้ Express + Prisma + **PostgreSQL** (ดู `apps/api/prisma/schema.prisma` และ `docker-compose.yml` เป็นหลัก; README เดิมบางส่วนยังกล่าวถึง MongoDB)

| Mockup | API ปัจจุบัน | งานต่อ |
| --- | --- | --- |
| `category`: equipment / space / consumable / access / visitor / general | `type` ใช้ค่าเดียวกัน | map ชื่อฟิลด์ใน adapter |
| Pending / Assigned / In progress / Closed | submitted / under_review / approved / rejected / cancelled | คนละแนวคิด: execution status กับ approval status; ตกลง model ก่อน ห้าม map approved เป็น Closed โดยอัตโนมัติ |
| `requester` และ `assignee` เป็นคนจำลอง | `requesterEmail` อย่างเดียว | เพิ่ม users, session และ assignment ที่ backend |
| `priority`, `location`, `requiresApproval` | ยังไม่มี | เพิ่ม schema, validation และ migration ร่วมกัน |
| `neededBy` เป็นวันที่ `YYYY-MM-DD` | `neededBy` เป็น DateTime และ nullable | กำหนด date/timezone convention; ห้ามแปลงวันที่จนเลื่อนวัน |
| `id` เช่น LAB-0001 | UUID | แยก display reference ออกจาก database ID |

Mock contracts จงใจแยกจาก `src/lib/api.ts` ซึ่งมี `server-only` อย่านำ API module ไป import ใน client component โดยตรง

## แตก branch แยกฟีเจอร์

Foundation อยู่ใน branch `codex/us1-us3-foundation` ในเครื่องนี้ ต้อง commit / push และ merge foundation เข้า `main` ก่อนให้เพื่อนเริ่ม เพื่อให้ทุกคนมีฐานเดียวกัน (ขั้นตอนนี้ยังไม่ได้ทำแทนให้)

หลัง foundation เข้า main แล้ว แต่ละคนรัน:

```bash
git switch main
git pull --ff-only origin main
git switch -c codex/us1-request-submission
```

เพื่อนคนที่ทำ US-2 ใช้ `codex/us2-my-requests`; คนที่ทำ US-3 ใช้ `codex/us3-ta-queue` แล้วเปิด PR ของแต่ละฟีเจอร์กลับเข้า `main`

ถ้าต้องเริ่มก่อน merge ให้แตกจาก **commit ของ foundation ที่ push แล้ว** ทุกคนต้องใช้ commit เดียวกัน อย่าแตกจาก main เก่าที่ยังไม่มีโครงนี้

เจ้าของฟีเจอร์ควรแก้ในโฟลเดอร์ของตัวเอง ใช้ CSS Module ของฟีเจอร์สำหรับ style ใหม่ หากต้องเปลี่ยน shared contracts/provider/table ให้คุยกับทีมและแยก PR ส่วนกลาง เพื่อลด merge conflict

## ตรวจงานก่อนเปิด PR

```bash
npm --prefix apps/web run lint
npm --prefix apps/web run typecheck
npm --prefix apps/web run build
```

ลอง submit ข้อมูลครบและไม่ครบ, ตรวจว่ารายการใหม่ปรากฏใน My requests, เปิด TA แยกเพื่อลองค้นหา/กรอง sample data, สลับ Assigned to me, เปิดรายละเอียด, ปิด dialog ด้วย Escape และลองหน้าจอมือถือ ก่อนเชื่อม API ต้องเพิ่ม integration tests สำหรับ authorization และ workflow จริงด้วย

### ผลตรวจ foundation (11 September 2026)

- Web ESLint, TypeScript และ production build ผ่าน
- หลังแยก TA: ตรวจว่าเมนูสมาชิกไม่มี TA, `/ta` เปิด console แยกโดยไม่มี New request, ลิงก์เก่า redirect ไป `/ta/queue`, Assigned to me และ dialog รายละเอียดยังทำงาน
- ทดลองใน browser รอบแรก: ฟอร์มว่างส่งไม่ได้; ส่งคำขอแล้วปรากฏใน My requests; รายละเอียดแสดง description, location และ approval flag ถูกต้อง
- ตรวจ Assigned to me ได้เฉพาะ 2 งานที่ยังไม่ปิดของ TA ตัวอย่าง, pagination, priority/category/status filters, การค้นหาไม่พบ, clear filters และเรียง due date
- ตรวจการปิด dialog ด้วย Escape / Cancel และ refresh กลับเป็น sample data
- ตรวจ layout ที่ viewport 390 × 844 และแก้ horizontal overflow ของหน้าหลักแล้ว ตารางเลื่อนแนวนอนภายในกรอบของตัวเอง
- ยังไม่ได้ทดสอบ backend integration / authentication เพราะอยู่นอกขอบเขต foundation นี้

หมายเหตุ: root layout เดิมใช้ Google Fonts; build ครั้งแรกต้องเข้าถึง fonts.googleapis.com ได้
