// ═══════════════════════════════════════════════
// CONFIG
// ═══════════════════════════════════════════════
const SUPABASE_URL = "https://dyruvkzuasaiofkxdvid.supabase.co";
const SUPABASE_KEY = "sb_publishable_tKMXDxTa-uICYsBE3OUh7A_RsoGFhhf";
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const STAFF_NAMES = {
  STYLIST:       ["Daniel", "Dee", "Komi"],
  HAIR_STYLIST:  ["Christie", "Maria", "Neza"],
  MAKEUP_ARTIST: ["Rebecca"],
  ADMIN:         ["Daniel"]
};

// Country → flag emoji map
const FLAG_MAP = {
  "Australian": "🇦🇺", "Burundian": "🇧🇮", "Cameroonian": "🇨🇲",
  "Chinese": "🇨🇳", "Congolese": "🇨🇩", "Ethiopian": "🇪🇹",
  "Filipino": "🇵🇭", "Ghanaian": "🇬🇭", "Indian": "🇮🇳",
  "Indonesian": "🇮🇩", "Ivorian": "🇨🇮", "Jamaican": "🇯🇲",
  "Japanese": "🇯🇵", "Kenyan": "🇰🇪", "Korean": "🇰🇷",
  "Lebanese": "🇱🇧", "Mozambican": "🇲🇿", "Nigerian": "🇳🇬",
  "Pakistani": "🇵🇰", "Rwandan": "🇷🇼", "Samoan": "🇼🇸",
  "Seychellois": "🇸🇨", "Sierra Leonean": "🇸🇱", "Somali": "🇸🇴",
  "South African": "🇿🇦", "Sri Lankan": "🇱🇰", "Sudanese": "🇸🇩",
  "Swiss": "🇨🇭", "Tanzanian": "🇹🇿", "Togolese": "🇹🇬",
  "Tongan": "🇹🇴", "Ugandan": "🇺🇬", "Vietnamese": "🇻🇳",
  "Zimbabwean": "🇿🇼", "African": "🌍", "East Asian": "🌏",
  "Middle Eastern": "🌍", "South Asian": "🌏",
  "Polynesian / Pacific Islands": "🌊", "Other": "🌍"
};

function getFlag(ethnicity) {
  return FLAG_MAP[ethnicity] || "🌍";
}

// ═══════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════
let currentUser   = null;
let allModels     = [];
let inventoryData = [];
let activeChip    = 'all';
let staffViewMode = 'all';
let openModelData = null;
let isNewModel    = false;

// ═══════════════════════════════════════════════
// AUTH TABS
// ═══════════════════════════════════════════════
function showTab(tab) {
  const isSignin = tab === 'signin';
  document.getElementById('signin-section').classList.toggle('hidden', !isSignin);
  document.getElementById('signup-section').classList.toggle('hidden', isSignin);
  document.querySelectorAll('.auth-tab').forEach((t, i) => {
    t.classList.toggle('active', i === (isSignin ? 0 : 1));
  });
}

// ═══════════════════════════════════════════════
// SIGNUP FLOW
// ═══════════════════════════════════════════════
async function loadSignupNames() {
  const role = document.getElementById('signup-role').value;
  const modelFlow  = document.getElementById('model-signup-flow');
  const staffFlow  = document.getElementById('staff-signup-flow');
  const credGroup  = document.getElementById('signup-credentials-group');
  const btn        = document.getElementById('signup-btn');

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

    // Load existing models not yet registered
    const { data } = await sb.from('model_profiles').select('id, full_name').eq('registered', false).order('full_name');
    const sel = document.getElementById('signup-name');
    sel.innerHTML = '<option value="">— choose your name —</option>';
    (data || []).forEach(m => {
      sel.innerHTML += `<option value="${m.id}">${m.full_name}</option>`;
    });
    return;
  }

  // Staff / Admin
  staffFlow.classList.remove('hidden');
  credGroup.classList.remove('hidden');
  btn.classList.remove('hidden');

  const names = role === 'ADMIN' ? STAFF_NAMES.ADMIN : (STAFF_NAMES[role] || []);
  const staffSel = document.getElementById('signup-name-staff');
  staffSel.innerHTML = '<option value="">— choose your name —</option>';
  names.forEach(n => {
    staffSel.innerHTML += `<option value="${n}">${n}</option>`;
  });

  // Show conditional cultural/talent fields
  document.getElementById('new-cultural').addEventListener('change', function() {
    document.getElementById('new-cultural-desc-group').style.display = this.value === 'true' ? 'block' : 'none';
  });
  document.getElementById('new-talent').addEventListener('change', function() {
    document.getElementById('new-talent-desc-group').style.display = this.value === 'true' ? 'block' : 'none';
  });
}

function toggleNewModel() {
  isNewModel = !isNewModel;
  document.getElementById('new-model-form').classList.toggle('hidden', !isNewModel);
  document.getElementById('existing-model-section').classList.toggle('hidden', isNewModel);
  const toggle = document.querySelector('.new-model-toggle');
  if (isNewModel) {
    toggle.style.background = 'var(--brown)';
    toggle.style.borderColor = 'var(--brown)';
    toggle.querySelector('.new-model-toggle-text').style.color = 'white';
    toggle.querySelector('.new-model-toggle-sub').style.color = 'rgba(255,255,255,.7)';
    toggle.querySelector('.new-model-toggle-icon').textContent = '✓';
  } else {
    toggle.style.background = '';
    toggle.style.borderColor = '';
    toggle.querySelector('.new-model-toggle-text').style.color = '';
    toggle.querySelector('.new-model-toggle-sub').style.color = '';
    toggle.querySelector('.new-model-toggle-icon').textContent = '✨';
  }
}

