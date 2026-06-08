const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const settings = require('../settings.json').settings;
const { Tables } = require('../Constants/constants');

class DBInitializer {
  static #db = null;

  static async init() {
    if (!fs.existsSync(settings.dbPath)) {
      this.#db = new sqlite3.Database(settings.dbPath);
      await this.#runQuery('PRAGMA foreign_keys = ON');
      await this.#runQuery(`CREATE TABLE IF NOT EXISTS ${Tables.CONTRACTVERSION} (
        Id INTEGER PRIMARY KEY AUTOINCREMENT,
        Version FLOAT NOT NULL,
        Description TEXT,
        CreatedOn INTEGER,
        LastUpdatedOn INTEGER
      )`);
      await this.#runQuery(`CREATE TABLE IF NOT EXISTS ${Tables.SQLSCRIPTMIGRATIONS} (
        Id INTEGER PRIMARY KEY AUTOINCREMENT,
        Sprint TEXT NOT NULL,
        ScriptName TEXT NOT NULL,
        ExecutedTimestamp TEXT,
        ConcurrencyKey TEXT
      )`);
      await this.#runQuery(`CREATE TABLE IF NOT EXISTS ${Tables.ACTIVITYLOG} (
        Id INTEGER PRIMARY KEY AUTOINCREMENT,
        ActivityType TEXT,
        User TEXT,
        Service TEXT,
        Action TEXT,
        Message TEXT,
        ExceptionMessage TEXT,
        TimeStamp TEXT
      )`);
      await this.#runQuery(`CREATE TABLE IF NOT EXISTS ${Tables.NOTES} (
        Id INTEGER PRIMARY KEY AUTOINCREMENT,
        OwnerPubKey TEXT NOT NULL,
        Title TEXT,
        Body TEXT,
        CreatedAt INTEGER,
        UpdatedAt INTEGER,
        WordCount INTEGER DEFAULT 0,
        ConcurrencyKey TEXT
      )`);
      this.#db.close();
    }

    if (fs.existsSync(settings.dbPath)) {
      this.#db = new sqlite3.Database(settings.dbPath);
      const getLastExecutedSprintQuery = `SELECT Sprint FROM ${Tables.SQLSCRIPTMIGRATIONS} ORDER BY Sprint DESC LIMIT 1`;
      let rc = await this.#getRecord(getLastExecutedSprintQuery);
      const lastExecutedSprint = rc ? rc.Sprint : 'Sprint_00';
      const base = settings.dbScriptsFolderPath;
      if (fs.existsSync(base)) {
        const scriptFolders = fs.readdirSync(base).filter(f => f.startsWith('Sprint_') && f >= lastExecutedSprint).sort();
        for (const sprintFolder of scriptFolders) {
          const sprintFolderPath = path.join(base, sprintFolder);
          const sqlFiles = fs.readdirSync(sprintFolderPath).filter(file => file.match(/^\d+_.+\.sql$/)).sort();
          for (const sqlFile of sqlFiles) {
            const scriptPath = path.join(sprintFolderPath, sqlFile);
            const existsQ = `SELECT 1 FROM ${Tables.SQLSCRIPTMIGRATIONS} WHERE Sprint = ? AND ScriptName = ?`;
            const found = await this.#getRecord(existsQ, [sprintFolder, sqlFile]);
            if (!found) {
              const sqlScript = fs.readFileSync(scriptPath, 'utf8');
              const statements = sqlScript.split(';').map(s => s.split('\
').map(l => l.trim().startsWith('--') ? '' : l).join('\
')).filter(s => s.trim() !== '');
              for (const st of statements) { try { await this.#runQuery(st); } catch (e) { console.error('[MIGRATION] Error:', e); } }
              const insertQ = `INSERT INTO ${Tables.SQLSCRIPTMIGRATIONS} (Sprint, ScriptName, ExecutedTimestamp) VALUES (?, ?, ?)`;
              await this.#runQuery(insertQ, [sprintFolder, sqlFile, new Date().toISOString()]);
            }
          }
        }
      }
      this.#db.close();
    }
  }

  static #runQuery(query, params = null) {
    return new Promise((resolve, reject) => {
      this.#db.run(query, params ? params : [], function (err) {
        if (err) return reject(err);
        resolve({ lastId: this.lastID, changes: this.changes });
      });
    });
  }

  static #getRecord(query, params = []) {
    return new Promise((resolve, reject) => {
      this.#db.get(query, params, (err, row) => { if (err) return reject(err); resolve(row); });
    });
  }
}

module.exports = { DBInitializer };
