# Barntillväxt

A web app that lets a parent record a newborn's measurements and plot them
against the official Swedish growth curves. All user-facing copy is Swedish;
code, comments and commits are English.

The app never diagnoses and never implies a diagnosis. It describes where a
child's values sit and whether the child follows its own channel, and routes
every question to BVC.

## Running it locally

Everything runs on your machine. No cloud account is needed.

Requirements: Node 22 (see `.nvmrc`), Docker (for local Supabase), and the
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
The reference data is compiled into the build; there is nothing to seed.

Settings are files, not dashboard state. The schema lives in
`supabase/migrations/`, the hosted Auth settings in the `[remotes.prod]` block
at the bottom of `supabase/config.toml`. The dashboard is where you read the
result, not where you make the change — there is no `config pull`, so anything
clicked there is lost the next time someone pushes.

**The hosted project**, recorded here because nothing else captures it:

| | |
|---|---|
| App URL | <https://bvc-growth-curves-pink.vercel.app> — Vercel suffixed the name, the plain one was taken. This is Supabase's `site_url` |
| Project ref | `iilroqjhyozucgqniaoj` |
| API URL | `https://iilroqjhyozucgqniaoj.supabase.co` — this is `NEXT_PUBLIC_SUPABASE_URL`, not `site_url` |
| Region | `eu-north-1` (Stockholm) — Swedish users, health data about children, keep it in the EU |
| Postgres | 17, matching `[db] major_version` above |
| Vercel functions | `arn1` (Stockholm), so server components sit next to the database |

**First deploy**, once the project exists in the Supabase dashboard:

```bash
npx supabase login
npx supabase link --project-ref <ref>
npx supabase db push        # schema, RLS, the create_child RPC
npx supabase config push    # Auth settings from [remotes.prod]
```

Uncomment `[remotes.prod]` in `supabase/config.toml` and fill in its two TODOs
before that last command. A `project_id` that does not match the linked project
makes `config push` fall back to the root config and set your production
`site_url` to `http://localhost:3000`.

On Vercel, set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
**before the first build** — `src/lib/supabase/middleware.ts` reads them as
literals, so they are inlined at build time rather than read at runtime. No
service-role key is needed anywhere: the app runs on the anon key, RLS and
session cookies alone.

Email confirmation is off in production as well as locally, and the sign-up flow
depends on it: `signUpAction` assumes `signUp()` returns a session. Turning it
on is a code change — an `/auth/callback` route and a "check your inbox" state —
not a checkbox. It also needs custom SMTP; Supabase's built-in mailer is rate
limited to a few messages an hour and is not meant for production.

Never run `supabase/tests/rls.sql` against the hosted database. It writes
directly to `auth.users` and is local-only.

### The domain

The product is **Barntillväxt** at **barntillväxt.se**. That name contains `ä`,
so the domain is an IDN and has two forms:

| form | value | where it belongs |
|---|---|---|
| display (Unicode) | `barntillväxt.se` | anything a person reads |
| wire (punycode) | `xn--barntillvxt-t8a.se` | DNS, TLS, Supabase `site_url` and redirect allowlists, `metadataBase`, any `href` |

Both live in `src/lib/site.ts`; keep the split, or copy-paste and link previews
will disagree. Verify the punycode against the registrar's own conversion before
buying anything — the brand handoff quotes `xn--barntillvxt-p5a`, which is not a
valid encoding of this label.

Still to do when the domain is actually registered, none of it in this repo:

- Register the ASCII fallback `barntillvaxt.se` too and 301 it to the primary.
  Swedish users type `a` for `ä` about as often as not.
- Point the domain at Vercel, then move Supabase's `site_url` and
  `additional_redirect_urls` in `[remotes.prod]` off the `.vercel.app` host and
  `config push`. Until then the `.vercel.app` URL stays authoritative, so those
  values are deliberately unchanged.
- Put transactional mail on the ASCII domain. Mail to an IDN domain is poorly
  supported.
- `src/app/opengraph-image.png` was generated with Georgia standing in for
  Source Serif 4, which the generator did not have. Rebuild it with the real
  font before launch; the layout is final.

## How it is put together

```
src/lib/growth/     the curve maths — pure, dependency-free, no I/O
src/lib/            copy, formatting, validation, the reading state machine
src/components/     the chart and the screens' shared parts
src/app/            routes and server actions, plus the brand icons Next picks
                    up by convention (favicon.ico, icon.svg, apple-icon.png,
                    opengraph-image.png) and the web manifest
src/data/           the reference curves, imported at build time
public/             the logo and the PWA icons the manifest points at
supabase/           migrations, RLS tests, local config
extraction/         the Python that read the curves off the official charts
docs/reference/     the official PC PAL 0–2 year charts, as published
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

`src/data/boys-curves.json` and `src/data/girls-curves.json` are read off the
official Swedish PC PAL 0–2 year charts in `docs/reference/`. `SCHEMA.md` is the
data contract and `extraction/` is the pipeline that produced them. They are
loaded as static data at build time and are deliberately not in the database:
correcting the reference is a redeploy, not a migration, and no derived SDS is
ever stored.

The extraction's own validation must pass before any of this is trustworthy:

```bash
pip install pdfplumber numpy
python extraction/verify.py src/data/boys-curves.json src/data/girls-curves.json
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
