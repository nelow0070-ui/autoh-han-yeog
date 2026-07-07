const choseong = [
  "ㄱ",
  "ㄲ",
  "ㄴ",
  "ㄷ",
  "ㄸ",
  "ㄹ",
  "ㅁ",
  "ㅂ",
  "ㅃ",
  "ㅅ",
  "ㅆ",
  "ㅇ",
  "ㅈ",
  "ㅉ",
  "ㅊ",
  "ㅋ",
  "ㅌ",
  "ㅍ",
  "ㅎ",
] as const;

const jungseong = [
  "ㅏ",
  "ㅐ",
  "ㅑ",
  "ㅒ",
  "ㅓ",
  "ㅔ",
  "ㅕ",
  "ㅖ",
  "ㅗ",
  "ㅘ",
  "ㅙ",
  "ㅚ",
  "ㅛ",
  "ㅜ",
  "ㅝ",
  "ㅞ",
  "ㅟ",
  "ㅠ",
  "ㅡ",
  "ㅢ",
  "ㅣ",
] as const;

const jongseong = [
  "",
  "ㄱ",
  "ㄲ",
  "ㄳ",
  "ㄴ",
  "ㄵ",
  "ㄶ",
  "ㄷ",
  "ㄹ",
  "ㄺ",
  "ㄻ",
  "ㄼ",
  "ㄽ",
  "ㄾ",
  "ㄿ",
  "ㅀ",
  "ㅁ",
  "ㅂ",
  "ㅄ",
  "ㅅ",
  "ㅆ",
  "ㅇ",
  "ㅈ",
  "ㅊ",
  "ㅋ",
  "ㅌ",
  "ㅍ",
  "ㅎ",
] as const;

const keyToJamo = new Map<string, string>([
  ["r", "ㄱ"],
  ["R", "ㄲ"],
  ["s", "ㄴ"],
  ["e", "ㄷ"],
  ["E", "ㄸ"],
  ["f", "ㄹ"],
  ["a", "ㅁ"],
  ["q", "ㅂ"],
  ["Q", "ㅃ"],
  ["t", "ㅅ"],
  ["T", "ㅆ"],
  ["d", "ㅇ"],
  ["w", "ㅈ"],
  ["W", "ㅉ"],
  ["c", "ㅊ"],
  ["z", "ㅋ"],
  ["x", "ㅌ"],
  ["v", "ㅍ"],
  ["g", "ㅎ"],
  ["k", "ㅏ"],
  ["o", "ㅐ"],
  ["i", "ㅑ"],
  ["O", "ㅒ"],
  ["j", "ㅓ"],
  ["p", "ㅔ"],
  ["u", "ㅕ"],
  ["P", "ㅖ"],
  ["h", "ㅗ"],
  ["y", "ㅛ"],
  ["n", "ㅜ"],
  ["b", "ㅠ"],
  ["m", "ㅡ"],
  ["l", "ㅣ"],
]);

const jamoToKeys = new Map<string, string>(
  [...keyToJamo.entries()].map(([key, jamo]) => [jamo, key]),
);

jamoToKeys.set("ㅘ", "hk");
jamoToKeys.set("ㅙ", "ho");
jamoToKeys.set("ㅚ", "hl");
jamoToKeys.set("ㅝ", "nj");
jamoToKeys.set("ㅞ", "np");
jamoToKeys.set("ㅟ", "nl");
jamoToKeys.set("ㅢ", "ml");
jamoToKeys.set("ㄳ", "rt");
jamoToKeys.set("ㄵ", "sw");
jamoToKeys.set("ㄶ", "sg");
jamoToKeys.set("ㄺ", "fr");
jamoToKeys.set("ㄻ", "fa");
jamoToKeys.set("ㄼ", "fq");
jamoToKeys.set("ㄽ", "ft");
jamoToKeys.set("ㄾ", "fx");
jamoToKeys.set("ㄿ", "fv");
jamoToKeys.set("ㅀ", "fg");
jamoToKeys.set("ㅄ", "qt");

const compoundVowels = new Map<string, string>([
  ["ㅗㅏ", "ㅘ"],
  ["ㅗㅐ", "ㅙ"],
  ["ㅗㅣ", "ㅚ"],
  ["ㅜㅓ", "ㅝ"],
  ["ㅜㅔ", "ㅞ"],
  ["ㅜㅣ", "ㅟ"],
  ["ㅡㅣ", "ㅢ"],
]);

