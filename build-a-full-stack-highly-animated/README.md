# EarthKind NGO

EarthKind is a mobile-first NGO discovery and management platform. It connects communities with verified nonprofit organizations, projects, volunteer opportunities, and events.

## Run locally

1. Start MongoDB locally or create a MongoDB Atlas database.
2. In `backend`, copy `.env.example` to `.env`.
3. Set `MONGODB_URI`, a long random `JWT_SECRET`, and `FRONTEND_ORIGIN` to the exact URL serving the frontend (for example, `http://localhost:3000`).
4. Configure SMTP (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, and optionally `MAIL_FROM`) to enable password-reset emails.
5. Run `npm install`, `npm run seed` if you need local demo data, and `npm run dev`.
6. Serve the `frontend` folder with a static server, for example `npx serve -l 3000`, then open `http://localhost:3000`.

The deployed frontend/API URLs are configured in the frontend scripts. Update those API constants if you deploy the frontend or backend to different domains. Never commit real credentials or production secrets.

## Main capabilities

- Public discovery of verified NGOs, published projects, events, and volunteer opportunities.
- NGO registration and review by an administrator.
- NGO dashboard for managing projects, opportunities, events, and gallery content after verification.
- Volunteer account registration and login.
- Volunteer opportunity applications, application status tracking, and NGO-side application review.
- Event registration and volunteer-side registration history.
- Password recovery for user, NGO, and administrator accounts using one-time, expiring reset links.
- JWT authentication, password hashing, role checks, login/password-reset rate limiting, and account-session invalidation.
- Admin dashboard APIs, NGO review actions, collection management, and CSV exports.

## Important routes

### Authentication

- `POST /api/auth/register` — create a volunteer account.
- `POST /api/auth/login` — sign in.
- `POST /api/auth/ngo/register` — submit an NGO registration (starts as `PENDING`).
- `POST /api/auth/ngo/login` — NGO login.
- `POST /api/auth/admin/login` — administrator login.
- `GET /api/auth/me` — current account.
- `POST /api/auth/logout` — invalidate current sessions.
- `POST /api/auth/forgot-password` — send a reset link when the account exists and SMTP is configured.
- `POST /api/auth/reset-password` — consume a valid reset token and set a new password.

### Volunteer and events

- `GET /api/opportunities` — list published opportunities from verified NGOs.
- `POST /api/opportunities/:id/apply` — apply (volunteer JWT required).
- `GET /api/me/applications` — list the signed-in volunteer's applications.
- `POST /api/events/:id/register` — register for a published event (volunteer JWT required).
- `GET /api/me/event-registrations` — list event registrations.

The volunteer portal is `frontend/volunteer-hub.html`. Password reset links open `frontend/reset-password.html`.

### NGO and admin

- NGO dashboard APIs are under `/api/ngo/*`; dashboard operations require the NGO status to be `VERIFIED`.
- NGO application review: `GET /api/ngo/applications` and `PUT /api/ngo/applications/:id`.
- Admin NGO review: `/api/admin/ngos` and the `verify`, `reject`, `request-changes`, and `suspend` actions.
- Public directory/content endpoints: `/api/ngos`, `/api/projects`, `/api/events`, `/api/gallery`, and `/api/search?q=`.

## Security and deployment notes

- Configure SMTP before relying on password recovery. If SMTP is not configured, no reset link is sent.
- Set `FRONTEND_ORIGIN` to the real frontend origin(s), comma-separated, without wildcard origins.
- Use a unique, randomly generated `JWT_SECRET` in production. Rotate any development credentials before deployment.
- The frontend currently stores its bearer token in browser local storage. A production hardening pass should migrate to secure HttpOnly cookies with CSRF protection.
- Local `uploads/` storage is not durable on ephemeral hosting. Use persistent storage or an object-storage provider for production uploads.
- Run integration tests against a staging MongoDB and configured SMTP account before production deployment.

## Demo data

The seed script creates development demo records. Keep demo credentials and demo data out of production environments.
