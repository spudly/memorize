import type { Verse } from "@memorize/types";

/** Abstraction over wherever verse text comes from. */
export interface ScriptureDataSource {
  search(query: string): Promise<Verse[]>;
  getVerse(reference: string): Promise<Verse>;
}

export class ScriptureApiError extends Error {
  readonly status: number | undefined;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "ScriptureApiError";
    this.status = status;
  }
}

/** "Ether  12:27" -> "ether-12-27". Used as the stable verse id. */
export function normalizeReference(ref: string): string {
  const collapsed = ref.trim().replace(/\s+/g, " ");
  return collapsed
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "");
}

const BOOK_ALIASES: Record<string, string> = {
  "d&c": "Doctrine and Covenants",
  "doctrine & covenants": "Doctrine and Covenants",
};

/**
 * Canonical book names of the standard works (lowercased). Used only to
 * disambiguate chapter-only queries in GospelEngineDataSource.search:
 * "Ether 16" names a known book, so a lookup miss is a genuine bad
 * chapter; "lesson 3" does not, so it stays a keyword search. Verse-
 * bearing queries need no such check — an explicit chapter:verse is
 * unambiguously a reference attempt whatever the book part says.
 */
const KNOWN_BOOK_NAMES: Set<string> = new Set(
  [
    // Old Testament
    "Genesis",
    "Exodus",
    "Leviticus",
    "Numbers",
    "Deuteronomy",
    "Joshua",
    "Judges",
    "Ruth",
    "1 Samuel",
    "2 Samuel",
    "1 Kings",
    "2 Kings",
    "1 Chronicles",
    "2 Chronicles",
    "Ezra",
    "Nehemiah",
    "Esther",
    "Job",
    "Psalms",
    "Psalm",
    "Proverbs",
    "Ecclesiastes",
    "Song of Solomon",
    "Song of Songs",
    "Isaiah",
    "Jeremiah",
    "Lamentations",
    "Ezekiel",
    "Daniel",
    "Hosea",
    "Joel",
    "Amos",
    "Obadiah",
    "Jonah",
    "Micah",
    "Nahum",
    "Habakkuk",
    "Zephaniah",
    "Haggai",
    "Zechariah",
    "Malachi",
    // New Testament
    "Matthew",
    "Mark",
    "Luke",
    "John",
    "Acts",
    "Romans",
    "1 Corinthians",
    "2 Corinthians",
    "Galatians",
    "Ephesians",
    "Philippians",
    "Colossians",
    "1 Thessalonians",
    "2 Thessalonians",
    "1 Timothy",
    "2 Timothy",
    "Titus",
    "Philemon",
    "Hebrews",
    "James",
    "1 Peter",
    "2 Peter",
    "1 John",
    "2 John",
    "3 John",
    "Jude",
    "Revelation",
    // Book of Mormon
    "1 Nephi",
    "2 Nephi",
    "Jacob",
    "Enos",
    "Jarom",
    "Omni",
    "Words of Mormon",
    "Mosiah",
    "Alma",
    "Helaman",
    "3 Nephi",
    "4 Nephi",
    "Mormon",
    "Ether",
    "Moroni",
    // Doctrine and Covenants / Pearl of Great Price
    "Doctrine and Covenants",
    "Moses",
    "Abraham",
    "Joseph Smith—Matthew",
    "Joseph Smith—History",
    "Articles of Faith",
  ].map((name) => name.toLowerCase().replace(/[—–]/g, "-")),
);

// The engine also accepts spoken ordinals ("First Nephi", "1st Nephi"
// for "1 Nephi"); add those forms for every numbered book so the
// known-book check sees them too.
const ORDINAL_WORDS: Record<string, string> = {
  "1": "first",
  "2": "second",
  "3": "third",
  "4": "fourth",
};
const ORDINAL_SUFFIXES: Record<string, string> = {
  "1": "st",
  "2": "nd",
  "3": "rd",
  "4": "th",
};
for (const name of [...KNOWN_BOOK_NAMES]) {
  const numbered = /^([1-4]) (.+)$/.exec(name);
  const digit = numbered?.[1];
  const rest = numbered?.[2];
  const word = digit ? ORDINAL_WORDS[digit] : undefined;
  const suffix = digit ? ORDINAL_SUFFIXES[digit] : undefined;
  if (rest && word) {
    KNOWN_BOOK_NAMES.add(`${word} ${rest}`);
  }
  if (rest && suffix && digit) {
    KNOWN_BOOK_NAMES.add(`${digit}${suffix} ${rest}`);
  }
}

/** The book part of a canonical reference built by parseReference. */
function referenceBookName(reference: string): string {
  const match = /^(.+?) \d+(?::\d+(?:\s*[-–]\s*\d+)?)?$/.exec(reference);
  // Normalize dash variants so "Joseph Smith-History" matches the
  // em-dash form in the known-book set (and vice versa).
  return (match?.[1] ?? reference).toLowerCase().replace(/[—–]/g, "-");
}

/**
 * If `query` is shaped like a scripture reference — a book name followed by
 * a chapter, with an optional verse or verse range ("Ether 12:27",
 * "1 Nephi 3:7", "Proverbs 3:5-6", "Alma 32", "D&C 18:10") — return the
 * canonical reference to look up. Otherwise return null: the query is a
 * keyword/topic search. Detection is structural (trailing chapter[:verse]
 * numbers after book text), so a miss costs one /api/get round-trip; the
 * caller returns no results on a miss and falls back to semantic search
 * only when the lookup itself errors.
 */
