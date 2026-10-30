# EarthKind NGO Platform

EarthKind is a full-stack, mobile-first platform for discovering nonprofit organizations, exploring community projects, finding volunteer opportunities, registering for events, and supporting causes through online donations.

**Repository:** https://github.com/ak2910-web/ngo  
**Live frontend:** https://earthkind-ngo.onrender.com/  
**Backend API:** https://ngo-pi3s.onrender.com  
**Frontend hosting:** Render Static Site  
**Backend hosting:** Render Web Service  
**Database:** MongoDB Atlas

> **Project status:** The frontend and API are deployed. The Razorpay Test Mode configuration endpoint has been confirmed to return a test key. A test checkout has been exercised during development, but a complete production payment, webhook, SMTP-delivery, and end-to-end acceptance test must be completed before the platform is used for real donations or public operations. This README documents the implementation and the remaining release checks honestly.

---

## 1. Features

### Public website
- Browse verified NGOs and their profiles.
- Explore public projects, events, volunteer opportunities, and gallery content.
- Search projects, events, volunteer opportunities, and gallery content.
- Read about the platform and contact the team.
- Submit volunteer interest and general contact enquiries.
- Make donations through Razorpay Checkout (Test Mode or Live Mode, depending on configured credentials).

### Volunteer accounts
- Register and sign in with an email and password.
- Browse published volunteer opportunities from verified NGOs.
- Apply for an opportunity and view application history.
- Register for published events and view registration history.
- Use password-reset links when SMTP is configured.

### NGO accounts
- Submit an organization for administrator review.
- New NGO applications start with `PENDING` status.
- After verification, manage the organization's profile, projects, volunteer opportunities, events, gallery, and volunteer applications.
- Review volunteer applications as accepted, rejected, or completed.

### Administration
- Admin login and protected dashboard APIs.
- Review NGO applications: verify, reject, request changes, or suspend.
- Review/manage platform content collections.
- View dashboard statistics and popular searches.
- Export supported records as CSV.

### Donations
- Create Razorpay orders on the server.
- Verify checkout signatures and confirm payment status with Razorpay.
- Store donation orders and payment references in MongoDB.
- Accept Razorpay webhook events for `payment.captured` and `payment.failed`, with HMAC signature validation.
- Use separate test and live Razorpay credentials.

---

## 2. Technology stack

| Layer | Technology |
|---|---|
| Frontend | HTML, CSS, vanilla JavaScript |
| Backend | Node.js, Express |
| Database | MongoDB Atlas, Mongoose |
| Authentication | JWT, bcryptjs |
| Security | Helmet, CORS, express-rate-limit |
| Email | Nodemailer, SMTP |
| Payments | Razorpay Orders API and Checkout |
| File uploads | Multer (local disk storage) |
| Hosting | Render |

Use **Node.js 18 or newer** for the backend. The code uses native `fetch`, `crypto.randomUUID()`, and `AbortSignal.timeout()`.

---

## 3. Repository structure

```text
ngo/
└── build-a-full-stack-highly-animated/
    ├── README.md
    ├── frontend/                 # Static website pages, styles and scripts
    └── backend/
        ├── server.js             # Express API and payment routes
        ├── models.js             # Mongoose schemas
        ├── routes/
        │   ├── auth.js           # Registration, login and password reset
        │   └── ngos.js           # Public, NGO and NGO-review routes
        ├── middleware/
        │   └── auth.js           # JWT authentication and role checks
        ├── seed.js               # Development/demo data only
        ├── .env.example          # Environment variable template
        └── package.json
```

---

## 4. Run locally

### Prerequisites
- Node.js 18+
- npm
- A MongoDB database (local MongoDB or MongoDB Atlas)
- Optional SMTP account for email delivery
- Optional Razorpay Test Mode account for donation testing

### Backend setup

Open a terminal:

```bash
cd build-a-full-stack-highly-animated/backend
npm install
```

Copy the environment template:

**Windows PowerShell**
```powershell
Copy-Item .env.example .env
```

**macOS / Linux**
```bash
cp .env.example .env
```

Edit `.env` and set at least:

- `MONGODB_URI`: MongoDB connection string.
- `JWT_SECRET`: long, unique, randomly generated secret.
- `PORT`: local API port (default `5000`).
- `FRONTEND_ORIGIN`: exact browser origin serving the frontend, such as `http://localhost:3000`.

