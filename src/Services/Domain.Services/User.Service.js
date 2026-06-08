class UserService {
  constructor(message, ctx) {
    this.message = message;
    this.ctx = ctx;
  }
  async whoAmI() {
    return { success: { pubKey: this.message.userPubKey, ts: this.ctx.timestamp } };
  }
}
module.exports = { UserService };
