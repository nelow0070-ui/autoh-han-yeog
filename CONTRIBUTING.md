# Contributing

## Development

```bash
npm install
npm run build
npm test
npm run package:vscode
```

## Dictionary/model workflow

```bash
npm run data:download
npm run train
```

Raw dictionary files are ignored. Commit the generated `data/model.json` when
the runtime model changes.

## Pull requests

- Keep changes focused.
- Add or update tests for correction behavior.
- Run `npm run verify` before submitting.
