import * as FS from 'fs';
import * as _ from 'lodash';
import * as vscode from 'vscode';

import { ImportDb } from './import-db';

export class NodeUpload {
  private filesToScan: string;

  constructor(private config: vscode.WorkspaceConfiguration) {
    this.filesToScan = `*/*.${this.config.get<string>('extensions')}`;
  }

  public scanNodeModules() {
    this.getMappings().then((mappings) => {
      for (const key in mappings) {
        const map = mappings[key];
        if (map) {
          map.forEach((exp) => {
            ImportDb.saveImport(exp, exp, { fsPath: key }, false, true);
          });
        }
      }
    });
  }

  public getMappings(): Promise<any> {
    return new Promise<any>((resolve) => {
      const mappings = {};

      const mapArrayToLocation = (exports, location) => {
        if (mappings[location]) {
          mappings[location] = (<any>mappings[location]).concat(exports);
        } else {
          mappings[location] = exports;
        }
      };

      vscode.workspace.findFiles(this.filesToScan, '**/node_modules/**', 99999).then((files) => {
        files.forEach((f, i) => {
          FS.readFile(f.fsPath, 'utf8', (err, data) => {
            if (err) {
              return console.log(err);
            }

            const matches = data.match(/\bimport\s+(?:.+\s+from\s+)?[\'"]([^"\']+)["\']/g);
            if (matches) {
              matches.forEach((m) => {
                if (m.indexOf('./') === -1 && m.indexOf('!') === -1) {
                  const exports = m.match(/\bimport\s+(?:.+\s+from\s+)/);
                  const location = m.match(/[\'"]([^"\']+)["\']/g);

                  if (exports && location) {
                    const exportArray = exports[0]
                      .replace('import', '')
                      .replace('{', '')
                      .replace('}', '')
                      .replace('from', '')
                      .split(',')
                      .map((e) => {
                        e = e.replace(/\s/g, '');
                        return e;
                      });

                    mapArrayToLocation(exportArray, location[0].replace("'", '').replace("'", ''));
                  }
                }
              });
            }

            if (i == files.length - 1) {
              for (const key in mappings) {
                if (mappings.hasOwnProperty(key)) {
                  mappings[key] = _.uniq(mappings[key]);
                }
              }
              return resolve(mappings);
            }
          });
        });
      });
    });
  }
}
