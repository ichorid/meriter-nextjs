import { ESLint } from 'eslint';
import * as path from 'path';

describe('architecture boundaries', () => {
  it('application layer must not import api-v1 (Zone 4)', async () => {
    const meriterRoot = path.join(__dirname, '..');
    const eslint = new ESLint({
      cwd: meriterRoot,
      overrideConfigFile: path.join(meriterRoot, '../../.eslintrc.js'),
    });

    const results = await eslint.lintFiles(['src/application/**/*.ts']);
    const zone4Violations = results.flatMap((r) =>
      r.messages.filter((m) => m.ruleId === 'import/no-restricted-paths'),
    );

    expect(zone4Violations).toEqual([]);
  });
});
