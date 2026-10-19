import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const mode = process.env.CI_EXPORT_MODE;
if (!['separate', 'combined'].includes(mode))
  throw new Error('Choose separate or combined exports');
const require = createRequire(import.meta.url);
const cli = require.resolve('expo/bin/cli');
const sourceSha = execFileSync('git', ['rev-parse', 'HEAD'], {
  encoding: 'utf8',
}).trim();
const results = [];
mkdirSync('.maestro/artifacts/ci', { recursive: true });
for (let trial = 1; trial <= 3; trial++) {
  const start = performance.now();
  for (const platform of mode === 'separate' ? ['ios', 'android'] : ['all']) {
    const env = { ...process.env, NODE_ENV: 'production' };
    if (mode === 'separate') env.EAS_BUILD_PLATFORM = platform;
    else delete env.EAS_BUILD_PLATFORM;
    execFileSync(
      process.execPath,
      [
        cli,
        'export',
        '--platform',
        platform,
        '--output-dir',
        `dist/benchmark-${platform}`,
      ],
      { env, stdio: 'inherit' },
    );
  }
  const result = {
    sourceSha,
    mode,
    trial,
    seconds: (performance.now() - start) / 1000,
    node: process.version,
  };
  results.push(result);
  writeFileSync(
    '.maestro/artifacts/ci/export-benchmark.json',
    JSON.stringify(results, null, 2),
  );
  console.log(`DAYOVA_EXPORT_BENCHMARK ${JSON.stringify(result)}`);
}