function previewProfile(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    const preview = document.getElementById('profile-preview');
    preview.innerHTML = `<img src="${e.target.result}" style="width:100%;height:100%;object-fit:cover;border-radius:50%"/>`;
    preview.appendChild(input);
  };
  reader.readAsDataURL(file);
}

// ═══════════════════════════════════════════════
// SIGN UP
// ═══════════════════════════════════════════════
async function signUp() {
  const role     = document.getElementById('signup-role').value;
  const username = document.getElementById('signup-username').value.trim().toLowerCase();
  const pin      = document.getElementById('signup-pin').value.trim();
  document.getElementById('signup-error').textContent = '';

  if (!role)     { showError('signup-error', 'Select your role.'); return; }
  if (!username) { showError('signup-error', 'Choose a username.'); return; }
  if (pin.length !== 4 || isNaN(Number(pin))) { showError('signup-error', 'PIN must be exactly 4 digits.'); return; }

  if (role === 'MODEL') {
    if (isNewModel) {
      await signUpNewModel(username, pin);
    } else {
      await signUpExistingModel(username, pin);
    }
    return;
  }

  // Staff / Admin
  const nameVal = document.getElementById('signup-name-staff').value;
  if (!nameVal) { showError('signup-error', 'Select your name.'); return; }

  const { data: existing } = await sb.from('users').select('id').eq('username', username).maybeSingle();
  if (existing) { showError('signup-error', 'Username already taken.'); return; }

  const { error } = await sb.from('users').insert({ name: nameVal, role, username, pin });
  if (error) { showError('signup-error', error.message); return; }
  toast('Account created! Sign in now.');
  showTab('signin');
}

async function signUpExistingModel(username, pin) {
  const nameVal = document.getElementById('signup-name').value;
  if (!nameVal) { showError('signup-error', 'Select your name from the list.'); return; }

  const { data: existing } = await sb.from('model_profiles').select('id').eq('username', username).maybeSingle();
  if (existing) { showError('signup-error', 'Username already taken.'); return; }

  const { error } = await sb.from('model_profiles').update({ username, pin, registered: true }).eq('id', nameVal);
  if (error) { showError('signup-error', error.message); return; }
  toast('Account created! Sign in now.');
  showTab('signin');
}

async function signUpNewModel(username, pin) {
  const fullName = document.getElementById('new-full-name').value.trim();
  if (!fullName) { showError('signup-error', 'Enter your full name.'); return; }

  const { data: existing } = await sb.from('model_profiles').select('id').eq('username', username).maybeSingle();
  if (existing) { showError('signup-error', 'Username already taken.'); return; }

  const profileInput = document.getElementById('profile-photo-input');
  const face1Input   = document.getElementById('new-face1');
  const face2Input   = document.getElementById('new-face2');

  let profileUrl  = '';
  let facePhotos  = [];

  // Upload profile photo
  if (profileInput.files[0]) {
    const file = profileInput.files[0];
    const path = `new_${Date.now()}/profile/${file.name}`;
    const { error } = await sb.storage.from('model-photos').upload(path, file, { upsert: true });
    if (!error) {
      const { data } = sb.storage.from('model-photos').getPublicUrl(path);
      profileUrl = data.publicUrl;
    }
  }

  // Upload face photos
  for (const input of [face1Input, face2Input]) {
    if (input.files[0]) {
      const file = input.files[0];
      const path = `new_${Date.now()}/face/${file.name}`;
      const { error } = await sb.storage.from('model-photos').upload(path, file, { upsert: true });
      if (!error) {
        const { data } = sb.storage.from('model-photos').getPublicUrl(path);
        facePhotos.push(data.publicUrl);
      }
    }
  }

  const payload = {
    full_name:      fullName,
    instagram:      document.getElementById('new-instagram').value.trim(),
    phone:          document.getElementById('new-phone').value.trim(),
    age:            parseInt(document.getElementById('new-age').value) || null,
    gender:         document.getElementById('new-gender').value,
    ethnicity:      document.getElementById('new-ethnicity').value,
    height:         document.getElementById('new-height').value.trim(),
    top_size:       document.getElementById('new-top').value,
    jean_size:      document.getElementById('new-jeans').value.trim(),
    suburb:         document.getElementById('new-suburb').value.trim(),
    style:          document.getElementById('new-style').value.trim(),
    cultural_piece: document.getElementById('new-cultural').value === 'true',
    cultural_desc:  document.getElementById('new-cultural-desc').value.trim(),
    talent:         document.getElementById('new-talent').value === 'true',
    talent_desc:    document.getElementById('new-talent-desc').value.trim(),
    free_5july:     document.getElementById('new-free').value === 'true',
    hair_ok:        document.getElementById('new-hair-ok').value === 'true',
    makeup_self:    document.getElementById('new-makeup-self').value === 'true',
    agency:         document.getElementById('new-agency').value,
    username,
    pin,
    registered:     true,
    approved:       false,
    profile_photo:  profileUrl,
    face_photos:    facePhotos,
    photos:         [],
    hair_photos:    [],
    mua_photos:     [],
    tags:           [],
    notes:          '',
    checklist_outfit: false,
    checklist_hair:   false,
    checklist_makeup: false,
  };

  const { error } = await sb.from('model_profiles').insert(payload);
  if (error) { showError('signup-error', error.message); return; }
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

  if (!username || !pin) { showError('signin-error', 'Enter your username and PIN.'); return; }

  // Try models
  const { data: model } = await sb.from('model_profiles').select('*').eq('username', username).maybeSingle();
  if (model) {
    if (model.pin !== pin) { showError('signin-error', 'Incorrect PIN.'); return; }
    currentUser = { id: model.id, name: model.full_name, role: 'MODEL', username };
    showModelDashboard(model);
    return;
  }

  // Try staff
  const { data: user } = await sb.from('users').select('*').eq('username', username).maybeSingle();
  if (!user) { showError('signin-error', 'Username not found.'); return; }
  if (user.pin !== pin) { showError('signin-error', 'Incorrect PIN.'); return; }

  currentUser = { id: user.id, name: user.name, role: user.role, username };

  if (user.role === 'ADMIN') {
    showAdminDashboard();
  } else {
    showStaffDashboard(user);
  }
}

