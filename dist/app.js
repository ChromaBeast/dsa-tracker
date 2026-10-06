// src/crypto.ts
function base64ToUint8Array(base64) {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0;i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}
function uint8ArrayToBase64(bytes) {
  let binary = "";
  for (let i = 0;i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
async function deriveKey(password, saltBytes) {
  const enc = new TextEncoder;
  const baseKey = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({
    name: "PBKDF2",
    salt: saltBytes,
    iterations: 1e5,
    hash: "SHA-256"
  }, baseKey, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}
async function deriveAuthHash(password, saltBytes) {
  const enc = new TextEncoder;
  const baseKey = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({
    name: "PBKDF2",
    salt: saltBytes,
    iterations: 1e5,
    hash: "SHA-256"
  }, baseKey, 256);
  return uint8ArrayToBase64(new Uint8Array(bits));
}
function isEncrypted(data) {
  return typeof data === "object" && data !== null && "encrypted" in data && data.encrypted === true;
}
async function decryptProgress(data, password) {
  if (!isEncrypted(data)) {
    return data;
  }
  const salt = base64ToUint8Array(data.salt);
  const iv = base64ToUint8Array(data.iv);
  const ciphertextWithTag = base64ToUint8Array(data.ciphertext);
  const key = await deriveKey(password, salt);
  const decryptedBuffer = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertextWithTag);
  const dec = new TextDecoder;
  return JSON.parse(dec.decode(decryptedBuffer));
}
async function encryptProgress(data, password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt);
  const encoded = new TextEncoder().encode(JSON.stringify(data));
  const ciphertextBuffer = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoded);
  return {
    encrypted: true,
    version: 1,
    salt: uint8ArrayToBase64(salt),
    iv: uint8ArrayToBase64(iv),
    ciphertext: uint8ArrayToBase64(new Uint8Array(ciphertextBuffer))
  };
}

// src/cloud.ts
var URL_KEY = "dsa_upstash_url";
var TOKEN_KEY = "dsa_upstash_token";
var DEFAULT_URL = "https://notable-lemming-203251.upstash.io";
var DEFAULT_TOKEN = "gQAAAAAAAxnzAQIgcDI2YzFhNTIwZWQ1MGI0MWY3OWM3OGVjZWVhYjUxNDQ4MQ";
function getCloudConfig() {
  const storedUrl = localStorage.getItem(URL_KEY);
  const storedToken = localStorage.getItem(TOKEN_KEY);
  if (storedUrl === "" || storedToken === "")
    return null;
  const url = storedUrl || DEFAULT_URL;
  const token = storedToken || DEFAULT_TOKEN;
  if (!url || !token)
    return null;
  return { url: url.replace(/\/+$/, ""), token: token.trim() };
}
async function redisGet(key) {
  const config = getCloudConfig();
  if (!config)
    return null;
  try {
    const res = await fetch(`${config.url}/get/${encodeURIComponent(key)}`, {
      headers: { Authorization: `Bearer ${config.token}` }
    });
    if (!res.ok)
      return null;
    const json = await res.json();
    let parsed = json.result;
    if (typeof parsed === "string") {
      try {
        parsed = JSON.parse(parsed);
      } catch {}
    }
    if (typeof parsed === "string") {
      try {
        parsed = JSON.parse(parsed);
      } catch {}
    }
    return parsed || null;
  } catch {
    return null;
  }
}
async function redisSet(key, value) {
  const config = getCloudConfig();
  if (!config)
    return false;
  try {
    const res = await fetch(`${config.url}/set/${encodeURIComponent(key)}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${config.token}`, "Content-Type": "application/json" },
      body: JSON.stringify(value)
    });
    return res.ok;
  } catch {
    return false;
  }
}
async function fetchUserAuth(username) {
  return redisGet(`dsa:user:${username.toLowerCase()}:auth`);
}
async function saveUserAuth(username, record) {
  const config = getCloudConfig();
  if (!config)
    return false;
  const ok = await redisSet(`dsa:user:${username.toLowerCase()}:auth`, record);
  if (ok) {
    try {
      await fetch(`${config.url}/sadd/dsa:users/${encodeURIComponent(username.toLowerCase())}`, {
        headers: { Authorization: `Bearer ${config.token}` }
      });
    } catch {}
  }
  return ok;
}
async function fetchUserLeetCode(username) {
  return redisGet(`dsa:user:${username.toLowerCase()}:leetcode`);
}
async function fetchUserManual(username, pin) {
  const payload = await redisGet(`dsa:user:${username.toLowerCase()}:manual`);
  if (!payload)
    return null;
  try {
    return await decryptProgress(payload, pin);
  } catch {
    return null;
  }
}
async function saveUserManual(username, pin, state) {
  try {
    const encrypted = await encryptProgress(state, pin);
    return await redisSet(`dsa:user:${username.toLowerCase()}:manual`, encrypted);
  } catch {
    return false;
  }
}

