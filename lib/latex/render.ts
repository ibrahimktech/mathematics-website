import katex from "katex";

/**
 * LaTeX-subset → HTML transpiler.
 *
 * Renders a large, practical subset of LaTeX directly to typeset HTML (no PDF),
 * suitable for a mathematics blog. Supported: preamble is ignored, \maketitle,
 * \section/\subsection/\subsubsection (numbered), \begin{equation|align|gather}
 * (equation numbered) + \[ \] + $$, inline $ $ / \( \), theorem-like environments
 * (theorem, lemma, corollary, proposition, definition, remark, example) + proof
 * with a QED box, abstract, itemize/enumerate, tabular, figure/\includegraphics,
 * \textbf/\emph/\textit/\texttt/\underline, \ref/\eqref/\label cross-references,
 * \href/\url. All mathematics is rendered with KaTeX.
 *
 * Isomorphic (no DOM) → used both server-side (article pages) and client-side
 * (editor live preview). Unknown commands/environments degrade gracefully.
 */

type Ctx = {
  section: number;
  subsection: number;
  subsubsection: number;
  equation: number;
  figure: number;
  thm: Record<string, number>;
  labels: Record<string, string>;
  title: string | null;
  author: string | null;
  date: string | null;
  hasTitle: boolean;
  lastNumber: string;
};

const THEOREM_KINDS: Record<string, string> = {
  theorem: "Theorem",
  lemma: "Lemma",
  corollary: "Corollary",
  proposition: "Proposition",
  definition: "Definition",
  remark: "Remark",
  example: "Example",
  claim: "Claim",
};

const TEXT_TAGS: Record<string, string> = {
  textbf: "strong",
  textit: "em",
  emph: "em",
  texttt: "code",
  underline: "u",
  textsc: "span",
  textrm: "span",
  textsf: "span",
  text: "span",
};

const IGNORED_CMDS = new Set([
  "noindent", "par", "centering", "raggedright", "raggedleft", "bigskip",
  "medskip", "smallskip", "newpage", "clearpage", "hfill", "vfill", "indent",
  "normalfont", "normalsize", "itshape", "bfseries", "rmfamily", "sffamily",
  "footnotesize", "scriptsize", "small", "large", "Large", "LARGE", "huge",
  "Huge", "displaystyle", "protect", "linebreak", "newline",
]);

const REF_OPEN = "";
const REF_CLOSE = "";

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function escapeAttr(s: string): string {
  return escapeHtml(s).replace(/"/g, "&quot;");
}
function escapeReg(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
/**
 * URL allow-list for `\href` and `\includegraphics`.
 *
 * `data:image/` was too loose: `data:image/svg+xml` is an image MIME type whose
 * payload is a full XML document that can carry `<script>`. It does not execute
 * inside `<img src>`, but the same helper also feeds `<a href>`, where opening
 * such a URL runs the script in this origin. Restricting `data:` to the raster
 * formats closes that without affecting real inline images.
 *
 * Note the leading-character guard: browsers ignore control characters and
 * whitespace when parsing a scheme, so `java\tscript:` must not slip through a
 * naive prefix test — anything that isn't an exact allow-list match returns "".
 */
function sanitizeUrl(u: string): string {
  // Strip characters a browser would ignore before parsing the scheme.
  const t = u.trim().replace(/[\u0000-\u0020\u007f-\u009f]/g, "");
  if (!t) return "";
  return /^(https?:\/\/|\/(?![\\/])|data:image\/(?:png|jpe?g|gif|webp);|#|mailto:)/i.test(t)
    ? t
    : "";
}
function todayStr(): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date());
}

function katexRender(tex: string, display: boolean): string {
  try {
    return katex.renderToString(tex, {
      displayMode: display,
      throwOnError: false,
      strict: "ignore",
      output: "htmlAndMathml",
      trust: false,
    });
  } catch {
    return `<span class="latex-error" title="Riyaziyyat sintaksis xətası">${escapeHtml(tex)}</span>`;
  }
}

/** Read a balanced `{...}` group starting at s[i] === "{". */
function readGroup(
  s: string,
  i: number,
): { content: string; next: number } | null {
  if (s[i] !== "{") return null;
  let depth = 0;
  for (let j = i; j < s.length; j++) {
    const c = s[j];
    if (c === "\\") {
      j++;
      continue;
    }
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) return { content: s.slice(i + 1, j), next: j + 1 };
    }
  }
  return null;
}