// ═══════════════════════════════════════════════
// LOGOUT
// ═══════════════════════════════════════════════
function logout() {
  currentUser = null;
  allModels   = [];
  document.querySelectorAll('.dashboard').forEach(d => d.classList.add('hidden'));
  document.getElementById('auth-screen').classList.remove('hidden');
  document.getElementById('signin-username').value = '';
  document.getElementById('signin-pin').value = '';
}

// ═══════════════════════════════════════════════
// LOAD MODELS
// ═══════════════════════════════════════════════
async function loadAllModels() {
  const { data } = await sb.from('model_profiles').select('*').order('full_name');
  allModels = data || [];
}

// ═══════════════════════════════════════════════
// ADMIN DASHBOARD
// ═══════════════════════════════════════════════
async function showAdminDashboard() {
  hideAll();
  document.getElementById('admin-dashboard').classList.remove('hidden');
  document.getElementById('admin-name-display').textContent = currentUser.name;
  await loadAllModels();
  renderAdminModels();
}

function adminNav(page, btn) {
  document.querySelectorAll('#admin-dashboard .nav-item').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  ['admin-models-panel','admin-inventory-panel','admin-team-panel'].forEach(id => {
    document.getElementById(id).classList.add('hidden');
  });
  document.getElementById('model-search').style.display = page === 'models' ? '' : 'none';
  const titles = { models: 'All Models', inventory: 'Inventory', team: 'Team' };
  document.getElementById('admin-page-title').textContent = titles[page] || '';
  if (page === 'models')    { document.getElementById('admin-models-panel').classList.remove('hidden'); renderAdminModels(); }
  else if (page === 'inventory') { document.getElementById('admin-inventory-panel').classList.remove('hidden'); loadInventory(); }
  else if (page === 'team') { document.getElementById('admin-team-panel').classList.remove('hidden'); renderTeam(); }
}

function renderAdminModels(search) {
  let list = allModels;
  if (search) {
    const q = search.toLowerCase();
    list = list.filter(m => (m.full_name||'').toLowerCase().includes(q) || (m.instagram||'').toLowerCase().includes(q) || (m.suburb||'').toLowerCase().includes(q));
  }
  if (activeChip === 'approved')  list = list.filter(m => m.approved);
  if (activeChip === 'pending')   list = list.filter(m => !m.approved);
  if (activeChip === 'cultural')  list = list.filter(m => m.cultural_piece);
  if (activeChip === 'talent')    list = list.filter(m => m.talent);
  if (activeChip === 'busy')      list = list.filter(m => !m.free_5july);
  if (activeChip === 'checklist') list = list.filter(m => !m.checklist_outfit || !m.checklist_hair || !m.checklist_makeup);

  const grid = document.getElementById('admin-model-grid');
  if (!grid) return;
  grid.innerHTML = list.length ? list.map(m => modelCardHTML(m, true)).join('') : '<div class="loading-center" style="grid-column:1/-1">No models found</div>';
}

function filterModels(val) { renderAdminModels(val); }

function setChip(btn, val) {
  activeChip = val;
  document.querySelectorAll('#admin-filter-row .chip').forEach(c => c.classList.remove('active'));
  btn.classList.add('active');
  renderAdminModels(document.getElementById('model-search')?.value || '');
}

