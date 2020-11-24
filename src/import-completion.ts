import * as vscode from 'vscode';
import { ImportDb, ImportObject } from './import-db';
import { ImportFixer } from './import-fixer';

export class ImportCompletion implements vscode.CompletionItemProvider {
  constructor(private context: vscode.ExtensionContext, private enabled: boolean) {
    const fixer = vscode.commands.registerCommand('extension.resolveImport', (args) => {
      new ImportFixer().fix(args.document, undefined, undefined, undefined, [args.imp]);
    });

    context.subscriptions.push(fixer);
  }

  async provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken
  ): Promise<vscode.CompletionItem[]> {
    if (!this.enabled) {
      return [];
    }

    let wordToComplete = '';

    const range = document.getWordRangeAtPosition(position);

    if (range) {
      wordToComplete = document.getText(new vscode.Range(range.start, position)).toLowerCase();
    }
    return ImportDb.all()
      .filter((f) => f.name.toLowerCase().indexOf(wordToComplete) > -1)
      .map((i) => this.buildCompletionItem(i, document));
  }

  private buildCompletionItem(
    imp: ImportObject,
    document: vscode.TextDocument
  ): vscode.CompletionItem {
    console.log(`Import ${imp.name} from ${imp.getPath(document)}`);
    return {
      label: imp.name,
      kind: vscode.CompletionItemKind.Reference,
      detail: `import from ${imp.getPath(document)}`,
      documentation: 'Bob',
      command: {
        title: 'AI: Autocomplete',
        command: 'extension.resolveImport',
        arguments: [{ imp, document }],
      },
    };
  }
}