function skipSpaces(s: string, i: number): number {
  while (i < s.length && (s[i] === " " || s[i] === "\n" || s[i] === "\t")) i++;
  return i;
}

/** Find the balanced argument of the first `\cmd{...}` in src. */
function commandArg(src: string, cmd: string): string | null {
  const re = new RegExp("\\\\" + cmd + "(?![a-zA-Z])");
  const m = re.exec(src);
  if (!m) return null;
  const j = skipSpaces(src, m.index + m[0].length);
  const g = readGroup(src, j);
  return g ? g.content : null;
}

function stripComments(src: string): string {
  return src
    .split("\n")
    .map((line) => {
      let out = "";
      for (let i = 0; i < line.length; i++) {
        if (line[i] === "\\") {
          out += line[i] + (line[i + 1] ?? "");
          i++;
          continue;
        }
        if (line[i] === "%") break;
        out += line[i];
      }
      return out;
    })
    .join("\n");
}

function preprocess(src: string): {
  body: string;
  title: string | null;
  author: string | null;
  date: string | null;
} {
  const clean = stripComments(src);
  const title = commandArg(clean, "title");
  const author = commandArg(clean, "author");
  const date = commandArg(clean, "date");

  const doc = /\\begin\{document\}([\s\S]*?)\\end\{document\}/.exec(clean);
  let body = doc ? doc[1] : clean;
  if (!doc) {
    body = body
      .replace(/\\documentclass(\[[^\]]*\])?\{[^}]*\}/g, "")
      .replace(/\\usepackage(\[[^\]]*\])?\{[^}]*\}/g, "")
      .replace(/\\geometry\{[^}]*\}/g, "")
      .replace(/\\newtheorem\*?\{[^}]*\}(\[[^\]]*\])?\{[^}]*\}(\[[^\]]*\])?/g, "")
      .replace(/\\(title|author|date)\{[^}]*\}/g, "");
  }
  return { body, title, author, date };
}

/** Locate the environment beginning at s[i] (`\begin{name}`) and its match. */
function envAt(
  s: string,
  i: number,
): { name: string; inner: string; next: number } | null {
  const head = /^\\begin\{([^}]+)\}/.exec(s.slice(i));
  if (!head) return null;
  const name = head[1];
  const startInner = i + head[0].length;
  const token = /\\(begin|end)\{([^}]+)\}/g;
  token.lastIndex = startInner;
  let depth = 1;
  let m: RegExpExecArray | null;
  while ((m = token.exec(s))) {
    if (m[2] !== name) continue;
    if (m[1] === "begin") depth++;
    else {
      depth--;
      if (depth === 0)
        return { name, inner: s.slice(startInner, m.index), next: token.lastIndex };
    }
  }
  return { name, inner: s.slice(startInner), next: s.length };
}

/** Split on a top-level delimiter ("&" for cells, "\\\\" for rows). */
function splitTopLevel(s: string, delim: "&" | "row"): string[] {
  const parts: string[] = [];
  let depth = 0;
  let math = false;
  let last = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === "\\") {
      if (delim === "row" && s[i + 1] === "\\" && depth === 0 && !math) {
        parts.push(s.slice(last, i));
        i += 1;
        last = i + 1;
        continue;
      }
      i++;
      continue;
    }
    if (c === "$") math = !math;
    else if (c === "{") depth++;
    else if (c === "}") depth--;
    else if (delim === "&" && c === "&" && depth === 0 && !math) {
      parts.push(s.slice(last, i));
      last = i + 1;
    }
  }
  parts.push(s.slice(last));
  return parts;
}

function splitItems(inner: string): string[] {
  const parts: string[] = [];
  const re = /\\begin\{|\\end\{|\\item\b/g;
  let depth = 0;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(inner))) {
    if (m[0] === "\\begin{") depth++;
    else if (m[0] === "\\end{") depth--;
    else if (depth === 0) {
      parts.push(inner.slice(last, m.index));
      last = re.lastIndex;
    }
  }
  parts.push(inner.slice(last));
  return parts;
}

