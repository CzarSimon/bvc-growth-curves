import Link from "next/link";
import { ChildForm } from "@/components/child-form";
import { listChildren } from "@/lib/db";
import { CHILD_FORM } from "@/lib/copy";

export default async function NewChildPage() {
  const children = await listChildren();
  const backHref = children.length ? `/barn/${children[0].id}` : "/barn";

  return (
    <div className="mx-auto flex w-full max-w-[680px] flex-col gap-5 px-4 py-5 pb-10">
      <div className="flex flex-col gap-1.5">
        <Link
          href={backHref}
          className="flex min-h-11 items-center self-start text-[15px] font-semibold text-accent"
        >
          ← Tillbaka
        </Link>
        <h1 className="font-serif text-[26px] font-semibold lg:text-[30px]">
          {CHILD_FORM.title}
        </h1>
      </div>
      <ChildForm backHref={backHref} />
    </div>
  );
}
