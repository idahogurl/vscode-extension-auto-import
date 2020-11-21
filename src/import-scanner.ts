import * as FS from 'fs';
import * as vscode from 'vscode';
import * as _ from 'lodash';
import * as globby from 'globby';
import { NodeUpload } from './node-upload';

import { ImportDb } from './import-db';
import { ImportStatusBar } from './import-status-bar';

export class ImportScanner {
  private scanStarted: Date;

  private scanEnded: Date;

  private showOutput: boolean;

  private filesToScan: string;

  private showNotifications: boolean;

  private higherOrderComponents: string;

  constructor(private config: vscode.WorkspaceConfiguration) {
    this.filesToScan = this.config.get<string>('filesToScan');
    this.showNotifications = this.config.get<boolean>('showNotifications');
    this.higherOrderComponents = this.config.get<string>('higherOrderComponents');
  }

  public async scan(request: any): Promise<void> {
    this.showOutput = request.showOutput ? request.showOutput : false;

    if (this.showOutput) {
      this.scanStarted = new Date();
    }
    const gitignore = FS.readFileSync(`${vscode.workspace.rootPath}/.gitignore`, {
      encoding: 'utf-8'
    });
    const exclude = gitignore.split('\n');
    const files = await globby(
      [
        '!typings',
        '!.history',
        '!jspm_packages',
        'test/**/*.test.js',
        '!**/node_modules/**',
        '!test/**/fixtures/**',
        this.filesToScan
      ].concat(exclude),
      { cwd: vscode.workspace.rootPath }
    );
    const fileCount = files.length;
    for (let i = 0; i < fileCount; i++) {
      this.loadFile(files[i], i === fileCount - 1);
    }
  }

  public edit(request: any): void {
    ImportDb.delete(request);
    this.loadFile(request.file, true);
    new NodeUpload(vscode.workspace.getConfiguration('autoimport')).scanNodeModules();
  }

  public delete(request: any): void {
    ImportDb.delete(request);
    ImportStatusBar.setStatusBar();
  }

  private loadFile(fsPath: string, last: boolean): void {
    FS.readFile(fsPath, 'utf8', (err, data) => {
      if (err) {
        return console.log(err);
      }

      this.processFile(data, fsPath);

      if (last) {
        ImportStatusBar.setStatusBar();
      }

      if (last && this.showOutput && this.showNotifications) {
        this.scanEnded = new Date();

        const str = `[AutoImport] cache creation complete - (${Math.abs(
          <any>this.scanStarted - <any>this.scanEnded
        )}ms)`;

        vscode.window.showInformationMessage(str);
      }
    });
  }

  private processFile(data: any, file: string): void {
    // added code to support any other middleware that the component can  be nested in.
    const regExp = new RegExp(
      `(export\\s?(default)?\\s?(class|interface|let|var|const|function)?) ((${this.higherOrderComponents}).+[, (])?(\\w+)`,
      'g'
    );

    const matches = data.match(regExp);

    if (matches != null) {
      matches.forEach((m) => {
        // this allows us to reliably gets the last string (not splitting on spaces)
        const mArr = regExp.exec(m);
        if (mArr === null) {
          // this is a weird situation that shouldn't ever happen. but does?
          return;
        }
        const workingFile: string = mArr[mArr.length - 1];
        const isDefault = m.indexOf('default') !== -1;
        ImportDb.saveImport(workingFile, data, file, isDefault, null);
      });
    }
  }
}
