import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { acceptInvite } from "@/app/actions";

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/invite/${token}`);

  const { data } = await supabase.rpc("get_invite", { invite_token: token });
  const inv = (Array.isArray(data) ? data[0] : data) as
    | { project_id: string; project_name: string; role: string; valid: boolean }
    | undefined;

  const ok = inv && inv.valid;

  return (
    <div className="noise flex min-h-screen items-center justify-center px-4">
      <div className="grad-border w-full max-w-sm rounded-[8px] bg-surface p-8 text-center shadow-[0_8px_32px_rgba(0,0,0,0.6)]">
        {!inv ? (
          <>
            <h1 className="serif text-3xl italic text-foreground">Invite not found</h1>
            <p className="mt-2 font-mono text-[11px] text-muted">This link is invalid.</p>
          </>
        ) : !ok ? (
          <>
            <h1 className="serif text-3xl italic text-foreground">Invite expired</h1>
            <p className="mt-2 font-mono text-[11px] text-muted">
              This invite has already been used or has expired.
            </p>
          </>
        ) : (
          <>
            <h1 className="serif text-3xl italic text-foreground">
              You&apos;ve been invited to{" "}
              <span className="text-accent">{inv.project_name}</span>
            </h1>
            <p className="mt-3 font-mono text-[12px] text-muted">
              You&apos;ll join as{" "}
              <span className="capitalize text-foreground">{inv.role}</span>
            </p>
            <form action={acceptInvite} className="mt-6">
              <input type="hidden" name="token" value={token} />
              <button
                type="submit"
                className="w-full rounded-[6px] bg-accent px-3 py-2.5 font-mono text-[12px] font-medium text-[#0d0d0d] transition-opacity hover:opacity-90"
              >
                Accept &amp; Open Project
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
