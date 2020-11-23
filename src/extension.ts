import * as vscode from 'vscode';
import { ErrorHelper } from './helpers/error-helper';
import { ActivationHandler } from './activation-handler';

function scanIfRequired(): void {
  if (vscode.workspace.getConfiguration('autoimport').get<boolean>('showNotifications')) {
    vscode.window.showInformationMessage('[AutoImport] Building cache');
  }

  vscode.commands.executeCommand('extension.importScan', { showOutput: true });
}
module.exports = {
  activate: (context: vscode.ExtensionContext) => {
    const outputChannel = vscode.window.createOutputChannel('Auto Import');
    try {
      if (context.workspaceState.get('auto-import-settings') === undefined) {
        context.workspaceState.update('auto-import-settings', {});
      }

      if (vscode.workspace.rootPath === undefined) {
        return false;
      }
      console.log('GOT HERE');

      const extension = new ActivationHandler(context, outputChannel);
      console.log('GOT HERE 2');
      extension.attachCommands();
      console.log('HELLO');
      extension.attachFileWatcher();
      console.log('bob');
      scanIfRequired();
    } catch (error) {
      ErrorHelper.handle(error);
    }
  },
  deactivate: () => {},
};
