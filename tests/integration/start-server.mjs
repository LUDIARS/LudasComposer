#!/usr/bin/env node
/**
 * Ars Web Server launcher for Playwright integration tests.
 * Cross-platform: avoids shell quoting issues with paths containing spaces.
 */
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ext = process.platform === 'win32' ? '.exe' : '';
// Workspace root target (cargo builds to workspace root, not crate-local target)
const serverBin = path.resolve(
  __dirname,
  '../../target/debug',
  `ars-web-server${ext}`,
);
const distDir = path.resolve(__dirname, '../../ars-editor/dist');
const port = process.argv[2] || '15173';

console.log(`[start-server] bin: ${serverBin}`);
console.log(`[start-server] dist: ${distDir}`);
console.log(`[start-server] port: ${port}`);

execFileSync(serverBin, [distDir, port], { stdio: 'inherit' });
