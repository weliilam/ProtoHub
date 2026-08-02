const fs = require('fs');
for (const f of ['_r1', '_r2']) {
  let b = fs.readFileSync('d:/newproject/' + f + '.txt');
  let s;
  if (b[0] === 0xFF && b[1] === 0xFE) s = b.toString('utf16le');
  else if (b[0] === 0xEF && b[1] === 0xBB && b[2] === 0xBF) s = b.toString('utf8');
  else s = b.toString('latin1');
  const i = s.indexOf('"ok"');
  if (i >= 0) {
    const end = s.indexOf('}', i);
    console.log(f + ' => ' + s.slice(i - 8, end + 1));
  } else {
    console.log(f + ' => NO_OK; tail=' + s.slice(-260));
  }
}
