'use strict';

const assert = require('node:assert/strict');
const { readBoardConfig, validateConfig, checkScoreboard } = require('../tools/check_scoreboard.js');
const key = (role = 'anon', ref = 'testproject') => `header.${Buffer.from(JSON.stringify({ role, ref })).toString('base64url')}.signature`;
const config = { url: 'https://testproject.supabase.co', anonKey: key() };
const source = (cfg = config) => `const BOARD_CFG = {\n  url: '${cfg.url}', // project URL\n  anonKey: '${cfg.anonKey}', // public\n};`;
const response = (status = 200, rows = [{ total: 123456 }]) => ({
  status, ok: status >= 200 && status < 300, async json() { return rows; },
});

async function main() {
  assert.deepEqual(readBoardConfig(source()), config);
  assert.deepEqual(readBoardConfig(source().replace(/\n/g, '\r\n')), config);
  assert.equal(new URL(readBoardConfig().url).protocol, 'https:', 'real game config stays compatible');
  assert.throws(() => readBoardConfig('const unrelated = {};'), /literal/);
  assert.throws(() => readBoardConfig(source().replace("url: '", "url: getUrl() + '")), /literal/);
  assert.throws(() => validateConfig({ ...config, anonKey: key('service_role') }), /public anon/);
  assert.throws(() => validateConfig({ ...config, anonKey: key('anon', 'otherproject') }), /matching project/);
  assert.throws(() => validateConfig({ ...config, anonKey: 'invalid' }), /public anon/);
  for (const url of ['http://testproject.supabase.co', 'https://example.com',
    'https://testproject.supabase.co.evil.test', 'https://user:pass@testproject.supabase.co',
    'https://testproject.supabase.co?key=secret', 'https://testproject.supabase.co/rest/v1']) {
    assert.throws(() => validateConfig({ ...config, url }), /HTTPS project origin/);
  }

  const logs = [];
  const options = { config, log: line => logs.push(line), sleep: async () => {} };
  let requests = 0;
  const result = await checkScoreboard({ ...options, fetchImpl: async (url, init) => {
    requests++;
    assert.equal(url, `${config.url}/rest/v1/scoreboard?select=total&limit=1`);
    assert.equal(init.method, 'GET');
    assert.equal(init.body, undefined, 'no dummy score or database mutation');
    assert.equal(init.redirect, 'error', 'do not forward the key to redirects');
    assert.equal(init.headers.apikey, config.anonKey);
    assert.equal(init.headers.Authorization, `Bearer ${config.anonKey}`);
    assert.ok(init.signal instanceof AbortSignal);
    return response();
  } });
  assert.equal(requests, 1);
  assert.deepEqual(result, { status: 200, rowCount: 1 });
  assert.ok(!logs.join('\n').includes(config.anonKey));
  assert.ok(!logs.join('\n').includes('123456'), 'actual scores are not logged');
  assert.equal((await checkScoreboard({ ...options, fetchImpl: async () => response(200, []) })).rowCount, 0,
    'an empty but accessible leaderboard is healthy');

  for (const status of [401, 403, 404]) {
    let attempts = 0;
    await assert.rejects(checkScoreboard({ ...options, fetchImpl: async () => {
      attempts++; return response(status);
    } }), new RegExp(`HTTP ${status}`));
    assert.equal(attempts, 1, 'do not retry invalid keys, permissions, or missing tables');
  }
  for (const status of [408, 429, 503]) {
    let attempts = 0;
    const waits = [];
    await checkScoreboard({ ...options, sleep: async ms => waits.push(ms), fetchImpl: async () => {
      attempts++; return response(attempts < 3 ? status : 200);
    } });
    assert.equal(attempts, 3);
    assert.deepEqual(waits, [2000, 4000]);
  }
  let attempts = 0;
  await assert.rejects(checkScoreboard({ ...options, fetchImpl: async () => {
    attempts++; throw new Error(`private network details: ${config.anonKey}`);
  } }), /Network request failed or timed out/);
  assert.equal(attempts, 3, 'network retries are bounded');
  assert.ok(!logs.join('\n').includes(config.anonKey), 'do not log raw network errors');
  attempts = 0;
  await assert.rejects(checkScoreboard({ ...options, fetchImpl: async () => {
    attempts++; return response(503);
  } }), /HTTP 503/);
  assert.equal(attempts, 3, 'a persistently paused/unavailable project fails after three attempts');
  attempts = 0;
  await checkScoreboard({ ...options, fetchImpl: async () => {
    attempts++;
    return attempts === 1 ? { ...response(), async json() { throw new TypeError('body interrupted'); } } : response();
  } });
  assert.equal(attempts, 2, 'interrupted response bodies also retry');

  for (const rows of [{ message: 'not a table' }, [null], [{ total: '123' }], [{ total: -1 }],
    [{ total: 1 }, { total: 2 }]]) {
    await assert.rejects(checkScoreboard({ ...options, fetchImpl: async () => response(200, rows) }), /expected shape/);
  }
  await assert.rejects(checkScoreboard({ ...options, fetchImpl: async () => ({ ...response(),
    async json() { throw new SyntaxError('invalid body'); },
  }) }), /not valid JSON/);
  console.log('scoreboard health check: ok');
}

main().catch(error => { console.error(error); process.exitCode = 1; });
