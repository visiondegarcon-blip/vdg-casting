// ═══════════════════════════════════════════════
// CONFIG
// ═══════════════════════════════════════════════
const SUPABASE_URL = "https://dyruvkzuasaiofkxdvid.supabase.co";
const SUPABASE_KEY = "sb_publishable_tKMXDxTa-uICYsBE3OUh7A_RsoGFhhf";
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const STAFF_NAMES = {
  STYLIST:       ["Daniel", "Dee", "Komi", "Richelle"],
  HAIR_STYLIST:  ["Christie", "Maria", "Neza"],
  MAKEUP_ARTIST: ["Rebecca"],
  ADMIN:         ["Daniel"]
};

const FLAG_MAP = {
  "Australian":"🇦🇺","Burundian":"🇧🇮","Cameroonian":"🇨🇲","Chinese":"🇨🇳",
  "Congolese":"🇨🇩","Ethiopian":"🇪🇹","Filipino":"🇵🇭","Ghanaian":"🇬🇭",
  "Indian":"🇮🇳","Indonesian":"🇮🇩","Ivorian":"🇨🇮","Jamaican":"🇯🇲",
  "Japanese":"🇯🇵","Kenyan":"🇰🇪","Korean":"🇰🇷","Lebanese":"🇱🇧",
  "Mozambican":"🇲🇿","Nigerian":"🇳🇬","Pakistani":"🇵🇰","Rwandan":"🇷🇼",
  "Samoan":"🇼🇸","Seychellois":"🇸🇨","Sierra Leonean":"🇸🇱","Somali":"🇸🇴",
  "South African":"🇿🇦","Sri Lankan":"🇱🇰","Sudanese":"🇸🇩","Swiss":"🇨🇭",
  "Tanzanian":"🇹🇿","Togolese":"🇹🇬","Tongan":"🇹🇴","Ugandan":"🇺🇬",
  "Vietnamese":"🇻🇳","Zimbabwean":"🇿🇼","African":"🌍","East Asian":"🌏",
  "Middle Eastern":"🌍","South Asian":"🌏","Polynesian / Pacific Islands":"🌊","Other":"🌍"
};
function getFlag(eth) { return FLAG_MAP[eth] || "🌍"; }
// Supabase sometimes returns array-type Postgres columns as JSON-encoded strings — normalize to a real array
function toArr(v) {
  if (Array.isArray(v)) return v;
  if (typeof v === 'string' && v.trim().startsWith('[')) {
    try { const p = JSON.parse(v); return Array.isArray(p) ? p : []; } catch { return []; }
  }
  return [];
}

function teamCard(role, name, staffByName) {
  if (!name) return `<div class="model-team-card"><div class="model-team-label">${role}</div><div class="model-team-name">Unassigned</div></div>`;
  const ig = staffByName[name];
  return `<div class="model-team-card"><div class="model-team-label">${role}</div><div class="model-team-name">${name}</div>${ig?`<div class="model-team-ig">@${ig}</div>`:''}</div>`;
}

// Map role → which status/assignment fields it controls
const ROLE_FIELDS = {
  STYLIST:       { status: 'stylist_status', assign: 'assigned_stylist', label: 'Stylist',       hasPending: false },
  HAIR_STYLIST:  { status: 'hair_status',    assign: 'assigned_hair',    label: 'Hair Stylist',  hasPending: true  },
  MAKEUP_ARTIST: { status: 'makeup_status',  assign: 'assigned_makeup',  label: 'Makeup Artist', hasPending: true  },
};

// ═══════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════
let currentUser      = null;
let allModels        = [];
let inventoryData    = [];
let activeTab        = 'all';
let staffTab         = 'all';
let openModelData    = null;
let isNewModel       = false;
let isNewStaff       = false;
let staffUsers       = [];
let currentModelData = null; // used by Edit Details panel
let editProfileFile  = null; // stores selected profile photo file until save

// ═══════════════════════════════════════════════
// AUTH TABS
// ═══════════════════════════════════════════════
function showTab(tab) {
  const isSignin = tab === 'signin';
  document.getElementById('signin-section').classList.toggle('hidden', !isSignin);
  document.getElementById('signup-section').classList.toggle('hidden', isSignin);
  document.querySelectorAll('.auth-tab').forEach((t,i) => t.classList.toggle('active', i===(isSignin?0:1)));
}

// ═══════════════════════════════════════════════
// SIGNUP HELPERS
// ═══════════════════════════════════════════════
function showExistingModelExtras() {
  const val = document.getElementById('signup-name').value;
  document.getElementById('existing-model-extras').classList.toggle('hidden', !val);
}

function markUploaded(inputId, statusId) {
  const inp = document.getElementById(inputId);
  const st  = document.getElementById(statusId);
  if (inp && inp.files.length && st) st.textContent = `✓ ${inp.files.length} selected`;
}

// Limit a file input to max N files; warn if exceeded
function limitFiles(input, max) {
  if (input.files.length > max) {
    toast(`Max ${max} photos — only the first ${max} will be used`, true);
  }
}

function previewExistingProfile(input) {
  const file = input.files[0]; if (!file) return;
  const r = new FileReader();
  r.onload = e => { const p=document.getElementById('existing-profile-preview'); p.innerHTML=`<img src="${e.target.result}" style="width:100%;height:100%;object-fit:cover;border-radius:50%"/>`; p.appendChild(input); };
  r.readAsDataURL(file);
}
function previewProfile(input) {
  const file = input.files[0]; if (!file) return;
  const r = new FileReader();
  r.onload = e => { const p=document.getElementById('profile-preview'); p.innerHTML=`<img src="${e.target.result}" style="width:100%;height:100%;object-fit:cover;border-radius:50%"/>`; p.appendChild(input); };
  r.readAsDataURL(file);
}
function previewInvPhoto(input) {
  const file = input.files[0]; if (!file) return;
  const r = new FileReader();
  r.onload = e => { const p=document.getElementById('inv-photo-preview'); p.innerHTML=`<img src="${e.target.result}" alt=""/>`; p.appendChild(input); };
  r.readAsDataURL(file);
}

// Toggle hair length button selection
function selectHairLength(groupId, val, btn) {
  document.querySelectorAll(`#${groupId} .btn-group-option`).forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById(groupId + '-val').value = val;
}

// ═══════════════════════════════════════════════
// LOAD NAMES ON ROLE SELECT
// ═══════════════════════════════════════════════
async function loadSignupNames() {
  const role = document.getElementById('signup-role').value;
  const modelFlow = document.getElementById('model-signup-flow');
  const staffFlow = document.getElementById('staff-signup-flow');
  const credGroup = document.getElementById('signup-credentials-group');
  const btn       = document.getElementById('signup-btn');

  modelFlow.classList.add('hidden');
  staffFlow.classList.add('hidden');
  credGroup.classList.add('hidden');
  btn.classList.add('hidden');
  document.getElementById('signup-error').textContent = '';

  if (!role) return;

  if (role === 'MODEL') {
    modelFlow.classList.remove('hidden');
    credGroup.classList.remove('hidden');
    btn.classList.remove('hidden');
    const { data } = await sb.from('model_profiles').select('id,full_name').eq('registered',false).order('full_name');
    const sel = document.getElementById('signup-name');
    sel.innerHTML = '<option value="">— choose your name —</option>';
    (data||[]).forEach(m => { sel.innerHTML += `<option value="${m.id}">${m.full_name}</option>`; });
    document.getElementById('existing-model-extras').classList.add('hidden');
    return;
  }

  staffFlow.classList.remove('hidden');
  credGroup.classList.remove('hidden');
  btn.classList.remove('hidden');
  const names = STAFF_NAMES[role]||[];
  const staffSel = document.getElementById('signup-name-staff');
  staffSel.innerHTML = '<option value="">— choose your name —</option>';
  names.forEach(n => { staffSel.innerHTML += `<option value="${n}">${n}</option>`; });
  isNewStaff = false;
  document.getElementById('new-staff-section').classList.add('hidden');
  document.getElementById('existing-staff-section').classList.remove('hidden');
  document.getElementById('signup-name-staff-new').value = '';
  const toggle = document.querySelector('#staff-signup-flow .new-model-toggle');
  if (toggle) {
    toggle.style.cssText='';
    toggle.querySelector('.new-model-toggle-text').style.color='';
    toggle.querySelector('.new-model-toggle-sub').style.color='';
    toggle.querySelector('.new-model-toggle-icon').textContent='✨';
  }
}

function toggleNewModel() {
  isNewModel = !isNewModel;
  document.getElementById('new-model-form').classList.toggle('hidden', !isNewModel);
  document.getElementById('existing-model-section').classList.toggle('hidden', isNewModel);
  const toggle = document.querySelector('.new-model-toggle');
  if (isNewModel) {
    toggle.style.background='var(--brown)'; toggle.style.borderColor='var(--brown)';
    toggle.querySelector('.new-model-toggle-text').style.color='white';
    toggle.querySelector('.new-model-toggle-sub').style.color='rgba(255,255,255,.7)';
    toggle.querySelector('.new-model-toggle-icon').textContent='✓';
  } else {
    toggle.style.cssText='';
    toggle.querySelector('.new-model-toggle-text').style.color='';
    toggle.querySelector('.new-model-toggle-sub').style.color='';
    toggle.querySelector('.new-model-toggle-icon').textContent='✨';
  }
}

function toggleNewStaff() {
  isNewStaff = !isNewStaff;
  document.getElementById('new-staff-section').classList.toggle('hidden', !isNewStaff);
  document.getElementById('existing-staff-section').classList.toggle('hidden', isNewStaff);
  const toggle = document.querySelector('#staff-signup-flow .new-model-toggle');
  if (isNewStaff) {
    toggle.style.background='var(--brown)'; toggle.style.borderColor='var(--brown)';
    toggle.querySelector('.new-model-toggle-text').style.color='white';
    toggle.querySelector('.new-model-toggle-sub').style.color='rgba(255,255,255,.7)';
    toggle.querySelector('.new-model-toggle-icon').textContent='✓';
  } else {
    toggle.style.cssText='';
    toggle.querySelector('.new-model-toggle-text').style.color='';
    toggle.querySelector('.new-model-toggle-sub').style.color='';
    toggle.querySelector('.new-model-toggle-icon').textContent='✨';
  }
}

// ═══════════════════════════════════════════════
// UPLOAD HELPER — returns array of public URLs
// ═══════════════════════════════════════════════
async function uploadFiles(fileList, folder, subfolder, max) {
  const urls = [];
  let files = Array.from(fileList);
  if (max && files.length > max) files = files.slice(0, max);
  for (const file of files) {
    // Generate safe path without original filename to prevent path traversal
    const path = `${folder}/${subfolder}/${Date.now()}_${Math.random().toString(36).slice(2,7)}`;
    const { error } = await sb.storage.from('model-photos').upload(path, file, { upsert: true });
    if (!error) {
      const { data } = sb.storage.from('model-photos').getPublicUrl(path);
      urls.push(data.publicUrl);
    } else {
      console.error('Upload error:', error);
    }
  }
  return urls;
}

// ═══════════════════════════════════════════════
// SIGN UP
// ═══════════════════════════════════════════════
async function signUp() {
  const role     = document.getElementById('signup-role').value;
  const username = document.getElementById('signup-username').value.trim().toLowerCase();
  const pin      = document.getElementById('signup-pin').value.trim();
  document.getElementById('signup-error').textContent = '';

  if (!role)     { showError('signup-error','Select your role.'); return; }
  if (!username) { showError('signup-error','Choose a username.'); return; }
  if (pin.length !== 4 || isNaN(Number(pin))) { showError('signup-error','PIN must be exactly 4 digits.'); return; }

  const btn = document.getElementById('signup-btn');
  btn.textContent = 'Creating…'; btn.disabled = true;

  try {
    if (role === 'MODEL') {
      if (isNewModel) { await signUpNewModel(username, pin); }
      else            { await signUpExistingModel(username, pin); }
      return;
    }
    const nameVal = isNewStaff
      ? document.getElementById('signup-name-staff-new').value.trim()
      : document.getElementById('signup-name-staff').value;
    if (!nameVal) { showError('signup-error', isNewStaff ? 'Enter your name.' : 'Select your name.'); return; }
    const instagram = document.getElementById('signup-staff-instagram').value.trim().replace(/^@/,'');
    const { data:ex } = await sb.from('users').select('id').eq('username',username).maybeSingle();
    if (ex) { showError('signup-error','Username already taken.'); return; }
    const { error } = await sb.from('users').insert({ name:nameVal, role, username, pin, instagram });
    if (error) { showError('signup-error',error.message); return; }
    toast('Account created! Sign in now.');
    showTab('signin');
  } finally {
    btn.textContent = 'Create Account'; btn.disabled = false;
  }
}

