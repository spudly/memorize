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

/**
 * Drop replacement-character corruption from engine text (#77):
 * U+FFFD itself, plus unpaired surrogates, which render as U+FFFD.
 * Well-formed surrogate pairs (real astral characters in engine
 * text, e.g. the 🎧 audio marker) are untouched. The surrogates go
 * FIRST: dropping U+FFFD first could fuse two unpaired halves that
 * happened to surround one ("\uD83D\uFFFD\uDE00") into a fabricated
 * character (😀) neither half ever formed. Applied in toPlainText
 * once code spans are captured, and again to code-span content when
 * it is restored — span content bypasses the main cleanup behind
 * its placeholder, so it needs the same treatment on the way back.
 */
function dropReplacementArtifacts(text: string): string {
  return text
    .replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, "")
    .replace(/\uFFFD/g, "");
}

/**
 * Placeholder pair for protected code spans, chosen per input. Any
 * FIXED pair can collide with literal engine text: the previously
 * used U+E060/U+E061 pair was itself a regression fix for an earlier
 * pair, and a literal "\uE0660\uE067" sequence in source text was
 * read back as "span 0" at restore time and replaced with that
 * span's content ("`Faith` and \uE0660\uE067 end" came out as
 * "Faith and Faith end"). So the pair is selected for each input:
 * the first candidate whose "<start><digits><end>" pattern appears
 * in none of the text's raw, entity-decoded, or artifact-cleaned
 * forms (an entity like "&#57446;" decodes to U+E066 later in the
 * pipeline, and dropping a U+FFFD can join a split sequence, so a
 * placeholder those passes could produce is a collision too).
 * Candidates sit in the private-use area clear of the escape
 * placeholders above (U+E000–U+E01F), starting at the historical
 * U+E066/U+E067 so ordinary text is unchanged.
 */
type CodeSpanMarkers = {
  start: string;
  end: string;
};

function codeSpanMarkerPattern(start: string, end: string): RegExp {
  return new RegExp(`${start}\\d+${end}`);
}

function chooseCodeSpanMarkers(text: string): CodeSpanMarkers {
  // Probe the raw text, its numeric-entity-decoded form, and the
  // artifact-cleaned forms of both. Decoding and the replacement-
  // artifact cleanup both run later in toPlainText, after spans are
  // protected, and each can CREATE a placeholder-shaped sequence
  // that the raw text does not contain: dropping a U+FFFD joins a
  // literal "\uE066" + "0" + "\uE067" split by one, and an encoded
  // U+FFFD ("&#65533;") decodes to nothing, joining encoded markers
  // the same way. The probe decoder therefore mirrors the real one,
  // including its U+FFFD-to-nothing rule.
  const decodeProbe = (value: string): string =>
    value.replace(
      /&#(\d+);|&#x([0-9a-fA-F]+);/g,
      (entity, decimal: string | undefined, hex: string | undefined) => {
        const codePoint = Number.parseInt(decimal ?? hex ?? "", decimal !== undefined ? 10 : 16);
        if (codePoint === 0xfffd) {
          return "";
        }
        return codePoint >= 1 &&
          codePoint <= 0x10ffff &&
          !(codePoint >= 0xd800 && codePoint <= 0xdfff)
          ? String.fromCodePoint(codePoint)
          : entity;
      },
    );
  const decodedProbe = decodeProbe(text);
  const cleanedProbe = dropReplacementArtifacts(text);
  const probe = [
    text,
    decodedProbe,
    cleanedProbe,
    dropReplacementArtifacts(decodedProbe),
    decodeProbe(cleanedProbe),
  ].join("\n");
  for (let code = 0xe066; code <= 0xf8fd; code += 2) {
    const start = String.fromCharCode(code);
    const end = String.fromCharCode(code + 1);
    if (!codeSpanMarkerPattern(start, end).test(probe)) {
      return { start, end };
    }
  }
  for (let code = 0xe020; code < 0xe066; code += 2) {
    const start = String.fromCharCode(code);
    const end = String.fromCharCode(code + 1);
    if (!codeSpanMarkerPattern(start, end).test(probe)) {
      return { start, end };
    }
  }
  // Every single-character pair occurs in the input (a pathological
  // text carrying thousands of placeholder-shaped sequences): grow
  // the markers until they cannot occur — a marker pair longer than
  // the text itself never does.
  for (let length = 2; ; length++) {
    const start = "\uE066".repeat(length);
    const end = "\uE067".repeat(length);
    if (!codeSpanMarkerPattern(start, end).test(probe)) {
      return { start, end };
    }
  }
}

