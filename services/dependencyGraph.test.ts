import { describe, expect, test } from 'vitest';
import {
  analyzeImports,
  buildDependencyGraph,
  getRelatedFiles,
} from './dependencyGraph';
import { FileNode } from '../types';

describe('Dependency Graph', () => {
  test('analyzeImports finds relative imports', () => {
    const code = `
      import React from 'react';
      import { util } from './utils';
      import Header from '../components/Header';
      const config = require('./config/app');
    `;
    const filePath = 'src/pages/Home.js';
    const imports = analyzeImports(code, filePath);

    expect(imports).toContain('src/pages/utils');
    expect(imports).toContain('src/components/Header');
    expect(imports).toContain('src/pages/config/app');
    expect(imports).not.toContain('react'); // Should ignore external
  });

  test('getRelatedFiles returns dependencies recursively', () => {
    // Mock File Nodes
    const files: FileNode[] = [
      {
        name: 'app.js',
        path: 'src/app.js',
        type: 'file',
        content: "import './utils'; import './components/Header';",
      },
      {
        name: 'utils.js',
        path: 'src/utils.js',
        type: 'file',
        content: "import './constants';",
      },
      {
        name: 'constants.js',
        path: 'src/constants.js',
        type: 'file',
        content: "export const API_URL = '...';",
      },
      {
        name: 'Header.js',
        path: 'src/components/Header.js',
        type: 'file',
        content: "console.log('header');",
      },
    ];

    const graph = buildDependencyGraph(files);

    expect(Object.keys(graph)).toHaveLength(4);

    // Test App dependencies (Direct + Recursive)
    const appDeps = getRelatedFiles('src/app.js', graph, 10);
    // Should include utils, Header, and constants (via utils)
    expect(appDeps).toContain('src/utils.js');
    expect(appDeps).toContain('src/components/Header.js');
    expect(appDeps).toContain('src/constants.js');

    // Test Limit
    const limitDeps = getRelatedFiles('src/app.js', graph, 1);
    expect(limitDeps).toHaveLength(1);
  });
});
