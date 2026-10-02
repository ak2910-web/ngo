# EarthKind NGO

A highly animated, mobile-first NGO website with a unified global search. The frontend works as a beautiful static showcase even before the API is running; once connected, the search, forms, and content are powered by Express and MongoDB.

## Run it

1. Start MongoDB locally, or set a MongoDB Atlas URI.
2. In `backend`, copy `.env.example` to `.env`, fill in the values, then run `npm install`, `npm run seed`, and `npm run dev`.
3. Serve `frontend` through any static server. For example, from `frontend`: `npx serve -l 3000`.
4. Open `http://localhost:3000`.

## What is included

- Animated hero search with debounced, grouped live results and full search results overlay.
- Search aggregation across projects, events, volunteer records, gallery tags, and key site pages at `GET /api/search?q=`.
- Scroll reveals, counters, donation progress, card interactions, responsive navigation, modal forms, and reduced-motion support.
- Public REST form APIs with rate limiting and simple server-side validation.
- JWT-protected admin endpoints for dashboard data, CRUD for projects/events/gallery/volunteers, popular-search analytics, and CSV exports.
- Sample seed data. Seeded development admin: `admin@earthkind.org` / `EarthKind2026!` (change this immediately outside local development).

## API overview


Public: `/api/projects`, `/api/events`, `/api/gallery`, `/api/search?q=`, `/api/volunteers`, `/api/contact`, `/api/survey`.

Authentication foundation: `POST /api/auth/register`, `POST /api/auth/login` (backward-compatible admin login plus user/NGO account lookup), `POST /api/auth/ngo/register`, `POST /api/auth/ngo/login`, `POST /api/auth/admin/login`, `GET /api/auth/me`, `POST /api/auth/logout`, `POST /api/auth/forgot-password`, and `POST /api/auth/reset-password`.

Admin requests require `Authorization: Bearer <token>` from `/api/auth/login`. Use `/api/admin/dashboard`, `/api/admin/{projects|events|gallery|volunteers}`, and `/api/admin/export/{volunteers|contacts|surveys}`.

Phase 1 adds Mongoose models for users, NGOs, categories, volunteer opportunities and applications, event registrations, impact reports, notifications, saved items, and password reset tokens. Demo seed records are marked with `isDemo: true` or `[DEMO DATA]`. Demo credentials are printed by `npm run seed`; do not use them outside local development.