/**
 * Unwrap code spans whose content the replacement-artifact cleanup
 * reduces to nothing or to whitespace alone. Their placeholders
 * otherwise survive until restoreCodeSpans — after whitespace
 * normalization and trimming — so a corruption-only span left stray
 * whitespace behind: "`\uFFFD` `\uFFFD`" restored to a single space
 * and "` \uFFFD `" to two, and buildVerse kept both as blank cards
 * because the restored text is nonempty. Unwrapping here, before
 * normalization, feeds the cleaned content ("" or the whitespace
 * that survives) into the normal whitespace pass, which tidies the
 * gap exactly as it does for corruption dropped outside a span.
 * Spans with any non-whitespace cleaned content stay protected.
 */
function unwrapEmptiedCodeSpans(text: string, spans: string[], markers: CodeSpanMarkers): string {
  const emptied = new Map<number, string>();
  spans.forEach((span, idx) => {
    const cleaned = dropReplacementArtifacts(span);
    if (cleaned.trim().length === 0) {
      emptied.set(idx, cleaned);
    }
  });
  if (emptied.size === 0) {
    return text;
  }
  // One pass over the text, not one full-document scan per emptied
  // span: this pipeline also runs over full chapter text, where a
  // per-span scan is quadratic in the number of emptied spans.
  return text.replace(
    new RegExp(`${markers.start}(\\d+)${markers.end}`, "g"),
    (match, idxStr: string) => emptied.get(Number.parseInt(idxStr, 10)) ?? match,
  );
}

function protectCodeSpans(text: string, spans: string[], markers: CodeSpanMarkers): string {
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
    out += `${markers.start}${idx}${markers.end}`;
    i = closeEnd;
  }
  return out;
}

