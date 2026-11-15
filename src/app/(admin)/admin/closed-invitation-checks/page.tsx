import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { requireOwner, requireOpenPath, metadataForRole, NOT_FOUND_TITLE } from "@/lib/authz";
import { isPathOpen } from "@/lib/site-mode";
import { ClosedInvitationForm } from "./closed-invitation-form";
export async function generateMetadata(): Promise<Metadata> {
 if (process.env.VERCEL_ENV !== "preview" || !isPathOpen("/invite")) return {title:NOT_FOUND_TITLE,robots:{index:false,follow:false}};
 return metadataForRole(["owner"],"Closed invitation checks");
}
export const dynamic = "force-dynamic";
export default async function ClosedInvitationCheckPage() {
    if (process.env.VERCEL_ENV !== "preview")
        notFound();
    await requireOwner();
    requireOpenPath("/invite");
    return <section><h1>Closed invitation checks</h1><ClosedInvitationForm label="Used"/><ClosedInvitationForm label="Expired"/></section>;
}
