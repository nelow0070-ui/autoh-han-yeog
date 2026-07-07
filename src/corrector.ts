import { englishWords, koreanWords } from "./dictionaries.js";
import { keysToHangul } from "./keyboard.js";
import { loadDefaultModel, predictLabel } from "./model.js";

export type Correction = {
  original: string;
  corrected: string;
  changed: boolean;
  confidence: number;
  reason: string;
};

export type CorrectTokenOptions = {
  customCorrections?: Record<string, string>;
  ignoredTokens?: Iterable<string>;
  minConfidence?: number;
};

export type CodeCorrectionOptions = CorrectTokenOptions & {
  strings?: boolean;
  comments?: boolean;
  language?: CodeLanguage | string;
  fileName?: string;
};

export type TokenCorrectionEdit = {
  start: number;
  end: number;
  original: string;
  corrected: string;
  correction: Correction;
};

export type CodeLanguage =
  | "css"
  | "generic"
  | "html"
  | "javascript"
  | "json"
  | "markdown"
  | "plaintext"
  | "python"
  | "typescript";

const latinOnly = /^[A-Za-z]+$/;
const hangulSyllables = /[가-힣]/g;

export function correctToken(token: string, options: CorrectTokenOptions = {}): Correction {
  if (!latinOnly.test(token)) {
    return unchanged(token, "not a latin-only token");
  }

  const normalized = normalizeToken(token);
  const customCorrection = findCustomCorrection(options.customCorrections, token);
  if (customCorrection) {
    return {
      original: token,
      corrected: customCorrection,
      changed: customCorrection !== token,
      confidence: Number.POSITIVE_INFINITY,
      reason: "personal always-correct rule",
    };
  }

  if (hasToken(options.ignoredTokens, normalized)) {
    return unchanged(token, "token is in personal ignore list");
  }

  const minConfidence = options.minConfidence ?? 1.2;
  const model = loadDefaultModel();
  if (model) {
    const prediction = predictLabel(model, token);
    if (prediction.label === "ko" && prediction.confidence >= minConfidence) {
      return {
        original: token,
        corrected: keysToHangul(token),
        changed: true,
        confidence: Number(prediction.confidence.toFixed(3)),
        reason: "model predicted Korean-typed token",
      };
    }

    return unchanged(
      token,
      "model predicted English token",
      Number((-prediction.confidence).toFixed(3)),
    );
  }

  const lower = token.toLowerCase();
  const hangulCandidate = keysToHangul(token);
  const originalScore = scoreEnglish(lower);
  const candidateScore = scoreKorean(hangulCandidate);
  const confidence = candidateScore - originalScore;

  if (confidence >= (options.minConfidence ?? 2)) {
    return {
      original: token,
      corrected: hangulCandidate,
      changed: true,
      confidence,
      reason: `hangul candidate scored higher (${candidateScore} vs ${originalScore})`,
    };
  }

  return unchanged(token, `kept original (${candidateScore} vs ${originalScore})`, confidence);
}

export function correctText(text: string, options: CorrectTokenOptions = {}): string {
  return text.replace(/[A-Za-z]+/g, (token) => correctToken(token, options).corrected);
}

export function correctCodeText(
  code: string,
  options: CodeCorrectionOptions = {},
): string {
  const language = resolveLanguage(options);

  if (language === "markdown" || language === "plaintext") {
    return correctText(code, options);
  }

  if (language === "html") {
    return correctHtmlText(code, options);
  }

  return correctSourceText(code, getSourceProfile(language), options);
}

export function getPreviousTokenCorrectionEdit(
  code: string,
  cursorOffset: number,
  options: CodeCorrectionOptions = {},
): TokenCorrectionEdit | null {
  const language = resolveLanguage(options);
  const clampedOffset = Math.max(0, Math.min(cursorOffset, code.length));

  if (language === "markdown" || language === "plaintext") {
    return getPreviousPlainTextCorrection(code, clampedOffset, options);
  }

  if (language === "html") {
    return getPreviousHtmlCorrection(code, clampedOffset, options);
  }

  return getPreviousSourceCorrection(
    code,
    clampedOffset,
    getSourceProfile(language),
    options,
  );
}

