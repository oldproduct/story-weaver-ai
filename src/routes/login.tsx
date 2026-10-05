import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { AudioLines, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { HelpTip } from "@/components/HelpTip";
import { checkSession, login } from "@/lib/auth.functions";

export const Route = createFileRoute("/login")({
  beforeLoad: async () => {
    const { signedIn } = await checkSession();
    if (signedIn) throw redirect({ to: "/" });
  },
  head: () => ({
    meta: [
      { title: "Sign in — Chorus Audiobook Studio" },
      { name: "description", content: "Sign in to Chorus to create multi-voice Hindi audiobooks." },
      { property: "og:title", content: "Sign in — Chorus Audiobook Studio" },
      { property: "og:description", content: "Sign in to Chorus to create multi-voice Hindi audiobooks." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const doLogin = useServerFn(login);
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await doLogin({ data: { username, password } });
      if (!res.ok) {
        setError("Wrong username or password.");
        return;
      }
      await navigate({ to: "/", replace: true });
    } catch {
      setError("Couldn't sign in. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <form onSubmit={submit} className="w-full max-w-sm space-y-5 rounded-xl border border-border bg-card p-6 shadow-xs">
        <div className="flex items-center gap-2.5">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <AudioLines className="size-4" />
          </div>
          <div>
            <h1 className="text-[16px] font-medium text-strong">Sign in to Chorus</h1>
            <p className="text-[12px] text-subtle">Multi-voice audiobook studio</p>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="u" className="flex items-center gap-1.5 text-[12px]">
            Username
            <HelpTip title="Username">Enter the team username you were given.</HelpTip>
          </Label>
          <Input id="u" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="p" className="flex items-center gap-1.5 text-[12px]">
            Password
            <HelpTip title="Password">Passwords are case-sensitive. You stay signed in on this browser until you sign out.</HelpTip>
          </Label>
          <Input id="p" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        {error && <p className="text-[12px] text-destructive">{error}</p>}
        <Button type="submit" className="w-full" disabled={busy}>
          {busy && <Loader2 className="size-4 animate-spin" />}
          Sign in
        </Button>
      </form>
    </div>
  );
}
