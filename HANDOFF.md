# HANDOFF — 5 July Model Casting/Styling App

## 1. PROJECT OVERVIEW

**What it does:** A vanilla JS single-page app used to manage models, staff (stylists, hair stylists, makeup artists, admin), and wardrobe inventory for a live fashion event called "5 July." Models sign up and upload photos (fits, hair/makeup inspo, outfit photos, profile photo). Admin approves models, assigns them to stylist/hair/makeup staff, tracks a completion checklist (outfit/hair/makeup done), and manages a shared clothing inventory that can be assigned to specific models. Staff log in to see their assigned models and update status (working/pending/rejected).

**Tech stack:**
- Plain HTML/CSS/JS — no framework, no build step, no bundler
- Single JS file: `app.js` (~1109 lines), single `index.html`, single `styles.css`
- Supabase (Postgres + Storage) as backend — accessed directly from the browser via `@supabase/supabase-js` CDN client (`window.supabase.createClient(...)`)
- Deployed via **Vercel**, connected to a **GitHub repo** (push to GitHub → auto-deploy on Vercel)

**Architecture:**
- One big `app.js` containing everything: auth, signup, all dashboards (admin/staff/model), modals/panels, inventory, uploads — all rendered via template-literal `innerHTML` injection (no virtual DOM, no components)
- Role-based views driven by `currentUser.role` (`ADMIN`, `STYLIST`, `HAIR_STYLIST`, `MAKEUP_ARTIST`, `MODEL`)
- "Panels"/"modals" are just `<div class="...-overlay hidden">` wrappers toggled via `.classList.remove/add('hidden')` (CSS: `.hidden { display: none !important; }`)

**Key integrations:**
- **Supabase Postgres** — tables: `model_profiles`, `inventory`, `users` (staff/admin accounts)
- **Supabase Storage** — bucket `model-photos`, used for profile photos, fit/hair/mua/outfit/face photos, and inventory item photos
- **Supabase client config** is hardcoded at the top of `app.js`:
  ```js
  const SUPABASE_URL = "https://dyruvkzuasaiofkxdvid.supabase.co";
  const SUPABASE_KEY = "sb_publishable_tKMXDxTa-uICYsBE3OUh7A_RsoGFhhf";
  ```

---

## 2. CURRENT STATE

