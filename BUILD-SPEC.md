# Build spec: growth tracking prototype

Build the initial working prototype of a web app that lets a parent record a
newborn's measurements and plot them against the official Swedish growth
curves.

**Read `DESIGN-HANDOVER.md` first and implement that design.** It is the
source of truth for layout, component structure, copy, and interaction. This
document covers everything the design handover doesn't: data model, curve
maths, stack decisions, and correctness requirements. Where the two disagree
on anything visual or verbal, the design handover wins — ask before diverging
from it.

All user-facing copy is in **Swedish**. Code, comments, commits and this spec
are in English.

## Stack

- TypeScript, React, Next.js (App Router)
- shadcn/ui for components, Tailwind for styling
- Supabase for auth and persistence
- Deployable to Vercel

**Must run fully locally.** `npm install && npm run dev` against a local
Supabase (`supabase start`) with no cloud dependency. Commit migrations, not a
hand-managed remote schema. Write `README.md` with exact setup steps and
`.env.example` with every required variable.

## The curve data — treat as a validated interface

The extraction work is done and lives in this repo. Before building on it:

1. Run the extraction's own validation and confirm it passes. If it doesn't,
   **stop and report** rather than building on unverified numbers.
2. Write a test asserting the reference values reproduce the published
   anchors at 0/3/6/9/12/15/18/21/24 months.

Load the curve JSON as static data at build time. It never changes at runtime
and must not live in the database.

## Curve maths — the highest-stakes code in the app

Put this in one pure, dependency-free module with thorough unit tests. Every
number the parent sees comes from here.

**Age axis.** Age is days since birth. Nothing is shifted for gestational
length:

```
ageMonths = chronologicalAgeDays / 30.4375
```

The reference itself is anchored at 40+0, and an earlier version of this spec
moved each child along the axis by how far their own birth sat from that
anchor. Swedish child health care does not do this — only preterm children get
a corrected age, on a separate reference the app does not carry — so the app
would have been disagreeing with the BVC card the parent is holding. A 38-week
and a 41-week baby of the same chronological age plot at the same position.

Gestational age at birth is still required, and decides exactly one thing:
whether the app supports this child at all.

**SDS.**

```
SDS = (value - mean) / sd
```

with weight on the **log10 scale**: `SDS = (log10(kg) - mean) / sd`, where the
stored mean and sd for weight are already log10. Back-transform with `10^x`
when computing a value at a given SD level for the chart bands. Getting this
wrong produces errors that are small near the mean and large in the tails —
i.e. wrong exactly where it matters. Test the tails explicitly.

**Interpolation between reference points.** Use monotone cubic (PCHIP), not a
natural spline. A cubic spline overshoots across wide intervals and produces a
non-monotonic mean growth curve. Interpolate mean and sd independently.

**Never extrapolate.** Outside 0–24 months, or for a child born before 37+0,
return a clear "out of range" result and have the UI say so plainly. Do not
silently clamp.

## Data model

Design the schema so the out-of-scope features can be added later **without a
migration that rewrites ownership**:

- Do not put `owner_id` on the child. Use a membership join table
  (`child_id`, `user_id`, `role`) with roles for write and read-only, even
  though the prototype only ever creates one membership per child.
- Measurements: nullable weight, length, head circumference — **any single one
  may be present alone**. Do not require all three. Store a measurement date
  distinct from the created timestamp.
- Store raw measured values, never derived SDS. SDS is computed on read, so a
  corrected reference doesn't leave stale numbers in the database.
- Store weight in grams and lengths in millimetres as integers. Avoid floats
  for medical values.
- Enable row-level security from the first migration and write the policies
  against the membership table. Retrofitting RLS is how data leaks happen.

## Validation

Reject impossible input at the boundary, and say why in Swedish:

- Measurement date not before date of birth, not in the future
- Values within plausible physical ranges — a mistyped `45` kg instead of
  `4,5` must be caught
- Gestational age from 37+0 (preterm is out of scope; say so, don't fail
  silently). No upper bound — a post-term child is plotted like any other

Input uses **Swedish decimal comma** (`4,250 kg`, `52,5 cm`). Accept both comma
and period on input; render comma. Weight to the gram, lengths to the
millimetre.

## Safety requirements — non-negotiable

- The app never diagnoses and never implies a diagnosis.
- No copy tells a parent what to do medically. Concern routes to BVC.
- The disclaimer and the BVC route are implemented as designed, not deferred.
- Include curve data provenance somewhere reachable — which reference, which
  version — so a clinician can check what's being plotted.

## Scope

**Build:** auth, add/edit/delete child, add/edit/delete measurement, the growth
chart, measurement history, child switching, all empty and sparse states from
the design.

**Do not build yet:** multi-user sharing, read-only access, GDPR export and
delete. Leave the schema ready for them; add no UI.

## Working agreement

- Get one measure (weight) end-to-end and correct before building the other
  two. A working vertical slice beats three half-built ones.
- The maths module and its tests come before any chart rendering.
- Commit in logical steps with real messages.
- **If something in the design handover is ambiguous or looks wrong once
  implemented, ask — don't guess and don't silently redesign.**
- Flag anything you had to assume, in a short list at the end.
