/**
 * Note.Service.js
 *
 * Role:
 * - Implements CRUD operations for the Notes domain entity using the shared SqliteDatabase helper.
 * - Persists and reads data from the SQLite table referenced by Tables.NOTES.
 * - Enforces basic ownership checks by comparing requester's userPubKey with the note OwnerPubKey.
 *
 * How it integrates:
 * - Note.Controller.js constructs NoteService and forwards requests based on the Action in the incoming message.
 * - Each public method returns an object shaped like Response.Helper.success/error:
 *   - { success: any } on success
 *   - { error: { code: number, message: string } } on failure
 * - Although this file creates success/error objects inline, the shapes match src/Utils/Response.Helper.js.
 *
 * Database interactions:
 * - Uses settings.dbPath as the SQLite file location.
 * - Uses SqliteDatabase helper methods (open, close, insertValue, findById, getValues, updateValue, deleteValues).
 * - Expects a Notes schema compatible with fields used here: Id, OwnerPubKey, Title, Body, CreatedAt, UpdatedAt, WordCount, ConcurrencyKey.
 *
 * Contract context:
 * - ctx.timestamp is used to populate CreatedAt/UpdatedAt and to derive a deterministic ConcurrencyKey.
 * - The request message carries userPubKey, used for authorization/ownership checks.
 */

const { SqliteDatabase } = require('../Common.Services/dbHandler');
const { Tables } = require('../../Constants/constants');
const settings = require('../../settings.json').settings;

/**
 * NoteService
 *
 * Handles Note CRUD operations against the SQLite database.
 * The service operates on behalf of the requesting user (identified by message.userPubKey),
 * ensuring that read/update/delete operations are scoped to the note owner.
 *
 * Expected message shape (selected fields):
 * - message.Service: 'Note' (set by caller/controller)
 * - message.Action: One of 'CreateNote' | 'GetNoteById' | 'GetAllNotes' | 'UpdateNote' | 'DeleteNote'
 * - message.data: Operation-specific payload (see method JSDoc below)
 * - message.userPubKey: Requesting user's public key (hex string), used for ownership checks
 *
 * Contract context (ctx):
 * - ctx.timestamp: Number representing the execution timestamp; used for auditing fields and concurrency key.
 * - Other ctx fields exist (users, unl, readonly, publicKey, privateKey) but are not used in this service.
 *
 * Response format:
 * - Success: { success: any }
 * - Error: { error: { code: number, message: string } }
 *   These match Response.Helper.success/error shapes used across the project.
 */
class NoteService {
  /**
   * Creates a new NoteService instance.
   * @param {Object} message - The incoming request message from the controller.
   * @param {string} message.userPubKey - The caller's public key used for authorization/ownership checks.
   * @param {Object} [message.data] - Operation-specific data.
   * @param {Object} ctx - HotPocket contract context providing runtime info for this round.
   * @param {number} ctx.timestamp - Current execution timestamp (used for CreatedAt/UpdatedAt and ConcurrencyKey).
   */
  constructor(message, ctx) {
    this.message = message;
    this.ctx = ctx;
    // Initialize a DB helper instance targeting the configured SQLite file.
    this.db = new SqliteDatabase(settings.dbPath);
  }

