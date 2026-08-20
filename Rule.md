# Project Rules

กฎเหล่านี้ Claude Code ต้องปฏิบัติตามทุกครั้งเมื่อทำงานในโปรเจกต์นี้

---

## R1 — Document Solved Problems

**เมื่อเจอปัญหา (bug, error, build failure, หรือ unexpected behavior) แล้วแก้ได้สำเร็จ ต้องเพิ่มวิธีแก้ลงในส่วน `## Common Pitfalls` ของ `CLAUDE.md` ทันที**

### ทำไม
เพื่อไม่ให้ทำผิดซ้ำอีกในอนาคต และให้ Claude session ใหม่รู้วิธีหลีกเลี่ยงตั้งแต่แรก

### วิธีบันทึก
เพิ่ม bullet ใหม่ใน `CLAUDE.md` ในรูปแบบ:

```
- **<ชื่อปัญหาสั้นๆ>** — <อาการ/Error message> → <วิธีแก้ + เหตุผล>
```

ตัวอย่าง:
```
- **RLS infinite recursion (42P17)** — `SELECT` จาก `profiles` ใน policy subquery → ใช้ `is_staff()` function แทน
```

### เมื่อไหร่ต้องบันทึก
- เจอ error แล้วแก้ได้และใช้เวลาแก้นานกว่าจะเจอ root cause
- เจอ Next.js 16 / Supabase / Tailwind v4 quirk ที่ไม่ชัดเจนจาก docs
- เจอ RLS policy ที่ต้องใช้ helper function แทน direct query
- เจอ convention ที่ขัดกับ training data (เช่น `proxy.ts` ไม่ใช่ `middleware.ts`)

### เมื่อไหร่ไม่ต้องบันทึก
- Error ที่แก้ง่ายและชัดเจน (เช่น typo, missing import)
- Error ที่มีอยู่แล้วใน docs
- Error ที่เป็น one-off ไม่กระทบ pattern

---

## R2 — Ask Before Git Commit / Push

**ทุกครั้งที่จะ `git commit` หรือ `git push` ต้องถาม user ให้อนุมัติก่อนเสมอ** — ห้าม commit/push เองโดยไม่ได้รับ explicit approval

### ทำไม
- ป้องกัน unintended commits ที่อาจมี code ไม่พร้อม, secrets, หรือไฟล์ที่ไม่ตั้งใจ
- ให้ user ตรวจสอบก่อน commit เข้า history (especially master branch)
- `git push` มี side effect ไปยัง remote — เป็น side effect ที่ norms บอกว่าต้องถาม

### วิธีปฏิบัติ
- **ก่อน commit**: รวบรวมไฟล์ที่จะ commit + แสดง diff stat + commit message ที่จะใช้ → ถาม "OK to commit?" ก่อนรัน `git commit`
- **ก่อน push**: ถาม "OK to push to <remote>/<branch>?" ก่อนรัน `git push` — ระบุ branch ปลายทางชัดเจน
- ถ้า user บอก "commit ได้เลย" / "push ได้" → ทำได้ แต่ยังต้องแสดง commit message ก่อน

### Exception
- ถ้า user ระบุชัดเจนในคำสั่งเดียวว่า "commit แล้ว push" และระบุ message/branch → ทำได้ทันที
- การ commit **ภายใน** worktree ที่แยกออกมา (เช่น `.claude/worktrees/...`) ที่ยังไม่ได้ merge กลับ → ต้องถามเหมือนกัน

### ห้ามทำ
- ❌ ห้าม commit แล้ว push ติดกันในขั้นตอนเดียวโดยไม่ถาม
- ❌ ห้าม commit ไฟล์ที่ user ไม่ได้ขอให้ commit
- ❌ ห้าม commit ลง branch `main` / `master` โดยตรงโดยไม่ได้รับ consent