// src/auth.ts
var AUTH_USER_KEY = "dsa_current_user";
var AUTH_PIN_KEY = "dsa_current_pin";
function getCurrentSession() {
  const username = sessionStorage.getItem(AUTH_USER_KEY) || localStorage.getItem(AUTH_USER_KEY);
  const pin = sessionStorage.getItem(AUTH_PIN_KEY) || localStorage.getItem(AUTH_PIN_KEY);
  if (!username || !pin)
    return null;
  return { username, pin };
}
function setSession(username, pin, remember) {
  sessionStorage.setItem(AUTH_USER_KEY, username);
  sessionStorage.setItem(AUTH_PIN_KEY, pin);
  if (remember) {
    localStorage.setItem(AUTH_USER_KEY, username);
    localStorage.setItem(AUTH_PIN_KEY, pin);
  }
}
function clearSession() {
  sessionStorage.removeItem(AUTH_USER_KEY);
  sessionStorage.removeItem(AUTH_PIN_KEY);
  localStorage.removeItem(AUTH_USER_KEY);
  localStorage.removeItem(AUTH_PIN_KEY);
}
async function register(username, pin, remember) {
  const cleanUser = username.trim().toLowerCase();
  const cleanPin = pin.trim();
  if (cleanUser.length < 2)
    return { ok: false, error: "Username must be at least 2 characters." };
  if (cleanPin.length < 4)
    return { ok: false, error: "PIN must be at least 4 characters." };
  if (!getCloudConfig()) {
    setSession(cleanUser, cleanPin, remember);
    return { ok: true };
  }
  const existing = await fetchUserAuth(cleanUser);
  if (existing)
    return { ok: false, error: "Username already exists. Please Log In." };
  const saltBytes = crypto.getRandomValues(new Uint8Array(16));
  const authHash = await deriveAuthHash(cleanPin, saltBytes);
  const saltStr = uint8ArrayToBase64(saltBytes);
  const saved = await saveUserAuth(cleanUser, {
    salt: saltStr,
    authHash,
    createdAt: new Date().toISOString()
  });
  if (!saved)
    return { ok: false, error: "Failed to create profile. Check Upstash connection." };
  await saveUserManual(cleanUser, cleanPin, { d: {}, r: {} });
  setSession(cleanUser, cleanPin, remember);
  return { ok: true };
}
async function login(username, pin, remember) {
  const cleanUser = username.trim().toLowerCase();
  const cleanPin = pin.trim();
  if (!cleanUser || !cleanPin)
    return { ok: false, error: "Enter username and PIN." };
  if (!getCloudConfig()) {
    setSession(cleanUser, cleanPin, remember);
    return { ok: true };
  }
  const record = await fetchUserAuth(cleanUser);
  if (!record)
    return { ok: false, error: "User not found. Click Register." };
  const saltBytes = base64ToUint8Array(record.salt);
  const computedHash = await deriveAuthHash(cleanPin, saltBytes);
  if (computedHash !== record.authHash)
    return { ok: false, error: "Incorrect PIN." };
  setSession(cleanUser, cleanPin, remember);
  return { ok: true };
}
async function changePassword(username, oldPin, newPin) {
  const cleanUser = username.trim().toLowerCase();
  const cleanOld = oldPin.trim();
  const cleanNew = newPin.trim();
  if (cleanNew.length < 4)
    return { ok: false, error: "New PIN must be at least 4 characters." };
  if (cleanOld === cleanNew)
    return { ok: false, error: "New PIN must be different from current PIN." };
  const authRecord = await fetchUserAuth(cleanUser);
  if (!authRecord)
    return { ok: false, error: "User record not found." };
  const oldSalt = base64ToUint8Array(authRecord.salt);
  const oldHash = await deriveAuthHash(cleanOld, oldSalt);
  if (oldHash !== authRecord.authHash)
    return { ok: false, error: "Current PIN is incorrect." };
  const manualState = await fetchUserManual(cleanUser, cleanOld) || { d: {}, r: {} };
  const savedManual = await saveUserManual(cleanUser, cleanNew, manualState);
  if (!savedManual)
    return { ok: false, error: "Failed to re-encrypt progress with new PIN." };
  const newSaltBytes = crypto.getRandomValues(new Uint8Array(16));
  const newAuthHash = await deriveAuthHash(cleanNew, newSaltBytes);
  const newSaltStr = uint8ArrayToBase64(newSaltBytes);
  const savedAuth = await saveUserAuth(cleanUser, {
    salt: newSaltStr,
    authHash: newAuthHash,
    createdAt: authRecord.createdAt
  });
  if (!savedAuth)
    return { ok: false, error: "Failed to update authentication record." };
  const remember = !!localStorage.getItem(AUTH_USER_KEY);
  setSession(cleanUser, cleanNew, remember);
  return { ok: true };
}

