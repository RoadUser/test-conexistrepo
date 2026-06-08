const HotPocket = require('hotpocket-js-client');

async function createClient() {
  const kp = await HotPocket.generateKeys();
  const client = await HotPocket.createClient(['ws://localhost:8081'], kp);
  if (!await client.connect()) throw new Error('Connection failed');
  return { client, kp };
}

function assertEqual(actual, expected, msg) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`Assertion failed: ${msg} Expected ${JSON.stringify(expected)} got ${JSON.stringify(actual)}`);
}
function assertSuccessResponse(resp) { if (!resp || !resp.success) throw new Error('Expected success response'); }
function assertErrorResponse(resp) { if (!resp || !resp.error) throw new Error('Expected error response'); }

module.exports = { createClient, assertEqual, assertSuccessResponse, assertErrorResponse };
