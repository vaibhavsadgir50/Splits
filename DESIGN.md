# Splits — Design System & Product Context

Household grocery/expense ledger. One household, shared members, receipts get
uploaded (photo → Gemini OCR, or typed by hand), split line-by-line across
whoever was there, and the app tracks who owes whom.

Stack: Next.js 15 (App Router) + React 19 + Tailwind CSS. Data in Supabase
(Postgres + pgvector for semantic item search). Receipt OCR via Gemini.
Auth: Google OAuth via Supabase. Mobile-first, but usable on desktop
(content capped at `max-w-lg`/`max-w-2xl`, centered).

---

## Product shape

**Entities**
- **Member** — a household member (just a name + optional email for login-linking and receipt emails). No passwords; a member becomes "you" by linking your Google login to a member name once (see Join flow).
- **Receipt** — one purchase event: `receipt_code`, `store_name`, `paid_by` (a member), `notes`, `created_at`.
- **Item** — one line on a receipt: `name`, `price`, `split_with` (list of member names sharing it), computed `per_person_amt`.
- **Settlement** — a manual "X paid Y $amount" record that offsets a running balance.

**Core loop**
1. Someone uploads/enters a receipt and says who paid.
2. Every line item gets ticked for which members are splitting it (defaults to everyone).
3. Save → server computes per-person shares, updates net balances, emails each affected member a personalized PDF breakdown.
4. Home screen (Balances/"Accounts") always shows current net position per member and suggested pairwise settlements ("Alex owes Sam $12.40 → Settle").

**Navigation**
Single-page app (`components/App.jsx` is the shell). A sticky header with the
Splits logo/home button, **History**, **Members (count)**, and a signed-in
avatar (click to sign out) — no bottom nav, no router pages other than
`/login`. Body swaps between four views/steps:

- `home` (default) → **BalancesView** — the dashboard.
- `history` → **HistoryPanel** — past receipts, expandable, semantic search over items.
- `members` → **MembersPanel** — add/remove household members.
- `step: 'upload'` → **UploadStep** — full-screen takeover to start a new receipt (camera / file / manual).
- `step: 'review'` → **ReviewStep** — full-page item-by-item split editor.
- `step: 'summary'` → **SummaryStep** — post-save confirmation of who owes what.

Plus two modals layered on top of any view: **JoinModal** (forced on first
login until your Google account is linked to a member name) and the
"Record Payment" / "Member detail" modals inside BalancesView.

---

## Screens inventory

| Screen | Component | Purpose | Visual system |
|---|---|---|---|
| Login | `app/login/page.jsx` | Google OAuth sign-in | Clay |
| Join household | `JoinModal.jsx` | First-login: pick or create your member name | Clay |
| Accounts (home) | `BalancesView.jsx` | Net balances per member, pairwise settle-up, member spend detail | Clay |
| New Receipt | `UploadStep.jsx` | Start a receipt: who paid → camera / file / manual entry | **Glass** (redesigned) |
| Review & Split | `ReviewStep.jsx` | Editable item table, per-member checkboxes, notes, save | Clay |
| Saved / Summary | `SummaryStep.jsx` | Confirmation + amounts owed to the payer | Clay |
| History | `HistoryPanel.jsx` | Past receipts (expandable), semantic item search | Clay |
| Members | `MembersPanel.jsx` | Add/remove household members | Clay |

**Migration status:** only *New Receipt* has been redesigned so far, into a
full-screen glassmorphism takeover (frosted panels over a vivid purple/pink/
blue gradient, replacing the old small centered dialog). Every other screen
is still on the original "Clay" neumorphic system below. This is a
screen-by-screen migration in progress — expect the two visual languages to
coexist until the rest are ported.

---

## Design system

### Color

Single brand hue, purple, plus semantic accents. Defined in
`tailwind.config.js` as `brand.50`…`brand.900`:

```
brand-50  #f5f3ff   brand-500 #8b5cf6   brand-800 #5b21b6
brand-100 #ede9fe   brand-600 #7c3aed   brand-900 #4c1d95
brand-200 #ddd6fe   brand-700 #6d28d9
brand-300 #c4b5fd
brand-400 #a78bfa
```

Semantic use, consistent everywhere:
- **Positive / owed to you** → emerald/green gradient (`from-emerald-400 to-green-500`, text `emerald-600`)
- **Negative / you owe** → rose/red gradient (`from-rose-400 to-red-500`, text `rose-500`)
- **Neutral / settled** → gray
- **Warning** → amber
- **Destructive action** → red-50 background, red-500 text (e.g. "Remove", delete buttons)
- Primary actions and brand chrome → `brand-600`/`brand-500` gradient

