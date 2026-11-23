export const STYLE = `:root {
  --bg: #fbf8f3;
  --text: #1f2a24;
  --muted: #5b6760;
  --accent: #2f6b4f;
  --accent-text: #ffffff;
  --surface: #ffffff;
  --border: #d9d3c7;
  --danger: #a33a2c;
  --error-bg: #f6e3df;
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
.site-header h1 { margin: 0 auto 0 0; font-size: 1.5rem; color: var(--accent); }
.site-header h1 a { color: inherit; text-decoration: none; }
.account-link { color: var(--accent); font-weight: 600; }
.signed-in { color: var(--muted); }
.site-header form { margin: 0; }
.language-switch {
  padding: 0.4rem 0.9rem; border: 1px solid var(--accent); border-radius: var(--radius);
  background: transparent; color: var(--accent); font: inherit; cursor: pointer;
}
.language-switch:hover, .language-switch:focus-visible { background: var(--accent); color: var(--accent-text); }
main { max-width: var(--max-width); margin: 0 auto; padding: 1.5rem 1rem; }
a { color: var(--accent); }
h2 { margin: 0 0 1rem; color: var(--accent); }
.panel {
  margin: 0 0 1.5rem; padding: 1rem; background: var(--surface);
  border: 1px solid var(--border); border-radius: var(--radius);
}
.stacked-form { display: grid; gap: 0.75rem; max-width: 22rem; }
.stacked-form label { display: grid; gap: 0.25rem; }
input {
  padding: 0.4rem 0.6rem; border: 1px solid var(--border); border-radius: var(--radius);
  font: inherit;
}
button {
  padding: 0.4rem 0.9rem; border: 1px solid var(--accent); border-radius: var(--radius);
  background: transparent; color: var(--accent); font: inherit; cursor: pointer;
}
button.primary { justify-self: start; background: var(--accent); color: var(--accent-text); }
.message { margin: 0 0 1rem; padding: 0.6rem 0.9rem; border-radius: var(--radius); }
.message.error { background: var(--error-bg); color: var(--danger); }
.message.done { background: var(--surface); border: 1px solid var(--border); }
.nav-link { color: var(--accent); font-weight: 600; }
.volunteer-list { list-style: none; margin: 0 0 1.5rem; padding: 0; }
.volunteer-list li {
  display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem;
  padding: 0.6rem 0; border-bottom: 1px solid var(--border);
}
.volunteer-list form { display: contents; }
.volunteer-list .login { font-weight: 600; min-width: 8rem; margin-right: auto; }
.volunteer-list input { width: 12rem; max-width: 100%; }
button.danger { border-color: var(--danger); color: var(--danger); }
h3 { margin: 0 0 0.75rem; }
.member-list { list-style: none; margin: 0 0 1.5rem; padding: 0; }
.member-list li {
  display: flex; flex-wrap: wrap; align-items: baseline; gap: 0.5rem 1rem;
  padding: 0.6rem 0; border-bottom: 1px solid var(--border);
}
.member-list .name { font-weight: 600; min-width: 10rem; }
.member-list .contact { color: var(--muted); margin-right: auto; }
.empty { color: var(--muted); }
.danger-link { color: var(--danger); font-weight: 600; }
.confirm p { margin: 0 0 1rem; }
.confirm-actions { display: flex; align-items: center; gap: 1rem; }
.confirm-actions form { margin: 0; }
button.danger-solid { border-color: var(--danger); background: var(--danger); color: var(--accent-text); }
`;