// ═══════════════════════════════════════════════
// MODEL CARD HTML
// ═══════════════════════════════════════════════
function modelCardHTML(m, isAdmin) {
  const initials  = (m.full_name||'??').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
  const avatar    = m.profile_photo ? `<img src="${m.profile_photo}" alt=""/>` : initials;
  const approved  = m.approved;
  const flag      = getFlag(m.ethnicity);

  const checklistDone = m.checklist_outfit && m.checklist_hair && m.checklist_makeup;

  const assignDropdowns = isAdmin ? `
    <div class="card-footer">
      <select class="assign-select" title="Stylist" onchange="assignField('${m.id}','assigned_stylist',this.value);event.stopPropagation()">
        <option value="">Stylist…</option>
        ${STAFF_NAMES.STYLIST.map(s=>`<option value="${s}"${m.assigned_stylist===s?' selected':''}>${s}</option>`).join('')}
      </select>
      <select class="assign-select" title="Hair" onchange="assignField('${m.id}','assigned_hair',this.value);event.stopPropagation()">
        <option value="">Hair…</option>
        ${STAFF_NAMES.HAIR_STYLIST.map(s=>`<option value="${s}"${m.assigned_hair===s?' selected':''}>${s}</option>`).join('')}
      </select>
      <select class="assign-select" title="MUA" onchange="assignField('${m.id}','assigned_makeup',this.value);event.stopPropagation()">
        <option value="">MUA…</option>
        ${STAFF_NAMES.MAKEUP_ARTIST.map(s=>`<option value="${s}"${m.assigned_makeup===s?' selected':''}>${s}</option>`).join('')}
      </select>
      <button class="btn-approve${approved?' btn-approved':''}" onclick="toggleApprove('${m.id}');event.stopPropagation()">
        ${approved ? '✓ Approved' : 'Approve'}
      </button>
    </div>
  ` : `
    <div class="card-footer">
      ${m.assigned_stylist  ? `<span class="badge badge-outline">Stylist: ${m.assigned_stylist}</span>` : ''}
      ${m.assigned_hair     ? `<span class="badge badge-outline">Hair: ${m.assigned_hair}</span>`       : ''}
      ${m.assigned_makeup   ? `<span class="badge badge-outline">MUA: ${m.assigned_makeup}</span>`      : ''}
    </div>
  `;

  return `
    <div class="model-card${approved?' approved':''}" onclick="openModelPanel('${m.id}')">
      <div class="card-top">
        <div class="card-avatar">${avatar}</div>
        <div class="card-name-block">
          <div class="card-name">${m.full_name||'—'} <span style="font-size:16px">${flag}</span></div>
          <div class="card-handle">${m.instagram?'@'+m.instagram:'—'}</div>
        </div>
        <div class="card-badges">
          <span class="badge ${approved?'badge-brown':'badge-outline'}">${approved?'✓':'Pending'}</span>
          <span class="badge ${m.gender==='Male'?'badge-blue':'badge-pink'}">${m.gender||'—'}</span>
          ${!checklistDone?'<span class="badge badge-red">⚠</span>':'<span class="badge badge-cream">✓ Ready</span>'}
        </div>
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:10px">
        ${m.ethnicity?`<span class="badge badge-outline">${m.ethnicity}</span>`:''}
        ${m.talent?'<span class="badge badge-blue">🎤 Talent</span>':''}
        ${m.agency&&m.agency!=='no'?'<span class="badge badge-yellow">Signed</span>':''}
        ${!m.free_5july?'<span class="badge badge-red">⚠ Busy AM</span>':''}
      </div>
      <div class="card-details">
        <div class="card-row"><span>Size</span><span>Top ${m.top_size||'—'} · Jean ${m.jean_size||'—'}</span></div>
        <div class="card-row"><span>Height</span><span>${m.height||'—'}</span></div>
        <div class="card-row"><span>Suburb</span><span>${m.suburb||'—'}</span></div>
      </div>
      <div class="checklist" onclick="event.stopPropagation()">
        <div class="check-item${m.checklist_outfit?' checked':''}" onclick="toggleChecklist('${m.id}','checklist_outfit',${!m.checklist_outfit})">
          <span class="check-icon">${m.checklist_outfit?'✓':'○'}</span> Outfit
        </div>
        <div class="check-item${m.checklist_hair?' checked':''}" onclick="toggleChecklist('${m.id}','checklist_hair',${!m.checklist_hair})">
          <span class="check-icon">${m.checklist_hair?'✓':'○'}</span> Hair
        </div>
        <div class="check-item${m.checklist_makeup?' checked':''}" onclick="toggleChecklist('${m.id}','checklist_makeup',${!m.checklist_makeup})">
          <span class="check-icon">${m.checklist_makeup?'✓':'○'}</span> Makeup
        </div>
      </div>
      ${assignDropdowns}
    </div>
  `;
}

// ═══════════════════════════════════════════════
// CHECKLIST
// ═══════════════════════════════════════════════
async function toggleChecklist(id, field, value) {
  const { error } = await sb.from('model_profiles').update({ [field]: value }).eq('id', id);
  if (error) { toast('Error', true); return; }
  const m = allModels.find(x => String(x.id) === String(id));
  if (m) m[field] = value;
  if (currentUser?.role === 'ADMIN') renderAdminModels(document.getElementById('model-search')?.value || '');
  else renderStaffModels();
  toast(value ? 'Confirmed ✓' : 'Unchecked');
}

// ═══════════════════════════════════════════════
// ASSIGN & APPROVE
// ═══════════════════════════════════════════════
async function assignField(id, field, value) {
  const { error } = await sb.from('model_profiles').update({ [field]: value }).eq('id', id);
  if (error) { toast('Error saving', true); return; }
  const m = allModels.find(x => String(x.id) === String(id));
  if (m) m[field] = value;
  toast('Saved');
}

