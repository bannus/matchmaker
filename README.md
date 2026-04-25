# 🎾 Matchmaker — Find Tennis Partners Near You

A web app that helps neighbors find tennis partners at their local courts. Post your availability, get matched with players at your skill level, and build your local tennis community.

## Features

- **Smart Matchmaking**: Post when you're free, and the system matches you with compatible players based on NTRP rating (±0.5) and time overlap
- **Guided NTRP Rating**: Friendly skill-level picker with plain-language descriptions — no intimidating tennis jargon
- **Singles & Doubles**: Support for both match types
- **Court Crowding Warnings**: See when time slots are getting busy at your local courts
- **Calendar Integration**: Add confirmed matches to Google Calendar or download .ics files
- **Notifications**: In-app notification bell + email notifications for match proposals and confirmations
- **Multi-neighborhood**: Data model supports multiple court groups for different neighborhoods
- **Admin Panel**: Manage courts, users, and view site stats

## Tech Stack

- **Frontend**: React 19 + Vite + TypeScript + TailwindCSS
- **Backend**: Supabase (PostgreSQL, Auth, Edge Functions, Realtime)
- **Auth**: Google OAuth + Magic Link email (passwordless)
- **Email**: Resend (transactional notifications)

## Getting Started

### Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) project (free tier works great)

### Setup

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
   Edit `.env` with your Supabase project URL and anon key from [Supabase Dashboard](https://app.supabase.com) → Settings → API.

3. **Set up the database**:
   Run the SQL migrations in order against your Supabase project:
   - `supabase/migrations/00001_initial_schema.sql` — Tables, RLS policies, triggers
   - `supabase/migrations/00002_matchmaking_function.sql` — Matchmaking algorithm

4. **Configure auth providers** in Supabase Dashboard → Authentication → Providers:
   - Enable Google OAuth (requires Google Cloud Console credentials)
   - Email/Magic Link is enabled by default

5. **Run locally**:
   ```bash
   npm run dev
   ```

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
   ```
4. Point the Postgres trigger at the Edge Functions (run once against the production DB):
   ```sql
   ALTER DATABASE postgres SET app.settings.edge_functions_url
     = 'https://<project>.supabase.co/functions/v1';
   ALTER DATABASE postgres SET app.settings.email_trigger_secret
     = '<must match EMAIL_TRIGGER_SECRET>';
   ```

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
└── utils/            # NTRP ratings, calendar helpers
supabase/
└── migrations/       # SQL schema and functions
```

## Cost

All free tier at neighborhood scale:
- **Supabase**: $0 (500MB DB, 50K MAU)
- **Resend**: $0 (100 emails/day)
- **Hosting**: $0 (Vercel/Netlify free tier)

## License

MIT
