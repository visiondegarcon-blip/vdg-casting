# VDG Casting Portal — Claude Handoff Document v2

> Written for the next Claude instance. Read this entire document before touching any file.
> This supersedes HANDOFF.md — it reflects the current state of the codebase as of June 2026.

---

## 1. Project Overview

### What It Is
A private web-based casting management portal for **VDG (Vision De Garçon)**, a Brisbane fashion/creative collective. Built entirely for one event: **July 5, 2026**.

### What It Does
- Models self-register, upload photos (face close-up, outfit inspo, hair inspo, makeup inspo, own outfits, current hairstyle), and fill in their details (sizes, availability, hair texture, cultural pieces, etc.)
- Staff (stylists, hair stylists, makeup artists) sign in and browse models assigned to their role, mark "Work With" / "Pending" / "Reject"
- Admin (Daniel) manages everything: assigns staff to models, tracks sign-up completion, manages inventory (physical clothing/accessories), adds internal notes/tags, assigns tasks to models, exports a CSV roster
- Models see their assigned team (with Instagram handles), their stage fit (inventory assigned to them), team notes, and a "Tasks to Complete" banner if the admin has assigned them outstanding tasks
- Admin can create custom questions that appear either as tasks or embedded directly in the signup/edit-details forms

### Who Uses It
| Role | Name(s) | What They Can Do |
|------|---------|-----------------|
| ADMIN | Daniel | Full access — assigns, tracks, manages, edits everything, manages tasks and custom questions |
| STYLIST | Daniel, Dee, Komi, Richelle | Browse models, claim for styling, view inventory |
| HAIR_STYLIST | Christie, Maria, Neza | Browse models, claim for hair, see hair details, view inventory |
| MAKEUP_ARTIST | Rebecca | Browse models, claim for makeup, view inventory |
| MODEL | All cast models | Register, upload photos, view profile + assigned team, complete tasks |

### Business Purpose
Replaces a Google Forms + spreadsheet workflow. All styling, hair, and makeup staff see every model's photos and details in one place, assignments are visible in real time, and Daniel has a single dashboard to track who has and hasn't completed sign-up. The task system means the admin can chase outstanding profile information without phone calls — models see it when they sign in.

---

## 2. Architecture & Structure

### Stack
**No framework. No build step. No bundler.** Pure vanilla JS + Supabase JS SDK loaded via CDN. Everything is in three files. This is intentional — single-event scope, tight timeline.

### Files
```
app vdg files/
├── index.html      — Single HTML file. All UI structure, forms, and overlays.
├── app.js          — All JavaScript (~2420 lines). Auth, data, rendering, uploads, DB calls.
├── styles.css      — All styling (~817 lines). CSS variables, components, responsive layout.
├── HANDOFF.md      — Original handoff (now outdated — use this file instead).
└── HANDOFFv2.md    — This file.
```

### Frontend Structure
- **Single page app** — all sections live in the DOM simultaneously, shown/hidden via `.hidden` CSS class
- **Major screens:** `#auth-screen`, `#admin-dashboard`, `#staff-dashboard`, `#model-dashboard`
- **Overlays:** `#model-panel-overlay` (model/staff detail panel), `#inv-modal-overlay` (add/edit inventory item), `#edit-details-overlay` (model self-edit), `#task-modal-overlay` (admin task assignment), `#task-panel-overlay` (model task completion), `#manage-tasks-overlay` (admin custom task management)
- **No routing** — state managed entirely in JS variables (`currentUser`, `allModels`, `activeTab`, `openModelData`, etc.)
- **Cache busting** — `app.js?v=N` in index.html. **CRITICAL: increment `v=N` on every deploy** or browsers serve stale JS. **Current version: v=12.**

### Backend: Supabase
- **Project URL:** `https://dyruvkzuasaiofkxdvid.supabase.co`
- **Anon key:** `sb_publishable_tKMXDxTa-uICYsBE3OUh7A_RsoGFhhf` (client-safe publishable key)
- **No RLS enabled** — intentional MVP decision. Internal trusted users only.
- **No Supabase Auth** — custom username/PIN system stored in DB tables

### Deployment
- **GitHub repo:** `visiondegarcon-blip/vdg-casting`, branch `portal-v2`
- **Vercel:** Auto-deploys from `portal-v2` on every push (~30 seconds)
- **Live URL:** `https://vdg-casting.vercel.app`
- **Deploy command:** `git push origin portal-v2`
- **No build step** — Vercel serves static files directly

