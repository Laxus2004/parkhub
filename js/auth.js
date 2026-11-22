/* ==========================================================================
   ParkHub — Sign in & driver registration (index.html)
   ========================================================================== */

(function () {
  // Already signed in? Go straight to the right dashboard.
  var existing = Store.currentUser();
  if (existing) {
    window.location.replace(Shell.ROLE_PAGES[existing.role]);
    return;
  }

  var $ = function (id) {
    return document.getElementById(id);
  };

  var PW_RULES = [
    { label: "At least 8 characters", test: function (p) { return p.length >= 8; } },
    { label: "One uppercase letter (A–Z)", test: function (p) { return /[A-Z]/.test(p); } },
    { label: "One number (0–9)", test: function (p) { return /[0-9]/.test(p); } },
    { label: "One special character (!@#…)", test: function (p) { return /[^A-Za-z0-9]/.test(p); } },
  ];

  /* ---------- screen switching ---------- */
  function showLogin(registeredName) {
    $("register-screen").hidden = true;
    $("login-screen").hidden = false;
    var msg = $("registered-msg");
    if (registeredName) {
      msg.innerHTML = "✓ Account created for <b>" + UI.esc(registeredName) + "</b>.";
      msg.hidden = false;
    } else {
      msg.hidden = true;
    }
    $("login-username").focus();
  }

  function showRegister() {
    $("login-screen").hidden = true;
    $("register-screen").hidden = false;
    $("reg-first").focus();
  }

  $("go-register").addEventListener("click", showRegister);
  $("back-to-login").addEventListener("click", function () {
    showLogin();
  });
  $("back-to-login-2").addEventListener("click", function () {
    showLogin();
  });

  /* ---------- show / hide password ---------- */
  document.querySelectorAll("[data-toggle-pw]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var input = $(btn.getAttribute("data-toggle-pw"));
      var hidden = input.type === "password";
      input.type = hidden ? "text" : "password";
      btn.textContent = hidden ? "hide" : "show";
    });
  });

  /* ---------- sign in ---------- */
  var loginUser = $("login-username");
  var loginPass = $("login-password");
  var loginBtn = $("login-submit");
  var loginErr = $("login-error");

  function syncLoginButton() {
    loginBtn.disabled = !loginUser.value.trim() || !loginPass.value;
    loginErr.hidden = true;
  }
  loginUser.addEventListener("input", syncLoginButton);
  loginPass.addEventListener("input", syncLoginButton);

  $("login-form").addEventListener("submit", function (e) {
    e.preventDefault();
    loginBtn.disabled = true;
    loginBtn.textContent = "Signing in…";
    Store.login(loginUser.value, loginPass.value).then(function (result) {
      if (result.error) {
        loginErr.textContent = result.error;
        loginErr.hidden = false;
        loginBtn.textContent = "Sign In";
        loginBtn.disabled = false;
        return;
      }
      window.location.href = Shell.ROLE_PAGES[result.account.role];
    });
  });

  /* ---------- register ---------- */
  var f = {
    first: $("reg-first"),
    last: $("reg-last"),
    username: $("reg-username"),
    contact: $("reg-contact"),
    email: $("reg-email"),
    password: $("reg-password"),
    confirm: $("reg-confirm"),
  };
  var regBtn = $("register-submit");
  var regErr = $("register-error");

  function passwordState() {
    var pw = f.password.value;
    var passed = PW_RULES.map(function (r) {
      return r.test(pw);
    });
    return {
      passed: passed,
      valid: passed.every(Boolean),
      match: pw === f.confirm.value && f.confirm.value.length > 0,
    };
  }

  function renderPasswordFeedback() {
    var st = passwordState();
    var rules = $("pw-rules");
    rules.hidden = f.password.value.length === 0;
    rules.innerHTML = PW_RULES.map(function (r, i) {
      return '<li class="' + (st.passed[i] ? "ok" : "") + '"><span class="tick">' + (st.passed[i] ? "✓" : "·") + "</span>" + r.label + "</li>";
    }).join("");

    var match = $("pw-match");
    f.confirm.classList.remove("is-valid", "is-invalid");
    if (f.confirm.value.length > 0) {
      f.confirm.classList.add(st.match ? "is-valid" : "is-invalid");
      match.hidden = false;
      match.className = "field-hint " + (st.match ? "text-green" : "text-red");
      match.textContent = st.match ? "✓ Passwords match." : "Passwords do not match.";
    } else {
      match.hidden = true;
    }

    regBtn.disabled =
      !f.username.value.trim() ||
      !f.first.value.trim() ||
      !f.last.value.trim() ||
      !f.contact.value.trim() ||
      !f.email.value.trim() ||
      !st.valid ||
      !st.match;
  }

  f.username.addEventListener("input", function () {
    f.username.value = f.username.value.replace(/\s/g, "");
  });
  f.contact.addEventListener("input", function () {
    f.contact.value = f.contact.value.replace(/[^\d+\s\-()]/g, "");
  });
  Object.keys(f).forEach(function (k) {
    f[k].addEventListener("input", function () {
      regErr.hidden = true;
      renderPasswordFeedback();
    });
  });

  $("register-form").addEventListener("submit", function (e) {
    e.preventDefault();
    var st = passwordState();
    if (!st.valid || !st.match) {
      regErr.textContent = !st.valid ? "Please meet all password requirements." : "Passwords do not match.";
      regErr.hidden = false;
      return;
    }
    regBtn.disabled = true;
    regBtn.textContent = "Creating account…";
    Store.register({
      username: f.username.value,
      firstName: f.first.value,
      lastName: f.last.value,
      contact: f.contact.value,
      email: f.email.value,
      password: f.password.value,
    }).then(function (result) {
      regBtn.textContent = "Create Account";
      if (result.error) {
        regErr.textContent = result.error;
        regErr.hidden = false;
        regBtn.disabled = false;
        return;
      }
      document.getElementById("register-form").reset();
      renderPasswordFeedback();
      showLogin(result.displayName);
    });
  });
})();
