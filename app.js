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

// Map role → which status/assignment fields it controls
const ROLE_FIELDS = {
  STYLIST:       { status: 'stylist_status', assign: 'assigned_stylist', label: 'Stylist',       hasPending: false },
  HAIR_STYLIST:  { status: 'hair_status',    assign: 'assigned_hair',    label: 'Hair Stylist',  hasPending: true  },
  MAKEUP_ARTIST: { status: 'makeup_status',  assign: 'assigned_makeup',  label: 'Makeup Artist', hasPending: true  },
};

// ═══════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════
let currentUser   = null;
let allModels     = [];
let inventoryData = [];
let activeTab     = 'all';
let staffTab      = 'all';
let openModelData = null;
let isNewModel    = false;

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
  const names = role === 'ADMIN' ? STAFF_NAMES.ADMIN : (STAFF_NAMES[role]||[]);
  const staffSel = document.getElementById('signup-name-staff');
  staffSel.innerHTML = '<option value="">— choose your name —</option>';
  names.forEach(n => { staffSel.innerHTML += `<option value="${n}">${n}</option>`; });
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

// ═══════════════════════════════════════════════
// UPLOAD HELPER — returns array of public URLs
// ═══════════════════════════════════════════════
async function uploadFiles(fileList, folder, subfolder) {
  const urls = [];
  for (const file of Array.from(fileList)) {
    const path = `${folder}/${subfolder}/${Date.now()}_${Math.random().toString(36).slice(2,7)}_${file.name}`;
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
    const nameVal = document.getElementById('signup-name-staff').value;
    if (!nameVal) { showError('signup-error','Select your name.'); return; }
    const { data:ex } = await sb.from('users').select('id').eq('username',username).maybeSingle();
    if (ex) { showError('signup-error','Username already taken.'); return; }
    const { error } = await sb.from('users').insert({ name:nameVal, role, username, pin });
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
  const { data:ex } = await sb.from('model_profiles').select('id').eq('username',username).maybeSingle();
  if (ex) { showError('signup-error','Username already taken.'); return; }

  showError('signup-error','Uploading photos, please wait…');

  // Profile photo
  let profileUrl = '';
  const profInput = document.getElementById('existing-profile-input');
  if (profInput && profInput.files[0]) {
    const u = await uploadFiles([profInput.files[0]], nameVal, 'profile');
    if (u.length) profileUrl = u[0];
  }
  // Fit / hair / mua
  const faceUrls = await uploadFiles(document.getElementById('ex-face').files, nameVal, 'face');
  const fitUrls  = await uploadFiles(document.getElementById('ex-fit').files,  nameVal, 'fit');
  const hairUrls = await uploadFiles(document.getElementById('ex-hair').files, nameVal, 'hair');
  const muaUrls  = await uploadFiles(document.getElementById('ex-mua').files,  nameVal, 'mua');

  const ethnicity = document.getElementById('existing-ethnicity')?.value || '';
  const note      = document.getElementById('ex-note')?.value.trim() || '';

  const updates = { username, pin, registered:true, photos:fitUrls, hair_photos:hairUrls, mua_photos:muaUrls, face_photos:faceUrls, model_note:note, needs_hair:true, needs_makeup:true };
  if (profileUrl) updates.profile_photo = profileUrl;
  if (ethnicity)  updates.ethnicity = ethnicity;

  const { error } = await sb.from('model_profiles').update(updates).eq('id', nameVal);
  if (error) { showError('signup-error',error.message); return; }
  document.getElementById('signup-error').textContent = '';
  toast('Account created! Sign in now.');
  showTab('signin');
}

async function signUpNewModel(username, pin) {
  const fullName = document.getElementById('new-full-name').value.trim();
  if (!fullName) { showError('signup-error','Enter your full name.'); return; }
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
  if (f1 && f1.files[0]) { const u = await uploadFiles([f1.files[0]], folder, 'face'); faceUrls.push(...u); }
  const fitUrls  = await uploadFiles(document.getElementById('new-fit').files,        folder, 'fit');
  const hairUrls = await uploadFiles(document.getElementById('new-hair-photos').files, folder, 'hair');
  const muaUrls  = await uploadFiles(document.getElementById('new-mua-photos').files,  folder, 'mua');

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
    cultural_piece:document.getElementById('new-cultural').value==='true',
    cultural_desc: document.getElementById('new-cultural-desc').value.trim(),
    talent:        document.getElementById('new-talent').value==='true',
    talent_desc:   document.getElementById('new-talent-desc').value.trim(),
    free_5july:    document.getElementById('new-free').value==='true',
    hair_ok:       document.getElementById('new-hair-ok').value==='true',
    makeup_self:   document.getElementById('new-makeup-self').value==='true',
    agency:        document.getElementById('new-agency').value,
    model_note:    document.getElementById('new-note').value.trim(),
    username, pin, registered:true, approved:false,
    profile_photo: profileUrl, face_photos:faceUrls,
    photos:fitUrls, hair_photos:hairUrls, mua_photos:muaUrls,
    tags:[], notes:'',
    needs_hair:true, needs_makeup:true,
    checklist_outfit:false, checklist_hair:false, checklist_makeup:false,
  };

  const { error } = await sb.from('model_profiles').insert(payload);
  if (error) { showError('signup-error',error.message); return; }
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
  document.getElementById('signin-username').value='';
  document.getElementById('signin-pin').value='';
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

// ═══════════════════════════════════════════════
// ADMIN DASHBOARD
// ═══════════════════════════════════════════════
async function showAdminDashboard() {
  hideAll();
  document.getElementById('admin-dashboard').classList.remove('hidden');
  document.getElementById('admin-name-display').textContent = currentUser.name;
  await loadAllModels();
  await loadInventory();
  renderAdminModels();
}

function adminNav(page, btn) {
  document.querySelectorAll('#admin-dashboard .nav-item').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  ['admin-models-panel','admin-team-panel'].forEach(id=>document.getElementById(id).classList.add('hidden'));
  const titles = { models:'All Models', team:'Team' };
  document.getElementById('admin-page-title').textContent = titles[page]||'';
  document.getElementById('model-search').style.display = page==='models'?'':'none';
  if (page==='models')    { document.getElementById('admin-models-panel').classList.remove('hidden'); renderAdminModels(); }
  else if (page==='team') { document.getElementById('admin-team-panel').classList.remove('hidden'); renderTeam(); }
}

async function setAdminTab(btn, tab) {
  activeTab = tab;
  document.querySelectorAll('#admin-models-panel .tab-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  const modelsContent = document.getElementById('models-tab-content');
  const invContent    = document.getElementById('inventory-tab-content');
  if (tab==='inventory') {
    modelsContent.classList.add('hidden');
    invContent.classList.remove('hidden');
    await loadInventory();
    renderInventoryGrid('inv-grid','inv-count',true);
  } else {
    modelsContent.classList.remove('hidden');
    invContent.classList.add('hidden');
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
  if (activeTab==='approved')  list = list.filter(m=>m.approved);
  if (activeTab==='pending')   list = list.filter(m=>!m.approved);
  if (activeTab==='completed') list = list.filter(m=>isCompleted(m));
  const grid = document.getElementById('admin-model-grid');
  if (!grid) return;
  grid.innerHTML = list.length ? list.map(m=>modelCardHTML(m,'ADMIN')).join('') : '<div class="loading-center" style="grid-column:1/-1">No models here</div>';
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

  const adminFooter = isAdmin ? `
    <div class="card-footer">
      <select class="assign-select" onchange="assignField('${m.id}','assigned_stylist',this.value);event.stopPropagation()">
        <option value="">Stylist…</option>
        ${STAFF_NAMES.STYLIST.map(s=>`<option value="${s}"${m.assigned_stylist===s?' selected':''}>${s}</option>`).join('')}
      </select>
      <select class="assign-select" onchange="assignField('${m.id}','assigned_hair',this.value);event.stopPropagation()">
        <option value="">Hair…</option>
        ${STAFF_NAMES.HAIR_STYLIST.map(s=>`<option value="${s}"${m.assigned_hair===s?' selected':''}>${s}</option>`).join('')}
      </select>
      <select class="assign-select" onchange="assignField('${m.id}','assigned_makeup',this.value);event.stopPropagation()">
        <option value="">MUA…</option>
        ${STAFF_NAMES.MAKEUP_ARTIST.map(s=>`<option value="${s}"${m.assigned_makeup===s?' selected':''}>${s}</option>`).join('')}
      </select>
      <button class="btn-approve${m.approved?' btn-approved':''}" onclick="toggleApprove('${m.id}');event.stopPropagation()">${m.approved?'✓ Approved':'Approve'}</button>
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
        <div class="card-badges">
          ${isAdmin?`<span class="badge ${m.approved?'badge-brown':'badge-outline'}">${m.approved?'✓':'Pending'}</span>`:''}
          <span class="badge ${m.gender==='Male'?'badge-blue':'badge-pink'}">${m.gender||'—'}</span>
        </div>
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:10px">
        ${m.ethnicity?`<span class="badge badge-outline">${m.ethnicity}</span>`:''}
        ${m.talent?'<span class="badge badge-blue">🎤 Talent</span>':''}
        ${!m.free_5july?'<span class="badge badge-red">⚠ Busy AM</span>':''}
        ${statusPill}
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
function openModelPanel(id) {
  const m = allModels.find(x=>String(x.id)===String(id));
  if (!m) { toast('Could not load model', true); return; }
  openModelData = m;

  const flag    = getFlag(m.ethnicity);
  document.getElementById('panel-name').textContent   = m.full_name||'—';
  document.getElementById('panel-handle').textContent = m.instagram?'@'+m.instagram:'';
  document.getElementById('panel-flag').textContent   = flag;

  const role    = currentUser?.role;
  const isAdmin = role==='ADMIN';
  const isHairOrMua = role==='HAIR_STYLIST' || role==='MAKEUP_ARTIST';
  const photos  = m.photos      || [];
  const hairPh  = m.hair_photos || [];
  const muaPh   = m.mua_photos  || [];
  const facePh  = m.face_photos || [];
  const tags    = m.tags        || [];
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

  // ── Photo blocks ──
  const fitBlock  = `<div><div class="panel-section-title">Base Fit Photos</div>${photos.length?`<div class="photo-grid">${photos.map(u=>`<div class="photo-thumb"><img src="${u}"/></div>`).join('')}</div>`:'<div class="no-photos">None uploaded</div>'}</div>`;
  const hairBlock = `<div><div class="panel-section-title">Hair Inspo</div>${hairPh.length?`<div class="photo-grid">${hairPh.map(u=>`<div class="photo-thumb"><img src="${u}"/></div>`).join('')}</div>`:'<div class="no-photos">None uploaded</div>'}</div>`;
  const muaBlock  = `<div><div class="panel-section-title">Makeup Inspo</div>${muaPh.length?`<div class="photo-grid">${muaPh.map(u=>`<div class="photo-thumb"><img src="${u}"/></div>`).join('')}</div>`:'<div class="no-photos">None uploaded</div>'}</div>`;
  const faceBlock = facePh.length?`<div><div class="panel-section-title">Face Close-Ups</div><div class="photo-grid">${facePh.map(u=>`<div class="photo-thumb"><img src="${u}"/></div>`).join('')}</div></div>`:'';
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
        <div class="detail-item"><label>Top</label><div class="val">${m.top_size||'—'}</div></div>
        <div class="detail-item"><label>Jeans</label><div class="val">${m.jean_size||'—'}</div></div>
        <div class="detail-item"><label>Suburb</label><div class="val">${m.suburb||'—'}</div></div>
        ${isAdmin?`<div class="detail-item"><label>Phone</label><div class="val">${m.phone||'—'}</div></div>`:''}
        <div class="detail-item"><label>Free Jul 5</label><div class="val">${m.free_5july?'Yes':'⚠ Busy AM'}</div></div>
        <div class="detail-item"><label>Hair Change</label><div class="val">${m.hair_ok?'Yes':'No'}</div></div>
        <div class="detail-item"><label>Own Makeup</label><div class="val">${m.makeup_self?'Yes':'Needs MUA'}</div></div>
        <div class="detail-item"><label>Style</label><div class="val">${m.style||'—'}</div></div>
      </div>
    </div>
    ${m.talent?`<div><div class="panel-section-title">Talent</div><div class="val">${m.talent_desc||'—'}</div></div>`:''}
    ${m.cultural_piece?`<div><div class="panel-section-title">Cultural Piece</div><div class="val">${m.cultural_desc||'—'}</div></div>`:''}
    ${modelInv.length?`<div><div class="panel-section-title">Stage Fit — Inventory</div><div class="stage-fit-grid">${modelInv.map(item=>`<div class="stage-fit-item">${item.photo_url?`<img src="${item.photo_url}"/>`:`<div style="aspect-ratio:3/4;background:var(--cream);display:flex;align-items:center;justify-content:center;font-size:28px">👕</div>`}<div class="stage-fit-label">${item.name||item.category}${item.size_qty?' · '+item.size_qty:''}</div></div>`).join('')}</div></div>`:''}
  `;

  // ── Admin assignment block ──
  const adminBlock = isAdmin ? `
    <div>
      <div class="panel-section-title">Assignment & Status</div>
      <div class="assign-grid">
        <div class="form-group" style="margin-bottom:0"><label>Stylist</label><div class="select-wrap"><select onchange="assignField('${m.id}','assigned_stylist',this.value)"><option value="">Unassigned</option>${STAFF_NAMES.STYLIST.map(s=>`<option value="${s}"${m.assigned_stylist===s?' selected':''}>${s}</option>`).join('')}</select></div></div>
        <div class="form-group" style="margin-bottom:0"><label>Hair</label><div class="select-wrap"><select onchange="assignField('${m.id}','assigned_hair',this.value)"><option value="">Unassigned</option>${STAFF_NAMES.HAIR_STYLIST.map(s=>`<option value="${s}"${m.assigned_hair===s?' selected':''}>${s}</option>`).join('')}</select></div></div>
        <div class="form-group" style="margin-bottom:0"><label>MUA</label><div class="select-wrap"><select onchange="assignField('${m.id}','assigned_makeup',this.value)"><option value="">Unassigned</option>${STAFF_NAMES.MAKEUP_ARTIST.map(s=>`<option value="${s}"${m.assigned_makeup===s?' selected':''}>${s}</option>`).join('')}</select></div></div>
        <div class="form-group" style="margin-bottom:0"><label>Approval</label><button class="btn btn-sm ${m.approved?'btn-brown':'btn-ghost'}" onclick="toggleApprove('${m.id}');openModelPanel('${m.id}')">${m.approved?'✓ Approved':'Approve'}</button></div>
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
      <div class="tag-row"><input type="text" id="tag-input" placeholder="Add tag…" onkeydown="if(event.key==='Enter')addPanelTag()"/><button class="btn btn-sm btn-brown" style="width:auto;margin-top:0" onclick="addPanelTag()">+</button></div>
      <div class="tags-wrap" id="panel-tags">${tags.map(t=>`<span class="tag-pill" onclick="removePanelTag('${t}')">${t}<span class="x"> ×</span></span>`).join('')}</div>
    </div>
    <div>
      <div class="panel-section-title">Internal Notes</div>
      <textarea class="notes-field" id="panel-notes" onblur="saveNotes()" placeholder="Team notes…">${m.notes||''}</textarea>
    </div>` : '';

  // ── ORDER: hair/mua see photos+note first. Stylists see fit first. Admin sees details first. ──
  let body = '';
  if (statusHTML) body += statusHTML;

  if (role === 'HAIR_STYLIST') {
    body += hairBlock + noteBlock + muaBlock + faceBlock + fitBlock + detailsBlock;
  } else if (role === 'MAKEUP_ARTIST') {
    body += muaBlock + noteBlock + hairBlock + faceBlock + fitBlock + detailsBlock;
  } else if (role === 'STYLIST') {
    body += fitBlock + noteBlock + hairBlock + muaBlock + faceBlock + detailsBlock;
  } else { // ADMIN
    body += detailsBlock + adminBlock + faceBlock + fitBlock + hairBlock + muaBlock + (m.model_note?noteBlock:'');
  }

  document.getElementById('panel-body').innerHTML = body;
  document.getElementById('model-panel-overlay').classList.remove('hidden');
  document.body.style.overflow='hidden';
}

function closePanel() {
  document.getElementById('model-panel-overlay').classList.add('hidden');
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

// ═══════════════════════════════════════════════
// STAFF DASHBOARD
// ═══════════════════════════════════════════════
async function showStaffDashboard(user) {
  hideAll();
  document.getElementById('staff-dashboard').classList.remove('hidden');
  document.getElementById('staff-name-display').textContent = user.name;
  const labels = {STYLIST:'Stylist',HAIR_STYLIST:'Hair Stylist',MAKEUP_ARTIST:'Makeup Artist'};
  document.getElementById('staff-role-display').textContent = labels[user.role]||'Staff';
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
  let list = allModels.filter(m=>m.approved); // staff only see approved models

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
  grid.innerHTML = list.length ? list.map(m=>modelCardHTML(m,role)).join('') : `<div class="loading-center">${staffTab==='mine'?'No models selected yet':'No approved models yet'}</div>`;
}
function filterStaffModels(val) { if (staffTab!=='inventory') renderStaffModels(val); }

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
        <div class="inv-card">
          ${item.photo_url?`<div class="inv-card-photo"><img src="${item.photo_url}"/></div>`:`<div class="inv-card-no-photo">👕</div>`}
          <div class="inv-card-name">${item.name||item.category||'Unnamed'}</div>
          <div class="inv-card-meta">${item.category}${item.size_qty?' · '+item.size_qty:''}</div>
          ${item.assigned_model?`<div class="inv-assigned">→ ${item.assigned_model}</div>`:`<div style="font-size:11px;color:var(--dim)">Unassigned</div>`}
        </div>`).join('')
    : `<div class="loading-center" style="background:var(--white);grid-column:1/-1;padding:40px;border-radius:var(--radius)">No items yet</div>`;
}

function openInvModal() {
  document.getElementById('inv-name').value='';
  document.getElementById('inv-size').value='';
  document.getElementById('inv-photo-preview').innerHTML=`
    <input type="file" id="inv-photo-input" accept="image/*" onchange="previewInvPhoto(this)" style="display:none"/>
    <div id="inv-photo-placeholder"><div style="font-size:28px;margin-bottom:6px">👕</div><div style="font-size:12px;color:var(--dim);font-family:var(--font-mono)">Tap to upload photo</div></div>`;
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
// MODEL DASHBOARD
// ═══════════════════════════════════════════════
async function showModelDashboard(model) {
  hideAll();
  document.getElementById('model-dashboard').classList.remove('hidden');
  await loadInventory();
  const modelInv=inventoryData.filter(i=>i.assigned_model===model.full_name);
  const flag=getFlag(model.ethnicity);
  const initials=(model.full_name||'??').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
  const photos=model.photos||[]; const hairPh=model.hair_photos||[]; const muaPh=model.mua_photos||[];

  document.getElementById('model-profile-wrap').innerHTML = `
    <div class="model-profile-hero">
      <div class="model-hero-avatar">${model.profile_photo?`<img src="${model.profile_photo}"/>`:initials}</div>
      <div>
        <div class="model-hero-name">${model.full_name||'—'}</div>
        <div class="model-hero-handle">${model.instagram?'@'+model.instagram:''}</div>
        <div class="model-hero-status">
          <span class="badge ${model.approved?'badge-brown':'badge-outline'}">${model.approved?'✓ Approved':'Pending Approval'}</span>
          <span class="model-hero-flag">${flag}</span>
        </div>
      </div>
    </div>
    <div class="model-profile-body">
      <div class="model-section">
        <div class="model-section-title">Your Details</div>
        <div class="detail-grid">
          <div class="detail-item"><label>Age</label><div class="val">${model.age||'—'}</div></div>
          <div class="detail-item"><label>Height</label><div class="val">${model.height||'—'}</div></div>
          <div class="detail-item"><label>Top</label><div class="val">${model.top_size||'—'}</div></div>
          <div class="detail-item"><label>Jeans</label><div class="val">${model.jean_size||'—'}</div></div>
          <div class="detail-item"><label>Style</label><div class="val">${model.style||'—'}</div></div>
          <div class="detail-item"><label>Cultural Piece</label><div class="val">${model.cultural_piece?model.cultural_desc:'None'}</div></div>
        </div>
      </div>
      ${model.assigned_stylist||model.assigned_hair||model.assigned_makeup?`
      <div class="model-section">
        <div class="model-section-title">Your Team</div>
        <div class="model-team-cards">
          ${model.assigned_stylist?`<div class="model-team-card"><div class="model-team-label">Stylist</div><div class="model-team-name">${model.assigned_stylist}</div></div>`:''}
          ${model.assigned_hair?`<div class="model-team-card"><div class="model-team-label">Hair</div><div class="model-team-name">${model.assigned_hair}</div></div>`:''}
          ${model.assigned_makeup?`<div class="model-team-card"><div class="model-team-label">Makeup</div><div class="model-team-name">${model.assigned_makeup}</div></div>`:''}
        </div>
      </div>`:''}
      ${model.notes?`<div class="model-section"><div class="model-section-title">Notes from Team</div><div style="font-size:14px">${model.notes}</div></div>`:''}
      ${modelInv.length?`<div class="model-section"><div class="model-section-title">Your Stage Fit</div><div class="stage-fit-grid">${modelInv.map(item=>`<div class="stage-fit-item">${item.photo_url?`<img src="${item.photo_url}"/>`:`<div style="aspect-ratio:3/4;background:var(--cream);display:flex;align-items:center;justify-content:center;font-size:28px">👕</div>`}<div class="stage-fit-label">${item.name||item.category}${item.size_qty?' · '+item.size_qty:''}</div></div>`).join('')}</div></div>`:''}
      <div class="model-section">
        <div class="model-section-title">Add More Photos</div>
        <p style="font-size:12px;color:var(--dim);font-family:var(--font-mono);margin-bottom:16px">Add to your base fits, hair inspo, or makeup inspo any time.</p>
        <div class="upload-grid">
          <div><label style="margin-bottom:8px">Base Fits</label><div class="upload-zone" onclick="document.getElementById('up-fit').click()"><input type="file" id="up-fit" multiple accept="image/*" onchange="uploadMorePhotos(this,'photos','${model.id}')"/><div class="upload-zone-icon">📸</div><div class="upload-zone-text">Tap to upload</div></div></div>
          <div><label style="margin-bottom:8px">Hair Inspo</label><div class="upload-zone" onclick="document.getElementById('up-hair').click()"><input type="file" id="up-hair" multiple accept="image/*" onchange="uploadMorePhotos(this,'hair_photos','${model.id}')"/><div class="upload-zone-icon">💇</div><div class="upload-zone-text">Tap to upload</div></div></div>
          <div><label style="margin-bottom:8px">Makeup Inspo</label><div class="upload-zone" onclick="document.getElementById('up-mua').click()"><input type="file" id="up-mua" multiple accept="image/*" onchange="uploadMorePhotos(this,'mua_photos','${model.id}')"/><div class="upload-zone-icon">💄</div><div class="upload-zone-text">Tap to upload</div></div></div>
        </div>
        <div id="upload-status" style="font-size:11px;color:var(--dim);font-family:var(--font-mono);margin-top:12px"></div>
      </div>
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
function renderTeam() {
  const staffList=[
    {name:'Christie',role:'Hair Stylist',field:'assigned_hair'},
    {name:'Maria',role:'Hair Stylist',field:'assigned_hair'},
    {name:'Neza',role:'Hair Stylist',field:'assigned_hair'},
    {name:'Rebecca',role:'Makeup Artist',field:'assigned_makeup'},
    {name:'Daniel',role:'Stylist',field:'assigned_stylist'},
    {name:'Dee',role:'Stylist',field:'assigned_stylist'},
    {name:'Komi',role:'Stylist',field:'assigned_stylist'},
    {name:'Richelle',role:'Stylist',field:'assigned_stylist'},
  ];
  const grid=document.getElementById('team-grid');
  grid.innerHTML=staffList.map(s=>{
    const assigned=allModels.filter(m=>m[s.field]===s.name);
    return `<div class="team-card"><div class="team-card-name">${s.name}</div><div class="team-card-role">${s.role} · ${assigned.length} assigned</div><div class="team-assigned-list">${assigned.length?assigned.map(m=>`<div class="team-assigned-item">${getFlag(m.ethnicity)} ${m.full_name}</div>`).join(''):'<div style="font-size:11px;color:var(--dim);font-family:var(--font-mono)">None assigned</div>'}</div></div>`;
  }).join('');
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
