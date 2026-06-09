# VDG Casting Portal — Claude Handoff Document

> Written for the next Claude instance. Read this before touching any file.

---

## 1. Project Overview

### What It Is
A private web-based casting management portal for **VDG (Vision De Garçon)**, a Brisbane fashion/creative collective. Built for a single event: **July 5, 2026**.

### What It Does
- Models self-register, upload photos (face, outfit inspo, hair inspo, makeup inspo, own outfits), and fill in their details (sizes, availability, hair texture, etc.)
- Staff (stylists, hair stylists, makeup artists) log in and browse models, claim them ("Work With"), mark pending, or reject
- Admin (Daniel) manages everything: assigns staff to models, tracks sign-up completion, manages inventory (physical clothing/accessories), adds internal notes/tags, exports roster CSV
- Models can view their assigned team, their stage fit (inventory assigned to them), and edit their profile after signup

### Who Uses It
| Role | Name(s) | What They Do |
|------|---------|--------------|
| ADMIN | Daniel | Full access — assigns, tracks, manages, edits everything |
| STYLIST | Daniel, Dee, Komi, Richelle | Browse models, claim for styling |
| HAIR_STYLIST | Christie, Maria, Neza | Browse models, claim for hair, see hair details |
| MAKEUP_ARTIST | Rebecca | Browse models, claim for makeup |
| MODEL | All cast models | Self-register, upload photos, view their profile |

### Business Purpose
Replaces a Google Forms + spreadsheet workflow. The goal is that all styling, hair, and makeup staff can see every model's photos and details in one place, assignments are visible to everyone in real time, and Daniel has a single dashboard to track who has and hasn't completed the sign-up process.

---

## 2. Architecture & Structure

### Files
```
app vdg files/
├── index.html      — Single HTML file. All UI structure, all forms, all overlays.
├── app.js          — All JavaScript. Auth, data loading, rendering, uploads, DB calls.
├── styles.css      — All styling. CSS variables, component styles, responsive layout.
└── HANDOFF.md      — This file.
```

**This is a deliberately minimal stack.** No framework, no build step, no bundler. Vanilla JS + Supabase JS SDK loaded via CDN. Everything is in three files.

### Frontend Structure
- **Single page app** — all sections exist in the DOM simultaneously, shown/hidden via `.hidden` class
- **Sections:** `#auth-screen`, `#admin-dashboard`, `#staff-dashboard`, `#model-dashboard`
- **Overlays:** `#model-panel-overlay` (model detail panel), `#inv-modal-overlay` (add/edit inventory), `#edit-details-overlay` (model self-edit panel)
- **No routing** — state is managed entirely in JS variables
- **Cache busting** — `app.js` is loaded as `app.js?v=N` in index.html. **Increment `v=N` every deploy** or browsers will serve stale JS. Current version: v=7.

### Backend: Supabase
- **Project URL:** `https://dyruvkzuasaiofkxdvid.supabase.co`
- **Key:** `sb_publishable_tKMXDxTa-uICYsBE3OUh7A_RsoGFhhf` (anon/publishable key, safe for client-side)
- **No RLS enabled** (intentional for MVP — internal app with trusted users only)

### Supabase Tables

#### `model_profiles`
The core table. One row per model.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid/int | Primary key |
| `full_name` | text | Used as the join key for inventory — do not change |
| `username` | text | Login credential |
| `pin` | text | 4-digit plaintext PIN |
| `registered` | bool | True after signup form submitted |
| `approved` | bool | Admin approval flag (shown on card) |
| `profile_photo` | text | URL to profile photo in storage |
| `photos` | text[] | Outfit inspo photo URLs |
| `hair_photos` | text[] | Hair inspo photo URLs |
| `mua_photos` | text[] | Makeup inspo photo URLs |
| `face_photos` | text[] | Face close-up photo URLs |
| `outfit_photos` | text[] | Own outfit photo URLs (also added to inventory) |
| `assigned_stylist` | text | Staff name |
| `assigned_hair` | text | Staff name |
| `assigned_makeup` | text | Staff name |
| `stylist_status` | text | 'working' / 'pending' / 'rejected' |
| `hair_status` | text | Same |
| `makeup_status` | text | Same |
| `checklist_outfit` | bool | Admin completion checklist |
| `checklist_hair` | bool | Admin completion checklist |
| `checklist_makeup` | bool | Admin completion checklist |
| `needs_hair` | bool | If false, hidden from hair team |
| `needs_makeup` | bool | If false, hidden from makeup team |
| `signup_manually_complete` | bool | Admin toggle: marks model as signed up even without face photo |
| `signup_acknowledged` | bool | Admin dismissed model from the "completed" sign-up tracker section |
| `updated_at` | timestamptz | **Auto-managed by Supabase moddatetime trigger. NEVER write this from client code.** |
| `tags` | text[] | Admin-applied tags |
| `notes` | text | Internal team notes (admin-only visible) |
| `model_note` | text | Note from model to team (visible in panel) |
| `hair_texture` | text | e.g. '4C' |
| `hair_length` | text | 'Short' / 'Medium' / 'Long' |
| `no_own_outfit` | bool | If true, auto-assigned to Daniel as stylist at signup |
| `ethnicity` | text | Used for flag emoji display |
| Various detail fields | | `age`, `gender`, `height`, `top_size`, `jean_size`, `suburb`, `style`, `phone`, `instagram`, `free_5july`, `hair_ok`, `makeup_self`, `cultural_piece`, `cultural_desc`, `talent`, `talent_desc`, `agency` |

