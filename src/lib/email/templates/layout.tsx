import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import type { ReactNode } from "react";
import { site, telHref } from "@/lib/site";

const canvas = "#26292C";
const surface = "#33373A";
const ink = "#F0EDE7";
const accent = "#D4B36A";
const accent300 = "#EBDAAF";
const muted = "#B5B0A7";

export const emailTheme = { canvas, surface, ink, accent, accent300, muted };

export const emailStyles = {
  kicker: {
    margin: "0 0 10px",
    fontSize: "11px",
    letterSpacing: "0.2em",
    textTransform: "uppercase" as const,
    color: accent300,
  },
  heading: {
    margin: "0",
    fontSize: "26px",
    lineHeight: "1.2",
    letterSpacing: "-0.02em",
    fontWeight: 500,
    color: ink,
  },
  paragraph: {
    margin: "18px 0 0",
    fontSize: "15px",
    lineHeight: "1.7",
    color: "#D5D1CA",
  },
  rule: {
    display: "block",
    width: "40px",
    height: "1px",
    backgroundColor: accent,
    margin: "0 0 22px",
    border: "none",
  },
};

/**
 * The 40px accent hairline above the kicker is the site's structural signature
 * — it opens every section and every success panel. Carrying it into email is
 * what makes a CMG email read as the same object as a CMG page.
 */
export function EmailLayout({
  preview,
  reason,
  children,
}: {
  preview: string;
  reason: string;
  children: ReactNode;
}) {
  return (
    <Html lang="en">
      <Head />
      <Preview>{preview}</Preview>
      <Body
        style={{
          margin: 0,
          padding: "32px 12px",
          backgroundColor: canvas,
          color: ink,
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
        }}
      >
        <Container
          style={{
            width: "100%",
            maxWidth: "560px",
            margin: "0 auto",
            backgroundColor: surface,
            border: "1px solid rgba(240, 237, 231, 0.13)",
            padding: "40px 36px",
          }}
        >
          <Section>
            <Text
              style={{
                margin: "0",
                fontSize: "20px",
                letterSpacing: "0.16em",
                fontWeight: 600,
                color: ink,
              }}
            >
              CMG
            </Text>
            <Text
              style={{
                margin: "4px 0 32px",
                fontSize: "10px",
                letterSpacing: "0.24em",
                textTransform: "uppercase",
                color: accent,
              }}
            >
              Property Solutions
            </Text>
          </Section>

          <Hr style={emailStyles.rule} />

          {children}

          <Hr
            style={{
              margin: "36px 0 20px",
              border: "none",
              borderTop: "1px solid rgba(240, 237, 231, 0.11)",
            }}
          />

          <Text style={{ margin: 0, fontSize: "12px", lineHeight: "1.7", color: muted }}>
            {reason}
          </Text>
          <Text
            style={{ margin: "12px 0 0", fontSize: "12px", lineHeight: "1.7", color: muted }}
          >
            {site.name} · {site.licensee} · License # {site.license}
            <br />
            {site.city} · {site.serviceArea}
            <br />
            <Link href={telHref} style={{ color: accent300 }}>
              {site.phone}
            </Link>
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <Section style={{ padding: "12px 0", borderTop: "1px solid rgba(240,237,231,0.11)" }}>
      <Text
        style={{
          margin: "0 0 4px",
          fontSize: "10px",
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: muted,
        }}
      >
        {label}
      </Text>
      <Text style={{ margin: 0, fontSize: "15px", lineHeight: "1.6", color: ink }}>
        {value}
      </Text>
    </Section>
  );
}
