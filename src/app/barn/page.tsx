import Link from "next/link";
import { redirect } from "next/navigation";
import { listChildren } from "@/lib/db";
import { APP_NAME, START } from "@/lib/copy";
import { Button } from "@/components/ui/button";

/**
 * First run: no child yet. The job of this screen is to establish in a few
 * seconds what the app does and, just as importantly, what it does not do.
 */
export default async function ChildrenPage() {
  const children = await listChildren();
  if (children.length > 0) redirect(`/barn/${children[0].id}`);

  return (
    <div className="mx-auto flex w-full max-w-[560px] flex-1 flex-col gap-7 px-6 pt-9 pb-8 lg:my-15">
      <div className="mt-6 flex flex-col gap-3.5">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent font-serif text-2xl text-white">
          K
        </span>
        <h1 className="font-serif text-[34px] leading-[1.15] font-semibold tracking-[-0.01em] lg:text-[40px]">
          {APP_NAME}
        </h1>
        <p className="prose-copy text-[17px]/[1.5] text-ink-secondary lg:text-[19px]">
          {START.promise}
        </p>
      </div>

      <ol className="flex flex-col gap-3.5 rounded-[14px] border border-border bg-surface p-[18px]">
        {START.points.map((point, index) => (
          <li key={point} className="flex items-start gap-3">
            <span className="mt-px flex h-5.5 w-5.5 flex-none items-center justify-center rounded-full border-[1.5px] border-accent text-xs font-bold text-accent">
              {index + 1}
            </span>
            <p className="prose-copy m-0 text-[15px]/[1.45] text-ink-secondary">{point}</p>
          </li>
        ))}
      </ol>

      <div className="mt-auto flex flex-col gap-3">
        <Button asChild size="primary" block className="lg:w-auto lg:self-start lg:px-6">
          <Link href="/barn/nytt">{START.addChild}</Link>
        </Button>
        <p className="text-center text-[13px]/[1.45] text-ink-muted lg:text-left">
          {START.storage}
        </p>
      </div>
    </div>
  );
}