### Working:
- Sign in / sign up (model "new" and "existing" flows, staff/admin flows)
- Photo uploads to Supabase Storage (was previously broken due to storage policies — now fixed)
- Admin model grid, staff model grid, filtering/search/tabs
- Model card click → opens detail panel **(FIXED this session — see Issue #1)**
- Inventory grid renders with photos
- Inventory item click → opens edit panel **(FIXED this session — see Issue #2)**
- Approve/assign/checklist/tag/notes functionality in the admin model panel
- `toArr()`/`normaliseModel()`/`parseJsonArray()` helpers correctly normalize Supabase array-type columns that sometimes return as JSON-text strings

### Implemented but with a remaining bug:
- The model detail panel's **collapsible photo sections** (Face Photos / Outfit / Hair & Makeup Inspo) render as functionally-correct `<button class="collapse-btn">` elements with the right text in the DOM — but **the text is visually invisible**, appearing as blank horizontal bars (see Issue #3 — UNRESOLVED).

### Not yet implemented (explicitly deferred by user, "do later"):
- (a) Change signup wording from "Your Own Outfit Photos" to something like "current outfits you have that fit the streetwear/traditional theme" + auto-upload those photos to inventory + auto-assign to that model
- (b) Redesign the **model's own dashboard** (`showModelDashboard`/`#model-profile-wrap`) to be a **centered, rounded-corner popup/modal** (like `model-panel-overlay` is for admin), with internal scrolling instead of whole-page scroll, and a banner at top showing which staff (stylist/hair/makeup) are assigned to that model
- (c) Add an explanatory caption near "Final Stage Fits" / "Assigned Inventory" sections clarifying to stylists/admin that these are wardrobe items from inventory assigned to that model for the shoot

---

## 3. MAJOR ISSUES ENCOUNTERED

### Issue #1: Model detail panel wouldn't open (crash on click) — ✅ FIXED
**Symptoms:** Clicking a model card (as admin or staff) did nothing — no panel appeared, no visible error to the user.

**Root cause:** Supabase was returning array-type Postgres columns (`photos`, `hair_photos`, `mua_photos`, `outfit_photos`, `face_photos`, `tags`) as **JSON-encoded strings** instead of real JS arrays in some cases. The `openModelPanel`/`showModelDashboard` functions called `.map()` and spread (`[...arr]`) directly on these values. Calling `.map()` on a string throws `TypeError: arr.map is not a function`. Because this happened mid-template-literal-construction, the exception fired *before* the line that removes the `.hidden` class — so the panel silently never appeared. Only visible via browser console.

**How diagnosed:** User pasted the exact console error:
```
app.js:581 Uncaught (in promise) TypeError: arr.map is not a function
    at photoGrid (app.js:581:74)
    at openModelPanel (app.js:586:36)
    at HTMLDivElement.onclick ((index):1:1)
```

**Exact fix applied:**
1. Added a normalization helper near the top of `app.js`:
   ```js
   function toArr(v) {
     if (Array.isArray(v)) return v;
     if (typeof v === 'string' && v.trim().startsWith('[')) {
       try { const p = JSON.parse(v); return Array.isArray(p) ? p : []; } catch { return []; }
     }
     return [];
   }
   ```
   (A near-identical `parseJsonArray` helper also exists, used inside `normaliseModel()` — both do the same thing; the codebase ended up with two equivalent helpers, which is harmless but worth noting/consolidating later.)
2. In `openModelPanel` (line ~605-609, ~631): wrapped `photos`, `hairPh`, `muaPh`, `facePh`, `tags`, `outfitPh` in `toArr(...)`
3. In `showModelDashboard` (line ~986-989): wrapped `hairPh`, `muaPh`, `outfitPh` in `toArr(...)` (note: `photos` on line 986 is still `model.photos || []` — NOT wrapped in `toArr`, but this hasn't caused issues so far since `normaliseModel()` is called before `showModelDashboard` in the sign-in path)
4. Fixed a second related bug at line ~1039: a template literal was directly calling `model.outfit_photos.map(...)` instead of using the normalized `outfitPh` variable — changed both occurrences of `model.outfit_photos` → `outfitPh`

**Files changed:** `app.js` only (`/Users/admin/Desktop/app vdg files/app (1).js` and the version pushed to GitHub)

**Verification:** User confirmed via screenshot that the panel now opens and displays model details correctly (saw "don diddy" model's full panel with Note from Model, Details, Assignment & Status sections).

**Lessons learned:** Always normalize Postgres array-column data at the boundary (right after fetching from Supabase) rather than at every point of use — `normaliseModel()` already does this for the admin model list (`loadAllModels`), but `signIn()`'s direct fetch and a few other code paths bypassed it, requiring point-of-use `toArr()` patches as a stopgap.

---

### Issue #2: Inventory item click did nothing — ✅ FIXED
**Symptoms:** Clicking an inventory card produced no panel, no console error, and no "Item not found" toast (which would fire if `openInventoryPanel` ran but found no matching item).

**Root cause:** The deployed `app.js` on Vercel was an **outdated version that didn't match what was in the GitHub repo / local files** — it lacked the `onclick="openInventoryPanel('${item.id}')"` attribute entirely on the `.inv-card` divs in `renderInventoryGrid`. This was NOT a browser cache issue (a hard refresh did not fix it) — it was a stale Vercel deployment.

**How diagnosed:**
1. User inspected the live DOM — `.inv-card` elements had **no** `onclick` or `style="cursor:pointer"` attributes, even though the source `renderInventoryGrid` function clearly included them
2. Hard refresh did not change this (ruled out simple browser cache)
3. User loaded the live site's `/app.js` URL directly and searched for `openInventoryPanel` — **zero matches**, confirming the deployed file genuinely lacked this code
4. User then checked the GitHub repo's file viewer directly — **the correct code WAS present there** (both the `onclick="openInventoryPanel(...)"` in `renderInventoryGrid` and the full `openInventoryPanel` function)
5. Conclusion: GitHub had the right code, but Vercel's deployed build was stale/out of sync

**Exact fix applied:** User triggered a redeploy from the Vercel dashboard (Deployments → Redeploy on latest commit). After redeploy + hard refresh, inventory panel opened correctly.

**Files changed:** None (no code change needed — deployment/infra issue only)

**Lessons learned:** When live behavior doesn't match source code AND a hard browser refresh doesn't fix it, **don't assume it's a browser cache problem** — check whether the deployment platform (Vercel) actually has the latest commit deployed. Compare the live served `/app.js` content directly (view raw file in browser) against the GitHub repo's file viewer to isolate "is this a deploy problem or a code problem."

---

### Issue #3: Collapsible photo-section button text is invisible — ❌ UNRESOLVED
See "Current Known Issues" section below for full details — this is the active bug to pick up next.

---

## 4. DEBUGGING HISTORY (including dead ends)

- **False lead — browser cache for inventory panel:** Initially assumed stale browser cache was why `.inv-card` elements lacked `onclick`. Hard refresh disproved this. The real cause was a stale Vercel deployment (see Issue #2).
- **Confusion over which `app.js` is "live":** At one point there were at least 3 candidate versions in play — `app (1).js` (user's downloaded "current GitHub code"), `v2-fixed/app.js` (an earlier rewrite attempt that was confirmed via `diff` to have NEVER been pushed/deployed), and the actual deployed-but-stale Vercel build. This caused significant confusion until the user started checking the GitHub web file-viewer directly and comparing it against the live served `/app.js`.
- **CSS variables ruled out for Issue #3:** Suspected `--brown-dark`/`--cream` CSS custom properties might be near-identical (causing low contrast). Checked `:root` block — `--brown-dark: #5c3d2e` (dark brown) vs `--cream: #f5f0e8` (near-white) — high contrast, NOT the cause. Ruled out.
- **Duplicate `.collapse-btn` CSS rules ruled out:** Asked user to search `styles.css` for multiple definitions of `.collapse-btn`/`.collapse-section`/`.collapse-arrow` that might override each other. Full CSS file was read — only ONE definition of each exists (lines 454-479), and the rule itself looks completely correct (explicit `color: var(--brown-dark)` on `background: var(--cream)`).
- **DOM inspection shows correct markup for Issue #3:** User inspected the element in DevTools — confirmed the button has `class="collapse-btn"`, the text node `"👤 Face Photos "` IS present as a child, and the `<span class="collapse-arrow">▾</span>` is there too. So this is NOT a missing-text/deploy-mismatch problem like Issue #2 was — the HTML is correct. This narrows it to a **rendering/computed-style issue**.

---

## 5. DATABASE STATE

**Tables (Supabase Postgres):**
- `model_profiles` — columns include: `id`, `full_name`, `username`, `pin`, `registered` (bool), `approved` (bool), `instagram`, `phone`, `age`, `gender`, `ethnicity`, `height`, `top_size`, `jean_size`, `suburb`, `style`, `cultural_piece`, `cultural_desc`, `talent` (bool), `talent_desc`, `free_5july` (bool), `hair_ok` (bool), `makeup_self` (bool), `agency`, `model_note`, `notes`, `profile_photo` (text URL), array-type columns: `photos`, `hair_photos`, `mua_photos`, `outfit_photos`, `face_photos`, `tags`, plus `needs_hair`/`needs_makeup` (bool), `checklist_outfit`/`checklist_hair`/`checklist_makeup` (bool), `assigned_stylist`/`assigned_hair`/`assigned_makeup` (text — staff name), `stylist_status`/`hair_status`/`makeup_status` (text: 'working'/'pending'/'rejected')
- `inventory` — columns: `id`, `name`, `category`, `size_qty`, `photo_url`, `assigned_model` (text — model's full_name), `created_at`
- `users` — staff/admin accounts: `id`, `name`, `role` (STYLIST/HAIR_STYLIST/MAKEUP_ARTIST/ADMIN), `username`, `pin`

**Known Supabase quirk (CRITICAL — affects all array columns):** Array-type columns (`photos`, `hair_photos`, `mua_photos`, `outfit_photos`, `face_photos`, `tags`) are SOMETIMES returned by Supabase as **JSON-encoded text strings** (e.g. `'["url1","url2"]'`) instead of actual JS/Postgres arrays. This is the root cause of Issue #1. Always run values through `toArr()`/`parseJsonArray()`/`normaliseModel()` before calling array methods on them.

**Storage:** Bucket name is `model-photos`. Upload paths follow pattern `${folder}/${subfolder}/${timestamp}_${random}_${filename}` where `folder` = model's id/name (or `new_${Date.now()}` for brand-new signups) and `subfolder` ∈ `profile`, `face`, `fit`, `hair`, `mua`, `outfit`, or for inventory: `inventory/items`. Public URLs generated via `sb.storage.from('model-photos').getPublicUrl(path)`.

**RLS policies / triggers / edge functions:** Not documented in this session — a previous session apparently fixed a Storage-policy bug related to photo uploads (mentioned as "resolved earlier photo-upload bug — Supabase Storage policies"), but the exact policy SQL was not captured here. **If uploads break again, check Storage bucket RLS policies on `model-photos` first.**

---

## 6. AUTHENTICATION FLOW

**No Supabase Auth is used** — this is a custom username/PIN system stored directly in `model_profiles` and `users` tables (plaintext PIN comparison — `model.pin !== pin`). This is insecure but is the existing design; not flagged as something to change.

**Sign-in (`signIn()`):**
1. Checks `model_profiles` by `username` first — if found, validates `pin`, sets `currentUser = {id, name, role:'MODEL', username}`, calls `showModelDashboard(normaliseModel(model))`
2. If no model found, checks `users` table — validates `pin`, sets `currentUser`, routes to `showAdminDashboard()` or `showStaffDashboard(user)` based on `role`

**Sign-up (`signUp()`):** Branches by role:
- `MODEL` + `isNewModel === true` → `signUpNewModel()` — creates a brand new `model_profiles` row via `.insert()`
- `MODEL` + `isNewModel === false` → `signUpExistingModel()` — finds an existing pre-seeded (unregistered) row by `id` (selected from a dropdown of `registered=false` models) and `.update()`s it with username/pin/photos — **this OVERWRITES the row in place, does NOT create a duplicate**
- Staff/Admin → simple insert into `users` table

**User creation flow:** Models are pre-seeded into `model_profiles` (with `registered=false`, no username/pin) presumably by admin/CSV import before the event — the "Existing Model" signup flow is how these pre-seeded profiles get claimed by the actual person.

**Known edge case discussed this session:** If a model needs to redo their signup (e.g., entered wrong info), they should simply **go through "Existing Model" signup again** — `signUpExistingModel`'s `.update().eq('id', nameVal)` will overwrite username/pin/photos on the same row, no duplicate created, no manual SQL deletion needed. (An alternative SQL-based reset was also provided to the user as a fallback option — see section 14 for the exact SQL if needed.)

---

## 7. STORAGE AND IMAGE HANDLING

**Upload architecture:** All uploads funnel through `uploadFiles(fileList, folder, subfolder, max)`:
```js
async function uploadFiles(fileList, folder, subfolder, max) {
  const urls = [];
  let files = Array.from(fileList);
  if (max && files.length > max) files = files.slice(0, max);
  for (const file of files) {
    const path = `${folder}/${subfolder}/${Date.now()}_${Math.random().toString(36).slice(2,7)}_${file.name}`;
    const { error } = await sb.storage.from('model-photos').upload(path, file, { upsert: true });
    if (!error) {
      const { data } = sb.storage.from('model-photos').getPublicUrl(path);
      urls.push(data.publicUrl);
    } else { console.error('Upload error:', error); }
  }
  return urls;
}
```
Returns an array of public URLs which then get stored directly in the relevant `model_profiles` array columns or `inventory.photo_url`.

**Thumbnail handling:** None — original images are displayed at full resolution via `object-fit: cover` in fixed-aspect-ratio containers (`.photo-thumb { aspect-ratio: 3/4; }`, `.stage-fit-item img { aspect-ratio: 3/4; }`, `.inv-card-photo { aspect-ratio: 3/4; }`).

**Previous image-related bugs:** A Storage RLS-policy bug previously prevented uploads from succeeding (fixed in an earlier session, exact policy not documented here). The `arr.map is not a function` crash (Issue #1) was technically about *displaying* already-uploaded photo arrays, not about the upload process itself.

---

## 8. FRONTEND ARCHITECTURE

- **No components/framework** — everything is template-literal strings injected via `.innerHTML`
- **Global mutable state variables** at top of `app.js`: `currentUser`, `allModels`, `inventoryData`, `activeTab`, `staffTab`, `openModelData`, `isNewModel`
- **"Routing"** is just `hideAll()` + `classList.remove('hidden')` on the relevant `.dashboard` div — no URL-based routing, no history API
- **Data fetching pattern:** `loadAllModels()` and `loadInventory()` populate the global `allModels`/`inventoryData` arrays; most render functions just read from these cached arrays rather than re-fetching; mutations (`assignField`, `toggleChecklist`, etc.) update both Supabase AND the local cached array, then call `refreshCurrentView()` to re-render
- **Modals/panels** are overlay divs toggled via `.hidden` class: `#model-panel-overlay`, `#inv-modal-overlay` — both use the pattern `classList.remove('hidden')` to show, `classList.add('hidden')` to hide, plus `document.body.style.overflow='hidden'` to lock page scroll while open

---

## 9. BACKEND ARCHITECTURE

There is no custom backend — **Supabase IS the backend**, accessed directly from the browser via the JS client with a publishable key. All "API calls" are direct `sb.from('table').select/insert/update()` calls or `sb.storage.from('bucket').upload/getPublicUrl()`. No serverless functions, no Edge Functions, no custom REST/GraphQL layer were found or mentioned.

---

## 10. CURRENT KNOWN ISSUES

### Issue #3 (ACTIVE): Collapsible section button text invisible — UNRESOLVED
**Symptoms:** In the model detail panel (opened via `openModelPanel`), the three collapsible buttons that should read "👤 Face Photos ▾", "👕 Outfit ▾", "💇 Hair & Makeup Inspo ▾" instead render as blank horizontal bars with no visible text — see user's screenshot showing 3 long empty-looking lines stacked above the "Note From Model" section.

**Suspected cause:** Unknown — narrowed down significantly but not resolved. Likely a CSS computed-style issue (something is making the text color match the background, or font-size/line-height is collapsing the text to invisibility) OR a rendering quirk specific to the user's browser.

**Evidence gathered (and ruled out):**
- ✅ DOM inspection confirms the button HTML is structurally correct: `<button class="collapse-btn" onclick="toggleCollapse(this)">👤 Face Photos <span class="collapse-arrow">▾</span></button>` — text node `"👤 Face Photos "` IS present as a child of the button
- ✅ CSS rule for `.collapse-btn` (styles.css lines 454-471) looks completely correct: explicit `color: var(--brown-dark)` (#5c3d2e, dark brown) on `background: var(--cream)` (#f5f0e8, near-white) — should have strong contrast
- ✅ No duplicate/conflicting `.collapse-btn`/`.collapse-section`/`.collapse-arrow` rules exist anywhere else in `styles.css` (full file read and searched)
- ✅ CSS custom properties `--brown-dark` and `--cream` are correctly defined in `:root` with the expected high-contrast values — not the issue
- ❓ NOT YET CHECKED: the actual **computed** `color` value in DevTools "Computed" tab for the button (vs. the rule that's *supposed* to apply) — this is the critical missing data point
- ❓ NOT YET CHECKED: whether `font-size`/`line-height`/`overflow` computed values are collapsing the text box to zero height/width
- ❓ NOT YET CHECKED: whether this is a deployed-code mismatch like Issue #2 (i.e., is the LIVE served `styles.css` actually identical to the one read in this session?)

**Confidence level:** LOW-MEDIUM — we've ruled out the most likely CSS-authoring mistakes, but haven't yet looked at DevTools' **Computed** styles tab (only the Elements/DOM tree), which is the next logical step.

**Recommended next debugging steps (in order):**
1. **Check for a deploy/cache mismatch first** (cheapest check, and burned us once already on Issue #2): have the user load the live site's `/styles.css` URL directly and search for `.collapse-btn` — confirm the served CSS matches what was read in this session (the version with `color: var(--brown-dark)` etc. at lines 454-471)
2. **Inspect computed styles**: in DevTools, click the `<button class="collapse-btn">` element, switch to the **"Computed"** tab (not "Styles"), and look up the actual resolved values for `color`, `background-color`, `font-size`, `line-height`, `height`, `overflow`. Compare the resolved `color` against what `.collapse-btn` *should* produce (`#5c3d2e`)
3. If computed `color` is correct but text still invisible — check `overflow`/`height`/`line-height` for clipping
4. If computed `color` is WRONG (e.g., resolves to white/transparent/same-as-background) — there's a higher-specificity or later-cascade rule overriding it that wasn't found in the static file read; consider it might be coming from a **browser extension**, **dark-mode forced styles**, or an **inline style** injected by JS that wasn't visible in the static `app.js` read
5. Try **incognito/private window** to rule out browser extensions injecting CSS overrides

---

## 11. IMPORTANT FILES

- **`/Users/admin/Desktop/app vdg files/app (1).js`** — the main (and only) JS file; ~1109 lines; contains ALL app logic. This is the version confirmed to match what's now correctly deployed (after the redeploy that fixed Issue #2). **This is the canonical reference file going forward.**
- **`/Users/admin/Desktop/app vdg files/styles (1).css`** — the main (and only) CSS file; ~483 lines; read in full this session, no issues found in static analysis
- **`/Users/admin/Desktop/app vdg files/index (1).html`** — main HTML shell (not re-read this session, but confirmed byte-identical to other copies in earlier sessions via `diff`)
- **`/Users/admin/Desktop/app vdg files/v2-fixed/`** — ⚠️ a STALE/ABANDONED rewrite folder from an earlier session; confirmed via `diff` to NOT be what's deployed; **do not use as reference, will cause confusion** (kept causing version-mismatch confusion this session — consider deleting it)
- **GitHub repo** (connected to Vercel) — the actual source of truth for what gets deployed; user can view files directly via GitHub's web file viewer — **this is more reliable than comparing local downloaded copies**, since local copies can be stale/renamed (`app (1).js` vs `app.js` vs `v2-fixed/app.js`)

---

## 12. OPEN TASKS

**Critical:**
- Fix Issue #3: invisible collapse-btn text in model detail panel (see Section 10 for exact next steps)

**High:**
- (b) Redesign model's own dashboard (`showModelDashboard` / `#model-profile-wrap`) into a centered, rounded-corner, internally-scrollable modal/panel (matching the visual pattern already used for `model-panel-overlay`/`.model-panel`), and surface `assigned_stylist`/`assigned_hair`/`assigned_makeup` prominently at the top (the `model-team-cards` section already exists in the code at line ~1017-1025 but only shows if at least one assignment exists — may need to always show "Your Team" with placeholder text for unassigned roles, per user's request to always show "who's assigned to them")

**Medium:**
- (a) Change "Your Own Outfit Photos" signup wording → something themed around "current outfits that fit the streetwear/traditional theme" + auto-upload to `inventory` table + auto-`assigned_model` to that model (touches `signUpNewModel`/`signUpExistingModel` upload logic and possibly a new helper to insert into `inventory`)
- (c) Add explanatory captions for "Final Stage Fits"/"Assigned Inventory" sections (small UI text addition in `openModelPanel`'s `invHTML` block, line ~650, and/or `showModelDashboard`'s `modelInv` block, line ~1027) — e.g. "Final Stage Fits = wardrobe items from inventory assigned to this model for the shoot"

**Low:**
- Consolidate duplicate `toArr()`/`parseJsonArray()` helpers into one (currently both exist and do the same thing)
- Consider deleting the stale `v2-fixed/` folder to prevent future version-confusion
- Line 986 in `showModelDashboard`: `const photos = model.photos || [];` is NOT wrapped in `toArr()` like its siblings — works currently because `normaliseModel()` is called upstream, but inconsistent and fragile; should be `toArr(model.photos)` for consistency/safety

---

## 13. NEXT SESSION STARTING POINT

The user is actively in a live debugging session and will likely return with DevTools "Computed" tab screenshots for the `.collapse-btn` element (Issue #3 — see Section 10, step 2 for exactly what to ask for if they haven't provided it yet). 

Start by:
1. Asking for (or reviewing) the Computed-tab color/font values for `.collapse-btn`
2. Also ask them to check the live `/styles.css` URL for `.collapse-btn` to rule out a deploy mismatch (we got burned by this exact pattern on Issue #2 — don't skip this check)
3. Once Issue #3 is resolved, the user explicitly said the next priorities are (b) the model-dashboard redesign, then (a) the signup wording/auto-upload change, then (c) captions

The user prefers very explicit "find this exact text, replace with this exact text, here's the line number" instructions — they've said multiple times they get confused by vague descriptions of where to make changes. Always quote exact strings to search for and exact replacement code blocks.

---

## 14. DO NOT REPEAT

- **Do NOT assume browser cache is the problem when live behavior ≠ source code.** A hard refresh does not bypass a stale Vercel deployment. Always check: (1) does the live served file (`/app.js`, `/styles.css` loaded directly via URL) actually contain the expected code, and (2) does the GitHub repo (source of truth for Vercel) have the correct code. If GitHub has it but the live site doesn't, the fix is to **redeploy on Vercel**, not to clear browser cache.
- **Do NOT reference `/v2-fixed/app.js` as a current source of truth** — it's a confirmed-abandoned rewrite from an earlier session that was never pushed/deployed. It only causes confusion when comparing line numbers/code against what the user actually has live.
- **Do NOT assume CSS custom property (`--variable`) values are wrong without checking `:root`.** We initially suspected `--brown-dark`/`--cream` might be too similar — they're not (`#5c3d2e` vs `#f5f0e8`, high contrast). Checked and ruled out.
- **Do NOT assume there are duplicate/conflicting CSS rules without actually searching the full file.** Searched `styles.css` fully for `.collapse-btn`/`.collapse-section`/`.collapse-arrow` — only one definition of each exists.
- **Do NOT tell the user to "leave it alone" regarding `model.photos || []` vs `toArr(model.photos)` ambiguity** — be explicit that `toArr()` should be used everywhere arrays from Supabase are consumed, for consistency, even if the current code happens to work without it in a specific spot due to upstream normalization.
- **When giving code-edit instructions to this user, always provide exact "find X / replace with Y" blocks with line numbers** — they've explicitly said vague descriptions confuse them and they will ask for clarification, costing a round-trip.

---

## 15. EXECUTIVE SUMMARY

This is a vanilla-JS + Supabase event-management app for a fashion show ("5 July") with no framework, deployed via GitHub→Vercel. This session fixed two major bugs: (1) the model detail panel wouldn't open due to Supabase returning array columns as JSON-text strings, crashing `.map()` calls — fixed by wrapping all array-field reads in a `toArr()` normalization helper across `openModelPanel` and `showModelDashboard`; and (2) inventory item clicks did nothing because Vercel was serving a stale build that didn't match the (correct) code in GitHub — fixed by triggering a manual redeploy. 

One bug remains unresolved: the collapsible photo-section buttons ("Face Photos"/"Outfit"/"Hair & Makeup Inspo") in the model detail panel render as blank bars — the DOM/HTML is confirmed correct (text node present, classes correct) and the CSS rule for `.collapse-btn` looks correct on static read (dark-brown text on cream background, no duplicates, correct CSS variables) — meaning the next step MUST be checking the DevTools **Computed** styles tab (not just Elements/DOM) to see what color/size is actually being resolved at runtime, and cross-checking whether the live-served `styles.css` matches the local copy (in case this is yet another stale-deployment issue like #2).

After Issue #3 is fixed, three deferred feature requests remain, in the user's stated priority order: (b) redesign the model's own dashboard into a centered/rounded/scrollable modal showing assigned staff, (a) change signup wording for "outfit photos" + auto-upload-to-inventory + auto-assign, and (c) add clarifying captions about what "Final Stage Fits"/"Assigned Inventory" means for staff viewers.

The user strongly prefers extremely explicit, copy-paste-ready instructions with exact line numbers and find/replace text blocks — vague guidance leads to confusion and wasted round-trips.
