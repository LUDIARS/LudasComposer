import * as fs from 'node:fs';
import * as path from 'node:path';
import type { Project } from './types.js';

export function loadProject(filePath: string): Project {
  const absolutePath = path.isAbsolute(filePath) ? filePath : path.resolve(filePath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`プロジェクトファイルが見つかりません: ${absolutePath}`);
  }
  const content = fs.readFileSync(absolutePath, 'utf-8');
  return JSON.parse(content) as Project;
}

export function findProjectFiles(dir: string, maxDepth = 3): string[] {
  const files: string[] = [];
  scanDir(dir, files, maxDepth);
  return files;
}

function scanDir(dir: string, results: string[], depth: number): void {
  if (depth <= 0) return;
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'dist' || entry.name === 'target') continue;
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        scanDir(fullPath, results, depth - 1);
      } else if (entry.name.endsWith('.ars.json')) {
        results.push(fullPath);
      }
    }
  } catch {
    // ignore
  }
}
