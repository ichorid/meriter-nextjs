#!/usr/bin/env node
/**
 * Remove orphaned mongodb-memory-server temp dirs and optional stale mongod processes.
 *
 * Usage:
 *   node scripts/cleanup-mongo-memory.mjs [--force] [--stale-only] [--sweep-only]
 *
 * --force       Kill mongod processes using a mongo-mem dbPath, then remove dirs
 * --stale-only  Only remove dirs older than 1 hour with no live mongod (pretest default)
 * --sweep-only  Same as default; no PID kill unless combined with --force (globalTeardown)
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const API_ROOT = path.resolve(__dirname, '..');
const STALE_MS = 60 * 60 * 1000;
const TMP_PREFIXES = ['mongo-mem-', 'mongo-mem-keyfile-'];

const args = new Set(process.argv.slice(2));
const force = args.has('--force');
const staleOnly = args.has('--stale-only');
const sweepOnly = args.has('--sweep-only') || (!force && !staleOnly);

function getCacheDir() {
  return (
    process.env.MONGOMS_TMP_DIR ||
    path.join(API_ROOT, '.cache', 'mongo-mem-test')
  );
}

function listMongodProcesses() {
  try {
    const out = execSync('ps -eo pid=,args=', { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
    return out
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const match = line.match(/^(\d+)\s+(.+)$/);
        if (!match) return null;
        return { pid: Number(match[1]), args: match[2] };
      })
      .filter((row) => row && row.args.includes('mongod'));
  } catch {
    return [];
  }
}

function pidsForDbPath(dbPath, processes) {
  const normalized = path.resolve(dbPath);
  return processes
    .filter((p) => p.args.includes(normalized) || p.args.includes(dbPath))
    .map((p) => p.pid);
}

function killPids(pids) {
  for (const pid of pids) {
    try {
      process.kill(pid, 'SIGTERM');
    } catch {
      // already gone
    }
  }
  if (pids.length > 0) {
    try {
      execSync(`sleep 0.3`, { shell: true });
    } catch {
      // ignore
    }
    for (const pid of pids) {
      try {
        process.kill(pid, 0);
        process.kill(pid, 'SIGKILL');
      } catch {
        // gone
      }
    }
  }
}

function isMongoMemDirName(name) {
  return TMP_PREFIXES.some((prefix) => name.startsWith(prefix));
}

function collectDirs() {
  const dirs = new Set();
  const cacheDir = getCacheDir();

  if (fs.existsSync(cacheDir)) {
    for (const name of fs.readdirSync(cacheDir)) {
      const full = path.join(cacheDir, name);
      if (fs.statSync(full).isDirectory() && isMongoMemDirName(name)) {
        dirs.add(full);
      }
    }
  }

  try {
    for (const name of fs.readdirSync('/tmp')) {
      if (!isMongoMemDirName(name)) continue;
      const full = path.join('/tmp', name);
      try {
        if (fs.statSync(full).isDirectory()) {
          dirs.add(full);
        }
      } catch {
        // race
      }
    }
  } catch {
    // /tmp unreadable
  }

  return [...dirs];
}

function removeDir(dirPath) {
  fs.rmSync(dirPath, { recursive: true, force: true });
}

export async function cleanupMongoMemory(options = {}) {
  const opts = {
    force: options.force ?? force,
    staleOnly: options.staleOnly ?? staleOnly,
    sweepOnly: options.sweepOnly ?? sweepOnly,
  };

  const processes = listMongodProcesses();
  const dirs = collectDirs();
  let removed = 0;
  let skipped = 0;
  let killed = 0;

  const now = Date.now();

  for (const dirPath of dirs) {
    let stat;
    try {
      stat = fs.statSync(dirPath);
    } catch {
      continue;
    }

    const ageMs = now - stat.mtimeMs;
    const pids = pidsForDbPath(dirPath, processes);
    const hasLiveMongod = pids.length > 0;

    if (opts.staleOnly && (hasLiveMongod || ageMs < STALE_MS)) {
      skipped += 1;
      continue;
    }

    if (hasLiveMongod && !opts.force) {
      skipped += 1;
      continue;
    }

    if (hasLiveMongod && opts.force) {
      killPids(pids);
      killed += pids.length;
    }

    try {
      removeDir(dirPath);
      removed += 1;
    } catch (err) {
      console.warn(`cleanup-mongo-memory: failed to remove ${dirPath}:`, err.message);
      skipped += 1;
    }
  }

  return { removed, skipped, killed, scanned: dirs.length };
}

async function main() {
  const result = await cleanupMongoMemory();
  console.log(
    `cleanup-mongo-memory: scanned=${result.scanned} removed=${result.removed} skipped=${result.skipped} killed=${result.killed}`,
  );
  process.exit(0);
}

const isMain =
  process.argv[1] &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
if (isMain) {
  main().catch((err) => {
    console.error('cleanup-mongo-memory:', err);
    process.exit(1);
  });
}
