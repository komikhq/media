export const THEME_PROVIDER_SCRIPT = `(()=> {
  const storageKey = "theme";
  const choices = ["light", "system", "dark"];
  const isThemeChoice = (value) => value !== null && choices.includes(value);
  const root = document.documentElement;
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  let theme = "system";

  try {
    const stored = window.localStorage.getItem(storageKey);
    if (isThemeChoice(stored)) theme = stored;
  } catch {}

  const resolved = () =>
    theme === "system" ? (media.matches ? "dark" : "light") : theme;
  const apply = () => {
    const color = resolved();
    root.classList.remove("light", "dark");
    root.classList.add(color);
    root.style.colorScheme = color;
    document.querySelectorAll("[data-theme-choice]").forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.themeChoice === theme));
    });
  };
  const setTheme = (nextTheme) => {
    if (!choices.includes(nextTheme)) return;
    theme = nextTheme;
    try {
      window.localStorage.setItem(storageKey, theme);
    } catch {}
    apply();
  };

  apply();
  const bindControls = () => {
    document.querySelectorAll("[data-theme-choice]").forEach((button) => {
      button.addEventListener("click", () => setTheme(button.dataset.themeChoice));
    });
  };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bindControls, { once: true });
  } else {
    bindControls();
  }

  media.addEventListener("change", () => {
    if (theme === "system") apply();
  });
  window.addEventListener("storage", (event) => {
    if (event.key !== storageKey) return;
    theme = isThemeChoice(event.newValue) ? event.newValue : "system";
    apply();
  });
  window.addEventListener("keydown", (event) => {
    if (
      event.repeat ||
      event.metaKey ||
      event.ctrlKey ||
      event.altKey ||
      event.target instanceof HTMLElement &&
        (event.target.isContentEditable ||
          event.target.closest("input, textarea, select, [contenteditable='true']")) ||
      event.key.toLowerCase() !== "d"
    ) return;
    setTheme(resolved() === "dark" ? "light" : "dark");
  });
})();`;
