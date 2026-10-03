/** Layering rules from MASTER_SPECIFICATION §4.1, enforced in CI. */
module.exports = {
  forbidden: [
    {
      name: 'domain-is-pure',
      severity: 'error',
      from: { path: '^packages/domain/src' },
      to: { path: '^(packages/(db|auth|application|contracts)|apps/)' },
    },
    {
      name: 'domain-no-third-party',
      severity: 'error',
      from: { path: '^packages/domain/src' },
      to: { dependencyTypes: ['npm', 'npm-dev'] },
    },
    {
      name: 'db-not-above',
      severity: 'error',
      from: { path: '^packages/db/src' },
      to: { path: '^(packages/(auth|application|contracts)|apps/)' },
    },
    {
      name: 'auth-not-above',
      severity: 'error',
      from: { path: '^packages/auth/src' },
      to: { path: '^(packages/application|apps/)' },
    },
    {
      name: 'packages-not-apps',
      severity: 'error',
      from: { path: '^packages/' },
      to: { path: '^apps/' },
    },
    {
      name: 'ui-no-db',
      severity: 'error',
      comment: 'UI components never touch the database directly',
      from: { path: '^apps/web/src/(components|lib)' },
      to: { path: '^packages/db' },
    },
    {
      name: 'no-unresolvable',
      severity: 'error',
      comment:
        'An import that does not resolve usually means a package imports something it does not declare',
      from: {},
      to: { couldNotResolve: true },
    },
    { name: 'no-circular', severity: 'error', from: {}, to: { circular: true } },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    exclude: { path: '(\\.next|node_modules|test-results)' },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.depcruise.json' },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default'],
    },
  },
};
