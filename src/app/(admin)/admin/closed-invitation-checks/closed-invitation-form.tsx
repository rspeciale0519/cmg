"use client";
import { useActionState, useRef, useState } from "react";
import { checkClosedInvitation } from "./actions";
import { idleState } from "@/lib/actions/types";
export function ClosedInvitationForm({ label }: {
    label: string;
}) {
    const used = useRef(false);
    const [consumed, setConsumed] = useState(false);
    const [state, action, pending] = useActionState(checkClosedInvitation, idleState);
    return <section><h2>{label}</h2><form action={action} onSubmit={event => { if (used.current) {
        event.preventDefault();
        return;
    } used.current = true; setConsumed(true); }}>
    <label>{label} token<input name="token" type="password" autoComplete="off" required pattern="[A-Za-z0-9_-]{43}" minLength={43} maxLength={43}/></label>
    <button disabled={pending || consumed}>Check once</button>
  </form><p role="status">{state.message}</p></section>;
}
