/**
 * Untrusted community text is normalized before it is stored, matched against commands and heuristics,
 * written into notes or sent to a model. Hidden characters can smuggle instructions past a human reader
 * (Unicode tag characters, variation-selector encoding), reorder what a reader sees (bidirectional
 * overrides) or split keywords so filters miss them (zero-width characters).
 */

/** Invisible or layout-altering code points that carry no meaning in a chat message. */
const INVISIBLE = new RegExp([
  '[\\p{Cf}--[\\u200D]]', // format characters: zero-width (U+200B–U+200F), bidi controls (U+202A–U+202E, U+2066–U+2069), U+2060–U+2064, BOM, soft hyphen, tag characters U+E0000–U+E007F
  '\\p{Co}', '\\p{Cn}', '\\p{Cs}', // private use, unassigned, lone surrogates
  '[\\u{FE00}-\\u{FE0F}\\u{E0100}-\\u{E01EF}]', // variation selectors (used to encode hidden payloads)
  '[\\u{115F}\\u{1160}\\u{3164}\\u{FFA0}\\u{2800}\\u{034F}\\u{17B4}\\u{17B5}\\u{180B}-\\u{180D}\\u{180F}]', // fillers and other blank glyphs
].join('|'), 'gv');
/** Zero-width joiners are kept only inside emoji sequences (👩‍💻); anywhere else they hide or split text. */
const STRAY_JOINER = /(?<!\p{Extended_Pictographic}\p{Emoji_Modifier}?\u{FE0F}?)‍|‍(?!\p{Extended_Pictographic})/gu;
/** C0/C1 controls except tab and line breaks. */
const CONTROLS = new RegExp('[\\p{Cc}--[\\t\\n\\r]]', 'gv');
/** Combining marks beyond two per base character ("Zalgo" text). */
const MARK_RUNS = /(\p{M}{2})\p{M}+/gu;

export interface Sanitized { text: string; removed: number }

/**
 * NFKC-normalizes, removes invisible/control characters, caps combining marks and normalizes whitespace.
 * Single-line text collapses all whitespace to single spaces; multi-line text keeps up to one blank line.
 */
export function sanitizeText(value: string, options: { multiline?: boolean; max?: number } = {}): Sanitized {
  const normalized = value.normalize('NFKC');
  let removed = 0;
  const strip = () => { removed++; return ''; };
  let text = normalized.replace(STRAY_JOINER, strip).replace(INVISIBLE, strip).replace(CONTROLS, strip)
    .replace(MARK_RUNS, '$1').replace(/\r\n?/g, '\n');
  text = options.multiline
    ? text.replace(/[^\S\n]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{3,}/g, '\n\n').trim()
    : text.replace(/\s+/g, ' ').trim();
  if (options.max !== undefined && text.length > options.max) text = text.slice(0, options.max).trimEnd();
  return { text, removed };
}

export const cleanLine = (value: string, max?: number): string => sanitizeText(value, max === undefined ? {} : { max }).text;
export const cleanText = (value: string, max?: number): string => sanitizeText(value, { multiline: true, ...(max === undefined ? {} : { max }) }).text;

/** Applies `cleanText` to every string in a JSON-like value (used for model input). */
export function cleanDeep<T>(value: T): T {
  if (typeof value === 'string') return cleanText(value) as T;
  if (Array.isArray(value)) return value.map(item => cleanDeep(item) as unknown) as T;
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, cleanDeep(item)])) as T;
  return value;
}

/** Invisible word joiner: breaks trigger sequences without changing what a reader sees; `sanitizeText` removes it on read. */
const JOINER = '⁠';
/**
 * Trigger sequences other plugins act on when they read note text or properties: Templater commands (`<%`),
 * wikilinks and embeds (`[[`), template placeholders (`{{`), inline Dataview queries (`` `= `` / `` `$= ``).
 */
const PROPERTY_TRIGGERS = /<%|%>|\[\[|\]\]|\{\{|\}\}|`/g;

/** Defangs a frontmatter string so Obsidian and plugins treat it as plain data, not a link, template or query. */
export const defangProperty = (value: string): string => value.replace(PROPERTY_TRIGGERS, sequence => [...sequence].join(JOINER) + (sequence === '`' ? JOINER : ''));

/** Comparable form of a request for duplicate detection: case-, punctuation- and spacing-insensitive. */
export const comparable = (text: string): string => cleanLine(text).toLocaleLowerCase('en-US').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

/** A request needs real words: at least three letters or digits. */
export const meaningful = (text: string): boolean => (text.match(/[\p{L}\p{N}]/gu) ?? []).length >= 3;

const RESERVED = new Set(['coforge', 'system', 'streamer', 'moderator', 'admin']);
/** Viewer names cannot pose as the CoForge bot, the streamer or staff in the studio chat and on the public site. */
export function displayName(name: string): string {
  const clean = cleanLine(name, 50);
  return RESERVED.has(clean.toLocaleLowerCase('en-US').replace(/[^\p{L}\p{N}]/gu, '')) ? `${clean.slice(0, 40)} (viewer)` : clean;
}

const MARKDOWN = /[\\`*_{}[\]()#+\-.!|<>~=$%&:^"']/g;

/**
 * Escapes community text for a Markdown note so Obsidian shows it literally: no links, embeds, remote
 * images, HTML (iframes), tags, callouts, block references or inline Dataview/Templater expressions.
 */
export function escapeMarkdown(text: string): string {
  return text.split('\n').map(line => line.replace(MARKDOWN, character => `\\${character}`)).join('\n');
}

/** Reverses `escapeMarkdown` (and harmless backslash escapes a person may type) when a note is read back. */
export const unescapeMarkdown = (text: string): string => text.replace(/\\([\\`*_{}[\]()#+\-.!|<>~=$%&:^"'])/g, '$1');