function restoreCodeSpans(text: string, spans: string[], markers: CodeSpanMarkers): string {
  return text.replace(
    new RegExp(`${markers.start}(\\d+)${markers.end}`, "g"),
    (_m, idxStr: string) => {
      const idx = Number.parseInt(idxStr, 10);
      const span = spans[idx];
      return span === undefined ? _m : dropReplacementArtifacts(span);
    },
  );
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
 * escaped bracket ("\[") never opens a link. A link an excerpt
 * truncated mid-label at the end of the input ("…; [Obedi") loses
 * only its dangling bracket: the partial label stays as plain text
 * (#76).
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
      // Truncated excerpt edge (#76): an unmatched "[" whose fragment
      // runs to the end of the input — no closing bracket, no line
      // break, and no further bracket after it — is a link an excerpt
      // cut off mid-syntax ("…; Faithfulness; [Obedi"). Drop the
      // dangling bracket (and the "!" of a truncated image) and keep
      // the partial label as plain text, so a card never renders raw
      // bracket syntax. Unmatched brackets anywhere else are literal
      // text and stay: the guards keep a run of "["s untouched (each
      // one is either followed by another "[" or preceded by one),
      // keep any "[" whose text continues onto another line, and keep
      // any fragment whose parentheses close without opening — a
      // label cut mid-label can carry "(" (a parenthetical label or
      // alt text), but only literal notation in full text (an
      // interval like "[0, 1)") carries a ")" that no "(" in the
      // fragment opened, so that text keeps its bracket. The run guard
      // checks the character before the bracket itself (`open`), not
      // before the "!" of an image: for a truncated linked image
      // ("[![Elaine L. Ja") the outer "[" is literal text handled on
      // its own iteration, and the image's "![" must still drop
      // together.
      // The cheap guards run first: only the final "[" of the input
      // can pass them (any earlier one has a "[" after it), so the
      // parenthesis scan below runs at most once per call — scanning
      // every unmatched bracket's suffix would be quadratic on a run
      // of "["s.
      const isTrailingFragmentShape =
        text.indexOf("[", open + 1) === -1 &&
        text.indexOf("]", open + 1) === -1 &&
        text.indexOf("\n", open + 1) === -1 &&
        text[open - 1] !== "[";
      let hasUnmatchedCloseParen = false;
      let hasHtmlLineBreak = false;
      if (isTrailingFragmentShape) {
        // Escaped parens are protected as placeholders before this
        // scanner runs (protectEscapedPunctuation), so count the
        // placeholders as the parens they represent — only here, in
        // the character used for the depth check; the input stays
        // protected for the later markup passes. Otherwise a literal
        // "\)" in interval notation ("[0, 1\)") is invisible to the
        // scan and its bracket is misread as a truncated fragment,
        // while an escaped "\(" in a truncated label ("[Faith \(part")
        // is miscounted the other way.
        const openParenPlaceholder = String.fromCharCode(
          ESCAPE_PLACEHOLDER_BASE + ESCAPED_PUNCTUATION.indexOf("("),
        );
        const closeParenPlaceholder = String.fromCharCode(
          ESCAPE_PLACEHOLDER_BASE + ESCAPED_PUNCTUATION.indexOf(")"),
        );
        let parenDepth = 0;
        for (let p = open + 1; p < text.length; p++) {
          if (text[p] === "(" || text[p] === openParenPlaceholder) parenDepth++;
          else if (text[p] === ")" || text[p] === closeParenPlaceholder) {
            parenDepth--;
            if (parenDepth < 0) {
              hasUnmatchedCloseParen = true;
              break;
            }
          }
        }
        // This scanner runs before the HTML pass below converts
        // line-break and block tags to "\n", so an HTML break in the
        // fragment ("[hope<br>charity") must count as a line break
        // here too, or a mid-text literal bracket would be misread
        // as a truncated fragment.
        hasHtmlLineBreak =
          /<(?:br\b[^>]*>|\/(?:p|div|li|ul|ol|h[1-6]|blockquote|tr|td|th|section|article)\s*>)/i.test(
            text.slice(open + 1),
          );
      }
      const isTrailingFragment =
        isTrailingFragmentShape && !hasUnmatchedCloseParen && !hasHtmlLineBreak;
      if (isTrailingFragment) {
        i = open + 1;
        continue;
      }
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
 * (`# Prayer`), emphasis markers, and raw HTML tags — and search
 * snippets can carry U+FFFD replacement characters where the engine's
 * byte-wise excerpt cut a multibyte character in two (#77). Both apps
 * render `Verse.text` as-is, so the markup is stripped here, at the
 * single mapping choke point, keeping the readable words and dropping
 * the syntax around them. Plain text passes through unchanged apart
 * from whitespace normalization.
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
  const codeSpanMarkers = chooseCodeSpanMarkers(text);
  text = protectCodeSpans(text, codeSpans, codeSpanMarkers);
  // Replacement characters are corruption, never content (#77). The
  // engine builds search snippets by slicing source text at a byte
  // limit (upstream gospel-engine `snippet`); when the cut falls
  // inside a multibyte UTF-8 character, its JSON encoder turns each
  // leftover byte into U+FFFD, so a card read "…(2014), 46��…" — the
  // sliced character itself (here the page-range dash) never reaches
  // us and cannot be recovered, but the replacement glyphs must not
  // render. Unpaired surrogates render as U+FFFD too (a UTF-16 slice
  // through an astral character leaves one behind), so they go as
  // well; well-formed surrogate pairs (real emoji in engine text,
  // e.g. the 🎧 audio marker) are untouched. This runs AFTER code
  // spans are captured, so span content keeps its artifacts until
  // restoreCodeSpans cleans it the same way — a span that held only
  // corruption then empties entirely instead of leaving a pair of
  // stray backticks behind — and before every markup pass, so the
  // whitespace normalization below tidies any gap a drop leaves.
  text = dropReplacementArtifacts(text);
  // Spans that the same cleanup empties (or leaves whitespace-only)
  // are unwrapped now, before whitespace normalization, so they
  // cannot restore to stray whitespace after the trim (see
  // unwrapEmptiedCodeSpans above).
  text = unwrapEmptiedCodeSpans(text, codeSpans, codeSpanMarkers);
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
  // or surrogate value is left as-is rather than throwing. A numeric
  // entity for U+FFFD itself (&#65533; / &#xFFFD;) decodes to nothing:
  // it is the same replacement-character corruption as the raw form
  // dropped at the top of this function, in entity form, and decoding
  // runs after that cleanup (#77).
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
      if (codePoint === 0xfffd) {
        return "";
      }
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
  return restoreEscapedPunctuation(restoreCodeSpans(text.trim(), codeSpans, codeSpanMarkers));
}

/**
 * The id for a full-library (/api/search) result, derived from the
 * engine's document identity (`source_type` + `source_id`, both present
 * on every live search item — verified against the production proxy on
 * 2026-11-01) instead of its title. Distinct documents routinely share
 * a title: a `charity` search returns two different talks both titled
 * "Charity Never Faileth" (Silvia H. Allred, 2011 and Thomas S. Monson,
 * 2010). Deriving the id from the title collapsed both to
 * `charity-never-faileth`, so the result list carried duplicate React
 * keys — reconciliation with duplicate keys left one of the two cards
 * mounted stale across later searches and tab switches (#79) — and the
 * store, which dedupes by id, treated the two talks as one verse.
 * Returns null when the item carries no source identity (the /api/get
 * shapes, whose items are identified by their reference instead), and
 * for scripture hits that carry a reference: upstream search gives
 * scripture hits `source_type: "scriptures"` plus a real `reference`
 * (gospel-engine internal/search), so the same verse must keep its
 * reference-slug id here — `/api/get` identifies it that way, and the
 * store dedupes saved verses by id alone. A `scriptures-<source_id>`
 * id would make an already-saved verse look addable a second time.
 * For non-scripture results this returns only the DOCUMENT part of
 * the Verse id; {@link buildVerse} appends the chunk's own text hash
 * so the finished id identifies the chunk, not just the document.
 */
function searchResultId(obj: Record<string, unknown>): string | null {
  if (
    firstString(obj, ["source_type"]) === "scriptures" &&
    firstString(obj, ["reference", "ref", "citation"]) !== undefined
  ) {
    return null;
  }
  const identity = sourceIdentity(obj);
  if (!identity) {
    return null;
  }
  return normalizeReference(`${identity.type} ${identity.id}`);
}

/**
 * The engine's document identity on a raw result item (`source_type`
 * + `source_id`), or null when the item carries none. This identifies
 * the DOCUMENT a chunk came from; it is persisted on the Verse
 * (`sourceType` / `sourceId`) so identity decisions never have to be
 * guessed back from the Verse id's shape (#79 review rounds).
 */
function sourceIdentity(obj: Record<string, unknown>): { type: string; id: string } | null {
  const sourceId = obj["source_id"];
  if (
    typeof sourceId !== "number" &&
    !(typeof sourceId === "string" && sourceId.trim().length > 0)
  ) {
    return null;
  }
  return {
    type: firstString(obj, ["source_type"]) ?? "library",
    id: String(sourceId).trim(),
  };
}

/** The `scripture:<slug>` chunk key for a passage reference, if it parses as one. */
function scriptureChunkKey(reference: string): string | null {
  const parsed = parseReference(reference);
  return parsed === null ? null : `scripture:${normalizeReference(parsed)}`;
}

/**
 * Derive a Verse's persisted per-chunk identity (see the `chunkKey`
 * doc on the Verse type). Stephen's ruling on #79 (2026-11-01): each
 * chunk of a document stays its own memorizable item, so a library
 * chunk's key binds the document identity to a hash of the chunk's
 * OWN text — stable when the chunk returns alone, in a subset, or
 * reordered, and different for every other chunk of the document.
 * A scripture passage is the one text-independent case: its key is
 * its reference, because a search snippet and the full /api/get text
 * of the same passage (Ether 12:27) are different texts for the same
 * item and must match. An explicit `source_type` takes precedence:
 * only `scriptures` marks a passage, so a non-scripture result that
 * merely happens to be TITLED like a passage (a talk titled
 * "Ether 12:27") keeps its content-keyed identity and never collides
 * with the passage itself. Only when no source type is present does
 * the heuristic apply — an upstream `verse` field, or a verse-level
 * (chapter:verse) reference; chapter-only and title references fall
 * through to the content-keyed forms so distinct chunks of a manual
 * or talk never collapse into one item.
 */
function deriveChunkKey(
  reference: string,
  plainText: string,
  obj: Record<string, unknown>,
  identity: { type: string; id: string } | null,
): string {
  const explicitType = firstString(obj, ["source_type"]);
  const isScripturePassage =
    explicitType !== undefined
      ? explicitType === "scriptures"
      : identity?.type === "scriptures" ||
        obj["verse"] !== undefined ||
        (parseReference(reference)?.includes(":") ?? false);
  if (isScripturePassage) {
    const key = scriptureChunkKey(reference);
    if (key !== null) {
      return key;
    }
  }
  if (identity) {
    return `${identity.type}:${identity.id}:${textHash(plainText)}`;
  }
  return `ref:${normalizeReference(reference)}:${textHash(plainText)}`;
}

/** Deterministic 32-bit FNV-1a hash of a verse's text, base-36. */
function textHash(text: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

/**
 * Whether two references name the same passage/chunk for the
 * legacy comparisons in {@link isSameVerse}: casing and whitespace
 * runs are not significant ("Alma 32" vs a later response's
 * `reference_query: "alma 32"`), while every other character must
 * match exactly. This is deliberately weaker than
 * {@link normalizeReference}'s slug form — it does not equate
 * punctuation differences — and it never replaces the persisted
 * `chunkKey` identity.
 */
function referencesMatch(a: string, b: string): boolean {
  const normalize = (ref: string): string => ref.trim().replace(/\s+/g, " ").toLowerCase();
  return normalize(a) === normalize(b);
}

/**
 * Whether two Verse objects are the same memorization item, for
 * library membership and store deduplication.
 *
 * The persisted per-chunk identity (`chunkKey`, with the engine's
 * `sourceType` / `sourceId` alongside it) is authoritative when both
 * sides carry one. For a scripture key — the passage reference, with
 * no text in it — key equality alone decides. For a content key
 * (document or reference identity plus a hash of the chunk's own
 * text), the texts must also match: the hash is 32-bit FNV-1a and
 * distinct snippets can collide (`costarring` and `liquid` both
 * hash to `q5yxel`), so key equality alone would equate two
 * different chunks of one document and make the second unsaveable.
 * Same key + same text is still the same chunk in every response
 * shape, so the extra check costs nothing real. That is what
 * keeps the cases apart that id equality and reference + text each
 * got wrong in the #79 review rounds:
 *
 * - Two chunks of one document share the document id — in [A, B] the
 *   first chunk held it bare and the second a `~<hash>` suffix, and
 *   B returned alone took the bare id, so id equality equated A and
 *   B. Their chunk keys differ (document identity + each chunk's own
 *   text hash), in every response shape.
 * - Two distinct documents can share a title AND a snippet, so
 *   reference + text equated them. Their chunk keys differ by source
 *   identity, so they stay distinct and both remain addable.
 * - Two different chunks of ONE document whose texts hash-collide
 *   share a chunk key; their texts differ, so they stay distinct
 *   and both remain addable.
 * - A scripture search snippet and the full /api/get text of the
 *   same passage (Ether 12:27) are different texts that must match:
 *   both carry the passage's text-independent `scripture:` key.
 *
 * When only one side carries a key, the other is a legacy save (made
 * before the field existed — its id may be a title slug or a bare
 * document id, with no source identity stored). The bridge is the
 * strongest evidence the legacy entry itself carries: reference +
 * text for a chunk, or the passage reference alone for a scripture
 * key (a legacy full-text save must match its search snippet).
 * Reference comparisons in these legacy paths are case- and
 * whitespace-insensitive (see {@link referencesMatch}): a chapter
 * saved as "Alma 32" must still match a later response whose
 * `reference_query` is "alma 32" when the text is identical. The
 * store annotates the legacy entry with the verified key on such a
 * match, so the bridge is needed at most once per entry.
 *
 * When neither side carries a key (legacy saves, demo verses, and
 * hand-built verses), fall back to the pre-key tests: same id + same
 * reference (a passage re-encountered under a different text form),
 * or same reference + same text (the same chunk re-encountered under
 * a renumbered list-local id).
 */
export function isSameVerse(a: Verse, b: Verse): boolean {
  const keyA = a.chunkKey;
  const keyB = b.chunkKey;
  if (keyA !== undefined && keyB !== undefined) {
    if (keyA !== keyB) {
      return false;
    }
    // A scripture key is the passage reference alone, so it stays
    // text-independent: a search snippet and the full /api/get text
    // of the same passage are the same item. A content key embeds
    // only a 32-bit hash of the chunk's text, which can collide
    // across distinct chunks of one document, so the text itself
    // must confirm the match.
    if (keyA.startsWith("scripture:")) {
      return true;
    }
    return a.text === b.text;
  }
  if (keyA !== undefined || keyB !== undefined) {
    const keyed = keyA !== undefined ? a : b;
    const legacy = keyA !== undefined ? b : a;
    const key = keyA !== undefined ? keyA : keyB;
    if (key !== undefined && key.startsWith("scripture:")) {
      return scriptureChunkKey(legacy.reference) === key;
    }
    return referencesMatch(legacy.reference, keyed.reference) && legacy.text === keyed.text;
  }
  if (a.id === b.id && referencesMatch(a.reference, b.reference)) {
    return true;
  }
  return referencesMatch(a.reference, b.reference) && a.text === b.text;
}

/**
 * Whether `incoming` supplies at least one persisted identity field
 * (`chunkKey`, `sourceType`, or `sourceId`) that `saved` is missing —
 * i.e. whether reconciling `saved` against `incoming` would actually
 * change `saved`. This is the ONLY condition under which the store's
 * reconciliation branch (and SearchTab's reconcile-on-search pass)
 * may persist: verses that legitimately carry a `chunkKey` without
 * source fields (demo verses, /api/get results) match themselves on
 * re-search, and persisting that no-op match would advance
 * `updatedAt` — which Drive sync uses to detect local edits — and
 * risk a false sync conflict. Both call sites share this helper so
 * their guards cannot drift apart.
 */
export function suppliesMissingVerseIdentity(saved: Verse, incoming: Verse): boolean {
  return (
    (saved.chunkKey === undefined && incoming.chunkKey !== undefined) ||
    (saved.sourceType === undefined && incoming.sourceType !== undefined) ||
    (saved.sourceId === undefined && incoming.sourceId !== undefined)
  );
}

/**
 * Guarantee unique ids within one result list. The first occurrence
 * of an id keeps the canonical id, so ordinary lists are untouched.
 * A repeat — a shape {@link searchResultId} cannot disambiguate, e.g.
 * several chunks of one document under a single shared
 * reference/title — gets a suffix derived from its own text
 * (`<id>~<hash>`), never from its position: a positional suffix is
 * reassigned to a different chunk when a later response reorders the
 * same results, and a saved chunk's id must stay its own (membership
 * and dedupe compare ids — see {@link isSameVerse}). The `~`
 * separator can never appear in a canonical id
 * ({@link normalizeReference} emits only `[a-z0-9-]`), so a generated
 * suffix cannot collide with another result's own id the way
 * `charity`, `charity`, `charity-2` collided under `-2` suffixing;
 * the counter fallback covers only exact duplicates (same id AND
 * same text — interchangeable items) and hash collisions. Unique
 * ids matter because duplicate ids in a rendered result list are
 * duplicate React keys, whose reconciliation is undefined and left
 * stale cards on screen (#79). This is now only a backstop:
 * library results arrive with chunk-scoped ids already (see
 * {@link buildVerse}), and the suffixing never touches `chunkKey`,
 * so a verse renumbered here keeps its persisted identity for
 * {@link isSameVerse} regardless of the id a given list gave it.
 */
export function withUniqueIds(verses: Verse[]): Verse[] {
  const assigned = new Set<string>();
  return verses.map((verse) => {
    if (!assigned.has(verse.id)) {
      assigned.add(verse.id);
      return verse;
    }
    const base = `${verse.id}~${textHash(verse.text)}`;
    let candidate = base;
    let suffix = 2;
    while (assigned.has(candidate)) {
      candidate = `${base}~${suffix}`;
      suffix += 1;
    }
    assigned.add(candidate);
    return { ...verse, id: candidate };
  });
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
  const identity = sourceIdentity(obj);
  const documentId = searchResultId(obj);
  // A library result's id is chunk-scoped (`<documentId>~<textHash>`):
  // the bare document id is shared by every chunk of the document, so
  // a chunk must not carry it alone — whichever chunk a response
  // happened to return first (or alone) would take it, and a saved
  // chunk could not be told from a different one (#79). Scripture
  // passages and source-less shapes keep the reference-slug id, which
  // is already unique per passage.
  const verse: Verse = {
    id: documentId !== null ? `${documentId}~${textHash(plain)}` : normalizeReference(reference),
    reference,
    text: plain,
    chunkKey: deriveChunkKey(reference, plain, obj, identity),
  };
  if (identity) {
    verse.sourceType = identity.type;
    verse.sourceId = identity.id;
  }
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
 * The /api/get shape is verified and the /api/search shape was verified
 * against the production proxy on 2026-11-01 (items carry `title`,
 * `snippet`, `source_type`, `source_id`); the field fallbacks stay
 * defensive and this returns null when nothing matches. See
 * docs/api-notes.md.
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
  // The envelope — not the chapter object — carries the document
  // identity: `source_type` sits on the envelope and the chapter's
  // own `id` is its `source_id`. Passing only `chapter` to buildVerse
  // dropped both, so a chapter Verse got a source-less `ref:` chunk
  // key and could not key-match its /api/search representation
  // (`chapters:<id>:<textHash>`). Merge the envelope identity in
  // (the chapter object's own fields win where present); the text
  // hash and every other field come from the chapter as before.
  const identified: Record<string, unknown> = { ...chapter };
  if (identified["source_type"] === undefined) {
    identified["source_type"] = firstString(obj, ["source_type"]) ?? "chapters";
  }
  if (identified["source_id"] === undefined && chapter["id"] !== undefined) {
    identified["source_id"] = chapter["id"];
  }
  return buildVerse(reference, text, identified);
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
    return withUniqueIds(items.map(mapSearchItem).filter((v): v is Verse => v !== null));
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
    return withUniqueIds(items.map(mapSearchItem).filter((v): v is Verse => v !== null));
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
  // Every demo verse is a scripture passage, so it carries the same
  // text-independent passage key a live scripture result gets (#79).
  chunkKey: `scripture:${normalizeReference(reference)}`,
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