function hasBlocks(s: string): boolean {
  return /\\begin\{|\\\[|\$\$|\n[ \t]*\n/.test(s);
}
function renderFlow(s: string, ctx: Ctx): string {
  return hasBlocks(s) ? renderBlocks(s, ctx) : inline(s.trim(), ctx);
}

// --------------------------------------------------------------------------
// Inline conversion
// --------------------------------------------------------------------------

function inline(t: string, ctx: Ctx): string {
  let out = "";
  let i = 0;
  while (i < t.length) {
    const c = t[i];

    if (c === "\\") {
      const rest = t.slice(i);
      const esc = /^\\([%&_#$%{}~^])/.exec(rest);
      if (esc) {
        out += escapeHtml(esc[1]);
        i += 2;
        continue;
      }
      if (rest.startsWith("\\(")) {
        const j = t.indexOf("\\)", i + 2);
        const inner = j < 0 ? t.slice(i + 2) : t.slice(i + 2, j);
        out += katexRender(inner.trim(), false);
        i = j < 0 ? t.length : j + 2;
        continue;
      }
      if (rest.startsWith("\\\\")) {
        out += "<br/>";
        i += 2;
        continue;
      }
      if (/^\\[,;! ]/.test(rest)) {
        out += " ";
        i += 2;
        continue;
      }
      const cm = /^\\([a-zA-Z]+)/.exec(rest);
      if (cm) {
        const name = cm[1];
        const afterName = i + 1 + name.length;

        if (name in TEXT_TAGS) {
          const g = readGroup(t, skipSpaces(t, afterName));
          if (g) {
            const tag = TEXT_TAGS[name];
            const cls = name === "textsc" ? ' class="latex-sc"' : "";
            out += `<${tag}${cls}>${inline(g.content, ctx)}</${tag}>`;
            i = g.next;
            continue;
          }
        }
        if (name === "label") {
          const g = readGroup(t, skipSpaces(t, afterName));
          if (g) {
            ctx.labels[g.content] = ctx.lastNumber;
            i = g.next;
            continue;
          }
        }
        if (name === "ref" || name === "eqref") {
          const g = readGroup(t, skipSpaces(t, afterName));
          if (g) {
            out += `${REF_OPEN}${name === "eqref" ? "eq" : "ref"}:${g.content}${REF_CLOSE}`;
            i = g.next;
            continue;
          }
        }
        if (name === "href") {
          const g1 = readGroup(t, skipSpaces(t, afterName));
          const g2 = g1 && readGroup(t, skipSpaces(t, g1.next));
          if (g1 && g2) {
            out += `<a href="${escapeAttr(sanitizeUrl(g1.content))}" target="_blank" rel="noopener noreferrer">${inline(g2.content, ctx)}</a>`;
            i = g2.next;
            continue;
          }
        }
        if (name === "url") {
          const g = readGroup(t, skipSpaces(t, afterName));
          if (g) {
            out += `<a href="${escapeAttr(sanitizeUrl(g.content))}" target="_blank" rel="noopener noreferrer">${escapeHtml(g.content)}</a>`;
            i = g.next;
            continue;
          }
        }
        if (name === "includegraphics") {
          let k = skipSpaces(t, afterName);
          const opt = /^\[[^\]]*\]/.exec(t.slice(k));
          if (opt) k += opt[0].length;
          const g = readGroup(t, k);
          if (g) {
            out += `<img class="latex-inline-img" src="${escapeAttr(sanitizeUrl(g.content))}" alt="" />`;
            i = g.next;
            continue;
          }
        }
        if (name === "today") {
          out += escapeHtml(todayStr());
          i = afterName;
          continue;
        }
        if (name === "LaTeX") {
          out += "LaTeX";
          i = afterName;
          continue;
        }
        if (name === "TeX") {
          out += "TeX";
          i = afterName;
          continue;
        }
        if (name === "quad" || name === "qquad") {
          out += name === "qquad" ? "&emsp;&emsp;" : "&emsp;";
          i = afterName;
          continue;
        }
        if (IGNORED_CMDS.has(name)) {
          i = afterName;
          continue;
        }
        // Unknown command: render its argument text if present, else drop it.
        const g = readGroup(t, skipSpaces(t, afterName));
        if (g) {
          out += inline(g.content, ctx);
          i = g.next;
          continue;
        }
        i = afterName;
        continue;
      }
      i++;
      continue;
    }

    if (c === "$") {
      const j = t.indexOf("$", i + 1);
      const inner = j < 0 ? t.slice(i + 1) : t.slice(i + 1, j);
      out += katexRender(inner, false);
      i = j < 0 ? t.length : j + 1;
      continue;
    }
    if (c === "~") {
      out += "&nbsp;";
      i++;
      continue;
    }
    if (t.startsWith("``", i)) {
      out += "&ldquo;";
      i += 2;
      continue;
    }
    if (t.startsWith("''", i)) {
      out += "&rdquo;";
      i += 2;
      continue;
    }
    if (t.startsWith("---", i)) {
      out += "&mdash;";
      i += 3;
      continue;
    }
    if (t.startsWith("--", i)) {
      out += "&ndash;";
      i += 2;
      continue;
    }
    if (c === "{" || c === "}") {
      i++;
      continue;
    }
    if (c === "&") {
      out += "&amp;";
      i++;
      continue;
    }
    if (c === "<") {
      out += "&lt;";
      i++;
      continue;
    }
    if (c === ">") {
      out += "&gt;";
      i++;
      continue;
    }
    if (c === "\n") {
      out += " ";
      i++;
      continue;
    }
    out += c;
    i++;
  }
  return out;
}

// --------------------------------------------------------------------------
// Block-level constructs
// --------------------------------------------------------------------------

function flushParagraphs(text: string, ctx: Ctx): string {
  if (!text.trim()) return "";
  return text
    .split(/\n[ \t]*\n/)
    .map((p) => (p.trim() ? `<p>${inline(p, ctx)}</p>` : ""))
    .join("");
}

function displayMath(tex: string, ctx: Ctx, numbered: boolean): string {
  let t = tex;
  const labels: string[] = [];
  t = t.replace(/\\label\{([^}]*)\}/g, (_m, k) => {
    labels.push(k);
    return "";
  });
  if (numbered) {
    ctx.equation++;
    const num = String(ctx.equation);
    ctx.lastNumber = num;
    for (const k of labels) ctx.labels[k] = num;
    return `<div class="latex-eq"><span class="latex-eq-inner">${katexRender(t.trim(), true)}</span><span class="latex-eq-num">(${num})</span></div>`;
  }
  return `<div class="latex-eq latex-eq--plain">${katexRender(t.trim(), true)}</div>`;
}

function alignEnv(inner: string, kind: "align" | "gather"): string {
  const t = inner.replace(/\\label\{[^}]*\}/g, "").trim();
  const env = kind === "gather" ? "gathered" : "aligned";
  return `<div class="latex-eq latex-eq--plain">${katexRender(`\\begin{${env}}${t}\\end{${env}}`, true)}</div>`;
}

function renderItems(inner: string, ctx: Ctx): string {
  const parts = splitItems(inner);
  const items = parts.length > 1 ? parts.slice(1) : parts.filter((p) => p.trim());
  return items
    .map((it) => `<li>${renderFlow(it, ctx)}</li>`)
    .join("");
}

function renderTheorem(kind: string, inner: string, ctx: Ctx): string {
  ctx.thm[kind] = (ctx.thm[kind] ?? 0) + 1;
  const num = ctx.thm[kind];
  ctx.lastNumber = String(num);
  let body = inner;
  let note = "";
  const opt = /^\s*\[([^\]]*)\]/.exec(inner);
  if (opt) {
    note = ` (${inline(opt[1], ctx)})`;
    body = inner.slice(opt.index + opt[0].length);
  }
  return `<div class="latex-theorem"><span class="latex-thm-head">${THEOREM_KINDS[kind]} ${num}${note}.</span> <div class="latex-thm-body">${renderFlow(body, ctx)}</div></div>`;
}

