import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { hangulToKeys, keysToHangul } from "../keyboard.js";
import { getNgrams, type Label, type NgramModel, normalizeForModel } from "../model.js";

const rawDir = join(process.cwd(), "data", "raw");
const modelPath = join(process.cwd(), "data", "model.json");
const koreanPath = join(rawDir, "korean_words.txt");
const englishPath = join(rawDir, "english_words.txt");

const ngramMin = 1;
const ngramMax = 4;
const alpha = 0.5;
const minFeatureCount = 2;
const maxExamplesPerLabel = 120_000;

const [koreanRaw, englishRaw] = await Promise.all([
  readFile(koreanPath, "utf8"),
  readFile(englishPath, "utf8"),
]);

const koreanTyped = readLines(koreanRaw)
  .map((word) => hangulToKeys(word))
  .filter((word) => /^[A-Za-z]{2,32}$/.test(word))
  .filter((word) => keysToHangul(word) !== word);

const englishWords = readLines(englishRaw)
  .map((word) => word.toLowerCase())
  .filter((word) => /^[a-z]{2,32}$/.test(word));

const englishSet = new Set(englishWords.map(normalizeForModel));
const koreanSet = new Set(koreanTyped.map(normalizeForModel));
const ambiguous = new Set([...koreanSet].filter((word) => englishSet.has(word)));

const koExamples = unique(koreanTyped)
  .filter((word) => !ambiguous.has(normalizeForModel(word)))
  .slice(0, maxExamplesPerLabel);
const enExamples = unique(englishWords)
  .filter((word) => !ambiguous.has(normalizeForModel(word)))
  .slice(0, maxExamplesPerLabel);

const rawStats = {
  ko: trainLabel(koExamples, "ko"),
  en: trainLabel(enExamples, "en"),
};
const globalFeatureCounts = new Map<string, number>();

for (const stats of Object.values(rawStats)) {
  for (const [feature, count] of stats.featureCounts) {
    globalFeatureCounts.set(feature, (globalFeatureCounts.get(feature) ?? 0) + count);
  }
}

const vocabulary = new Set(
  [...globalFeatureCounts.entries()]
    .filter(([, count]) => count >= minFeatureCount)
    .map(([feature]) => feature),
);

const model: NgramModel = {
  version: 1,
  ngramMin,
  ngramMax,
  alpha,
  labels: {
    ko: compactStats(rawStats.ko, vocabulary),
    en: compactStats(rawStats.en, vocabulary),
  },
  vocabularySize: vocabulary.size,
  trainedAt: new Date().toISOString(),
  sources: {
    korean: "spellcheck-ko/korean-dict-nikl-krdict 45000.xml",
    english: "word-list npm package",
  },
};

await mkdir(dirname(modelPath), { recursive: true });
await writeFile(modelPath, `${JSON.stringify(model)}\n`, "utf8");

console.log(`Korean examples: ${koExamples.length.toLocaleString()}`);
console.log(`English examples: ${enExamples.length.toLocaleString()}`);
console.log(`Ambiguous tokens removed: ${ambiguous.size.toLocaleString()}`);
console.log(`Model features: ${model.vocabularySize.toLocaleString()}`);
console.log(`Model written: ${modelPath}`);

function trainLabel(examples: string[], label: Label) {
  const featureCounts = new Map<string, number>();
  let totalFeatures = 0;

  for (const example of examples) {
    for (const feature of getNgrams(normalizeForModel(example), ngramMin, ngramMax)) {
      featureCounts.set(feature, (featureCounts.get(feature) ?? 0) + 1);
      totalFeatures += 1;
    }
  }

  return {
    label,
    examples: examples.length,
    totalFeatures,
    featureCounts,
  };
}

function compactStats(
  stats: ReturnType<typeof trainLabel>,
  vocabulary: Set<string>,
): NgramModel["labels"][Label] {
  const featureCounts: Record<string, number> = {};
  let totalFeatures = 0;

  for (const [feature, count] of stats.featureCounts) {
    if (!vocabulary.has(feature)) {
      continue;
    }

    featureCounts[feature] = count;
    totalFeatures += count;
  }

  return {
    examples: stats.examples,
    totalFeatures,
    featureCounts,
  };
}

function readLines(raw: string): string[] {
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}