#### `users`
Staff and admin accounts. Models are NOT in this table — they live entirely in `model_profiles`.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | Primary key |
| `name` | text | Display name |
| `role` | text | ADMIN / STYLIST / HAIR_STYLIST / MAKEUP_ARTIST |
| `username` | text | Login credential |
| `pin` | text | 4-digit plaintext PIN |
| `instagram` | text | Shown on team cards in model dashboard |

#### `inventory`
Physical clothing and accessories for the show.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | Primary key |
| `name` | text | Item name |
| `category` | text | Top / Bottom / Outerwear / Accessory / Shoes / Full Look / Own Outfit |
| `size_qty` | text | Free text size |
| `assigned_model` | text | Full name string — matched against `model_profiles.full_name` |
| `photo_url` | text | URL to item photo |

**Critical:** Inventory-to-model assignment is by `full_name` string match, NOT by ID. If a model's name ever changes, their inventory assignments will silently break.

### Supabase Storage
- **Bucket:** `model-photos` (public)
- **Path format:** `{folder}/{subfolder}/{timestamp}_{random5chars}` (no original filename — sanitized for security)
- Old photos are **never deleted** from storage when updated. Only the DB URL pointer changes. Orphaned files accumulate harmlessly.

### Deployment
- **GitHub repo:** `visiondegarcon-blip/vdg-casting`, branch `portal-v2`
- **Vercel:** Auto-deploys from `portal-v2` branch on every push
- **Live URL:** `https://vdg-casting.vercel.app`
- **Deploy process:** `git push origin portal-v2` — Vercel picks it up in ~30s
- **No build step** — Vercel serves static files directly

---

## 3. User Workflow

### Model Sign-Up Flow
1. Model goes to the app, clicks **Sign Up**
2. Selects role: **Model / Applicant**
3. Two paths:
   - **Existing model** (was in a Google Form / pre-added by admin): selects their name from dropdown → form pre-fills → uploads face photo (required) + optional photos → sets username/PIN → submits
   - **New model**: clicks "I'm a new model" toggle → fills full form from scratch
4. On submit: `model_profiles` row is **updated** (existing) or **inserted** (new) with `registered: true, approved: true`
5. Own outfit photos are **automatically added to `inventory`** as "Own Outfit" items assigned to that model
6. Model then signs in and sees their profile dashboard