export function parseReference(query: string): string | null {
  const collapsed = query.trim().replace(/\s+/g, " ");
  const match = /^(.+?)\s+(\d+)(?::(\d+)(?:\s*[-–]\s*(\d+))?)?$/.exec(collapsed);
  if (!match) {
    return null;
  }
  const [, rawBook, chapter, verse, endVerse] = match;
  if (rawBook === undefined || chapter === undefined) {
    return null;
  }
  const bookRaw = rawBook.trim();
  // The book part must contain a letter and no colon — this rejects bare
  // numbers and times ("12:27") that the regex could otherwise force-fit.
  if (!/[a-zA-Z]/.test(bookRaw) || bookRaw.includes(":")) {
    return null;
  }
  const book = BOOK_ALIASES[bookRaw.toLowerCase().replace(/\.$/, "")] ?? bookRaw;
  let reference = `${book} ${chapter}`;
  if (verse !== undefined) {
    reference += `:${verse}`;
    if (endVerse !== undefined) {
      reference += `-${endVerse}`;
    }
  }
  return reference;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;
}

function firstString(obj: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }
  return undefined;
}

const HTML_ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
  "&nbsp;": " ",
};

/**
 * Backslash-escaped ASCII punctuation is literal text in Markdown,
 * never markup: `\*faith\*` is the literal string `*faith*`, not
 * emphasis, and `\[` never opens a link. The markup passes below are
 * not escape-aware (their regexes would strip the escaped `*`, `_`,
 * or backtick as a delimiter and leave the backslashes behind), so
 * each escaped punctuation character is protected as a private-use
 * placeholder before any cleanup runs and restored verbatim only
 * after every pass — including entity decoding, so `\&amp;` restores
 * to the literal text `&amp;` rather than decoding to `&`.
 */
const ESCAPED_PUNCTUATION = "!\"#$%&'()*+,-./:;<=>?@[\\]^_`{|}~";
const ESCAPE_PLACEHOLDER_BASE = 0xe000;

