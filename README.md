# Kurvan

A web app that lets a parent record a newborn's measurements and plot them
against the official Swedish growth curves. All user-facing copy is Swedish;
code, comments and commits are English.

The app never diagnoses and never implies a diagnosis. It describes where a
child's values sit and whether the child follows its own channel, and routes
every question to BVC.

## Running it locally

Everything runs on your machine. No cloud account is needed.

Requirements: Node 20+, Docker (for local Supabase), and the
[Supabase CLI](https://supabase.com/docs/guides/local-development) — or use
`npx supabase` as below, which needs no global install.

```bash
npm install
npx supabase start          # starts Postgres, Auth and the API in Docker
cp .env.example .env.local  # then paste in the anon key supabase printed
npm run dev                 # http://localhost:3000
```

`npx supabase start` applies everything in `supabase/migrations/` to a fresh
database and prints an **API URL** and an **anon key**. Put those into
`.env.local` as `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
The local anon key is the same for every Supabase instance and is not a secret.

Email confirmation is off locally (`supabase/config.toml`), so "Skapa konto"
signs you straight in. Mail that would have been sent is visible at
<http://127.0.0.1:54324>.

To reset the database to a clean state:

```bash
npx supabase db reset
```

### Scripts

| command | what it does |
|---|---|
| `npm run dev` | development server |
| `npm run build` | production build |
| `npm test` | unit tests (curve maths, reading, validation, rendering) |
| `npm run db:test` | row-level security tests against the local database |
| `npm run lint` | eslint |

`npm run db:test` needs the local database running; it uses `DATABASE_URL` from
the environment, defaulting to Supabase's local Postgres port.

### Deploying

The app is a stock Next.js App Router project and deploys to Vercel unchanged.
Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` to a hosted
Supabase project, and apply `supabase/migrations/` to it with
`npx supabase db push`. The reference data is compiled into the build; there is
nothing to seed.

## How it is put together

```
src/lib/growth/     the curve maths — pure, dependency-free, no I/O
src/lib/            copy, formatting, validation, the reading state machine
src/components/     the chart and the screens' shared parts
src/app/            routes and server actions
supabase/           migrations, RLS tests, local config
*-curves.json       the reference data, and the Python that produced it
```

### The curve maths

`src/lib/growth` is the highest-stakes code here and is kept apart from
everything else: no React, no network, no database, no clock. Every number a
parent sees comes out of it.

- **Age is measured from term**, not from birth. The Swedish reference is
  anchored at 40+0, so a child born at 38+0 and one born at 41+0 plot at
  different positions on the same day of life. This is not prematurity
  correction; it applies to every child.
- **Weight is log-normal.** Its stored mean and SD are in log₁₀(kg) and the
  z-score is computed on that scale, back-transformed with `10^x` for the
  chart's bands. Length and head are normal, in centimetres. The module reads
  the reference file's own `distribution` field and treats an unrecognised
  value as an error rather than falling through to the linear case.
- **Interpolation is monotone cubic (PCHIP).** A natural spline overshoots
  across the reference's wide intervals and can produce a mean growth curve
  that dips. Mean and SD are interpolated independently.
- **Nothing is extrapolated and nothing is clamped.** Outside 0–24 months from
  term, or outside 37–42 weeks of gestation, callers get a typed out-of-range
  result and the UI says so in plain Swedish. A value that cannot be placed is
  still stored and still shown — it is only left off the chart, with a note
  saying why.

### The reference data

`boys-curves.json` and `girls-curves.json` are read off the official Swedish
PC PAL 0–2 year charts. `SCHEMA.md` is the data contract and `HANDOFF.md` is
the record of how the numbers were obtained and what went wrong on the way.
They are loaded as static data at build time and are deliberately not in the
database: correcting the reference is a redeploy, not a migration, and no
derived SDS is ever stored.

The extraction's own validation must pass before any of this is trustworthy:

```bash
pip install pdfplumber numpy
python verify.py boys-curves.json girls-curves.json
```

`src/lib/growth/reference.test.ts` then asserts that the app's interpolation
reproduces Table 4's published anchors at 0/3/6/9/12/15/18/21/24 months,
displaced by exactly the divergence the extraction recorded between the chart
and the table. The chart is ground truth — it is what BVC plots on — and the
disagreement is surfaced at `/om-kurvorna` rather than corrected away.

### Data model

Access is a membership join table, not an owner column on the child:

```
children        no owner_id
child_members   (child_id, user_id, role) with roles owner / editor / viewer
measurements    nullable weight_grams, length_mm, head_mm — any one may stand alone
```

The prototype only ever creates one `owner` membership per child and has no
sharing UI, but adding a second parent or read-only access later is a row
rather than a migration that rewrites ownership.

Weight is stored in whole grams and lengths in whole millimetres. Medical
values do not go in floats. `measured_on` is the day the child was measured and
is distinct from `created_at`, because a parent copying in from the BVC card
backfills months later.

Row-level security is on from the first migration and every policy is written
against the membership table. `supabase/tests/rls.sql` exercises it with two
users; loosening any policy makes it fail.

### Copy

Every sentence the product says lives in `src/lib/copy.ts`, and the home
screen's state machine that assembles them lives in `src/lib/reading.ts`. This
text is the highest-risk surface in the product and should be reviewable in one
sitting. **It has not been read by a BVC nurse yet, and should be before this
goes anywhere near a real parent.**

## What is not built

Multi-user sharing, read-only access, and GDPR export and delete are out of
scope for the prototype. The schema is ready for them; there is no UI.
Preterm children (under 37 weeks) are out of scope: the app says so rather than
silently plotting them on term curves.
