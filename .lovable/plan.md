## treatme — feature 1: skin analysis flow

mobile-first web app. brand kit locked. no auth this round — session-only results.

### brand system (src/styles.css)
- cream `#FCFBF7` (bg), bubblegum `#F8A1C6`, hot `#FF1F87` (accent/CTAs), butter `#FFEDB4`, mint `#DFFFF8`, ink `#111111`
- font: Helvetica Neue / Helvetica / Arial, lowercase by default, tight tracking on headlines
- buttons: ink-filled pill (primary "scan me"), bubblegum-filled pill (secondary), ink-outline (tertiary)
- spacing: 8pt grid, 24px mobile side padding

### navigation (locked per brand kit p.18)
- top bar: `treatme` wordmark left, small `tx` mark / profile right
- bottom tab bar (5 tabs, fixed): **menu · search · scan · treatments · profile**
- scan tab is the centerpiece — slightly emphasized

### routes (TanStack Start, file-based)
```
src/routes/
  __root.tsx              shell + bottom tab bar
  index.tsx               /  → menu (home/overview, "scan me" hero)
  search.tsx              /search        (clinics & providers — placeholder this round)
  scan.tsx                /scan          (camera/upload screen)
  scan.analyzing.tsx      /scan/analyzing (loading state — "reading your skin")
  scan.results.tsx        /scan/results   (full results page)
  scan.chat.tsx           /scan/chat      (chat with treatme)
  treatments.tsx          /treatments     (recommended tx list)
  treatments.$slug.tsx    /treatments/:slug (single tx detail + "book treatment")
  treatments.$slug.book.tsx /treatments/:slug/book (clinic list w/ location + radius)
  profile.tsx             /profile        (placeholder)
```

### the flow, screen by screen

**1. scan screen (`/scan`)**
- headline: "let's see what your skin is asking for."
- big camera tile: take photo (uses `<input capture="user" accept="image/*">`) or upload
- guidance chips: good light · no makeup · face the camera
- primary CTA: `scan me`

**2. analyzing (`/scan/analyzing`)**
- soft pink/cream loading state, brand copy "reading your skin…"
- posts image to `/api/analyze` → routes to results when done

**3. results (`/scan/results`)** — the centerpiece
- top: the user's photo with an SVG overlay layer
- chip row above the photo: `skin type · hydration · pores · fine lines · wrinkles · pigmentation · volume loss · dark spots · texture · redness · symmetry · fitzpatrick · skin age`
- tapping a chip toggles markers (dots/regions) on that area of the face for that concern
- below photo:
  - **the read** — short brand-voice blurb ("three things are doing most of the talking…")
  - **strengths** (mint badges) · **weaknesses** (bubblegum badges)
  - **recommended treatments** — cards tappable → `/treatments/:slug`
  - inline CTA card: `chat with treatme →` → `/scan/chat`

**4. chat with treatme (`/scan/chat`)**
- AI Elements–based chat (Conversation, Message, PromptInput, Shimmer)
- system prompt: "you are treatme — a warm, expert medical-aesthetics guide written in lowercase brand voice. user just got a skin scan (results passed in context). answer questions about treatments, what they improve, how, and steer them to book."
- scan results passed as context on first message
- no thread list (single session-scoped convo)

**5. treatment detail (`/treatments/:slug`)**
- what it is (plain language, no jargon — brand kit p.16 "before you book"), what it improves, what to expect, typical price range, downtime
- primary CTA: `book treatment`

**6. book treatment (`/treatments/:slug/book`)**
- location picker (use browser geolocation or manual postal code entry) + radius slider (5 / 10 / 25 / 50 km, mi/km toggle)
- clinic list cards: name, distance, rating, verified badge, "from $X", next available slot
- **first-time consult rule:** every clinic card shows a pinned `first visit = free 15-min consult` chip — clicking "book" on a new clinic always books the consult, not the procedure directly. confirms expectation up front.
- this round seeds ~12 realistic mock GTA clinics so the flow feels real end-to-end; real booking comes later

### AI integration (real, via Lovable AI Gateway)
- enable Lovable Cloud → auto-provisions `LOVABLE_API_KEY`
- `src/lib/ai-gateway.server.ts` — provider helper (per knowledge)
- `src/routes/api/analyze.ts` — POST: receives base64 image
  - model: `google/gemini-3-flash-preview` (multimodal)
  - structured output via `Output.object` (zod schema): all 13 markers with 0–100 score + 1-line note, plus marker region hints (rough bounding boxes per concern like "forehead", "left cheek", "nose bridge"), strengths[], weaknesses[], blurb, fitzpatrick I–VI, skinAge
  - we map the region hints → SVG dot/blob coordinates on a normalized face grid for the overlay (honest about approximate localization)
- `src/routes/api/chat.ts` — POST: AI SDK `streamText` + `toUIMessageStreamResponse`, scan context injected into system prompt

### state
- scan result kept in a small zustand-style React context + `sessionStorage` so the user can navigate scan ↔ chat ↔ treatments without losing it. no DB this round.

### error handling
- 429 → "we're a little busy — try again in a moment"
- 402 → toast: credits exhausted, link to settings
- bad/blurry image → brand-voice error "couldn't get a clear read. try again." (p.18)

### tech bits
- AI SDK + AI Elements installed (`conversation message prompt-input shimmer`)
- preview viewport set to mobile
- bottom tab bar uses `Link` with `activeProps` for active state (hot pink underline)
- all 7 routes get distinct `head()` meta

### out of scope this round (next features)
- auth & saved scan history
- real provider data & real booking
- payments
- search/menu/profile tab depth (stubs only)

ready to build on approval.
