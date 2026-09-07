import { WithdrawConsent } from "@/components/portal/consent-controls";
import { formatDateStamp } from "@/lib/format";

const CONSENT_LABEL = {
  sms: "Text messages",
  email: "Email",
} as const;

export function ConsentRecord({
  consent,
}: {
  consent: {
    id: string;
    kind: "sms" | "email";
    consent_text: string;
    granted_at: string;
    withdrawn_at: string | null;
  };
}) {
  const withdrawn = consent.withdrawn_at !== null;

  return (
    <details className="group">
      <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 px-[clamp(18px,2.4vw,28px)] py-[14px] transition-colors duration-200 hover:bg-surface/45 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent [&::-webkit-details-marker]:hidden">
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <span className="text-[15px] font-medium leading-[1.35]">
              {CONSENT_LABEL[consent.kind]}
            </span>
            <span
              className={
                withdrawn
                  ? "text-[12px] leading-[1.45] text-ink/58"
                  : "text-[12px] uppercase leading-[1.45] tracking-[0.13em] text-accent"
              }
            >
              {withdrawn
                ? `Withdrawn ${formatDateStamp(consent.withdrawn_at)}`
                : "In force"}
            </span>
          </span>
          <span className="mt-1 block text-[12.5px] leading-[1.5] text-ink/58">
            Given {formatDateStamp(consent.granted_at)} · View consent details
          </span>
        </span>
        <span
          aria-hidden="true"
          className="text-lg leading-none text-accent transition-transform duration-200 group-open:rotate-45"
        >
          +
        </span>
      </summary>

      <div className="border-t border-ink/8 px-[clamp(18px,2.4vw,28px)] pb-[18px] pt-[14px]">
        <blockquote className="border-l-2 border-ink/12 py-[2px] pl-[14px] text-[13px] leading-[1.7] text-ink/58">
          {consent.consent_text}
        </blockquote>

        {withdrawn ? (
          <p className="mt-[14px] text-[13px] leading-[1.65] text-ink/55">
            {consent.kind === "sms"
              ? "Withdrawn. We will not text you about this claim."
              : "Withdrawn. We will not send you marketing email about this claim — messages about the claim itself still reach you."}
          </p>
        ) : (
          <div className="mt-[14px]">
            <WithdrawConsent consentId={consent.id} kind={consent.kind} />
          </div>
        )}
      </div>
    </details>
  );
}
