import Link from "next/link";
import { AuthForm } from "./auth-form";
import { APP_NAME, NAV } from "@/lib/copy";
import { BrandMark } from "@/components/brand-mark";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ retur?: string }>;
}) {
  // An invite link sends a signed-out visitor here and wants them back
  // afterwards. The value is checked again in the action before anyone is
  // redirected anywhere.
  const { retur } = await searchParams;

  return (
    <div className="mx-auto flex w-full max-w-[420px] flex-1 flex-col gap-7 px-6 py-9">
      {/*
        The brand, and nothing that belongs to one of the two modes. What this
        screen is — signing in, or making an account — is said inside the card,
        by the form that knows which one is showing.
      */}
      <div className="mt-6 flex flex-col gap-3.5">
        <BrandMark size={44} />
        <h1 className="font-serif text-[34px] leading-[1.15] font-semibold tracking-[-0.01em]">
          {APP_NAME}
        </h1>
      </div>

      <div className="rounded-[14px] border border-border bg-surface p-[18px]">
        <AuthForm returnTo={retur} />
      </div>

      <Link href="/om-kurvorna" className="text-sm font-semibold text-accent">
        {NAV.about}
      </Link>
    </div>
  );
}
