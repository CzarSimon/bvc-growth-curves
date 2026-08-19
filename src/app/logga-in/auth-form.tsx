"use client";

import * as React from "react";
import { useActionState } from "react";
import { signInAction, signUpAction, type FormState } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Field, FieldError, Input } from "@/components/ui/input";
import { AUTH } from "@/lib/copy";

/**
 * Signing in and creating an account, in one form.
 *
 * The two modes carry their own heading and lead rather than differing only in
 * the button, so that someone who came here to make an account can see that
 * they are making one — and so that the sentence about what an account is has
 * somewhere to sit. Creating an account is also the only mode that asks for a
 * name: it is asked once, when the account is made.
 */
export function AuthForm({ returnTo }: { returnTo?: string }) {
  const [mode, setMode] = React.useState<"in" | "up">("in");
  const signingUp = mode === "up";

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <h2 className="font-serif text-[22px] leading-[1.2] font-semibold tracking-[-0.01em]">
          {signingUp ? AUTH.signUpTitle : AUTH.title}
        </h2>
        <p className="prose-copy text-[15px]/[1.5] text-ink-secondary">
          {signingUp ? AUTH.signUpIntro : AUTH.intro}
        </p>
      </div>

      {/*
        Keyed on the mode so switching starts the other form clean: the error
        from a failed sign-in has nothing to say under "Skapa konto".
      */}
      <ModeForm
        key={mode}
        signingUp={signingUp}
        returnTo={returnTo}
        onToggle={() => setMode(signingUp ? "in" : "up")}
      />
    </div>
  );
}

function ModeForm({
  signingUp,
  returnTo,
  onToggle,
}: {
  signingUp: boolean;
  returnTo?: string;
  onToggle: () => void;
}) {
  const action = signingUp ? signUpAction : signInAction;
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, null);
  const errors = state?.errors ?? {};

  return (
    <form action={formAction} className="flex flex-col gap-5">
      {returnTo ? <input type="hidden" name="retur" value={returnTo} /> : null}
      <Field label={AUTH.email} error={errors.email}>
        <Input type="email" name="email" autoComplete="email" required />
      </Field>
      {signingUp ? (
        <Field label={AUTH.displayName} hint={AUTH.displayNameHint} error={errors.displayName}>
          <Input type="text" name="displayName" autoComplete="name" />
        </Field>
      ) : null}
      <Field
        label={AUTH.password}
        hint={signingUp ? AUTH.passwordHint : undefined}
        error={errors.password}
      >
        <Input
          type="password"
          name="password"
          autoComplete={signingUp ? "new-password" : "current-password"}
          required
        />
      </Field>
      <FieldError>{errors.form}</FieldError>
      <Button type="submit" size="primary" block disabled={pending}>
        {signingUp ? AUTH.signUp : AUTH.signIn}
      </Button>
      <Button type="button" variant="quiet" onClick={onToggle}>
        {signingUp ? AUTH.toggleToSignIn : AUTH.toggleToSignUp}
      </Button>
    </form>
  );
}