  /**
   * Counts words in rich HTML-ish content by stripping tags and splitting on whitespace.
   * @param {string} html - HTML or plain text content.
   * @returns {number} Word count.
   * @private
   */
  #wordCountFromHtml(html) {
    const text = (html || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g,' ').trim();
    if (!text) return 0;
    return text.split(/\s+/).length;
  }

  /**
   * Create a note owned by the requesting user.
   *
   * Expected message.data:
   * - title: string (optional; defaults to empty string)
   * - body: string (optional; defaults to empty string; used to compute WordCount)
   *
   * Behavior:
   * - Computes word count from the provided body.
   * - Builds a record with auditing fields (CreatedAt/UpdatedAt) and ConcurrencyKey derived from ctx.timestamp.
   * - Inserts the record into Tables.NOTES.
   *
   * Returns:
   * - { success: { id: number } } on success (inserted row ID)
   * - { error: { code: 500, message: string } } on internal error
   */
  async createNote() {
    const res = {};
    try {
      const owner = this.message.userPubKey;
      const data = this.message.data || {};
      const now = this.ctx.timestamp;
      const wc = this.#wordCountFromHtml(data.body || '');

      // Build the DB record. OwnerPubKey is normalized to lowercase for lookups.
      const note = {
        OwnerPubKey: owner.toLowerCase(),
        Title: data.title || '',
        Body: data.body || '',
        CreatedAt: now,
        UpdatedAt: now,
        WordCount: wc,
        ConcurrencyKey: '0x' + (now.toString(16)).padStart(14, '0')
      };

      // Open SQLite connection, insert the record, capture last inserted ID.
      this.db.open();
      const r = await this.db.insertValue(Tables.NOTES, note);
      res.success = { id: r.lastId };
    } catch (e) { res.error = { code: 500, message: e.message }; }
    finally { this.db.close(); } // Always close connection.
    return res;
  }

  /**
   * Fetch a single note by ID, ensuring it is owned by the requesting user.
   *
   * Expected message.data:
   * - id: number (required)
   *
   * Behavior:
   * - Loads the row by Id and checks OwnerPubKey matches message.userPubKey (case-insensitive).
   *
   * Returns:
   * - { success: { id, title, body, createdAt, updatedAt, wordCount } }
   * - { error: { code: 404, message: 'Note not found.' } } if not found or not owned by caller
   * - { error: { code: 500, message: string } } on internal error
   */
  async getNoteById() {
    const res = {};
    try {
      const id = this.message.data?.id;
      // Open connection and find the row.
      this.db.open();
      const row = await this.db.findById(Tables.NOTES, id);

      // Enforce ownership: only the owner can read.
      if (!row || row.OwnerPubKey.toLowerCase() !== this.message.userPubKey.toLowerCase()) {
        res.error = { code: 404, message: 'Note not found.' }; return res;
      }

      // Map DB row into response payload.
      res.success = {
        id: row.Id,
        title: row.Title,
        body: row.Body,
        createdAt: row.CreatedAt,
        updatedAt: row.UpdatedAt,
        wordCount: row.WordCount
      };
    } catch (e) { res.error = { code: 500, message: e.message }; }
    finally { this.db.close(); }
    return res;
  }

  /**
   * Fetch all notes for the requesting user.
   *
   * Expected message.data: none
   *
   * Behavior:
   * - Queries by OwnerPubKey to scope results to the caller.
   *
   * Returns:
   * - { success: Array<{ id, title, body, createdAt, updatedAt, wordCount }> }
   * - { error: { code: 500, message: string } } on internal error
   */
  async getAllNotes() {
    const res = {};
    try {
      // Open connection and get rows filtered by owner key.
      this.db.open();
      const rows = await this.db.getValues(Tables.NOTES, { OwnerPubKey: this.message.userPubKey.toLowerCase() });

      // Project rows to API-friendly shape.
      res.success = rows.map(r => ({ id: r.Id, title: r.Title, body: r.Body, createdAt: r.CreatedAt, updatedAt: r.UpdatedAt, wordCount: r.WordCount }));
    } catch (e) { res.error = { code: 500, message: e.message }; }
    finally { this.db.close(); }
    return res;
  }

  /**
   * Update a note's title/body for the requesting user.
   *
   * Expected message.data:
   * - id: number (required)
   * - title?: string
   * - body?: string
   *
   * Behavior:
   * - Loads existing row and enforces ownership check.
   * - Updates Title/Body if provided; recalculates WordCount if Body changes.
   * - Sets UpdatedAt to ctx.timestamp.
   *
   * Returns:
   * - { success: { changes: number } } where changes indicates number of rows updated
   * - { error: { code: 404, message: 'Note not found.' } } if not found or not owned by caller
   * - { error: { code: 500, message: string } } on internal error
   */
  async updateNote() {
    const res = {};
    try {
      const id = this.message.data?.id;
      const data = this.message.data || {};

      // Open connection and validate existence/ownership.
      this.db.open();
      const existing = await this.db.findById(Tables.NOTES, id);
      if (!existing || existing.OwnerPubKey.toLowerCase() !== this.message.userPubKey.toLowerCase()) {
        res.error = { code: 404, message: 'Note not found.' }; return res;
      }

      // Compute updated word count if body is provided, otherwise retain existing WordCount.
      const wc = data.body !== undefined ? this.#wordCountFromHtml(data.body) : existing.WordCount;

      // Prepare partial update set based on provided fields.
      const updateData = {};
      if (data.title !== undefined) updateData.Title = data.title;
      if (data.body !== undefined) updateData.Body = data.body;
      updateData.UpdatedAt = this.ctx.timestamp;
      updateData.WordCount = wc;

      // Update the row filtered by Id and OwnerPubKey to ensure ownership in the update.
      const result = await this.db.updateValue(Tables.NOTES, updateData, { Id: id, OwnerPubKey: this.message.userPubKey.toLowerCase() });
      res.success = { changes: result.changes };
    } catch (e) { res.error = { code: 500, message: e.message }; }
    finally { this.db.close(); }
    return res;
  }

  /**
   * Delete a note owned by the requesting user.
   *
   * Expected message.data:
   * - id: number (required)
   *
   * Behavior:
   * - Validates that the note exists and is owned by the caller before deleting.
   *
   * Returns:
   * - { success: { changes: number } } where changes indicates number of rows deleted
   * - { error: { code: 404, message: 'Note not found.' } } if not found or not owned by caller
   * - { error: { code: 500, message: string } } on internal error
   */
  async deleteNote() {
    const res = {};
    try {
      const id = this.message.data?.id;

      // Open connection and validate existence/ownership.
      this.db.open();
      const existing = await this.db.findById(Tables.NOTES, id);
      if (!existing || existing.OwnerPubKey.toLowerCase() !== this.message.userPubKey.toLowerCase()) {
        res.error = { code: 404, message: 'Note not found.' }; return res;
      }

      // Perform delete constrained by Id and OwnerPubKey to prevent cross-user deletes.
      const result = await this.db.deleteValues(Tables.NOTES, { Id: id, OwnerPubKey: this.message.userPubKey.toLowerCase() });
      res.success = { changes: result.changes };
    } catch (e) { res.error = { code: 500, message: e.message }; }
    finally { this.db.close(); }
    return res;
  }
}

module.exports = { NoteService };