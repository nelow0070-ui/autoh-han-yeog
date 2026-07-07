import * as vscode from "vscode";
import {
  correctCodeText,
  correctToken,
  detectLanguageFromFileName,
  getPreviousTokenCorrectionEdit,
  type CodeCorrectionOptions,
  type TokenCorrectionEdit,
} from "./corrector.js";
import { keysToHangul } from "./keyboard.js";

type LastAutomaticCorrection = {
  corrected: string;
  end: number;
  original: string;
  start: number;
  uri: string;
};

type LanguageOverride = {
  autoCorrect?: boolean;
  correctComments?: boolean;
  correctStrings?: boolean;
  minConfidence?: number;
};

const ignoredTokensKey = "ignoredTokens";
const customCorrectionsKey = "customCorrections";

let applyingAutomaticEdit = false;
let extensionContext: vscode.ExtensionContext;
let lastAutomaticCorrection: LastAutomaticCorrection | null = null;
let statusBarItem: vscode.StatusBarItem;

export function activate(context: vscode.ExtensionContext): void {
  extensionContext = context;
  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBarItem.command = "autohHanYeog.toggleAutoCorrect";
  context.subscriptions.push(statusBarItem);

  context.subscriptions.push(
    vscode.commands.registerCommand("autohHanYeog.correctSelection", correctSelection),
    vscode.commands.registerCommand("autohHanYeog.correctDocument", correctDocument),
    vscode.commands.registerCommand("autohHanYeog.toggleAutoCorrect", toggleAutoCorrect),
    vscode.commands.registerCommand("autohHanYeog.revertLastCorrection", revertLastCorrection),
    vscode.commands.registerCommand("autohHanYeog.ignoreToken", ignoreTokenAtCursor),
    vscode.commands.registerCommand("autohHanYeog.alwaysCorrectToken", alwaysCorrectTokenAtCursor),
    vscode.commands.registerCommand("autohHanYeog.showDebugInfo", showDebugInfo),
    vscode.commands.registerCommand("autohHanYeog.clearPersonalRules", clearPersonalRules),
    vscode.workspace.onDidChangeTextDocument(handleTextDocumentChange),
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration("autohHanYeog")) {
        updateStatusBar();
      }
    }),
    vscode.window.onDidChangeActiveTextEditor(() => updateStatusBar()),
  );

  updateStatusBar();
}

export function deactivate(): void {
  // No background resources yet.
}

async function correctSelection(): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showInformationMessage("AutohHanYeog: No active editor.");
    return;
  }

  const selections = editor.selections.filter((selection) => !selection.isEmpty);
  if (selections.length === 0) {
    vscode.window.showInformationMessage("AutohHanYeog: Select text to correct.");
    return;
  }

  const options = getCorrectionOptions(editor.document);
  await editor.edit((editBuilder) => {
    for (const selection of selections) {
      const original = editor.document.getText(selection);
      const corrected = correctCodeText(original, options);
      if (corrected !== original) {
        editBuilder.replace(selection, corrected);
      }
    }
  });
}

async function correctDocument(): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showInformationMessage("AutohHanYeog: No active editor.");
    return;
  }

  const document = editor.document;
  const original = document.getText();
  const corrected = correctCodeText(original, getCorrectionOptions(document));

  if (corrected === original) {
    vscode.window.showInformationMessage("AutohHanYeog: Nothing to correct.");
    return;
  }

  const fullRange = new vscode.Range(
    document.positionAt(0),
    document.positionAt(original.length),
  );

  await editor.edit((editBuilder) => {
    editBuilder.replace(fullRange, corrected);
  });
}

async function handleTextDocumentChange(event: vscode.TextDocumentChangeEvent): Promise<void> {
  if (event.contentChanges.length === 0) {
    return;
  }

  const editor = vscode.window.activeTextEditor;
  if (!editor || editor.document !== event.document) {
    return;
  }

  if (!applyingAutomaticEdit && await learnIgnoredTokenFromUndo(event)) {
    return;
  }

  if (applyingAutomaticEdit || !isAutoCorrectEnabled(event.document)) {
    return;
  }

  const change = event.contentChanges[event.contentChanges.length - 1];
  if (!change || !shouldTriggerAutoCorrection(change.text, event.document)) {
    return;
  }

  const cursorOffset = change.rangeOffset + change.text.length;
  const edit = getPreviousTokenCorrectionEdit(
    event.document.getText(),
    cursorOffset,
    getCorrectionOptions(event.document),
  );

  if (!edit) {
    return;
  }

  await applyAutomaticCorrection(editor, edit);
}

