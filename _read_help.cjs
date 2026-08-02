const fs = require('fs');
let b = fs.readFileSync('d:/newproject/_up_help.txt');
let s;
if (b[0] === 0xFF && b[1] === 0xFE) s = b.slice(2).toString('utf16le');
else if (b[0] === 0xEF && b[1] === 0xBB && b[2] === 0xBF) s = b.slice(3).toString('utf8');
else s = b.toString('utf8');
console.log(s);
