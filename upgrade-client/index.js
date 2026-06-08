// Usage: node index.js ws://localhost:8081 ./dist.zip 1.1 "Update desc"
const fs = require('fs');
const path = require('path');
const ContractService = require('./contract-service');

async function main() {
  const url = process.argv[2];
  const zipPath = process.argv[3];
  const version = parseFloat(process.argv[4]);
  const description = process.argv[5] || '';
  if (!url || !zipPath || !version) { console.log('Usage: node index.js <ws(s)://host:8081> <zipPath> <version> [description]'); process.exit(1); }
  const buf = fs.readFileSync(path.resolve(zipPath));
  const svc = new ContractService([url]);
  await svc.init();
  const payload = await svc.prepareSignedUpgrade(buf, version, description);
  try {
    const res = await svc.submitInput(payload);
    console.log('Upgrade response:', res);
  } catch (e) { console.error('Upgrade failed:', e); process.exit(1); }
}
main();
