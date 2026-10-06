const THEME_KEY = "dsa-theme";

export function initTheme(themeBtn: HTMLButtonElement): void {
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

function applyTheme(theme: string, btn: HTMLButtonElement): void {
  document.documentElement.dataset.theme = theme;
  btn.textContent = theme === "dark" ? "☀️" : "🌙";
  btn.title = theme === "dark" ? "Switch to light mode" : "Switch to dark mode";
}