async function signUpExistingModel(username, pin) {
  const nameVal = document.getElementById('signup-name').value;
  if (!nameVal) { showError('signup-error','Select your name.'); return; }
  // Face photo is required
  const faceInp = document.getElementById('ex-face');
  if (!faceInp || !faceInp.files[0]) {
    showError('signup-error','Please upload your face close-up photo — it\'s required to complete sign-up.');
    faceInp?.scrollIntoView({ behavior:'smooth', block:'center' });
    return;
  }
  // Allow re-signup: only block if username is taken by a DIFFERENT profile
  const { data:ex } = await sb.from('model_profiles').select('id').eq('username',username).maybeSingle();
  if (ex && String(ex.id) !== String(nameVal)) { showError('signup-error','Username already taken.'); return; }

  showError('signup-error','Uploading photos, please wait…');

  // Profile photo
  let profileUrl = '';
  const profInput = document.getElementById('existing-profile-input');
  if (profInput && profInput.files[0]) {
    const u = await uploadFiles([profInput.files[0]], nameVal, 'profile');
    if (u.length) profileUrl = u[0];
  }
  // Fit / hair / mua / outfit (max 3 each)
  const faceUrls   = await uploadFiles(document.getElementById('ex-face').files,   nameVal, 'face', 1);
  const fitUrls    = await uploadFiles(document.getElementById('ex-fit').files,    nameVal, 'fit', 3);
  const hairUrls   = await uploadFiles(document.getElementById('ex-hair').files,   nameVal, 'hair', 3);
  const muaUrls    = await uploadFiles(document.getElementById('ex-mua').files,    nameVal, 'mua', 3);
  const outfitUrls = await uploadFiles(document.getElementById('ex-outfit').files, nameVal, 'outfit', 3);

  const ethnicity   = document.getElementById('existing-ethnicity')?.value || '';
  const note        = document.getElementById('ex-note')?.value.trim() || '';
  const hairTexture = document.getElementById('ex-hair-texture')?.value || '';
  const hairLength  = document.getElementById('ex-hair-length-group-val')?.value || '';
  const noOwnOutfit = document.getElementById('ex-no-own-outfit')?.checked || false;

  const updates = { username, pin, registered:true, approved:true, photos:fitUrls, hair_photos:hairUrls, mua_photos:muaUrls, outfit_photos:outfitUrls, face_photos:faceUrls, model_note:note, needs_hair:true, needs_makeup:true, no_own_outfit:noOwnOutfit };
  if (profileUrl)  updates.profile_photo  = profileUrl;
  if (ethnicity)   updates.ethnicity      = ethnicity;
  if (hairTexture) updates.hair_texture   = hairTexture;
  if (hairLength)  updates.hair_length    = hairLength;
  if (noOwnOutfit) updates.assigned_stylist = 'Daniel';

  const { error } = await sb.from('model_profiles').update(updates).eq('id', nameVal);
  if (error) { showError('signup-error',error.message); return; }
  // Use full name (not ID) so inventory items match model lookup by full_name
  const sel = document.getElementById('signup-name');
  const modelFullName = sel.options[sel.selectedIndex]?.text || String(nameVal);
  if (outfitUrls.length) await addOutfitsToInventory(outfitUrls, modelFullName);
  document.getElementById('signup-error').textContent = '';
  toast('Account created! Sign in now.');
  showTab('signin');
}

// Auto-add a model's "own outfit" signup photos as assigned inventory items under their name
async function addOutfitsToInventory(urls, modelName) {
  const rows = urls.map((url,i)=>({ name:`${modelName} – Own Outfit ${i+1}`, category:'Own Outfit', size_qty:'', assigned_model:modelName, photo_url:url }));
  await sb.from('inventory').insert(rows);
}

async function signUpNewModel(username, pin) {
  const fullName = document.getElementById('new-full-name').value.trim();
  if (!fullName) { showError('signup-error','Enter your full name.'); return; }
  // Face photo is required
  const faceInp = document.getElementById('new-face1');
  if (!faceInp || !faceInp.files[0]) {
    showError('signup-error','Please upload your face close-up photo — it\'s required to complete sign-up.');
    faceInp?.scrollIntoView({ behavior:'smooth', block:'center' });
    return;
  }
  const { data:ex } = await sb.from('model_profiles').select('id').eq('username',username).maybeSingle();
  if (ex) { showError('signup-error','Username already taken.'); return; }

  showError('signup-error','Uploading photos, please wait…');
  const folder = 'new_' + Date.now();

  let profileUrl = '';
  const profInput = document.getElementById('profile-photo-input');
  if (profInput && profInput.files[0]) {
    const u = await uploadFiles([profInput.files[0]], folder, 'profile');
    if (u.length) profileUrl = u[0];
  }
  const faceUrls = [];
  const f1 = document.getElementById('new-face1');
  if (f1 && f1.files[0]) { const u = await uploadFiles([f1.files[0]], folder, 'face', 1); faceUrls.push(...u); }
  const fitUrls    = await uploadFiles(document.getElementById('new-fit').files,         folder, 'fit', 3);
  const hairUrls   = await uploadFiles(document.getElementById('new-hair-photos').files, folder, 'hair', 3);
  const muaUrls    = await uploadFiles(document.getElementById('new-mua-photos').files,  folder, 'mua', 3);
  const outfitUrls = await uploadFiles(document.getElementById('new-outfit').files,      folder, 'outfit', 3);

  const culturalVal = document.getElementById('new-cultural').value; // 'no' | 'have' | 'try'

  const payload = {
    full_name:     fullName,
    instagram:     document.getElementById('new-instagram').value.trim(),
    phone:         document.getElementById('new-phone').value.trim(),
    age:           parseInt(document.getElementById('new-age').value)||null,
    gender:        document.getElementById('new-gender').value,
    ethnicity:     document.getElementById('new-ethnicity').value,
    height:        document.getElementById('new-height').value.trim(),
    top_size:      document.getElementById('new-top').value,
    jean_size:     document.getElementById('new-jeans').value.trim(),
    suburb:        document.getElementById('new-suburb').value.trim(),
    style:         document.getElementById('new-style').value.trim(),
    cultural_piece:culturalVal,
    cultural_desc: document.getElementById('new-cultural-desc').value.trim(),
    talent:        document.getElementById('new-talent').value==='true',
    talent_desc:   document.getElementById('new-talent-desc').value.trim(),
    free_5july:    document.getElementById('new-free').value==='true',
    hair_ok:       document.getElementById('new-hair-ok').value==='true',
    makeup_self:   document.getElementById('new-makeup-self').value==='true' ? true : document.getElementById('new-makeup-self').value==='false' ? false : null,
    hair_texture:  document.getElementById('new-hair-texture')?.value || null,
    hair_length:   document.getElementById('new-hair-length-group-val')?.value || null,
    no_own_outfit: document.getElementById('new-no-own-outfit')?.checked || false,
    assigned_stylist: document.getElementById('new-no-own-outfit')?.checked ? 'Daniel' : null,
    agency:        document.getElementById('new-agency').value,
    model_note:    document.getElementById('new-note').value.trim(),
    username, pin, registered:true, approved:true,
    profile_photo: profileUrl, face_photos:faceUrls,
    photos:fitUrls, hair_photos:hairUrls, mua_photos:muaUrls, outfit_photos:outfitUrls,
    tags:[], notes:'',
    needs_hair:true, needs_makeup:true,
    checklist_outfit:false, checklist_hair:false, checklist_makeup:false,
  };

  const { error } = await sb.from('model_profiles').insert(payload);
  if (error) { showError('signup-error',error.message); return; }
  if (outfitUrls.length) await addOutfitsToInventory(outfitUrls, fullName);
  document.getElementById('signup-error').textContent = '';
  toast('Account created! Sign in now.');
  showTab('signin');
}

// ═══════════════════════════════════════════════
// SIGN IN
// ═══════════════════════════════════════════════
async function signIn() {
  const username = document.getElementById('signin-username').value.trim().toLowerCase();
  const pin      = document.getElementById('signin-pin').value.trim();
  document.getElementById('signin-error').textContent = '';
  if (!username||!pin) { showError('signin-error','Enter your username and PIN.'); return; }

  const { data:model } = await sb.from('model_profiles').select('*').eq('username',username).maybeSingle();
  if (model) {
    if (model.pin !== pin) { showError('signin-error','Incorrect PIN.'); return; }
    currentUser = { id:model.id, name:model.full_name, role:'MODEL', username };
    showModelDashboard(model);
    return;
  }
  const { data:user } = await sb.from('users').select('*').eq('username',username).maybeSingle();
  if (!user) { showError('signin-error','Username not found.'); return; }
  if (user.pin !== pin) { showError('signin-error','Incorrect PIN.'); return; }
  currentUser = { id:user.id, name:user.name, role:user.role, username };
  if (user.role==='ADMIN') showAdminDashboard();
  else showStaffDashboard(user);
}

function logout() {
  currentUser=null; allModels=[];
  document.querySelectorAll('.dashboard').forEach(d=>d.classList.add('hidden'));
  document.getElementById('auth-screen').classList.remove('hidden');
  document.getElementById('panel-back-btn')?.classList.add('hidden');
  document.getElementById('signin-username').value='';
  document.getElementById('signin-pin').value='';
  document.body.style.overflow = '';
}

// ═══════════════════════════════════════════════
// LOAD DATA
// ═══════════════════════════════════════════════
async function loadAllModels() {
  const { data } = await sb.from('model_profiles').select('*').order('full_name');
  allModels = data || [];
}
async function loadInventory() {
  const { data } = await sb.from('inventory').select('*').order('created_at',{ascending:false});
  inventoryData = data || [];
}
async function loadStaffUsers() {
  const { data } = await sb.from('users').select('name,role,instagram').neq('role','ADMIN').order('name');
  staffUsers = data || [];
}
function staffNamesFor(role) {
  // Use STAFF_NAMES as the canonical list — this ensures admins with dual roles
  // (e.g. Daniel who is ADMIN but also a STYLIST) always appear in dropdowns.
  // Fall back to DB staffUsers if a role isn't in STAFF_NAMES.
  const canonical = STAFF_NAMES[role];
  if (canonical && canonical.length) return canonical;
  return staffUsers.filter(s=>s.role===role).map(s=>s.name);
}

// ═══════════════════════════════════════════════
// ADMIN DASHBOARD
// ═══════════════════════════════════════════════
async function showAdminDashboard() {
  hideAll();
  document.getElementById('admin-dashboard').classList.remove('hidden');
  document.getElementById('admin-name-display').textContent = currentUser.name;
  document.getElementById('panel-back-btn')?.classList.remove('hidden');
  // Show "My Models" tab only for Daniel
  const myModelsTab = document.getElementById('tab-my-models');
  if (myModelsTab) myModelsTab.classList.toggle('hidden', currentUser?.name !== 'Daniel');
  await loadAllModels();
  await loadInventory();
  await loadStaffUsers();
  renderAdminModels();
}

function adminNav(page, btn) {
  document.querySelectorAll('#admin-dashboard .nav-item').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('admin-models-panel').classList.remove('hidden');
  const titles = { models:'All Models', team:'Team' };
  document.getElementById('admin-page-title').textContent = titles[page]||'';
  if (page === 'models') {
    document.getElementById('model-search').style.display = '';
    // reset to All tab
    const allBtn = document.querySelector('#admin-models-panel .tab-btn');
    if (allBtn) setAdminTab(allBtn, 'all');
  } else if (page === 'team') {
    document.getElementById('model-search').style.display = 'none';
    const teamBtn = document.getElementById('tab-team');
    if (teamBtn) setAdminTab(teamBtn, 'team');
  }
}

