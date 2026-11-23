// Measures the test suite: mutation score, line and branch coverage,
// traceability coverage. Prints the values and writes them to
// reports/measures.json. See docs/technical.md, Measures.
import { execSync } from "node:child_process";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

const run = (cmd) => execSync(cmd, { stdio: "inherit" });

function walk(dir, keep) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    return e.isDirectory() ? walk(p, keep) : keep(p) ? [p] : [];
  });
}

function slug(text) {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .trim()
    .replace(/\s+/g, "-");
}

/** Tagged statements of docs/ and the scenarios, with their paths. */
function statements() {
  const out = [];
  const skip = (p) =>
    /(^|[\\/])_design[\\/]/.test(p) || /(contents|design|README)\.md$/.test(p);
  for (const file of walk("docs", (p) => p.endsWith(".md") && !skip(p))) {
    const parts = relative("docs", file).split(sep);
    const stem = parts.pop().replace(/\.md$/, "");
    const domain = parts
      .filter((d) => !d.startsWith("_"))
      .map((d) => "/" + slug(d))
      .join("");
    const fileSeg =
      stem === "scenarios" || parts.some((d) => d === "_scenarios")
        ? "scenarios"
        : stem;
    const lines = readFileSync(file, "utf8").split("\n");
    let section = null;
    for (let i = 0; i < lines.length; i++) {
      const h = /^##\s+(.*)$/.exec(lines[i]);
      if (h) {
        section = slug(h[1]);
        if (fileSeg === "scenarios")
          out.push({
            path: `${domain}/scenarios/${section}`,
            kind: "scenario",
          });
        continue;
      }
      const t = /^\s*(?:[-*]|\d+\.)\s+\[([^\]]+)\]/.exec(lines[i]);
      if (!t || section === null || fileSeg === "scenarios") continue;
      let text = lines[i];
      for (let j = i + 1; j < lines.length && /^\s{2,}\S/.test(lines[j]); j++)
        text += " " + lines[j];
      out.push({
        path: `${domain}/${fileSeg}/${section}/${slug(t[1])}`,
        kind: fileSeg === "security" ? "threat" : "statement",
        notTestable: text.includes("(not testable)"),
        cites: [...text.matchAll(/(?<![\w`])(\/[a-z0-9][a-z0-9/-]*)/g)].map(
          (m) => m[1],
        ),
      });
    }
  }
  return out;
}

function traceability() {
  const cited = new Set();
  for (const file of walk("tests", (p) => /\.(ts|js|mjs)$/.test(p))) {
    for (const m of readFileSync(file, "utf8").matchAll(
      /\/\/\s*(\/[a-z0-9][a-z0-9/-]*)/g,
    ))
      cited.add(m[1]);
  }
  const isCited = (p) =>
    [...cited].some((c) => c === p || c.startsWith(p + "/"));
  // A threat counts through its tested mitigation; an accepted threat, or
  // one mitigated by technical statements only, is checked in review.
  const tested = (c) => !c.startsWith("/technical");
  const all = statements().filter(
    (s) => !s.notTestable && (s.kind !== "threat" || s.cites.some(tested)),
  );
  const covered = all.filter((s) =>
    s.kind === "threat"
      ? s.cites.filter(tested).every(isCited)
      : isCited(s.path),
  );
  return {
    covered: covered.length,
    total: all.length,
    missing: all.filter((s) => !covered.includes(s)).map((s) => s.path),
  };
}

const pct = (n, d) => (d === 0 ? 100 : Math.round((1000 * n) / d) / 10);

if (process.argv.includes("--traceability")) {
  const t = traceability();
  console.log(
    `Traceability coverage: ${pct(t.covered, t.total)}% (${t.covered} / ${t.total})`,
  );
  for (const m of t.missing) console.log(`  not cited: ${m}`);
  process.exit(0);
}

run("npx vitest run --coverage");
const cov = JSON.parse(
  readFileSync("reports/coverage/coverage-summary.json", "utf8"),
).total;

run("npx stryker run");
const files = JSON.parse(
  readFileSync("reports/mutation/mutation.json", "utf8"),
).files;
const mutants = Object.values(files).flatMap((f) => f.mutants);
const detected = mutants.filter(
  (m) => m.status === "Killed" || m.status === "Timeout",
).length;
const undetected = mutants.filter(
  (m) => m.status === "Survived" || m.status === "NoCoverage",
).length;

const trace = traceability();
const result = {
  mutationScore: pct(detected, detected + undetected),
  mutants: { detected, undetected },
  lineCoverage: cov.lines.pct,
  branchCoverage: cov.branches.pct,
  traceability: pct(trace.covered, trace.total),
  traceabilityCounts: { covered: trace.covered, total: trace.total },
};
mkdirSync("reports", { recursive: true });
writeFileSync("reports/measures.json", JSON.stringify(result, null, 2) + "\n");
console.log(`
Mutation score:        ${result.mutationScore}% (${detected} detected / ${detected + undetected})
Line coverage:         ${result.lineCoverage}%
Branch coverage:       ${result.branchCoverage}%
Traceability coverage: ${result.traceability}% (${trace.covered} / ${trace.total})`);