function protectEscapedPunctuation(text: string): string {
  return text.replace(/\\([!"#$%&'()*+,\-./:;<=>?@\[\\\]^_`{|}~])/g, (_match, ch: string) =>
    String.fromCharCode(ESCAPE_PLACEHOLDER_BASE + ESCAPED_PUNCTUATION.indexOf(ch)),
  );
}

function restoreEscapedPunctuation(text: string): string {
  return text.replace(
    /[\uE000-\uE01F]/g,
    (ch) => ESCAPED_PUNCTUATION[ch.charCodeAt(0) - ESCAPE_PLACEHOLDER_BASE] ?? ch,
  );
}

const CODE_SPAN_START = "\uE060";
const CODE_SPAN_END = "\uE061";

function protectCodeSpans(text: string, spans: string[]): string {
  let out = "";
  let i = 0;
  while (i < text.length) {
    // An escaped character is literal text: an escaped backtick
    // never opens a code span. (Escapes inside a span need no
    // handling — span content is literal by definition.)
    if (text[i] === "\\" && i + 1 < text.length) {
      out += text.slice(i, i + 2);
      i += 2;
      continue;
    }
    if (text[i] !== "`") {
      out += text[i];
      i++;
      continue;
    }
    let runEnd = i;
    while (runEnd < text.length && text[runEnd] === "`") runEnd++;
    const runLen = runEnd - i;
    // Find a closing run of the same length on the same line.
    let closeStart = -1;
    let closeEnd = -1;
    let j = runEnd;
    const lineLimit = (() => {
      const nl = text.indexOf("\n", i);
      return nl === -1 ? text.length : nl;
    })();
    while (j < lineLimit) {
      if (text[j] === "`") {
        let rEnd = j;
        while (rEnd < text.length && text[rEnd] === "`") rEnd++;
        if (rEnd - j === runLen) {
          closeStart = j;
          closeEnd = rEnd;
          break;
        }
        j = rEnd;
      } else {
        j++;
      }
    }
    if (closeStart === -1 || closeStart === runEnd) {
      // No closing run (or empty content) on this line: leave literal.
      out += text.slice(i, runEnd);
      i = runEnd;
      continue;
    }
    const content = text.slice(runEnd, closeStart);
    const idx = spans.length;
    spans.push(content);
    out += `${CODE_SPAN_START}${idx}${CODE_SPAN_END}`;
    i = closeEnd;
  }
  return out;
}

function restoreCodeSpans(text: string, spans: string[]): string {
  return text.replace(/\uE060(\d+)\uE061/g, (_m, idxStr: string) => {
    const idx = Number.parseInt(idxStr, 10);
    return spans[idx] ?? _m;
  });
}

function normalizeLinkLabel(label: string): string {
  return label.trim().replace(/\s+/g, " ").toLowerCase();
}

/** All paragraph-boundary start indices in `text`, computed in one pass. */
function paragraphBoundaries(text: string): number[] {
  const indices: number[] = [];
  const re = /\n[ \t]*\n/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    indices.push(m.index);
    // Advance by 1 so overlapping boundaries are also recorded.
    re.lastIndex = m.index + 1;
  }
  return indices;
}

/**
 * Every matched square-bracket pair in `text`, computed in one
 * stack pass: opening index -> closing index. Honors backslash
 * escapes, and matches never cross a paragraph boundary (the stack
 * resets there). Looking matches up in this map replaces rescanning
 * from every "[": when no closing bracket exists at all, the old
 * per-"[" rescan advanced one character and rescanned the whole
 * remainder, which is quadratic work on input like "[[[[…Faith".
 */
function bracketMatches(text: string, boundaries: number[]): Map<number, number> {
  const matches = new Map<number, number>();
  const boundarySet = new Set(boundaries);
  const stack: number[] = [];
  for (let i = 0; i < text.length; i++) {
    if (boundarySet.has(i)) stack.length = 0;
    const ch = text[i];
    if (ch === "\\") {
      // The skipped character is never visited by the loop, so a
      // boundary there must still reset the stack: a trailing
      // hard-break backslash before a blank line must not let a
      // bracket match across the paragraph.
      if (boundarySet.has(i + 1)) stack.length = 0;
      i++;
    } else if (ch === "[") {
      stack.push(i);
    } else if (ch === "]" && stack.length > 0) {
      matches.set(stack.pop() as number, i);
    }
  }
  return matches;
}

/**
 * Index of the ")" closing an inline link whose "(" is at `open`,
 * or -1 when there is no well-formed close before `limit`. The
 * destination is scanned with a paren-depth counter (nested parens
 * stay inside it), and an optional title after the destination is
 * parsed separately: a quoted title ("…" or '…') may itself contain
 * parentheses, which belong to the title, not the destination, and a
 * parenthesized title is skipped as a balanced group. Without the
 * separate title parse, a title like "Faith ) hope" ended the link
 * early and leaked the rest of the title into the text.
 */
function inlineLinkEnd(text: string, open: number, limit: number): number {
  let i = open + 1;
  while (i < limit && (text[i] === " " || text[i] === "\t")) i++;
  let depth = 0;
  while (i < limit) {
    const ch = text[i];
    if (ch === "\\") {
      i += 2;
      continue;
    }
    if (ch === "(") {
      depth++;
      i++;
      continue;
    }
    if (ch === ")") {
      if (depth === 0) return i;
      depth--;
      i++;
      continue;
    }
    if (ch === " " || ch === "\t") {
      // The destination ended; only an optional title and the
      // closing ")" may follow.
      let j = i;
      while (j < limit && (text[j] === " " || text[j] === "\t")) j++;
      if (j >= limit) return -1;
      const opener = text[j] as string;
      if (opener === '"' || opener === "'") {
        let k = j + 1;
        while (k < limit && text[k] !== opener) {
          if (text[k] === "\\") k++;
          k++;
        }
        if (k >= limit) return -1;
        j = k + 1;
      } else if (opener === "(") {
        let inner = 0;
        let k = j;
        let closed = false;
        while (k < limit) {
          const kc = text[k];
          if (kc === "\\") {
            k += 2;
            continue;
          }
          if (kc === "(") inner++;
          else if (kc === ")") {
            inner--;
            if (inner === 0) {
              closed = true;
              break;
            }
          }
          k++;
        }
        if (!closed) return -1;
        j = k + 1;
      } else {
        return -1;
      }
      while (j < limit && (text[j] === " " || text[j] === "\t")) j++;
      return j < limit && text[j] === ")" ? j : -1;
    }
    i++;
  }
  return -1;
}

/**
 * Plain paren-depth scan for an inline link's closing ")": the
 * fallback when the title-aware scan above cannot parse the shape
 * (e.g. a parenthesized title containing an unbalanced ")", which
 * CommonMark titles may not contain but engine text might). Honors
 * backslash escapes; bounded by `limit`.
 */
function parenDepthEnd(text: string, open: number, limit: number): number {
  const end = Math.min(limit, text.length);
  let depth = 0;
  for (let i = open; i < end; i++) {
    const ch = text[i];
    if (ch === "\\") {
      i++;
    } else if (ch === "(") {
      depth++;
    } else if (ch === ")") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/**
 * Replace Markdown images and links with their alt/link text.
 *
 * Inline destinations are scanned with a paren-depth counter, so
 * parentheses nested any number of levels deep stay inside the
 * destination instead of ending it early. Two failure shapes from
 * live engine text get a bounded fallback when no balanced close
 * exists on the line: an unbalanced "(" in the destination (the
 * link's own closing paren was already spent as an inner close) ends
 * at the first ")" on the line, and a destination cut off mid-URL
 * ends at the line's end — in both cases the readable label survives
 * and the prose after the line is untouched. Reference-style
 * ("[text][ref]") forms keep their text the same way, a bare
 * "[word]" with no destination is ordinary text and stays, and an
 * escaped bracket ("\[") never opens a link.
 */
function stripMarkdownLinks(text: string, definedRefs: Set<string> = new Set<string>()): string {
  const boundaries = paragraphBoundaries(text);
  const matches = bracketMatches(text, boundaries);
  let cachedLineEnd = -1;
  const lineEndFrom = (pos: number): number => {
    if (cachedLineEnd !== -1 && pos <= cachedLineEnd) return cachedLineEnd;
    const idx = text.indexOf("\n", pos);
    cachedLineEnd = idx === -1 ? text.length : idx;
    return cachedLineEnd;
  };
  let out = "";
  let i = 0;
  while (i < text.length) {
    // An escaped character is literal text, never markup.
    if (text[i] === "\\" && i + 1 < text.length) {
      out += text.slice(i, i + 2);
      i += 2;
      continue;
    }
    const isImage = text[i] === "!" && text[i + 1] === "[";
    if (!isImage && text[i] !== "[") {
      out += text[i];
      i++;
      continue;
    }
    const open = isImage ? i + 1 : i;
    // A link never spans a paragraph boundary; bracketMatches
    // already guarantees the match (if any) stays inside one.
    const closeBracket = matches.get(open) ?? -1;
    if (closeBracket === -1) {
      out += text[i];
      i++;
      continue;
    }
    // Recurse into the label: a linked image ("[![alt](img)](page)")
    // carries a whole image inside its link text.
    const label = stripMarkdownLinks(text.slice(open + 1, closeBracket), definedRefs);
    const after = closeBracket + 1;
    if (text[after] === "(") {
      const limit = lineEndFrom(after);
      // Angle-bracket destination: may contain unbalanced parens/spaces.
      let angleHandled = false;
      {
        let p = after + 1;
        while (p < limit && (text[p] === " " || text[p] === "\t")) p++;
        if (p < limit && text[p] === "<") {
          const gt = text.indexOf(">", p + 1);
          if (gt !== -1 && gt < limit) {
            let q = gt + 1;
            while (q < limit && (text[q] === " " || text[q] === "\t")) q++;
            let malformed = false;
            if (q < limit && (text[q] === '"' || text[q] === "'")) {
              const quote = text[q] as string;
              const endQuote = text.indexOf(quote, q + 1);
              if (endQuote === -1 || endQuote >= limit) malformed = true;
              else {
                q = endQuote + 1;
                while (q < limit && (text[q] === " " || text[q] === "\t")) q++;
              }
            } else if (q < limit && text[q] === "(") {
              const endParen = text.indexOf(")", q + 1);
              if (endParen === -1 || endParen >= limit) malformed = true;
              else {
                q = endParen + 1;
                while (q < limit && (text[q] === " " || text[q] === "\t")) q++;
              }
            }
            if (!malformed && q < limit && text[q] === ")") {
              out += label;
              i = q + 1;
              angleHandled = true;
            }
          }
        }
      }
      if (angleHandled) continue;
      const titleAwareEnd = inlineLinkEnd(text, after, limit);
      const closeParen = titleAwareEnd !== -1 ? titleAwareEnd : parenDepthEnd(text, after, limit);
      if (closeParen !== -1 && closeParen < limit) {
        out += label;
        i = closeParen + 1;
        continue;
      }
      // Unbalanced or cut-off destination: drop the destination
      // fragment up to the first ")" on this line, or to the line's
      // end when there is none, and keep only the label.
      const firstClose = text.indexOf(")", after);
      out += label;
      i = firstClose !== -1 && firstClose < limit ? firstClose + 1 : limit;
      continue;
    }
    if (text[after] === "[") {
      const closeRef = matches.get(after) ?? -1;
      if (closeRef !== -1) {
        // A reference-style suffix is consumed only when its label
        // has a definition; an undefined reference is ordinary text,
        // not a link ("Read [Faith][Hope] today." keeps "Hope").
        // A collapsed "[]" reference uses the first label.
        const refLabel = text.slice(after + 1, closeRef);
        const effectiveLabel =
          refLabel.trim() === "" ? text.slice(open + 1, closeBracket) : refLabel;
        if (definedRefs.has(normalizeLinkLabel(effectiveLabel))) {
          out += label;
          i = closeRef + 1;
          continue;
        }
      }
      // Undefined reference suffix: fall through and treat the first
      // bracket on its own (shortcut reference or literal text); the
      // second bracket is then processed on its own merits.
    }
    // Shortcut reference: a bare bracket whose label has a definition.
    if (definedRefs.has(normalizeLinkLabel(label))) {
      out += label;
      i = closeBracket + 1;
      continue;
    }
    // Not a link after all ("[Note]: …", "the [Obedience] principle").
    // Consume the whole matched bracket range using the label already
    // processed above instead of advancing one character and
    // rescanning the interior: with nested bare brackets the rescan
    // reprocessed the same interior at every level, which is
    // exponential work on adversarial input ("[[[[…Faith…]]]]").
    out += `${isImage ? "!" : ""}[${label}]`;
    i = closeBracket + 1;
  }
  return out;
}

/**
 * Convert engine source text to readable plain text (#74).
 *
 * Scripture verses arrive as plain text, but full-library results for
 * talks, manuals, and study aids carry their source markup inline:
 * markdown images (`![Elaine L. Jack](https://…)`), footnote markup
 * (`<sup>[1](#fn-1)</sup>`, `<a id="fn-21"></a>`), markdown headings
 * (`# Prayer`), emphasis markers, and raw HTML tags. Both apps render
 * `Verse.text` as-is, so the markup is stripped here, at the single
 * mapping choke point, keeping the readable words and dropping the
 * syntax around them. Plain text passes through unchanged apart from
 * whitespace normalization.
 */
export function toPlainText(raw: string): string {
  let text = raw.replace(/\r\n?/g, "\n");
  // Protect code spans FIRST: backslash escapes are not interpreted
  // inside a code span, so span content must be captured before
  // escape protection runs — otherwise "\*faith\*" inside backticks
  // came back as "*faith*", its literal backslashes eaten by the
  // escape placeholders. The span scanner is itself escape-aware, so
  // an escaped backtick outside a span still never opens one.
  const codeSpans: string[] = [];
  text = protectCodeSpans(text, codeSpans);
  // Protect backslash-escaped punctuation for the whole cleanup (see
  // protectEscapedPunctuation above): the escapes are restored at the
  // very end, after entity decoding and whitespace normalization.
  text = protectEscapedPunctuation(text);
  // HTML comments are not content; remove them (code spans already
  // protected, so comments inside code spans survive literally).
  text = text.replace(/<!--[\s\S]*?-->/g, "");
  // Footnote reference markers are pure clutter in a result card; drop
  // the whole <sup>…</sup> span, link syntax inside included. Only the
  // footnote form ("<sup>[1](#fn-1)</sup>") goes: any other superscript
  // (an exponent, an ordinal suffix like "19<sup>th</sup>") is content,
  // and the generic tag strip below keeps its text.
  text = text.replace(/<sup\b[^>]*>\s*\[[^\]]*\]\(#fn-[^)\s]*\)\s*<\/sup\s*>/gi, "");
  // Autolinks are unwrapped after stripMarkdownLinks below, not here:
  // unwrapping here would also unwrap an angle-bracket link
  // destination ("[Read](<https://…a)b>)"), destroying its ">" so the
  // link scanner could no longer find the destination's end.
  // Reference definitions are pure syntax once references resolve;
  // drop the whole line — but only lines that are valid definitions
  // (a bracketed label, a destination, an optional quoted title) with
  // at most three leading spaces: four or more make the line an
  // indented code block in Markdown, i.e. content, not a definition.
  // Ordinary text that merely starts with a bracketed label and a
  // colon ("[Note]: Remember to pray…") is content, not a definition,
  // and stays. Footnote definitions ("[^1]: …") carry prose after the
  // colon by design, so they get their own rule.
  const definedRefs = new Set<string>();
  {
    const defRe =
      /^ {0,3}\[([^\]]+)\]:[ \t]*(?:<[^>\n]*>|\S+)(?:[ \t]+(?:"[^"\n]*"|'[^'\n]*'|\([^()\n]*\)))?[ \t]*$/gm;
    let dm: RegExpExecArray | null;
    while ((dm = defRe.exec(text)) !== null) {
      // Footnote definitions ("[^1]: Ibid.") also match defRe when
      // their body is a single token, but a footnote label is not a
      // link reference: admitting "^1" would make every "[^1]"
      // marker resolve as a shortcut reference and leave a stray
      // "^1" in the card. Footnote definitions are removed by their
      // own rule below.
      if (dm[1] !== undefined && !dm[1].startsWith("^")) {
        definedRefs.add(normalizeLinkLabel(dm[1]));
      }
    }
  }
  text = text.replace(
    /^ {0,3}\[[^\]]+\]:[ \t]*(?:<[^>\n]*>|\S+)(?:[ \t]+(?:"[^"\n]*"|'[^'\n]*'|\([^()\n]*\)))?[ \t]*$/gm,
    "",
  );
  text = text.replace(/^[ \t]*\[\^[^\]]+\]:.*$/gm, "");
  // Markdown images and links (inline and reference style) keep only
  // their alt/link text; empty-text forms ("[](06_lecture_6.md)") drop
  // entirely. A scanner, not a regex: real engine destinations defeat
  // the "(one level of balanced parens)" pattern — URLs with parens
  // nested two deep, an unbalanced "(" that makes the closing paren
  // read as an inner group close, and destinations cut off mid-URL
  // all left the raw "[text](…)" syntax on live search cards (#74
  // manual pass on fb81f6d: Hunter chapter audio links, chapter
  // images). See stripMarkdownLinks below.
  text = stripMarkdownLinks(text, definedRefs);
  // Autolinks (<https://…>, <someone@example.org>) would otherwise be
  // eaten as HTML tags by the generic tag strip below.
  text = text.replace(/<(https?:\/\/[^>\s]+)>/g, "$1");
  text = text.replace(/<([\w.+-]+@[\w-]+(?:\.[\w-]+)+)>/g, "$1");
  // Line-break and block tags separate words: turn them into
  // whitespace before stripping, or "<p>Faith</p><p>hope</p>" would
  // come out as "Faithhope". Opening block tags separate too, not
  // just closing ones: "<div>Faith<div>hope</div></div>" has no
  // closing tag between the two words, so closing-only handling
  // still joined them into "Faithhope". Opening tags become a space
  // rather than a newline so an adjacent closing tag's newline is
  // not doubled into a paragraph break.
  text = text.replace(/<br\b[^>]*>/gi, "\n");
  text = text.replace(
    /<\/(?:p|div|li|ul|ol|h[1-6]|blockquote|tr|td|th|section|article)\s*>/gi,
    "\n",
  );
  text = text.replace(
    /<(?:p|div|li|ul|ol|h[1-6]|blockquote|tr|td|th|section|article|table|thead|tbody|pre|figure|figcaption|dl|dt|dd|header|footer|main|nav|aside|form|fieldset|hr)\b[^>]*>/gi,
    (_tag, offset: number, whole: string) =>
      // No separator needed right after a newline (e.g. the one a
      // preceding closing tag just produced): it already separates.
      offset > 0 && whole[offset - 1] === "\n" ? "" : " ",
  );
  // Any remaining HTML tags go, keeping the text they wrapped.
  text = text.replace(/<\/?[a-zA-Z][^>]*>/g, "");
  // Markdown line structure: headings and blockquotes keep their words.
  text = text.replace(/^[ \t]{0,3}#{1,6}[ \t]+/gm, "");
  text = text.replace(/^[ \t]*>[ \t]?/gm, "");
  // Emphasis and code markers keep the words they wrap. Delimiters
  // must hug non-whitespace content, so literal operators in ordinary
  // text (e.g. "2 * 3 * 4") are not mistaken for emphasis.
  // Asterisk pairs whose closing marker runs into another digit are
  // arithmetic, not emphasis ("2*3*4", "2**3**4"): the closing-side
  // (?!\d) keeps those intact, while emphasis that merely follows a
  // digit ("1*st*", "1**st**") or wraps digits ("**3**") still
  // unwraps. The captured content may not itself contain the delimiter
  // pair, so when the digit guard rejects a closing pair the match
  // fails there instead of swallowing a later emphasis span
  // ("2**3**4 and **faith**" keeps the operator, unwraps "faith").
  text = text.replace(/(\*\*|__)(?!\s)((?:(?!\1)[\s\S])*?)(?<!\s)\1(?!\d)/g, "$2");
  text = text.replace(/~~(?!\s)([\s\S]*?)(?<!\s)~~/g, "$1");
  text = text.replace(/(?<!\*)\*(?!\s)([^*\n]+?)(?<!\s)\*(?!\d)(?!\*)/g, "$1");
  text = text.replace(/(?<![\w])_(?!\s)([^_\n]+?)(?<!\s)_(?![\w])/g, "$1");
  text = text.replace(/`([^`\n]+)`/g, "$1");
  // Any backslash escape still in its raw form at this point was not
  // present in the source (source escapes were protected above and
  // are restored at the end); resolve it the same way so a character
  // is never mistaken for markup by the passes above.
  text = text.replace(/\\([!"#$%&'()*+,\-./:;<=>?@\[\\\]^_`{|}~])/g, "$1");
  // Decode entities only after Markdown cleanup: decoded characters
  // are literal text (an encoded "#" is not a heading marker and an
  // encoded "*" is not emphasis), while an escaped "&lt;sup&gt;" still
  // stays literal because HTML tags were stripped above. Numeric
  // entities (&#8217;, &#x2019;) decode by code point; an out-of-range
  // or surrogate value is left as-is rather than throwing.
  // One combined pass: decoding numeric and named references in two
  // passes would reinterpret characters the first pass produced
  // ("&#38;lt;" must stay the literal text "&lt;", not become "<").
  text = text.replace(
    /&#(\d+);|&#x([0-9a-fA-F]+);|&(?:amp|lt|gt|quot|apos|nbsp);/g,
    (entity, decimal, hex) => {
      if (decimal === undefined && hex === undefined) {
        return HTML_ENTITIES[entity] ?? entity;
      }
      const codePoint = Number.parseInt(decimal ?? hex, decimal !== undefined ? 10 : 16);
      return codePoint >= 1 &&
        codePoint <= 0x10ffff &&
        !(codePoint >= 0xd800 && codePoint <= 0xdfff)
        ? String.fromCodePoint(codePoint)
        : entity;
    },
  );
  // Normalize whitespace: no trailing spaces, no run of blank lines.
  text = text.replace(/[ \t]+/g, " ");
  text = text.replace(/ +\n/g, "\n");
  text = text.replace(/\n{3,}/g, "\n\n");
  // Restore the protected escaped punctuation last: restored
  // characters are literal text and must not be reinterpreted as
  // markup, entities ("\&amp;" is the literal text "&amp;"), or
  // whitespace by any pass above.
  // Code spans restore first: their contents are literal (they were
  // captured before escape protection ran), and restoring them
  // before the escape placeholders keeps the two from interfering.
  return restoreEscapedPunctuation(restoreCodeSpans(text.trim(), codeSpans));
}