async function setAdminTab(btn, tab) {
  activeTab = tab;
  document.querySelectorAll('#admin-models-panel .tab-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  const modelsContent = document.getElementById('models-tab-content');
  const invContent    = document.getElementById('inventory-tab-content');
  const teamContent   = document.getElementById('team-tab-content');
  const searchEl      = document.getElementById('model-search');

  // hide all tab bodies first
  [modelsContent, invContent, teamContent].forEach(el => el?.classList.add('hidden'));

  if (tab === 'inventory') {
    invContent.classList.remove('hidden');
    if (searchEl) searchEl.style.display = 'none';
    await loadInventory();
    renderInventoryGrid('inv-grid','inv-count',true);
  } else if (tab === 'team') {
    teamContent.classList.remove('hidden');
    if (searchEl) searchEl.style.display = 'none';
    await loadStaffUsers();
    renderTeam();
  } else {
    // 'all', 'completed', 'mymodels'
    modelsContent.classList.remove('hidden');
    if (searchEl) searchEl.style.display = '';
    await loadAllModels();
    renderAdminModels(document.getElementById('model-search')?.value||'');
  }
}

function isCompleted(m) { return m.checklist_outfit && m.checklist_hair && m.checklist_makeup; }

function renderAdminModels(search) {
  let list = allModels;
  if (search) {
    const q = search.toLowerCase();
    list = list.filter(m=>(m.full_name||'').toLowerCase().includes(q)||(m.instagram||'').toLowerCase().includes(q)||(m.suburb||'').toLowerCase().includes(q));
  }
  if (activeTab==='completed') list = list.filter(m=>isCompleted(m));
  if (activeTab==='mymodels') list = list.filter(m=>m.assigned_stylist===currentUser?.name);
  // Sign Up Tracker only on All tab
  if (activeTab === 'all') {
    renderSignedUpPanel();
  } else {
    const p = document.getElementById('signed-up-panel');
    if (p) p.innerHTML = '';
  }
  // Daniel panel removed — use the My Models tab instead
  const dp = document.getElementById('daniel-panel');
  if (dp) dp.innerHTML = '';
  const grid = document.getElementById('admin-model-grid');
  if (!grid) return;
  grid.innerHTML = list.length ? list.map(m=>modelCardHTML(m,'ADMIN')).join('') : '<div class="loading-center" style="grid-column:1/-1">No models here</div>';
}

function renderSignedUpPanel() {
  const panel = document.getElementById('signed-up-panel');
  if (!panel) return;

  // "Completed" = went through signup form AND uploaded face photo, OR admin manually marked complete
  const completed = allModels.filter(m => ((m.registered && toArr(m.face_photos).length > 0) || m.signup_manually_complete) && !m.signup_acknowledged);
  // "Not yet" = never registered, missing face photo, AND not manually marked
  const notYet    = allModels.filter(m => (!m.registered || toArr(m.face_photos).length === 0) && !m.signup_manually_complete);

  if (!completed.length && !notYet.length) { panel.innerHTML = ''; return; }

  const makeCard = (m, dismissable) => {
    const initials = (m.full_name||'??').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
    const avatar   = m.profile_photo ? `<img src="${m.profile_photo}" alt=""/>` : initials;
    const xBtn     = dismissable ? `<button class="signed-up-dismiss" onclick="event.stopPropagation();dismissSignup('${m.id}')" title="Dismiss">×</button>` : '';
    const clickFn  = `openModelPanel('${m.id}')`;
    return `<div class="signed-up-card" onclick="${clickFn}">
      ${xBtn}
      <div class="signed-up-avatar">${avatar}</div>
      <div class="signed-up-name">${(m.full_name||'—').split(' ')[0]}</div>
    </div>`;
  };

  const completedHTML = completed.length ? `
    <div style="margin-bottom:20px">
      <div class="panel-section-title" style="margin-bottom:10px">✅ Completed Sign Up <span style="font-weight:400;color:var(--dim);font-size:10px">${completed.length}</span></div>
      <p style="font-size:11px;color:var(--dim);font-family:var(--font-mono);margin:0 0 12px">Submitted the form and uploaded a face photo — tap × to dismiss once you've reviewed their profile.</p>
      <div class="signed-up-grid">${completed.map(m => makeCard(m, true)).join('')}</div>
    </div>` : '';

  const notYetHTML = notYet.length ? `
    <div>
      <div class="panel-section-title" style="margin-bottom:10px">⏳ Not Signed Up Yet <span style="font-weight:400;color:var(--dim);font-size:10px">${notYet.length}</span></div>
      <p style="font-size:11px;color:var(--dim);font-family:var(--font-mono);margin:0 0 12px">Haven't completed sign up — tap a model to view details and mark as complete if they've finished via Edit Details.</p>
      <div class="signed-up-grid">${notYet.map(m => makeCard(m, false)).join('')}</div>
    </div>` : '';

  panel.innerHTML = `
    <div class="collapse-section open" style="margin-bottom:24px">
      <button class="collapse-btn" onclick="toggleCollapse(this)">
        📋 Sign Up Tracker
        <span style="font-size:10px;font-family:var(--font-mono);opacity:.7;margin-left:6px;font-weight:400;text-transform:none;letter-spacing:0">${completed.length} done · ${notYet.length} pending</span>
        <span class="collapse-arrow">▾</span>
      </button>
      <div class="collapse-body">
        ${completedHTML}
        ${notYetHTML}
      </div>
    </div>`;
}


window.toggleSignupComplete = async function toggleSignupComplete(id, checkbox) {
  const newState = checkbox.checked;
  checkbox.disabled = true;
  const { error } = await sb.from('model_profiles').update({ signup_manually_complete: newState }).eq('id', id);
  if (error) {
    toast(error.message, true);
    checkbox.checked = !newState;
    checkbox.disabled = false;
    return;
  }
  const m = allModels.find(x => String(x.id) === String(id));
  if (m) m.signup_manually_complete = newState;
  checkbox.disabled = false;

  // Update the panel header label live (but not last-updated — that only changes when model edits)
  const lbl = document.getElementById('panel-signup-toggle-label');
  if (lbl) lbl.textContent = newState ? 'Signed Up' : 'Not Signed Up';

  renderSignedUpPanel();
  toast(newState ? 'Marked as complete ✓' : 'Marked as pending ✓');
}

// Daniel's "My Models" — only renders when currentUser is Daniel, shows no_own_outfit models
function renderDanielPanel() {
  const panel = document.getElementById('daniel-panel');
  if (!panel) return;
  if (currentUser?.name !== 'Daniel') { panel.innerHTML = ''; return; }

  const myModels = allModels.filter(m => m.assigned_stylist === 'Daniel');
  if (!myModels.length) { panel.innerHTML = ''; return; }

  const makeCard = (m) => {
    const initials = (m.full_name||'??').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
    const avatar   = m.profile_photo ? `<img src="${m.profile_photo}" alt=""/>` : initials;
    return `<div class="signed-up-card" onclick="openModelPanel('${m.id}')">
      <div class="signed-up-avatar">${avatar}</div>
      <div class="signed-up-name">${(m.full_name||'—').split(' ')[0]}</div>
    </div>`;
  };

  panel.innerHTML = `
    <div class="collapse-section open" style="margin-bottom:24px">
      <button class="collapse-btn" onclick="toggleCollapse(this)">
        📌 My Models — No Own Fits
        <span style="font-size:10px;font-family:var(--font-mono);opacity:.7;margin-left:6px;font-weight:400;text-transform:none;letter-spacing:0">${myModels.length} model${myModels.length!==1?'s':''}</span>
        <span class="collapse-arrow">▾</span>
      </button>
      <div class="collapse-body">
        <p style="font-size:11px;color:var(--dim);font-family:var(--font-mono);margin:0 0 12px">Models assigned to you as stylist — either auto-assigned (no foundation fits) or manually assigned from the grid below.</p>
        <div class="signed-up-grid">${myModels.map(m => makeCard(m)).join('')}</div>
      </div>
    </div>`;
}

async function dismissSignup(id) {
  const { error } = await sb.from('model_profiles').update({ signup_acknowledged: true }).eq('id', id);
  if (error) { toast(error.message, true); return; }
  const m = allModels.find(x=>String(x.id)===String(id));
  if (m) m.signup_acknowledged = true;
  renderSignedUpPanel();
  toast('Dismissed ✓');
}

function filterModels(val) { if (activeTab!=='inventory') renderAdminModels(val); }

// ═══════════════════════════════════════════════
// MODEL CARD
// ═══════════════════════════════════════════════
function modelCardHTML(m, viewerRole) {
  const initials = (m.full_name||'??').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
  const avatar   = m.profile_photo ? `<img src="${m.profile_photo}" alt=""/>` : initials;
  const flag     = getFlag(m.ethnicity);
  const isAdmin  = viewerRole === 'ADMIN';

  // Status pill for staff views
  let statusPill = '';
  if (!isAdmin) {
    const rf = ROLE_FIELDS[viewerRole];
    const taken = m[rf.assign];
    if (taken) statusPill = `<span class="badge badge-brown">Taken by ${taken}</span>`;
  }

  // Assignment tags — shown so staff can see at a glance who's already on a model
  const assignedTags = [m.assigned_stylist, m.assigned_hair, m.assigned_makeup]
    .filter((v,i,a)=>v && a.indexOf(v)===i)
    .map(name=>`<span class="badge badge-brown">Assigned to ${name}</span>`).join('');

  const genderBadge = m.gender ? `<span class="badge ${m.gender==='Male'?'badge-blue':'badge-pink'}">${m.gender}</span>` : '';
  const igBadge     = m.instagram ? `<span class="badge badge-outline">@${m.instagram}</span>` : '';
  const ethBadge    = m.ethnicity ? `<span class="badge badge-outline">${flag} ${m.ethnicity}</span>` : '';
  const isSignupComplete = (m.registered && toArr(m.face_photos).length > 0) || m.signup_manually_complete;
  const signupBadge = isSignupComplete
    ? `<span class="badge badge-green">✓ Signed Up</span>`
    : `<span class="badge badge-outline" style="color:#b45309;border-color:#f6d28b;background:#fffbeb">⏳ Not Signed Up</span>`;

  const adminFooter = isAdmin ? `
    <div class="card-footer">
      <select class="assign-select" onchange="assignField('${m.id}','assigned_stylist',this.value);event.stopPropagation()">
        <option value="">Stylist…</option>
        ${staffNamesFor('STYLIST').map(s=>`<option value="${s}"${m.assigned_stylist===s?' selected':''}>${s}</option>`).join('')}
      </select>
      <select class="assign-select" onchange="assignField('${m.id}','assigned_hair',this.value);event.stopPropagation()">
        <option value="">Hair…</option>
        ${staffNamesFor('HAIR_STYLIST').map(s=>`<option value="${s}"${m.assigned_hair===s?' selected':''}>${s}</option>`).join('')}
      </select>
      <select class="assign-select" onchange="assignField('${m.id}','assigned_makeup',this.value);event.stopPropagation()">
        <option value="">MUA…</option>
        ${staffNamesFor('MAKEUP_ARTIST').map(s=>`<option value="${s}"${m.assigned_makeup===s?' selected':''}>${s}</option>`).join('')}
      </select>
    </div>` : '';

  const checklist = isAdmin ? `
    <div class="checklist" onclick="event.stopPropagation()">
      <div class="check-item${m.checklist_outfit?' checked':''}" onclick="toggleChecklist('${m.id}','checklist_outfit',${!m.checklist_outfit})"><span>${m.checklist_outfit?'✓':'○'}</span> Outfit</div>
      <div class="check-item${m.checklist_hair?' checked':''}" onclick="toggleChecklist('${m.id}','checklist_hair',${!m.checklist_hair})"><span>${m.checklist_hair?'✓':'○'}</span> Hair</div>
      <div class="check-item${m.checklist_makeup?' checked':''}" onclick="toggleChecklist('${m.id}','checklist_makeup',${!m.checklist_makeup})"><span>${m.checklist_makeup?'✓':'○'}</span> Makeup</div>
    </div>` : '';

  return `
    <div class="model-card${m.approved?' approved':''}" onclick="openModelPanel('${m.id}')">
      <div class="card-top">
        <div class="card-avatar">${avatar}</div>
        <div class="card-name-block">
          <div class="card-name">${m.full_name||'—'} <span style="font-size:16px">${flag}</span></div>
          <div class="card-handle">${m.instagram?'@'+m.instagram:'—'}</div>
        </div>
        <div class="card-badges"></div>
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:10px">
        ${genderBadge}
        ${igBadge}
        ${ethBadge}
        ${assignedTags}
        ${statusPill}
        ${signupBadge}
      </div>
      <div class="card-details">
        <div class="card-row"><span>Size</span><span>Top ${m.top_size||'—'} · Jean ${m.jean_size||'—'}</span></div>
        <div class="card-row"><span>Height</span><span>${m.height||'—'}</span></div>
        <div class="card-row"><span>Suburb</span><span>${m.suburb||'—'}</span></div>
      </div>
      ${checklist}
      ${adminFooter}
    </div>`;
}

// ═══════════════════════════════════════════════
// CHECKLIST / ASSIGN / APPROVE
// ═══════════════════════════════════════════════
async function toggleChecklist(id, field, value) {
  await sb.from('model_profiles').update({[field]:value}).eq('id',id);
  const m = allModels.find(x=>String(x.id)===String(id));
  if (m) m[field]=value;
  refreshCurrentView();
  toast(value?'Marked complete ✓':'Unchecked');
}
async function toggleNeeds(id, field, value) {
  await sb.from('model_profiles').update({[field]:value}).eq('id',id);
  const m = allModels.find(x=>String(x.id)===String(id));
  if (m) m[field]=value;
  refreshCurrentView();
  toast(field==='needs_hair'?(value?'Hair team will see this model':'Hidden from hair team'):(value?'Makeup team will see this model':'Hidden from makeup team'));
}
async function assignField(id, field, value) {
  await sb.from('model_profiles').update({[field]:value}).eq('id',id);
  const m = allModels.find(x=>String(x.id)===String(id));
  if (m) m[field]=value;
  toast('Saved');
}
async function assignInventoryToModel(itemId, modelName, panelModelId) {
  const { error } = await sb.from('inventory').update({ assigned_model: modelName }).eq('id', itemId);
  if (error) { toast(error.message, true); return; }
  const item = inventoryData.find(x=>String(x.id)===String(itemId));
  if (item) item.assigned_model = modelName;
  toast(modelName ? `Added to ${modelName.split(' ')[0]}'s stage fit` : 'Removed from stage fit');
  if (!document.getElementById('inventory-tab-content')?.classList.contains('hidden')) renderInventoryGrid('inv-grid','inv-count',true);
  if (!document.getElementById('staff-inventory-content')?.classList.contains('hidden')) renderInventoryGrid('staff-inv-grid','staff-inv-count',false);
  if (panelModelId) await openModelPanel(panelModelId);
}
async function toggleApprove(id) {
  const m = allModels.find(x=>String(x.id)===String(id));
  if (!m) return;
  const newVal = !m.approved;
  await sb.from('model_profiles').update({approved:newVal}).eq('id',id);
  m.approved=newVal;
  refreshCurrentView();
  toast((m.full_name||'Model').split(' ')[0]+' '+(newVal?'approved ✓':'unapproved'));
}

// ═══════════════════════════════════════════════
// STATUS (work with / pending / reject) — staff only
// ═══════════════════════════════════════════════
async function setStatus(id, status) {
  if (!currentUser) return;
  const rf = ROLE_FIELDS[currentUser.role];
  if (!rf) return;
  const m = allModels.find(x=>String(x.id)===String(id));
  if (!m) return;

  const updates = {};
  updates[rf.status] = status;
  // "working" also assigns them to this staff member (shared visibility)
  if (status === 'working') updates[rf.assign] = currentUser.name;
  else if (m[rf.assign] === currentUser.name) updates[rf.assign] = null; // release if they back out
  await sb.from('model_profiles').update(updates).eq('id', id);
  Object.assign(m, updates);
  openModelPanel(id); // refresh panel
  refreshCurrentView();
  toast(status==='working'?'Added to My Models ✓':status==='pending'?'Marked pending':'Rejected');
}

// ═══════════════════════════════════════════════
// MODEL DETAIL PANEL
// ═══════════════════════════════════════════════
async function openModelPanel(id) {
  // Always fetch fresh from DB so staff see latest model self-edits immediately
  const { data: freshData } = await sb.from('model_profiles').select('*').eq('id', id).maybeSingle();
  let m = freshData;
  if (m) {
    // Keep allModels cache in sync
    const idx = allModels.findIndex(x => String(x.id) === String(id));
    if (idx !== -1) allModels[idx] = m; else allModels.push(m);
  } else {
    m = allModels.find(x => String(x.id) === String(id));
  }
  if (!m) { toast('Could not load model', true); return; }
  openModelData = m;

  const flag    = getFlag(m.ethnicity);
  document.getElementById('panel-name').textContent   = m.full_name||'—';
  document.getElementById('panel-handle').textContent = m.instagram?'@'+m.instagram:'';
  document.getElementById('panel-flag').textContent   = flag;

  const role    = currentUser?.role;
  const isAdmin = role==='ADMIN';
  const isHairOrMua = role==='HAIR_STYLIST' || role==='MAKEUP_ARTIST';
  const photos  = toArr(m.photos);
  const hairPh  = toArr(m.hair_photos);
  const muaPh   = toArr(m.mua_photos);
  const facePh  = toArr(m.face_photos);
  const tags    = toArr(m.tags);
  const modelInv = inventoryData.filter(i=>i.assigned_model===m.full_name);

  // ── Status action buttons (staff only) ──
  let statusHTML = '';
  if (role && ROLE_FIELDS[role]) {
    const rf = ROLE_FIELDS[role];
    const cur = m[rf.status];
    const workingCls = cur==='working' ? ' active-working' : '';
    const pendingCls = cur==='pending' ? ' active-pending' : '';
    const rejectCls  = cur==='rejected'? ' active-rejected': '';
    statusHTML = `
      <div>
        <div class="status-actions">
          <button class="status-btn${workingCls}" onclick="setStatus('${m.id}','working')">✓ Work With</button>
          ${rf.hasPending?`<button class="status-btn${pendingCls}" onclick="setStatus('${m.id}','pending')">◷ Pending</button>`:''}
          <button class="status-btn${rejectCls}" onclick="setStatus('${m.id}','rejected')">✕ Reject</button>
        </div>
      </div>`;
  }

  // ── Stage Fit (admin + staff): everything assigned to this model + picker to add more ──
  let stageFitSection = '';
  if (role && role !== 'MODEL') {
    const safeName = (m.full_name||'').replace(/'/g,"\\'");
    const assignedGrid = modelInv.length ? `<div class="stage-fit-grid">${modelInv.map(item=>`<div class="stage-fit-item">${item.photo_url?`<img src="${item.photo_url}"/>`:`<div style="aspect-ratio:3/4;background:var(--cream);display:flex;align-items:center;justify-content:center;font-size:28px">👕</div>`}<div class="stage-fit-label">${item.name||item.category}${item.size_qty?' · '+item.size_qty:''}</div></div>`).join('')}</div>` : '<div class="no-photos">Nothing assigned yet</div>';
    const pickRows = inventoryData.length ? inventoryData.map(item=>{
      const here = item.assigned_model === m.full_name;
      const elsewhere = item.assigned_model && !here;
      const safeAssign = here ? '' : safeName;
      return `<div class="stage-fit-pick-row">
        <div class="stage-fit-pick-info">
          <div class="stage-fit-pick-name">${item.name||item.category||'Unnamed'}</div>
          <div class="stage-fit-pick-meta">${item.category||''}${item.size_qty?' · '+item.size_qty:''}${elsewhere?` · taken by ${item.assigned_model}`:''}</div>
        </div>
        <button class="btn btn-sm ${here?'btn-brown':'btn-ghost'}" style="width:auto" onclick="event.stopPropagation();assignInventoryToModel('${item.id}','${safeAssign}','${m.id}')">${here?'✓ Added':'+ Add'}</button>
      </div>`;
    }).join('') : '<div class="no-photos">No inventory items yet</div>';
    stageFitSection = `
      <div class="collapse-section">
        <button class="collapse-btn" onclick="toggleCollapse(this)">👕 Stage Fit <span class="collapse-arrow">▾</span></button>
        <div class="collapse-body">
          <div class="panel-section-title" style="margin-top:4px">Assigned to ${(m.full_name||'this model').split(' ')[0]}</div>
          <p style="font-size:11px;color:var(--dim);font-family:var(--font-mono);margin:-8px 0 12px">Everything currently in their stage fit — including pieces they uploaded themselves and items staff have assigned.</p>
          ${assignedGrid}
          <button class="btn btn-sm btn-blue" style="margin-top:14px" onclick="toggleInventoryPicker(this)">+ Add from Inventory</button>
          <div class="inv-picker-wrap" style="display:none;margin-top:12px">
            <p style="font-size:11px;color:var(--dim);font-family:var(--font-mono);margin:0 0 10px">Tap an item to assign it — other staff will see it's taken.</p>
            <div class="stage-fit-pick-list">${pickRows}</div>
          </div>
        </div>
      </div>`;
  }

  // ── Collapsible photo sections (Face / Hair+Makeup / Outfit) ──
  const outfitPh = toArr(m.outfit_photos);
  const photoGrid = (arr) => arr.length ? `<div class="photo-grid">${arr.map(u=>`<div class="photo-thumb"><img src="${u}"/></div>`).join('')}</div>` : '<div class="no-photos">None uploaded</div>';

  const faceSection = `
    <div class="collapse-section">
      <button class="collapse-btn" onclick="toggleCollapse(this)">👤 Face Photos <span class="collapse-arrow">▾</span></button>
      <div class="collapse-body">${photoGrid(facePh)}</div>
    </div>`;

  // Hair and Makeup info card (texture, length, makeup status)
  const makeupStatusTxt = m.makeup_self === true  ? '✓ Can do own makeup' :
                          m.makeup_self === false ? '✗ Needs a MUA' : '— Not specified';
  const makeupStatusCol = m.makeup_self === true  ? '#1a6640' :
                          m.makeup_self === false ? 'var(--red)' : 'var(--dim)';
  const hairInfoCard = `
    <div style="background:var(--cream);border-radius:var(--radius-sm);padding:12px 14px;margin-bottom:14px">
      <div style="display:flex;gap:24px;flex-wrap:wrap;margin-bottom:10px">
        <div>
          <div style="font-size:10px;color:var(--dim);font-family:var(--font-mono);text-transform:uppercase;letter-spacing:.08em;margin-bottom:3px">Hair Texture</div>
          <div style="font-size:16px;font-weight:600;letter-spacing:.02em">${m.hair_texture||'—'}</div>
        </div>
        <div>
          <div style="font-size:10px;color:var(--dim);font-family:var(--font-mono);text-transform:uppercase;letter-spacing:.08em;margin-bottom:3px">Hair Length</div>
          <div style="font-size:16px;font-weight:600;letter-spacing:.02em">${m.hair_length||'—'}</div>
        </div>
      </div>
      <div style="border-top:1px solid var(--border);padding-top:10px">
        <div style="font-size:10px;color:var(--dim);font-family:var(--font-mono);text-transform:uppercase;letter-spacing:.08em;margin-bottom:3px">Makeup</div>
        <div style="font-size:13px;font-weight:500;color:${makeupStatusCol}">${makeupStatusTxt}</div>
      </div>
    </div>`;

  const hairMuaSection = `
    <div class="collapse-section">
      <button class="collapse-btn" onclick="toggleCollapse(this)">💇 Hair and Make Up Info <span class="collapse-arrow">▾</span></button>
      <div class="collapse-body">
        ${hairInfoCard}
        <div class="panel-section-title" style="margin-top:4px">Hair Inspo</div>${photoGrid(hairPh)}
        <div class="panel-section-title" style="margin-top:16px">Makeup Inspo</div>${photoGrid(muaPh)}
      </div>
    </div>`;

  // Outfit Inspo = photos the model uploaded as Pinterest/inspo during signup (stored in `photos` field)
  // Foundation fits (outfitPh) live in Stage Fit via inventory — not duplicated here
  const outfitSection = `
    <div class="collapse-section">
      <button class="collapse-btn" onclick="toggleCollapse(this)">📸 Outfit Inspo / Pinterest <span class="collapse-arrow">▾</span></button>
      <div class="collapse-body">
        <div class="panel-section-title" style="margin-top:4px">Outfit Inspo Photos</div>${photoGrid(photos)}
      </div>
    </div>`;

  const noteBlock = m.model_note?`<div><div class="panel-section-title">Note from Model</div><div class="val" style="font-size:14px">${m.model_note}</div></div>`:'';

  // ── Details block ──
  const detailsBlock = `
    <div>
      <div class="panel-section-title">Details</div>
      <div class="detail-grid">
        <div class="detail-item"><label>Age</label><div class="val">${m.age||'—'}</div></div>
        <div class="detail-item"><label>Gender</label><div class="val">${m.gender||'—'}</div></div>
        <div class="detail-item"><label>Ethnicity</label><div class="val">${flag} ${m.ethnicity||'—'}</div></div>
        <div class="detail-item"><label>Height</label><div class="val">${m.height||'—'}</div></div>
        <div class="detail-item"><label>Hair Texture</label><div class="val">${m.hair_texture||'—'}</div></div>
        <div class="detail-item"><label>Hair Length</label><div class="val">${m.hair_length||'—'}</div></div>
        <div class="detail-item"><label>Top</label><div class="val">${m.top_size||'—'}</div></div>
        <div class="detail-item"><label>Jeans</label><div class="val">${m.jean_size||'—'}</div></div>
        <div class="detail-item"><label>Suburb</label><div class="val">${m.suburb||'—'}</div></div>
        ${isAdmin?`<div class="detail-item"><label>Phone</label><div class="val">${m.phone||'—'}</div></div>`:''}
        <div class="detail-item"><label>Free Jul 5</label><div class="val">${m.free_5july?'Yes':'⚠ Busy AM'}</div></div>
        <div class="detail-item"><label>Hair Change</label><div class="val">${m.hair_ok?'Yes':'No'}</div></div>
        <div class="detail-item"><label>Own Makeup</label><div class="val">${m.makeup_self===true?'Yes':m.makeup_self===false?'Needs MUA':'—'}</div></div>
        <div class="detail-item"><label>Style</label><div class="val">${m.style||'—'}</div></div>
      </div>
    </div>
    ${m.talent?`<div><div class="panel-section-title">Talent</div><div class="val">${m.talent_desc||'—'}</div></div>`:''}
    ${m.cultural_piece&&m.cultural_piece!=='no'&&m.cultural_piece!=='false'?`<div><div class="panel-section-title">Cultural Piece</div><div class="val">${m.cultural_piece==='try'?'Can try to get one':'Has access to one'}${m.cultural_desc?' — '+m.cultural_desc:''}</div></div>`:''}
  `;

  // ── Admin assignment block ──
  const adminBlock = isAdmin ? `
    <div>
      <div class="panel-section-title">Assignment</div>
      <div class="assign-grid">
        <div class="form-group" style="margin-bottom:0"><label>Stylist</label><div class="select-wrap"><select onchange="assignField('${m.id}','assigned_stylist',this.value)"><option value="">Unassigned</option>${staffNamesFor('STYLIST').map(s=>`<option value="${s}"${m.assigned_stylist===s?' selected':''}>${s}</option>`).join('')}</select></div></div>
        <div class="form-group" style="margin-bottom:0"><label>Hair</label><div class="select-wrap"><select onchange="assignField('${m.id}','assigned_hair',this.value)"><option value="">Unassigned</option>${staffNamesFor('HAIR_STYLIST').map(s=>`<option value="${s}"${m.assigned_hair===s?' selected':''}>${s}</option>`).join('')}</select></div></div>
        <div class="form-group" style="margin-bottom:0"><label>MUA</label><div class="select-wrap"><select onchange="assignField('${m.id}','assigned_makeup',this.value)"><option value="">Unassigned</option>${staffNamesFor('MAKEUP_ARTIST').map(s=>`<option value="${s}"${m.assigned_makeup===s?' selected':''}>${s}</option>`).join('')}</select></div></div>
      </div>
    </div>
    <div>
      <div class="panel-section-title">Services Needed</div>
      <div class="checklist">
        <div class="check-item${m.needs_hair!==false?' checked':''}" onclick="toggleNeeds('${m.id}','needs_hair',${!(m.needs_hair!==false)});openModelPanel('${m.id}')"><span>${m.needs_hair!==false?'✓':'○'}</span> Needs Hair</div>
        <div class="check-item${m.needs_makeup!==false?' checked':''}" onclick="toggleNeeds('${m.id}','needs_makeup',${!(m.needs_makeup!==false)});openModelPanel('${m.id}')"><span>${m.needs_makeup!==false?'✓':'○'}</span> Needs Makeup</div>
      </div>
      <div style="font-size:11px;color:var(--dim);font-family:var(--font-mono);margin-top:8px">Turn off to hide this model from the hair or makeup team.</div>
    </div>
    <div>
      <div class="panel-section-title">Completion Checklist</div>
      <div class="checklist">
        <div class="check-item${m.checklist_outfit?' checked':''}" onclick="toggleChecklist('${m.id}','checklist_outfit',${!m.checklist_outfit});openModelPanel('${m.id}')"><span>${m.checklist_outfit?'✓':'○'}</span> Outfit Completed</div>
        <div class="check-item${m.checklist_hair?' checked':''}" onclick="toggleChecklist('${m.id}','checklist_hair',${!m.checklist_hair});openModelPanel('${m.id}')"><span>${m.checklist_hair?'✓':'○'}</span> Hair Completed</div>
        <div class="check-item${m.checklist_makeup?' checked':''}" onclick="toggleChecklist('${m.id}','checklist_makeup',${!m.checklist_makeup});openModelPanel('${m.id}')"><span>${m.checklist_makeup?'✓':'○'}</span> Makeup Completed</div>
      </div>
    </div>
    <div>
      <div class="panel-section-title">Tags</div>
      <div class="tag-row"><input type="text" id="tag-input" maxlength="50" placeholder="Add tag…" onkeydown="if(event.key==='Enter')addPanelTag()"/><button class="btn btn-sm btn-brown" style="width:auto;margin-top:0" onclick="addPanelTag()">+</button></div>
      <div class="tags-wrap" id="panel-tags">${tags.map(t=>`<span class="tag-pill" onclick="removePanelTag('${t}')">${t}<span class="x"> ×</span></span>`).join('')}</div>
    </div>
    <div>
      <div class="panel-section-title">Internal Notes</div>
      <textarea class="notes-field" id="panel-notes" maxlength="2000" onblur="saveNotes()" placeholder="Team notes…">${m.notes||''}</textarea>
    </div>
    <div>
      <button class="btn btn-sm btn-ghost" onclick="resetModelPin('${m.id}','${(m.full_name||'').replace(/'/g,"\\'")}')">🔑 Reset PIN</button>
      <div style="font-size:11px;color:var(--dim);font-family:var(--font-mono);margin-top:8px">Generates a new 4-digit PIN for this model — give it to them so they can log back in.</div>
    </div>
    <div>
      <button class="btn btn-sm" style="background:var(--white);border:1.5px solid var(--red);color:var(--red)" onclick="deleteModel('${m.id}','${(m.full_name||'').replace(/'/g,"\\'")}')">🗑 Delete Model</button>
      <div style="font-size:11px;color:var(--dim);font-family:var(--font-mono);margin-top:8px">Permanently removes this model's profile and all uploaded photos. Cannot be undone.</div>
    </div>` : '';

  // ── ORDER per role — photo buttons ALWAYS first ──
  let body = '';
  if (statusHTML) body += statusHTML;
  if (stageFitSection) body += stageFitSection;

  if (role === 'HAIR_STYLIST') {
    body += hairMuaSection + faceSection + outfitSection + noteBlock + detailsBlock;
  } else if (role === 'MAKEUP_ARTIST') {
    body += hairMuaSection + faceSection + outfitSection + noteBlock + detailsBlock;
  } else if (role === 'STYLIST') {
    body += outfitSection + faceSection + hairMuaSection + noteBlock + detailsBlock;
  } else { // ADMIN
    body += faceSection + outfitSection + hairMuaSection + (m.model_note?noteBlock:'') + detailsBlock + adminBlock;
  }

  document.getElementById('panel-body').innerHTML = body;

  // ── Signup toggle row (admin only) ──
  const toggleRow = document.getElementById('panel-signup-toggle-row');
  if (toggleRow) {
    if (isAdmin) {
      window._panelModelId = String(m.id);
      const inp = document.getElementById('panel-signup-toggle-input');
      const lbl = document.getElementById('panel-signup-toggle-label');
      const upd = document.getElementById('panel-signup-toggle-lastupdate');
      const isComplete = !!(m.signup_manually_complete);
      if (inp) inp.checked = isComplete;
      if (lbl) lbl.textContent = isComplete ? 'Signed Up' : 'Not Signed Up';
      if (upd) {
        if (m.updated_at) {
          const d = new Date(m.updated_at);
          upd.textContent = 'Updated ' + d.toLocaleDateString('en-AU', { day:'numeric', month:'short', year:'numeric' })
            + ' at ' + d.toLocaleTimeString('en-AU', { hour:'2-digit', minute:'2-digit', hour12:true });
        } else {
          upd.textContent = 'Last updated: N/A';
        }
      }
      toggleRow.classList.remove('hidden');
    } else {
      toggleRow.classList.add('hidden');
    }
  }

  document.getElementById('model-panel-overlay').classList.remove('hidden');
  document.body.style.overflow='hidden';
}

// Toggle collapsible photo sections in the panel
function toggleCollapse(btn) {
  const sec = btn.parentElement;
  sec.classList.toggle('open');
}

// Toggle the "Add from Inventory" picker inside Stage Fit
function toggleInventoryPicker(btn) {
  const wrap = btn.nextElementSibling;
  const isHidden = wrap.style.display === 'none';
  wrap.style.display = isHidden ? 'block' : 'none';
  btn.textContent = isHidden ? '− Close Inventory' : '+ Add from Inventory';
}

function closePanel() {
  document.getElementById('model-panel-overlay').classList.add('hidden');
  // Back button stays visible — it's a persistent nav button for all logged-in users
  document.body.style.overflow='';
  openModelData=null;
}
function closeModelPanel(e) { if (e.target.id==='model-panel-overlay') closePanel(); }

async function addPanelTag() {
  if (!openModelData) return;
  const input=document.getElementById('tag-input'); const val=input.value.trim(); if(!val) return;
  const tags=[...(openModelData.tags||[])]; if(!tags.includes(val)) tags.push(val);
  await sb.from('model_profiles').update({tags}).eq('id',openModelData.id);
  openModelData.tags=tags;
  const m=allModels.find(x=>String(x.id)===String(openModelData.id)); if(m) m.tags=tags;
  input.value='';
  document.getElementById('panel-tags').innerHTML=tags.map(t=>`<span class="tag-pill" onclick="removePanelTag('${t}')">${t}<span class="x"> ×</span></span>`).join('');
  toast('Tag added');
}
async function removePanelTag(tag) {
  if (!openModelData) return;
  const tags=(openModelData.tags||[]).filter(t=>t!==tag);
  await sb.from('model_profiles').update({tags}).eq('id',openModelData.id);
  openModelData.tags=tags;
  const m=allModels.find(x=>String(x.id)===String(openModelData.id)); if(m) m.tags=tags;
  document.getElementById('panel-tags').innerHTML=tags.map(t=>`<span class="tag-pill" onclick="removePanelTag('${t}')">${t}<span class="x"> ×</span></span>`).join('');
}
async function saveNotes() {
  if (!openModelData) return;
  const notes=document.getElementById('panel-notes')?.value||'';
  await sb.from('model_profiles').update({notes}).eq('id',openModelData.id);
  openModelData.notes=notes;
  const m=allModels.find(x=>String(x.id)===String(openModelData.id)); if(m) m.notes=notes;
  toast('Notes saved');
}

// Permanently delete a model: removes their profile row first (so the dashboard is clean even if
// storage cleanup below fails), then best-effort deletes their uploaded photos from storage
async function deleteModel(id, name) {
  if (!confirm(`Permanently delete ${name||'this model'}? This removes their profile and all uploaded photos. This cannot be undone.`)) return;
  const m = allModels.find(x=>String(x.id)===String(id)) || openModelData;
  if (!m) return;
  const { error } = await sb.from('model_profiles').delete().eq('id', id);
  if (error) { toast(error.message, true); return; }
  const urls = [m.profile_photo, ...toArr(m.photos), ...toArr(m.hair_photos), ...toArr(m.mua_photos), ...toArr(m.outfit_photos), ...toArr(m.face_photos)].filter(Boolean);
  const marker = '/model-photos/';
  const paths = urls.map(u=>{ const i=u.indexOf(marker); return i>-1 ? u.slice(i+marker.length) : null; }).filter(Boolean);
  if (paths.length) await sb.storage.from('model-photos').remove(paths);
  allModels = allModels.filter(x=>String(x.id)!==String(id));
  closePanel();
  refreshCurrentView();
  toast(`${(name||'Model').split(' ')[0]} deleted`);
}

async function resetModelPin(id, name) {
  if (!confirm(`Generate a new PIN for ${name||'this model'}? Their old PIN will stop working.`)) return;
  const newPin = String(Math.floor(1000 + Math.random()*9000));
  const { error } = await sb.from('model_profiles').update({ pin: newPin }).eq('id', id);
  if (error) { toast(error.message, true); return; }
  const m = allModels.find(x=>String(x.id)===String(id));
  if (m) m.pin = newPin;
  if (openModelData && String(openModelData.id)===String(id)) openModelData.pin = newPin;
  alert(`New PIN for ${name||'this model'}: ${newPin}\n\nGive this to them so they can log back in.`);
  toast(`PIN reset for ${(name||'model').split(' ')[0]}`);
}

function csvEscape(v) {
  const s = (v===null||v===undefined) ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g,'""')}"` : s;
}
function exportModelsCSV() {
  if (!allModels.length) { toast('No models to export', true); return; }
  const cols = [
    ['full_name','Name'],['phone','Phone'],['instagram','Instagram'],['ethnicity','Ethnicity'],
    ['assigned_stylist','Stylist'],['assigned_hair','Hair'],['assigned_makeup','Makeup'],
    ['approved','Signed Up'],['checklist_outfit','Outfit Done'],['checklist_hair','Hair Done'],['checklist_makeup','Makeup Done'],
    ['notes','Notes']
  ];
  const header = cols.map(c=>c[1]).join(',');
  const rows = allModels.map(m => cols.map(c=>csvEscape(m[c[0]])).join(','));
  const csv = [header, ...rows].join('\n');
  const blob = new Blob([csv], { type:'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `vdg-models-${new Date().toISOString().slice(0,10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  toast('Model roster exported');
}

// ═══════════════════════════════════════════════
// STAFF DASHBOARD
// ═══════════════════════════════════════════════
async function showStaffDashboard(user) {
  hideAll();
  document.getElementById('staff-dashboard').classList.remove('hidden');
  document.getElementById('staff-name-display').textContent = user.name;
  document.getElementById('panel-back-btn')?.classList.remove('hidden');
  const labels = {STYLIST:'Stylist',HAIR_STYLIST:'Hair Stylist',MAKEUP_ARTIST:'Makeup Artist'};
  document.getElementById('staff-role-display').textContent = labels[user.role]||'Staff';
  // Inventory visible to all staff roles
  const invTab = document.getElementById('staff-inv-tab');
  if (invTab) invTab.style.display = '';
  await loadAllModels();
  await loadInventory();
  staffTab='all';
  renderStaffModels();
}

async function setStaffTab(btn, tab) {
  staffTab = tab;
  document.querySelectorAll('#staff-dashboard .tab-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  const modelsContent=document.getElementById('staff-models-content');
  const invContent=document.getElementById('staff-inventory-content');
  if (tab==='inventory') {
    modelsContent.classList.add('hidden');
    invContent.classList.remove('hidden');
    await loadInventory();
    renderInventoryGrid('staff-inv-grid','staff-inv-count',false);
  } else {
    modelsContent.classList.remove('hidden');
    invContent.classList.add('hidden');
    renderStaffModels();
  }
}

function renderStaffModels(search) {
  const role = currentUser?.role;
  const rf   = ROLE_FIELDS[role];
  let list = [...allModels];

  // Hair/Makeup only see models who need that service (default true if column missing)
  if (role==='HAIR_STYLIST')   list = list.filter(m => m.needs_hair !== false);
  if (role==='MAKEUP_ARTIST')  list = list.filter(m => m.needs_makeup !== false);

  if (staffTab==='mine') {
    list = list.filter(m=>m[rf.assign]===currentUser.name);
  }
  if (search) {
    const q=search.toLowerCase();
    list = list.filter(m=>(m.full_name||'').toLowerCase().includes(q)||(m.instagram||'').toLowerCase().includes(q));
  }
  const grid=document.getElementById('staff-model-grid');
  if (!grid) return;
  grid.innerHTML = list.length ? list.map(m=>modelCardHTML(m,role)).join('') : `<div class="loading-center">${staffTab==='mine'?'No models selected yet':'No models yet'}</div>`;
}
function filterStaffModels(val) { if (staffTab!=='inventory') renderStaffModels(val); }

function openStaffSearch() {
  const pill = document.getElementById('staff-search-pill');
  const input = document.getElementById('staff-search-input');
  if (!pill || !input) return;
  pill.classList.add('open');
  input.focus();
}
function closeStaffSearch() {
  const pill = document.getElementById('staff-search-pill');
  const input = document.getElementById('staff-search-input');
  if (!pill || !input) return;
  // keep open if there's a search value
  if (!input.value.trim()) {
    pill.classList.remove('open');
  }
}

// ═══════════════════════════════════════════════
// INVENTORY
// ═══════════════════════════════════════════════
function renderInventoryGrid(gridId, countId, isAdmin) {
  const count=document.getElementById(countId);
  if (count) count.textContent=inventoryData.length+' items';
  const grid=document.getElementById(gridId);
  if (!grid) return;
  grid.innerHTML = inventoryData.length
    ? inventoryData.map(item=>`
        <div class="inv-card" onclick="openInventoryPanel('${item.id}')" style="cursor:pointer">
          ${item.photo_url
            ? `<div class="inv-card-photo"><img src="${item.photo_url}" onerror="this.parentElement.innerHTML='👕'" alt=""/></div>`
            : `<div class="inv-card-no-photo">👕</div>`}
          <div class="inv-card-name">${item.name||item.category||'Unnamed'}</div>
          <div class="inv-card-meta">${item.category||''}${item.size_qty?' · '+item.size_qty:''}</div>
          ${item.assigned_model
            ? `<div class="inv-assigned">→ ${item.assigned_model}</div>`
            : `<div style="font-size:11px;color:var(--dim)">Unassigned</div>`}
        </div>`).join('')
    : `<div class="loading-center" style="background:var(--white);grid-column:1/-1;padding:40px;border-radius:var(--radius)">No items yet</div>`;
}

function openInventoryPanel(itemId) {
  const item = inventoryData.find(x=>String(x.id)===String(itemId));
  if (!item) { toast('Item not found',true); return; }

  // Reset and pre-fill the modal with existing item data
  document.getElementById('inv-name').value  = item.name||'';
  document.getElementById('inv-size').value  = item.size_qty||'';
  document.getElementById('inv-cat').value   = item.category||'Top';

  // Show existing photo
  const preview = document.getElementById('inv-photo-preview');
  if (item.photo_url) {
    preview.innerHTML = `<img src="${item.photo_url}" alt="" style="width:100%;height:100%;object-fit:cover"/>`;
  } else {
    preview.innerHTML = `<input type="file" id="inv-photo-input" accept="image/*" onchange="previewInvPhoto(this)" style="display:none"/>
      <div id="inv-photo-placeholder"><div style="font-size:28px;margin-bottom:6px">👕</div><div style="font-size:12px;color:var(--dim);font-family:var(--font-mono)">Tap to upload photo</div></div>`;
  }

  // Pre-select assigned model
  const sel = document.getElementById('inv-model-assign');
  sel.innerHTML = '<option value="">Unassigned</option>';
  if (currentUser?.role==='MODEL') {
    sel.innerHTML += `<option value="${currentUser.name}">${currentUser.name} (me)</option>`;
    sel.disabled = true;
  } else {
    sel.disabled = false;
    allModels.forEach(m=>{ sel.innerHTML+=`<option value="${m.full_name}"${item.assigned_model===m.full_name?' selected':''}>${m.full_name}</option>`; });
  }

  // Override save to UPDATE instead of INSERT
  const saveBtn = document.querySelector('#inv-modal-overlay .btn.btn-brown');
  if (saveBtn) {
    saveBtn.textContent = 'Save Changes';
    saveBtn.onclick = () => updateInvItem(item.id);
  }

  // Show delete button (only visible when editing an existing item)
  const delBtn = document.getElementById('inv-delete-btn');
  if (delBtn) {
    delBtn.classList.remove('hidden');
    delBtn.onclick = () => deleteInvItem(item.id);
  }

  document.getElementById('inv-modal-overlay').classList.remove('hidden');
}

async function updateInvItem(itemId) {
  const nameVal   = document.getElementById('inv-name').value.trim();
  const sizeVal   = document.getElementById('inv-size').value.trim();
  const catVal    = document.getElementById('inv-cat').value;
  const assignVal = document.getElementById('inv-model-assign').value;

  const updates = { name:nameVal, category:catVal, size_qty:sizeVal, assigned_model:assignVal };

  const photoInput = document.getElementById('inv-photo-input');
  if (photoInput && photoInput.files[0]) {
    const u = await uploadFiles([photoInput.files[0]],'inventory','items',1);
    if (u.length) updates.photo_url = u[0];
  }

  const { error } = await sb.from('inventory').update(updates).eq('id',itemId);
  if (error) { toast('Error: '+error.message,true); return; }
  toast('Saved ✓');
  document.getElementById('inv-modal-overlay').classList.add('hidden');

  // reset save button back to "Add Item" for next new item
  const saveBtn = document.querySelector('#inv-modal-overlay .btn.btn-brown');
  if (saveBtn) { saveBtn.textContent='Save Item'; saveBtn.onclick=saveInvItem; }

  await loadInventory();
  if (!document.getElementById('inventory-tab-content')?.classList.contains('hidden')) renderInventoryGrid('inv-grid','inv-count',true);
  if (!document.getElementById('staff-inventory-content')?.classList.contains('hidden')) renderInventoryGrid('staff-inv-grid','staff-inv-count',false);
}

function openInvModal() {
  document.getElementById('inv-name').value='';
  document.getElementById('inv-size').value='';
  document.getElementById('inv-photo-preview').innerHTML=`
    <input type="file" id="inv-photo-input" accept="image/*" onchange="previewInvPhoto(this)" style="display:none"/>
    <div id="inv-photo-placeholder"><div style="font-size:28px;margin-bottom:6px">👕</div><div style="font-size:12px;color:var(--dim);font-family:var(--font-mono)">Tap to upload photo</div></div>`;
  // Reset save button to Add mode
  const saveBtn = document.querySelector('#inv-modal-overlay .btn.btn-brown');
  if (saveBtn) { saveBtn.textContent='Save Item'; saveBtn.onclick=saveInvItem; }
  // Hide delete button for new items
  const delBtn = document.getElementById('inv-delete-btn');
  if (delBtn) delBtn.classList.add('hidden');
  const sel=document.getElementById('inv-model-assign');
  sel.innerHTML='<option value="">Unassigned</option>';
  if (currentUser?.role==='MODEL') {
    sel.innerHTML+=`<option value="${currentUser.name}" selected>${currentUser.name} (me)</option>`;
    sel.disabled=true;
  } else {
    sel.disabled=false;
    allModels.forEach(m=>{ sel.innerHTML+=`<option value="${m.full_name}">${m.full_name}</option>`; });
  }
  document.getElementById('inv-modal-overlay').classList.remove('hidden');
}
function closeInvModal(e) { if (e.target.id==='inv-modal-overlay') document.getElementById('inv-modal-overlay').classList.add('hidden'); }

async function saveInvItem() {
  const nameVal=document.getElementById('inv-name').value.trim();
  const sizeVal=document.getElementById('inv-size').value.trim();
  const catVal=document.getElementById('inv-cat').value;
  const assignVal=document.getElementById('inv-model-assign').value;
  const photoInput=document.getElementById('inv-photo-input');
  let photoUrl='';
  if (photoInput && photoInput.files[0]) {
    const u=await uploadFiles([photoInput.files[0]],'inventory','items');
    if (u.length) photoUrl=u[0];
  }
  if (!nameVal && !photoUrl) { toast('Add a photo or name',true); return; }
  const { error }=await sb.from('inventory').insert({name:nameVal,category:catVal,size_qty:sizeVal,assigned_model:assignVal,photo_url:photoUrl});
  if (error) { toast('Error: '+error.message,true); return; }
  toast('Item added ✓');
  document.getElementById('inv-modal-overlay').classList.add('hidden');
  await loadInventory();
  if (!document.getElementById('inventory-tab-content')?.classList.contains('hidden')) renderInventoryGrid('inv-grid','inv-count',true);
  if (!document.getElementById('staff-inventory-content')?.classList.contains('hidden')) renderInventoryGrid('staff-inv-grid','staff-inv-count',false);
}

// ═══════════════════════════════════════════════
// DELETE INVENTORY ITEM
// ═══════════════════════════════════════════════
async function deleteInvItem(itemId) {
  if (!confirm('Delete this item? This cannot be undone.')) return;
  const { error } = await sb.from('inventory').delete().eq('id', itemId);
  if (error) { toast('Error: ' + error.message, true); return; }
  toast('Item deleted');
  document.getElementById('inv-modal-overlay').classList.add('hidden');
  const delBtn = document.getElementById('inv-delete-btn');
  if (delBtn) delBtn.classList.add('hidden');
  const saveBtn = document.querySelector('#inv-modal-overlay .btn.btn-brown');
  if (saveBtn) { saveBtn.textContent='Save Item'; saveBtn.onclick=saveInvItem; }
  await loadInventory();
  if (!document.getElementById('inventory-tab-content')?.classList.contains('hidden')) renderInventoryGrid('inv-grid','inv-count',true);
  if (!document.getElementById('staff-inventory-content')?.classList.contains('hidden')) renderInventoryGrid('staff-inv-grid','staff-inv-count',false);
}

// ═══════════════════════════════════════════════
// EDIT DETAILS PANEL (model self-edit)
// ═══════════════════════════════════════════════
let editDetailsModelId = null;

function openEditDetails(model) {
  editDetailsModelId = model.id;
  editProfileFile = null; // reset any previously staged photo

  // Profile photo preview
  const prev = document.getElementById('edit-profile-preview');
  if (prev) {
    if (model.profile_photo) {
      prev.innerHTML = `<img src="${model.profile_photo}" style="width:100%;height:100%;object-fit:cover;border-radius:50%"/><input type="file" id="edit-profile-input" accept="image/*" onchange="previewEditProfile(this)" style="display:none"/>`;
    } else {
      prev.innerHTML = `📸<input type="file" id="edit-profile-input" accept="image/*" onchange="previewEditProfile(this)" style="display:none"/>`;
    }
  }

  // Populate all fields
  setVal('edit-instagram', model.instagram || '');
  setVal('edit-phone', model.phone || '');
  setVal('edit-age', model.age || '');
  setVal('edit-gender', model.gender || 'Male');
  setVal('edit-ethnicity', model.ethnicity || '');
  setVal('edit-height', model.height || '');
  setVal('edit-top-size', model.top_size || 'M');
  setVal('edit-jean-size', model.jean_size || '');
  setVal('edit-suburb', model.suburb || '');
  setVal('edit-style', model.style || '');
  setVal('edit-cultural', model.cultural_piece || 'no');
  setVal('edit-cultural-desc', model.cultural_desc || '');
  toggleEditCultural(model.cultural_piece || 'no');
  setVal('edit-talent', model.talent ? 'true' : 'false');
  setVal('edit-talent-desc', model.talent_desc || '');
  toggleEditTalent(model.talent ? 'true' : 'false');
  setVal('edit-free', model.free_5july !== false ? 'true' : 'false');
  setVal('edit-hair-ok', model.hair_ok !== false ? 'true' : 'false');
  setVal('edit-hair-texture', model.hair_texture || '');
  setVal('edit-makeup-self', model.makeup_self === true ? 'true' : model.makeup_self === false ? 'false' : 'skip');
  setVal('edit-agency', model.agency || 'no');
  setVal('edit-model-note', model.model_note || '');
  const noOutfit = document.getElementById('edit-no-own-outfit');
  if (noOutfit) noOutfit.checked = !!model.no_own_outfit;

  // Hair length button group
  const hlGroup = document.getElementById('edit-hair-length-group');
  const hlVal = document.getElementById('edit-hair-length-group-val');
  if (hlGroup && hlVal) {
    hlVal.value = model.hair_length || '';
    hlGroup.querySelectorAll('.btn-group-option').forEach(btn => {
      btn.classList.toggle('active', btn.textContent === model.hair_length);
    });
  }

  document.getElementById('edit-details-error').textContent = '';
  document.getElementById('edit-details-overlay').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeEditDetails() {
  document.getElementById('edit-details-overlay').classList.add('hidden');
  document.body.style.overflow = 'hidden'; // model dashboard keeps body locked
}

function toggleEditCultural(val) {
  document.getElementById('edit-cultural-desc-wrap')?.classList.toggle('hidden', val === 'no');
}
function toggleEditTalent(val) {
  document.getElementById('edit-talent-desc-wrap')?.classList.toggle('hidden', val !== 'true');
}

function setVal(id, val) {
  const el = document.getElementById(id);
  if (!el) return;
  el.value = val;
}

function previewEditProfile(input) {
  if (!input.files[0]) return;
  editProfileFile = input.files[0]; // save before innerHTML swap destroys the input
  const reader = new FileReader();
  reader.onload = e => {
    const prev = document.getElementById('edit-profile-preview');
    if (prev) prev.innerHTML = `<img src="${e.target.result}" style="width:100%;height:100%;object-fit:cover;border-radius:50%"/><input type="file" id="edit-profile-input" accept="image/*" onchange="previewEditProfile(this)" style="display:none"/>`;
  };
  reader.readAsDataURL(input.files[0]);
}

async function saveEditDetails() {
  if (!editDetailsModelId) return;
  const errEl  = document.getElementById('edit-details-error');
  const saveBtn = document.querySelector('.edit-details-footer .btn-brown');
  errEl.textContent = '';
  if (saveBtn) { saveBtn.textContent = 'Saving…'; saveBtn.disabled = true; }


  const updates = {
    instagram:     document.getElementById('edit-instagram').value.trim().replace(/^@/,''),
    phone:         document.getElementById('edit-phone').value.trim(),
    age:           parseInt(document.getElementById('edit-age').value) || null,
    gender:        document.getElementById('edit-gender').value,
    ethnicity:     document.getElementById('edit-ethnicity').value,
    height:        document.getElementById('edit-height').value.trim(),
    top_size:      document.getElementById('edit-top-size').value,
    jean_size:     document.getElementById('edit-jean-size').value.trim(),
    suburb:        document.getElementById('edit-suburb').value.trim(),
    style:         document.getElementById('edit-style').value.trim(),
    cultural_piece:document.getElementById('edit-cultural').value,
    cultural_desc: document.getElementById('edit-cultural-desc').value.trim(),
    talent:        document.getElementById('edit-talent').value === 'true',
    talent_desc:   document.getElementById('edit-talent-desc').value.trim(),
    free_5july:    document.getElementById('edit-free').value === 'true',
    hair_ok:       document.getElementById('edit-hair-ok').value === 'true',
    hair_texture:  document.getElementById('edit-hair-texture').value || null,
    hair_length:   document.getElementById('edit-hair-length-group-val').value || null,
    makeup_self:   document.getElementById('edit-makeup-self').value === 'true' ? true : document.getElementById('edit-makeup-self').value === 'false' ? false : null,
    agency:        document.getElementById('edit-agency').value,
    no_own_outfit: document.getElementById('edit-no-own-outfit').checked,
    model_note:    document.getElementById('edit-model-note').value.trim(),
  };

  // Upload new profile photo if selected (use saved file — innerHTML swap destroys the input)
  if (editProfileFile) {
    const u = await uploadFiles([editProfileFile], editDetailsModelId, 'profile');
    if (u.length) updates.profile_photo = u[0];
    editProfileFile = null;
  }

  // Only fetch current photo arrays if at least one photo input has files
  const photoFields = [
    { inputId: 'edit-face-upload',   field: 'face_photos',   statusId: 'edit-face-status',   folder: 'face',   max: 3 },
    { inputId: 'edit-fit-upload',    field: 'photos',        statusId: 'edit-fit-status',    folder: 'fit',    max: 3 },
    { inputId: 'edit-hair-upload',   field: 'hair_photos',   statusId: 'edit-hair-status',   folder: 'hair',   max: 3 },
    { inputId: 'edit-mua-upload',    field: 'mua_photos',    statusId: 'edit-mua-status',    folder: 'mua',    max: 3 },
    { inputId: 'edit-outfit-upload', field: 'outfit_photos', statusId: 'edit-outfit-status', folder: 'outfit', max: 3 },
  ];
  const hasNewPhotos = photoFields.some(({ inputId }) => {
    const el = document.getElementById(inputId);
    return el && el.files.length > 0;
  });

  if (hasNewPhotos) {
    // Fetch existing arrays once, then upload each field in parallel
    const { data: currentModel } = await sb.from('model_profiles')
      .select('face_photos,photos,hair_photos,mua_photos,outfit_photos')
      .eq('id', editDetailsModelId).single();

    const newOutfitUrls = []; // track newly uploaded outfit photos for inventory
    await Promise.all(photoFields.map(async ({ inputId, field, statusId, folder, max }) => {
      const input = document.getElementById(inputId);
      if (!input || !input.files.length) return;
      const uploaded = await uploadFiles(Array.from(input.files), editDetailsModelId, folder, max);
      if (uploaded.length) {
        updates[field] = [...toArr(currentModel?.[field]), ...uploaded];
        const statusEl = document.getElementById(statusId);
        if (statusEl) statusEl.textContent = `✓ ${uploaded.length} uploaded`;
        if (folder === 'outfit') newOutfitUrls.push(...uploaded);
      }
    }));

    // Auto-add outfit photos to inventory assigned to this model
    if (newOutfitUrls.length && currentModelData?.full_name) {
      const modelName = currentModelData.full_name;
      const existingCount = toArr(currentModel?.outfit_photos).length;
      const rows = newOutfitUrls.map((url, i) => ({
        name: `${modelName} – Own Outfit ${existingCount + i + 1}`,
        category: 'Own Outfit',
        size_qty: '',
        assigned_model: modelName,
        photo_url: url,
      }));
      await sb.from('inventory').insert(rows);
      // Refresh local inventory cache
      const { data: invData } = await sb.from('inventory').select('*').order('created_at', { ascending: false });
      if (invData) inventoryData = invData;
    }
  }

  const { error, data: updateData, count } = await sb.from('model_profiles')
    .update(updates)
    .eq('id', editDetailsModelId)
    .select();

  if (saveBtn) { saveBtn.textContent = 'Save Changes'; saveBtn.disabled = false; }

  if (error) { errEl.textContent = error.message; return; }
  if (!updateData || updateData.length === 0) {
    errEl.textContent = 'Save failed — no matching record found. Please sign out and back in.';
    console.error('[EditDetails] update matched 0 rows — id mismatch?', editDetailsModelId);
    return;
  }

  errEl.textContent = '';

  // Use the returned row directly — no extra fetch needed
  const fresh = updateData[0];
  const idx = allModels.findIndex(m => String(m.id) === String(editDetailsModelId));
  if (idx !== -1) allModels[idx] = fresh; else allModels.push(fresh);
  toast('Details saved ✓');
  closeEditDetails();
  showModelDashboard(fresh);
}

// ═══════════════════════════════════════════════
// MODEL DASHBOARD
// ═══════════════════════════════════════════════
async function showModelDashboard(model) {
  currentModelData = model; // store globally so Edit Details button can access it safely
  hideAll();
  const wrap = document.getElementById('model-profile-wrap');
  if (!wrap) return;
  document.getElementById('model-dashboard').classList.remove('hidden');
  document.getElementById('panel-back-btn')?.classList.remove('hidden');
  // Lock body scroll so only the inner card scrolls (restores the panel feel)
  document.body.style.overflow = 'hidden';
  await loadInventory();
  const staffNames = [model.assigned_stylist, model.assigned_hair, model.assigned_makeup].filter(Boolean);
  let staffByName = {};
  if (staffNames.length) {
    const { data:staffRows } = await sb.from('users').select('name,instagram').in('name', staffNames);
    (staffRows||[]).forEach(s=>{ if (s.instagram) staffByName[s.name]=s.instagram; });
  }
  const modelInv  = inventoryData.filter(i=>i.assigned_model===model.full_name);
  const flag      = getFlag(model.ethnicity);
  const initials  = (model.full_name||'??').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
  const photos    = toArr(model.photos);
  const hairPh    = toArr(model.hair_photos);
  const muaPh     = toArr(model.mua_photos);
  const outfitPh  = toArr(model.outfit_photos);

  document.getElementById('model-profile-wrap').innerHTML = `
    <div class="model-profile-hero">
      <div class="model-hero-avatar">${model.profile_photo?`<img src="${model.profile_photo}"/>`:initials}</div>
      <div>
        <div class="model-hero-name">${model.full_name||'—'}</div>
        <div class="model-hero-handle">${model.instagram?'@'+model.instagram:''}</div>
        <div class="model-hero-status">
          <span class="model-hero-flag">${flag}</span>
        </div>
        <button class="edit-details-btn" onclick="openEditDetails(currentModelData)">✏️ Edit Details</button>
      </div>
    </div>
    <div class="model-profile-body">
      <div class="model-section">
        <div class="model-section-title">Your Team</div>
        <div class="model-team-cards">
          ${teamCard('Stylist', model.assigned_stylist, staffByName)}
          ${teamCard('Hair', model.assigned_hair, staffByName)}
          ${teamCard('Makeup', model.assigned_makeup, staffByName)}
        </div>
      </div>
      ${model.notes?`<div class="model-section"><div class="model-section-title">Notes from Team</div><div style="font-size:14px">${model.notes}</div></div>`:''}
      ${modelInv.length?`<div class="model-section"><div class="model-section-title">Your Stage Fit</div><p style="font-size:12px;color:var(--dim);font-family:var(--font-mono);margin-bottom:14px">Tap any item to edit its name or details.</p><div class="stage-fit-grid">${modelInv.map(item=>`<div class="stage-fit-item" onclick="openInventoryPanel('${item.id}')" style="cursor:pointer">${item.photo_url?`<img src="${item.photo_url}"/>`:`<div style="aspect-ratio:3/4;background:var(--cream);display:flex;align-items:center;justify-content:center;font-size:28px">👕</div>`}<div class="stage-fit-label">${item.name||item.category}${item.size_qty?' · '+item.size_qty:''}</div></div>`).join('')}</div></div>`:''}
      <div class="model-section">
        <div class="model-section-title">Add More Photos</div>
        <p style="font-size:12px;color:var(--dim);font-family:var(--font-mono);margin-bottom:16px">Add to your base fits, hair inspo, makeup inspo, or your own outfit any time.</p>
        <div class="upload-grid">
          <div><label style="margin-bottom:8px">Base Fits</label><div class="upload-zone" onclick="document.getElementById('up-fit').click()"><input type="file" id="up-fit" multiple accept="image/*" onchange="uploadMorePhotos(this,'photos','${model.id}')"/><div class="upload-zone-icon">📸</div><div class="upload-zone-text">Tap to upload</div></div></div>
          <div><label style="margin-bottom:8px">Hair Inspo</label><div class="upload-zone" onclick="document.getElementById('up-hair').click()"><input type="file" id="up-hair" multiple accept="image/*" onchange="uploadMorePhotos(this,'hair_photos','${model.id}')"/><div class="upload-zone-icon">💇</div><div class="upload-zone-text">Tap to upload</div></div></div>
          <div><label style="margin-bottom:8px">Makeup Inspo</label><div class="upload-zone" onclick="document.getElementById('up-mua').click()"><input type="file" id="up-mua" multiple accept="image/*" onchange="uploadMorePhotos(this,'mua_photos','${model.id}')"/><div class="upload-zone-icon">💄</div><div class="upload-zone-text">Tap to upload</div></div></div>
          <div><label style="margin-bottom:8px">Your Own Outfit</label><div class="upload-zone" onclick="document.getElementById('up-outfit').click()"><input type="file" id="up-outfit" multiple accept="image/*" onchange="uploadMorePhotos(this,'outfit_photos','${model.id}')"/><div class="upload-zone-icon">👕</div><div class="upload-zone-text">Tap to upload</div></div></div>
        </div>
        <div id="upload-status" style="font-size:11px;color:var(--dim);font-family:var(--font-mono);margin-top:12px"></div>
      </div>
      ${outfitPh.length?`<div class="model-section"><div class="model-section-title">Your Own Outfit</div><div class="photo-grid">${outfitPh.map(u=>`<div class="photo-thumb"><img src="${u}"/></div>`).join('')}</div></div>`:''}
      ${photos.length?`<div class="model-section"><div class="model-section-title">Your Fits</div><div class="photo-grid">${photos.map(u=>`<div class="photo-thumb"><img src="${u}"/></div>`).join('')}</div></div>`:''}
      ${hairPh.length?`<div class="model-section"><div class="model-section-title">Hair Inspo</div><div class="photo-grid">${hairPh.map(u=>`<div class="photo-thumb"><img src="${u}"/></div>`).join('')}</div></div>`:''}
      ${muaPh.length?`<div class="model-section"><div class="model-section-title">Makeup Inspo</div><div class="photo-grid">${muaPh.map(u=>`<div class="photo-thumb"><img src="${u}"/></div>`).join('')}</div></div>`:''}
    </div>`;
}

async function uploadMorePhotos(input, field, modelId) {
  const files=Array.from(input.files); if(!files.length) return;
  const status=document.getElementById('upload-status'); if(status) status.textContent='Uploading…';
  const urls=await uploadFiles(files, modelId, field);
  const { data:current }=await sb.from('model_profiles').select(field).eq('id',modelId).single();
  const existing=current?.[field]||[];
  await sb.from('model_profiles').update({[field]:[...existing,...urls]}).eq('id',modelId);
  if (status) status.textContent=`✓ ${urls.length} uploaded`;
  toast('Photos uploaded ✓');
  // reload model dashboard
  const { data:fresh }=await sb.from('model_profiles').select('*').eq('id',modelId).single();
  if (fresh) showModelDashboard(fresh);
}

// ═══════════════════════════════════════════════
// TEAM PANEL (admin)
// ═══════════════════════════════════════════════
const ROLE_LABELS = { STYLIST:'Stylist', HAIR_STYLIST:'Hair Stylist', MAKEUP_ARTIST:'Makeup Artist' };
const ROLE_FIELD_MAP = { STYLIST:'assigned_stylist', HAIR_STYLIST:'assigned_hair', MAKEUP_ARTIST:'assigned_makeup' };
function renderTeam() {
  const staffList = staffUsers
    .filter(s=>ROLE_LABELS[s.role])
    .map(s=>({ name:s.name, roleKey:s.role, role:ROLE_LABELS[s.role], field:ROLE_FIELD_MAP[s.role] }));
  const grid=document.getElementById('team-grid');
  if (!grid) return;
  grid.innerHTML=staffList.map(s=>{
    const assigned=allModels.filter(m=>m[s.field]===s.name);
    return `<div class="team-card" style="cursor:pointer" onclick="openStaffPanel('${s.name.replace(/'/g,"\\'")}','${s.roleKey}','${s.field}')">
      <div class="team-card-name">${s.name}</div>
      <div class="team-card-role">${s.role} · ${assigned.length} assigned</div>
      <div class="team-assigned-list">${assigned.length?assigned.map(m=>`<div class="team-assigned-item">${getFlag(m.ethnicity)} ${m.full_name}</div>`).join(''):'<div style="font-size:11px;color:var(--dim);font-family:var(--font-mono)">None assigned</div>'}</div>
    </div>`;
  }).join('');
  if (!staffList.length) grid.innerHTML = '<div style="font-size:13px;color:var(--dim);padding:24px 0">No staff signed up yet.</div>';
  renderManageUsers();
}

function openStaffPanel(name, roleKey, field) {
  const assigned = allModels.filter(m => m[field] === name);
  const staffMember = staffUsers.find(s => s.name === name);
  const ig = staffMember?.instagram || '';
  const roleLabel = ROLE_LABELS[roleKey] || roleKey;

  const initials = name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();

  const modelList = assigned.length
    ? assigned.map(m => {
        const mInit = (m.full_name||'??').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
        return `<div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--beige);cursor:pointer" onclick="closePanel();setTimeout(()=>openModelPanel('${m.id}'),80)">
          <div style="width:36px;height:36px;border-radius:50%;background:var(--cream);overflow:hidden;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:600">
            ${m.profile_photo ? `<img src="${m.profile_photo}" style="width:100%;height:100%;object-fit:cover"/>` : mInit}
          </div>
          <div>
            <div style="font-size:14px;font-weight:500">${m.full_name||'—'}</div>
            ${m.instagram ? `<div style="font-size:11px;color:var(--dim)">@${m.instagram}</div>` : ''}
          </div>
          <span style="margin-left:auto;font-size:18px;color:var(--dim)">›</span>
        </div>`;
      }).join('')
    : '<div style="font-size:13px;color:var(--dim);padding:16px 0;font-family:var(--font-mono)">No models assigned yet.</div>';

  document.getElementById('panel-name').textContent = name;
  document.getElementById('panel-handle').textContent = ig ? '@'+ig : '';
  document.getElementById('panel-flag').textContent = '';
  document.getElementById('panel-body').innerHTML = `
    <div style="margin-bottom:20px">
      <div class="panel-section-title">Role</div>
      <div style="font-size:14px;font-weight:500">${roleLabel}</div>
    </div>
    <div style="margin-bottom:20px">
      <div class="panel-section-title">Assigned Models <span style="font-weight:400;color:var(--dim)">${assigned.length}</span></div>
      ${modelList}
    </div>
    ${currentUser?.name === 'Daniel' ? `
    <div style="padding-top:20px;border-top:1.5px solid var(--beige)">
      <button class="btn btn-sm" style="background:none;border:1.5px solid var(--red);color:var(--red)" onclick="deleteStaffFromPanel('${name.replace(/'/g,"\\'")}')">🗑 Delete Account</button>
      <div style="font-size:11px;color:var(--dim);font-family:var(--font-mono);margin-top:8px">Removes this staff member's login. Cannot be undone.</div>
    </div>` : ''}
  `;
  document.getElementById('model-panel-overlay').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

async function deleteStaffFromPanel(name) {
  const { data:user } = await sb.from('users').select('id,name').eq('name', name).maybeSingle();
  if (!user) { toast('User not found', true); return; }
  await deleteUser(user.id, user.name);
  closePanel();
}

async function renderManageUsers() {
  const section = document.getElementById('manage-users-section');
  if (!section) return;
  const { data: allUsers } = await sb.from('users').select('id,name,role,username').order('name');
  if (!allUsers || !allUsers.length) {
    section.innerHTML = `<div class="panel-section-title" style="margin-bottom:12px">Manage Users</div><div style="font-size:12px;color:var(--dim);font-family:var(--font-mono)">No users found.</div>`;
    return;
  }
  const RL = { ADMIN:'Admin', STYLIST:'Stylist', HAIR_STYLIST:'Hair Stylist', MAKEUP_ARTIST:'Makeup Artist' };
  section.innerHTML = `
    <div class="panel-section-title" style="margin-bottom:8px">Manage Users</div>
    <p style="font-size:11px;color:var(--dim);font-family:var(--font-mono);margin-bottom:16px">Delete test accounts or old users. Cannot be undone.</p>
    <div class="manage-users-list">
      ${allUsers.map(u=>`
        <div class="manage-user-row">
          <div>
            <div class="manage-user-name">${u.name||'—'}</div>
            <div class="manage-user-meta">${RL[u.role]||u.role}${u.username?' · @'+u.username:' · no username'}</div>
          </div>
          <button class="btn btn-sm" style="background:none;border:1.5px solid var(--red);color:var(--red);flex-shrink:0" onclick="deleteUser('${u.id}','${(u.name||'').replace(/'/g,"\\'")}')">Delete</button>
        </div>`).join('')}
    </div>`;
}

async function deleteUser(id, name) {
  if (!confirm(`Delete ${name||'this user'}? This cannot be undone.`)) return;
  const { error } = await sb.from('users').delete().eq('id', id);
  if (error) { toast(error.message, true); return; }
  toast(`${(name||'User').split(' ')[0]} deleted`);
  await loadStaffUsers();
  renderTeam();
}

// ═══════════════════════════════════════════════
// REFRESH WHATEVER VIEW IS OPEN
// ═══════════════════════════════════════════════
function refreshCurrentView() {
  if (currentUser?.role==='ADMIN') renderAdminModels(document.getElementById('model-search')?.value||'');
  else if (currentUser?.role) renderStaffModels();
}

// ═══════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════
function hideAll() {
  document.getElementById('auth-screen').classList.add('hidden');
  document.querySelectorAll('.dashboard').forEach(d=>d.classList.add('hidden'));
}
function showError(id,msg){ const el=document.getElementById(id); if(el) el.textContent=msg; }
let toastTimer;
function toast(msg,isError){ const el=document.getElementById('toast'); el.textContent=msg; el.className='show'+(isError?' error':''); clearTimeout(toastTimer); toastTimer=setTimeout(()=>{el.className='';},3000); }
