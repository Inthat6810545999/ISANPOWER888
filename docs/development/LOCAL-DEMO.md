# Local presentation demo (Member + TA)

ใช้ Node.js 24, PostgreSQL และ PowerShell บน Windows เปิดบริการแยกกัน ไม่ต้องใช้ Docker หรือสคริปต์เปิดระบบ

## ตั้งค่าครั้งแรก

1. เปิด PostgreSQL ที่ติดตั้งในเครื่องให้ทำงาน (Windows Services) และเชื่อมผ่าน pgAdmin ด้วย username/password ของคุณ
2. สร้าง database ชื่อ `isanpower_local` ใน pgAdmin (Databases → Create → Database) หรือรัน `CREATE DATABASE isanpower_local;` ใน Query Tool ของฐานข้อมูล postgres
3. สร้าง `apps/api/.env` โดยคัดลอกจาก `.env.example` แล้วแก้:

```dotenv
NODE_ENV=development
HOST=127.0.0.1
PORT=4000
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@127.0.0.1:5432/isanpower_local
CORS_ORIGIN=http://127.0.0.1:3000
```

เปลี่ยน `postgres`, `YOUR_PASSWORD` และพอร์ตให้ตรงกับ PostgreSQL ของคุณ รหัสผ่านที่มีอักขระพิเศษต้อง URL-encode ส่วนรหัสผ่านใน URL ไม่ใช้ค่าตัวอย่างเป็นรหัสผ่านจริง

4. สร้าง `apps/web/.env.local`:

```dotenv
API_BASE_URL=http://127.0.0.1:4000
```

ฐานข้อมูล `isanpower_local` ที่สร้างใหม่จะเริ่มว่าง ข้อมูลเดโม่เดิมที่พอร์ต 55432 ไม่ได้ถูกย้ายหรือลบ ยังเก็บใน `%LOCALAPPDATA%\ISANPOWER888-local\pgdata` การลบไฟล์สคริปต์ไม่ได้ลบฐานข้อมูลนั้น

## Terminal 1 — Backend

เปิดจาก root ของ repository:

```powershell
cd apps/api
npm ci
npx prisma generate
npx prisma migrate deploy
npm run dev
```

`npm ci` ใช้ครั้งแรกหรือเมื่อ dependencies เปลี่ยน; `prisma generate` และ `migrate deploy` ใช้หลัง schema/migrations เปลี่ยน จากนั้นวันถัดไปใช้แค่ `cd apps/api` และ `npm run dev` เมื่อ PostgreSQL เปิดแล้ว

## Terminal 2 — Frontend

เปิด terminal ใหม่จาก root ของ repository:

```powershell
cd apps/web
npm ci
npm run dev -- --hostname 127.0.0.1 --port 3000
```

ครั้งต่อไปไม่ต้อง `npm ci` หาก dependencies ไม่เปลี่ยน ต้องเปิดสอง terminal ค้างไว้ กด Ctrl+C ในแต่ละ terminal เพื่อหยุด หากเคยเปิดเดโม่ชุดก่อนหน้าไว้ ให้หยุดตัวเดิมก่อนรันซ้ำเพื่อไม่ให้พอร์ต 3000/4000 ชนกัน

- Member: http://127.0.0.1:3000/workspace/my-requests
- TA: http://127.0.0.1:3000/ta/queue
- ตรวจ API/DB: http://127.0.0.1:4000/api/health (ควรได้ database: connected)

## ลองเดโม่ตามลำดับ

1. เปิด Member และ TA คนละแท็บ
2. Member กด New request กรอก title, description, category, priority, location และวันที่ แล้ว Submit
3. จะกลับ My requests พร้อมข้อความสำเร็จหลัง API บันทึกแล้วเท่านั้น สถานะเริ่ม Pending
4. สลับ TA รออัปเดตหรือกด Refresh requests จะเห็น UUID และรายละเอียดเดียวกัน
5. Claim → Assigned to me → Start work → Mark closed
6. กลับ Member สถานะต้องเปลี่ยน Assigned → In progress → Closed ตามขั้นตอนของ TA
7. Refresh หน้าเว็บ หรือหยุดแล้วเปิด backend/frontend ใหม่ รายการยังคงอยู่

