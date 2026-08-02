import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteChildAction, signOutAction } from "@/app/actions";
import { ChildForm } from "@/components/child-form";
import { getChild } from "@/lib/db";
import { AUTH, CHILD_FORM } from "@/lib/copy";

export default async function EditChildPage({
  params,
}: {
  params: Promise<{ childId: string }>;
}) {
  const { childId } = await params;
  const child = await getChild(childId);
  if (!child) notFound();
  const backHref = `/barn/${child.id}`;

  return (
    <div className="mx-auto flex w-full max-w-[680px] flex-col gap-5 px-4 py-4 pb-10">
      <div className="flex flex-col gap-1.5">
        <Link
          href={backHref}
          className="flex min-h-11 items-center self-start text-[15px] font-semibold text-accent"
        >
          ← {child.name}
        </Link>
        <h1 className="font-serif text-[26px] font-semibold lg:text-[30px]">
          {CHILD_FORM.editTitle}
        </h1>
      </div>

      <ChildForm child={child} backHref={backHref} />

      <div className="mt-4 flex flex-col gap-3 border-t border-hairline pt-5">
        <form action={deleteChildAction} className="flex flex-col gap-2">
          <input type="hidden" name="childId" value={child.id} />
          <p className="m-0 text-sm text-ink-muted">{CHILD_FORM.removeConfirm}</p>
          <button
            type="submit"
            className="min-h-11 cursor-pointer self-start rounded-[10px] border border-border-input px-4 text-sm font-semibold text-ink-secondary"
          >
            {CHILD_FORM.remove}
          </button>
        </form>

        <form action={signOutAction}>
          <button
            type="submit"
            className="min-h-11 cursor-pointer text-sm font-semibold text-ink-muted"
          >
            {AUTH.signOut}
          </button>
        </form>
      </div>
    </div>
  );
}
