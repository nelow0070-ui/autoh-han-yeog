import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import wordListPath from "word-list";

const koreanXmlUrl =
  "https://raw.githubusercontent.com/spellcheck-ko/korean-dict-nikl-krdict/master/45000.xml";

const dataDir = join(process.cwd(), "data", "raw");
const koreanOutputPath = join(dataDir, "korean_words.txt");
const englishOutputPath = join(dataDir, "english_words.txt");

await mkdir(dataDir, { recursive: true });

const [koreanXmlResponse, englishRaw] = await Promise.all([
  fetch(koreanXmlUrl),
  readFile(wordListPath, "utf8"),
]);

if (!koreanXmlResponse.ok) {
  throw new Error(`Failed to download Korean dictionary: ${koreanXmlResponse.status}`);
}

const koreanXml = await koreanXmlResponse.text();
const koreanWords = extractKoreanWords(koreanXml);
const englishWords = extractEnglishWords(englishRaw);

await Promise.all([
  writeLines(koreanOutputPath, koreanWords),
  writeLines(englishOutputPath, englishWords),
]);

console.log(`Korean words: ${koreanWords.length.toLocaleString()} -> ${koreanOutputPath}`);
console.log(`English words: ${englishWords.length.toLocaleString()} -> ${englishOutputPath}`);

function extractKoreanWords(xml: string): string[] {
  const words = new Set<string>();
  const writtenFormPattern = /att="writtenForm"\s+val="([^"]+)"/g;
  let match: RegExpExecArray | null;

  while ((match = writtenFormPattern.exec(xml))) {
    const word = decodeXml(match[1]).normalize("NFC").trim();
    if (/^[가-힣]{2,20}$/.test(word)) {
      words.add(word);
    }
  }

  return [...words].sort((left, right) => left.localeCompare(right, "ko"));
}

function extractEnglishWords(raw: string): string[] {
  const words = new Set<string>();

  for (const line of raw.split(/\r?\n/)) {
    const word = line.trim().toLowerCase();
    if (/^[a-z]{2,24}$/.test(word)) {
      words.add(word);
    }
  }

  return [...words].sort();
}

async function writeLines(path: string, lines: string[]): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${lines.join("\n")}\n`, "utf8");
}

function decodeXml(value: string): string {
  return value
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&amp;", "&");
}
