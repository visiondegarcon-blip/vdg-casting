const SUPABASE_URL = "https://dyruvkzuasaiofkxdvid.supabase.co";
const SUPABASE_KEY = "sb_publishable_tKMXDxTa-uICYsBE3OUh7A_RsoGFhhf";

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);

let currentUser = null;

// ---------- ELEMENTS ----------

const signinSection = document.getElementById("signin-section");
const signupSection = document.getElementById("signup-section");

const showSigninBtn = document.getElementById("show-signin");
const showSignupBtn = document.getElementById("show-signup");

const signinRole = document.getElementById("signin-role");
const signinUser = document.getElementById("signin-user");
const signinPin = document.getElementById("signin-pin");

const signupRole = document.getElementById("signup-role");
const signupName = document.getElementById("signup-name");
const signupPin = document.getElementById("signup-pin");

const modelUploadSection = document.getElementById(
  "model-upload-section"
);

// ---------- START ----------

init();

async function init() {
  bindEvents();
}

function bindEvents() {

  showSigninBtn.addEventListener("click", () => {
    signinSection.classList.remove("hidden");
    signupSection.classList.add("hidden");
  });

  showSignupBtn.addEventListener("click", () => {
    signupSection.classList.remove("hidden");
    signinSection.classList.add("hidden");
  });

  signinRole.addEventListener("change", loadSigninUsers);

  signupRole.addEventListener("change", loadSignupOptions);

  document
    .getElementById("signin-btn")
    .addEventListener("click", signIn);

  document
    .getElementById("signup-btn")
    .addEventListener("click", signUp);

  document.querySelectorAll(".logout-btn")
    .forEach(btn => {
      btn.addEventListener("click", logout);
    });

}

// ---------- SIGN IN ----------

async function loadSigninUsers() {

  const role = signinRole.value;

  signinUser.innerHTML =
    `<option value="">Select User</option>`;

  if (!role) return;

  if (role === "MODEL") {

    const { data } = await supabaseClient
      .from("model_profiles")
      .select("*")
      .eq("registered", true);

    data?.forEach(model => {

      signinUser.innerHTML += `
        <option value="${model.id}">
          ${model.full_name}
        </option>
      `;

    });

    return;
  }

  const { data } = await supabaseClient
    .from("users")
    .select("*")
    .eq("role", role);

  data?.forEach(user => {

    signinUser.innerHTML += `
      <option value="${user.id}">
        ${user.name}
      </option>
    `;

  });

}

// ---------- SIGN UP ----------

async function loadSignupOptions() {

  const role = signupRole.value;

  signupName.innerHTML =
    `<option value="">Select Name</option>`;

  modelUploadSection.classList.add("hidden");

  if (!role) return;

  if (role === "MODEL") {

    modelUploadSection.classList.remove("hidden");

    const { data } = await supabaseClient
      .from("model_profiles")
      .select("*")
      .eq("approved", true)
      .eq("registered", false);

    data?.forEach(model => {

      signupName.innerHTML += `
        <option value="${model.id}">
          ${model.full_name}
        </option>
      `;

    });

    return;
  }

  const { data } = await supabaseClient
    .from("users")
    .select("*")
    .eq("role", role);

  data?.forEach(user => {

    signupName.innerHTML += `
      <option value="${user.id}">
        ${user.name}
      </option>
    `;

  });

}

async function signUp() {

  const role = signupRole.value;
  const selectedId = signupName.value;
  const pin = signupPin.value;

  if (!selectedId || !pin) {
    alert("Please complete all fields.");
    return;
  }

  if (role === "MODEL") {

    await supabaseClient
      .from("model_profiles")
      .update({
        pin,
        registered: true
      })
      .eq("id", selectedId);

    alert("Account created.");
    return;
  }

  await supabaseClient
    .from("users")
    .update({
      pin
    })
    .eq("id", selectedId);

  alert("Account created.");

}

// ---------- LOGIN ----------

