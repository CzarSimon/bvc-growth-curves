import Link from "next/link";
import { ACCESS_ENDED } from "@/lib/copy";

/**
 * A child that is not there for you.
 *
 * Access changes are never announced — that is the design — but a person whose
 * view-only access has ended is holding an app that was showing a child a
 * moment ago. It has to stop showing it *and say why*, or it reads as a bug.
 * That is state, not a notification.
 *
 * The same page answers a URL that was never yours, which is why it says "var
 * det delat med dig" rather than asserting that it was: the app cannot see a
 * child it has no access to, and will not guess.
 *
 * It sits above `[childId]` rather than inside it because the child's own
 * layout is what raises `notFound()` — a boundary inside that layout would have
 * to render inside the thing that just failed.
 */
export default function ChildNotFound() {
  return (
    <div className="mx-auto flex w-full max-w-[560px] flex-1 flex-col gap-4 px-6 py-10">
      <h1 className="font-serif text-[26px] leading-[1.2] font-semibold">{ACCESS_ENDED.title}</h1>
      <p className="prose-copy m-0 text-base/[1.55] text-ink-secondary">{ACCESS_ENDED.body}</p>
      <Link href="/barn" className="text-[15px] font-semibold text-accent">
        {ACCESS_ENDED.back}
      </Link>
    </div>
  );
}
