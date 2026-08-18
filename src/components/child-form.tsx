"use client";

import * as React from "react";
import { useActionState } from "react";
import Link from "next/link";
import { createChildAction, updateChildAction, type FormState } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Field, FieldError, Input } from "@/components/ui/input";
import { CHILD_FORM, NAV } from "@/lib/copy";
import { MEASURE_CONFIG } from "@/lib/measures";
import { type Sex } from "@/lib/growth";
import { cn } from "@/lib/cn";
import type { Child } from "@/lib/child-data";

export function ChildForm({ child, backHref }: { child?: Child; backHref: string }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    child ? updateChildAction : createChildAction,
    null,
  );
  const errors = state?.errors ?? {};

  const [sex, setSex] = React.useState<Sex>(child?.sex ?? "female");
  const [weeks, setWeeks] = React.useState(child ? String(child.gestationWeeks) : "");
  const [days, setDays] = React.useState(child ? String(child.gestationDays) : "");

  return (
    <form action={formAction} className="flex flex-col gap-5">
      {child ? <input type="hidden" name="childId" value={child.id} /> : null}
      <input type="hidden" name="sex" value={sex} />

      <div className="flex flex-col gap-5 lg:grid lg:grid-cols-2 lg:gap-4">
        <Field label={CHILD_FORM.name} error={errors.name}>
          <Input
            name="name"
            defaultValue={child?.name}
            placeholder={CHILD_FORM.namePlaceholder}
            autoComplete="off"
          />
        </Field>

        <Field label={CHILD_FORM.birthDate} error={errors.birthDate}>
          <Input type="date" name="birthDate" defaultValue={child?.birthDate} />
        </Field>

        <div className="flex flex-col gap-[7px]">
          <span className="text-sm font-semibold">{CHILD_FORM.sex}</span>
          <div className="flex gap-2">
            {(
              [
                ["female", CHILD_FORM.girl],
                ["male", CHILD_FORM.boy],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={sex === value}
                onClick={() => setSex(value)}
                className={cn(
                  "min-h-13 flex-1 cursor-pointer rounded-[10px] border text-base font-semibold",
                  sex === value
                    ? "border-accent bg-accent text-white"
                    : "border-border-input bg-surface text-ink-secondary",
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <span className="text-[13px]/[1.4] text-ink-muted">{CHILD_FORM.sexHint}</span>
          <FieldError>{errors.sex}</FieldError>
        </div>
      </div>

      {/*
        Gestational length is a required field, but it does exactly one thing:
        it decides whether these curves apply to this child at all. It does not
        move the curve — a child born at 38+0 is plotted from birth, the same as
        one born at 41+0, which is how BVC reads the card. The explainer says so.
      */}
      <div className="flex flex-col gap-2.5 rounded-[14px] border border-border bg-surface p-4">
        <span className="text-sm font-semibold">{CHILD_FORM.gestation}</span>
        <div className="flex items-end gap-2.5">
          <label className="flex min-w-0 flex-1 flex-col gap-1.5">
            <span className="text-[13px] text-ink-muted">{CHILD_FORM.weeks}</span>
            <Input
              inputMode="numeric"
              name="gestationWeeks"
              value={weeks}
              onChange={(event) => setWeeks(event.target.value)}
              placeholder="40"
            />
          </label>
          <span className="pb-4 text-lg text-ink-muted">+</span>
          <label className="flex min-w-0 flex-1 flex-col gap-1.5">
            <span className="text-[13px] text-ink-muted">{CHILD_FORM.days}</span>
            <Input
              inputMode="numeric"
              name="gestationDays"
              value={days}
              onChange={(event) => setDays(event.target.value)}
              placeholder="0"
            />
          </label>
        </div>
        <p className="prose-copy m-0 text-sm/[1.5] text-ink-secondary">
          {CHILD_FORM.gestationExplainer}
        </p>
        <FieldError>{errors.gestation}</FieldError>
      </div>

      {!child ? (
        <div className="flex flex-col gap-3 rounded-[14px] border border-border bg-surface p-4">
          <span className="text-sm font-semibold">
            {CHILD_FORM.birthValues}{" "}
            <span className="font-normal text-ink-muted">{CHILD_FORM.birthValuesOptional}</span>
          </span>
          <div className="flex gap-2.5 lg:grid lg:grid-cols-3">
            <BirthValue name="birthWeight" label={CHILD_FORM.birthWeight} measure="weight" error={errors.vikt} />
            <BirthValue name="birthLength" label={CHILD_FORM.birthLength} measure="length" error={errors.langd} />
            <BirthValue name="birthHead" label={CHILD_FORM.birthHead} measure="head" error={errors.huvudomfang} />
          </div>
        </div>
      ) : null}

      <FieldError>{errors.form}</FieldError>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <Button type="submit" size="primary" block disabled={pending} className="lg:w-auto lg:px-6">
          {child ? CHILD_FORM.saveEdit : CHILD_FORM.save}
        </Button>
        <Button asChild variant="quiet">
          <Link href={backHref}>{NAV.back}</Link>
        </Button>
      </div>
    </form>
  );
}

function BirthValue({
  name,
  label,
  measure,
  error,
}: {
  name: string;
  label: string;
  measure: "weight" | "length" | "head";
  error?: string;
}) {
  return (
    <label className="flex min-w-0 flex-1 flex-col gap-1.5">
      <span className="text-[13px] text-ink-muted">{label}</span>
      <Input
        inputMode="decimal"
        name={name}
        placeholder={MEASURE_CONFIG[measure].placeholder}
      />
      <FieldError>{error}</FieldError>
    </label>
  );
}
