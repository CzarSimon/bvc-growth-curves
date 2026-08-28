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

**The project must sign JWTs with an asymmetric key**, and this is the one
piece of dashboard state the CLI cannot carry: Authentication → JWT Keys →
migrate to an ECC (P-256) signing key. It is free on every plan, and existing
sessions survive the rollover — the legacy secret keeps working until it is
revoked, so nobody is signed out.

This is a performance dependency, not a security one, and it fails quietly.
`src/lib/supabase/middleware.ts` and `isSignedIn()` call `getClaims()`, which
verifies the token locally against a cached JWKS. Against a symmetric secret
`getClaims()` still returns the right answer — by asking the auth server over
the network, which is exactly the round trip per request that those two call
sites exist to avoid. Nothing breaks; the app is just slow again.

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

**The invite link is the deliberate exception to "any href".** It is the one URL
in the product that a person reads, sends to someone else and vouches for, and
`xn--barntillvxt-t8a.se/i/WpM-…` in a text message is what a phishing link looks
like — a bad thing to send someone you are asking to trust you with a child's
health data. `inviteUrl()` decodes the host it built the link from, so both the
displayed and the copied link are `barntillväxt.se/i/CODE`. Browsers re-encode
it before resolving anything, and the app never fetches the string.

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

- **Age is measured from birth**, and gestational length does not move it. The
  Swedish reference is anchored at 40+0, which makes it tempting to shift each
  child by how far their own birth sat from that anchor — the app used to. BVC
  does not: only preterm children get a corrected age, and they are followed on
  a separate reference this app does not have. Correcting a term child here
  would put the app at odds with the card the parent is holding. Gestational
  age is still required, and decides one thing only: whether the app supports
  this child at all.
- **Weight is log-normal.** Its stored mean and SD are in log₁₀(kg) and the
  z-score is computed on that scale, back-transformed with `10^x` for the
  chart's bands. Length and head are normal, in centimetres. The module reads
  the reference file's own `distribution` field and treats an unrecognised
  value as an error rather than falling through to the linear case.
- **Interpolation is monotone cubic (PCHIP).** A natural spline overshoots
  across the reference's wide intervals and can produce a mean growth curve
  that dips. Mean and SD are interpolated independently.
- **Nothing is extrapolated and nothing is clamped.** Outside 0–24 months of
  age, or for a child born before 37+0, callers get a typed out-of-range
  result and the UI says so in plain Swedish. A value that cannot be placed is
  still stored and still shown — it is only left off the chart, with a note
  saying why.

### The projection

"Visa fortsättning" on the curve screen draws a dashed continuation of the
child's own line, from the latest measurement to the child's corrected age
today. It holds the latest SDS constant and reads the reference forward
(`src/lib/growth/projection.ts`) — the same assumption a nurse says out loud,
"om hon fortsätter i sin kanal".

- **It is not a trend fit and must not become one.** A slope fitted to two BVC
  visits turns a 100 g weighing difference into kilos by age two.
- **It stops at today's age, never at the end of the visible interval.** The
  zoom only ever clips the line short. Everything past today is speculation
  about a child who has not been measured yet.
- It is off by default, lives only in component state, and never appears on the
  home screen's previews. Every state that draws nothing still says why.

### The home screen's values

The three numbers under the reading are the latest value of *each* measure, not
the three columns of the latest measurement (`latestValueFor` in
`src/lib/child-data.ts`). A parent who weighs the child at home between visits
leaves rows carrying a weight and nothing else; reading only the newest row
would blank out the length and the head from the last BVC visit, which are
still the newest ones there are.

Because the three can come from different days, each carries its own date and
age. Nothing on that block implies the values were taken together, and a measure
never filled in says so rather than showing a bare dash.

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

### Sharing a child

Two roles, one link, and one asymmetry that carries the whole design.

| role | in the UI | can | removable |
|---|---|---|---|
| `owner` | **Delar ansvaret** | everything the first parent can do | **never, by anyone** |
| `viewer` | **Kan se** | curves, measurements, the projection | yes, by any co-manager |

Permanence attaches to the role, not to the link. Sharing is open to whoever
holds the link, so a permanent role behind a forwardable link would hand a
stranger unrevocable access to a child's health data; splitting it by role keeps
the custody stance — two guardians cannot shut each other out — while leaving
view-only access revocable, which is what makes an access screen possible at
all. Every co-manager is equal: there is no primary account and no original
owner.

A link is an invite, not access. The role is written into the invite row before
the link exists, it is single use, it expires after seven days, and the parent
sends it themselves — no email collection, no delivery infrastructure. The token
lives in the link only; the database stores its SHA-256, so a leaked backup
cannot be replayed into access.

**A view-only user gets a different composition, not a greyed-out one.** They
see the curves, the measurement list and the projection. They do not see the
reading, the attention card, or any way to add or edit — the reading interprets
and the attention card routes to BVC, and both belong to the person who will
make the call. The home screen says so in a sentence rather than leaving them to
notice what is missing.

Nobody is notified about anything: not when a measurement is added, not when
access is revoked. The one place that cannot hold is state rather than a
message — a child that has stopped being shared with you disappears, and
`src/app/barn/not-found.tsx` says why instead of showing a bare 404.

None of this is enforced in the UI. Every rule above is an RLS policy or a
`security definer` function, and `supabase/tests/rls.sql` exercises them: a
"Kan se" user who POSTs a measurement is refused by Postgres, a co-manager
cannot be deleted by any route, and a used or expired link cannot be redeemed.

Three decisions the design handover left open, all of them additive if the
answer changes:

