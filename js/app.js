const API_BASE = window.location.origin + '/api';

const app = {
    currentSemester: null,
    currentStudentRegNo: null,
    adminMode: false,

    // --- Navigation ---
    navigateTo: (viewId) => {
        // Hide all views
        document.querySelectorAll('.view-section').forEach(el => {
            el.classList.add('hidden');
            el.classList.remove('fade-in'); // Reset animation
        });

        // Show target view
        const target = document.getElementById(viewId);
        if (target) {
            target.classList.remove('hidden');
            // Trigger reflow to restart animation
            void target.offsetWidth;
            target.classList.add('fade-in');
        }

        // Toggle global logout button based on view
        const logoutBtn = document.getElementById('globalLogoutBtn');
        if (viewId === 'homePage' || viewId === 'adminLogin' || viewId === 'studentLogin') {
            logoutBtn.classList.add('hidden');
        } else {
            logoutBtn.classList.remove('hidden');
            // Set logout action
            logoutBtn.onclick = app.logout;
        }

        // Reset forms if navigating away (optional, usually good UX)
        app.clearForms();
    },

    logout: () => {
        app.currentSemester = null;
        app.currentStudentRegNo = null;
        app.adminMode = false;
        app.navigateTo('homePage');
        app.showToast('Logged out successfully', 'success');
    },

    clearForms: () => {
        document.getElementById('adminLoginForm').reset();
        document.getElementById('studentLoginForm').reset();
        document.getElementById('addStudentForm').reset();
        document.getElementById('editStudentForm').reset();
        document.getElementById('addSubjectsContainer').innerHTML = '';
        document.getElementById('editSubjectsContainer').innerHTML = '';
        // Add one default subject row for Add Student
        // app.addSubjectRow('addSubjectsContainer'); // Wait until view load? No, do it now or on click
    },

    // --- Toast Notification ---
    showToast: (message, type = 'info') => {
        const toast = document.getElementById('toast');
        toast.textContent = message;
        toast.className = `fixed top-20 right-5 px-6 py-4 rounded shadow-lg text-white z-50 transition opacity-0 transform translate-y-[-10px]`;

        if (type === 'success') toast.classList.add('bg-green-500');
        else if (type === 'error') toast.classList.add('bg-red-500');
        else toast.classList.add('bg-blue-500');

        toast.classList.remove('hidden');
        // Trigger animation
        setTimeout(() => {
            toast.classList.remove('opacity-0', 'translate-y-[-10px]');
            toast.classList.add('opacity-100', 'translate-y-0');
        }, 10);

        setTimeout(() => {
            toast.classList.remove('opacity-100', 'translate-y-0');
            toast.classList.add('opacity-0', 'translate-y-[-10px]');
            setTimeout(() => toast.classList.add('hidden'), 300);
        }, 3000);
    },

    // --- Admin Functions ---
    handleAdminLogin: async (e) => {
        e.preventDefault();
        const username = document.getElementById('adminUsername').value;
        const password = document.getElementById('adminPassword').value;

        try {
            const res = await fetch(`${API_BASE}/admin/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            const data = await res.json();

            if (data.success) {
                app.adminMode = true;
                app.showToast('Login Successful', 'success');
                app.navigateTo('adminSemesterSelect');
            } else {
                app.showToast(data.message, 'error');
            }
        } catch (err) {
            app.showToast('Server Error', 'error');
            console.error(err);
        }
    },

    selectAdminSemester: (semesterId) => {
        app.currentSemester = semesterId;
        document.getElementById('adminCurrentSemesterDisplay').textContent = semesterId.replace('_', ' ').toUpperCase();
        document.getElementById('listSemesterDisplay').textContent = semesterId.replace('_', ' ').toUpperCase();
        app.navigateTo('adminDashboard');
    },

    navigateToAddStudent: () => {
        app.navigateTo('addStudentPage');
        document.getElementById('addSubjectsContainer').innerHTML = '';
        app.addSubjectRow('addSubjectsContainer'); // Add initial row
    },

    addSubjectRow: (containerId, initialData = null) => {
        const container = document.getElementById(containerId);
        if (!container) return; // Safety check

        const div = document.createElement('div');
        div.className = 'flex flex-wrap gap-2 items-end border-b border-gray-100 pb-2 mb-2 subject-row'; // Added subject-row class

        // Defaults with explicit checks
        const subjectName = (initialData && initialData.name) ? initialData.name : '';
        const paperType = (initialData && initialData.paper_type) ? initialData.paper_type : 'CORE';
        const overallMax = (initialData && initialData.overall_max_marks) ? initialData.overall_max_marks : 75;
        const internal = (initialData && initialData.internal_marks !== undefined) ? initialData.internal_marks : 0;
        const mark = (initialData && initialData.mark !== undefined) ? initialData.mark : '';

        div.innerHTML = `
            <div class="flex-1 min-w-[150px]">
                <label class="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">Layer Name</label>
                <input type="text" placeholder="e.g., Core Engine" class="subject-name w-full bg-slate-900 border-slate-700 rounded-xl p-3 text-white focus:ring-cyan-500 focus:border-cyan-500 transition-all" value="${subjectName}" required>
            </div>
            
            <div class="w-32">
                <label class="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">Protocol</label>
                <select class="paper-type w-full bg-slate-900 border-slate-700 rounded-xl p-3 text-white focus:ring-cyan-500 focus:border-cyan-500 transition-all">
                    <option value="CORE" ${paperType === 'CORE' ? 'selected' : ''}>CORE</option>
                    <option value="ALLIED" ${paperType === 'ALLIED' ? 'selected' : ''}>ALLIED</option>
                    <option value="PRACTICAL" ${paperType === 'PRACTICAL' ? 'selected' : ''}>PRACTICAL</option>
                </select>
            </div>

            <div class="w-24">
                <label class="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">Max Ext</label>
                <select class="overall-max w-full bg-slate-900 border-slate-700 rounded-xl p-3 text-white focus:ring-cyan-500 focus:border-cyan-500 transition-all">
                    <option value="25" ${overallMax == 25 ? 'selected' : ''}>25</option>
                    <option value="50" ${overallMax == 50 ? 'selected' : ''}>50</option>
                    <option value="75" ${overallMax == 75 ? 'selected' : ''}>75</option>
                </select>
            </div>

            <div class="w-20">
                <label class="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">Int</label>
                <input type="number" min="0" max="25" class="internal-mark w-full bg-slate-900 border-slate-700 rounded-xl p-3 text-white focus:ring-cyan-500 focus:border-cyan-500 transition-all" value="${internal}" required>
            </div>

            <div class="w-20">
                <label class="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">Ext</label>
                <input type="number" min="0" class="subject-mark w-full bg-slate-900 border-slate-700 rounded-xl p-3 text-white focus:ring-cyan-500 focus:border-cyan-500 transition-all" value="${mark}" required>
            </div>

            <button type="button" onclick="this.parentElement.remove()" class="text-rose-500 hover:text-rose-400 p-3 mb-1 transition-colors"><i class="fas fa-trash-alt"></i></button>
        `;
        container.appendChild(div);
    },

    collectSubjects: (containerId) => {
        const container = document.getElementById(containerId);
        const rows = container.querySelectorAll('.subject-row'); // Use specific class
        const subjects = [];
        let error = null;

        rows.forEach(row => {
            if (error) return;
            const name = row.querySelector('.subject-name').value;
            const paper_type = row.querySelector('.paper-type').value;
            const overall_max_marks = parseInt(row.querySelector('.overall-max').value);
            const internal_marks = parseInt(row.querySelector('.internal-mark').value || 0);
            const mark = parseInt(row.querySelector('.subject-mark').value);

            if (!name) {
                error = "Subject name is required";
                return;
            }
            if (isNaN(internal_marks) || internal_marks < 0 || internal_marks > 25) {
                error = `Internal marks for ${name} must be between 0 and 25`;
                return;
            }
            if (isNaN(mark) || mark < 0) {
                error = `External marks for ${name} must be valid`;
                return;
            }
            if (mark > overall_max_marks) {
                error = `External marks for ${name} cannot exceed max external marks (${overall_max_marks})`;
                return;
            }

            subjects.push({ name, paper_type, overall_max_marks, internal_marks, mark });
        });

        if (error) {
            app.showToast(error, 'error');
            return null;
        }

        return subjects;
    },

    handleAddStudent: async (e) => {
        e.preventDefault();
        const name = document.getElementById('addName').value;
        const regNo = document.getElementById('addRegNo').value;
        const subjects = app.collectSubjects('addSubjectsContainer');

        if (!subjects || subjects.length === 0) {
            if (!subjects) return; // Error handled in collectSubjects
            app.showToast('Please add at least one subject', 'error');
            return;
        }

        try {
            const res = await fetch(`${API_BASE}/students/${app.currentSemester}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, regNo, subjects })
            });
            const data = await res.json();

            if (data.success) {
                app.showToast('Student Added Successfully', 'success');
                app.loadStudentList(); // Go to list
            } else {
                app.showToast(data.message, 'error');
            }
        } catch (err) {
            app.showToast('Failed to add student', 'error');
        }
    },

    loadStudentList: async () => {
        app.navigateTo('studentListPage');
        const tbody = document.getElementById('studentListBody');
        tbody.innerHTML = '<tr><td colspan="4" class="text-center py-4">Loading...</td></tr>';

        try {
            const res = await fetch(`${API_BASE}/students/${app.currentSemester}`);
            const data = await res.json();

            tbody.innerHTML = '';
            if (data.success && data.students.length > 0) {
                data.students.forEach(student => {
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td class="px-8 py-5 whitespace-nowrap text-sm text-cyan-400 font-mono tracking-wider">${student.regNo}</td>
                        <td class="px-8 py-5 whitespace-nowrap text-sm text-white font-bold tracking-wide">${student.name}</td>
                        <td class="px-8 py-5 text-sm text-slate-400 max-w-xs truncate">${student.subjects.map(s => s.name).join(', ')}</td>
                        <td class="px-8 py-5 whitespace-nowrap text-right text-sm font-bold">
                            <button onclick="app.viewStudent('${student.id}')" class="text-cyan-400 hover:text-cyan-300 mr-5 transition-colors"><i class="fas fa-eye shadow-[0_0_10px_rgba(34,211,238,0.3)]"></i> Analysis</button>
                            <button onclick="app.editStudent('${student.id}')" class="text-indigo-400 hover:text-indigo-300 mr-5 transition-colors"><i class="fas fa-edit"></i> Edit</button>
                            <button onclick="app.deleteStudent('${student.id}')" class="text-rose-400 hover:text-rose-300 transition-colors"><i class="fas fa-trash-alt"></i> Purge</button>
                        </td>
                    `;
                    tbody.appendChild(tr);
                });
            } else {
                tbody.innerHTML = '<tr><td colspan="4" class="text-center py-4 text-gray-500">No students found.</td></tr>';
            }
        } catch (err) {
            tbody.innerHTML = '<tr><td colspan="4" class="text-center py-4 text-red-500">Error loading data.</td></tr>';
        }
    },

    deleteStudent: async (id) => {
        if (!confirm('Are you sure you want to delete this student? This action cannot be undone.')) return;

        try {
            const res = await fetch(`${API_BASE}/students/${app.currentSemester}/${id}`, {
                method: 'DELETE'
            });
            const data = await res.json();
            if (data.success) {
                app.showToast('Student Deleted', 'success');
                app.loadStudentList(); // Refresh
            } else {
                app.showToast(data.message, 'error');
            }
        } catch (err) {
            app.showToast('Delete failed', 'error');
        }
    },

    // Store editing student locally to avoid refetch
    currentEditingStudent: null,

    viewStudent: async (id) => {
        try {
            const res = await fetch(`${API_BASE}/students/${app.currentSemester}`);
            const data = await res.json();
            const student = data.students.find(s => s.id === id);

            if (student) {
                app.navigateTo('adminViewStudentPage');
                document.getElementById('viewStudentName').textContent = student.name;
                document.getElementById('viewStudentRegNo').textContent = student.regNo;

                const tbody = document.getElementById('viewStudentSubjectsBody');
                tbody.innerHTML = '';

                student.subjects.forEach(sub => {
                    const paperType = sub.paper_type || 'CORE';
                    const overallMax = sub.overall_max_marks || 75;
                    const internal = sub.internal_marks || 0;
                    const external = sub.mark;
                    const total = internal + external;
                    // Result Logic: Total > 40% of Max Total (Max + 25) ?
                    // Actually, Max Total = overallMax + 25.
                    // Pass if total >= 0.4 * (overallMax + 25) ?? 
                    // Or usually 35/40 or 50. Let's use 40% of max subject total.
                    const maxSubjectTotal = overallMax + 25;
                    const isPass = total >= (maxSubjectTotal * 0.40);
                    const resultText = isPass ? 'PASS' : 'FAIL';
                    const resultClass = isPass ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' : 'text-rose-400 bg-rose-500/10 border-rose-500/20';

                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td class="px-6 py-5 whitespace-nowrap text-sm font-bold text-white tracking-wide">${sub.name}</td>
                        <td class="px-6 py-5 whitespace-nowrap text-sm text-slate-400">
                            <span class="px-3 py-1 text-[10px] font-bold rounded-lg border border-white/10 ${paperType === 'CORE' ? 'bg-indigo-500/20 text-indigo-300' : 'bg-slate-500/20 text-slate-300'}">${paperType}</span>
                        </td>
                        <td class="px-6 py-5 whitespace-nowrap text-sm text-slate-300 text-center font-mono">${overallMax}</td>
                        <td class="px-6 py-5 whitespace-nowrap text-sm text-slate-300 text-center font-mono">${internal}</td>
                        <td class="px-6 py-5 whitespace-nowrap text-sm text-cyan-400 text-center font-bold font-mono">${external}</td>
                        <td class="px-6 py-5 whitespace-nowrap text-sm text-white text-center font-black font-mono shadow-[0_0_10px_rgba(255,255,255,0.1)]">${total}</td>
                        <td class="px-6 py-5 whitespace-nowrap text-sm font-black text-center">
                            <span class="px-3 py-1 rounded-lg border ${resultClass}">${resultText}</span>
                        </td>
                    `;
                    tbody.appendChild(tr);
                });
            } else {
                app.showToast('Student not found', 'error');
            }
        } catch (err) {
            console.error(err);
            app.showToast('Error loading student', 'error');
        }
    },

    editStudent: async (id) => {
        try {
            // Re-fetch strict to be safe and ensure fresh data
            const res = await fetch(`${API_BASE}/students/${app.currentSemester}`);
            const data = await res.json();
            const student = data.students.find(s => s.id === id);

            if (student) {
                app.currentEditingStudent = student;
                app.navigateTo('editStudentPage');

                document.getElementById('editStudentId').value = student.id;
                document.getElementById('editName').value = student.name;
                document.getElementById('editRegNo').value = student.regNo;

                const container = document.getElementById('editSubjectsContainer');
                container.innerHTML = '';

                if (student.subjects && student.subjects.length > 0) {
                    student.subjects.forEach(sub => app.addSubjectRow('editSubjectsContainer', sub));
                } else {
                    app.addSubjectRow('editSubjectsContainer'); // Add empty row if none
                }
            } else {
                app.showToast('Student not found.', 'error');
            }
        } catch (err) {
            console.error(err);
            app.showToast('Error loading student details', 'error');
        }
    },

    handleUpdateStudent: async (e) => {
        e.preventDefault();
        const id = document.getElementById('editStudentId').value;
        const name = document.getElementById('editName').value;
        const regNo = document.getElementById('editRegNo').value;
        const subjects = app.collectSubjects('editSubjectsContainer');

        if (!subjects || subjects.length === 0) {
            if (!subjects) return; // Error handled
            app.showToast('Please add at least one subject', 'error');
            return;
        }

        try {
            const res = await fetch(`${API_BASE}/students/${app.currentSemester}/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, regNo, subjects })
            });
            const data = await res.json();

            if (data.success) {
                app.showToast('Student Updated Successfully', 'success');
                app.loadStudentList();
            } else {
                app.showToast(data.message, 'error');
            }
        } catch (err) {
            app.showToast('Update failed', 'error');
        }
    },

    // --- Student Functions ---
    handleStudentLogin: async (e) => {
        e.preventDefault();
        const name = document.getElementById('studentLoginName').value;
        const regNo = document.getElementById('studentLoginRegNo').value;

        try {
            const res = await fetch(`${API_BASE}/student/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, regNo })
            });
            const data = await res.json();

            if (data.success) {
                app.currentStudentRegNo = regNo;
                document.getElementById('welcomeStudentName').textContent = name;
                app.navigateTo('studentSemesterSelect');
                app.showToast('Login Successful', 'success');
            } else {
                app.showToast(data.message, 'error');
            }
        } catch (err) {
            app.showToast('Server Error', 'error');
        }
    },

    viewMarksheet: async (semesterId) => {
        try {
            const res = await fetch(`${API_BASE}/student/${semesterId}/${app.currentStudentRegNo}`);
            const data = await res.json();

            if (data.success) {
                const student = data.student;
                document.getElementById('sheetSemester').textContent = semesterId.replace('_', ' ').toUpperCase();
                document.getElementById('sheetName').textContent = student.name;
                document.getElementById('sheetRegNo').textContent = student.regNo;

                const tbody = document.getElementById('sheetBody');
                tbody.innerHTML = '';

                let totalObtained = 0;
                let totalMax = 0;
                let hasFail = false;

                student.subjects.forEach(sub => {
                    const paperType = sub.paper_type || 'CORE';
                    const overallMax = sub.overall_max_marks || 75; // External Max
                    const internal = sub.internal_marks || 0;
                    const external = sub.mark;

                    const subTotal = internal + external;
                    const subMaxTotal = overallMax + 25;

                    // Result Logic
                    const isPass = subTotal >= (subMaxTotal * 0.40);
                    const resultText = isPass ? 'PASS' : 'FAIL';
                    const resultClass = isPass ? 'text-emerald-400' : 'text-rose-400';
                    if (!isPass) hasFail = true;

                    // Calculation Logic: Only CORE for total/percentage
                    if (paperType === 'CORE') {
                        totalObtained += subTotal;
                        totalMax += subMaxTotal;
                    }

                    const tr = document.createElement('tr');
                    tr.className = 'border-b border-gray-100';
                    tr.innerHTML = `
                        <td class="text-left py-4 pl-6 text-white font-bold tracking-wide">${sub.name}</td>
                        <td class="text-left py-4 px-6"><span class="text-[10px] font-bold px-3 py-1 rounded-lg border ${paperType === 'CORE' ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30' : 'bg-slate-500/20 text-slate-300 border-slate-500/30'}">${paperType}</span></td>
                        <td class="text-center py-4 text-slate-300 font-mono">${internal}</td>
                        <td class="text-center py-4 text-slate-300 font-mono">${external}</td>
                        <td class="text-center py-4 font-black text-white font-mono">${subTotal}</td>
                        <td class="text-center py-4 text-slate-500 font-mono">${subMaxTotal}</td>
                         <td class="text-center py-4 font-black ${resultClass} tracking-widest">${resultText}</td>
                    `;
                    tbody.appendChild(tr);
                });

                // Total display removed
                // document.getElementById('sheetTotal').textContent = totalObtained;
                // document.getElementById('sheetMaxTotal').textContent = totalMax;

                // Calc Percentage
                const percentage = totalMax > 0 ? (totalObtained / totalMax) * 100 : 0;
                document.getElementById('sheetPercentage').textContent = percentage.toFixed(2) + '%';

                // Calc Grade
                let grade = 'Fail';
                if (hasFail) {
                    grade = 'Fail';
                } else {
                    if (percentage >= 90) grade = 'A';
                    else if (percentage >= 75) grade = 'B';
                    else if (percentage >= 60) grade = 'C';
                    else if (percentage >= 50) grade = 'D';
                }

                const gradeEl = document.getElementById('sheetGrade');
                gradeEl.textContent = grade;
                if (grade === 'Fail') gradeEl.className = 'text-4xl font-black text-rose-500 font-[Orbitron]';
                else gradeEl.className = 'text-4xl font-black text-emerald-400 font-[Orbitron]';

                app.navigateTo('studentMarksheet');
            } else {
                app.showToast('No record found for this semester', 'error'); // Or just alert? Stick to toast.
            }
        } catch (err) {
            app.showToast('Error fetching marksheet', 'error');
        }
    },

    viewOverallConclusion: async () => {
        try {
            const res = await fetch(`${API_BASE}/student/overall/${app.currentStudentRegNo}`);
            const data = await res.json();

            if (data.success) {
                app.navigateTo('overallConclusion');

                let totalObtained = 0;
                let totalMax = 0;
                let coreObtained = 0;
                let coreMax = 0;
                let totalSubjects = 0;
                let coreCount = 0;
                let hasFail = false;

                const timelineContainer = document.getElementById('semesterTimelineContainer');
                timelineContainer.innerHTML = '';

                // Sort history by semester naturally
                data.history.sort((a, b) => a.semester.localeCompare(b.semester, undefined, { numeric: true }));

                data.history.forEach(sem => {
                    const semTitle = sem.semester.replace('_', ' ').toUpperCase();
                    const semWrapper = document.createElement('div');
                    semWrapper.className = 'glass-card p-8 rounded-2xl border-white/5';

                    let semHtml = `
                        <div class="flex justify-between items-center mb-6 border-b border-white/10 pb-4">
                            <h4 class="text-xl font-bold text-cyan-400 font-[Orbitron]">${semTitle}</h4>
                        </div>
                        <div class="overflow-x-auto">
                            <table class="w-full text-sm">
                                <thead>
                                    <tr class="text-left text-slate-500 uppercase text-[10px] tracking-widest">
                                        <th class="pb-4">Subject</th>
                                        <th class="pb-4">Type</th>
                                        <th class="pb-4 text-center">Score</th>
                                        <th class="pb-4 text-center">Status</th>
                                    </tr>
                                </thead>
                                <tbody class="text-slate-300 divide-y divide-white/5">
                    `;

                    sem.subjects.forEach(sub => {
                        totalSubjects++;
                        const total = (sub.internal_marks || 0) + sub.mark;
                        const max = (sub.overall_max_marks || 75) + 25;
                        const isPass = total >= (max * 0.4);
                        if (!isPass) hasFail = true;

                        if (sub.paper_type === 'CORE') {
                            coreCount++;
                            coreObtained += total;
                            coreMax += max;
                        }
                        totalObtained += total;
                        totalMax += max;

                        semHtml += `
                            <tr>
                                <td class="py-3 font-medium text-white">${sub.name}</td>
                                <td class="py-3"><span class="px-2 py-0.5 rounded text-[9px] border ${sub.paper_type === 'CORE' ? 'border-indigo-500/30 text-indigo-400 bg-indigo-500/5' : 'border-slate-500/30 text-slate-400 bg-slate-500/5'} font-bold">${sub.paper_type}</span></td>
                                <td class="py-3 text-center font-mono">${total} / ${max}</td>
                                <td class="py-3 text-center"><span class="${isPass ? 'text-emerald-400' : 'text-rose-400'} font-black text-[10px] tracking-widest">${isPass ? 'PASS' : 'FAIL'}</span></td>
                            </tr>
                        `;
                    });

                    semHtml += `</tbody></table></div>`;
                    semWrapper.innerHTML = semHtml;
                    timelineContainer.appendChild(semWrapper);
                });

                // Update Stats
                const corePercent = coreMax > 0 ? (coreObtained / coreMax) * 100 : 0;
                document.getElementById('overallCorePercent').textContent = corePercent.toFixed(2) + '%';
                document.getElementById('overallTotalSubjects').textContent = totalSubjects;
                document.getElementById('overallCoreCount').textContent = coreCount;

                const statusEl = document.getElementById('overallFinalStatus');
                if (hasFail) {
                    statusEl.textContent = 'NEEDS ATTENTION';
                    statusEl.className = 'text-2xl font-bold text-rose-500 font-[Orbitron] mt-1 block';
                } else {
                    statusEl.textContent = 'QUALIFIED';
                    statusEl.className = 'text-2xl font-bold text-emerald-400 font-[Orbitron] mt-1 block';
                }

                // Generate Career Insights
                app.generateCareerInsights(data.history);

            } else {
                app.showToast(data.message || 'Records not found', 'error');
            }
        } catch (err) {
            console.error(err);
            app.showToast('Error syncing overall data', 'error');
        }
    },

    generateCareerInsights: (history) => {
        const insightsEl = document.getElementById('careerInsights');

        // Flatten all subjects to find top performers
        const allSubjects = [];
        history.forEach(sem => sem.subjects.forEach(s => allSubjects.push(s)));

        const coreSubjects = allSubjects.filter(s => s.paper_type === 'CORE');
        if (coreSubjects.length === 0) {
            insightsEl.textContent = "Continue your academic journey to unlock personalized career trajectories.";
            return;
        }

        // Sort by percentage performance
        coreSubjects.sort((a, b) => {
            const percA = ((a.internal_marks || 0) + a.mark) / ((a.overall_max_marks || 75) + 25);
            const percB = ((b.internal_marks || 0) + b.mark) / ((b.overall_max_marks || 75) + 25);
            return percB - percA;
        });

        const top3 = coreSubjects.slice(0, 3).map(s => s.name);

        let insightText = `Based on your exceptional performance in <span class="text-cyan-400 font-bold">${top3[0]}</span>`;
        if (top3[1]) insightText += ` and <span class="text-cyan-400 font-bold">${top3[1]}</span>`;

        insightText += `, you display a strong aptitude for `;

        // Simple keyword based career matching
        const lowName = top3[0].toLowerCase();
        if (lowName.includes('data') || lowName.includes('database') || lowName.includes('sql')) {
            insightText += "Data Engineering, Database Architecture, and Big Data Analytics. Consider certifications in Cloud Data platforms.";
        } else if (lowName.includes('java') || lowName.includes('python') || lowName.includes('c++') || lowName.includes('programming')) {
            insightText += "Software Development, Systems Architecting, and Backend Engineering. You have the logic to build complex scalable systems.";
        } else if (lowName.includes('web') || lowName.includes('html') || lowName.includes('js') || lowName.includes('react')) {
            insightText += "Full-Stack Development and UI/UX Architecture. Your ability to integrate front-end logic with user needs is a key asset.";
        } else if (lowName.includes('network') || lowName.includes('security') || lowName.includes('cloud')) {
            insightText += "Cybersecurity Analysis and Cloud Infrastructure Management. You are well-suited for high-stakes system protection.";
        } else if (lowName.includes('ai') || lowName.includes('machine') || lowName.includes('intelligence')) {
            insightText += "A.I. Research and Machine Learning Engineering. You possess the mathematical rigor for advanced cognitive computing.";
        } else {
            insightText += "Advanced Technical Leadership. Your diverse core strength indicates a potential for Tech Product Management or Solution Architecture.";
        }

        insightsEl.innerHTML = insightText;
    }
};

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    // Show Home on load
    app.navigateTo('homePage');

    // Forms
    document.getElementById('adminLoginForm').addEventListener('submit', app.handleAdminLogin);
    document.getElementById('studentLoginForm').addEventListener('submit', app.handleStudentLogin);
    document.getElementById('addStudentForm').addEventListener('submit', app.handleAddStudent);
    document.getElementById('editStudentForm').addEventListener('submit', app.handleUpdateStudent);
});
