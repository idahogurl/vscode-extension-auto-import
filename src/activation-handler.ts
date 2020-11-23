import * as vscode from 'vscode';

import { ImportAction } from './import-action';
import { ImportCompletion } from './import-completion';
import { ImportFixer } from './import-fixer';
import { ImportScanner } from './import-scanner';
import { NodeUpload } from './node-upload';
import { ImportStatusBar } from './import-status-bar';

export class ActivationHandler {
  private outputChannel;

  constructor(private context: vscode.ExtensionContext, outputChannel: vscode.OutputChannel) {
    this.outputChannel = outputChannel;
  }

  public start(): boolean {
    const folder = vscode.workspace.rootPath;

    if (folder === undefined) {
      return false;
    }

    return true;
  }

  public attachCommands(): void {
    const codeActionFixer = vscode.languages.registerCodeActionsProvider(
      ['javascript', 'javascriptreact', 'typescript', 'typescriptreact'],
      new ImportAction(),
    );

    const importScanner = vscode.commands.registerCommand(
      'extension.importScan',
      (request: any) => {
        const scanner = new ImportScanner(
          vscode.workspace.getConfiguration('autoimport'),
          this.outputChannel,
        );

        if (request.showOutput) {
          scanner.scan(request);
        } else if (request.edit) {
          scanner.edit(request);
        } else if (request.delete) {
          scanner.delete(request);
        }
      },
    );

    const nodeScanner = vscode.commands.registerCommand('extension.scanNodeModules', () => {
      new NodeUpload(vscode.workspace.getConfiguration('autoimport')).scanNodeModules();
    });

    const importFixer = vscode.commands.registerCommand('extension.fixImport', (d, r, c, t, i) => {
      new ImportFixer().fix(d, r, c, t, i);
    });

    const completion = vscode.languages.registerCompletionItemProvider(
      ['javascript', 'javascriptreact', 'typescript', 'typescriptreact'],
      new ImportCompletion(
        this.context,
        vscode.workspace.getConfiguration('autoimport').get<boolean>('autoComplete'),
      ),
      '',
    );

    ImportStatusBar.statusBar = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      1,
    );

    ImportStatusBar.statusBar.text = '{..} : Scanning.. ';

    ImportStatusBar.statusBar.show();

    this.context.subscriptions.push(
      importScanner,
      importFixer,
      nodeScanner,
      codeActionFixer,
      ImportStatusBar.statusBar,
      completion,
    );
  }

  public attachFileWatcher(): void {
    const config = vscode.workspace.getConfiguration('autoimport');
    const scanner = new ImportScanner(config, this.outputChannel);

    const directories = scanner.getDirectories();

    for (let i = 0; i < directories.length; i++) {
      const directory = directories[i];
      const watcher = vscode.workspace.createFileSystemWatcher(
        `${directory}/*.${config.extensions}`,
      );

      watcher.onDidChange((file: vscode.Uri) => {
        vscode.commands.executeCommand('extension.importScan', { file, edit: true });
      });

      watcher.onDidCreate((file: vscode.Uri) => {
        vscode.commands.executeCommand('extension.importScan', { file, edit: true });
      });

      watcher.onDidDelete((file: vscode.Uri) => {
        vscode.commands.executeCommand('extension.importScan', { file, delete: true });
      });
    }
  }
}