---

## 3. Supabase Tables

### `model_profiles`
The core table. One row per model. Models do NOT have rows in `users` — they are entirely in this table.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid/int | Primary key |
| `full_name` | text | **Used as join key for inventory** — never change without also updating `inventory.assigned_model` |
| `username` | text | Login credential |
| `pin` | text | 4-digit plaintext PIN |
| `registered` | bool | True once signup form submitted |
| `approved` | bool | Admin approval flag |
| `profile_photo` | text | URL to profile photo in storage |
| `photos` | text[] | Outfit inspo / "base fits" photo URLs |
| `hair_photos` | text[] | Hair inspo photo URLs |
| `mua_photos` | text[] | Makeup inspo photo URLs |
| `face_photos` | text[] | Face close-up photo URLs |
| `outfit_photos` | text[] | Own outfit photo URLs (also auto-added to inventory) |
| `current_hair_photos` | text[] | Current hairstyle photo URLs |
| `assigned_stylist` | text | Staff name (matches `users.name`) |
| `assigned_hair` | text | Staff name |
| `assigned_makeup` | text | Staff name |
| `stylist_status` | text | 'working' / 'pending' / 'rejected' |
| `hair_status` | text | Same |
| `makeup_status` | text | Same |
| `checklist_outfit` | bool | Admin completion flag |
| `checklist_hair` | bool | Admin completion flag |
| `checklist_makeup` | bool | Admin completion flag |
| `needs_hair` | bool | False = hidden from hair team |
| `needs_makeup` | bool | False = hidden from makeup team |
| `signup_manually_complete` | bool | Admin toggle: marks model complete even without face photo |
| `signup_acknowledged` | bool | Admin dismissed model from "completed" sign-up tracker section (permanent) |
| `updated_at` | timestamptz | **AUTO-MANAGED by Supabase moddatetime trigger. NEVER write this from client code — it will throw a schema cache error.** |
| `tags` | text[] | Admin-applied tags |
| `notes` | text | Internal team notes (admin-only visible in panel) |
| `model_note` | text | Note from model to team |
| `hair_texture` | text | e.g. '4C' |
| `hair_length` | text | 'Short' / 'Medium' / 'Long' |
| `no_own_outfit` | bool | If true, auto-assigned to Daniel as stylist at signup |
| `tasks` | jsonb | Array of `{ key, note, done, assigned_at }` — admin-assigned tasks for model to complete |
| `custom_fields` | jsonb | Key-value store for custom task answers and official custom question answers |
| Standard detail fields | | `age`, `gender`, `height`, `top_size`, `jean_size`, `suburb`, `style`, `phone`, `instagram`, `free_5july`, `hair_ok`, `makeup_self`, `cultural_piece`, `cultural_desc`, `talent`, `talent_desc`, `agency`, `ethnicity` |

### `users`
Staff and admin accounts only. Models are NOT here.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | Primary key |
| `name` | text | Display name — must match entries in `STAFF_NAMES` constant in app.js |
| `role` | text | ADMIN / STYLIST / HAIR_STYLIST / MAKEUP_ARTIST |
| `username` | text | Login credential |
| `pin` | text | 4-digit plaintext PIN |
| `instagram` | text | Shown on team cards in model dashboard |

### `inventory`
Physical clothing and accessories for the show.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | Primary key |
| `name` | text | Item name |
| `category` | text | Top / Bottom / Outerwear / Accessory / Shoes / Full Look / Own Outfit |
| `size_qty` | text | Free text size |
| `assigned_model` | text | Full name string — matched against `model_profiles.full_name` (NOT a foreign key) |
| `photo_url` | text | URL to item photo |

**Critical:** Inventory assignment is by `full_name` string match. If a model's name ever changes, their inventory assignments silently break.

### `custom_tasks`
Admin-created question definitions. Can be either "tasks" (assigned on-demand) or "official" (appear in signup + edit-details forms).

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | Primary key |
| `key` | text | Unique slug (auto-generated from label) |
| `icon` | text | Emoji icon |
| `label` | text | Human-readable question text |
| `type` | text | 'text' / 'select' / 'boolselect' / 'photos' |
| `options` | text[] | For 'select' type — the choices |
| `placeholder` | text | For 'text' type |
| `max_photos` | int | For 'photos' type — upload limit |
| `is_official` | bool | If true: appears in signup form AND edit-details panel for ALL models. If false: task-only (admin assigns individually or in bulk) |

