import * as vscode from 'vscode';
import * as fs from 'fs';
import { gitignore } from 'globby';
import { ErrorHelper } from './helpers/error-helper';
import { ImportStatusBar } from './import-status-bar';
import { ImportAction } from './import-action';
import { ImportScanner } from './import-scanner';
import { ImportFixer } from './import-fixer';
import { NodeUpload } from './node-upload';
import { ImportCompletion } from './import-completion';

function attachCommands(): void {
  let codeActionFixer = vscode.languages.registerCodeActionsProvider(
    ['javascript', 'javascriptreact', 'typescript', 'typescriptreact'],
    new ImportAction()
  );

  let importScanner = vscode.commands.registerCommand('extension.importScan', (request: any) => {
    let scanner = new ImportScanner(vscode.workspace.getConfiguration('autoimport'));

    if (request.showOutput) {
      scanner.scan(request);
    } else if (request.edit) {
      scanner.edit(request);
    } else if (request.delete) {
      scanner.delete(request);
    }
  });

  let nodeScanner = vscode.commands.registerCommand('extension.scanNodeModules', () => {
    new NodeUpload(vscode.workspace.getConfiguration('autoimport')).scanNodeModules();
  });

  let importFixer = vscode.commands.registerCommand('extension.fixImport', (d, r, c, t, i) => {
    new ImportFixer().fix(d, r, c, t, i);
  });

  let completion = vscode.languages.registerCompletionItemProvider(
    ['javascript', 'javascriptreact', 'typescript', 'typescriptreact'],
    new ImportCompletion(
      this.context,
      vscode.workspace.getConfiguration('autoimport').get<boolean>('autoComplete')
    ),
    ''
  );

  ImportStatusBar.statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 1);

  ImportStatusBar.statusBar.text = '{..} : Scanning.. ';

  ImportStatusBar.statusBar.show();

  this.context.subscriptions.push(
    importScanner,
    importFixer,
    nodeScanner,
    codeActionFixer,
    ImportStatusBar.statusBar,
    completion
  );
}

function attachFileWatcher(): void {
  const directories = fs.readdirSync(__dirname);
  const ignored = gitignore.sync();
  for (let i = 0; i < directories.length; i++) {
    const directory = directories[i];
    if (!ignored(directory)) {
      const watcher = vscode.workspace.createFileSystemWatcher(`${directory}/`);

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

function scanIfRequired(): void {
  if (vscode.workspace.getConfiguration('autoimport').get<boolean>('showNotifications')) {
    vscode.window.showInformationMessage('[AutoImport] Building cache');
  }

  vscode.commands.executeCommand('extension.importScan', { showOutput: true });
}
module.exports = {
  activate: (context: vscode.ExtensionContext) => {
    try {
      if (context.workspaceState.get('auto-import-settings') === undefined) {
        context.workspaceState.update('auto-import-settings', {});
      }

      let folder = vscode.workspace.rootPath;

      if (folder === undefined) {
        return false;
      }

      attachCommands();
      attachFileWatcher();
      scanIfRequired();
    } catch (error) {
      ErrorHelper.handle(error);
    }
  },
  deactivate: () => {}
};