หน้าที่เปิดอยู่จะโหลดใหม่ทุก 4 วินาที และเมื่อกลับมาที่แท็บ มีปุ่ม Refresh requests ด้วย หาก API ขัดข้องจะแสดง error และไม่แอบใช้ข้อมูลจำลองแทน ฟอร์มที่บันทึกล้มเหลวเก็บข้อมูลให้แก้/ลองใหม่

## สิ่งที่เชื่อมแล้ว

- `RequestSubmission` → `RequestsProvider` → Server Action → POST `/api/requests`
- My Requests โหลด GET `/api/requests?requesterEmail=member%40isanpower.test`
- TA โหลด GET `/api/requests` จากฐานข้อมูลเดียวกัน
- PATCH `/api/requests/:id/ta-action` รับ `{ action: "claim" | "start" | "close", assigneeEmail }` ใช้ atomic update ตรวจสถานะเดิมและเจ้าของงาน ป้องกันรับงานซ้ำ; conflict คืน 409
- แปลง `category` ↔ `type`, `neededBy` ↔ UTC date (ไม่เลื่อนวัน), email ↔ Person ใน adapter
- งานใช้ `pending / assigned / in_progress / closed / cancelled`; สถานะอนุมัติอยู่ใน `approvalStatus` แยกกัน

## ขอบเขตเดโม่

Member ใช้ `member@isanpower.test` (Theewasu A.) และ TA ใช้ `ta@isanpower.test` (Kantee L.) ที่เลือกใน Server Action ยังไม่มี login/session หรือ authorization จริง การแยก URL และการกรอง email ไม่ใช่ระบบสิทธิ์ ต้องเพิ่ม role checks และใช้ identity จาก session ก่อนใช้งานหลายผู้ใช้หรือ deploy

ยังไม่ทำหน้า Lab Manager หรือ approval gate: requiresApproval เก็บและแสดงสถานะอนุมัติได้ แต่การรับ/เริ่ม/ปิดงานไม่เปลี่ยนผลอนุมัติ ปุ่มจากหน้า API ทดลองเดิม `/` ยังเป็นเครื่องมือแก้สถานะโดยตรง สำหรับพรีเซนต์ให้ใช้สอง URL ข้างบน

ไฟล์ mock-data.ts คงไว้เป็น fixture อ้างอิงเท่านั้น Member/TA ไม่ import ข้อมูลนั้นแล้ว

## ตรวจงาน

```powershell
npm --prefix apps/api run build
npm --prefix apps/api run lint
npm --prefix apps/web run lint
npm --prefix apps/web run typecheck
npm --prefix apps/web run test:contracts
npm --prefix apps/web run build
```

API integration tests: ตั้ง DATABASE_URL ให้ชี้ฐานข้อมูลทดสอบชื่อที่ลงท้าย `_test` แล้วรัน `npm --prefix apps/api test` เท่านั้น เพราะ tests ล้างข้อมูลระหว่างแต่ละข้อ ห้ามใช้ฐานข้อมูลเดโม่หรือฐานข้อมูลจริง

ผลตรวจ local integration: web/API lint, typecheck และ build ผ่าน; contract tests 4 ข้อ และ API integration tests 20 ข้อผ่านบน PostgreSQL แยก ทดสอบผ่าน browser ว่าส่ง Member → TA claim/start/close → Member เห็นสถานะตรงกัน ทดสอบ API หยุดแล้วฟอร์มแสดง error พร้อมคงข้อมูล และ restart PostgreSQL และบริการเดโม่ แล้วคำขอเดิมยังอยู่ ตรวจ Ctrl+C แล้วพอร์ต 3000/4000/55432 ปิดครบ
