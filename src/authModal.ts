import { login, register, UserSession } from "./auth";

export function setupAuthModal(onAuthSuccess: (session: UserSession) => Promise<void>): void {
  const authScreen = document.getElementById("auth-screen") as HTMLDivElement;
  const userInput = document.getElementById("auth-user") as HTMLInputElement;
  const pinInput = document.getElementById("auth-pin") as HTMLInputElement;
  const rememberCheck = document.getElementById("auth-remember") as HTMLInputElement;
  const submitBtn = document.getElementById("auth-submit-btn") as HTMLButtonElement;
  const switchBtn = document.getElementById("auth-switch-btn") as HTMLButtonElement;
  const titleEl = document.getElementById("auth-title") as HTMLHeadingElement;
  const descEl = document.getElementById("auth-desc") as HTMLParagraphElement;
  const errorEl = document.getElementById("auth-error") as HTMLDivElement;

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

    const res = isRegisterMode
      ? await register(user, pin, remember)
      : await login(user, pin, remember);

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
  pinInput.onkeydown = e => { if (e.key === "Enter") handleSubmit(); };
  userInput.onkeydown = e => { if (e.key === "Enter") pinInput.focus(); };
}

export function showAuthModal(): void {
  const authScreen = document.getElementById("auth-screen") as HTMLDivElement;
  authScreen.classList.remove("hidden");
  const userInput = document.getElementById("auth-user") as HTMLInputElement;
  userInput.focus();
}
