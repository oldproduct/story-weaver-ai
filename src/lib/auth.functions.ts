import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { endSession, hasSession, LOGIN_PASS, LOGIN_USER, startSession } from "./auth.server";

export const login = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ username: z.string().max(100), password: z.string().max(100) }).parse(input),
  )
  .handler(async ({ data }) => {
    if (data.username.trim() !== LOGIN_USER || data.password !== LOGIN_PASS) {
      return { ok: false as const };
    }
    await startSession();
    return { ok: true as const };
  });

export const logout = createServerFn({ method: "POST" }).handler(async () => {
  endSession();
  return { ok: true };
});

export const checkSession = createServerFn({ method: "GET" }).handler(async () => ({
  signedIn: await hasSession(),
}));
