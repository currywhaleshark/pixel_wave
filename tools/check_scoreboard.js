'use strict';

// Read-only health check. Reuse the game's public config; never submit a dummy score.
const fs = require('node:fs');
const path = require('node:path');
const { setTimeout: delay } = require('node:timers/promises');

function validateConfig(config) {
  let url;
  try { url = new URL(config.url); } catch { throw new Error('Invalid BOARD_CFG.url.'); }
  if (url.protocol !== 'https:' || !/^[a-z0-9]+\.supabase\.co$/.test(url.hostname)
    || url.port || url.username || url.password || url.search || url.hash || url.pathname !== '/') {
    throw new Error('BOARD_CFG.url must be a hosted Supabase HTTPS project origin.');
  }
  // Only the existing public anon JWT is permitted, not a service_role/admin key.
  let payload;
  try { payload = JSON.parse(Buffer.from(config.anonKey.split('.')[1], 'base64url')); } catch {}
  if (payload?.role !== 'anon' || payload.ref !== url.hostname.split('.')[0]) {
    throw new Error('BOARD_CFG.anonKey must be the matching project public anon JWT.');
  }
  return { url: url.origin, anonKey: config.anonKey };
}

function readBoardConfig(source = fs.readFileSync(path.join(__dirname, '../js/board.js'), 'utf8')) {
  // Parse the two literal strings without executing browser code or duplicating credentials.
  const block = source.match(/^const BOARD_CFG\s*=\s*\{([\s\S]*?)^\};/m)?.[1];
  const config = {};
  for (const field of ['url', 'anonKey']) {
    const value = block?.match(new RegExp(`^\\s*${field}:\\s*(['"])([^'"\\r\\n]+)\\1\\s*,?\\s*(?://[^\\r\\n]*)?$`, 'm'))?.[2];
    if (!value) throw new Error(`Expected a literal BOARD_CFG.${field} in js/board.js.`);
    config[field] = value;
  }
  return validateConfig(config);
}

class ProbeError extends Error {
  constructor(message, retryable = false) { super(message); this.retryable = retryable; }
}

async function checkScoreboard({ config = readBoardConfig(), fetchImpl = fetch,
  sleep = delay, log = console.log, timeoutMs = 15000 } = {}) {
  config = validateConfig(config);
  const endpoint = `${config.url}/rest/v1/scoreboard?select=total&limit=1`;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await fetchImpl(endpoint, {
        method: 'GET', redirect: 'error', signal: AbortSignal.timeout(timeoutMs),
        headers: { apikey: config.anonKey, Authorization: `Bearer ${config.anonKey}`, Accept: 'application/json' },
      });
      if (!response.ok) {
        const hint = response.status === 401 || response.status === 403
          ? 'Check the public key and scoreboard read permissions.'
          : 'Check the Supabase project status and scoreboard endpoint.';
        throw new ProbeError(`HTTP ${response.status}. ${hint}`,
          response.status === 408 || response.status === 429 || response.status >= 500);
      }
      let rows;
      try { rows = await response.json(); } catch (error) {
        if (error instanceof SyntaxError) throw new ProbeError('The scoreboard response was not valid JSON.');
        throw error; // A timeout/interrupted response body is a retryable network failure.
      }
      if (!Array.isArray(rows) || rows.length > 1
        || rows.some(row => !row || !Number.isSafeInteger(row.total) || row.total < 0)) {
        throw new ProbeError('The scoreboard response did not match the expected shape.');
      }
      // Do not log the key, response body, names, player IDs, or score values.
      log(`[scoreboard] OK: HTTP ${response.status}; read-only query succeeded (${rows.length} row).`);
      return { status: response.status, rowCount: rows.length };
    } catch (error) {
      const failure = error instanceof ProbeError ? error
        : new ProbeError('Network request failed or timed out.', true);
      log(`[scoreboard] Attempt ${attempt}/3 failed: ${failure.message}`);
      if (!failure.retryable || attempt === 3) throw failure;
      await sleep(attempt * 2000);
    }
  }
}

if (require.main === module) {
  checkScoreboard().catch(error => {
    console.error(`[scoreboard] FAILED: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = { readBoardConfig, validateConfig, checkScoreboard };