Page background (body, `globals.css`): soft diagonal lavender gradient
`linear-gradient(145deg, #f0edff 0%, #e9e4ff 30%, #ede9fe 60%, #e8e4ff 100%)`.

The new glass screen uses a punchier, saturated version of the same hue
family for its backdrop (see "Glass" below) rather than the pastel page bg.

### Typography

Font: **Inter** (400–900), loaded via Google Fonts in `globals.css`, applied
to `body`. Headings are `font-black` (900) almost everywhere — this app
leans very bold/heavy for numbers and titles, never a lighter weight for
emphasis. Body copy is `text-sm`/`text-xs`, `text-gray-500`/`text-gray-400`
for secondary text. Dollar amounts are always `font-black`, often
`text-lg`/`text-xl`/`text-2xl`.

### Shape language — two coexisting systems

**1. Clay (legacy, most screens)** — soft neumorphism. Utility classes in
`app/globals.css`:
- `.clay` — main elevated surface (dual-direction soft shadow + inset highlight)
- `.clay-sm` — same idea, smaller/lighter, for chips and small controls
- `.clay-inset` — concave/pressed look, used for input fields and "trough" containers
- `.clay-btn` — primary buttons, includes an `:active` press-down state
- `.clay-danger` — red-tinted version of `.clay-btn`

Radii are large and soft: `rounded-2xl`/`rounded-3xl`/`rounded-4xl`
(`4xl` = 2rem, `5xl` = 2.5rem, both custom-added in `tailwind.config.js`).
Surfaces are near-white translucent (`bg-white/80`–`/95`) over the lavender
page gradient. Avatars are always a rounded-2xl square-ish tile with a
brand/semantic gradient fill and a bold white initial letter — this pattern
repeats for members, payers, and settlement parties everywhere.

**2. Glass (new, New Receipt screen only)** — hardcore glassmorphism.
Utility classes added in `app/globals.css`:
- `.glass` / `.glass-strong` — `backdrop-filter: blur(24–30px) saturate(180–200%)`, translucent white fill (`rgba(255,255,255,0.12–0.16)`), a soft white border (`rgba(255,255,255,0.35–0.45)`), and an inset top highlight
- `.glass-tile` — same idea for tappable tiles (camera/files buttons)
- `.glass-input` — lighter blur, for form fields
- `.upload-bg` — the vivid multi-stop radial-gradient backdrop (magenta/indigo/cyan/pink over a deep purple base) that the glass panels sit on and blur — glass needs a colorful thing behind it to read as glass

Text on glass is white/white-with-opacity (`text-white`, `text-white/60`,
`text-white/40` for placeholders) rather than the gray-900/gray-500 used on
Clay surfaces. Buttons are full pill (`rounded-full`) rather than
`rounded-2xl`/`3xl`, and CTAs get a saturated gradient tint
(`from-fuchsia-500/50 to-violet-500/50`) plus a strong drop shadow instead
of the clay dual-shadow.

### Layout conventions

- Content column: `max-w-lg` (single-column screens) or `max-w-2xl`/`max-w-4xl`
  (History, Review table), centered with `mx-auto`.
- Modals: `fixed inset-0` backdrop (`bg-brand-900/30`, `backdrop-blur-sm`),
  flex-centered on desktop, bottom-sheet-anchored on mobile
  (`items-end sm:items-center`), content card is `.clay` + `rounded-4xl`.
- The one full-screen exception is the new glass Upload screen — no backdrop
  dialog, it takes over the entire viewport with its own gradient background
  and a fixed-position primary CTA pinned to the bottom.
- Buttons: primary = brand gradient + `.clay-btn` (or glass pill on the new
  screen); secondary = `.clay-sm` gray; destructive = red-50/red-500.
- Chips/pills (member selectors, tags): `rounded-2xl` (clay) or `rounded-full`
  (glass), selected state = solid brand fill + white text, unselected =
  light brand-50 tint.

---

## Notes for redesign work

- Any new screen should declare up front which of the two systems it's
  using (Clay or Glass) — don't blend inset-shadow neumorphism and
  frosted-blur on the same surface.
- Keep the bold/black numeric typography — balances, prices, and totals are
  the emotional core of every screen and should read heavier than
  surrounding text.
- Member/payer identity is always shown as an initials avatar with a
  gradient fill; don't introduce a different identity pattern (photos,
  outlined avatars, etc.) without updating it everywhere.
- Green = owed to you, red = you owe. This mapping is load-bearing across
  Balances, History, and Summary — don't flip it.