// src/authModal.ts
function setupAuthModal(onAuthSuccess) {
  const authScreen = document.getElementById("auth-screen");
  const userInput = document.getElementById("auth-user");
  const pinInput = document.getElementById("auth-pin");
  const rememberCheck = document.getElementById("auth-remember");
  const submitBtn = document.getElementById("auth-submit-btn");
  const switchBtn = document.getElementById("auth-switch-btn");
  const titleEl = document.getElementById("auth-title");
  const descEl = document.getElementById("auth-desc");
  const errorEl = document.getElementById("auth-error");
  let isRegisterMode = false;
  function updateMode() {
    errorEl.textContent = "";
    if (isRegisterMode) {
      titleEl.textContent = "Create Profile";
      descEl.textContent = "Enter your LeetCode handle and choose an unlock PIN.";
      submitBtn.textContent = "Create Profile";
      switchBtn.textContent = "Already have a profile? Log In";
    } else {
      titleEl.textContent = "Welcome Back";
      descEl.textContent = "Enter your LeetCode handle and PIN to load your progress.";
      submitBtn.textContent = "Log In";
      switchBtn.textContent = "New user? Create a Profile";
    }
  }
  switchBtn.onclick = () => {
    isRegisterMode = !isRegisterMode;
    updateMode();
  };
  async function handleSubmit() {
    const user = userInput.value.trim();
    const pin = pinInput.value.trim();
    const remember = rememberCheck.checked;
    errorEl.textContent = "";
    if (!user || !pin) {
      errorEl.textContent = "Please fill in all fields.";
      return;
    }
    submitBtn.disabled = true;
    submitBtn.textContent = "Verifying...";
    const res = isRegisterMode ? await register(user, pin, remember) : await login(user, pin, remember);
    submitBtn.disabled = false;
    updateMode();
    if (res.ok) {
      authScreen.classList.add("hidden");
      await onAuthSuccess({ username: user.toLowerCase(), pin });
    } else {
      errorEl.textContent = res.error || "Authentication failed.";
    }
  }
  submitBtn.onclick = handleSubmit;
  pinInput.onkeydown = (e) => {
    if (e.key === "Enter")
      handleSubmit();
  };
  userInput.onkeydown = (e) => {
    if (e.key === "Enter")
      pinInput.focus();
  };
}
function showAuthModal() {
  const authScreen = document.getElementById("auth-screen");
  authScreen.classList.remove("hidden");
  const userInput = document.getElementById("auth-user");
  userInput.focus();
}

