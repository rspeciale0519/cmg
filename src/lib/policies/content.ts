export type PolicySection = {
  heading: string;
  paragraphs: readonly string[];
};

/** Prepared copy. Publication is separately gated by the reviewed revision. */
export const PRIVACY_SECTIONS: readonly PolicySection[] = [
  {
    heading: "Information used for claim work",
    paragraphs: [
      "CMG Property Solutions uses information submitted through this website to review requests and manage insurance claims.",
      "This can include names, contact details, property and loss information, insurance details, documents, messages, consent records, and signatures.",
      "Account and security records help control access and record activity in the app. These records can include sign-in events and network information.",
    ],
  },
  {
    heading: "Accounts and service providers",
    paragraphs: [
      "The app uses cookies to maintain signed-in sessions. Public form security checks also process browser information.",
      "CMG uses service providers for website hosting, account access, file storage, email, electronic signatures, and security checks.",
      "These services include Vercel, Supabase, Resend, PandaDoc, and Cloudflare. They process information needed for their part of the service.",
    ],
  },
  {
    heading: "Referring companies and Airtable",
    paragraphs: [
      "A claim can come from a referring company or directly from a homeowner. An Airtable connection is optional.",
      "When CMG enables a connection, authorized staff choose the existing company record and the claim information to share.",
      "Selected information can include claim progress, dates, contact and property details, insurer information, law-firm progress, settlement amounts, and shared messages.",
      "CMG sends those updates to columns reserved for its information. The connection does not send document files or private staff notes.",
      "The receiving company controls access to its Airtable records. Disconnecting the connection does not remove copies already sent to that company.",
    ],
  },
  {
    heading: "Law-firm handoffs",
    paragraphs: [
      "CMG staff can prepare selected claim details and original documents for a law firm.",
      "Staff review the package and send it through their chosen delivery method. The app records the handoff and later progress reported to CMG.",
      "Homeowners can see legal milestones and the accepted firm's contact details. Milestone emails contain a portal link, without the private package or staff notes.",
    ],
  },
  {
    heading: "Records and requests",
    paragraphs: [
      "CMG keeps records for claim work, account security, and applicable record requirements. Closing an account does not by itself remove claim records.",
      "Contact CMG to ask about access to your information, corrections, or a request to remove records.",
      "CMG will review the request and explain which records can be changed or removed. Some claim and security records may need to be retained.",
    ],
  },
];

export const TERMS_SECTIONS: readonly PolicySection[] = [
  {
    heading: "About this website",
    paragraphs: [
      "This website provides information about CMG Property Solutions and supports its insurance claim work.",
      "The private workspace lets authorized users exchange claim information, view progress, and complete the actions available to their account.",
      "CMG handles representation and fees through separate signed agreements. This page does not replace or change those agreements.",
    ],
  },
  {
    heading: "Account access",
    paragraphs: [
      "CMG assigns access based on each person's role and connection to a claim or referring company.",
      "Staff accounts use additional sign-in checks. Available actions can differ between an Owner, adjuster, Assistant, homeowner, and referring-company account.",
      "Contact CMG if account access or claim information appears incorrect.",
    ],
  },
  {
    heading: "Claim progress and law firms",
    paragraphs: [
      "Claim stages show information recorded by CMG. The app does not decide insurer or court outcomes.",
      "Preparing a law-firm package does not mark it as sent. Staff separately record sending, acceptance, and the filing of a lawsuit.",
      "CMG staff record the law firm's updates. Law firms do not use homeowner accounts to manage those updates.",
      "Contact CMG or the accepted law firm for questions about the recorded progress or work outside the app.",
    ],
  },
  {
    heading: "Airtable connections",
    paragraphs: [
      "An authorized Owner can connect a referring company's Airtable and choose the agreed destination columns.",
      "Authorized staff select the information to share and whether updates send automatically, after review, or through a combination of both.",
      "The connection sends information from CMG to Airtable. It does not copy Airtable changes into CMG or create new company deals.",
      "Saving claim work and sending an Airtable update are separate results. The app shows waiting or failed updates when delivery does not complete.",
      "Staff can pause a connection. Pausing stops further delivery but does not erase information already sent.",
    ],
  },
  {
    heading: "Service availability and questions",
    paragraphs: [
      "The app relies on hosting, email, storage, electronic-signature, security, and optional Airtable services.",
      "An interrupted connection or service limit can delay an action or update. Contact CMG when a claim needs attention outside the app.",
    ],
  },
];
