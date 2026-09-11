# US-1 / US-2 / US-3 — Handoff

โครง Next.js + TypeScript เชื่อม Member และ TA ผ่าน Express + Prisma + PostgreSQL แล้ว ดู [วิธีรัน local โดยไม่ใช้ Docker และขั้นตอนพรีเซนต์](LOCAL-DEMO.md)

| User story | Route | Feature directory |
| --- | --- | --- |
| US-1 Submission | `/workspace/requests/new` | `apps/web/src/features/request-submission/` |
| US-2 My Requests | `/workspace/my-requests` | `apps/web/src/features/my-requests/` |
| US-3 TA Queue | `/ta/queue` | `apps/web/src/features/ta-queue/` |

## ส่วนกลางที่เชื่อมแล้ว

- `components/workspace/` และ `components/ta/` แยกเมนู/หน้าตา Member และ TA; route เก่า `/workspace/ta-queue` redirect ไป TA
- `features/requests/actions.ts`: Server Actions เรียก API และ map category/type, dates, requester/assignee
- `RequestsProvider.tsx`: shared API state, loading/error/success, refresh เมื่อเข้า/กลับหน้าและทุก 4 วินาที ไม่มี mock fallback
- `RequestTable.tsx`: ตาราง, filters, pagination, details ที่อัปเดตตามข้อมูลล่าสุด
- `demo-identity.ts`: fixed member/TA สำหรับพรีเซนต์ ไม่ใช่ระบบ login
- POST บันทึกฟิลด์ฟอร์มครบใน PostgreSQL; TA Claim / Start work / Mark closed บันทึกผู้รับงานและสถานะจริง ใช้ atomic update ป้องกัน stale action และแย่งรับงาน
- ดู [status contract](REQUEST-STATUS-CONTRACT.md) สำหรับ enum และ migration

## งานที่เพื่อนทำต่อ

- US-1: ใช้ requester จาก authenticated session, เพิ่ม validation/business rules ตาม requirement และทดสอบสิทธิ์ submit
- US-2: ใช้ session ownership และบังคับที่ backend, เพิ่ม API pagination หากข้อมูลมาก
- US-3: ใช้ TA identity/role จาก session, ทำกฎ assignment/approval ตามที่ทีมตกลง
- Login: เพิ่ม user model และ session; ตรวจทั้ง Server Actions และ API ไม่ใช่เพียงซ่อนเมนู การส่ง email หรือการแยก URL ไม่ใช่ authorization
- Approval: ยังไม่มีหน้า Lab Manager/approval gate; สถานะอนุมัติแยกจากงานและไม่เปลี่ยนอัตโนมัติเมื่อปิดงาน
- `mock-data.ts` เป็น fixture เก่าสำหรับอ้างอิงภาพ ไม่มีการ import ในหน้าที่เชื่อมแล้ว

## แยก branch

หลัง merge งานส่วนกลางเข้า main แล้ว แต่ละคนใช้:

```bash
git switch main
git pull --ff-only origin main
git switch -c features/login
```

เปลี่ยนชื่อ branch ตามฟีเจอร์ เช่น `features/request-submission`, `features/my-requests`, `features/ta-queue` แล้วทำ PR กลับ main นัดกันก่อนแก้ shared types, migrations, provider, API client และ shared CSS เพื่อลด conflict

## ตรวจงานก่อน PR

รัน lint/typecheck/build และ contract tests ตาม [LOCAL-DEMO.md](LOCAL-DEMO.md) จากนั้นทดสอบ Member submit → TA claim/start/close → Member เห็นสถานะเดียวกัน ตรวจการ refresh, ความคงอยู่หลัง restart และ API error

API tests ใช้ PostgreSQL แยกชื่อท้าย `_test` เท่านั้น (tests ล้างข้อมูล) มีกรณี flow ครบ, ownership filter, approval/work แยกกัน, concurrent claims และ stale actions