// src/cloudModal.ts
function setupCloudModal(cloudBtn) {
  const modal = document.getElementById("cloud-modal");
  const closeBtn = document.getElementById("close-cloud-btn");
  const okBtn = document.getElementById("ok-cloud-btn");
  const statusEl = document.getElementById("cloud-sync-status");
  function updateStatus() {
    const isConnected = !!getCloudConfig();
    cloudBtn.classList.toggle("active-cloud", isConnected);
    if (statusEl) {
      statusEl.textContent = isConnected ? "Connected \uD83D\uDFE2 — Changes sync across all devices in real-time." : "Local Only \uD83D\uDFE1 — Connect cloud to sync across devices.";
    }
  }
  updateStatus();
  cloudBtn.onclick = () => {
    updateStatus();
    modal.classList.remove("hidden");
  };
  closeBtn.onclick = () => modal.classList.add("hidden");
  if (okBtn)
    okBtn.onclick = () => modal.classList.add("hidden");
}

// src/curriculum.ts
var RAW_WEEKS = [
  ["Week 1: Arrays and hashing", "Hash map for lookups, sets for duplicates, sort then scan, prefix sums.", "two-sum:E,contains-duplicate:E,valid-anagram:E,majority-element:E,group-anagrams:M,top-k-frequent-elements:M,product-of-array-except-self:M,valid-sudoku:M,longest-consecutive-sequence:M,subarray-sum-equals-k:M,merge-intervals:M,sort-colors:M"],
  ["Week 2: Two pointers and sliding window", "Pointers from both ends on sorted data. Window grows right, shrinks left while invalid.", "valid-palindrome:E,best-time-to-buy-and-sell-stock:E,two-sum-ii-input-array-is-sorted:M,3sum:M,container-with-most-water:M,longest-substring-without-repeating-characters:M,longest-repeating-character-replacement:M,permutation-in-string:M,minimum-size-subarray-sum:M,trapping-rain-water:H,minimum-window-substring:H,sliding-window-maximum:H"],
  ["Week 3: Stack and binary search", "Monotonic stack for next greater element. Binary search on a sorted range or on the answer.", "valid-parentheses:E,binary-search:E,min-stack:M,evaluate-reverse-polish-notation:M,daily-temperatures:M,car-fleet:M,search-a-2d-matrix:M,koko-eating-bananas:M,find-minimum-in-rotated-sorted-array:M,search-in-rotated-sorted-array:M,time-based-key-value-store:M,largest-rectangle-in-histogram:H"],
  ["Week 4: Linked list and heap", "Dummy head node, slow and fast pointers. In Go, write the container/heap boilerplate once and memorize it. Start weekly mocks.", "reverse-linked-list:E,merge-two-sorted-lists:E,linked-list-cycle:E,kth-largest-element-in-a-stream:E,reorder-list:M,remove-nth-node-from-end-of-list:M,add-two-numbers:M,lru-cache:M,kth-largest-element-in-an-array:M,k-closest-points-to-origin:M,merge-k-sorted-lists:H,find-median-from-data-stream:H"],
  ["Week 5: Trees", "Recursion on left and right, return what the parent needs. BFS with a queue for levels.", "invert-binary-tree:E,maximum-depth-of-binary-tree:E,diameter-of-binary-tree:E,balanced-binary-tree:E,same-tree:E,subtree-of-another-tree:E,lowest-common-ancestor-of-a-binary-search-tree:M,binary-tree-level-order-traversal:M,binary-tree-right-side-view:M,count-good-nodes-in-binary-tree:M,validate-binary-search-tree:M,kth-smallest-element-in-a-bst:M"],
  ["Week 6: Hard trees, trie, backtracking", "Backtracking: choose, recurse, undo. Skip duplicates by sorting first.", "implement-trie-prefix-tree:M,construct-binary-tree-from-preorder-and-inorder-traversal:M,subsets:M,combination-sum:M,permutations:M,subsets-ii:M,combination-sum-ii:M,word-search:M,palindrome-partitioning:M,letter-combinations-of-a-phone-number:M,binary-tree-maximum-path-sum:H,serialize-and-deserialize-binary-tree:H"],
  ["Week 7: Graphs", "Grid DFS and BFS, multi-source BFS, topological sort, union-find, Dijkstra with a heap.", "number-of-islands:M,max-area-of-island:M,clone-graph:M,pacific-atlantic-water-flow:M,surrounded-regions:M,rotting-oranges:M,course-schedule:M,course-schedule-ii:M,redundant-connection:M,number-of-provinces:M,network-delay-time:M,word-ladder:H"],
  ["Week 8: 1D dynamic programming", "Define the state, write the recurrence, then add memoization or a table.", "climbing-stairs:E,min-cost-climbing-stairs:E,house-robber:M,house-robber-ii:M,longest-palindromic-substring:M,decode-ways:M,coin-change:M,maximum-product-subarray:M,word-break:M,longest-increasing-subsequence:M,partition-equal-subset-sum:M,palindromic-substrings:M"],
  ["Week 9: 2D DP, greedy, intervals", "Grid and two-string DP tables. Greedy: sort, then prove the local choice is safe.", "unique-paths:M,longest-common-subsequence:M,coin-change-ii:M,target-sum:M,edit-distance:M,best-time-to-buy-and-sell-stock-with-cooldown:M,maximum-subarray:M,jump-game:M,jump-game-ii:M,gas-station:M,non-overlapping-intervals:M,insert-interval:M"],
  ["Week 10: Gaps and mock rounds", "8 new problems. Then redo your 4 worst misses cold. Finish with 2 full mocks: 2 problems in 60 minutes.", "single-number:E,counting-bits:E,rotate-image:M,spiral-matrix:M,set-matrix-zeroes:M,sort-an-array:M,design-twitter:M,reconstruct-itinerary:H"]
];
var SMALL_WORDS = {
  a: 1,
  an: 1,
  of: 1,
  in: 1,
  to: 1,
  and: 1,
  from: 1,
  with: 1,
  the: 1,
  on: 1,
  for: 1,
  is: 1
};
var ACRONYMS = { lru: "LRU", bst: "BST", ii: "II", "3sum": "3Sum" };
function formatTitle(slug) {
  return slug.split("-").map((word, index) => ACRONYMS[word] || (index && SMALL_WORDS[word] ? word : word.charAt(0).toUpperCase() + word.slice(1))).join(" ");
}
function parseWeeks() {
  let totalProblems = 0;
  const weeks = RAW_WEEKS.map(([title, note, rawItems]) => {
    const problems = rawItems.split(",").map((item) => {
      const [slug, difficulty] = item.split(":");
      return { slug, difficulty };
    });
    totalProblems += problems.length;
    return { title, note, problems };
  });
  return { weeks, totalProblems };
}