- **A co-manager cannot leave.** "Neither can remove the other" does not settle
  whether you can remove yourself; nothing here lets you. If leaving should be
  possible, it is one delete policy.
- **View-only access does not expire.** A childminder keeps access until someone
  revokes it. Adding expiry is a nullable column and a clause in
  `has_child_access`.
- **A shared child cannot be deleted at all.** Deleting it would take the
  measurements away from the other guardian too, which is what permanence
  exists to prevent, so it is refused while a second co-manager exists. A joint
  delete, or one the other must confirm, is the obvious next design.

### Why invite links are not brute-forceable

The token is 128 random bits (`randomBytes(16)`, base64url, 22 characters). With
10,000 live invites, a random guess hits one with probability ~3 × 10⁻³⁵; a year
of sustained 1,000 requests per second is ~3 × 10¹⁰ guesses, so the expected
number of hits is ~10⁻²⁴. Nothing needs to stand in front of that.

**The length is the whole defence, and it is the thing most likely to be
"tidied".** The design's prototype shows a six-character code, which would be
36⁶ ≈ 2.2 × 10⁹ — sweepable in days at modest request rates, and with a few
thousand live invites you would land on one within minutes. Shortening the token
is what would turn rate limiting from a nicety into the only thing holding the
door. `src/lib/invite.ts` says so at the definition; keep it there.

What that argument does *not* cover:

- **Abuse.** Nothing stops someone hammering `child_invite_preview` and burning
  database CPU. That is a denial-of-service and billing problem, and the cheapest
  answer is a Vercel Firewall rate-limit rule on `/i/*` rather than code — an
  in-process counter does not survive serverless, so a code-level limiter means
  KV or Upstash.
- **The link getting away from its owner**, which is the realistic threat and the
  one the copy names out loud: whoever opens it first is who gets in. Single use
  and seven days bound the window. A PIN sent out of band would close it
  properly, but a 4–6 digit PIN is 10⁴–10⁶ wide and would itself need an attempt
  limit — it is "PIN *and* throttling", never "PIN *instead of*". Worth deciding
  for `Delar ansvaret` alone, where the grant is permanent.
- **The token sitting in a URL.** `next.config.ts` sends `Referrer-Policy:
  no-referrer` and `X-Robots-Tag: noindex` on `/i/*`, so a link on that page
  cannot leak the token in a `Referer` header and a pasted link cannot be
  indexed. Vercel's access logs still record the path. Moving the token into the
  URL fragment would fix that and would change how the page works — it could no
  longer be read on the server.

Link unfurling is safe and should stay that way: the invite page sets no
per-page OpenGraph metadata, so a preview in a group chat shows the app's
generic title rather than the child's name, and a crawler cannot consume an
invite — accepting one takes an authenticated POST.

### Data model

Access is a membership join table, not an owner column on the child:

```
children        no owner_id
child_members   (child_id, user_id, role) with roles owner / editor / viewer
child_invites   one row per link: child, role, sha256 of the token, expiry, use
profiles        display name per user, typed at sign-up or derived from the email
measurements    nullable weight_grams, length_mm, head_mm — any one may stand alone
                created_by, stamped by a trigger, for "lagt in av Erik"
```

`editor` is in the enum and unused: it predates the design and would be a third,
weaker co-manager. Sharing creates `owner` and `viewer` rows only.

Names exist because sharing needs them — `auth.users` is not readable by the
application roles, and an access screen that cannot name anyone is useless. A
profile is created by a trigger on sign-up. Its display name is the optional one
typed on the sign-up form, and the email's local part when that is left empty;
there is no screen for editing it afterwards.

The typed name reaches the trigger through `raw_user_meta_data`, which is the
user's own writable metadata rather than something only this app can set, so the
trigger sanitises it — whitespace collapsed, cut to 60 characters, falling back
to the derived name if nothing is left. Nothing about a display name is unique:
two people sharing one is ordinary, and a name is never used to tell accounts
apart.

Weight is stored in whole grams and lengths in whole millimetres. Medical
values do not go in floats. `measured_on` is the day the child was measured and
is distinct from `created_at`, because a parent copying in from the BVC card
backfills months later.

Row-level security is on from the first migration and every policy is written
against the membership table. `supabase/tests/rls.sql` exercises it with three
users — a co-manager, a second co-manager and a view-only guest — and loosening
any policy makes it fail.

### Copy

Every sentence the product says lives in `src/lib/copy.ts`, and the home
screen's state machine that assembles them lives in `src/lib/reading.ts`. This
text is the highest-risk surface in the product and should be reviewable in one
sitting. **It has not been read by a BVC nurse yet, and should be before this
goes anywhere near a real parent.**

The sharing copy comes verbatim from the design handover, apart from four
strings written here and flagged in the file: the three dead-link states (used,
expired, wrong), and the refusal to delete a child that two people co-manage.
The permanence rule and the no-notification rule both have GDPR and custody
implications and need the same sign-off as the clinical copy.

## What is not built

GDPR export and delete are not built. Neither is leaving a child you were shared
into, expiring view-only access, or deleting a child that two people co-manage —
see the three open decisions under "Sharing a child".

Invite links are not rate limited. This is a cost and availability gap, not a
confidentiality one, and the two are worth keeping apart — see "Why invite links
are not brute-forceable" below.

Preterm children (born before 37+0) are out of scope: the app says so rather
than silently plotting them on term curves. There is no upper bound — a
post-term child (*överburen*, from 42+0) is plotted from birth like any other,
which is what Swedish care does: no separate curve, no adjustment.
