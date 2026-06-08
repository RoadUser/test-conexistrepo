const HotPocket = require('hotpocket-js-client');
const { createClient, assertSuccessResponse } = require('../test-utils');

async function submitJSON(client, payload, readOnly = false) {
  if (readOnly) return await client.submitContractReadRequest(JSON.stringify(payload));
  const res = await client.submitContractInput(JSON.stringify(payload));
  await res.submissionStatus; return null;
}

async function NoteCRUDTests() {
  const { client } = await createClient();
  // Initial list
  let ro = await client.submitContractReadRequest(JSON.stringify({ Service: 'Note', Action: 'GetAllNotes' }));
  let parsed = JSON.parse(ro.toString());
  // Create
  await submitJSON(client, { Service: 'Note', Action: 'CreateNote', data: { title: 'Welcome', body: '<p>Hello Evernode</p>' } });
  ro = await client.submitContractReadRequest(JSON.stringify({ Service: 'Note', Action: 'GetAllNotes' }));
  parsed = JSON.parse(ro.toString());
  assertSuccessResponse(parsed);
  const createdId = parsed.success[0].id;
  // Read by id
  ro = await client.submitContractReadRequest(JSON.stringify({ Service: 'Note', Action: 'GetNoteById', data: { id: createdId } }));
  parsed = JSON.parse(ro.toString()); assertSuccessResponse(parsed);
  // Update
  await submitJSON(client, { Service: 'Note', Action: 'UpdateNote', data: { id: createdId, title: 'Updated', body: '<p>Updated body</p>' } });
  ro = await client.submitContractReadRequest(JSON.stringify({ Service: 'Note', Action: 'GetNoteById', data: { id: createdId } }));
  parsed = JSON.parse(ro.toString()); assertSuccessResponse(parsed);
  // Delete
  await submitJSON(client, { Service: 'Note', Action: 'DeleteNote', data: { id: createdId } });
  client.disconnect();
}

module.exports = { NoteCRUDTests };
