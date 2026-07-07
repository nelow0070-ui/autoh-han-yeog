import { correctCodeText, correctText, correctToken } from "./corrector.js";
import { keysToHangul } from "./keyboard.js";

const args = process.argv.slice(2);
const codeMode = args.includes("--code");
const language = readFlagValue(args, "--language");
const fileName = readFlagValue(args, "--file");
const input = args
  .filter((arg, index) => {
    const previous = args[index - 1];
    return arg !== "--code" && previous !== "--language" && previous !== "--file" && arg !== "--language" && arg !== "--file";
  })
  .join(" ");

if (!input) {
  console.log('Usage: npm run dev -- "dkssudgktpdy hello"');
  console.log('       npm run dev -- --code --language typescript "const msg = \\"dkssudgktpdy\\";"');
  console.log('       npm run dev -- --code --file app.py "msg = \\"dkssudgktpdy\\" # qksrkqtmqslek"');
  process.exit(0);
}

console.log(`input:     ${input}`);
console.log(
  `mode:      ${
    codeMode
      ? `code strings/comments by ${language ? `language=${language}` : fileName ? `file=${fileName}` : "generic profile"}`
      : "plain text"
  }`,
);
console.log(`corrected: ${codeMode ? correctCodeText(input, { language, fileName }) : correctText(input)}`);

if (codeMode) {
  process.exit(0);
}

console.log("");
console.log("tokens:");

for (const token of input.match(/[A-Za-z]+/g) ?? []) {
  const correction = correctToken(token);
  console.log(
    `- ${token} -> ${correction.corrected} | candidate=${keysToHangul(token)} | changed=${correction.changed} | confidence=${correction.confidence} | ${correction.reason}`,
  );
}

function readFlagValue(args: string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  if (index < 0) {
    return undefined;
  }

  return args[index + 1];
}