async function applyAutomaticCorrection(
  editor: vscode.TextEditor,
  edit: TokenCorrectionEdit,
): Promise<void> {
  const start = editor.document.positionAt(edit.start);
  const end = editor.document.positionAt(edit.end);

  applyingAutomaticEdit = true;
  try {
    const applied = await editor.edit(
      (editBuilder) => {
        editBuilder.replace(new vscode.Range(start, end), edit.corrected);
      },
      { undoStopAfter: false, undoStopBefore: false },
    );

    if (applied) {
      lastAutomaticCorrection = {
        corrected: edit.corrected,
        end: edit.start + edit.corrected.length,
        original: edit.original,
        start: edit.start,
        uri: editor.document.uri.toString(),
      };
      void showCorrectionMessage(edit);
    }
  } finally {
    applyingAutomaticEdit = false;
  }
}

async function learnIgnoredTokenFromUndo(
  event: vscode.TextDocumentChangeEvent,
): Promise<boolean> {
  if (!lastAutomaticCorrection || event.document.uri.toString() !== lastAutomaticCorrection.uri) {
    return false;
  }

  if (event.contentChanges.length !== 1) {
    return false;
  }

  const change = event.contentChanges[0];
  if (
    change.rangeOffset !== lastAutomaticCorrection.start ||
    change.rangeLength !== lastAutomaticCorrection.corrected.length ||
    change.text !== lastAutomaticCorrection.original
  ) {
    return false;
  }

  await addIgnoredToken(lastAutomaticCorrection.original);
  vscode.window.setStatusBarMessage(
    `AutohHanYeog ignored ${lastAutomaticCorrection.original}`,
    2500,
  );
  lastAutomaticCorrection = null;
  return true;
}

async function showCorrectionMessage(edit: TokenCorrectionEdit): Promise<void> {
  const config = vscode.workspace.getConfiguration("autohHanYeog");
  if (!config.get<boolean>("showCorrectionMessage", false)) {
    return;
  }

  const action = await vscode.window.showInformationMessage(
    `AutohHanYeog: ${edit.original} -> ${edit.corrected}`,
    "Revert",
    "Ignore",
  );

  if (action === "Revert") {
    await revertLastCorrection();
  } else if (action === "Ignore") {
    await addIgnoredToken(edit.original);
  }
}

async function toggleAutoCorrect(): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  const config = vscode.workspace.getConfiguration("autohHanYeog", editor?.document.uri);
  const current = config.get<boolean>("autoCorrect", true);
  await config.update("autoCorrect", !current, vscode.ConfigurationTarget.Global);
  updateStatusBar();
}

async function revertLastCorrection(): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor || !lastAutomaticCorrection) {
    vscode.window.showInformationMessage("AutohHanYeog: No automatic correction to revert.");
    return;
  }

  if (editor.document.uri.toString() !== lastAutomaticCorrection.uri) {
    vscode.window.showInformationMessage("AutohHanYeog: Last correction is in another file.");
    return;
  }

  const currentText = editor.document.getText(
    new vscode.Range(
      editor.document.positionAt(lastAutomaticCorrection.start),
      editor.document.positionAt(lastAutomaticCorrection.end),
    ),
  );

  if (currentText !== lastAutomaticCorrection.corrected) {
    vscode.window.showInformationMessage("AutohHanYeog: Last correction has already changed.");
    return;
  }

  applyingAutomaticEdit = true;
  try {
    await editor.edit((editBuilder) => {
      editBuilder.replace(
        new vscode.Range(
          editor.document.positionAt(lastAutomaticCorrection!.start),
          editor.document.positionAt(lastAutomaticCorrection!.end),
        ),
        lastAutomaticCorrection!.original,
      );
    });
    await addIgnoredToken(lastAutomaticCorrection.original);
    lastAutomaticCorrection = null;
  } finally {
    applyingAutomaticEdit = false;
  }
}

async function ignoreTokenAtCursor(): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return;
  }

  const token = getSelectedOrCursorToken(editor);
  if (!token) {
    vscode.window.showInformationMessage("AutohHanYeog: No token selected.");
    return;
  }

  await addIgnoredToken(token);
  vscode.window.showInformationMessage(`AutohHanYeog: Ignoring ${token}.`);
}

async function alwaysCorrectTokenAtCursor(): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return;
  }

  const token = getSelectedOrCursorToken(editor);
  if (!token) {
    vscode.window.showInformationMessage("AutohHanYeog: No token selected.");
    return;
  }

  const value = await vscode.window.showInputBox({
    prompt: `Always correct "${token}" to`,
    value: keysToHangul(token),
  });

  if (!value) {
    return;
  }

  await addCustomCorrection(token, value);
  vscode.window.showInformationMessage(`AutohHanYeog: ${token} will become ${value}.`);
}

