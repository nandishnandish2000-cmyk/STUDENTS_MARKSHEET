const fs = require('fs');
const path = 'c:/students marksheet_anti gravity/js/app.js';
let content = fs.readFileSync(path, 'utf8');

const newFunction = `    viewOverallConclusion: async () => {
        try {
            const res = await fetch(\`\${API_BASE}/student/overall/\${app.currentStudentRegNo}\`);
            const data = await res.json();
            if (!data.success) { app.showToast(data.message || 'Records not found', 'error'); return; }

            app.navigateTo('overallConclusion');
            let coreObt = 0, coreMax = 0, pracObt = 0, pracMax = 0, hasFail = false;
            const timelineContainer = document.getElementById('semesterTimelineContainer');
            if (timelineContainer) timelineContainer.innerHTML = '';
            const semesterAverages = [];

            data.history.sort((a, b) => a.semester.localeCompare(b.semester, undefined, { numeric: true }));

            data.history.forEach(sem => {
                let semObt = 0, semMax = 0;
                const semWrapper = document.createElement('div');
                semWrapper.className = 'glass-card p-10 rounded-2xl border-white/5 mb-8 shadow-2xl relative overflow-hidden group';

                let semHtml = \`
                    <div class="absolute -right-10 -top-10 text-white/5 text-8xl font-black font-[Orbitron] rotate-12 group-hover:rotate-0 transition-transform">\${sem.semester.split('_')[1] || '0'}</div>
                    <div class="relative z-10">
                        <div class="flex justify-between items-center mb-8 border-b border-white/10 pb-5">
                            <h4 class="text-2xl font-bold text-white font-[Orbitron] tracking-widest">\${sem.semester.replace('_', ' ').toUpperCase()}</h4>
                            <div id="sem-badge-\${sem.semester}" class="px-4 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-[10px] text-cyan-400 font-bold uppercase tracking-widest">Efficiency: --%</div>
                        </div>
                        <div class="overflow-x-auto"><table class="w-full text-sm font-[Rajdhani]">
                            <thead><tr class="text-left text-slate-500 uppercase text-[10px] tracking-widest">
                                <th class="pb-5">Subject Vector</th><th class="pb-5">Logic Type</th><th class="pb-5 text-center">Score Matrix</th><th class="pb-5 text-center">Status</th>
                            </tr></thead><tbody class="text-slate-300 divide-y divide-white/5 font-[Rajdhani]">\`;

                sem.subjects.forEach(sub => {
                    const total = (sub.internal_marks || 0) + sub.mark;
                    const max = (sub.overall_max_marks || 75) + 25;
                    const isPass = total >= (max * 0.4);
                    if (!isPass) hasFail = true;
                    if (sub.paper_type === 'CORE') { coreObt += total; coreMax += max; }
                    if (sub.paper_type === 'PRACTICAL' || sub.paper_type === 'PRAC') { pracObt += total; pracMax += max; }
                    semObt += total; semMax += max;

                    semHtml += \`<tr>
                        <td class="py-4 font-bold text-white tracking-wide">\${sub.name}</td>
                        <td class="py-4"><span class="px-2 py-0.5 rounded text-[9px] border \${sub.paper_type === 'CORE' ? 'border-cyan-500/50 text-cyan-400 bg-cyan-500/10' : 'border-slate-500/30 text-slate-500 bg-slate-500/5'} font-bold uppercase tracking-widest">\${sub.paper_type}</span></td>
                        <td class="py-4 text-center font-mono text-cyan-400/80">\${total} / \${max}</td>
                        <td class="py-4 text-center"><span class="px-3 py-1 rounded border \${isPass ? 'border-emerald-500/30 text-emerald-400 bg-emerald-500/5' : 'border-rose-500/30 text-rose-400 bg-rose-500/5'} font-black text-[9px] tracking-widest">\${isPass ? 'PASS' : 'FAIL'}</span></td>
                    </tr>\`;
                });

                const semAvg = semMax > 0 ? (semObt / semMax) * 100 : 0;
                semesterAverages.push(semAvg);
                semHtml += \`</tbody></table></div></div>\`;
                semWrapper.innerHTML = semHtml;
                if (timelineContainer) timelineContainer.appendChild(semWrapper);

                setTimeout(() => {
                    const badge = document.getElementById(\`sem-badge-\${sem.semester}\`);
                    if (badge) badge.textContent = \`Efficiency: \${semAvg.toFixed(1)}%\`;
                }, 100);
            });

            const coreEfficiency = coreMax > 0 ? (coreObt / coreMax) * 100 : 0;
            const practicalEfficiency = pracMax > 0 ? (pracObt / pracMax) * 100 : 0;

            if (document.getElementById('overallCorePercent')) document.getElementById('overallCorePercent').textContent = coreEfficiency.toFixed(2) + '%';
            if (document.getElementById('overallPracticalIndex')) document.getElementById('overallPracticalIndex').textContent = practicalEfficiency.toFixed(1) + '%';

            const trendEl = document.getElementById('overallTrendVector');
            if (trendEl && semesterAverages.length > 1) {
                const first = semesterAverages[0], last = semesterAverages[semesterAverages.length - 1];
                if (last > first + 1.5) { trendEl.textContent = 'ASCENDING'; trendEl.className = 'text-2xl font-bold text-emerald-400 font-[Orbitron] mt-2 block tracking-[0.2em]'; }
                else if (last < first - 1.5) { trendEl.textContent = 'DECLINING'; trendEl.className = 'text-2xl font-bold text-rose-400 font-[Orbitron] mt-2 block tracking-[0.2em]'; }
                else { trendEl.textContent = 'STABLE'; trendEl.className = 'text-2xl font-bold text-indigo-400 font-[Orbitron] mt-2 block tracking-[0.2em]'; }
            } else if (trendEl) trendEl.textContent = 'STABLE';

            const rankEl = document.getElementById('overallMatrixRank');
            if (rankEl) {
                let rank = 'TIER-C', color = 'text-slate-400';
                if (coreEfficiency >= 85) { rank = 'TIER-S'; color = 'text-amber-400'; }
                else if (coreEfficiency >= 75) { rank = 'TIER-A'; color = 'text-cyan-400'; }
                else if (coreEfficiency >= 60) { rank = 'TIER-B'; color = 'text-emerald-400'; }
                rankEl.textContent = rank;
                rankEl.className = \`text-4xl font-bold \${color} font-[Orbitron]\`;
            }

            const statusEl = document.getElementById('overallFinalStatus');
            if (statusEl) {
                statusEl.textContent = hasFail ? 'STATUS: NEEDS ATTENTION' : 'STATUS: OPTIMIZED';
                statusEl.className = \`text-[9px] font-bold uppercase tracking-widest mt-2 \${hasFail ? 'text-rose-500 font-bold' : 'text-emerald-500 font-bold'}\`;
            }

            app.generateCareerInsights(data.history);
        } catch (err) {
            console.error(err);
            app.showToast('Error syncing overall data', 'error');
        }
    },`;

// Find the function and replace it
const startTag = 'viewOverallConclusion: async () => {';
const endTag = '    },'; // This needs to be the end of THIS function

let startIndex = content.indexOf(startTag);
if (startIndex !== -1) {
    // Find the end of the function. It ends where the next function starts or specific brace count.
    // For simplicity, we know it's around line 745.
    // We'll search for the next handleMarksheet... or handleUpdate... or whatever follows.
    const searchAfterIndex = startIndex + startTag.length;
    const nextFuncIndex = content.indexOf('    generateCareerInsights:', searchAfterIndex);

    if (nextFuncIndex !== -1) {
        content = content.substring(0, startIndex) + newFunction + content.substring(nextFuncIndex);
        fs.writeFileSync(path, content);
        console.log('Successfully updated app.js');
    } else {
        console.log('Could not find end transition point');
    }
} else {
    console.log('Could not find start point');
}
