const fs = require('fs');
const path = 'c:/students marksheet_anti gravity/index.html';
let content = fs.readFileSync(path, 'utf8');

// 1. Fix the Header (replace from Return Cluster button to the end of Cogntive Summary div)
const headerRegex = /<div class="flex justify-between items-center mb-10 border-b border-white\/10 pb-8">[\s\S]*?<h2 class="text-3xl font-bold text-white font-\[Orbitron\] tracking-tighter">COGNITIVE SUMMARY<\/h2>[\s\S]*?<\/div>/;

const newHeader = `            <!-- Professional HUD Header -->
            <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12 border-b border-white/10 pb-8">
                <div class="flex items-center gap-4">
                    <button onclick="app.navigateTo('studentSemesterSelect')"
                        class="btn-sci-fi !px-4 !py-1.5 !text-[9px] !border-white/10 !text-slate-500">
                        <i class="fas fa-chevron-left"></i> Return Cluster
                    </button>
                </div>
                <div class="md:text-right">
                    <h2 class="text-4xl font-bold text-white font-[Orbitron] tracking-tighter">COGNITIVE SUMMARY</h2>
                    <p class="text-[9px] text-cyan-400 uppercase tracking-[0.4em] mt-1 font-bold">Cross-Semester Analytic Matrix</p>
                </div>
            </div>`;

content = content.replace(headerRegex, newHeader);

// 2. Remove the OLD stats cards that were left behind
// They are between the new grid and the career insights
const oldCardsRegex = /<div class="glass-card p-8 rounded-2xl text-center border-white\/5">[\s\S]*?ACTIVE<\/span>[\s\S]*?<\/div>[\s\S]*?<\/div>/;
// Wait, that might be too broad. Let's be more specific.

const oldCardsBlock = `<div class="glass-card p-8 rounded-2xl text-center border-white/5">
                        <span class="text-[10px] text-slate-400 uppercase font-black tracking-[0.3em] block mb-4">Core
                            Efficiency</span>
                        <span id="overallCorePercent" class="text-4xl font-bold text-white font-[Orbitron]">--%</span>
                    </div>`;
// I'll just remove the specific block of 4 cards if I can find them.

// Actually, I'll just look for the first occurrence of the old labels and delete their parent divs.

fs.writeFileSync(path, content);
console.log('Successfully updated index.html header');
