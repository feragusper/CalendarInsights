"use client";

import { useTransition } from "react";

/**
 * A switch-style checkbox that submits its enclosing form on change, so
 * toggling persists immediately via the form's server action.
 */
export function AutoToggle({
  name,
  defaultChecked,
}: {
  name: string;
  defaultChecked: boolean;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <label className="relative inline-flex cursor-pointer items-center">
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        disabled={isPending}
        onChange={(e) => {
          const form = e.currentTarget.form;
          startTransition(() => form?.requestSubmit());
        }}
        className="peer sr-only"
      />
      <span className="h-6 w-11 rounded-full bg-zinc-300 transition-colors peer-checked:bg-emerald-500 dark:bg-zinc-700" />
      <span className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition-transform peer-checked:translate-x-5" />
    </label>
  );
}