async function signIn() {

  const role = signinRole.value;
  const selectedId = signinUser.value;
  const pin = signinPin.value;

  if (!selectedId || !pin) {
    alert("Complete all fields.");
    return;
  }

  if (role === "MODEL") {

    const { data } = await supabaseClient
      .from("model_profiles")
      .select("*")
      .eq("id", selectedId)
      .single();

    if (!data || data.pin !== pin) {
      alert("Invalid PIN");
      return;
    }

    currentUser = data;

    showDashboard("MODEL");

    return;
  }

  const { data } = await supabaseClient
    .from("users")
    .select("*")
    .eq("id", selectedId)
    .single();

  if (!data || data.pin !== pin) {
    alert("Invalid PIN");
    return;
  }

  currentUser = data;

  showDashboard(data.role);

}

// ---------- DASHBOARDS ----------

function hideAllDashboards() {

  document
    .querySelectorAll(".dashboard")
    .forEach(el => el.classList.add("hidden"));

  document
    .getElementById("auth-screen")
    .classList.add("hidden");

}

async function showDashboard(role) {

  hideAllDashboards();

  if (role === "ADMIN") {

    document
      .getElementById("admin-dashboard")
      .classList.remove("hidden");

    loadAdminModels();

    return;
  }

  if (role === "STYLIST") {

    document
      .getElementById("stylist-dashboard")
      .classList.remove("hidden");

    return;
  }

  if (role === "HAIR_STYLIST") {

    document
      .getElementById("hair-dashboard")
      .classList.remove("hidden");

    return;
  }

  if (role === "MAKEUP_ARTIST") {

    document
      .getElementById("makeup-dashboard")
      .classList.remove("hidden");

    return;
  }

  document
    .getElementById("model-dashboard")
    .classList.remove("hidden");

}

// ---------- ADMIN ----------

async function loadAdminModels() {

  const container =
    document.getElementById("admin-model-grid");

  container.innerHTML = "";

  const { data } = await supabaseClient
    .from("model_profiles")
    .select("*")
    .order("full_name");

  data?.forEach(model => {

    container.innerHTML += `
      <div class="model-card">

        <h2>${model.full_name}</h2>

        <div class="model-meta">

          <div>Instagram: ${model.instagram || ""}</div>
          <div>Age: ${model.age || ""}</div>
          <div>Height: ${model.height || ""}</div>

        </div>

      <div class="card-actions">

  <label>Stylist</label>
  <select onchange="assignStylist('${model.id}', this.value)">
    <option value="">Unassigned</option>
    <option value="Daniel">Daniel</option>
    <option value="Koami">Koami</option>
    <option value="Dee">Dee</option>
  </select>

  <label>Hair</label>
  <select onchange="assignHair('${model.id}', this.value)">
    <option value="">Unassigned</option>
    <option value="Neza">Neza</option>
    <option value="Christie">Christie</option>
    <option value="Marie">Marie</option>
  </select>

  <label>Makeup</label>
  <select onchange="assignMakeup('${model.id}', this.value)">
    <option value="">Unassigned</option>
    <option value="Rebecca">Rebecca</option>
  </select>

  <button
    onclick="approveModel('${model.id}')"
    class="approve-btn"
  >
    Approve
  </button>

  <button
    onclick="rejectModel('${model.id}')"
    class="reject-btn"
  >
    Reject
  </button>

</div>

      </div>
    `;

  });

}

// ---------- APPROVALS ----------

window.approveModel = async function(id) {

  await supabaseClient
    .from("model_profiles")
    .update({
      approved: true
    })
    .eq("id", id);

  loadAdminModels();

};

window.rejectModel = async function(id) {

  await supabaseClient
    .from("model_profiles")
    .update({
      approved: false
    })
    .eq("id", id);

  loadAdminModels();

};

// ---------- LOGOUT ----------
window.assignStylist = async function(id, stylist) {

  await supabaseClient
    .from("model_profiles")
    .update({
      assigned_stylist: stylist
    })
    .eq("id", id);

};

window.assignHair = async function(id, hair) {

  await supabaseClient
    .from("model_profiles")
    .update({
      assigned_hair: hair
    })
    .eq("id", id);

};

window.assignMakeup = async function(id, makeup) {

  await supabaseClient
    .from("model_profiles")
    .update({
      assigned_makeup: makeup
    })
    .eq("id", id);

};
function logout() {

  currentUser = null;

  document
    .querySelectorAll(".dashboard")
    .forEach(el => el.classList.add("hidden"));

  document
    .getElementById("auth-screen")
    .classList.remove("hidden");

}
