"use server";
import { notFound } from "next/navigation";
import { requireOwner } from "@/lib/authz";
import { requireOpenPath } from "@/lib/authz";
import { isWellFormedInviteToken } from "@/lib/auth/invite-token";
import { acceptInvite } from "@/lib/actions/invite";
import type { FormState } from "@/lib/actions/types";
export async function checkClosedInvitation(_previous: FormState, incoming: FormData): Promise<FormState> {
    if (process.env.VERCEL_ENV !== "preview")
        notFound();
    await requireOwner();
    requireOpenPath("/invite");
    const token = incoming.get("token");
    if (typeof token !== "string" || !isWellFormedInviteToken(token))
        return { status: "error", message: "Test stopped: invalid token format." };
    const tokenOnly = new FormData();
    tokenOnly.set("token", token);
    const result = await acceptInvite({ status: "idle" }, tokenOnly);
    return { status: result.status, message: result.message };
}
