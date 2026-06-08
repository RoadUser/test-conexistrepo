const { SqliteDatabase } = require('../Services/Common.Services/dbHandler');
const { Tables } = require('../Constants/constants');
const settings = require('../settings.json').settings;

class ContractController {
  constructor(message, ctx) {
    this.message = message; this.ctx = ctx; this.db = new SqliteDatabase(settings.dbPath);
  }
  async handleRequest() {
    try {
      this.db.open();
      const row = await this.db.getLastRecord(Tables.CONTRACTVERSION);
      const version = row?.Version || 1.0;
      return { success: { version, ts: this.ctx.timestamp } };
    } catch (e) { return { error: { code: 500, message: e.message } }; }
    finally { this.db.close(); }
  }
}
module.exports = { ContractController };