Start the backend:

```bash
npm run dev
```

The API should be available at `http://localhost:5000`.

### Frontend setup

Open a second terminal:

```bash
cd build-a-full-stack-highly-animated/frontend
npx serve -l 3000
```

Open `http://localhost:3000`.

**Important:** Frontend JavaScript currently contains the deployed API base URL (`https://ngo-pi3s.onrender.com/api`). For a fully local setup, change the API constants in the frontend scripts to `http://localhost:5000/api`. If you deploy the frontend or backend to different domains, update those constants and the backend's `FRONTEND_ORIGIN` to match.

### Demo data (local development only)

```bash
cd build-a-full-stack-highly-animated/backend
npm run seed
```

The seed script creates clearly labelled demo organizations, users, projects, events, and opportunities. It also creates/resets a predictable demo administrator account.

**Never run `npm run seed` against production or a database containing real users.** It deletes and recreates records marked as demo and upserts the demo administrator with a known password. If the seed script has ever been run against a production database, immediately change the administrator password and review/remove demo records.

---

## 5. Environment variables

The template is `backend/.env.example`. Configure these in your local `.env` or the backend service's environment settings in Render.

| Variable | Required? | Purpose |
|---|---:|---|
| `MONGODB_URI` | Yes | MongoDB connection string |
| `JWT_SECRET` | Yes | Signs authentication tokens; use a long random value |
| `PORT` | Hosting/local | HTTP port; Render supplies this automatically |
| `FRONTEND_ORIGIN` | Yes | Allowed frontend origin(s), comma-separated, with no trailing slash |
| `ADMIN_EMAIL` | For admin email alerts | Destination for new contact-enquiry notifications |
| `SMTP_HOST` | For email | SMTP server hostname |
| `SMTP_PORT` | For email | Usually 587 (STARTTLS) or 465 (implicit TLS) |
| `SMTP_USER` | For email | SMTP username |
| `SMTP_PASS` | For email | SMTP password or provider app password |
| `MAIL_FROM` | Recommended for email | Verified sender name/address |
| `RAZORPAY_KEY_ID` | For payments | Razorpay API key ID |
| `RAZORPAY_KEY_SECRET` | For payments | Razorpay API key secret |
| `RAZORPAY_WEBHOOK_SECRET` | For webhooks | Secret configured for the Razorpay webhook endpoint |

### SMTP notes
- Configure all SMTP values and use a sender address verified by your email provider.
- Volunteer registration sends a confirmation email when SMTP is available.
- Contact enquiries are saved in MongoDB and attempt to send a visitor confirmation and an admin notification.
- Password reset links are sent only when SMTP is configured. Reset tokens expire after one hour and are single-use.
- A successful API response does not guarantee that an email reached the inbox. Check provider delivery logs and spam folders during testing.
- The reset link uses the first origin in `FRONTEND_ORIGIN`; ensure it is the deployed frontend URL.

### Razorpay notes
- Use `rzp_test_` credentials for testing. Test payments do not collect real money.
- Use `rzp_live_` credentials only after all test checks, merchant/account requirements, and production approval are complete.
- Configure a webhook in the Razorpay Dashboard pointing to:
  `https://ngo-pi3s.onrender.com/api/payments/razorpay/webhook`
- Subscribe to `payment.captured` and `payment.failed`.
- Set the same webhook signing secret in `RAZORPAY_WEBHOOK_SECRET`. This is separate from `RAZORPAY_KEY_SECRET`.
- Never expose `RAZORPAY_KEY_SECRET`, SMTP passwords, MongoDB credentials, or `JWT_SECRET` in frontend code, Git commits, screenshots, or chat messages.

---

## 6. API reference

All routes are prefixed with `/api`. Protected routes require:

```http
Authorization: Bearer <JWT>
Content-Type: application/json
```