### Model Re-Registration
A model can sign up again (e.g., if username didn't save). The existing model signup (`signUpExistingModel`) explicitly allows this — it only blocks if a *different* profile already has that username. The row is updated with the new username/PIN, overwriting old credentials. Tell a model with a failed signup: **"Sign up again, select your name from the dropdown, fill in the rest — your new username and PIN will overwrite the old ones."**

### Staff Sign-In Flow
1. Staff signs up once (Sign Up → select role → select name → set username/PIN)
2. After that, just Sign In with username + PIN
3. Staff see a model grid filtered by relevance (hair team only sees `needs_hair: true` models)
4. Staff click a model to open their detail panel → mark "Work With" / "Pending" / "Reject"
5. "Work With" sets their assignment field (`assigned_hair`, etc.) to their name — visible to all staff on model cards

### Admin (Daniel) Flow
1. Signs in as admin
2. **Sign Up Tracker** appears at top of All Models tab:
   - ✅ Completed — registered + face photo uploaded, OR manually toggled. Dismissable with ×.
   - ⏳ Not Signed Up Yet — models with no face photo and not manually marked
3. Clicks any tracker model → opens full model panel
4. Panel header shows **signup toggle** (admin-only) — manually mark/unmark signed up
5. Underneath tracker: full model grid with inline assignment dropdowns
6. Admin can also access Inventory tab, Team tab, export CSV

### Model Dashboard (Post Login)
After sign-in, model sees their profile: assigned team (with Instagram handles), notes from team, stage fit (inventory assigned to them), quick photo upload section, and all uploaded photos. Tap **Edit Details** to update any field or add photos.

---

## 4. Current State

### Fully Working
- Sign up (existing model and new model flows)
- Sign in for all roles
- Model profile dashboard + Edit Details panel
- Admin model grid with assignment dropdowns on each card
- Admin completion checklist (outfit / hair / makeup)
- Staff model grid with role-based visibility filtering
- Staff status system (Work With / Pending / Reject)
- Model detail panel (all photo sections, details, notes, tags)
- Sign-up tracker with manual admin toggle and dismiss
- Inventory management (add, edit, delete, assign to model)
- Stage fit section in panel (view + add from inventory)
- Team panel (view staff and their models)
- Manage Users (delete staff accounts)
- Reset model PIN
- Delete model (with storage cleanup attempt)
- Export models CSV
- Signup badge on all model cards (visible to all roles including staff)
- "My Models" tab (Daniel-only — shows models assigned to him)
- Back button (persistent nav for all logged-in users)

### Known Limitations (Intentional for MVP)
- No RLS on Supabase
- PINs stored plaintext
- No session persistence (must sign in again after closing browser)
- Old profile photos accumulate in storage, never cleaned up
- No photo deletion from model profiles (add-only)
- Staff names hardcoded in `STAFF_NAMES` — adding new staff requires code change
- Inventory-to-model link is full_name string, not ID
- No pagination — loads all models at once (fine for ~50 models)

### Partially Implemented / Edge Cases
- `signup_acknowledged` dismiss is permanent — no undo
- Editing "no own outfit" in Edit Details doesn't auto-update `assigned_stylist` (auto-assign only happens at initial signup)

---

## 5. Historical Context — Bugs Solved

### Bug 1: Assuming Auto-Deploy
**What happened:** Claude said "Pushed ✅" after a `git commit` without running `git push`. The user had to manually deploy.

**Lesson learned:** Always verify with `git log origin/branch --oneline` after committing. Never say "deployed" without confirming the push. `git commit` only saves locally. `git push origin portal-v2` is required for Vercel to pick it up.

---

### Bug 2: Schema Cache Error on Toggle Untick
**Error:** `Could not find the 'updated_at' column of 'model_profiles' in the schema cache`

**What happened:** The `toggleSignupComplete` function was sending `updated_at: now` in the Supabase `.update()` call alongside `signup_manually_complete`.

**Root cause:** `updated_at` is managed by a **Supabase `moddatetime` trigger**. It is effectively read-only from the client. Supabase's PostgREST schema cache rejects explicit writes to trigger-managed columns.

**Fix:** Removed `updated_at` from the update payload. Only `signup_manually_complete` is written.

**Architectural rule going forward:** NEVER include `updated_at` in any `.update()` call. The moddatetime trigger fires automatically whenever any other column changes. The "Last updated" display in the admin panel reflects **model self-edits only** — admin toggle actions must not change the timestamp.

---

### Bug 3: Redundant Mini Popup
**What happened:** Original sign-up tracker had a mini popup on click (showing last updated + "Mark as Complete" button). This required two clicks to see a full profile and duplicated functionality.

**Fix:** Removed mini popup entirely (`openTrackerDetail` and `closeTrackerDetail` functions deleted). Tracker clicks now go directly to `openModelPanel`. The signup toggle was moved into the panel header, where it's permanently visible for admin on any model panel.

---

### Bug 4: MIME Validation Silent Failures
**What happened:** Added `file.type.startsWith('image/')` check in `uploadFiles()`. Removed because `file.type` can be empty string on some systems/browsers (especially drag-and-drop), causing files to be silently skipped with no user feedback.

**Lesson:** Silent failures are worse than no validation for an internal MVP. The browser's `accept="image/*"` on all file inputs already provides sufficient protection. If MIME validation is ever re-added, it MUST show a visible toast error to the user.

---

## 6. Active Investigations

**None at time of writing.** App is MVP-complete and deployed.

**Known issue to watch:** Jasmine's account — her username didn't save on first signup attempt. Recommended resolution: have her sign up again using the existing model dropdown. The re-registration path overwrites credentials cleanly.

---

## 7. Important Decisions

### No Framework
Deliberate. Single-event app with tight timeline. Vanilla JS is faster to iterate for this scope. Do not introduce React/Vue/etc.

### Three Files Only
`index.html` / `app.js` / `styles.css`. One file per concern. Don't split unless the app grows significantly beyond this event.

### Admin Toggle Does Not Update `updated_at`
Deliberate. The "Last updated" timestamp is a signal of **model self-activity**, not admin activity. Admin marking a toggle, editing notes, or changing assignments should not affect it.

### Staff Names Hardcoded
`STAFF_NAMES` constant in app.js is the canonical source for role dropdowns. This ensures Daniel (ADMIN) always appears as a STYLIST option even though his DB role is ADMIN. The `staffUsers` from the DB is a fallback only.

### Inventory by Full Name
`inventory.assigned_model` is a name string for simplicity. Acceptable for a fixed-roster single event. If the app runs again, migrate to a foreign key.

### Own Outfit → Auto Inventory
Outfit photos uploaded at signup or via Edit Details are automatically inserted as `inventory` rows. This gives stylists visibility into what models are bringing without manual entry.

### No Photo Deletion
Add-only for model photos. Keeps things simple and prevents accidental loss. Admin can delete the whole model profile if needed.

---

## 8. Known Risks

### 🔴 High: No RLS on Supabase
Anyone with the anon key (visible in app.js source) can read or write all tables. Acceptable for a trusted internal event. Enable RLS before using beyond this event.

### 🟡 Medium: Inventory by Full Name
Renaming a model in `model_profiles.full_name` silently breaks all their inventory assignments. Never rename models without also updating `inventory.assigned_model`.

### 🟡 Medium: Cache Version Must Be Bumped
`index.html` loads `app.js?v=7`. If you forget to increment on deploy, browsers serve stale JS. Always bump the version number.

### 🟡 Medium: `window._panelModelId` Global
The signup toggle uses `window._panelModelId` (set in `openModelPanel`). Fine for single-panel use, but would collide if the UI ever allowed multiple panels open simultaneously.

### 🟢 Low: 80ms Timeout in Staff Panel
`closePanel();setTimeout(()=>openModelPanel(...),80)` — animation timing hack. Fragile if CSS transitions change duration.

### 🟢 Low: `toArr()` Must Be Used for Photo Arrays
Supabase sometimes returns array columns as JSON strings. Always use `toArr(m.photos)` etc., never access photo arrays directly. Missing `toArr()` in new code will cause `.map is not a function` errors.

### 🟢 Low: Plaintext PINs
PINs stored as plain text in both tables. Fine for this event scope; hash them if ever reused.

---

## 9. Recommended Next Steps

### Before Event Day (July 5)
1. **Enable Supabase RLS** — Add policies: models can only read/write their own row; staff can read all, write limited fields; admin full access.
2. **Verify Jasmine's account** — Check `model_profiles` for her name with no username. If found, have her re-register.
3. **Mobile testing** — Test sign-up, photo upload, panel scroll, and toggle on iOS Safari + Android Chrome.

### Soon After
4. **PIN hashing** — Hash before storing (bcrypt or Supabase Auth).
5. **Photo deletion** — Let admin remove individual photos from a model profile.
6. **Staff name management** — Move `STAFF_NAMES` to DB or make it editable from admin panel.

### Future / Nice to Have
7. **Session persistence** — Store `currentUser` in localStorage.
8. **Undo dismiss** — Currently `signup_acknowledged` is permanent with no undo.
9. **Storage cleanup** — Delete orphaned photos from Supabase Storage when model is deleted or photo replaced.
10. **Inventory FK** — Migrate `inventory.assigned_model` from name string to UUID foreign key.
11. **Pagination** — If roster exceeds ~100 models, lazy-load instead of fetching all at once.

---

## Quick Reference

```
Live URL:        https://vdg-casting.vercel.app
GitHub:          visiondegarcon-blip/vdg-casting  (branch: portal-v2)
Deploy command:  git push origin portal-v2
Cache version:   Currently v=7 in index.html <script src="app.js?v=7">
                 Increment this on every deploy.
Admin login:     username: danielngabz  (ask Daniel for PIN)
Supabase URL:    https://dyruvkzuasaiofkxdvid.supabase.co
Supabase key:    sb_publishable_tKMXDxTa-uICYsBE3OUh7A_RsoGFhhf
```

---

*Last updated: June 2026. App status: MVP complete, deployed, in active use pre-event.*
