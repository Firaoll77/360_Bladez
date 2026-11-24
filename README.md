# 360_Bladez

Barbershop booking site for Addis Ababa — "The Art of the Cut."

Next.js 16 (App Router) · TypeScript · Tailwind CSS v4 · Prisma + SQLite · Vitest

## Features

- Landing page (hero, services, barbers, hours) in the TrimSync-inspired light theme
- 4-step booking flow: service → barber → time slot → details + payment proof upload
- Ethiopian (Ge'ez) calendar display + all scheduling pinned to Africa/Addis_Ababa (EAT)
- "My Bookings" lookup/cancel by phone number
- Admin dashboard (staff login via `ADMIN_KEY`) with status management and payment-proof review
- Payment proof uploads → Cloudinary when configured, local `public/uploads` fallback otherwise

## Getting started

```bash
npm install          # also runs prisma generate via postinstall
npx prisma migrate dev
npm run db:seed
npm run dev
```

Open http://localhost:3000

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Dev server |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm test` | Vitest unit tests |
| `npm run db:seed` | Seed services & barbers |

## Environment

See `.env.example`. Required: `DATABASE_URL`. Optional: `ADMIN_KEY` (staff login), `CLOUDINARY_*` (proof uploads).

## Notes

- All appointment times are stored as EAT-local `date` (YYYY-MM-DD) + `startMin` (minutes since midnight) — unambiguous regardless of server timezone.
- Ethiopian calendar conversion lives in `src/lib/ethiopian.ts` (JDN-based, verified against Enkutatash anchors).
- Double-booking is prevented by an overlap check inside a Prisma transaction in `src/lib/bookings.ts`.
