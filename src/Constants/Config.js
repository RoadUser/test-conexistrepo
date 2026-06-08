const fs = require('fs');
let env = {};
try {
  const res = fs.readFileSync('.env', 'utf8');
  res.split('\
').forEach((line) => {
    if (!line || !line.includes('=')) return;
    const [key, ...rest] = line.split('=');
    const val = rest.join('=');
    if (!key) return;
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      env[key] = val.slice(1, -1);
    } else env[key] = val;
  });
} catch (e) {}
module.exports = env;