export function detectLanguageFromFileName(fileName: string): CodeLanguage {
  const normalized = fileName.toLowerCase();
  const extension = normalized.includes(".")
    ? normalized.slice(normalized.lastIndexOf("."))
    : normalized;

  switch (extension) {
    case ".js":
    case ".jsx":
    case ".mjs":
    case ".cjs":
      return "javascript";
    case ".ts":
    case ".tsx":
    case ".mts":
    case ".cts":
      return "typescript";
    case ".py":
    case ".pyw":
      return "python";
    case ".json":
    case ".jsonc":
      return "json";
    case ".html":
    case ".htm":
      return "html";
    case ".css":
    case ".scss":
    case ".sass":
    case ".less":
      return "css";
    case ".md":
    case ".markdown":
    case ".mdx":
      return "markdown";
    case ".txt":
      return "plaintext";
    default:
      return "generic";
  }
}

type SourceProfile = {
  lineComments: string[];
  blockComments: Array<[string, string]>;
  strings: Array<{
    quote: string;
    templateExpressions?: boolean;
  }>;
};

function correctSourceText(
  code: string,
  profile: SourceProfile,
  options: CodeCorrectionOptions,
): string {
  const correctStrings = options.strings ?? true;
  const correctComments = options.comments ?? true;

  let result = "";
  let state:
    | "code"
    | "lineComment"
    | "blockComment"
    | "string"
    | "templateExpression" = "code";
  let blockCommentEnd = "";
  let stringEnd = "";
  let stringHasTemplateExpressions = false;
  let templateExpressionDepth = 0;
  let token = "";

  const flushToken = () => {
    if (!token) {
      return;
    }

    result += correctToken(token, options).corrected;
    token = "";
  };

  const appendCorrectable = (char: string) => {
    if (/[A-Za-z]/.test(char)) {
      token += char;
      return;
    }

    flushToken();
    result += char;
  };

  for (let index = 0; index < code.length; index += 1) {
    const char = code[index];
    const next = code[index + 1];

    if (state === "code") {
      const lineComment = findMatchingStart(code, index, profile.lineComments);
      if (lineComment) {
        result += lineComment;
        index += lineComment.length - 1;
        state = "lineComment";
        continue;
      }

      const blockComment = findMatchingPair(code, index, profile.blockComments);
      if (blockComment) {
        result += blockComment[0];
        index += blockComment[0].length - 1;
        blockCommentEnd = blockComment[1];
        state = "blockComment";
        continue;
      }

      const stringStart = findMatchingString(code, index, profile.strings);
      if (stringStart) {
        result += stringStart.quote;
        index += stringStart.quote.length - 1;
        stringEnd = stringStart.quote;
        stringHasTemplateExpressions = stringStart.templateExpressions ?? false;
        state = "string";
        continue;
      }

      result += char;
      continue;
    }

    if (state === "lineComment") {
      if (char === "\n") {
        flushToken();
        result += char;
        state = "code";
        continue;
      }

      if (correctComments) {
        appendCorrectable(char);
      } else {
        result += char;
      }
      continue;
    }

    if (state === "blockComment") {
      if (startsWithAt(code, blockCommentEnd, index)) {
        flushToken();
        result += blockCommentEnd;
        index += blockCommentEnd.length - 1;
        blockCommentEnd = "";
        state = "code";
        continue;
      }

      if (correctComments) {
        appendCorrectable(char);
      } else {
        result += char;
      }
      continue;
    }

    if (state === "string") {
      if (stringHasTemplateExpressions && char === "$" && next === "{") {
        flushToken();
        result += char + next;
        index += 1;
        state = "templateExpression";
        templateExpressionDepth = 1;
        continue;
      }

      if (stringEnd.length === 1 && char === "\\") {
        flushToken();
        result += char;
        if (next) {
          result += next;
          index += 1;
        }
        continue;
      }

      if (startsWithAt(code, stringEnd, index)) {
        flushToken();
        result += stringEnd;
        index += stringEnd.length - 1;
        stringEnd = "";
        stringHasTemplateExpressions = false;
        state = "code";
        continue;
      }

      if (correctStrings) {
        appendCorrectable(char);
      } else {
        result += char;
      }

      continue;
    }

    if (state === "templateExpression") {
      result += char;

      if (char === "{") {
        templateExpressionDepth += 1;
      } else if (char === "}") {
        templateExpressionDepth -= 1;
        if (templateExpressionDepth === 0) {
          state = "string";
        }
      }
    }
  }

  flushToken();
  return result;
}