async function toggleApprove(id) {
  const m = allModels.find(x => String(x.id) === String(id));
  if (!m) return;
  const newVal = !m.approved;
  const { error } = await sb.from('model_profiles').update({ approved: newVal }).eq('id', id);
  if (error) { toast('Error', true); return; }
  m.approved = newVal;
  renderAdminModels(document.getElementById('model-search')?.value || '');
  toast((m.full_name||'Model').split(' ')[0] + ' ' + (newVal ? 'approved ✓' : 'unapproved'));
}

// ═══════════════════════════════════════════════
// MODEL DETAIL PANEL
// ═══════════════════════════════════════════════
async function openModelPanel(id) {
  const m = allModels.find(x => String(x.id) === String(id));
  if (!m) return;
  openModelData = m;

  const flag = getFlag(m.ethnicity);
  document.getElementById('panel-name').textContent   = m.full_name || '—';
  document.getElementById('panel-handle').textContent = m.instagram ? '@' + m.instagram : '';
  document.getElementById('panel-flag').textContent   = flag;

  const isAdmin = currentUser?.role === 'ADMIN';
  const photos  = m.photos       || [];
  const hairPh  = m.hair_photos  || [];
  const muaPh   = m.mua_photos   || [];
  const facePh  = m.face_photos  || [];
  const tags    = m.tags         || [];

  document.getElementById('panel-body').innerHTML = `
    <div>
      <div class="panel-section-title">Checklist</div>
      <div class="checklist">
        <div class="check-item${m.checklist_outfit?' checked':''}" onclick="toggleChecklist('${m.id}','checklist_outfit',${!m.checklist_outfit});rerenderPanel('${m.id}')">
          <span class="check-icon">${m.checklist_outfit?'✓':'○'}</span> Outfit Confirmed
        </div>
        <div class="check-item${m.checklist_hair?' checked':''}" onclick="toggleChecklist('${m.id}','checklist_hair',${!m.checklist_hair});rerenderPanel('${m.id}')">
          <span class="check-icon">${m.checklist_hair?'✓':'○'}</span> Hair Done
        </div>
        <div class="check-item${m.checklist_makeup?' checked':''}" onclick="toggleChecklist('${m.id}','checklist_makeup',${!m.checklist_makeup});rerenderPanel('${m.id}')">
          <span class="check-icon">${m.checklist_makeup?'✓':'○'}</span> Makeup Done
        </div>
      </div>
    </div>

    <div>
      <div class="panel-section-title">Application Details</div>
      <div class="detail-grid">
        <div class="detail-item"><label>Age</label><div class="val">${m.age||'—'}</div></div>
        <div class="detail-item"><label>Gender</label><div class="val">${m.gender||'—'}</div></div>
        <div class="detail-item"><label>Ethnicity</label><div class="val">${flag} ${m.ethnicity||'—'}</div></div>
        <div class="detail-item"><label>Height</label><div class="val">${m.height||'—'}</div></div>
        <div class="detail-item"><label>Top Size</label><div class="val">${m.top_size||'—'}</div></div>
        <div class="detail-item"><label>Jean Size</label><div class="val">${m.jean_size||'—'}</div></div>
        <div class="detail-item"><label>Followers</label><div class="val">${m.followers||'—'}</div></div>
        <div class="detail-item"><label>Suburb</label><div class="val">${m.suburb||'—'}</div></div>
        ${isAdmin?`<div class="detail-item"><label>Phone</label><div class="val">${m.phone||'—'}</div></div>`:''}
        <div class="detail-item"><label>Agency</label><div class="val">${m.agency||'—'}</div></div>
        <div class="detail-item"><label>Free Jul 5</label><div class="val">${m.free_5july?'Yes':'⚠ Busy AM'}</div></div>
        <div class="detail-item"><label>Hair Change OK</label><div class="val">${m.hair_ok?'Yes':'No'}</div></div>
        <div class="detail-item"><label>Own Makeup</label><div class="val">${m.makeup_self?'Yes':'Needs MUA'}</div></div>
        <div class="detail-item"><label>Style</label><div class="val">${m.style||'—'}</div></div>
      </div>
    </div>

    ${m.talent?`<div><div class="panel-section-title">Talent</div><div class="val">${m.talent_desc||'—'}</div></div>`:''}
    ${m.cultural_piece?`<div><div class="panel-section-title">Cultural Piece</div><div class="val">${m.cultural_desc||'—'}</div></div>`:''}
    ${m.portfolio?`<div><div class="panel-section-title">Portfolio</div><a href="${m.portfolio}" target="_blank" style="color:var(--brown);font-size:12px;font-family:var(--font-mono);text-decoration:underline">View →</a></div>`:''}

    ${isAdmin?`
    <div>
      <div class="panel-section-title">Staff Assignment</div>
      <div class="assign-grid">
        <div class="form-group" style="margin-bottom:0">
          <label>Stylist</label>
          <div class="select-wrap">
            <select onchange="assignField('${m.id}','assigned_stylist',this.value)">
              <option value="">Unassigned</option>
              ${STAFF_NAMES.STYLIST.map(s=>`<option value="${s}"${m.assigned_stylist===s?' selected':''}>${s}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="form-group" style="margin-bottom:0">
          <label>Hair Stylist</label>
          <div class="select-wrap">
            <select onchange="assignField('${m.id}','assigned_hair',this.value)">
              <option value="">Unassigned</option>
              ${STAFF_NAMES.HAIR_STYLIST.map(s=>`<option value="${s}"${m.assigned_hair===s?' selected':''}>${s}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="form-group" style="margin-bottom:0">
          <label>Makeup Artist</label>
          <div class="select-wrap">
            <select onchange="assignField('${m.id}','assigned_makeup',this.value)">
              <option value="">Unassigned</option>
              ${STAFF_NAMES.MAKEUP_ARTIST.map(s=>`<option value="${s}"${m.assigned_makeup===s?' selected':''}>${s}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="form-group" style="margin-bottom:0">
          <label>Status</label>
          <button class="btn btn-sm ${m.approved?'btn-brown':'btn-ghost'}" onclick="toggleApprove('${m.id}')">
            ${m.approved?'✓ Approved':'Approve'}
          </button>
        </div>
      </div>
    </div>

    <div>
      <div class="panel-section-title">Tags</div>
      <div class="tag-row">
        <input type="text" id="tag-input" placeholder="Add tag…" onkeydown="if(event.key==='Enter')addPanelTag()"/>
        <button class="btn btn-sm btn-brown" style="width:auto;margin-top:0" onclick="addPanelTag()">+</button>
      </div>
      <div class="tags-wrap" id="panel-tags">
        ${tags.map(t=>`<span class="tag-pill" onclick="removePanelTag('${t}')">${t}<span class="x"> ×</span></span>`).join('')}
      </div>
    </div>

    <div>
      <div class="panel-section-title">Internal Notes</div>
      <textarea class="notes-field" id="panel-notes" onblur="saveNotes()" placeholder="Notes for the team…">${m.notes||''}</textarea>
    </div>
    `:''}

    ${facePh.length?`
    <div>
      <div class="panel-section-title">Face Close-Ups</div>
      <div class="photo-grid">${facePh.map(u=>`<div class="photo-thumb"><img src="${u}" alt=""/></div>`).join('')}</div>
    </div>`:''}

    <div>
      <div class="panel-section-title">Base Fit Photos</div>
      ${photos.length?`<div class="photo-grid">${photos.map(u=>`<div class="photo-thumb"><img src="${u}" alt=""/></div>`).join('')}</div>`:'<div class="no-photos">None uploaded yet</div>'}
    </div>

    <div>
      <div class="panel-section-title">Hair Inspo</div>
      ${hairPh.length?`<div class="photo-grid">${hairPh.map(u=>`<div class="photo-thumb"><img src="${u}" alt=""/></div>`).join('')}</div>`:'<div class="no-photos">None uploaded yet</div>'}
    </div>

    <div>
      <div class="panel-section-title">Makeup Inspo</div>
      ${muaPh.length?`<div class="photo-grid">${muaPh.map(u=>`<div class="photo-thumb"><img src="${u}" alt=""/></div>`).join('')}</div>`:'<div class="no-photos">None uploaded yet</div>'}
    </div>
  `;

  document.getElementById('model-panel-overlay').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

async function rerenderPanel(id) {
  const m = allModels.find(x => String(x.id) === String(id));
  if (m) openModelPanel(id);
}

function closePanel() {
  document.getElementById('model-panel-overlay').classList.add('hidden');
  document.body.style.overflow = '';
  openModelData = null;
}

function closeModelPanel(e) {
  if (e.target.id === 'model-panel-overlay') closePanel();
}

async function addPanelTag() {
  if (!openModelData) return;
  const input = document.getElementById('tag-input');
  const val   = input.value.trim();
  if (!val) return;
  const tags = [...(openModelData.tags||[])];
  if (!tags.includes(val)) tags.push(val);
  await sb.from('model_profiles').update({ tags }).eq('id', openModelData.id);
  openModelData.tags = tags;
  const m = allModels.find(x => String(x.id) === String(openModelData.id));
  if (m) m.tags = tags;
  input.value = '';
  document.getElementById('panel-tags').innerHTML = tags.map(t=>`<span class="tag-pill" onclick="removePanelTag('${t}')">${t}<span class="x"> ×</span></span>`).join('');
  toast('Tag added');
}

async function removePanelTag(tag) {
  if (!openModelData) return;
  const tags = (openModelData.tags||[]).filter(t=>t!==tag);
  await sb.from('model_profiles').update({ tags }).eq('id', openModelData.id);
  openModelData.tags = tags;
  const m = allModels.find(x => String(x.id) === String(openModelData.id));
  if (m) m.tags = tags;
  document.getElementById('panel-tags').innerHTML = tags.map(t=>`<span class="tag-pill" onclick="removePanelTag('${t}')">${t}<span class="x"> ×</span></span>`).join('');
}

async function saveNotes() {
  if (!openModelData) return;
  const notes = document.getElementById('panel-notes')?.value || '';
  await sb.from('model_profiles').update({ notes }).eq('id', openModelData.id);
  openModelData.notes = notes;
  const m = allModels.find(x => String(x.id) === String(openModelData.id));
  if (m) m.notes = notes;
  toast('Notes saved');
}

// ═══════════════════════════════════════════════
// STAFF DASHBOARD
// ═══════════════════════════════════════════════
async function showStaffDashboard(user) {
  hideAll();
  document.getElementById('staff-dashboard').classList.remove('hidden');
  document.getElementById('staff-name-display').textContent = user.name;
  const labels = { STYLIST:'Stylist', HAIR_STYLIST:'Hair Stylist', MAKEUP_ARTIST:'Makeup Artist' };
  document.getElementById('staff-role-display').textContent = labels[user.role] || 'Staff';
  await loadAllModels();
  staffViewMode = 'all';
  renderStaffModels();
}

function staffNav(mode, btn) {
  staffViewMode = mode;
  document.querySelectorAll('#staff-dashboard .nav-item').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('staff-page-title').textContent = mode==='all'?'All Models':'My Models';
  renderStaffModels();
}

function renderStaffModels(search) {
  const role = currentUser?.role;
  const name = currentUser?.name;
  let list = allModels;
  if (staffViewMode === 'mine') {
    if (role==='STYLIST')        list = list.filter(m=>m.assigned_stylist===name);
    if (role==='HAIR_STYLIST')   list = list.filter(m=>m.assigned_hair===name);
    if (role==='MAKEUP_ARTIST')  list = list.filter(m=>m.assigned_makeup===name);
  }
  if (search) {
    const q = search.toLowerCase();
    list = list.filter(m=>(m.full_name||'').toLowerCase().includes(q)||(m.instagram||'').toLowerCase().includes(q));
  }
  const grid = document.getElementById('staff-model-grid');
  if (!grid) return;
  grid.innerHTML = list.length ? list.map(m=>modelCardHTML(m,false)).join('') : '<div class="loading-center">No models here yet</div>';
}

function filterStaffModels(val) { renderStaffModels(val); }

// ═══════════════════════════════════════════════
// MODEL DASHBOARD
// ═══════════════════════════════════════════════
async function showModelDashboard(model) {
  hideAll();
  document.getElementById('model-dashboard').classList.remove('hidden');
  const flag     = getFlag(model.ethnicity);
  const approved = model.approved;
  const initials = (model.full_name||'??').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
  const photos   = model.photos      || [];
  const hairPh   = model.hair_photos || [];
  const muaPh    = model.mua_photos  || [];

  document.getElementById('model-profile-wrap').innerHTML = `
    <div class="model-profile-hero">
      <div class="model-hero-avatar">
        ${model.profile_photo?`<img src="${model.profile_photo}"/>`:''+initials}
      </div>
      <div>
        <div class="model-hero-name">${model.full_name||'—'}</div>
        <div class="model-hero-handle">${model.instagram?'@'+model.instagram:''}</div>
        <div class="model-hero-status">
          <span class="badge ${approved?'badge-brown':'badge-outline'}">${approved?'✓ Approved':'Pending Approval'}</span>
          <span class="model-hero-flag">${flag}</span>
        </div>
      </div>
    </div>

    <div class="model-profile-body">

      <div class="model-section">
        <div class="model-section-title">Checklist</div>
        <div class="checklist">
          <div class="check-item${model.checklist_outfit?' checked':''}"><span>${model.checklist_outfit?'✓':'○'}</span> Outfit Confirmed</div>
          <div class="check-item${model.checklist_hair?' checked':''}"><span>${model.checklist_hair?'✓':'○'}</span> Hair Done</div>
          <div class="check-item${model.checklist_makeup?' checked':''}"><span>${model.checklist_makeup?'✓':'○'}</span> Makeup Done</div>
        </div>
      </div>

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

      <div class="model-section">
        <div class="model-section-title">Upload Photos</div>
        <p style="font-size:12px;color:var(--dim);font-family:var(--font-mono);margin-bottom:16px">Upload your base fit photos, hair inspo, and makeup inspo.</p>
        <div class="upload-grid">
          <div>
            <label style="margin-bottom:8px">Base Fits</label>
            <div class="upload-zone" onclick="document.getElementById('up-fit').click()">
              <input type="file" id="up-fit" multiple accept="image/*" onchange="uploadPhotos(this,'photos','${model.id}')"/>
              <div class="upload-zone-icon">📸</div>
              <div class="upload-zone-text">Tap to upload</div>
            </div>
          </div>
          <div>
            <label style="margin-bottom:8px">Hair Inspo</label>
            <div class="upload-zone" onclick="document.getElementById('up-hair').click()">
              <input type="file" id="up-hair" multiple accept="image/*" onchange="uploadPhotos(this,'hair_photos','${model.id}')"/>
              <div class="upload-zone-icon">💇</div>
              <div class="upload-zone-text">Tap to upload</div>
            </div>
          </div>
          <div>
            <label style="margin-bottom:8px">Makeup Inspo</label>
            <div class="upload-zone" onclick="document.getElementById('up-mua').click()">
              <input type="file" id="up-mua" multiple accept="image/*" onchange="uploadPhotos(this,'mua_photos','${model.id}')"/>
              <div class="upload-zone-icon">💄</div>
              <div class="upload-zone-text">Tap to upload</div>
            </div>
          </div>
        </div>
        <div id="upload-status" style="font-size:11px;color:var(--dim);font-family:var(--font-mono);margin-top:12px"></div>
      </div>

      ${photos.length?`<div class="model-section"><div class="model-section-title">Your Fits</div><div class="photo-grid">${photos.map(u=>`<div class="photo-thumb"><img src="${u}"/></div>`).join('')}</div></div>`:''}
      ${hairPh.length?`<div class="model-section"><div class="model-section-title">Hair Inspo</div><div class="photo-grid">${hairPh.map(u=>`<div class="photo-thumb"><img src="${u}"/></div>`).join('')}</div></div>`:''}
      ${muaPh.length?`<div class="model-section"><div class="model-section-title">Makeup Inspo</div><div class="photo-grid">${muaPh.map(u=>`<div class="photo-thumb"><img src="${u}"/></div>`).join('')}</div></div>`:''}

    </div>
  `;
}

async function uploadPhotos(input, field, modelId) {
  const files = Array.from(input.files);
  if (!files.length) return;
  const status = document.getElementById('upload-status');
  if (status) status.textContent = 'Uploading…';
  const urls = [];
  for (const file of files) {
    const path = `${modelId}/${field}/${Date.now()}_${file.name}`;
    const { error } = await sb.storage.from('model-photos').upload(path, file, { upsert: true });
    if (!error) {
      const { data } = sb.storage.from('model-photos').getPublicUrl(path);
      urls.push(data.publicUrl);
    }
  }
  const { data: current } = await sb.from('model_profiles').select(field).eq('id', modelId).single();
  const existing = current?.[field] || [];
  await sb.from('model_profiles').update({ [field]: [...existing, ...urls] }).eq('id', modelId);
  if (status) status.textContent = `✓ ${urls.length} photo(s) uploaded`;
  toast('Photos uploaded ✓');
}

// ═══════════════════════════════════════════════
// INVENTORY
// ═══════════════════════════════════════════════
async function loadInventory() {
  const { data } = await sb.from('inventory').select('*').order('name');
  inventoryData = data || [];
  const count = document.getElementById('inv-count');
  if (count) count.textContent = inventoryData.length + ' items';
  const grid = document.getElementById('inv-grid');
  if (!grid) return;
  grid.innerHTML = inventoryData.length
    ? inventoryData.map(item=>`
        <div class="inv-card">
          <div class="inv-card-name">${item.name}</div>
          <div class="inv-card-meta">${item.category} · ${item.size_qty||'—'}</div>
          ${item.assigned_model?`<div class="inv-assigned">→ ${item.assigned_model}</div>`:'<div style="font-size:11px;color:var(--dim)">Unassigned</div>'}
          ${item.notes?`<div style="font-size:11px;color:var(--dim);margin-top:6px">${item.notes}</div>`:''}
        </div>`).join('')
    : '<div class="loading-center" style="background:var(--white);grid-column:1/-1;padding:40px;border-radius:var(--radius)">No items yet</div>';
}

function openInvModal() {
  const sel = document.getElementById('inv-model-assign');
  sel.innerHTML = '<option value="">Unassigned</option>';
  allModels.forEach(m => { sel.innerHTML += `<option value="${m.full_name}">${m.full_name}</option>`; });
  document.getElementById('inv-modal-overlay').classList.remove('hidden');
}

function closeInvModal(e) {
  if (e.target.id === 'inv-modal-overlay') document.getElementById('inv-modal-overlay').classList.add('hidden');
}

async function saveInvItem() {
  const item = {
    name:           document.getElementById('inv-name').value.trim(),
    category:       document.getElementById('inv-cat').value,
    size_qty:       document.getElementById('inv-size').value.trim(),
    assigned_model: document.getElementById('inv-model-assign').value,
    notes:          document.getElementById('inv-notes').value.trim(),
  };
  if (!item.name) { toast('Enter item name', true); return; }
  const { error } = await sb.from('inventory').insert(item);
  if (error) { toast('Error: ' + error.message, true); return; }
  toast('Item added ✓');
  document.getElementById('inv-modal-overlay').classList.add('hidden');
  loadInventory();
}

// ═══════════════════════════════════════════════
// TEAM
// ═══════════════════════════════════════════════
function renderTeam() {
  const staffList = [
    { name:'Christie', role:'Hair Stylist',  field:'assigned_hair'    },
    { name:'Maria',    role:'Hair Stylist',  field:'assigned_hair'    },
    { name:'Neza',     role:'Hair Stylist',  field:'assigned_hair'    },
    { name:'Rebecca',  role:'Makeup Artist', field:'assigned_makeup'  },
    { name:'Daniel',   role:'Stylist',       field:'assigned_stylist' },
    { name:'Dee',      role:'Stylist',       field:'assigned_stylist' },
    { name:'Komi',     role:'Stylist',       field:'assigned_stylist' },
  ];
  const grid = document.getElementById('team-grid');
  grid.innerHTML = staffList.map(s => {
    const assigned = allModels.filter(m=>m[s.field]===s.name);
    return `<div class="team-card">
      <div class="team-card-name">${s.name}</div>
      <div class="team-card-role">${s.role} · ${assigned.length} assigned</div>
      <div class="team-assigned-list">
        ${assigned.length
          ? assigned.map(m=>`<div class="team-assigned-item">${getFlag(m.ethnicity)} ${m.full_name}</div>`).join('')
          : '<div style="font-size:11px;color:var(--dim);font-family:var(--font-mono)">None assigned</div>'}
      </div>
    </div>`;
  }).join('');
}

// ═══════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════
function hideAll() {
  document.getElementById('auth-screen').classList.add('hidden');
  document.querySelectorAll('.dashboard').forEach(d=>d.classList.add('hidden'));
}

function showError(id, msg) {
  const el = document.getElementById(id);
  if (el) el.textContent = msg;
}

let toastTimer;
function toast(msg, isError) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = 'show' + (isError?' error':'');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(()=>{ el.className=''; }, 3000);
}