const compoundFinals = new Map<string, string>([
  ["ㄱㅅ", "ㄳ"],
  ["ㄴㅈ", "ㄵ"],
  ["ㄴㅎ", "ㄶ"],
  ["ㄹㄱ", "ㄺ"],
  ["ㄹㅁ", "ㄻ"],
  ["ㄹㅂ", "ㄼ"],
  ["ㄹㅅ", "ㄽ"],
  ["ㄹㅌ", "ㄾ"],
  ["ㄹㅍ", "ㄿ"],
  ["ㄹㅎ", "ㅀ"],
  ["ㅂㅅ", "ㅄ"],
]);

const splitFinals = new Map<string, [string, string]>([
  ["ㄳ", ["ㄱ", "ㅅ"]],
  ["ㄵ", ["ㄴ", "ㅈ"]],
  ["ㄶ", ["ㄴ", "ㅎ"]],
  ["ㄺ", ["ㄹ", "ㄱ"]],
  ["ㄻ", ["ㄹ", "ㅁ"]],
  ["ㄼ", ["ㄹ", "ㅂ"]],
  ["ㄽ", ["ㄹ", "ㅅ"]],
  ["ㄾ", ["ㄹ", "ㅌ"]],
  ["ㄿ", ["ㄹ", "ㅍ"]],
  ["ㅀ", ["ㄹ", "ㅎ"]],
  ["ㅄ", ["ㅂ", "ㅅ"]],
]);

const initialSet = new Set<string>(choseong);
const vowelSet = new Set<string>(jungseong);
const finalSet = new Set<string>(jongseong.filter(Boolean));

type Syllable = {
  initial: string;
  medial: string;
  final: string;
};

export function keysToHangul(input: string): string {
  const jamo = [...input].map((char) => keyToJamo.get(char) ?? char);
  let result = "";
  let current: Syllable | null = null;

  const flush = () => {
    if (!current) {
      return;
    }

    result += composeSyllable(current);
    current = null;
  };

  for (const char of jamo) {
    if (!isKoreanJamo(char)) {
      flush();
      result += char;
      continue;
    }

    if (vowelSet.has(char)) {
      if (!current) {
        result += char;
        continue;
      }

      if (!current.medial) {
        current.medial = char;
        continue;
      }

      const combinedVowel = compoundVowels.get(current.medial + char);
      if (!current.final && combinedVowel) {
        current.medial = combinedVowel;
        continue;
      }

      if (current.final) {
        const split = splitFinals.get(current.final);
        if (split) {
          current.final = split[0];
          result += composeSyllable(current);
          current = { initial: split[1], medial: char, final: "" };
        } else {
          const nextInitial: string = current.final;
          current.final = "";
          result += composeSyllable(current);
          current = { initial: nextInitial, medial: char, final: "" };
        }
        continue;
      }

      flush();
      result += char;
      continue;
    }

    if (!initialSet.has(char)) {
      flush();
      result += char;
      continue;
    }

    if (!current) {
      current = { initial: char, medial: "", final: "" };
      continue;
    }

    if (!current.medial) {
      flush();
      current = { initial: char, medial: "", final: "" };
      continue;
    }

    if (!current.final && finalSet.has(char)) {
      current.final = char;
      continue;
    }

    const combinedFinal = compoundFinals.get(current.final + char);
    if (combinedFinal) {
      current.final = combinedFinal;
      continue;
    }

    flush();
    current = { initial: char, medial: "", final: "" };
  }

  flush();
  return result;
}

export function hangulToKeys(input: string): string {
  let result = "";

  for (const char of input) {
    const code = char.charCodeAt(0);

    if (code >= 0xac00 && code <= 0xd7a3) {
      const offset = code - 0xac00;
      const initial = choseong[Math.floor(offset / 588)];
      const medial = jungseong[Math.floor((offset % 588) / 28)];
      const final = jongseong[offset % 28];

      result += jamoToKeys.get(initial) ?? initial;
      result += jamoToKeys.get(medial) ?? medial;
      result += final ? (jamoToKeys.get(final) ?? final) : "";
      continue;
    }

    result += jamoToKeys.get(char) ?? char;
  }

  return result;
}

function composeSyllable(syllable: Syllable): string {
  if (!syllable.medial) {
    return syllable.initial;
  }

  const initialIndex = choseong.indexOf(syllable.initial as never);
  const medialIndex = jungseong.indexOf(syllable.medial as never);
  const finalIndex = jongseong.indexOf(syllable.final as never);

  if (initialIndex < 0 || medialIndex < 0 || finalIndex < 0) {
    return syllable.initial + syllable.medial + syllable.final;
  }

  return String.fromCharCode(0xac00 + (initialIndex * 21 + medialIndex) * 28 + finalIndex);
}

function isKoreanJamo(char: string): boolean {
  return initialSet.has(char) || vowelSet.has(char);
}