function getPreviousSourceCorrection(
  code: string,
  cursorOffset: number,
  profile: SourceProfile,
  options: CodeCorrectionOptions,
): TokenCorrectionEdit | null {
  const correctStrings = options.strings ?? true;
  const correctComments = options.comments ?? true;
  let state:
    | "code"
    | "lineComment"
    | "blockComment"
    | "string"
    | "templateExpression" = "code";
  let blockCommentEnd = "";
  let stringEnd = "";
  let stringHasTemplateExpressions = false;
  let templateExpressionDepth = 0;
  let token = "";
  let tokenStart = -1;
  let latest: TokenCorrectionEdit | null = null;

  const flushToken = (end: number) => {
    if (!token) {
      return;
    }

    latest = createTokenEdit(token, tokenStart, end, options);
    token = "";
    tokenStart = -1;
  };

  const appendCorrectable = (char: string, index: number) => {
    if (/[A-Za-z]/.test(char)) {
      if (!token) {
        tokenStart = index;
      }
      token += char;
      return;
    }

    flushToken(index);
  };

  for (let index = 0; index < cursorOffset; index += 1) {
    const char = code[index];
    const next = code[index + 1];

    if (state === "code") {
      const lineComment = findMatchingStart(code, index, profile.lineComments);
      if (lineComment) {
        index += lineComment.length - 1;
        state = "lineComment";
        continue;
      }

      const blockComment = findMatchingPair(code, index, profile.blockComments);
      if (blockComment) {
        index += blockComment[0].length - 1;
        blockCommentEnd = blockComment[1];
        state = "blockComment";
        continue;
      }

      const stringStart = findMatchingString(code, index, profile.strings);
      if (stringStart) {
        index += stringStart.quote.length - 1;
        stringEnd = stringStart.quote;
        stringHasTemplateExpressions = stringStart.templateExpressions ?? false;
        state = "string";
      }
      continue;
    }

    if (state === "lineComment") {
      if (char === "\n") {
        flushToken(index);
        state = "code";
        continue;
      }

      if (correctComments) {
        appendCorrectable(char, index);
      }
      continue;
    }

    if (state === "blockComment") {
      if (startsWithAt(code, blockCommentEnd, index)) {
        flushToken(index);
        index += blockCommentEnd.length - 1;
        blockCommentEnd = "";
        state = "code";
        continue;
      }

      if (correctComments) {
        appendCorrectable(char, index);
      }
      continue;
    }

    if (state === "string") {
      if (stringHasTemplateExpressions && char === "$" && next === "{") {
        flushToken(index);
        index += 1;
        state = "templateExpression";
        templateExpressionDepth = 1;
        continue;
      }

      if (stringEnd.length === 1 && char === "\\") {
        flushToken(index);
        if (next) {
          index += 1;
        }
        continue;
      }

      if (startsWithAt(code, stringEnd, index)) {
        flushToken(index);
        index += stringEnd.length - 1;
        stringEnd = "";
        stringHasTemplateExpressions = false;
        state = "code";
        continue;
      }

      if (correctStrings) {
        appendCorrectable(char, index);
      }
      continue;
    }

    if (state === "templateExpression") {
      if (char === "{") {
        templateExpressionDepth += 1;
      } else if (char === "}") {
        templateExpressionDepth -= 1;
        if (templateExpressionDepth === 0) {
          state = "string";
        }
      }
    }
  }

  flushToken(cursorOffset);
  return latest;
}

