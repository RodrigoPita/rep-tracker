<h1 align="center">Rep Tracker 🏋️</h1>

<div align="center">

[![Next.js](https://img.shields.io/badge/Next.js-15-gray?style=for-the-badge&colorA=000000&logo=next.js&logoColor=white)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-gray?style=for-the-badge&colorA=3178C6&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Supabase](https://img.shields.io/badge/Supabase-gray?style=for-the-badge&colorA=3ECF8E&logo=supabase&logoColor=white)](https://supabase.com/)
[![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-gray?style=for-the-badge&colorA=38B2AC&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Vercel](https://img.shields.io/badge/Vercel-gray?style=for-the-badge&colorA=000000&logo=vercel&logoColor=white)](https://vercel.com/)

</div>

A personal fitness tracker for logging bodyweight workouts, tracking progress over time, and staying consistent — built for daily use on mobile.

---

## ✨ Features

- **📋 Routine Builder** — Create named workout routines with exercises, sets, reps, and rest timers; reorder via drag-and-drop
- **⏱️ Active Workout** — Live checklist with enforced set order, rest countdowns, and support for both rep-based and timed exercises
- **📅 Calendar View** — Monthly grid highlighting training days; tap any day to see a full breakdown of exercises, sets, reps, and weight
- **📊 Dashboard** — Weekly activity strip, routine period progress wheel, streak counter, average session duration, and volume charts
- **🏆 Achievements** — Milestone badges unlocked on workout completion; visible on the dashboard shelf and a dedicated achievements page
- **📚 Exercise Library** — Browse all exercise classes and variants; admin controls to add, remove, and configure exercises
- **🎯 Routine Periods** — Set a target number of sessions for a routine and track progress toward completing it
- **🔒 Auth & RLS** — Google OAuth login; Row Level Security ensures all data is scoped to the authenticated user
- **🌗 Dark / Light Mode** — System-aware theme with manual toggle
- **📱 PWA** — Installable on mobile with bottom navigation, safe-area insets, and a home screen manifest

---

## 🛠️ Tech Stack

- **Next.js 15** — App Router with server components for SSR data fetching and zero client-side loading flash
- **TypeScript** — Full type coverage across the stack
- **Supabase** — PostgreSQL database, Auth (Google OAuth), and Row Level Security; hosted in São Paulo
- **Tailwind CSS v4 + shadcn/ui** — Utility-first styling with a consistent component library
- **Recharts** — Volume and activity charts on the dashboard
- **@dnd-kit** — Drag-and-drop reordering in the routine builder
- **Sonner** — Toast notifications for errors and achievement unlocks
- **next-themes** — SSR-safe dark/light mode switching
- **Vercel** — Deployment with functions co-located in São Paulo (`gru1`)

---

## 💻 Running Locally

### Prerequisites

- [Node.js](https://nodejs.org/) v22 (`nvm use 22`)
- A [Supabase](https://supabase.com/) project (free tier works)

### Installation

1. **Clone the repository:**

   ```bash
   git clone https://github.com/RodrigoPita/rep-tracker.git
   cd rep-tracker
   ```

2. **Install dependencies:**

   ```bash
   npm install
   ```

3. **Configure environment variables:**

   Copy the example file and fill in your values:

   ```bash
   cp .env.local.example .env.local
   ```

   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_...
   ADMIN_USER_ID=your-supabase-user-uuid   # optional — enables exercise library admin controls
   ```

4. **Run the database migrations:**

   In the [Supabase SQL editor](https://supabase.com/dashboard), run each file in `supabase/migrations/` in order (`001` → `010`), or use the Supabase CLI:

   ```bash
   supabase db push
   ```

5. **Start the development server:**

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000).

---

<div align="center">

Made with ❤️ by [Rodrigo Pita](https://github.com/RodrigoPita)

**[⬆ back to top](#rep-tracker-️)**

</div>
