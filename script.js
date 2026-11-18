// ====== 1. PASTE YOUR SUPABASE DETAILS HERE ======
// Supabase dashboard > Project Settings > API
const SUPABASE_URL = "https://hffugxwekpgpeqamcjyj.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_lkoWkIICOGaor9tlaHkUdQ__6F0K9rH"; // the public "anon" key, never the service_role key
// =================================================

// "Remember me" ticked -> session survives browser restarts (localStorage).
// Unticked -> session ends when the tab closes (sessionStorage).
function makeClient(remember) {
  return supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { storage: remember ? window.localStorage : window.sessionStorage, persistSession: true }
  });
}
let client = makeClient(true);

const $ = (id) => document.getElementById(id);
const views = { login: $("loginView"), signup: $("signupView"), welcome: $("welcomeView") };

function show(name) {
  Object.values(views).forEach((v) => v.classList.remove("active"));
  views[name].classList.add("active");
  setMsg("loginMsg", ""); setMsg("signupMsg", "");
}
function setMsg(id, text, type) {
  const el = $(id);
  el.textContent = text;
  el.className = "msg" + (type ? " " + type : "");
}
function busy(btn, on, label) {
  btn.disabled = on;
  btn.textContent = on ? "Please wait..." : label;
}
function friendly(err) {
  const m = (err && err.message) || "Something went wrong.";
  if (/invalid login/i.test(m)) return "Wrong email or password.";
  if (/already registered/i.test(m)) return "That email already has an account. Try logging in.";
  if (/rate limit/i.test(m)) return "Too many attempts. Please wait a bit and try again.";
  return m;
}
const emailOk = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

// Toggle views
$("toSignup").onclick = () => show("signup");
$("toLogin").onclick = () => show("login");

// Show / hide password
document.querySelectorAll(".eye").forEach((b) =>
  b.addEventListener("click", () => {
    const input = $(b.dataset.target);
    input.type = input.type === "password" ? "text" : "password";
  })
);

// LOGIN
$("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = $("loginEmail").value.trim();
  const password = $("loginPassword").value;
  if (!emailOk(email)) return setMsg("loginMsg", "Enter a valid email address.", "error");
  if (!password) return setMsg("loginMsg", "Enter your password.", "error");

  client = makeClient($("remember").checked);
  busy($("loginBtn"), true);
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  busy($("loginBtn"), false, "Login");
  if (error) return setMsg("loginMsg", friendly(error), "error");
  enterApp(data.user);
});

// SIGN UP
$("signupForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const full_name = $("signupName").value.trim();
  const email = $("signupEmail").value.trim();
  const password = $("signupPassword").value;
  const confirm = $("signupConfirm").value;

  if (full_name.length < 2) return setMsg("signupMsg", "Enter your full name.", "error");
  if (!emailOk(email)) return setMsg("signupMsg", "Enter a valid email address.", "error");
  if (password.length < 8) return setMsg("signupMsg", "Password must be at least 8 characters.", "error");
  if (password !== confirm) return setMsg("signupMsg", "Passwords do not match.", "error");

  busy($("signupBtn"), true);
  const { data, error } = await client.auth.signUp({
    email, password,
    options: { data: { full_name }, emailRedirectTo: window.location.href.split("#")[0] }
  });
  busy($("signupBtn"), false, "Create Account");
  if (error) return setMsg("signupMsg", friendly(error), "error");

  if (data.session) enterApp(data.user); // email confirmation turned off
  else setMsg("signupMsg", "Account created! Check your email to confirm, then log in.", "ok");
});

// FORGOT PASSWORD
$("forgotLink").addEventListener("click", async (e) => {
  e.preventDefault();
  const email = $("loginEmail").value.trim();
  if (!emailOk(email)) return setMsg("loginMsg", "Type your email above first, then tap Forgot Password.", "error");
  const { error } = await client.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.href.split("#")[0]
  });
  if (error) return setMsg("loginMsg", friendly(error), "error");
  setMsg("loginMsg", "Password reset link sent. Check your email.", "ok");
});

// LOGOUT
$("logoutBtn").addEventListener("click", async () => {
  await client.auth.signOut();
  show("login");
});

// SIGNED-IN VIEW
async function enterApp(user) {
  let name = user.user_metadata && user.user_metadata.full_name;
  const { data } = await client.from("profiles").select("full_name").eq("id", user.id).maybeSingle();
  if (data && data.full_name) name = data.full_name;
  $("welcomeText").textContent = "Signed in as " + (name ? name + " (" + user.email + ")" : user.email);
  show("welcome");
}

// Restore an existing session on page load
(async () => {
  if (SUPABASE_URL.startsWith("YOUR_")) {
    setMsg("loginMsg", "Add your Supabase URL and key in script.js first.", "error");
    return;
  }
  for (const remember of [true, false]) {
    const c = makeClient(remember);
    const { data } = await c.auth.getSession();
    if (data.session) { client = c; return enterApp(data.session.user); }
  }
})();
