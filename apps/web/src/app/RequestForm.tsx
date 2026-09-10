"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { submitLabRequest, type FormState } from "./actions";

const TYPES = ["equipment", "space", "consumable", "access", "visitor", "general"];

const inputClass =
  "w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm outline-none focus:border-black/40 dark:border-white/20 dark:bg-white/5 dark:focus:border-white/50";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
    >
      {pending ? "Submitting…" : "Submit request"}
    </button>
  );
}

export function RequestForm() {
  const [state, formAction] = useActionState<FormState, FormData>(submitLabRequest, {});

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Title</span>
        <input name="title" required className={inputClass} placeholder="Book microscope room B2" />
      </label>

      <div className="flex flex-col gap-3 sm:flex-row">
        <label className="flex flex-1 flex-col gap-1 text-sm">
          <span className="font-medium">Type</span>
          <select name="type" defaultValue="equipment" className={inputClass}>
            {TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-1 flex-col gap-1 text-sm">
          <span className="font-medium">Requester email</span>
          <input
            name="requesterEmail"
            type="email"
            required
            className={inputClass}
            placeholder="student@ku.th"
          />
        </label>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Description</span>
        <textarea name="description" rows={3} className={inputClass} />
      </label>

      {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      {state.success ? <p className="text-sm text-green-600">Request submitted.</p> : null}

      <div>
        <SubmitButton />
      </div>
    </form>
  );
}
