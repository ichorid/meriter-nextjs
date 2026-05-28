const { spawnSync } = require('child_process');
const path = require('path');

module.exports = async () => {
  const script = path.join(__dirname, 'scripts', 'cleanup-mongo-memory.mjs');
  const result = spawnSync(process.execPath, [script], {
    cwd: __dirname,
    encoding: 'utf8',
    env: process.env,
  });

  if (result.status !== 0) {
    const stderr = result.stderr?.trim();
    if (stderr) {
      console.warn(`jest globalTeardown: cleanup exited ${result.status}: ${stderr}`);
    }
  }
};
