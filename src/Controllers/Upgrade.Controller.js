const env = require('../Constants/Config');
const { UpgradeService } = require('../Services/Common.Services/Upgrade.Service');
const cryptoHelper = require('../Utils/Crypto.Helper');

class UpgradeController {
  constructor(message, ctx) {
    this.message = message;
    this.ctx = ctx;
    this.service = new UpgradeService(message, ctx);
  }

  #isMaintainer(userPubKey) {
    const m = (env.MAINTAINER_PUBKEY || '').toLowerCase().trim();
    if (!m) return false;
    return (userPubKey || '').toLowerCase() === m;
  }

  async handleRequest() {
    try {
      const action = this.message.Action;
      if (action === 'UpgradeContract') {
        if (!this.#isMaintainer(this.message.userPubKey)) return { error: { code: 401, message: 'Unauthorized' } };
        const zipData = this.message.data;
        const sigHex = (this.message.signature || '').toString();
        let buf = null;
        if (Buffer.isBuffer(zipData.content)) buf = zipData.content;
        else if (zipData.content && typeof zipData.content === 'object' && zipData.content.type === 'Buffer') buf = Buffer.from(zipData.content.data);
        else if (typeof zipData.content === 'string') buf = Buffer.from(zipData.content, 'base64');
        else return { error: { code: 400, message: 'Invalid content' } };
        const ok = cryptoHelper.verifyEd25519Detached(new Uint8Array(buf), sigHex, this.message.userPubKey);
        if (!ok) return { error: { code: 401, message: 'Signature verification failed' } };
        return await this.service.upgradeContract();
      }
      return { error: { code: 400, message: 'Invalid action' } };
    } catch (e) { return { error: { code: 500, message: e.message } }; }
  }
}
module.exports = { UpgradeController };
