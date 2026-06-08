const { UserService } = require('../Services/Domain.Services/User.Service');

class AuthController {
  constructor(message, ctx) {
    this.message = message;
    this.ctx = ctx;
    this.service = new UserService(message, ctx);
  }
  async handleRequest() {
    switch ((this.message.Action || '').toLowerCase()) {
      case 'whoami': return await this.service.whoAmI();
      default: return { error: { code: 400, message: 'Invalid action.' } };
    }
  }
}

module.exports = { AuthController };
