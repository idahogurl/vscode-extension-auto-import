import * as fs from 'fs';
import * as vscode from 'vscode';
import * as fg from 'fast-glob';
import * as parser from '@gerhobbelt/gitignore-parser';

import { NodeUpload } from './node-upload';

import { ImportDb } from './import-db';
import { ImportStatusBar } from './import-status-bar';

function parseGitIgnore() {
  const gitignoreFile = `${vscode.workspace.rootPath}/.gitignore`;
  return fs.existsSync(gitignoreFile)
    ? parser.compile(fs.readFileSync(gitignoreFile, { encoding: 'utf-8' }))
    : undefined;
}

const { rootPath } = vscode.workspace;
export class ImportScanner {
  private scanStarted: Date;

  private scanEnded: Date;

  private showOutput: boolean;

  private filesToScan: string;

  private showNotifications: boolean;

  private higherOrderComponents: string;

  private outputChannel: vscode.OutputChannel;

  private readonly ignoreEntries: string[];

  constructor(private config: vscode.WorkspaceConfiguration, outputChannel: vscode.OutputChannel) {
    this.filesToScan = `**/*.${this.config.get<string>('extensions')}`;
    this.showNotifications = this.config.get<boolean>('showNotifications');
    this.higherOrderComponents = this.config.get<string>('higherOrderComponents');
    this.outputChannel = outputChannel;
    this.ignoreEntries = [
      '!typings',
      '!.history',
      '!jspm_packages',
      '*.test.js',
      'node_modules',
      '!test/**/fixtures/**',
      '*.config.js',
    ];
  }

  private filterEntries(entries: string[], entryType: string) {
    const gitignore = parseGitIgnore();
    const filtered = gitignore ? entries.filter((e) => gitignore.accepts(e, true)) : entries;

    this.outputChannel.appendLine(`'${entryType} found', ${filtered.length.toString(10)}`);
    return filtered;
  }

  public scan(request: any): void {
    this.showOutput = request.showOutput ? request.showOutput : false;

    if (this.showOutput) {
      this.scanStarted = new Date();
    }

    try {
      const files = fg.sync(this.filesToScan, {
        cwd: rootPath,
        onlyFiles: true,
        ignore: this.ignoreEntries,
      });
      const filtered = this.filterEntries(files, 'Files');
      const entryCount = filtered.length;
      for (let i = 0; i < entryCount; i++) {
        this.loadFile(`${rootPath}/${filtered[i]}`, i === entryCount - 1);
      }
    } catch (e) {
      console.log(e);
    }
  }

  public getDirectories() {
    try {
      const directories = fg.sync('**', {
        cwd: vscode.workspace.rootPath,
        onlyDirectories: true,
        ignore: this.ignoreEntries,
      });
      return this.filterEntries(directories, 'Directories');
    } catch (e) {
      console.log(e);
    }
    return [];
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
    fs.readFile(fsPath, 'utf8', (err, data) => {
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
          <any>this.scanStarted - <any>this.scanEnded,
        )}ms)`;

        vscode.window.showInformationMessage(str);
      }
    });
  }

  private processFile(data: any, file: string): void {
    // added code to support any other middleware that the component can  be nested in.
    const regExp = new RegExp(
      `(export\\s?(default)?\\s?(class|interface|let|var|const|function)?) ((${this.higherOrderComponents}).+[, (])?(\\w+)`,
      'g',
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