function buildVerse(reference: string, text: string, obj: Record<string, unknown>): Verse | null {
  const plain = toPlainText(text);
  // Non-blank source markup can convert to nothing at all (an
  // empty-text link, a lone footnote marker): that is not a result
  // with an empty body, it is no result — both callers already drop
  // nulls.
  if (plain.length === 0) {
    return null;
  }
  const verse: Verse = { id: normalizeReference(reference), reference, text: plain };
  const book = firstString(obj, ["book", "book_name"]);
  if (book !== undefined) {
    verse.book = book;
  }
  // The verified /api/get shape carries chapter as a JSON number.
  const chapterRaw = obj["chapter"] ?? obj["chapter_number"];
  if (typeof chapterRaw === "string" && chapterRaw.trim().length > 0) {
    verse.chapter = chapterRaw.trim();
  } else if (typeof chapterRaw === "number") {
    verse.chapter = String(chapterRaw);
  }
  return verse;
}

/**
 * Map one raw search-result item to a Verse.
 *
 * The gospel-engine response shape is UNVERIFIED (the API requires a key we
 * don't have yet), so this tries the most likely field names and returns null
 * when nothing matches. See docs/api-notes.md.
 */
export function mapSearchItem(raw: unknown): Verse | null {
  const obj = asRecord(raw);
  if (!obj) {
    return null;
  }
  const reference = firstString(obj, ["reference", "ref", "citation", "title"]);
  const text = firstString(obj, ["text", "verse_text", "content", "body", "snippet"]);
  if (reference === undefined || text === undefined) {
    return null;
  }
  return buildVerse(reference, text, obj);
}

