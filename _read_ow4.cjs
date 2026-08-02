const fs = require('fs');
function dec(file) {
  let b = fs.readFileSync(file);
  if (b[0] === 0xFF && b[1] === 0xFE) return b.slice(2).toString('utf16le');
  if (b[0] === 0xEF && b[1] === 0xBB && b[2] === 0xBF) return b.slice(3).toString('utf8');
  return b.toString('utf8');
}
console.log(dec('d:/newproject/_ow4.txt').slice(0, 1400));
