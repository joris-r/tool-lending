export const STYLE = `:root {
  --bg: #fbf8f3;
  --text: #1f2a24;
  --muted: #5b6760;
  --accent: #2f6b4f;
  --accent-text: #ffffff;
  --border: #d9d3c7;
  --radius: 8px;
  --font: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  --max-width: 48rem;
}
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--text); font: 1rem/1.5 var(--font); }
.site-header {
  display: flex; align-items: center; justify-content: space-between; gap: 1rem;
  max-width: var(--max-width); margin: 0 auto; padding: 1rem;
  border-bottom: 1px solid var(--border);
}
.site-header h1 { margin: 0; font-size: 1.5rem; color: var(--accent); }
.site-header form { margin: 0; }
.language-switch {
  padding: 0.4rem 0.9rem; border: 1px solid var(--accent); border-radius: var(--radius);
  background: transparent; color: var(--accent); font: inherit; cursor: pointer;
}
.language-switch:hover, .language-switch:focus-visible { background: var(--accent); color: var(--accent-text); }
main { max-width: var(--max-width); margin: 0 auto; padding: 1.5rem 1rem; }
a { color: var(--accent); }
`;
