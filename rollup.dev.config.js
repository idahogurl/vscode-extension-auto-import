/* eslint-disable import/no-extraneous-dependencies */
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import replace from '@rollup/plugin-replace';

export default {
  input: './out/extension.js',
  output: {
    file: './dist/extension.js',
    format: 'cjs',
    sourcemap: true,
    exports: 'default',
  },
  plugins: [
    resolve({ preferBuiltins: true }),
    commonjs(),
    replace({
      exclude: 'node_modules/**',
      'function commonjsRequire': 'function commonJsRequire',
      commonjsRequire: 'require',
    }),
  ],
  external: ['vscode', 'fs', 'path', 'module', 'stream', 'util', 'os', 'events'],
};