/** Map a raw single-verse response, tolerating a nested envelope. */
export function mapVerseDetail(raw: unknown): Verse | null {
  const obj = asRecord(raw);
  if (!obj) {
    return null;
  }
  for (const key of ["verse", "result", "data", "item"]) {
    const nested = obj[key];
    if (nested !== undefined) {
      const mapped = mapSearchItem(nested);
      if (mapped) {
        return mapped;
      }
    }
  }
  return mapSearchItem(obj);
}

function resultItems(data: unknown): unknown[] | null {
  if (Array.isArray(data)) {
    return data;
  }
  const obj = asRecord(data);
  if (!obj) {
    return null;
  }
  for (const key of ["results", "items", "verses", "data"]) {
    const value = obj[key];
    if (Array.isArray(value)) {
      return value;
    }
  }
  return null;
}

/**
 * Map the chapter-only /api/get envelope to a single Verse holding the
 * whole chapter. Verified against upstream gospel-engine
 * `internal/api/server.go` getChapter (2026-10-16): a chapter-only
 * reference returns `{ source_type: "chapters", reference_query,
 * chapter: { id, volume, book, chapter, title, full_content, file_path } }`
 * — no `verses` array. `full_content` is the chapter's full text, whose
 * internal verse formatting is unverified, so it is kept whole rather
 * than split into fabricated per-verse entries. Without this, chapter
 * queries such as "Alma 32" mapped to [] and fell back to semantic
 * search despite the exact lookup succeeding.
 */
