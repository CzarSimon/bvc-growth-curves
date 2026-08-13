import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteChildAction, signOutAction } from "@/app/actions";
import { ChildForm } from "@/components/child-form";
import { getChild, getMyRole, listChildAccess } from "@/lib/db";
import { canEdit, canManageAccess, sharedRole } from "@/lib/access";
import { AUTH, CHILD_FORM } from "@/lib/copy";

export default async function EditChildPage({
  params,
}: {
  params: Promise<{ childId: string }>;
}) {
  const { childId } = await params;
  const [child, myRole, access] = await Promise.all([
    getChild(childId),
    getMyRole(childId),
    listChildAccess(childId),
  ]);
  if (!child) notFound();
  const backHref = `/barn/${child.id}`;
  const mayEdit = canEdit(myRole);

  // Deleting a shared child would take the measurements away from the other
  // guardian as well, which is exactly what "ingen av er kan ta bort den andra"
  // exists to prevent. The database refuses it while a second co-manager
  // exists; here the refusal is said out loud instead of shown as a button that
  // fails.
  const otherManagers = access.filter(
    (member) => sharedRole(member.role) === "guardian" && !member.isSelf,
  );
  const mayDelete = canManageAccess(myRole) && otherManagers.length === 0;

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
          {mayEdit ? CHILD_FORM.editTitle : AUTH.accountTitle}
        </h1>
      </div>

      {/* A view-only user gets this route for one reason: signing out lives
          here. Nothing about the child is editable from it. */}
      {mayEdit ? <ChildForm child={child} backHref={backHref} /> : null}

      <div className="mt-4 flex flex-col gap-3 border-t border-hairline pt-5">
        {mayEdit ? (
          mayDelete ? (
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
          ) : (
            <p className="prose-copy m-0 text-sm/[1.5] text-ink-muted">
              {CHILD_FORM.removeSharedBlocked(child.name)}
            </p>
          )
        ) : null}

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
