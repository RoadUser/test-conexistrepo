const { NoteService } = require('../Services/Domain.Services/Note.Service');

class NoteController {
  constructor(message, ctx) { this.message = message; this.ctx = ctx; this.service = new NoteService(message, ctx); }
  async handleRequest() {
    const a = (this.message.Action || '').toLowerCase();
    switch (a) {
      case 'createnote': return await this.service.createNote();
      case 'getnotebyid': return await this.service.getNoteById();
      case 'getallnotes': return await this.service.getAllNotes();
      case 'updatenote': return await this.service.updateNote();
      case 'deletenote': return await this.service.deleteNote();
      default: return { error: { code: 400, message: 'Invalid action.' } };
    }
  }
}
module.exports = { NoteController };
