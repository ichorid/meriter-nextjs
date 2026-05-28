#!/usr/bin/env node
/**
 * Run Jest and sweep orphaned mongodb-memory-server temp dirs on exit or interrupt.
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { cleanupMongoMemory } from './cleanup-mongo-memory.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const API_ROOT = path.resolve(__dirname, '..');

let cleanupRan = false;

async function runCleanup() {
  if (cleanupRan) {
    return;
  }
  cleanupRan = true;
  try {
    const result = await cleanupMongoMemory({ sweepOnly: true, force: false });
    if (result.removed > 0 || result.killed > 0) {
      console.log(
        `run-jest-with-mongo-cleanup: removed=${result.removed} skipped=${result.skipped} killed=${result.killed}`,
      );
    }
  } catch (err) {
    console.warn('run-jest-with-mongo-cleanup: cleanup failed:', err);
  }
}

function run() {
  const jestArgs = process.argv.slice(2);
  const jestBin = path.join(API_ROOT, 'node_modules', 'jest', 'bin', 'jest.js');

  const child = spawn(process.execPath, [jestBin, ...jestArgs], {
    cwd: API_ROOT,
    stdio: 'inherit',
    env: process.env,
  });

  let childExited = false;

  const forwardSignal = (signal) => {
    if (!childExited && child.pid) {
      child.kill(signal);
    }
  };

  process.on('SIGINT', () => forwardSignal('SIGINT'));
  process.on('SIGTERM', () => forwardSignal('SIGTERM'));

  child.on('exit', (code, signal) => {
    childExited = true;
    void runCleanup().finally(() => {
      if (signal) {
        process.kill(process.pid, signal);
        return;
      }
      process.exit(code ?? 1);
    });
  });
}

run();
