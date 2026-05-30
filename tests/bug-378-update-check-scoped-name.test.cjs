/**
 * Regression test for #378: gsd-check-update-worker.js must query
 * the SCOPED package name (@opengsd/gsd-core) when calling
 * `npm view <name> version`.
 *
 * Background: the worker previously hardcoded the unscoped string
 * 'gsd-core', which returns E404 from the npm registry because
 * the published package is scoped (@opengsd/gsd-core). This caused `latest` to stay null and
 * `update_available` to be permanently false — users never saw update
 * notifications.
 *
 * The fix derives the name from package.json (most robust — survives
 * future renames). This test locks the contract in two ways:
 *
 * 1. Structural: the worker must NOT contain the bare unscoped literal
 *    'gsd-core' as a standalone npm view argument.
 * 2. Derived: the worker must read the package name from package.json
 *    and the package.json name MUST be the scoped string
 *    '@opengsd/gsd-core'.
 *
 * Source-grep policy: this test reads hook source via readFileSync.
 * The repo's lint-no-source-grep rule targets bin/lib/get-shit-done — hooks/
 * is out of scope. The shape we need to lock (which string is passed as the
 * npm view argument) only manifests at runtime against the live registry;
 * a structural assertion is the minimum-cost contract.
 */

// allow-test-rule: structural assertion on hook npm-view argument; the
// behavior being tested (correct package name → no E404) only manifests at
// runtime against the live npm registry, which CI does not call.

'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const WORKER_PATH = path.join(__dirname, '..', 'hooks', 'gsd-check-update-worker.js');
const PKG_PATH = path.join(__dirname, '..', 'package.json');

describe('bug #378: update-check worker uses scoped package name', () => {
  test('worker file exists', () => {
    assert.ok(fs.existsSync(WORKER_PATH), `worker not found at ${WORKER_PATH}`);
  });

  test('package.json name is the scoped @opengsd/gsd-core', () => {
    const pkg = JSON.parse(fs.readFileSync(PKG_PATH, 'utf8'));
    assert.equal(
      pkg.name,
      '@opengsd/gsd-core',
      'package.json must declare the scoped name — this is what npm view must query',
    );
  });

  test('worker does NOT hardcode the unscoped gsd-core as an npm view argument', () => {
    const src = fs.readFileSync(WORKER_PATH, 'utf8');

    // Strip comments so doc-prose mentions don't trigger the check.
    const codeOnly = src
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[^:])\/\/[^\n]*/g, '$1');

    // The unscoped bare string as a string literal used in code.
    // A match here means the bug is present: npm view 'gsd-core'
    // → E404 → update_available permanently false.
    const unscopedLiteral = /['"]gsd-core['"]/;

    assert.doesNotMatch(
      codeOnly,
      unscopedLiteral,
      [
        "Worker must not pass the unscoped 'gsd-core' to `npm view`.",
        'That name returns E404, leaving update_available permanently false.',
        'Use the scoped name from package.json: @opengsd/gsd-core.',
      ].join(' '),
    );
  });

  test('worker derives package name from package.json (require + .name)', () => {
    const src = fs.readFileSync(WORKER_PATH, 'utf8');

    // Structural check: worker must load package.json and read .name from it.
    // This is the robust form — survives future renames without code edits.
    const requiresPkgJson = /require\s*\(\s*['"][^'"]*package\.json['"]\s*\)\.name/;

    assert.match(
      src,
      requiresPkgJson,
      [
        'Worker must derive the npm view package name via',
        "`require('../package.json').name` (or similar).",
        'Hardcoding the scoped literal is less robust: a future rename',
        'would silently break update checks again.',
      ].join(' '),
    );
  });
});