async function showDebugInfo(): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return;
  }

  const token = getSelectedOrCursorToken(editor);
  if (!token) {
    vscode.window.showInformationMessage("AutohHanYeog: No token selected.");
    return;
  }

  const correction = correctToken(token, getCorrectionOptions(editor.document));
  const options = getCorrectionOptions(editor.document);
  const message = [
    `token: ${token}`,
    `candidate: ${keysToHangul(token)}`,
    `result: ${correction.corrected}`,
    `changed: ${correction.changed}`,
    `confidence: ${correction.confidence}`,
    `reason: ${correction.reason}`,
    `language: ${options.language}`,
    `strings: ${options.strings}`,
    `comments: ${options.comments}`,
  ].join("\n");

  const document = await vscode.workspace.openTextDocument({
    content: message,
    language: "plaintext",
  });
  await vscode.window.showTextDocument(document, { preview: true });
}

async function clearPersonalRules(): Promise<void> {
  const answer = await vscode.window.showWarningMessage(
    "Clear AutohHanYeog ignored tokens and always-correct rules?",
    { modal: true },
    "Clear",
  );

  if (answer !== "Clear") {
    return;
  }

  await extensionContext.globalState.update(ignoredTokensKey, []);
  await extensionContext.globalState.update(customCorrectionsKey, {});
  vscode.window.showInformationMessage("AutohHanYeog: Personal rules cleared.");
}

function getCorrectionOptions(document: vscode.TextDocument): CodeCorrectionOptions {
  const effective = getEffectiveSettings(document);

  return {
    comments: effective.correctComments,
    customCorrections: getCustomCorrections(),
    fileName: document.fileName,
    ignoredTokens: getIgnoredTokens(),
    language: document.languageId,
    minConfidence: effective.minConfidence,
    strings: effective.correctStrings,
  };
}

function getEffectiveSettings(document: vscode.TextDocument) {
  const config = vscode.workspace.getConfiguration("autohHanYeog", document.uri);
  const language = detectLanguageFromFileName(document.fileName);
  const overrides = config.get<Record<string, LanguageOverride>>("languageOverrides", {});
  const override = overrides[document.languageId] ?? overrides[language] ?? {};

  return {
    autoCorrect: override.autoCorrect ?? config.get<boolean>("autoCorrect", true),
    correctComments: override.correctComments ?? config.get<boolean>("correctComments", true),
    correctStrings: override.correctStrings ?? config.get<boolean>("correctStrings", true),
    minConfidence: override.minConfidence ?? config.get<number>("minConfidence", 1.2),
  };
}

function isAutoCorrectEnabled(document: vscode.TextDocument): boolean {
  return getEffectiveSettings(document).autoCorrect;
}

function shouldTriggerAutoCorrection(insertedText: string, document: vscode.TextDocument): boolean {
  const config = vscode.workspace.getConfiguration("autohHanYeog", document.uri);
  const triggerCharacters = config.get<string>("triggerCharacters", " \t\r\n.,;:!?)]}\"'`");

  return [...insertedText].some((char) => triggerCharacters.includes(char));
}

function updateStatusBar(): void {
  const editor = vscode.window.activeTextEditor;
  const enabled = editor ? isAutoCorrectEnabled(editor.document) : true;

  statusBarItem.text = enabled ? "$(check) HanYeog Auto" : "$(circle-slash) HanYeog Off";
  statusBarItem.tooltip = enabled
    ? "AutohHanYeog automatic correction is on"
    : "AutohHanYeog automatic correction is off";
  statusBarItem.show();
}

function getSelectedOrCursorToken(editor: vscode.TextEditor): string | null {
  const selectionText = editor.document.getText(editor.selection).trim();
  if (/^[A-Za-z]+$/.test(selectionText)) {
    return selectionText;
  }

  const range = editor.document.getWordRangeAtPosition(editor.selection.active, /[A-Za-z]+/);
  if (!range) {
    return null;
  }

  return editor.document.getText(range);
}

function getIgnoredTokens(): string[] {
  return extensionContext.globalState.get<string[]>(ignoredTokensKey, []);
}

function getCustomCorrections(): Record<string, string> {
  return extensionContext.globalState.get<Record<string, string>>(customCorrectionsKey, {});
}

async function addIgnoredToken(token: string): Promise<void> {
  const normalized = token.toLowerCase();
  const tokens = new Set(getIgnoredTokens().map((value) => value.toLowerCase()));
  const corrections = getCustomCorrections();

  tokens.add(normalized);
  delete corrections[normalized];
  await extensionContext.globalState.update(ignoredTokensKey, [...tokens].sort());
  await extensionContext.globalState.update(customCorrectionsKey, corrections);
}

async function addCustomCorrection(token: string, correction: string): Promise<void> {
  const corrections = getCustomCorrections();
  const ignored = getIgnoredTokens().filter((value) => value.toLowerCase() !== token.toLowerCase());

  corrections[token.toLowerCase()] = correction;
  await extensionContext.globalState.update(ignoredTokensKey, ignored);
  await extensionContext.globalState.update(customCorrectionsKey, corrections);
}
