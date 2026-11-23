/** HTML built by the `html` tag: interpolated values are escaped unless already `Html`. */
export class Html {
  constructor(readonly value: string) {}
  toString(): string {
    return this.value;
  }
}

const ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export function escape(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ESCAPES[c] ?? c);
}

type Value = Html | string | number | readonly Html[];

export function html(strings: TemplateStringsArray, ...values: Value[]): Html {
  let out = strings[0] ?? "";
  values.forEach((v, i) => {
    if (v instanceof Html) out += v.value;
    else if (Array.isArray(v)) out += v.map((h) => h.value).join("");
    else out += escape(String(v));
    out += strings[i + 1] ?? "";
  });
  return new Html(out);
}
