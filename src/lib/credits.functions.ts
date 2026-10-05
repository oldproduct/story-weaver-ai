import { createServerFn } from "@tanstack/react-start";
import { requireSession } from "./auth.server";

export type Credits =
  | { ok: true; used: number; limit: number; resetAt: number | null; tier: string }
  | { ok: false };

export const getCredits = createServerFn({ method: "GET" }).handler(async (): Promise<Credits> => {
  await requireSession();
  const key = process.env["ELEVENLABS_API_KEY"];
  if (!key) return { ok: false };
  try {
    const res = await fetch("https://api.elevenlabs.io/v1/user/subscription", {
      headers: { "xi-api-key": key },
    });
    if (!res.ok) {
      console.error("credits lookup failed", res.status);
      return { ok: false };
    }
    const j = (await res.json()) as {
      character_count?: number;
      character_limit?: number;
      next_character_count_reset_unix?: number;
      tier?: string;
    };
    return {
      ok: true,
      used: j.character_count ?? 0,
      limit: j.character_limit ?? 0,
      resetAt: j.next_character_count_reset_unix ?? null,
      tier: j.tier ?? "",
    };
  } catch (e) {
    console.error(e);
    return { ok: false };
  }
});