function correctHtmlText(code: string, options: CodeCorrectionOptions): string {
  const correctStrings = options.strings ?? true;
  const correctComments = options.comments ?? true;
  let result = "";
  let state: "text" | "tag" | "comment" | "quotedAttribute" = "text";
  let quote = "";
  let token = "";

  const flushToken = () => {
    if (!token) {
      return;
    }

    result += correctToken(token, options).corrected;
    token = "";
  };

  const appendCorrectable = (char: string) => {
    if (/[A-Za-z]/.test(char)) {
      token += char;
      return;
    }

    flushToken();
    result += char;
  };

  for (let index = 0; index < code.length; index += 1) {
    const char = code[index];

    if (state === "text") {
      if (startsWithAt(code, "<!--", index)) {
        flushToken();
        result += "<!--";
        index += 3;
        state = "comment";
        continue;
      }

      if (char === "<") {
        flushToken();
        result += char;
        state = "tag";
        continue;
      }

      appendCorrectable(char);
      continue;
    }

    if (state === "comment") {
      if (startsWithAt(code, "-->", index)) {
        flushToken();
        result += "-->";
        index += 2;
        state = "text";
        continue;
      }

      if (correctComments) {
        appendCorrectable(char);
      } else {
        result += char;
      }
      continue;
    }

    if (state === "tag") {
      if (char === '"' || char === "'") {
        result += char;
        quote = char;
        state = "quotedAttribute";
        continue;
      }

      result += char;
      if (char === ">") {
        state = "text";
      }
      continue;
    }

    if (state === "quotedAttribute") {
      if (char === quote) {
        flushToken();
        result += char;
        quote = "";
        state = "tag";
        continue;
      }

      if (correctStrings) {
        appendCorrectable(char);
      } else {
        result += char;
      }
    }
  }

  flushToken();
  return result;
}

function getPreviousHtmlCorrection(
  code: string,
  cursorOffset: number,
  options: CodeCorrectionOptions,
): TokenCorrectionEdit | null {
  const correctStrings = options.strings ?? true;
  const correctComments = options.comments ?? true;
  let state: "text" | "tag" | "comment" | "quotedAttribute" = "text";
  let quote = "";
  let token = "";
  let tokenStart = -1;
  let latest: TokenCorrectionEdit | null = null;

  const flushToken = (end: number) => {
    if (!token) {
      return;
    }

    latest = createTokenEdit(token, tokenStart, end, options);
    token = "";
    tokenStart = -1;
  };

  const appendCorrectable = (char: string, index: number) => {
    if (/[A-Za-z]/.test(char)) {
      if (!token) {
        tokenStart = index;
      }
      token += char;
      return;
    }

    flushToken(index);
  };

  for (let index = 0; index < cursorOffset; index += 1) {
    const char = code[index];

    if (state === "text") {
      if (startsWithAt(code, "<!--", index)) {
        flushToken(index);
        index += 3;
        state = "comment";
        continue;
      }

      if (char === "<") {
        flushToken(index);
        state = "tag";
        continue;
      }

      appendCorrectable(char, index);
      continue;
    }

    if (state === "comment") {
      if (startsWithAt(code, "-->", index)) {
        flushToken(index);
        index += 2;
        state = "text";
        continue;
      }

      if (correctComments) {
        appendCorrectable(char, index);
      }
      continue;
    }

    if (state === "tag") {
      if (char === '"' || char === "'") {
        quote = char;
        state = "quotedAttribute";
        continue;
      }

      if (char === ">") {
        state = "text";
      }
      continue;
    }

    if (state === "quotedAttribute") {
      if (char === quote) {
        flushToken(index);
        quote = "";
        state = "tag";
        continue;
      }

      if (correctStrings) {
        appendCorrectable(char, index);
      }
    }
  }

  flushToken(cursorOffset);
  return latest;
}

function getPreviousPlainTextCorrection(
  text: string,
  cursorOffset: number,
  options: CodeCorrectionOptions,
): TokenCorrectionEdit | null {
  let end = cursorOffset;
  while (end > 0 && !/[A-Za-z]/.test(text[end - 1])) {
    end -= 1;
  }

  let start = end;
  while (start > 0 && /[A-Za-z]/.test(text[start - 1])) {
    start -= 1;
  }

  if (start === end) {
    return null;
  }

  return createTokenEdit(text.slice(start, end), start, end, options);
}

function resolveLanguage(options: CodeCorrectionOptions): CodeLanguage {
  if (options.language) {
    return normalizeLanguage(options.language);
  }

  if (options.fileName) {
    return detectLanguageFromFileName(options.fileName);
  }

  return "generic";
}

