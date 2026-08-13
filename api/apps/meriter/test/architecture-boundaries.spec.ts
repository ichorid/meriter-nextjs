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

  it('UZZ domain and application layers stay framework-independent', async () => {
    const meriterRoot = path.join(__dirname, '..');
    const eslint = new ESLint({
      cwd: meriterRoot,
      overrideConfigFile: path.join(meriterRoot, '../../.eslintrc.js'),
      overrideConfig: {
        rules: {
          'no-restricted-imports': [
            'error',
            {
              patterns: [
                '@nestjs/*',
                'mongoose',
                '**/infrastructure/**',
                '**/adapters/**',
              ],
            },
          ],
        },
      },
      errorOnUnmatchedPattern: false,
    });

    const results = await eslint.lintFiles([
      'src/domain/uzz/**/*.ts',
      'src/application/uzz/**/*.ts',
    ]);
    const forbiddenImports = results.flatMap((result) =>
      result.messages.filter(
        (message) => message.ruleId === 'no-restricted-imports',
      ),
    );

    expect(forbiddenImports).toEqual([]);
  });
});
