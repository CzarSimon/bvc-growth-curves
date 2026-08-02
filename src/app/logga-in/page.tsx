import Link from "next/link";
import { AuthForm } from "./auth-form";
import { APP_NAME, AUTH, NAV } from "@/lib/copy";

export default function SignInPage() {
  return (
    <div className="mx-auto flex w-full max-w-[420px] flex-1 flex-col gap-7 px-6 py-9">
      <div className="mt-6 flex flex-col gap-3.5">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent font-serif text-2xl text-white">
          K
        </span>
        <h1 className="font-serif text-[34px] leading-[1.15] font-semibold tracking-[-0.01em]">
          {APP_NAME}
        </h1>
        <p className="prose-copy text-[17px]/[1.5] text-ink-secondary">{AUTH.intro}</p>
      </div>

      <div className="rounded-[14px] border border-border bg-surface p-[18px]">
        <AuthForm />
      </div>

      <Link href="/om-kurvorna" className="text-sm font-semibold text-accent">
        {NAV.about}
      </Link>
    </div>
  );
}
