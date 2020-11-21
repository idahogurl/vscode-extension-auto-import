import * as vscode from 'vscode';

import { ImportDb } from './import-db';

export class ImportStatusBar {
  public static statusBar;

  constructor(private context: vscode.ExtensionContext) {}

  public static setStatusBar() {
    ImportStatusBar.statusBar.text = `{..} : ${ImportDb.count}`;
  }
}
