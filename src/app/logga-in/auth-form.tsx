"use client";

import * as React from "react";
import { useActionState } from "react";
import { signInAction, signUpAction, type FormState } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Field, FieldError, Input } from "@/components/ui/input";
import { AUTH } from "@/lib/copy";

export function AuthForm({ returnTo }: { returnTo?: string }) {
  const [mode, setMode] = React.useState<"in" | "up">("in");
  const action = mode === "in" ? signInAction : signUpAction;
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, null);
  const errors = state?.errors ?? {};

  return (
    <form action={formAction} className="flex flex-col gap-5">
      {returnTo ? <input type="hidden" name="retur" value={returnTo} /> : null}
      <Field label={AUTH.email} error={errors.email}>
        <Input type="email" name="email" autoComplete="email" required />
      </Field>
      <Field
        label={AUTH.password}
        hint={mode === "up" ? AUTH.passwordHint : undefined}
        error={errors.password}
      >
        <Input
          type="password"
          name="password"
          autoComplete={mode === "in" ? "current-password" : "new-password"}
          required
        />
      </Field>
      <FieldError>{errors.form}</FieldError>
      <Button type="submit" size="primary" block disabled={pending}>
        {mode === "in" ? AUTH.signIn : AUTH.signUp}
      </Button>
      <Button
        type="button"
        variant="quiet"
        onClick={() => setMode(mode === "in" ? "up" : "in")}
      >
        {mode === "in" ? AUTH.toggleToSignUp : AUTH.toggleToSignIn}
      </Button>
    </form>
  );
}
