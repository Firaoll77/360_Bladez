<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Project notes (360_Bladez)

- Package name is `360-bladez` (directory `360_Bladez` is not a valid npm name).
- Commands: `npm run dev`, `npm run build`, `npm run lint`, `npm test` (vitest), `npm run db:seed`.
- DB: Prisma 6 + SQLite (`prisma/dev.db`). Schema: `prisma/schema.prisma`.
- Env: `DATABASE_URL`, optional `ADMIN_KEY`, optional `CLOUDINARY_*`.
- Scheduling is EAT-local: appointments store `date` (YYYY-MM-DD) + `startMin`. See `src/lib/time.ts`, `src/lib/ethiopian.ts`, `src/lib/bookings.ts`.