function renderProof(inner: string, ctx: Ctx): string {
  return `<div class="latex-proof"><span class="latex-proof-head">Proof.</span> <div class="latex-proof-body">${renderFlow(inner, ctx)}<span class="latex-qed">□</span></div></div>`;
}

function renderFigure(inner: string, ctx: Ctx): string {
  ctx.figure++;
  const num = ctx.figure;
  ctx.lastNumber = String(num);
  const lab = /\\label\{([^}]*)\}/.exec(inner);
  if (lab) ctx.labels[lab[1]] = String(num);
  const img = /\\includegraphics(?:\[[^\]]*\])?\{([^}]*)\}/.exec(inner);
  const src = img ? sanitizeUrl(img[1].trim()) : "";
  const capRaw = commandArg(inner, "caption");
  const cap = capRaw ? inline(capRaw, ctx) : "";
  return `<figure class="latex-figure">${
    src ? `<img src="${escapeAttr(src)}" alt="" />` : ""
  }<figcaption><span class="latex-fig-label">Figure ${num}.</span>${cap ? ` ${cap}` : ""}</figcaption></figure>`;
}

function parseColspec(spec: string): string[] {
  const out: string[] = [];
  for (const c of spec) {
    if (c === "l") out.push("left");
    else if (c === "c") out.push("center");
    else if (c === "r") out.push("right");
  }
  return out;
}

