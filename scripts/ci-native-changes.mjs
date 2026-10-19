import { execFileSync } from 'node:child_process';

const event = process.env.CI_EVENT_NAME;
const forced = process.env.CI_NATIVE_FORCE === 'true' || event === 'schedule';
let paths = [];
if (!forced && event !== 'workflow_dispatch') {
  const base = process.env.CI_BASE_SHA;
  if (base && /^[a-f0-9]{40}$/.test(base) && !/^0+$/.test(base)) {
    execFileSync('git', ['fetch', '--no-tags', '--depth=1', 'origin', base], {
      stdio: ['ignore', 'ignore', 'inherit'],
    });
  } else if (process.env.CI_REF_NAME?.startsWith('gh-readonly-queue/main/')) {
    execFileSync('git', ['fetch', '--no-tags', '--depth=1', 'origin', 'main'], {
      stdio: ['ignore', 'ignore', 'inherit'],
    });
  } else {
    throw new Error(
      'A native-scope decision requires a verified comparison commit',
    );
  }
  paths = execFileSync(
    'git',
    ['diff', '--name-only', '-z', 'FETCH_HEAD', 'HEAD'],
    { encoding: 'utf8' },
  )
    .split('\0')
    .filter(Boolean);
}
const relevant = paths.filter((path) =>
  /^(app\.config\.cts|eas\.json|package\.json|metro\.config\.js|babel\.config\.js|index\.ts|pnpm-(lock\.yaml|workspace\.yaml)|(?:assets|plugins|modules|patches|\.maestro)\/|src\/(?:app|context|features\/auth)\/|src\/lib\/(?:clerk|auth|access|session|onboarding|pending-onboarding-sync|post-auth-sync-failure|runtime-config)|src\/components\/(?:auth-navigation-gate\.tsx|onboarding\/)|convex\/(?:auth\.config|users|clerkIdentity|entitlements)\.ts|\.eas\/workflows\/ci\.yml|scripts\/(?:ci-native-changes|auth-smoke)\.mjs)/.test(
    path,
  ),
);
console.log(
  JSON.stringify({
    required: forced || relevant.length > 0,
    comparison: process.env.CI_BASE_SHA ?? 'main',
    paths: relevant,
  }),
);
