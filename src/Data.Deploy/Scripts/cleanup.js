const fs = require('fs');
const settings = require('../../settings.json').settings;
try {
  if (fs.existsSync(settings.newContractZipFileName)) fs.unlinkSync(settings.newContractZipFileName);
  if (fs.existsSync(settings.postExecutionScriptName)) fs.unlinkSync(settings.postExecutionScriptName);
  console.log('Cleanup completed.');
} catch (e) { console.log('Cleanup error:', e.message); }
