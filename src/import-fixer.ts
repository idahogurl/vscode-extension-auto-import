import * as vscode from 'vscode';
import * as path from 'path';

import { ImportObject } from './import-db';

export class ImportFixer {
  private spacesBetweenBraces;

  private doubleQuotes;

  private semicolon;

  constructor() {
    const config = vscode.workspace.getConfiguration('autoimport');

    this.spacesBetweenBraces = config.get<boolean>('spaceBetweenBraces');
    this.doubleQuotes = config.get<boolean>('doubleQuotes');
    this.semicolon = config.get<boolean>('semicolon');
  }

  public fix(
    document: vscode.TextDocument,
    range: vscode.Range,
    context: vscode.CodeActionContext,
    token: vscode.CancellationToken,
    imports: Array<ImportObject>,
  ): void {
    const edit = this.getTextEdit(document, imports);

    vscode.workspace.applyEdit(edit);
  }

  public getTextEdit(document: vscode.TextDocument, imports: Array<ImportObject>) {
    const edit: vscode.WorkspaceEdit = new vscode.WorkspaceEdit();
    const importObj: ImportObject = imports[0];
    const path = importObj.getPath(document);

    if (this.alreadyResolved(document, path, importObj.name)) {
      return edit;
    }

    if (this.shouldMergeImport(document, path)) {
      edit.replace(
        document.uri,
        new vscode.Range(0, 0, document.lineCount, 0),
        this.mergeImports(document, edit, importObj.name, importObj.file, path),
      );
    } else if (/^\/(\/\*) *@flow/.test(document.getText())) {
      edit.insert(
        document.uri,
        new vscode.Position(1, 0),
        this.createImportStatement(imports[0].name, path, true, imports[0].isDefault),
      );
    } else {
      const insertPosition: vscode.Position = document
        .positionAt(document.getText().lastIndexOf('import'))
        .translate(1, 0);
      edit.insert(
        document.uri,
        insertPosition,
        this.createImportStatement(imports[0].name, path, true, imports[0].isDefault),
      );
    }

    return edit;
  }

  private alreadyResolved(document: vscode.TextDocument, path, importName) {
    const exp = new RegExp(`(?:import {)(?:.*)(?:} from ')(?:${path})(?:';)`);

    const currentDoc = document.getText();

    const foundImport = currentDoc.match(exp);

    if (foundImport && foundImport.length > 0 && foundImport[0].indexOf(importName) > -1) {
      return true;
    }

    return false;
  }

  private shouldMergeImport(document: vscode.TextDocument, path): boolean {
    const currentDoc = document.getText();

    const isCommentLine = (text: string): boolean => {
      const firstTwoLetters = text.trim().substr(0, 2);
      return firstTwoLetters === '//' || firstTwoLetters === '/*';
    };

    return currentDoc.indexOf(path) !== -1 && !isCommentLine(currentDoc);
  }

  private mergeImports(
    document: vscode.TextDocument,
    edit: vscode.WorkspaceEdit,
    name,
    file,
    path: string,
  ) {
    const exp = new RegExp(`(?:import {)(?:.*)(?:} from ')(?:${path})(?:';)`);

    let currentDoc = document.getText();

    const foundImport = currentDoc.match(exp);

    if (foundImport) {
      let workingString = foundImport[0];

      workingString = workingString.replace(/{|}|from|import|'|"| |;/gi, '').replace(path, '');

      const importArray = workingString.split(',');

      importArray.push(name);

      const newImport = this.createImportStatement(importArray.join(', '), path);

      currentDoc = currentDoc.replace(exp, newImport);
    }

    return currentDoc;
  }

  private createImportStatement(
    imp: string,
    path: string,
    endline: boolean = false,
    isDefault: boolean = false,
  ): string {
    const formattedPath = path.replace(/\"/g, '').replace(/\'/g, '');
    const quoteSymbol = this.doubleQuotes ? '"' : "'";
    const importStr = [
      'import ',
      isDefault ? '' : this.spacesBetweenBraces ? '{ ' : '{',
      imp,
      isDefault ? '' : this.spacesBetweenBraces ? ' }' : '}',
      ' from ',
      quoteSymbol + formattedPath + quoteSymbol,
      this.semicolon ? ';' : '',
      endline ? '\r\n' : '',
    ].join('');
    return importStr;
  }

  private getRelativePath(document, importObj: vscode.Uri | any): string {
    return importObj.discovered
      ? importObj.fsPath
      : path.relative(path.dirname(document.fileName), importObj.fsPath);
  }

  private normaliseRelativePath(importObj, relativePath: string): string {
    const removeFileExtenion = (rp: string) => {
      if (rp) {
        rp = rp.substring(0, rp.lastIndexOf('.'));
      }
      return rp;
    };

    const makeRelativePath = (rp) => {
      const preAppend = './';

      if (!rp.startsWith(preAppend) && !rp.startsWith('../')) {
        rp = preAppend + rp;
      }

      if (/^win/.test(process.platform)) {
        rp = rp.replace(/\\/g, '/');
      }

      return rp;
    };

    if (importObj.discovered === undefined) {
      relativePath = makeRelativePath(relativePath);
      relativePath = removeFileExtenion(relativePath);
    }

    return relativePath;
  }
}
