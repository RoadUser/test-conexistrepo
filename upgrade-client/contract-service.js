const HotPocket = require('hotpocket-js-client');

function fromHex(hex) { const clean = hex.startsWith('0x') ? hex.slice(2) : hex; const out = new Uint8Array(clean.length/2); for (let i=0;i<out.length;i++){ out[i]=parseInt(clean.substr(i*2,2),16);} return out; }
function toHex(buf) { return Array.from(buf).map(b=>b.toString(16).padStart(2,'0')).join(''); }

// Minimal Ed25519 signer using WebCrypto (Node 16+ experimental) is unreliable for Ed25519; instead rely on HP keypair and detached sign available on client internals.
// hotpocket-js-client exposes keypair (libsodium). We'll use its signDetached.
async function signDetached(message, client) {
  if (!client || !client._kp) throw new Error('Client internal keypair unavailable.');
  // _kp is implementation detail; current versions expose sign method on client.crypto if available. Fallback to sodium via client._kp.signDetached
  if (client.signDetached) return client.signDetached(message);
  if (client._kp && client._kp.signDetached) return client._kp.signDetached(message);
  throw new Error('Detached sign not available in client.');
}

class ContractService {
  constructor(servers) { this.servers = servers; this.client = null; this.userKeyPair = null; this.promiseMap = new Map(); }
  async init() {
    this.userKeyPair = await HotPocket.generateKeys();
    this.client = await HotPocket.createClient(this.servers, this.userKeyPair);
    if (!await this.client.connect()) throw new Error('Connection failed');
    this.client.on(HotPocket.events.contractOutput, (r) => {
      r.outputs.forEach((o) => {
        try {
          const obj = JSON.parse(o.toString());
          const pid = obj.promiseId;
          if (pid && this.promiseMap.has(pid)) {
            const { resolve, reject } = this.promiseMap.get(pid);
            if (obj.error) reject(obj.error); else resolve(obj.success || obj);
            this.promiseMap.delete(pid);
          }
        } catch (_) {}
      });
    });
    return true;
  }
  async submitInput(inp) {
    const pid = Math.random().toString(16).slice(2);
    const payload = JSON.stringify({ promiseId: pid, ...inp });
    const sub = await this.client.submitContractInput(payload);
    await sub.submissionStatus;
    return new Promise((resolve, reject) => { this.promiseMap.set(pid, { resolve, reject }); });
  }
  async prepareSignedUpgrade(contentBuffer, version, description) {
    const sig = await signDetached(contentBuffer, this.client);
    return {
      Service: 'Upgrade',
      Action: 'UpgradeContract',
      data: { version, description, content: contentBuffer.toString('base64') },
      signature: toHex(sig)
    };
  }
}
module.exports = ContractService;
