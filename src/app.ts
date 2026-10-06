import { clearSession, getCurrentSession, UserSession } from "./auth";
import { setupAuthModal, showAuthModal } from "./authModal";
import { fetchUserLeetCode, fetchUserManual, getCloudConfig, saveUserManual } from "./cloud";
import { setupCloudModal } from "./cloudModal";
import { decryptProgress } from "./crypto";
import { formatTitle, parseWeeks } from "./curriculum";
import { setupPasswordModal } from "./passwordModal";
import { initTheme } from "./theme";
import { LocalStorageState, ProgressData, RawProgressResponse } from "./types";

const { weeks, totalProblems } = parseWeeks();
let localState: LocalStorageState = { d: {}, r: {} };
let autoSolves: Record<string, number> = {};
let activeSession: UserSession | null = null;

const root = document.getElementById("weeks") as HTMLDivElement;
const mainContent = document.getElementById("main-content") as HTMLElement;
const lockBtn = document.getElementById("lock-btn") as HTMLButtonElement;
const syncBtn = document.getElementById("sync-btn") as HTMLButtonElement;
const themeBtn = document.getElementById("theme-btn") as HTMLButtonElement;
const cloudBtn = document.getElementById("cloud-btn") as HTMLButtonElement;
const pwdBtn = document.getElementById("pwd-btn") as HTMLButtonElement;
const syncMsg = document.getElementById("sync") as HTMLParagraphElement;
const userBadge = document.getElementById("user-badge") as HTMLSpanElement;
const fillBar = document.getElementById("fill") as HTMLDivElement;
const cntSpan = document.getElementById("cnt") as HTMLSpanElement;
const rdcSpan = document.getElementById("rdc") as HTMLSpanElement;
const resetBtn = document.getElementById("reset") as HTMLButtonElement;

initTheme(themeBtn);
setupCloudModal(cloudBtn);
setupPasswordModal(pwdBtn, newPin => {
  if (activeSession) activeSession.pin = newPin;
});
setupAuthModal(async session => loadUserSession(session));

function renderCurriculum() {
  weeks.forEach((week, i) => {
    const details = document.createElement("details");
    if (i === 0) details.open = true;
    let html = `<summary>${week.title}<span id="w${i}"></span></summary><p class="note">${week.note}</p>`;
    week.problems.forEach(p => {
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
    week.problems.forEach(p => {
      const isDone = !!(autoSolves[p.slug] || localState.d[p.slug]);
      if (isDone) { weekSolved++; doneCount++; }
      if (localState.r[p.slug]) redoCount++;
      document.getElementById(`x-${p.slug}`)?.classList.toggle("done", isDone);
    });
    const weekCounter = document.getElementById(`w${i}`);
    if (weekCounter) weekCounter.textContent = `${weekSolved}/${week.problems.length}`;
  });

  fillBar.style.width = `${(doneCount / totalProblems) * 100}%`;
  cntSpan.textContent = `${doneCount} of ${totalProblems} done`;
  rdcSpan.textContent = `${redoCount} to redo`;

  document.querySelectorAll<HTMLInputElement>("input[data-k]").forEach(input => {
    const key = input.dataset.k || "";
    if (input.dataset.t === "d") {
      input.checked = !!(autoSolves[key] || localState.d[key]);
      input.disabled = !!autoSolves[key];
    } else {
      input.checked = !!localState.r[key];
    }
  });
}

async function syncUserState(session: UserSession) {
  if (getCloudConfig()) {
    const cloudManual = await fetchUserManual(session.username, session.pin);
    if (cloudManual) {
      localState = { d: { ...localState.d, ...cloudManual.d }, r: { ...localState.r, ...cloudManual.r } };
    }
    const leet = await fetchUserLeetCode(session.username);
    if (leet?.solved) autoSolves = leet.solved;
  } else {
    try {
      const res = await fetch(`progress.json?${Date.now()}`, { cache: "no-store" });
      const raw = (await res.json()) as RawProgressResponse;
      const data = await decryptProgress<ProgressData>(raw, session.pin);
      if (data.solved) autoSolves = data.solved;
    } catch {}
  }
  updateUI();
}

async function loadUserSession(session: UserSession) {
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

root.addEventListener("change", async (e: Event) => {
  const target = e.target as HTMLInputElement;
  const key = target.dataset.k, type = target.dataset.t as "d" | "r";
  if (!key || !type) return;

  if (target.checked) localState[type][key] = 1;
  else delete localState[type][key];

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
  if (!activeSession) return;
  syncBtn.classList.add("spinning");
  await syncUserState(activeSession);
  setTimeout(() => syncBtn.classList.remove("spinning"), 500);
};

renderCurriculum();

const existingSession = getCurrentSession();
if (existingSession) {
  loadUserSession(existingSession);
} else {
  showAuthModal();
}
