# Deployment Guide — BestCricketAcademy

This guide covers deploying the app on the **free stack**: Vercel (hosting) + Neon (PostgreSQL) + Cloudinary (file storage).

---

## Stack Overview

| Service | Purpose | Free Tier |
|---|---|---|
| [Vercel](https://vercel.com) | Hosting — React frontend + Express API as serverless functions | Unlimited personal projects |
| [Neon](https://neon.tech) | PostgreSQL database | 0.5 GB storage, 1 project |
| [Cloudinary](https://cloudinary.com) | File storage (payment screenshots, QR codes) | 25 GB storage, 25 GB bandwidth/month |

---

## Step 1 — Set Up Neon Database

1. Sign up at [neon.tech](https://neon.tech) and create a new project.
2. Choose a region closest to your users (e.g., `ap-southeast-1` for India).
3. From the Neon dashboard, copy **two** connection strings:
   - **Pooled connection string** → used as `DATABASE_URL` (for the running app)
   - **Direct connection string** → used as `DATABASE_URL_UNPOOLED` (for migrations only)

Both strings look like:
```
postgresql://username:password@ep-xxx.ap-southeast-1.aws.neon.tech/neondb?sslmode=require
```
The pooled one has `-pooler` in the hostname.

---

## Step 2 — Run Database Migrations

Install dependencies and run migrations against your Neon database:

```bash
# Clone the repo and install
pnpm install

# Set the direct connection string for migrations
export DATABASE_URL_UNPOOLED="postgresql://..."
export DATABASE_URL="postgresql://..."   # pooled, used by seed script

# Generate and apply migrations
pnpm drizzle-kit generate
pnpm drizzle-kit migrate

# Seed initial data (services, facility, sample slots)
npx tsx server/seed.ts
```

---

## Step 3 — Set Up Cloudinary

1. Sign up at [cloudinary.com](https://cloudinary.com).
2. From the dashboard, copy:
   - **Cloud Name** (e.g., `my-cricket-app`)
   - **API Key**
   - **API Secret**

---

## Step 4 — Deploy to Vercel

### 4a. Connect Repository

1. Push your code to a GitHub repository.
2. Go to [vercel.com](https://vercel.com) → **New Project** → import your GitHub repo.
3. Vercel auto-detects the project. Leave the default settings as-is.

### 4b. Set Environment Variables

In the Vercel dashboard → **Project Settings** → **Environment Variables**, add:

| Variable | Value | Notes |
|---|---|---|
| `DATABASE_URL` | Neon **pooled** connection string | Used by the running app |
| `DATABASE_URL_UNPOOLED` | Neon **direct** connection string | Used by drizzle-kit only |
| `JWT_SECRET` | A long random string (32+ chars) | Signs admin session cookies |
| `ADMIN_EMAIL` | Your admin email | e.g., `coach@bestcricket.com` |
| `ADMIN_PASSWORD` | Your admin password | See security note below |
| `CLOUDINARY_CLOUD_NAME` | From Cloudinary dashboard | |
| `CLOUDINARY_API_KEY` | From Cloudinary dashboard | |
| `CLOUDINARY_API_SECRET` | From Cloudinary dashboard | |

**Generate a JWT secret:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 4c. Deploy

Click **Deploy**. Vercel runs `pnpm run vercel-build` which builds the React frontend into `dist/public`. The API is served as a serverless function from `api/index.ts`.

---

## Admin Password Security

For development, you can set `ADMIN_PASSWORD` to a plain text password — the server bcrypt-hashes it on every login check.

For production, it is strongly recommended to pre-hash the password and store the hash:

```bash
node -e "const b=require('bcryptjs'); b.hash('YourPassword123', 12).then(h=>console.log(h))"
```

Then set `ADMIN_PASSWORD` to the resulting hash (starts with `$2b$12$...`). The server detects it is already a hash and skips double-hashing.

---

## Environment Variables Reference

```bash
# ── Required ──────────────────────────────────────────────────────────────────

# Neon PostgreSQL — pooled URL for the running app
DATABASE_URL=postgresql://user:pass@ep-xxx-pooler.region.aws.neon.tech/neondb?sslmode=require

# Neon PostgreSQL — direct URL for drizzle-kit migrations only
DATABASE_URL_UNPOOLED=postgresql://user:pass@ep-xxx.region.aws.neon.tech/neondb?sslmode=require

# JWT secret for signing admin session cookies
JWT_SECRET=your-super-secret-jwt-key-at-least-32-chars

# Admin credentials
ADMIN_EMAIL=coach@bestcricket.com
ADMIN_PASSWORD=YourSecurePassword123

# Cloudinary file storage
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=123456789012345
CLOUDINARY_API_SECRET=your-api-secret

# ── Optional ──────────────────────────────────────────────────────────────────

# WhatsApp Business API (for automated notifications — not required for manual WhatsApp)
# WHATSAPP_API_TOKEN=your-token
# WHATSAPP_PHONE_NUMBER_ID=your-phone-number-id
```

---

## Local Development

```bash
# Install dependencies
pnpm install

# Create a .env file with your local values
cat > .env << 'EOF'
DATABASE_URL=postgresql://...
DATABASE_URL_UNPOOLED=postgresql://...
JWT_SECRET=local-dev-secret-change-in-production
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=localpassword
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-key
CLOUDINARY_API_SECRET=your-secret
EOF

# Start the dev server (Express + Vite HMR)
pnpm dev
```

The app runs at `http://localhost:3000`.

---

## Alternative Hosting Options

If you prefer not to use Vercel, the app also works on:

| Platform | Notes |
|---|---|
| [Railway](https://railway.app) | Easiest for Express apps; $5/month after free trial |
| [Render](https://render.com) | Free tier available; sleeps after 15 min inactivity |
| [Fly.io](https://fly.io) | Docker-based; generous free tier |

For Railway/Render/Fly.io, use the standard `pnpm build && pnpm start` commands. The `vercel.json` file is ignored on these platforms.

---

## Post-Deployment Checklist

- [ ] Visit `https://your-app.vercel.app/admin/login` and log in with your admin credentials
- [ ] Go to **Settings** → update facility name, coach name, WhatsApp number, UPI ID
- [ ] Upload your UPI QR code image
- [ ] Go to **Slots** → create your first week of booking slots
- [ ] Test the full player booking flow from the homepage
- [ ] Verify payment screenshot upload works (Cloudinary)
- [ ] Share the booking link with players: `https://your-app.vercel.app`
