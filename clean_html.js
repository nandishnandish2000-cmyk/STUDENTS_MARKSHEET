const fs = require('fs');
const path = 'c:/students marksheet_anti gravity/index.html';
let content = fs.readFileSync(path, 'utf8');

// The new grid has border-cyan-500/20. The old ones have border-white/5.
// I will remove the div containing the old labels.
const oldSectionRegex = /<div class="glass-card p-8 rounded-2xl text-center border-white\/5">[\s\S]*?<span id="overallFinalStatus"[\s\S]*?<\/div>[\s\S]*?<\/div>/;

content = content.replace(oldSectionRegex, '');

fs.writeFileSync(path, content);
console.log('Cleaned up redundant cards in index.html');
