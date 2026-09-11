# ISANPOWER888 Web

Next.js App Router + React + TypeScript ใช้ Node.js 24

Member (`/workspace/my-requests`) และ TA (`/ta/queue`) ใช้ API และ PostgreSQL เดียวกันแล้ว ให้เปิด PostgreSQL และ API ก่อน แล้วรันจากโฟลเดอร์ apps/web:

```powershell
npm ci
npm run dev -- --hostname 127.0.0.1 --port 3000
```

ดู [คู่มือ local](../../docs/development/LOCAL-DEMO.md) สำหรับการรันแยก terminal, demo walkthrough และขอบเขตเรื่อง identity/approval

| Feature | Route | Entry component |
| --- | --- | --- |
| US-1 Submission | `/workspace/requests/new` | `src/features/request-submission/RequestSubmission.tsx` |
| US-2 My Requests | `/workspace/my-requests` | `src/features/my-requests/MyRequests.tsx` |
| US-3 TA Queue | `/ta/queue` | `src/features/ta-queue/TaQueue.tsx` |

`src/features/requests/actions.ts` เป็น Server Action และ API adapter; `RequestsProvider` โหลด/refresh ข้อมูลทุก 4 วินาที; `demo-identity.ts` เป็นตัวตนเดโม่ที่ต้องแทนด้วย session ในงาน login ส่วน `src/lib/api.ts` ใช้ server-only อย่า import ตรงจาก client component

Frontend อย่างเดียวใช้ `npm ci` แล้ว `npm run dev` แต่ต้องมี API ที่ `API_BASE_URL` (default http://localhost:4000) และฐานข้อมูล หาก backend ไม่พร้อมจะแสดง error ไม่ fallback เป็น mock

ตรวจด้วย `npm run lint`, `npm run typecheck`, `npm run test:contracts`, `npm run build`
