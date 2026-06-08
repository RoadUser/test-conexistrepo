const { ServiceTypes } = require('./Constants/constants');
const { NoteController } = require('./Controllers/Note.Controller');
const { UpgradeController } = require('./Controllers/Upgrade.Controller');
const { AuthController } = require('./Controllers/Auth.Controller');
const { ContractController } = require('./Controllers/Contract.Controller');

class Controller {
  constructor(ctx) { this.ctx = ctx; }

  async handleRequest(user, message, isReadOnly) {
    try {
      message = message || {};
      message.userPubKey = (user && user.pubKey) ? Buffer.from(user.pubKey).toString('hex') : (message.userPubKey || '');
      let result = { error: { code: 400, message: 'Unknown service.' } };
      switch (message.Service) {
        case ServiceTypes.NOTE: {
          const c = new NoteController(message, this.ctx); result = await c.handleRequest(); break;
        }
        case ServiceTypes.UPGRADE: {
          const c = new UpgradeController(message, this.ctx); result = await c.handleRequest(); break;
        }
        case ServiceTypes.AUTH: {
          const c = new AuthController(message, this.ctx); result = await c.handleRequest(); break;
        }
        case ServiceTypes.CONTRACT: {
          const c = new ContractController(message, this.ctx); result = await c.handleRequest(); break;
        }
        default: result = { error: { code: 400, message: 'Invalid Service' } };
      }
      const out = message.promiseId ? { promiseId: message.promiseId, ...result } : result;
      await user.send(out);
    } catch (e) {
      await user.send({ error: { code: 500, message: e.message || 'Internal error' } });
    }
  }
}

module.exports = { Controller };