function normalizeLanguage(language: string): CodeLanguage {
  switch (language.toLowerCase()) {
    case "javascript":
    case "javascriptreact":
    case "js":
    case "jsx":
      return "javascript";
    case "typescript":
    case "typescriptreact":
    case "ts":
    case "tsx":
      return "typescript";
    case "python":
    case "py":
      return "python";
    case "json":
    case "jsonc":
      return "json";
    case "html":
      return "html";
    case "css":
    case "scss":
    case "sass":
    case "less":
      return "css";
    case "markdown":
    case "md":
    case "mdx":
      return "markdown";
    case "plaintext":
    case "text":
      return "plaintext";
    default:
      return "generic";
  }
}

function getSourceProfile(language: CodeLanguage): SourceProfile {
  switch (language) {
    case "javascript":
    case "typescript":
    case "generic":
      return {
        lineComments: ["//"],
        blockComments: [["/*", "*/"]],
        strings: [
          { quote: "`", templateExpressions: true },
          { quote: '"' },
          { quote: "'" },
        ],
      };
    case "python":
      return {
        lineComments: ["#"],
        blockComments: [],
        strings: [
          { quote: '"""' },
          { quote: "'''" },
          { quote: '"' },
          { quote: "'" },
        ],
      };
    case "json":
      return {
        lineComments: [],
        blockComments: [],
        strings: [{ quote: '"' }],
      };
    case "css":
      return {
        lineComments: [],
        blockComments: [["/*", "*/"]],
        strings: [{ quote: '"' }, { quote: "'" }],
      };
    default:
      return {
        lineComments: [],
        blockComments: [],
        strings: [],
      };
  }
}

function findMatchingStart(code: string, index: number, starts: string[]): string | null {
  for (const start of [...starts].sort((left, right) => right.length - left.length)) {
    if (startsWithAt(code, start, index)) {
      return start;
    }
  }

  return null;
}

function findMatchingPair(
  code: string,
  index: number,
  pairs: Array<[string, string]>,
): [string, string] | null {
  for (const pair of [...pairs].sort((left, right) => right[0].length - left[0].length)) {
    if (startsWithAt(code, pair[0], index)) {
      return pair;
    }
  }

  return null;
}

function findMatchingString(
  code: string,
  index: number,
  strings: SourceProfile["strings"],
): SourceProfile["strings"][number] | null {
  for (const string of [...strings].sort((left, right) => right.quote.length - left.quote.length)) {
    if (startsWithAt(code, string.quote, index)) {
      return string;
    }
  }

  return null;
}

function startsWithAt(value: string, search: string, index: number): boolean {
  return value.slice(index, index + search.length) === search;
}

function createTokenEdit(
  token: string,
  start: number,
  end: number,
  options: CorrectTokenOptions,
): TokenCorrectionEdit | null {
  const correction = correctToken(token, options);
  if (!correction.changed || correction.corrected === token) {
    return null;
  }

  return {
    start,
    end,
    original: token,
    corrected: correction.corrected,
    correction,
  };
}

function normalizeToken(token: string): string {
  return token.toLowerCase();
}

function hasToken(tokens: Iterable<string> | undefined, normalizedToken: string): boolean {
  if (!tokens) {
    return false;
  }

  for (const token of tokens) {
    if (normalizeToken(token) === normalizedToken) {
      return true;
    }
  }

  return false;
}

function findCustomCorrection(
  customCorrections: Record<string, string> | undefined,
  token: string,
): string | null {
  if (!customCorrections) {
    return null;
  }

  return customCorrections[token] ?? customCorrections[normalizeToken(token)] ?? null;
}

function scoreKorean(value: string): number {
  let score = 0;

  if (koreanWords.has(value)) {
    score += 5;
  }

  const hangulCount = value.match(hangulSyllables)?.length ?? 0;
  if (hangulCount === [...value].length && hangulCount > 0) {
    score += 2;
  }

  if (/[ㄱ-ㅎㅏ-ㅣ]/.test(value)) {
    score -= 2;
  }

  return score;
}

function scoreEnglish(value: string): number {
  let score = 0;

  if (englishWords.has(value)) {
    score += 5;
  }

  if (/[aeiou]/.test(value)) {
    score += 1;
  }

  if (/[qwrtypsdfghjklzxcvbnm]{5,}/.test(value)) {
    score -= 1;
  }

  return score;
}

function unchanged(token: string, reason: string, confidence = 0): Correction {
  return {
    original: token,
    corrected: token,
    changed: false,
    confidence,
    reason,
  };
}
