import { verifySession } from "@/app/lib/dal";
import { signOut } from "@/auth";
import { NavLinks } from "./NavLinks";
import { SyncButton } from "./dashboard/SyncButton";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = await verifySession();

  return (
    <div className="flex min-h-screen w-full">
      <aside className="flex w-60 shrink-0 flex-col border-r border-zinc-200 dark:border-zinc-800">
        <div className="px-5 py-5">
          <span className="text-base font-semibold tracking-tight">
            CalendarInsights
          </span>
        </div>
        <NavLinks />
        <div className="mt-auto border-t border-zinc-200 p-4 dark:border-zinc-800">
          <p className="mb-2 truncate text-xs text-zinc-500">{user.email}</p>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
          >
            <button
              type="submit"
              className="w-full rounded-lg border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
            >
              Salir
            </button>
          </form>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-end border-b border-zinc-200 px-6 dark:border-zinc-800">
          <SyncButton />
        </header>
        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
