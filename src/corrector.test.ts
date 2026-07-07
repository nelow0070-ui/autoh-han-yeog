import assert from "node:assert/strict";
import test from "node:test";
import {
  correctCodeText,
  correctText,
  correctToken,
  detectLanguageFromFileName,
  getPreviousTokenCorrectionEdit,
} from "./corrector.js";

test("corrects Korean-looking keyboard mistakes", () => {
  assert.equal(correctToken("dkssudgktpdy").corrected, "안녕하세요");
  assert.equal(correctToken("qksrkqtmqslek").corrected, "반갑습니다");
});

test("keeps known English words", () => {
  assert.equal(correctToken("hello").corrected, "hello");
  assert.equal(correctText("hello dkssudgktpdy"), "hello 안녕하세요");
});

test("respects ignored tokens", () => {
  assert.equal(
    correctToken("dkssudgktpdy", { ignoredTokens: ["dkssudgktpdy"] }).corrected,
    "dkssudgktpdy",
  );
});

test("respects custom correction rules", () => {
  assert.equal(
    correctToken("custom", { customCorrections: { custom: "커스텀" } }).corrected,
    "커스텀",
  );
});

test("respects minimum confidence", () => {
  assert.equal(
    correctToken("dkssudgktpdy", { minConfidence: 999 }).corrected,
    "dkssudgktpdy",
  );
});

test("corrects only strings and comments in code mode", () => {
  const code = [
    'const dkssudgktpdy = "dkssudgktpdy";',
    "// qksrkqtmqslek",
    "function hello() { return 'gksrmf'; }",
  ].join("\n");

  assert.equal(
    correctCodeText(code, { language: "typescript" }),
    [
      'const dkssudgktpdy = "안녕하세요";',
      "// 반갑습니다",
      "function hello() { return '한글'; }",
    ].join("\n"),
  );
});

test("can disable comment correction in code mode", () => {
  assert.equal(
    correctCodeText('// dkssudgktpdy\nconst value = "dkssudgktpdy";', {
      comments: false,
      language: "typescript",
    }),
    '// dkssudgktpdy\nconst value = "안녕하세요";',
  );
});

test("does not correct template literal expressions", () => {
  assert.equal(
    correctCodeText("const value = `dkssudgktpdy ${gksrmf}`;", { language: "typescript" }),
    "const value = `안녕하세요 ${gksrmf}`;",
  );
});

test("uses Python comments and strings for Python files", () => {
  assert.equal(
    correctCodeText('value = "dkssudgktpdy" # qksrkqtmqslek\nname = dkssudgktpdy', {
      fileName: "app.py",
    }),
    'value = "안녕하세요" # 반갑습니다\nname = dkssudgktpdy',
  );
});

test("corrects only JSON strings for JSON files", () => {
  assert.equal(
    correctCodeText('{"message":"dkssudgktpdy","raw":qksrkqtmqslek}', {
      fileName: "ko.json",
    }),
    '{"message":"안녕하세요","raw":qksrkqtmqslek}',
  );
});

test("corrects HTML text, attributes, and comments", () => {
  assert.equal(
    correctCodeText('<div title="dkssudgktpdy">qksrkqtmqslek</div><!-- gksrmf -->', {
      fileName: "index.html",
    }),
    '<div title="안녕하세요">반갑습니다</div><!-- 한글 -->',
  );
});

test("treats Markdown as plain text", () => {
  assert.equal(
    correctCodeText("# dkssudgktpdy\n\nhello qksrkqtmqslek", { fileName: "README.md" }),
    "# 안녕하세요\n\nhello 반갑습니다",
  );
});

test("detects common languages from filenames", () => {
  assert.equal(detectLanguageFromFileName("src/App.tsx"), "typescript");
  assert.equal(detectLanguageFromFileName("script.py"), "python");
  assert.equal(detectLanguageFromFileName("README.md"), "markdown");
});

test("finds previous correctable token in TypeScript strings", () => {
  const code = 'const msg = "dkssudgktpdy ";';
  const edit = getPreviousTokenCorrectionEdit(code, code.indexOf(' ";') + 1, {
    language: "typescript",
  });

  assert.equal(edit?.original, "dkssudgktpdy");
  assert.equal(edit?.corrected, "안녕하세요");
});

test("does not auto-correct TypeScript identifiers", () => {
  const code = "const dkssudgktpdy = 1;";
  const edit = getPreviousTokenCorrectionEdit(code, code.indexOf(" =") + 1, {
    language: "typescript",
  });

  assert.equal(edit, null);
});

test("finds previous correctable token in comments", () => {
  const code = "// qksrkqtmqslek ";
  const edit = getPreviousTokenCorrectionEdit(code, code.length, {
    language: "typescript",
  });

  assert.equal(edit?.original, "qksrkqtmqslek");
  assert.equal(edit?.corrected, "반갑습니다");
});

test("does not auto-correct template literal expressions", () => {
  const code = "const msg = `${gksrmf }`;";
  const edit = getPreviousTokenCorrectionEdit(code, code.indexOf("}"), {
    language: "typescript",
  });

  assert.equal(edit, null);
});

test("auto-corrects Markdown as plain text", () => {
  const code = "dkssudgktpdy ";
  const edit = getPreviousTokenCorrectionEdit(code, code.length, {
    fileName: "README.md",
  });

  assert.equal(edit?.corrected, "안녕하세요");
});

test("previous token correction uses personal rules", () => {
  const code = "dkssudgktpdy ";
  const ignored = getPreviousTokenCorrectionEdit(code, code.length, {
    fileName: "README.md",
    ignoredTokens: ["dkssudgktpdy"],
  });
  const custom = getPreviousTokenCorrectionEdit(code, code.length, {
    customCorrections: { dkssudgktpdy: "직접교정" },
    fileName: "README.md",
  });

  assert.equal(ignored, null);
  assert.equal(custom?.corrected, "직접교정");
});
