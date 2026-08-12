import { Button, Section, Text } from "@react-email/components";
import { DetailRow, EmailLayout, emailStyles, emailTheme } from "./layout";

export type QuestionStaffAlertPayload = {
  claimRef: string;
  /** The homeowner's full name — this one is read by staff, not by them. */
  homeownerName: string;
  question: string;
  /** Who owns the file, so the inbox can route it without opening the claim. */
  assignedTo?: string;
  claimUrl: string;
};

/**
 * The homeowner asked something on the claim feed.
 *
 * `askQuestion` tells them "your adjuster will answer here, and we will email
 * you when they do" — a promise with two halves, and this is the half that makes
 * the first one land. Without it the question sits in a feed nobody is told to
 * look at.
 *
 * The question is quoted in full rather than truncated. A staff alert exists to
 * save someone a round trip into the workspace, and half a question is exactly
 * the amount that guarantees the trip.
 */
export function QuestionStaffAlert(payload: QuestionStaffAlertPayload) {
  return (
    <EmailLayout
      preview={`${payload.claimRef} — ${payload.homeownerName} asked a question.`}
      reason="Sent to the CMG staff inbox because a homeowner posted a question on their claim."
    >
      <Text style={emailStyles.kicker}>New question</Text>
      <Text style={emailStyles.heading}>{payload.claimRef}</Text>
      <Text style={emailStyles.paragraph}>
        {payload.homeownerName} asked a question on the claim feed.
      </Text>

      <Text
        style={{
          ...emailStyles.paragraph,
          borderLeft: `2px solid ${emailTheme.accent}`,
          paddingLeft: "16px",
          whiteSpace: "pre-wrap",
        }}
      >
        {payload.question}
      </Text>

      <Section style={{ marginTop: "28px" }}>
        <DetailRow label="Claim" value={payload.claimRef} />
        <DetailRow label="Homeowner" value={payload.homeownerName} />
        <DetailRow label="Assigned to" value={payload.assignedTo ?? "Nobody yet"} />
      </Section>

      <Section style={{ marginTop: "30px" }}>
        <Button
          href={payload.claimUrl}
          style={{
            display: "inline-block",
            padding: "15px 26px",
            border: `1px solid ${emailTheme.accent}`,
            color: emailTheme.accent,
            fontSize: "15px",
            fontWeight: 500,
            textDecoration: "none",
          }}
        >
          Open the claim
        </Button>
      </Section>
    </EmailLayout>
  );
}

export type ReplyPostedPayload = {
  firstName: string;
  claimRef: string;
  /** The entry as staff wrote it. Quoted, never paraphrased. */
  body: string;
  portalUrl: string;
};

/**
 * Staff posted something the homeowner can read.
 *
 * The body is included rather than held back behind the link. A notification
 * that says only "you have an update" makes someone log in to find out whether
 * it mattered, and most of the time it is a sentence. The feed is not sensitive
 * on its own — it carries no policy number, no carrier and no address, which is
 * exactly why the composer's other visibilities exist for anything that does.
 */
export function ReplyPosted(payload: ReplyPostedPayload) {
  return (
    <EmailLayout
      preview={`A new note on ${payload.claimRef}.`}
      reason="Sent because CMG Property Solutions is representing you on this claim. We email you when someone here posts to your claim."
    >
      <Text style={emailStyles.kicker}>Your adjuster wrote</Text>
      <Text style={emailStyles.heading}>There is a new note on your claim.</Text>

      <Text style={emailStyles.paragraph}>
        Hi {payload.firstName} — someone at CMG posted this to{" "}
        <strong style={{ color: emailTheme.accent300 }}>{payload.claimRef}</strong>.
      </Text>

      <Text
        style={{
          ...emailStyles.paragraph,
          borderLeft: `2px solid ${emailTheme.accent}`,
          paddingLeft: "16px",
          whiteSpace: "pre-wrap",
        }}
      >
        {payload.body}
      </Text>

      <Text style={emailStyles.paragraph}>
        Reply in the portal and it lands on the claim, where your adjuster will see it.
      </Text>

      <Section style={{ marginTop: "30px" }}>
        <Button
          href={payload.portalUrl}
          style={{
            display: "inline-block",
            padding: "15px 26px",
            border: `1px solid ${emailTheme.accent}`,
            color: emailTheme.accent,
            fontSize: "15px",
            fontWeight: 500,
            textDecoration: "none",
          }}
        >
          Open my claim
        </Button>
      </Section>
    </EmailLayout>
  );
}