export function mapChapterResponse(data: unknown): Verse | null {
  const obj = asRecord(data);
  if (!obj) {
    return null;
  }
  const chapter = asRecord(obj["chapter"]);
  if (!chapter) {
    return null;
  }
  const text = firstString(chapter, ["full_content", "content", "text"]);
  if (text === undefined) {
    return null;
  }
  const reference =
    firstString(obj, ["reference_query", "reference", "ref"]) ??
    firstString(chapter, ["title", "reference", "ref"]);
  if (reference === undefined) {
    return null;
  }
  return buildVerse(reference, text, chapter);
}

/**
 * Map a /api/get response to verses. The verified shapes (2026-10-16) are
 * `{ reference_query, source_type, verses: [...] }` — one item per verse,
 * so a verse or range yields several — and, for a chapter-only reference,
 * the `chapters` envelope handled by mapChapterResponse. A single-object
 * payload is also tolerated via mapVerseDetail.
 */
export function mapGetResponse(data: unknown): Verse[] {
  const items = resultItems(data);
  if (items) {
    return items.map(mapSearchItem).filter((v): v is Verse => v !== null);
  }
  const chapter = mapChapterResponse(data);
  if (chapter) {
    return [chapter];
  }
  const single = mapVerseDetail(data);
  return single ? [single] : [];
}