// src/passwordModal.ts
function setupPasswordModal(pwdBtn, onPasswordChanged) {
  const modal = document.getElementById("pwd-modal");
  const closeBtn = document.getElementById("close-pwd-btn");
  const submitBtn = document.getElementById("pwd-submit-btn");
  const currentInput = document.getElementById("pwd-current");
  const newInput = document.getElementById("pwd-new");
  const confirmInput = document.getElementById("pwd-confirm");
  const statusEl = document.getElementById("pwd-status");
  pwdBtn.onclick = () => {
    currentInput.value = "";
    newInput.value = "";
    confirmInput.value = "";
    statusEl.textContent = "";
    modal.classList.remove("hidden");
    currentInput.focus();
  };
  closeBtn.onclick = () => modal.classList.add("hidden");
  async function handleSubmit() {
    const session = getCurrentSession();
    if (!session)
      return;
    const currentPin = currentInput.value.trim();
    const newPin = newInput.value.trim();
    const confirmPin = confirmInput.value.trim();
    statusEl.textContent = "";
    if (!currentPin || !newPin || !confirmPin) {
      statusEl.textContent = "Please fill in all fields.";
      statusEl.className = "cloud-status error";
      return;
    }
    if (newPin !== confirmPin) {
      statusEl.textContent = "New PIN and confirmation do not match.";
      statusEl.className = "cloud-status error";
      return;
    }
    submitBtn.disabled = true;
    submitBtn.textContent = "Updating...";
    const res = await changePassword(session.username, currentPin, newPin);
    submitBtn.disabled = false;
    submitBtn.textContent = "Update PIN";
    if (res.ok) {
      statusEl.textContent = "PIN updated successfully! ✅";
      statusEl.className = "cloud-status success";
      onPasswordChanged(newPin);
      setTimeout(() => modal.classList.add("hidden"), 1000);
    } else {
      statusEl.textContent = res.error || "Failed to update PIN.";
      statusEl.className = "cloud-status error";
    }
  }
  submitBtn.onclick = handleSubmit;
  confirmInput.onkeydown = (e) => {
    if (e.key === "Enter")
      handleSubmit();
  };
}