### Health and public content

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/ngos` | Paginated directory of verified NGOs |
| GET | `/api/ngos/categories` | List cause categories |
| GET | `/api/ngos/:id` | Verified NGO profile |
| GET | `/api/projects` | Published/public projects |
| GET | `/api/events` | Published events |
| GET | `/api/gallery` | Public gallery |
| GET | `/api/search?q=...` | Search public content |
| GET | `/api/opportunities` | Published opportunities from verified NGOs |
| POST | `/api/contact` | Save a contact enquiry and attempt email notifications |
| POST | `/api/volunteers` | Submit general volunteer interest |
| POST | `/api/survey` | Submit a community survey response |
| POST | `/api/donation-enquiries` | Save a donation enquiry |

### Authentication

| Method | Endpoint | Access |
|---|---|---|
| POST | `/api/auth/register` | Public volunteer registration |
| POST | `/api/auth/login` | Public login |
| POST | `/api/auth/user/login` | Public user login alias |
| POST | `/api/auth/ngo/register` | Public NGO application |
| POST | `/api/auth/ngo/login` | Public NGO login |
| POST | `/api/auth/admin/login` | Public admin login endpoint; admin role is checked by the dashboard |
| GET | `/api/auth/me` | Authenticated |
| POST | `/api/auth/logout` | Authenticated |
| POST | `/api/auth/forgot-password` | Public; SMTP required for delivery |
| POST | `/api/auth/reset-password` | Public; valid reset token required |

### Volunteer and event participation

| Method | Endpoint | Access |
|---|---|---|
| POST | `/api/opportunities/:id/apply` | Volunteer account |
| GET | `/api/me/applications` | Volunteer account |
| POST | `/api/events/:id/register` | Volunteer account |
| GET | `/api/me/event-registrations` | Volunteer account |

### NGO dashboard

NGO dashboard operations require an authenticated NGO account with `VERIFIED` status.

- `GET/PUT /api/ngo/me` — view/update organization profile.
- `GET/POST/PUT/DELETE /api/ngo/projects` — manage projects.
- `GET/POST/PUT/DELETE /api/ngo/opportunities` — manage opportunities.
- `GET/POST/PUT/DELETE /api/ngo/events` — manage events.
- `GET/POST/DELETE /api/ngo/gallery` — manage gallery entries.
- `GET /api/ngo/applications` — view applications to the NGO's opportunities.
- `PUT /api/ngo/applications/:id` — update an application status.
- `GET /api/ngo/overview` — dashboard counts.

Public NGO content is available under `/api/ngos/:id/*`, including projects, events, opportunities, gallery, and impact reports.

### Admin

Admin routes require a valid JWT belonging to an administrator.

- `GET /api/admin/dashboard` and `GET /api/admin/stats` — dashboard counts.
- `GET /api/admin/ngos` and `GET /api/admin/ngos/:id` — review NGO applications.
- `PUT /api/admin/ngos/:id/verify` — verify an NGO.
- `PUT /api/admin/ngos/:id/reject` — reject an NGO.
- `PUT /api/admin/ngos/:id/request-changes` — request corrections.
- `PUT /api/admin/ngos/:id/suspend` — suspend an NGO.
- `GET/POST/PUT/DELETE /api/admin/:collection[/:id]` — manage supported collections: `projects`, `events`, `gallery`, `volunteers`, and `contacts`.
- `GET /api/admin/export/:type` — CSV export for supported types: `volunteers`, `contacts`, and `surveys`.
- `POST /api/admin/upload` — upload an image (maximum 5 MB; JPEG, PNG, GIF, or WebP).

### Razorpay donations

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/payments/razorpay/config` | Returns public key ID and currency when configured |
| POST | `/api/payments/razorpay/orders` | Validates donor details/amount and creates an order |
| POST | `/api/payments/razorpay/verify` | Verifies checkout signature and captured payment |
| GET | `/api/payments/razorpay/status/:orderId` | Reads stored donation status |
| POST | `/api/payments/razorpay/webhook` | Verifies and processes Razorpay webhook events |

Donation amounts must be whole rupees from ₹1 to ₹1,00,000. The browser must never decide that a payment is successful by itself; rely on server-side verification and the webhook.

---

## 7. Deployment (Render)

### Backend web service
The current backend service is configured with:
- Root directory: `build-a-full-stack-highly-animated/backend`
- Build command: `npm install`
- Start command: `npm start`
- Runtime: Node.js
- Environment variables: set through Render's Environment settings

Required production variables include `MONGODB_URI`, `JWT_SECRET`, and `FRONTEND_ORIGIN`. Add SMTP and Razorpay variables only when those services are configured.

### Frontend static site
- Root directory: `build-a-full-stack-highly-animated/frontend`
- Publish the static frontend files.
- Confirm frontend API constants point to the deployed backend URL.
- Confirm the backend `FRONTEND_ORIGIN` exactly matches the frontend origin, including scheme and hostname.

After each deployment:
1. Open the frontend and test navigation.
2. Open `https://ngo-pi3s.onrender.com/api/payments/razorpay/config` to confirm payment configuration is available (this endpoint returns only the public key ID).
3. Test public directory/search APIs.
4. Test registration/login and role-protected dashboards.
5. Review Render application logs for CORS, MongoDB, SMTP, and payment errors.

---

## 8. Release / acceptance checklist

Use this checklist before calling the platform production-ready.

### Core platform
- [ ] Confirm MongoDB Atlas remains reachable from Render and the database is backed up.
- [ ] Register a new volunteer, sign in, sign out, and confirm an expired/invalid token is rejected.
- [ ] Register a test NGO and confirm its status is `PENDING`.
- [ ] Sign in as admin, verify the NGO, and confirm it appears in the public directory.
- [ ] Confirm an unverified NGO cannot publish or manage dashboard content.
- [ ] Create a project, event, gallery entry, and volunteer opportunity as a verified NGO.
- [ ] Apply as a volunteer; review the application from the NGO dashboard.
- [ ] Register for an event and verify duplicate/full-event handling.
- [ ] Test contact and volunteer forms with valid and invalid input.

### Email
- [ ] Verify SMTP host, port, credentials, and sender address.
- [ ] Trigger a password reset and receive the email.
- [ ] Confirm reset link expiry and single-use behavior.
- [ ] Submit a contact enquiry and confirm visitor confirmation and admin notification.
- [ ] Submit general volunteer interest and confirm volunteer acknowledgement.
- [ ] Check SMTP provider delivery logs, inbox, and spam folders.

### Payments
- [ ] Complete a Razorpay Test Mode payment and confirm server-side status is `paid`.
- [ ] Confirm the matching donation record is stored in MongoDB.
- [ ] Configure the Razorpay webhook and confirm `payment.captured` and `payment.failed` deliveries.
- [ ] Test invalid signatures and mismatched amounts/currencies.
- [ ] Only after approval, configure Live Mode credentials and repeat controlled production verification.

### Production hardening
- [ ] Replace the browser localStorage bearer-token approach with secure HttpOnly cookies and CSRF protection.
- [ ] Configure durable object storage for uploaded files; Render's local filesystem may be ephemeral.
- [ ] Add automated integration tests and a deployment health-check endpoint.
- [ ] Review admin CRUD permissions and validate all admin input before enabling broad production access.
- [ ] Add backup/restore procedures, privacy policy, terms, and donation/refund disclosures.
- [ ] Remove demo data and rotate all seeded or development credentials.
- [ ] Review accessibility, mobile layouts, and error/loading/empty states on real devices.

---

## 9. Known limitations and operational notes

- The frontend is a static HTML/CSS/JavaScript app and currently uses hard-coded API base URLs in its scripts.
- Authentication tokens are stored in browser localStorage. This is convenient for the current implementation but is not the preferred security model for a sensitive production service.
- Uploaded images are stored on local disk under `uploads/`; ephemeral hosting can discard these files during redeploys or instance replacement.
- Email delivery depends on valid SMTP settings and a provider-authorized sender. The application may save an enquiry even when an email attempt fails.
- The Razorpay Test Mode key being available does not mean Live Mode is enabled or that the webhook has been configured.
- The current seed script contains predictable demo credentials. Use it only on an isolated development database.
- This repository does not include a full automated end-to-end test suite. Complete the release checklist above before real users, real donations, or sensitive production data are introduced.

## 10. Security reminders

- Never commit `.env`, API secrets, passwords, database URIs, or private keys.
- Do not paste secrets into issue reports, chat messages, screenshots, or frontend source.
- Use separate credentials for local development, staging, and production.
- Restrict MongoDB network access as much as the hosting setup permits; avoid leaving broad IP access enabled longer than necessary.
- Rotate any credential that may have been exposed.
- Use real, verified NGO information only. Clearly label all demo/sample records.

---

**Maintainer handover:** EarthKind's main application features and deployment configuration are documented here. Production readiness depends on completing the release checklist, especially SMTP delivery, Razorpay webhook verification, secure session handling, durable file storage, and backup/recovery validation.
