# 🎾 Matchmaker — Find Tennis Partners Near You

A web app that helps neighbors find tennis partners at their local courts. Post your availability, get matched with players at your skill level, and build your local tennis community.

## Features

- **Smart Matchmaking**: Post when you're free, and the system automatically matches you with compatible players based on NTRP rating (±0.5) and time overlap
- **Guided NTRP Rating**: Friendly skill-level picker with plain-language descriptions — no intimidating tennis jargon
- **Singles & Doubles**: Support for both match types, with per-player preferences
- **Court Crowding Warnings**: See when time slots are getting busy at your local courts
- **Calendar Integration**: Add confirmed matches to Google Calendar or download .ics files
- **Notifications**: In-app notification bell + email notifications for match proposals and confirmations, with per-type preferences
- **QR Code Flyers**: Admins generate printable court flyers with QR codes — players who scan get their court pre-selected during signup
- **Multi-neighborhood**: Data model supports multiple court groups for different neighborhoods
- **Admin Panel**: Manage courts, users (including banning), and view site stats

## Tech Stack

- **Frontend**: React 19 + Vite + TypeScript + TailwindCSS 4
- **Backend**: Supabase (PostgreSQL, Auth, Edge Functions, Realtime)
- **Auth**: Google OAuth + Magic Link email (passwordless)
- **Email**: Resend (transactional notifications)

## Getting Started

### Prerequisites

- Node.js 18+
- [Docker](https://www.docker.com/) (for the local Supabase stack)
- [Supabase CLI](https://supabase.com/docs/guides/cli) (`npm install -g supabase` or via Homebrew)

### Local Setup

1. **Clone and install**:
   ```bash
   git clone <your-repo-url>
   cd matchmaker
   npm install
   ```

2. **Configure environment**:
   ```bash
   cp .env.example .env
   ```
   The defaults in `.env` work for local development — no edits needed to get started.
   For QR flyer URLs to point at your public domain, set `VITE_APP_URL=https://your-app-domain.com`.

3. **Start the local Supabase stack and apply migrations**:
   ```bash
   npm run db:start   # starts local Supabase (Docker)
   npm run db:reset   # applies all migrations + seed data
   ```

4. **Run the dev server**:
   ```bash
   npm run dev
   ```
   App runs at `http://localhost:5173`. Supabase Studio at `http://127.0.0.1:54323`. Email catch (Mailpit) at `http://127.0.0.1:54324`.

**Seed accounts**: `admin@localhost` (admin, NTRP 4.0) and `player2@localhost` (NTRP 3.5) — sign in with magic links and check Mailpit.

### Hosted Supabase (production)

1. Create a project at [Supabase Dashboard](https://app.supabase.com).
2. Link the project: `supabase link --project-ref <ref>`
3. Push migrations: `supabase db push`
4. Configure auth providers under Authentication → Providers:
   - Enable Google OAuth (requires Google Cloud Console credentials)
   - Email/Magic Link is enabled by default
5. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in your hosting provider's env vars (from Dashboard → Settings → API).

### Email notifications (optional, production)

Match-related notifications (`match_proposed`, `match_confirmed`, `match_cancelled`, `match_declined`) can be delivered as email through [Resend](https://resend.com). Players choose which types to receive at `/profile`, and emails include RFC 8058 one-click unsubscribe headers.

To enable in production:

1. Verify a sender domain in Resend and create an API key.
2. Set the Edge Function secrets:
   ```bash
   supabase secrets set RESEND_API_KEY=re_xxx
   supabase secrets set RESEND_FROM='Matchmaker <noreply@your-domain>'
   supabase secrets set APP_URL=https://your-app-domain.com
   supabase secrets set EMAIL_TRIGGER_SECRET=$(openssl rand -hex 32)
   supabase secrets set UNSUBSCRIBE_SECRET=$(openssl rand -hex 32)
   ```
   `RESEND_API_KEY`, `EMAIL_TRIGGER_SECRET`, and `UNSUBSCRIBE_SECRET` are required in normal delivery mode; the functions fail closed if any required value is unset.
3. Deploy the functions:
   ```bash
   supabase functions deploy send-notification-email
   supabase functions deploy unsubscribe
   supabase functions deploy court-redirect
   ```
4. Point the Postgres trigger at the Edge Functions (run once against the production DB via the dashboard SQL editor):
   ```sql
   INSERT INTO app_config (key, value) VALUES
     ('edge_functions_url',   'https://<project>.supabase.co/functions/v1'),
     ('email_trigger_secret', '<must match EMAIL_TRIGGER_SECRET>')
   ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
   ```
   (Supabase managed Postgres blocks `ALTER DATABASE ... SET app.settings.*`, so the trigger reads from `app_config` instead.)

See [`docs/email-notifications.md`](docs/email-notifications.md) for architecture details and local-dev setup.

### Project Structure

```
src/
├── components/       # Reusable UI components
│   ├── auth/         # Auth callback, protected route
│   ├── availability/ # Post availability form
│   └── layout/       # App layout with nav
├── hooks/            # React hooks (useAuth, useNotificationCount)
├── lib/              # Supabase client
├── pages/            # Route pages
├── types/            # TypeScript types
└── utils/            # NTRP ratings, calendar helpers, onboarding
supabase/
├── functions/        # Edge Functions (send-notification-email, unsubscribe, court-redirect)
├── migrations/       # Timestamp-prefixed SQL migrations
└── seed.sql          # Local dev seed data
docs/                 # Architecture and feature docs
```

## Testing

```bash
npm run test              # all tests
npm run test:unit         # unit tests only
npm run test:integration  # integration tests (requires local Supabase running)
```

## Cost

All free tier at neighborhood scale:
- **Supabase**: $0 (500MB DB, 50K MAU)
- **Resend**: $0 (100 emails/day)
- **Hosting**: $0 (Vercel/Netlify free tier)

## License

MIT