### Supabase Storage
- **Bucket:** `model-photos` (public)
- **Path format:** `{folder}/{subfolder}/{timestamp}_{random5chars}` — never uses the original filename (security hardening)
- Old photos accumulate when replaced — the DB URL pointer is overwritten but the old file remains in storage. This is intentional for MVP simplicity.
- When a model is deleted, the code attempts to delete their photos from storage (best-effort).
- When a photo is removed via Edit Details "× remove", the storage file IS deleted.

---

## 4. Key Constants & Global State

### `STAFF_NAMES` (top of app.js)
```js
const STAFF_NAMES = {
  STYLIST:       ["Daniel", "Dee", "Komi", "Richelle"],
  HAIR_STYLIST:  ["Christie", "Maria", "Neza"],
  MAKEUP_ARTIST: ["Rebecca"],
  ADMIN:         ["Daniel"]
};
```
This is the **canonical source** for role dropdowns. It ensures Daniel (whose DB role is ADMIN) also appears in the Stylist dropdown. Adding new staff requires editing this constant AND having them sign up via the app.

### `ROLE_FIELDS`
Maps role keys to their DB assignment and status fields. Used throughout to make staff-role-specific logic DRY:
```js
const ROLE_FIELDS = {
  STYLIST:       { status: 'stylist_status', assign: 'assigned_stylist', label: 'Stylist',       hasPending: false },
  HAIR_STYLIST:  { status: 'hair_status',    assign: 'assigned_hair',    label: 'Hair Stylist',  hasPending: true  },
  MAKEUP_ARTIST: { status: 'makeup_status',  assign: 'assigned_makeup',  label: 'Makeup Artist', hasPending: true  },
};
```

### Global State Variables
```js
let currentUser      = null;   // { id, name, role, username } — null when logged out
let allModels        = [];     // full model_profiles array, kept in sync with DB
let inventoryData    = [];     // full inventory array
let activeTab        = 'all'; // admin tab: 'all' | 'completed' | 'mymodels' | 'inventory' | 'team'
let staffTab         = 'all'; // staff tab: 'all' | 'mine' | 'inventory'
let openModelData    = null;  // the model currently open in the detail panel
let currentModelData = null;  // model logged in as MODEL role (used by Edit Details button)
let customTaskDefs   = [];    // loaded from custom_tasks table
let TASK_REGISTRY    = [...]; // BUILTIN_TASKS + mapped customTaskDefs — rebuilt on loadCustomTasks()
```

### `pendingFiles` Object
```js
const pendingFiles = {};
```
A staging area for file inputs. FileLists are immutable in JS, so newly picked files are appended to `pendingFiles[inputId]` (an array of File objects). Use `chosenFiles(inputId)` to get the current selection. Use `clearPendingFiles(...ids)` after upload. **Missing this pattern when adding new photo inputs will cause photos to be skipped on submit.**

### `window._panelModelId`
Set in `openModelPanel()` to the current panel's model ID. Read by `toggleSignupComplete()`. This works fine for single-panel use but would collide if multiple panels were ever open simultaneously.

---

## 5. User Workflows

### Model Sign-Up Flow
1. Model goes to app → **Sign Up** → role: **Model / Applicant**
2. Two paths:
   - **Existing model** (pre-added by admin or from Google Form): selects name from dropdown → uploads required face photo + optional photos → sets username + 4-digit PIN → submit
   - **New model**: clicks "I'm a new model" toggle → fills full form from scratch
3. On submit: `model_profiles` row is **updated** (existing) or **inserted** (new) with `registered: true, approved: true`
4. Own outfit photos are **auto-added to `inventory`** as "Own Outfit" items assigned to that model's full name
5. Model then signs in → sees their profile dashboard

### Model Re-Registration
A model can sign up again if something went wrong (e.g., username didn't save, photos didn't upload). `signUpExistingModel()` only blocks if a *different* profile already has that username. The row is updated with new credentials. **Tell a model with a failed signup: "Sign up again, select your name from the dropdown — your new username and PIN will overwrite the old ones."**