/**
 * Live data source backed by the community gospel-engine API
 * (https://github.com/cpuchip/gospel-engine).
 *
 * No official Church API exists; this is a third-party service. Works with the
 * hosted instance at https://engine.ibeco.me or a self-hosted one.
 */
export class GospelEngineDataSource implements ScriptureDataSource {
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor(baseUrl: string, apiKey: string) {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
    this.apiKey = apiKey;
  }

  private authHeaders(): Record<string, string> {
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.apiKey}`,
    };
  }

  async search(query: string): Promise<Verse[]> {
    // Reference-shaped queries ("Ether 12:27") go to /api/get first:
    // /api/search is semantic search over the whole library (talks,
    // manuals, study aids included) and buries the exact verse in
    // loosely related results. A definitive miss returns no results:
    // falling back to semantic search would silently ignore the
    // chapter/verse the user typed and return keyword matches for the
    // book name alone (#70). A miss is either an empty lookup result
    // (lookupReference maps a 404 to []) or a 400 from the engine,
    // which is how it reports an unresolvable reference. Only other
    // lookup errors (5xx, unreachable) still fall back to semantic
    // search. The no-fallback rule covers genuine reference attempts:
    // an explicit verse (chapter:verse, e.g. "Ether 12:27"), or a
    // chapter-only reference to a known book whose chapter number is
    // not year-like (e.g. "Ether 16" — Ether has 15 chapters, so the
    // miss is definitive). Chapter-only queries that name no known
    // book ("lesson 3") or end in a 4-digit year ("general conference
    // 2024") are keyword searches that merely look reference-shaped,
    // so those keep the semantic fallback on a miss.
    const reference = parseReference(query);
    if (reference !== null) {
      const chapterMatch = / (\d+)(?::|$)/.exec(reference);
      const chapter = chapterMatch ? Number(chapterMatch[1]) : null;
      const isDefinitiveReference =
        reference.includes(":") ||
        (chapter !== null && chapter < 1000 && KNOWN_BOOK_NAMES.has(referenceBookName(reference)));
      try {
        const verses = await this.lookupReference(reference);
        if (verses.length > 0 || isDefinitiveReference) {
          return verses;
        }
      } catch (error) {
        if (isDefinitiveReference && error instanceof ScriptureApiError && error.status === 400) {
          return [];
        }
        // Fall through to semantic search.
      }
    }
    const url = `${this.baseUrl}/api/search?q=${encodeURIComponent(query)}`;
    let res: Response;
    try {
      res = await fetch(url, { headers: this.authHeaders() });
    } catch (error) {
      throw new ScriptureApiError(
        `Could not reach the scripture service: ${error instanceof Error ? error.message : "unknown error"}`,
      );
    }
    if (!res.ok) {
      throw new ScriptureApiError(`Scripture search failed with status ${res.status}`, res.status);
    }
    const data: unknown = await res.json();
    const items = resultItems(data);
    if (!items) {
      throw new ScriptureApiError(
        "Unexpected search response shape. See packages/core/docs/api-notes.md to verify the field mapping.",
      );
    }
    return items.map(mapSearchItem).filter((v): v is Verse => v !== null);
  }

  /**
   * Exact lookup via /api/get. Returns one Verse per verse in the
   * reference (a range or chapter returns several). A 404 means "no such
   * reference" and returns []; other failures throw ScriptureApiError.
   * Note the parameter is `ref` — verified against the live API
   * 2026-10-16 (see docs/api-notes.md).
   */
  async lookupReference(reference: string): Promise<Verse[]> {
    const url = `${this.baseUrl}/api/get?ref=${encodeURIComponent(reference)}`;
    let res: Response;
    try {
      res = await fetch(url, { headers: this.authHeaders() });
    } catch (error) {
      throw new ScriptureApiError(
        `Could not reach the scripture service: ${error instanceof Error ? error.message : "unknown error"}`,
      );
    }
    if (res.status === 404) {
      return [];
    }
    if (!res.ok) {
      throw new ScriptureApiError(`Scripture lookup failed with status ${res.status}`, res.status);
    }
    const data: unknown = await res.json();
    return mapGetResponse(data);
  }

  async getVerse(reference: string): Promise<Verse> {
    const verses = await this.lookupReference(reference);
    const verse = verses[0];
    if (!verse) {
      throw new ScriptureApiError(`Verse not found: ${reference}`, 404);
    }
    return verse;
  }
}

const DEMO_VERSE_TUPLES: [string, string][] = [
  [
    "John 3:16",
    "For God so loved the world, that he gave his only begotten Son, that whosoever believeth in him should not perish, but have everlasting life.",
  ],
  [
    "Ether 12:27",
    "And if men come unto me I will show unto them their weakness. I give unto men weakness that they may be humble; and my grace is sufficient for all men that humble themselves before me; for if they humble themselves before me, and have faith in me, then will I make weak things become strong unto them.",
  ],
  ["2 Nephi 2:25", "Adam fell that men might be; and men are, that they might have joy."],
  [
    "Mosiah 2:17",
    "And behold, I tell you these things that ye may learn wisdom; that ye may learn that when ye are in the service of your fellow beings ye are only in the service of your God.",
  ],
  [
    "Alma 37:35",
    "O, remember, my son, and learn wisdom in thy youth; yea, learn in thy youth to keep the commandments of God.",
  ],
  [
    "Proverbs 3:5-6",
    "Trust in the Lord with all thine heart; and lean not unto thine own understanding. In all thy ways acknowledge him, and he shall direct thy paths.",
  ],
  ["Philippians 4:13", "I can do all things through Christ which strengtheneth me."],
  [
    "Joshua 1:8",
    "This book of the law shall not depart out of thy mouth; but thou shalt meditate therein day and night, that thou mayest observe to do according to all that is written therein: for then thou shalt make thy way prosperous, and then thou shalt have good success.",
  ],
  [
    "1 Nephi 3:7",
    "And it came to pass that I, Nephi, said unto my father: I will go and do the things which the Lord hath commanded, for I know that the Lord giveth no commandments unto the children of men, save he shall prepare a way for them that they may accomplish the thing which he commandeth them.",
  ],
  ["Doctrine and Covenants 18:10", "Remember the worth of souls is great in the sight of God;"],
];

export const DEMO_VERSES: Verse[] = DEMO_VERSE_TUPLES.map(([reference, text]) => ({
  id: normalizeReference(reference),
  reference,
  text,
}));

/**
 * Offline data source with a small set of well-known verses. Used when no
 * gospel-engine API key is configured, so the app is fully usable offline.
 */
export class DemoDataSource implements ScriptureDataSource {
  async search(query: string): Promise<Verse[]> {
    const q = query.trim().toLowerCase();
    if (q.length === 0) {
      return [];
    }
    // Same reference-first behavior as the live source: an exact
    // reference returns just that verse, not every verse containing
    // the query as a substring.
    const reference = parseReference(query);
    if (reference !== null) {
      const exact = DEMO_VERSES.find((v) => v.id === normalizeReference(reference));
      if (exact) {
        return [exact];
      }
    }
    return DEMO_VERSES.filter((v) => `${v.reference} ${v.text}`.toLowerCase().includes(q));
  }

  async getVerse(reference: string): Promise<Verse> {
    const id = normalizeReference(reference);
    const verse = DEMO_VERSES.find((v) => v.id === id);
    if (!verse) {
      throw new ScriptureApiError(`Verse not found in demo data: ${reference}`, 404);
    }
    return verse;
  }
}
