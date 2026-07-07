import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export type Label = "ko" | "en";

export type NgramModel = {
  version: 1;
  ngramMin: number;
  ngramMax: number;
  alpha: number;
  labels: Record<Label, {
    examples: number;
    totalFeatures: number;
    featureCounts: Record<string, number>;
  }>;
  vocabularySize: number;
  trainedAt: string;
  sources: {
    korean: string;
    english: string;
  };
};

export type Prediction = {
  label: Label;
  confidence: number;
  scores: Record<Label, number>;
};

let cachedModel: NgramModel | null | undefined;

export function loadDefaultModel(): NgramModel | null {
  if (cachedModel !== undefined) {
    return cachedModel;
  }

  const modelPath = findDefaultModelPath();
  if (!existsSync(modelPath)) {
    cachedModel = null;
    return cachedModel;
  }

  cachedModel = JSON.parse(readFileSync(modelPath, "utf8")) as NgramModel;
  return cachedModel;
}

function findDefaultModelPath(): string {
  const candidates = [join(process.cwd(), "data", "model.json")];

  if (typeof __dirname === "string") {
    candidates.push(
      join(__dirname, "..", "data", "model.json"),
      join(__dirname, "data", "model.json"),
    );
  }

  candidates.push(
    join(process.cwd(), "data", "model.json"),
  );

  return candidates.find((candidate) => existsSync(candidate)) ?? candidates[0];
}

export function predictLabel(model: NgramModel, token: string): Prediction {
  const features = getNgrams(normalizeForModel(token), model.ngramMin, model.ngramMax);
  const totalExamples = model.labels.ko.examples + model.labels.en.examples;
  const scores = {
    ko: scoreLabel(model, "ko", features, totalExamples),
    en: scoreLabel(model, "en", features, totalExamples),
  };
  const label: Label = scores.ko > scores.en ? "ko" : "en";
  const confidence = Math.abs(scores.ko - scores.en);

  return { label, confidence, scores };
}

export function getNgrams(value: string, min: number, max: number): string[] {
  const padded = `^${value}$`;
  const features: string[] = [];

  for (let size = min; size <= max; size += 1) {
    for (let index = 0; index <= padded.length - size; index += 1) {
      features.push(padded.slice(index, index + size));
    }
  }

  return features;
}

export function normalizeForModel(value: string): string {
  return value.normalize("NFC").toLowerCase();
}

function scoreLabel(
  model: NgramModel,
  label: Label,
  features: string[],
  totalExamples: number,
): number {
  const stats = model.labels[label];
  let score = Math.log(stats.examples / totalExamples);
  const denominator = stats.totalFeatures + model.alpha * model.vocabularySize;

  for (const feature of features) {
    const count = stats.featureCounts[feature] ?? 0;
    score += Math.log((count + model.alpha) / denominator);
  }

  return score;
}