// src/theme.ts
var THEME_KEY = "dsa-theme";
function initTheme(themeBtn) {
  const saved = localStorage.getItem(THEME_KEY);
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const current = saved || (prefersDark ? "dark" : "light");
  applyTheme(current, themeBtn);
  themeBtn.onclick = () => {
    const isDark = document.documentElement.dataset.theme === "dark";
    const next = isDark ? "light" : "dark";
    localStorage.setItem(THEME_KEY, next);
    applyTheme(next, themeBtn);
  };
}
function applyTheme(theme, btn) {
  document.documentElement.dataset.theme = theme;
  btn.textContent = theme === "dark" ? "☀️" : "\uD83C\uDF19";
  btn.title = theme === "dark" ? "Switch to light mode" : "Switch to dark mode";
}

// src/app.ts
var { weeks, totalProblems } = parseWeeks();
var localState = { d: {}, r: {} };
var autoSolves = {};
var activeSession = null;
var root = document.getElementById("weeks");
var mainContent = document.getElementById("main-content");
var lockBtn = document.getElementById("lock-btn");
var syncBtn = document.getElementById("sync-btn");
var themeBtn = document.getElementById("theme-btn");
var cloudBtn = document.getElementById("cloud-btn");
var pwdBtn = document.getElementById("pwd-btn");
var syncMsg = document.getElementById("sync");
var userBadge = document.getElementById("user-badge");
var fillBar = document.getElementById("fill");
var cntSpan = document.getElementById("cnt");
var rdcSpan = document.getElementById("rdc");
var resetBtn = document.getElementById("reset");
initTheme(themeBtn);
setupCloudModal(cloudBtn);
setupPasswordModal(pwdBtn, (newPin) => {
  if (activeSession)
    activeSession.pin = newPin;
});
setupAuthModal(async (session) => loadUserSession(session));
function renderCurriculum() {
  weeks.forEach((week, i) => {
    const details = document.createElement("details");
    if (i === 0)
      details.open = true;
    let html = `<summary>${week.title}<span id="w${i}"></span></summary><p class="note">${week.note}</p>`;
    week.problems.forEach((p) => {
      html += `
        <div class="row" id="x-${p.slug}">
          <input type="checkbox" data-t="d" data-k="${p.slug}" aria-label="Mark ${formatTitle(p.slug)} as done">
          <span class="t">${formatTitle(p.slug)}</span>
          <span class="d ${p.difficulty}">${p.difficulty}</span>
          <a href="https://leetcode.com/problems/${p.slug}/" target="_blank" rel="noopener noreferrer" class="btn-solve">Solve ↗</a>
          <label class="rd"><input type="checkbox" data-t="r" data-k="${p.slug}">redo</label>
        </div>`;
    });
    details.innerHTML = html;
    root.appendChild(details);
  });
}
function updateUI() {
  let doneCount = 0, redoCount = 0;
  weeks.forEach((week, i) => {
    let weekSolved = 0;
    week.problems.forEach((p) => {
      const isDone = !!(autoSolves[p.slug] || localState.d[p.slug]);
      if (isDone) {
        weekSolved++;
        doneCount++;
      }
      if (localState.r[p.slug])
        redoCount++;
      document.getElementById(`x-${p.slug}`)?.classList.toggle("done", isDone);
    });
    const weekCounter = document.getElementById(`w${i}`);
    if (weekCounter)
      weekCounter.textContent = `${weekSolved}/${week.problems.length}`;
  });
  fillBar.style.width = `${doneCount / totalProblems * 100}%`;
  cntSpan.textContent = `${doneCount} of ${totalProblems} done`;
  rdcSpan.textContent = `${redoCount} to redo`;
  document.querySelectorAll("input[data-k]").forEach((input) => {
    const key = input.dataset.k || "";
    if (input.dataset.t === "d") {
      input.checked = !!(autoSolves[key] || localState.d[key]);
      input.disabled = !!autoSolves[key];
    } else {
      input.checked = !!localState.r[key];
    }
  });
}
async function syncUserState(session) {
  if (getCloudConfig()) {
    const cloudManual = await fetchUserManual(session.username, session.pin);
    if (cloudManual) {
      localState = { d: { ...localState.d, ...cloudManual.d }, r: { ...localState.r, ...cloudManual.r } };
    }
    const leet = await fetchUserLeetCode(session.username);
    if (leet?.solved)
      autoSolves = leet.solved;
  } else {
    try {
      const res = await fetch(`progress.json?${Date.now()}`, { cache: "no-store" });
      const raw = await res.json();
      const data = await decryptProgress(raw, session.pin);
      if (data.solved)
        autoSolves = data.solved;
    } catch {}
  }
  updateUI();
}
async function loadUserSession(session) {
  activeSession = session;
  userBadge.textContent = `@${session.username}`;
  syncMsg.textContent = `Tracking progress for ${session.username}`;
  mainContent.classList.remove("hidden");
  await syncUserState(session);
}
function handleLogout() {
  clearSession();
  activeSession = null;
  mainContent.classList.add("hidden");
  showAuthModal();
}
root.addEventListener("change", async (e) => {
  const target = e.target;
  const key = target.dataset.k, type = target.dataset.t;
  if (!key || !type)
    return;
  if (target.checked)
    localState[type][key] = 1;
  else
    delete localState[type][key];
  updateUI();
  if (activeSession && getCloudConfig()) {
    await saveUserManual(activeSession.username, activeSession.pin, localState);
  }
});
resetBtn.onclick = async () => {
  if (confirm("Clear manual ticks and redo marks? Synced problems stay ticked.")) {
    localState = { d: {}, r: {} };
    updateUI();
    if (activeSession && getCloudConfig()) {
      await saveUserManual(activeSession.username, activeSession.pin, localState);
    }
  }
};
lockBtn.onclick = handleLogout;
syncBtn.onclick = async () => {
  if (!activeSession)
    return;
  syncBtn.classList.add("spinning");
  await syncUserState(activeSession);
  setTimeout(() => syncBtn.classList.remove("spinning"), 500);
};
renderCurriculum();
var existingSession = getCurrentSession();
if (existingSession) {
  loadUserSession(existingSession);
} else {
  showAuthModal();
}
