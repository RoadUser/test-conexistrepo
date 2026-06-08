const fs = require('fs');
const { SqliteDatabase } = require('./dbHandler');
const settings = require('../../settings.json').settings;
const { Tables } = require('../../Constants/constants');

class UpgradeService {
  constructor(message, ctx) {
    this.message = message;
    this.ctx = ctx;
    this.db = new SqliteDatabase(settings.dbPath);
  }

  async upgradeContract() {
    let resObj = {};
    try {
      const zipData = this.message.data;
      this.db.open();
      let row = await this.db.getLastRecord(Tables.CONTRACTVERSION);
      row = row || { Version: 1.0 };
      const version = parseFloat(zipData.version);
      if (!(version > row.Version)) {
        resObj.error = { code: 403, message: 'Contract version must be greater than current.' };
        return resObj;
      }
      let buf = null;
      if (Buffer.isBuffer(zipData.content)) buf = zipData.content;
      else if (zipData.content && typeof zipData.content === 'object' && zipData.content.type === 'Buffer') buf = Buffer.from(zipData.content.data);
      else if (typeof zipData.content === 'string') buf = Buffer.from(zipData.content, 'base64');
      else throw new Error('Invalid content format.');

      fs.writeFileSync(settings.newContractZipFileName, buf);
      const sh = `#!/bin/bash\
\
! command -v unzip &>/dev/null && apt-get update && apt-get install --no-install-recommends -y unzip\
zip_file=\"${settings.newContractZipFileName}\"\
unzip -o -d ./ \"$zip_file\" >>/dev/null\
rm \"$zip_file\" >>/dev/null\
echo \"Upgraded to version ${version}\"\
`;
      fs.writeFileSync(settings.postExecutionScriptName, sh);
      fs.chmodSync(settings.postExecutionScriptName, 0o777);

      const now = this.ctx.timestamp;
      await this.db.insertValue(Tables.CONTRACTVERSION, { Version: version, Description: zipData.description || '', CreatedOn: now, LastUpdatedOn: now });
      resObj.success = { message: 'Contract upgrade prepared.', version };
    } catch (e) {
      resObj.error = { code: 500, message: e.message || 'Upgrade failed.' };
    } finally {
      this.db.close();
    }
    return resObj;
  }
}

module.exports = { UpgradeService };
