# AutohHanYeog

Token-based Korean/English typing correction prototype.

## Try it

```bash
npm install
npm run data:download
npm run train
npm run dev -- "dkssudgktpdy"
npm run dev -- "hello"
npm run dev -- "dkssudgktpdy hello qksrkqtmqslek"
npm run dev -- --code --file app.ts "const msg = 'dkssudgktpdy'; // qksrkqtmqslek"
```

The prototype corrects the previous whitespace-separated token by scoring:

- whether the token itself looks like an English word
- whether a two-set Korean keyboard conversion looks like a Korean word
- a lightweight character n-gram Naive Bayes model trained from dictionary word lists

If `data/model.json` is missing, the corrector falls back to the tiny built-in
sample dictionaries.

## Project shape

```txt
src/
  cli.ts              # Small CLI demo
  corrector.ts        # Token correction decision
  keyboard.ts         # Dubeolsik key mapping and Hangul composition
  model.ts            # Lightweight n-gram classifier runtime
  dictionaries.ts     # Tiny seed dictionaries
  tools/
    download-dictionaries.ts
    train-model.ts
```

## Dictionary/model workflow

```bash
npm run data:download  # downloads raw word lists into data/raw/
npm run train          # writes the compact runtime model to data/model.json
```

Raw dictionaries are ignored by git. The generated `data/model.json` is the file
that should be bundled into later VS Code or Chrome extensions.

## Code-aware correction

Use `correctCodeText(code, { fileName })` or `correctCodeText(code, { language })`
when correcting source files. Current profiles:

- JavaScript/TypeScript: strings, template literal text, `//` comments, `/* */` comments
- Python: strings, triple-quoted strings, `#` comments
- JSON: strings only
- HTML: text nodes, quoted attributes, `<!-- -->` comments
- CSS: quoted strings and `/* */` comments
- Markdown/plain text: whole text

Code identifiers are left unchanged.

## VS Code extension

Build and package a local VSIX:

```bash
npm run build
npm run package:vscode
```

Then install the generated `.vsix` in VS Code and run:

- `AutohHanYeog: Correct Selection`
- `AutohHanYeog: Correct Current Document`

You can also right-click in the editor to use:

- Correct Selection
- Correct Current Document
- Toggle Auto Correction
- Revert Last Automatic Correction
- Ignore Token
- Always Correct Token
- Show Token Debug Info

Automatic correction is enabled by default. After typing a space, newline, or
punctuation mark, the extension checks the previous token and corrects it only
when that token is in a language-appropriate string/comment/text region.

Settings:

- `autohHanYeog.autoCorrect`
- `autohHanYeog.correctStrings`
- `autohHanYeog.correctComments`
- `autohHanYeog.minConfidence`
- `autohHanYeog.triggerCharacters`
- `autohHanYeog.showCorrectionMessage`
- `autohHanYeog.languageOverrides`

Control commands:

- `AutohHanYeog: Toggle Auto Correction`
- `AutohHanYeog: Revert Last Automatic Correction`
- `AutohHanYeog: Ignore Token`
- `AutohHanYeog: Always Correct Token`
- `AutohHanYeog: Show Token Debug Info`
- `AutohHanYeog: Clear Personal Rules`

The extension uses the active document language/file name, so TypeScript,
Python, JSON, HTML, CSS, Markdown, and plain text follow different correction
profiles.

Example language overrides:

```json
{
  "autohHanYeog.languageOverrides": {
    "json": { "autoCorrect": false },
    "typescript": { "correctComments": false, "minConfidence": 2.5 },
    "markdown": { "minConfidence": 1.2 }
  }
}
```

## Publishing

Before publishing, make sure `publisher` in `package.json` matches your Visual
Studio Marketplace publisher ID.

Package locally:

```bash
npm run verify
```

Publish manually:

```bash
npx vsce login <publisher-id>
npx vsce publish
```

Publish from GitHub Actions:

1. Create a Visual Studio Marketplace publisher.
2. Create a Marketplace Personal Access Token with extension management access.
3. Add it as a GitHub repository secret named `VSCE_PAT`.
4. Run the `Publish VS Code Extension` workflow manually.