function renderTabular(inner: string, ctx: Ctx): string {
  let s = inner.replace(/^\s+/, "");
  let aligns: string[] = [];
  if (s[0] === "{") {
    const g = readGroup(s, 0);
    if (g) {
      aligns = parseColspec(g.content);
      s = s.slice(g.next);
    }
  }
  s = s.replace(/\\hline/g, "").replace(/\\(top|mid|bottom)rule/g, "");
  const rows = splitTopLevel(s, "row")
    .map((r) => r.trim())
    .filter((r) => r.length);
  const body = rows
    .map((r) => {
      const cells = splitTopLevel(r, "&");
      return `<tr>${cells
        .map(
          (cell, idx) =>
            `<td style="text-align:${aligns[idx] ?? "left"}">${inline(cell.trim(), ctx)}</td>`,
        )
        .join("")}</tr>`;
    })
    .join("");
  return `<div class="latex-table-wrap"><table class="latex-table"><tbody>${body}</tbody></table></div>`;
}

function renderTitle(ctx: Ctx): string {
  ctx.hasTitle = true;
  const title = ctx.title
    ? `<h1 class="latex-title">${inline(ctx.title, ctx)}</h1>`
    : "";
  const author = ctx.author
    ? `<div class="latex-author">${inline(ctx.author, ctx)}</div>`
    : "";
  const dateContent = ctx.date ? inline(ctx.date, ctx) : escapeHtml(todayStr());
  const date = `<div class="latex-date">${dateContent}</div>`;
  return `<div class="latex-titleblock">${title}${author}${date}</div>`;
}

function renderEnv(name: string, inner: string, ctx: Ctx): string {
  switch (name) {
    case "equation":
      return displayMath(inner, ctx, true);
    case "equation*":
    case "displaymath":
    case "math":
      return displayMath(inner, ctx, false);
    case "align":
    case "align*":
    case "aligned":
    case "flalign":
    case "flalign*":
      return alignEnv(inner, "align");
    case "gather":
    case "gather*":
    case "gathered":
      return alignEnv(inner, "gather");
    case "abstract":
      return `<div class="latex-abstract"><div class="latex-abstract-title">Abstract</div>${renderBlocks(inner, ctx)}</div>`;
    case "itemize":
      return `<ul class="latex-list">${renderItems(inner, ctx)}</ul>`;
    case "enumerate":
      return `<ol class="latex-list">${renderItems(inner, ctx)}</ol>`;
    case "description":
      return `<dl class="latex-list">${renderItems(inner, ctx)}</dl>`;
    case "center":
      return `<div class="latex-center">${renderBlocks(inner, ctx)}</div>`;
    case "flushleft":
    case "flushright":
      return renderBlocks(inner, ctx);
    case "quote":
    case "quotation":
      return `<blockquote class="latex-quote">${renderBlocks(inner, ctx)}</blockquote>`;
    case "verbatim":
    case "lstlisting":
    case "verbatim*":
      return `<pre class="latex-verbatim">${escapeHtml(inner.replace(/^\n/, ""))}</pre>`;
    case "figure":
    case "figure*":
    case "table":
      return renderFigure(inner, ctx);
    case "tabular":
    case "tabular*":
      return renderTabular(inner, ctx);
    case "proof":
      return renderProof(inner, ctx);
    case "document":
      return renderBlocks(inner, ctx);
  }
  if (name in THEOREM_KINDS) return renderTheorem(name, inner, ctx);
  // Unknown environment → render its content so nothing is lost.
  return renderBlocks(inner, ctx);
}