### Models Who Signed Up on Older App Versions (Important Context)
Several models — **Katt, Emmanuel, Jasmine, Kia, Yevin** — signed up on earlier versions of the app where certain fields (face photos, ethnicity, etc.) weren't being saved properly. Their `registered` flag may be false or their face photo missing. They can still sign in with their credentials if the username/PIN was saved. The admin can mark them as `signup_manually_complete` via the toggle in their model panel. Tasks assigned to them (including bulk assignments) will appear when they sign in.

### Staff Sign-In & Workflow
1. Sign up once (select role → select name → set username + PIN)
2. Sign in → filtered model grid:
   - Hair team: only sees `needs_hair: true` models
   - Makeup team: only sees `needs_makeup: true` models
   - Stylists: see all models
3. Click model → detail panel → mark "Work With" / "Pending" / "Reject"
4. "Work With" sets their `assigned_X` field to their name and is visible on model cards to all staff

### Admin (Daniel) — Full Workflow

#### Sign Up Tracker (top of All Models tab)
- ✅ **Completed** — registered + face photo uploaded, OR `signup_manually_complete`. Dismissable with ×.
- ⏳ **Not Signed Up Yet** — no face photo, not manually marked
- Clicking a tracker card opens the full model panel directly

#### Model Grid
- Full grid with inline assignment dropdowns (Stylist / Hair / MUA) per card
- Completion checklist per card (Outfit / Hair / Makeup)
- Search bar filters by name, Instagram, suburb
- Tabs: All / Completed / My Models (Daniel only) / Inventory / Team

#### Model Detail Panel (admin view)
In order from top to bottom:
1. Panel header: model name, Instagram handle, flag
2. **Signup toggle** (admin only): `signup_manually_complete` toggle + last-updated timestamp
3. Face Photos (collapsible)
4. Outfit Inspo / Pinterest (collapsible)
5. Hair and Makeup Info (collapsible) — hair texture, length, makeup status, current hairstyle, hair inspo, makeup inspo
6. Note from Model (if present)
7. Details grid (age, gender, size, etc.)
8. Talent / Cultural piece sections (if applicable)
9. Assignment dropdowns (Stylist / Hair / MUA)
10. Services Needed toggles (Needs Hair / Needs Makeup)
11. Completion Checklist (Outfit / Hair / Makeup)
12. Tags (add/remove)
13. Internal Notes (textarea, auto-saves on blur)
14. **Tasks section** — shows assigned tasks with status, remove button, admin answer preview
15. Reset PIN button
16. Delete Model button

#### Bulk Task Assignment
The "Assign Task to All" button at the top of the admin dashboard assigns the selected task(s) to **every model in `allModels`** — regardless of signup status. This was deliberately changed from an earlier version that restricted it to signup-complete models only.

### Model Dashboard (Post Login)
After signing in as a MODEL:
- Profile card with name, Instagram, flag, avatar
- **"Tasks to Complete" banner** — appears if any pending tasks; tap to open task panel
- Your Team section (assigned stylist, hair, makeup with their Instagram handles)
- Notes from Team (if any)
- Your Stage Fit (inventory items assigned to them; tappable to edit)
- Add More Photos section (quick upload for current hairstyle, fits, hair inspo, makeup inspo, own outfit)
- Uploaded photos sections (own outfit, fits, current hairstyle, hair inspo, makeup inspo)
- Edit Details button (opens `#edit-details-overlay`)

---

## 6. The Task System

### Overview
Admin assigns "tasks" to models — things the model needs to fill in themselves (uploading photos, selecting hair texture, entering their height, etc.). Models see a banner on sign-in; they complete the tasks in a dedicated panel. Tasks are stored as a JSON array in `model_profiles.tasks`.

### Task Data Structure
```js
// In model_profiles.tasks (JSONB array):
[
  { key: 'hair_texture', note: 'Please fill this in — it helps Christie plan your look', done: false, assigned_at: '2026-06-09T...' },
  { key: 'current_hair', note: '', done: true, assigned_at: '2026-06-09T...' },
]
```

