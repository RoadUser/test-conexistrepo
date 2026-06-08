const HotPocket = require('hotpocket-nodejs-contract');
const bson = require('bson');
const { DBInitializer } = require('./Data.Deploy/initDB');
const { Controller } = require('./controller');
const { SqliteDatabase } = require('./Services/Common.Services/dbHandler');
const { Tables } = require('./Constants/constants');
const settings = require('./settings.json').settings;

async function contract(ctx) {
  try { await DBInitializer.init(); } catch (e) { console.error('DB init error', e); }
  try {
    const db = new SqliteDatabase(settings.dbPath); db.open();
    const row = await db.getLastRecord(Tables.CONTRACTVERSION); db.close();
    console.log('Current contract version:', row?.Version || 1.0);
  } catch (e) { console.log('Version read error', e.message); }

  const isReadOnly = ctx.readonly;
  const controller = new Controller(ctx);

  for (const user of ctx.users.list()) {
    for (const input of user.inputs) {
      const buf = await ctx.users.read(input);
      let msg = null;
      try { msg = JSON.parse(buf.toString()); }
      catch (_) { try { msg = bson.deserialize(buf); } catch (e) { msg = {}; } }
      await controller.handleRequest(user, msg, isReadOnly);
    }
  }
}

const hpc = new HotPocket.Contract();
hpc.init(contract);
