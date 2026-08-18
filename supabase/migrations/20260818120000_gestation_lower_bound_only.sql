-- Gestational age becomes a gate, not a curve offset.
--
-- The app used to shift each child along the age axis by 280 days minus their
-- gestation, on the reasoning that the Swedish reference is anchored at 40+0.
-- Swedish child health care does not do that: only preterm children get a
-- corrected age, and they are followed on a separate reference this app does
-- not have. Every child the app does support is now plotted from birth, so
-- gestation_weeks / gestation_days decide exactly one thing — whether the app
-- supports this child at all.
--
-- That leaves 37+0 as the only meaningful boundary, and it is a lower bound.
-- The old upper bound of 42+0 refused post-term children (överburen, from
-- 42+0) that BVC plots perfectly normally: there is no post-term curve and no
-- downward adjustment anywhere in practice. It goes.
--
-- gestation_days stays bounded to 0–6 — that is notation, not clinical scope.

alter table public.children
  drop constraint if exists children_gestation_within_term;

alter table public.children
  drop constraint if exists children_gestation_weeks_check;

alter table public.children
  add constraint children_gestation_from_term
    check (gestation_weeks >= 37);

comment on column public.children.gestation_weeks is
  'Completed weeks of gestation at birth. Below 37 the app has no reference and refuses the child; there is deliberately no upper bound.';

comment on column public.children.gestation_days is
  'Days on top of gestation_weeks, 0-6. Notation only — it does not move the curve.';
