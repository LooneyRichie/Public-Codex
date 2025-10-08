const fs = require('fs');
const path = require('path');

class FileLedger {
  constructor(baseDir = path.join(process.cwd(), 'data', 'ledger')) {
    this.baseDir = baseDir;
    this.isReady = false;
    try {
      fs.mkdirSync(this.baseDir, { recursive: true });
      this.isReady = true;
    } catch (e) {
      this.isReady = false;
    }
  }

  append(poemId, eventType, payload) {
    if (!this.isReady) return;
    const file = path.join(this.baseDir, `${poemId}.log`);
    const line = JSON.stringify({
      t: new Date().toISOString(),
      eventType,
      payload
    }) + '\n';
    try {
      fs.appendFileSync(file, line, { encoding: 'utf8' });
    } catch (e) {
      // swallow errors
    }
  }
}

module.exports = FileLedger;