### Built-in Task Types (`BUILTIN_TASKS`)
```
current_hair   — Upload current hairstyle photos  (field: current_hair_photos, max 3)
face           — Upload face close-up             (field: face_photos, max 1)
hair_inspo     — Upload hair inspo photos         (field: hair_photos, max 3)
mua_inspo      — Upload makeup inspo photos       (field: mua_photos, max 3)
fits           — Upload outfit inspo photos       (field: photos, max 3)
outfit         — Upload own outfit photos         (field: outfit_photos, max 3)
hair_texture   — Tell us your hair texture        (select, field: hair_texture)
hair_length    — Tell us your hair length         (select, field: hair_length)
makeup_self    — Can you do your own makeup?      (boolselect, field: makeup_self)
height         — Tell us your height              (text, field: height)
top_size       — Tell us your top size            (text, field: top_size)
jean_size      — Tell us your jean size           (text, field: jean_size)
```

### Custom Tasks (`custom_tasks` table)
Admin can create additional questions via "Manage Custom Questions" button. Two modes:
- `is_official: false` — Task-only: admin assigns via task modal. Answers stored in `model_profiles.custom_fields` JSONB under the custom task's `key`.
- `is_official: true` — Official: appears automatically in the signup form AND edit-details panel for ALL models (not just assigned). Also assignable as a task.

### Task Assignment Paths
- **Single model**: "+ Assign Task" button in the admin panel for that model → `openTaskModal('single', modelId)` → `submitTaskAssign()`
- **Bulk**: "Assign Task to All" button at top of admin dashboard → `openTaskModal('bulk')` → targets `allModels` (all models, no signup filter)

### Model Task Completion
- Model signs in → `pendingTasks(model)` counts incomplete tasks → shows banner with count
- Tap banner → `openModelTaskPanel()` renders each pending task as an input
- Model fills in answers → `submitModelTasks()` saves answers to `model_profiles` (direct fields for built-ins, `custom_fields` JSONB for custom tasks) and marks `done: true` in the tasks array

---

## 7. The Photo System

### Upload Helper: `uploadFiles(fileList, folder, subfolder, max)`
- Uploads to `model-photos` bucket
- Path: `{folder}/{subfolder}/{timestamp}_{random5}` — no original filename
- Returns array of public URLs
- Old file is NOT deleted when a URL is replaced (orphan accumulation is accepted for MVP)

### Removable File Pickers: `pendingFiles` system
New file inputs use a staging system instead of native FileLists:
- `pickFiles(inputId, max)` — appends to `pendingFiles[inputId]`, resets the input so you can pick the same file twice
- `removePendingFile(inputId, idx, max)` — removes a staged file
- `renderPendingPreviews(inputId, max)` — renders thumbnails with × buttons
- `chosenFiles(inputId)` — returns staged files (falls back to live `input.files`)
- `clearPendingFiles(...ids)` — clears after upload

### Photo Removal (existing saved photos)
In Edit Details panel — each saved photo has an × button. `removeExistingPhoto(field, url)`:
1. Removes the URL from the DB array
2. Deletes the underlying storage file
3. If it was an `outfit_photos` entry, also deletes the matching `inventory` row

---

## 8. Current State