function sectionAt(
  s: string,
  i: number,
  ctx: Ctx,
): { html: string; next: number } | null {
  const m = /^\\(subsubsection|subsection|section)(\*)?\s*\{/.exec(s.slice(i));
  if (!m) return null;
  const level = m[1];
  const starred = !!m[2];
  const g = readGroup(s, i + m[0].length - 1);
  if (!g) return null;
  let num = "";
  if (!starred) {
    if (level === "section") {
      ctx.section++;
      ctx.subsection = 0;
      ctx.subsubsection = 0;
      num = `${ctx.section}`;
    } else if (level === "subsection") {
      ctx.subsection++;
      ctx.subsubsection = 0;
      num = `${ctx.section}.${ctx.subsection}`;
    } else {
      ctx.subsubsection++;
      num = `${ctx.section}.${ctx.subsection}.${ctx.subsubsection}`;
    }
    ctx.lastNumber = num;
  }
  const tag = level === "section" ? "h2" : level === "subsection" ? "h3" : "h4";
  const numHtml = num ? `<span class="latex-secnum">${num}</span> ` : "";
  return {
    html: `<${tag} class="latex-${level}">${numHtml}${inline(g.content, ctx)}</${tag}>`,
    next: g.next,
  };
}

function renderBlocks(s: string, ctx: Ctx): string {
  let out = "";
  let text = "";
  let i = 0;
  const flush = () => {
    out += flushParagraphs(text, ctx);
    text = "";
  };
  while (i < s.length) {
    if (s.startsWith("\\begin{", i)) {
      const e = envAt(s, i);
      if (e) {
        flush();
        out += renderEnv(e.name, e.inner, ctx);
        i = e.next;
        continue;
      }
    }
    if (s.startsWith("\\[", i)) {
      const j = s.indexOf("\\]", i + 2);
      flush();
      out += displayMath(j < 0 ? s.slice(i + 2) : s.slice(i + 2, j), ctx, false);
      i = j < 0 ? s.length : j + 2;
      continue;
    }
    if (s.startsWith("$$", i)) {
      const j = s.indexOf("$$", i + 2);
      flush();
      out += displayMath(j < 0 ? s.slice(i + 2) : s.slice(i + 2, j), ctx, false);
      i = j < 0 ? s.length : j + 2;
      continue;
    }
    if (s.startsWith("\\section", i) || s.startsWith("\\subsection", i) || s.startsWith("\\subsubsection", i)) {
      const sec = sectionAt(s, i, ctx);
      if (sec) {
        flush();
        out += sec.html;
        i = sec.next;
        continue;
      }
    }
    if (s.startsWith("\\maketitle", i)) {
      flush();
      out += renderTitle(ctx);
      i += "\\maketitle".length;
      continue;
    }
    text += s[i];
    i++;
  }
  flush();
  return out;
}

/** Render a LaTeX-subset document/source string to typeset HTML. */
export function renderLatexToHtml(src: string): string {
  if (!src || !src.trim()) return "";
  try {
    const { body, title, author, date } = preprocess(src);
    const ctx: Ctx = {
      section: 0,
      subsection: 0,
      subsubsection: 0,
      equation: 0,
      figure: 0,
      thm: {},
      labels: {},
      title,
      author,
      date,
      hasTitle: false,
      lastNumber: "",
    };
    let html = renderBlocks(body, ctx);
    html = html.replace(
      new RegExp(`${REF_OPEN}(eq|ref):([\\s\\S]*?)${REF_CLOSE}`, "g"),
      (_m, kind: string, key: string) => {
        const n = ctx.labels[key] ?? "??";
        return kind === "eq" ? `(${n})` : n;
      },
    );
    return html;
  } catch {
    return `<pre class="latex-fallback">${escapeHtml(src)}</pre>`;
  }
}

/** Plain-text extraction for reading-time / excerpts (strips LaTeX + math). */
export function latexToPlainText(src: string): string {
  const { body } = preprocess(src);
  return body
    .replace(/\\begin\{[^}]*\}|\\end\{[^}]*\}/g, " ")
    .replace(/\$\$[\s\S]*?\$\$/g, " ")
    .replace(/\\\[[\s\S]*?\\\]/g, " ")
    .replace(/\$[^$]*\$/g, " ")
    .replace(/\\[a-zA-Z]+\*?(\[[^\]]*\])?/g, " ")
    .replace(/[{}\\&~^_#]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
