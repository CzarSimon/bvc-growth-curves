"use client";

import * as React from "react";
import { useActionState } from "react";
import Link from "next/link";
import { saveMeasurementAction, type FormState } from "@/app/actions";
import { Avatar } from "./child-switcher";
import { Button } from "./ui/button";
import { Field, FieldError, Input, UnitInput } from "./ui/input";
import { MEASUREMENT_FORM, NAV } from "@/lib/copy";
import { MEASURE_CONFIG, MEASURE_ORDER } from "@/lib/measures";
import { formatNumber } from "@/lib/format";
import type { Measurement } from "@/lib/child-data";

export function MeasurementForm({
  childId,
  childName,
  childAgeText,
  today,
  measurement,
  returnTo,
  backHref,
}: {
  childId: string;
  childName: string;
  childAgeText: string;
  today: string;
  measurement?: Measurement;
  returnTo: string;
  backHref: string;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    saveMeasurementAction,
    null,
  );
  const errors = state?.errors ?? {};

  const initial: Record<string, string> = {
    weight:
      measurement?.weightKg != null ? formatNumber(measurement.weightKg, 3) : "",
    length: measurement?.lengthCm != null ? formatNumber(measurement.lengthCm, 1) : "",
    head: measurement?.headCm != null ? formatNumber(measurement.headCm, 1) : "",
  };

  return (
    <form action={formAction} className="flex flex-col gap-4.5">
      <input type="hidden" name="childId" value={childId} />
      <input type="hidden" name="returnTo" value={returnTo} />
      {measurement ? (
        <input type="hidden" name="measurementId" value={measurement.id} />
      ) : null}

      {/* The active child is restated on the form. Entering on the wrong child
          is the expensive mistake this guards against. */}
      <div className="flex items-center gap-3 rounded-[14px] border border-border bg-surface px-3.5 py-3">
        <Avatar name={childName} active />
        <div className="flex flex-col leading-[1.2]">
          <span className="text-xs text-ink-muted">{MEASUREMENT_FORM.forChild}</span>
          <span className="text-[17px] font-semibold">
            {childName}, {childAgeText}
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-4.5 lg:grid lg:grid-cols-4 lg:items-start lg:gap-3">
        <Field
          label={MEASUREMENT_FORM.date}
          hint={measurement ? undefined : MEASUREMENT_FORM.dateHint}
          error={errors.measuredOn}
        >
          <Input
            type="date"
            name="measuredOn"
            defaultValue={measurement?.measuredOn ?? today}
            max={today}
          />
        </Field>

        {MEASURE_ORDER.map((measure) => {
          const config = MEASURE_CONFIG[measure];
          return (
            <label key={measure} className="flex flex-col gap-[7px]">
              <span className="text-[15px] font-semibold">{config.label}</span>
              <UnitInput
                name={measure}
                unit={config.unit}
                defaultValue={initial[measure]}
                placeholder={config.placeholder}
              />
              <FieldError>{errors[config.slug]}</FieldError>
            </label>
          );
        })}
      </div>

      <p className="prose-copy m-0 text-sm/[1.5] text-ink-muted">{MEASUREMENT_FORM.helper}</p>

      <FieldError>{errors.values}</FieldError>
      <FieldError>{errors.form}</FieldError>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <Button type="submit" size="primary" block disabled={pending} className="lg:w-auto lg:px-6">
          {MEASUREMENT_FORM.save}
        </Button>
        <Button asChild variant="outline" className="lg:w-auto">
          <Link href={backHref}>{MEASUREMENT_FORM.cancel}</Link>
        </Button>
      </div>
      <span className="sr-only">{NAV.back}</span>
    </form>
  );
}
