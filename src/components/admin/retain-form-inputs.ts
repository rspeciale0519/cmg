/** Keep reviewed inputs through action results; the caller controls when to clear or replace them. */
export function retainFormInputs(form: HTMLFormElement | null) {
  if (!form) return;
  // Action resets run during React's commit, when its synthetic event handlers are disabled.
  const preventReset = (event: Event) => event.preventDefault();
  form.addEventListener("reset", preventReset);
  return () => form.removeEventListener("reset", preventReset);
}
