# Login, live ElevenLabs credits, and guided tooltips

## What you get
1. **Login page** – Opening the app shows a sign-in screen first. Username `Hitkarini`, password `Hitkarini@123`. You stay signed in on that browser until you click "Sign out" in the header.
2. **Live ElevenLabs credits** – A small badge in the header shows "Credits: 8,240 / 10,000 left" with a thin usage bar. It refreshes every 30 seconds, after every recorded line during Generate, and after each line preview. It turns amber below 20% and red below 5%. Hover over it to see when your plan resets.
3. **Guide tooltips** – Small "?" icons with an arrow pointer next to the main controls. Each one says what the control does and what you should do next. They cover: upload box, Analyze, speaker slots, voice picker, preview, Add a speaker, Overall pace, per-speaker speed, Review-line confidence colours, emotion menu, speed menu, line play button, Fill from pattern, Re-detect uncertain, Generate, Pause/Resume, Download MP3, New book. Each step also gets a short "What to do here" hint at the top.

Your saved books, voices, cached recordings and generation flow stay the same.

## Technical details
- **Auth**: A server function checks the credentials on the server, not in the browser bundle, and sets an HttpOnly, signed session cookie (HMAC using a generated `SESSION_SECRET` secret). A `checkSession` server function gates `/`. A new `/login` route has its own head() metadata. `synthesizeClip`, the analysis functions and the credits function check the session too, so nobody can use your ElevenLabs/AI quota without logging in. Sign out clears the cookie.
- **Credits**: A new `getCredits` server function calls ElevenLabs `GET /v1/user/subscription` and returns `character_count`, `character_limit` and `next_character_count_reset_unix`. A `CreditsBadge` component uses TanStack Query (30s refetch). The pipeline and preview invalidate the query after each clip. If the key can't read subscription data, the badge says "Credits unavailable" and nothing else breaks.
- **Tooltips**: Uses the existing shadcn Tooltip with its arrow, wrapped in a reusable `HelpTip` component. A `TooltipProvider` is added once at the root. All copy is in English.
- No changes to TTS settings, emotions, pauses, the cache key, or analysis logic.

## Note
Writing the password into the code is fine for a shared team login. Anyone with access to the project code can see it.
