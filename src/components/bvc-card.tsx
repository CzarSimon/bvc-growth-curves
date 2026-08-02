import { ATTENTION_TITLE, BVC_CARD } from "@/lib/copy";

/**
 * Permanent, never conditional on a flag, and with no action buttons: most
 * mottagningar have no chat and the phone number is region-specific, so a
 * "Ring BVC" button would be a fake integration. Copy only, pointing at the
 * BVC card and 1177.se.
 */
export function BvcCard() {
  return (
    <div className="flex flex-col gap-2 rounded-[14px] border border-accent-border bg-accent-surface p-4">
      <span className="text-[15px] font-semibold text-accent-text">{BVC_CARD.title}</span>
      <p className="prose-copy m-0 text-[15px]/[1.55] text-accent-text">{BVC_CARD.body}</p>
      <p className="m-0 text-sm/[1.5] text-accent-text-soft">{BVC_CARD.where}</p>
    </div>
  );
}

/**
 * The single escalation. No colour, no icon fill, no alarm — it is a quiet card
 * that names what moved and routes to BVC.
 */
export function AttentionCard({ text }: { text: string }) {
  return (
    <div className="flex flex-col gap-2.5 rounded-[14px] border border-border-strong bg-surface p-4">
      <div className="flex items-center gap-2.5">
        <span
          aria-hidden
          className="flex h-6 w-6 items-center justify-center rounded-md border-[1.5px] border-ink text-sm font-bold"
        >
          !
        </span>
        <span className="text-[15px] font-semibold">{ATTENTION_TITLE}</span>
      </div>
      <p className="prose-copy m-0 text-[15px]/[1.5] text-ink-secondary">{text}</p>
    </div>
  );
}
