import assert from "node:assert/strict";
import test from "node:test";
import { hangulToKeys, keysToHangul } from "./keyboard.js";

test("converts common dubeolsik sequences into Hangul", () => {
  assert.equal(keysToHangul("dkssudgktpdy"), "안녕하세요");
  assert.equal(keysToHangul("gksrmf"), "한글");
  assert.equal(keysToHangul("qksrkqtmqslek"), "반갑습니다");
});

test("converts Hangul into dubeolsik key sequences", () => {
  assert.equal(hangulToKeys("안녕하세요"), "dkssudgktpdy");
  assert.equal(hangulToKeys("한글"), "gksrmf");
  assert.equal(hangulToKeys("반갑습니다"), "qksrkqtmqslek");
});