### Fully Working
- Sign up: both existing-model and new-model flows
- Sign in: all roles (model, admin, all staff types)
- Re-registration (overwrite old credentials by signing up again)
- Model profile dashboard with team display, stage fit, notes, tasks banner, photo upload zones
- Edit Details panel (all fields + photo add + photo removal)
- Admin model grid with inline assignment dropdowns and completion checklist
- Staff model grid with role-based filtering (needs_hair, needs_makeup)
- Staff status system (Work With / Pending / Reject)
- Model detail panel — role-specific photo section ordering
- Signup tracker (completed / not yet, dismissable)
- Signup manually complete toggle (admin only, in panel header)
- Inventory management: add, edit, delete, assign to model, view photos
- Stage fit section in model panel and model dashboard (view + picker to add from inventory)
- Team panel (admin) with clickable staff cards showing their assigned models
- Manage Users (delete staff accounts from team tab)
- Reset model PIN (generates new random PIN, shows in alert)
- Delete model (removes profile + storage files + storage cleanup attempt)
- Export models CSV
- Signup badge on all model cards (all roles see it)
- My Models tab (Daniel only) — shows models assigned to him
- Task system: built-in + custom tasks, single-model + bulk assignment, model completion panel
- Custom task definitions: add/delete from admin panel
- Official custom questions: appear in signup + edit-details forms
- Assignment tags on model cards filtered by viewer role (admin sees all, staff sees only their own role's assignment)
- Staff panel shows team info (who else is assigned to this model)
- Photo removal (× button in Edit Details)
- Current hairstyle photo section (uploads and display)
- Back button: persistent nav for all logged-in users

### Known Limitations (Intentional MVP)
- No Supabase RLS — anyone with the anon key can read/write all tables
- PINs stored plaintext
- No session persistence — must sign in again after closing browser
- Old profile photos accumulate in storage when replaced
- Staff names hardcoded in `STAFF_NAMES` — adding new staff requires code change
- `inventory.assigned_model` is a name string, not a FK — model renames break it silently
- No pagination — loads all models at once (~50 models is fine)
- `signup_acknowledged` dismiss is permanent — no undo
- Editing "no own outfit" in Edit Details doesn't auto-update `assigned_stylist` (auto-assign only at initial signup)

### Partially Implemented / Edge Cases
- `deleteModel` attempts storage cleanup but doesn't clean up `current_hair_photos` in storage (only the 5 core photo arrays)
- `uploadMorePhotos` (quick upload on model dashboard) doesn't use the `pendingFiles` staging system — it uses `input.files` directly and doesn't check max limits per upload

---

## 9. Historical Context — All Significant Bugs Fixed

### Bug 1: Assuming `git commit` = Deployed
**What happened:** Claude said "pushed ✅" without running `git push`. User had to manually deploy.
**Rule:** Always run `git push origin portal-v2` after committing. Verify with `git log origin/portal-v2 --oneline -1`. Never say "deployed" without confirming the push actually ran.

---

### Bug 2: `updated_at` Schema Cache Error
**Error:** `Could not find the 'updated_at' column of 'model_profiles' in the schema cache`
**Cause:** `updated_at` is managed by a **Supabase moddatetime trigger**. It's effectively read-only from the client — PostgREST rejects explicit writes.
**Fix:** Removed `updated_at` from every `.update()` call. The trigger fires automatically when any other column changes.
**Rule going forward:** **NEVER include `updated_at` in any `.update()` payload.** The "Last updated" display in the admin panel is intentionally a model self-edit signal — admin actions (toggle, notes, tags, assignments) must NOT change it.

---

### Bug 3: `Edit Details` Button Broken After Login
**Cause:** The button's `onclick` used inline JSON with the model data embedded directly in HTML. On mobile, special characters in names/notes/photo URLs broke the attribute, crashing the click handler.
**Fix:** Added `currentModelData` global. Button now calls `openEditDetails(currentModelData)` — no data embedded in HTML.
**Rule:** Never embed complex objects in HTML onclick attributes. Use global state variables instead.

---

### Bug 4: `toArr()` Not Used on Photo Arrays
**Symptom:** `.map is not a function` errors when opening a model panel.
**Cause:** Supabase sometimes returns `text[]` columns as JSON-encoded strings rather than actual arrays. If code does `m.photos.map(...)` directly without `toArr()`, it crashes when the column is returned as a string.
**Fix:** All photo array access wrapped in `toArr()`.
**Rule:** **Always use `toArr(m.photos)`, `toArr(m.face_photos)`, etc.** Never access photo arrays directly. Missing `toArr()` in new code = certain crash on some data.

---

### Bug 5: MIME Validation Silent Failures
**Cause:** Added `file.type.startsWith('image/')` check. `file.type` can be empty string on some browsers/systems (especially drag-and-drop), causing files to be silently skipped with no user feedback.
**Fix:** Removed MIME check. Browser's `accept="image/*"` attribute provides sufficient protection.
**Rule:** Silent failures are worse than no validation for internal MVP. If you ever re-add MIME validation, it MUST show a visible toast error.

---

### Bug 6: Redundant Mini-Popup on Signup Tracker
**What happened:** Clicking a model in the signup tracker opened a small popup with a "Mark as Complete" button. Clicking the model name in that popup then opened the full panel. Two clicks instead of one, and duplicate functionality.
**Fix:** Removed `openTrackerDetail`/`closeTrackerDetail` functions entirely. Tracker clicks now go directly to `openModelPanel`. Signup toggle was moved into the full panel header, where it's always visible to admin for any model.

---

### Bug 7: Bulk Task Assign Only Targeted Signup-Complete Models
**What happened:** The "Assign Task to All" button was filtering with `allModels.filter(isSignupComplete)`. Models like Katt, Emmanuel, Jasmine, Kia, and Yevin (who signed up on older app versions with incomplete profiles) were silently skipped.
**Fix:** Changed `submitTaskAssign()` to use `const targets = allModels` — no filter. The modal subtitle was also updated to say "all X models" instead of "all X signed-up models".
**Context:** These specific models can still sign in. When they sign in, they'll see any tasks assigned to them. The task system is designed to work for models regardless of signup status — admin should be able to reach any model.

---

### Bug 8: Staff Model Panel Showed All Assignment Tags to All Staff
**What happened:** Model cards showed `Assigned to Daniel`, `Assigned to Christie`, `Assigned to Rebecca` to every staff member — hair stylists saw stylist assignments they didn't need, etc.
**Fix:** `modelCardHTML()` now checks `viewerRole`. Admin sees all three. Staff sees only their own role's assignment tag.

---

### Bug 9: Save Slowness / Wrong Row Matched
**Cause:** `saveEditDetails()` was doing a `.select()` fetch to re-read the row after updating, adding a round trip. Also had an ID mismatch where `editDetailsModelId` wasn't set correctly on re-open.
**Fix:** Used `.update(...).select()` — Supabase returns the updated row in the same call. Added explicit error handling when 0 rows are matched. Added `const { data: updateData, count }` check with a visible error if no row was updated.

---

### Bug 10: Photo Upload During Sign-Up Wiped Previous Photos (Parallel Upload Race)
**What happened:** `saveEditDetails()` fetched existing photo arrays, then uploaded new photos in parallel. If two different photo fields both read the same existing array before either wrote it, one would overwrite the other.
**Fix:** Fetch existing photo arrays **once** before the parallel upload block, then each field reads from that single snapshot (`currentModel?.[field]`).

---

## 10. Important Architecture Decisions

### Admin Toggle Doesn't Update `updated_at`
Deliberate. `updated_at` is a signal of **model self-activity** (when they last edited their profile). Admin toggle, notes, tags, assignments must not move this timestamp.

### `STAFF_NAMES` Is Hardcoded
Daniel is ADMIN in `users` but needs to appear in the STYLIST dropdown. `staffNamesFor(role)` returns from `STAFF_NAMES` first, then falls back to DB `staffUsers`. If you add new staff, add to both `STAFF_NAMES` AND have them sign up via the app.

### Inventory by Full Name String
`inventory.assigned_model` is the model's full name string. Simple for a fixed-roster single event. Renaming a model breaks their inventory links silently. This is accepted tech debt.

### Own Outfit → Auto Inventory
Outfit photos uploaded at signup or via Edit Details are auto-inserted as `inventory` rows (`category: 'Own Outfit'`, `assigned_model: full_name`). This gives stylists visibility without manual entry. When those photos are removed via Edit Details, the matching inventory row is also deleted.

### Model Panel Always Fetches Fresh from DB
`openModelPanel(id)` always does a fresh `select` from Supabase before rendering. This ensures staff see the latest model self-edits without a full page refresh. The `allModels` cache is kept in sync with the fresh data.

### Task Assign to All = No Signup Filter
The bulk task assignment intentionally has no signup-status gate. The design intent is that tasks should be assignable to any model, and they'll see them when they eventually sign in — even if their profile is incomplete from an older app version.

### Three Files Only
Don't split. The app has one concern per file. Splitting would add build complexity for zero functional benefit at this scope.

---

## 11. Known Risks

### 🔴 High: No RLS on Supabase
The anon key (visible in app.js source) can read or write all tables. Acceptable for a trusted internal event. Enable RLS before using beyond this event.

### 🔴 High: Plaintext PINs
PINs stored as plain text in both tables. Anyone with DB access can see all credentials.

### 🟡 Medium: `updated_at` Must Never Be Written
Covered in Historical Context. If you add any new `.update()` call, double-check it doesn't include `updated_at`. The error is not always obvious in development.

### 🟡 Medium: Inventory by Full Name
Renaming a model in `model_profiles.full_name` silently breaks all their inventory assignments and stage fit view. Never rename without also updating `inventory.assigned_model` in a DB migration.

### 🟡 Medium: Cache Version Must Be Bumped
`index.html` loads `app.js?v=12`. Forgetting to increment on deploy means browsers serve stale JS. **Current version: v=12.**

### 🟡 Medium: `customTaskDefs` and `TASK_REGISTRY` Must Be Loaded Before Use
`loadCustomTasks()` is called on admin dashboard load, staff dashboard load, and model dashboard load. If any code path accesses `TASK_REGISTRY` before this async call completes (e.g., opening a model panel from a direct link), custom task labels won't resolve. The task system handles this gracefully with `if (!customTaskDefs.length) await loadCustomTasks()` guards in key places.

### 🟡 Medium: No Session Persistence
`currentUser` is a JS variable only. Refreshing the page logs everyone out. For event day, brief them to stay on the tab.

### 🟢 Low: `window._panelModelId` Global
Used by the signup toggle. Fine for single-panel use. Would break if the UI ever allowed multiple panels open simultaneously.

### 🟢 Low: 80ms Timeout in Staff Panel Navigation
`closePanel(); setTimeout(()=>openModelPanel(...), 80)` — animation timing hack to let the close animation finish before opening a new panel. Fragile if CSS transitions change.

### 🟢 Low: `uploadMorePhotos` (model dashboard quick upload) Bypasses `pendingFiles`
Uses `input.files` directly. No max-file-count guard, no staged previews. Works fine but inconsistent with the rest of the upload system.

### 🟢 Low: `deleteModel` Doesn't Clean `current_hair_photos` from Storage
The storage cleanup array in `deleteModel()` doesn't include `current_hair_photos`. Those files will remain in the storage bucket after the model is deleted. Harmless but leaves orphans.

---

## 12. Recommended Next Steps

### Critical Before Event (July 5)
1. **Enable Supabase RLS** — Add policies: models can read/write own row; staff can read all, write limited fields; admin full access.
2. **Verify old-version models** — Check `model_profiles` for Katt, Emmanuel, Jasmine, Kia, Yevin. If they can sign in, great — just assign tasks and use the admin toggle if needed.
3. **Test on mobile** — Sign-up, photo upload, panel scroll, task completion, Edit Details on iOS Safari + Android Chrome.

### Security
4. **Hash PINs** — Use bcrypt or move to Supabase Auth.
5. **Move Supabase key** to an environment variable (currently hardcoded in app.js — fine now since it's a publishable anon key, but better practice).

### Quality of Life
6. **Session persistence** — Store `currentUser` in `sessionStorage` or `localStorage` (with logout-on-tab-close if preferred).
7. **Undo dismiss** — Currently `signup_acknowledged` is permanent.
8. **Storage cleanup on delete** — Fix `deleteModel()` to also clean up `current_hair_photos` paths.
9. **Staff name management** — Move `STAFF_NAMES` to DB or make it an admin-editable field rather than a code constant.
10. **Inventory FK** — Migrate `inventory.assigned_model` from name string to UUID foreign key after the event if the app is reused.

---

## Quick Reference

```
Live URL:         https://vdg-casting.vercel.app
GitHub:           visiondegarcon-blip/vdg-casting  (branch: portal-v2)
Deploy command:   git push origin portal-v2
Cache version:    v=12  (in index.html — increment on every deploy)
Supabase URL:     https://dyruvkzuasaiofkxdvid.supabase.co
Supabase key:     sb_publishable_tKMXDxTa-uICYsBE3OUh7A_RsoGFhhf
Admin login:      username: danielngabz  (ask Daniel for PIN)

app.js structure (approximate line ranges):
  1–65      Config, constants, global state
  66–180    Auth tabs, signup helpers, file picker system
  181–295   Upload helper (uploadFiles)
  296–480   Sign up flows (signUp, signUpExistingModel, signUpNewModel)
  481–530   Sign in, logout, data load functions
  531–750   Admin dashboard, tabs, renderAdminModels, signup tracker
  751–900   Model card HTML, checklist/assign/approve functions
  900–1175  Model detail panel (openModelPanel)
  1175–1280 Panel helpers, tags, notes, delete, PIN reset, CSV export
  1280–1360 Staff dashboard and filtering
  1360–1520 Inventory (render, open, add, update, delete)
  1520–1795 Edit Details panel (open, render, save)
  1796–1890 Model dashboard (showModelDashboard, uploadMorePhotos)
  1890–2110 Task system: registry, admin assign modal, admin tasks block
  2110–2295 Custom task management, model task completion
  2295–2421 Team panel, manage users, helpers (hideAll, toast, etc.)
```

---

*Last updated: June 9, 2026. App status: feature-complete, deployed, in active use pre-event.*
*Written to supersede HANDOFF.md — the original file is preserved for historical reference.*
