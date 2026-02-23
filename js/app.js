const API_BASE = window.location.origin + '/api';

const app = {
    currentSemester: null,
    currentStudentRegNo: null,
    adminMode: false,

    // --- Navigation ---
    navigateTo: (viewId) => {
        console.log(`Navigating to view: ${viewId}`);
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
        if (!container) return;

        const div = document.createElement('div');
        div.className = 'flex flex-wrap gap-2 items-end border-b border-white/10 pb-4 mb-4 subject-row';

        const subjectName = (initialData && initialData.name) ? initialData.name : '';
        const paperType = (initialData && initialData.paper_type) ? initialData.paper_type : 'NON';
        const overallMax = (initialData && initialData.overall_max_marks) ? initialData.overall_max_marks : 75;
        const internal = (initialData && initialData.internal_marks !== undefined) ? initialData.internal_marks : 0;
        const mark = (initialData && initialData.mark !== undefined) ? initialData.mark : '';
        const result = (initialData && initialData.result) ? initialData.result : 'PASS';
        const showResult = true; // ALWAYS SHOW RESULT - USER IS IN CONTROL

        div.innerHTML = `
            <div class="flex-1 min-w-[150px]">
                <label class="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">Subject Name</label>
                <input type="text" placeholder="e.g., Mathematics" class="subject-name w-full bg-slate-900 border-slate-700 rounded-xl p-3 text-white focus:ring-cyan-500 focus:border-cyan-500 transition-all" value="${subjectName}" required>
            </div>
            <div class="w-28">
                <label class="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">Type</label>
                <select class="paper-type w-full bg-slate-900 border-slate-700 rounded-xl p-3 text-white focus:ring-cyan-500 focus:border-cyan-500 transition-all text-xs font-bold">
                    <option value="CORE" ${paperType === 'CORE' ? 'selected' : ''}>CORE</option>
                    <option value="ALLIED" ${paperType === 'ALLIED' ? 'selected' : ''}>ALLIED</option>
                    <option value="PRACTICAL" ${paperType === 'PRACTICAL' || paperType === 'PRAC' ? 'selected' : ''}>PRAC</option>
                    <option value="NON" ${paperType === 'NON' ? 'selected' : ''}>NON</option>
                </select>
            </div>
            <div class="w-20">
                <label class="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">Max(Ext)</label>
                <select class="overall-max w-full bg-slate-900 border-slate-700 rounded-xl p-3 text-white focus:ring-cyan-500 focus:border-cyan-500 transition-all font-mono">
                    <option value="25" ${overallMax == 25 ? 'selected' : ''}>25</option>
                    <option value="50" ${overallMax == 50 ? 'selected' : ''}>50</option>
                    <option value="75" ${overallMax == 75 ? 'selected' : ''}>75</option>
                    <option value="100" ${overallMax == 100 ? 'selected' : ''}>100</option>
                </select>
            </div>
            <div class="w-16">
                <label class="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">Int</label>
                <input type="number" min="0" max="25" class="internal-mark w-full bg-slate-900 border-slate-700 rounded-xl p-3 text-white focus:ring-cyan-500 focus:border-cyan-500 transition-all" value="${internal}">
            </div>
            <div class="w-16">
                <label class="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">Ext</label>
                <input type="number" min="0" class="subject-mark w-full bg-slate-900 border-slate-700 rounded-xl p-3 text-white focus:ring-cyan-500 focus:border-cyan-500 transition-all" value="${mark}" required>
            </div>
            ${showResult ? `
            <div class="w-24">
                <label class="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">Result</label>
                <select class="subject-result w-full bg-slate-900 border-slate-700 rounded-xl p-3 font-bold focus:ring-cyan-500 focus:border-cyan-500 transition-all ${result.startsWith('P') ? 'text-emerald-400' : 'text-rose-400'}" onchange="this.className='subject-result w-full bg-slate-900 border-slate-700 rounded-xl p-3 font-bold focus:ring-cyan-500 focus:border-cyan-500 transition-all ' + (this.value.startsWith('P') ? 'text-emerald-400' : 'text-rose-400')">
                    <option value="PASS" ${result === 'PASS' ? 'selected' : ''} style="color:#34d399">PASS</option>
                    <option value="FAIL" ${result === 'FAIL' ? 'selected' : ''} style="color:#f87171">FAIL</option>
                    <option value="P." ${result === 'P.' ? 'selected' : ''} style="color:#34d399">P.</option>
                </select>
            </div>` : ''}
            <button type="button" onclick="this.parentElement.remove()" class="text-rose-500 hover:text-rose-400 p-3 mb-1 transition-colors flex-shrink-0"><i class="fas fa-trash-alt"></i></button>
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

            const resultEl = row.querySelector('.subject-result');
            const result = resultEl ? resultEl.value : 'PASS'; // TRUST THE DROPDOWN ONLY.

            subjects.push({ name, paper_type, overall_max_marks, internal_marks, mark, result });
        });

        if (error) {
            app.showToast(error, 'error');
            return null;
        }

        return subjects;
    },

    handleAddStudent: async (e) => {
        e.preventDefault();
        const name = document.getElementById('addName').value.trim();
        const regNo = document.getElementById('addRegNo').value.trim();
        const subjects = app.collectSubjects('addSubjectsContainer');

        if (!name || !regNo) {
            app.showToast('Name and Register Number are required', 'error');
            return;
        }

        if (!subjects || subjects.length === 0) {
            if (!subjects) return; // Error handled in collectSubjects
            app.showToast('Please add at least one subject', 'error');
            return;
        }

        try {
            console.log(`Syncing student ${name} (${regNo}) to ${app.currentSemester}...`);
            const res = await fetch(`${API_BASE}/students/${app.currentSemester}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, regNo, subjects })
            });
            const data = await res.json();

            if (data.success) {
                console.log('Sync successful!');
                app.showToast('Student Added Successfully', 'success');
                app.loadStudentList(); // Go to list
            } else {
                console.warn('Sync failed:', data.message);
                app.showToast(data.message, 'error');
            }
        } catch (err) {
            console.error('Network error during sync:', err);
            app.showToast('Failed to add student', 'error');
        }
    },

    loadStudentList: async () => {
        app.navigateTo('studentListPage');
        const tbody = document.getElementById('studentListBody');
        tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4">Loading...</td></tr>';

        try {
            const res = await fetch(`${API_BASE}/students/${app.currentSemester}`);
            const data = await res.json();

            tbody.innerHTML = '';
            if (data.success && data.students.length > 0) {
                data.students.forEach(student => {
                    const resultClass = student.result === 'PASS' ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' : 'text-rose-400 bg-rose-500/10 border-rose-500/20';
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td class="px-8 py-5 whitespace-nowrap text-sm text-cyan-400 font-mono tracking-wider">${student.regNo}</td>
                        <td class="px-8 py-5 whitespace-nowrap text-sm text-white font-bold tracking-wide">${student.name}</td>
                        <td class="px-8 py-5 text-center text-sm text-slate-400 font-mono">
                            <span class="px-2 py-1 rounded bg-white/5 border border-white/10">${student.subjects ? student.subjects.length : '0'} Nodes</span>
                        </td>
                        <td class="px-8 py-5 text-center text-sm text-slate-300 font-mono">${student.totalMarks || '-'}</td>
                        <td class="px-8 py-5 text-center whitespace-nowrap text-xs font-black">
                            <span class="px-2 py-1 rounded border ${resultClass}">${student.result || 'N/A'}</span>
                        </td>
                        <td class="px-8 py-5 whitespace-nowrap text-right text-sm font-bold">
                            ${student.marksheetPath ? `
                            <a href="${student.marksheetPath}" target="_blank" class="text-purple-400 hover:text-purple-300 mr-5 transition-colors"><i class="fas fa-file-alt"></i> View Marksheet</a>
                            ` : ''}
                            <button onclick="app.viewStudent('${student.id}')" class="text-cyan-400 hover:text-cyan-300 mr-5 transition-colors"><i class="fas fa-eye"></i> Analysis</button>
                            <button onclick="app.editStudent('${student.id}')" class="text-indigo-400 hover:text-indigo-300 mr-5 transition-colors"><i class="fas fa-edit"></i> Edit</button>
                            <button onclick="app.deleteStudent('${student.id}')" class="text-rose-400 hover:text-rose-300 transition-colors"><i class="fas fa-trash-alt"></i> Purge</button>
                        </td>
                    `;
                    tbody.appendChild(tr);
                });
            } else {
                tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-gray-500">No students found.</td></tr>';
            }
        } catch (err) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-red-500">Error loading data.</td></tr>';
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
                    const maxTotal = overallMax + 25;

                    // Result Logic - THE ULTIMATE DATA MIRROR (ADMIN VIEW)
                    const statusText = (sub.result || "").toString().trim().toUpperCase();
                    const isFail = statusText.startsWith("F");
                    const statusClass = isFail ? "text-rose-400 bg-rose-500/10 border-rose-500/20" : "text-emerald-400 bg-emerald-500/10 border-emerald-500/20";

                    const tr = document.createElement('tr');
                    tr.className = 'hover:bg-white/[0.02] transition-colors';
                    tr.innerHTML = `
                        <td class="px-6 py-5 whitespace-nowrap text-sm font-bold text-white tracking-wide">${sub.name}</td>
                        <td class="px-6 py-5 whitespace-nowrap text-sm">
                             <span class="px-2.5 py-1 text-[9px] font-black rounded border border-white/10 ${paperType === 'CORE' ? 'bg-indigo-500/20 text-indigo-300' : (paperType === 'PRAC' || paperType === 'PRACTICAL' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-500/20 text-slate-300')} tracking-widest uppercase">
                                ${paperType === 'NON' ? 'NON' : (paperType === 'CORE' ? 'COR' : paperType.substring(0, 3).toUpperCase())}
                             </span>
                        </td>
                        <td class="px-6 py-5 whitespace-nowrap text-sm text-slate-300 text-center font-mono">${maxTotal}</td>
                        <td class="px-6 py-5 whitespace-nowrap text-sm text-slate-300 text-center font-mono">${internal}</td>
                        <td class="px-6 py-5 whitespace-nowrap text-sm text-cyan-400 text-center font-bold font-mono">${external}</td>
                        <td class="px-6 py-5 whitespace-nowrap text-sm text-white text-center font-black font-mono shadow-[0_0_10px_rgba(255,255,255,0.1)]">${total}</td>
                        <td class="px-6 py-5 whitespace-nowrap text-sm font-black text-center">
                            <span class="px-4 py-1.5 rounded-lg border text-[10px] tracking-widest shadow-lg ${statusClass}">${statusText || '—'}</span>
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
        const name = document.getElementById('editName').value.trim();
        const regNo = document.getElementById('editRegNo').value.trim();
        const subjects = app.collectSubjects('editSubjectsContainer');

        if (!name || !regNo) {
            app.showToast('Name and Register Number are required', 'error');
            return;
        }

        if (!subjects || subjects.length === 0) {
            if (!subjects) return; // Error handled
            app.showToast('Please add at least one subject', 'error');
            return;
        }

        try {
            console.log(`Updating student record for ${name} (${regNo})...`);
            const res = await fetch(`${API_BASE}/students/${app.currentSemester}/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, regNo, subjects })
            });
            const data = await res.json();

            if (data.success) {
                console.log('Update successful!');
                app.showToast('Student Updated Successfully', 'success');
                app.loadStudentList();
            } else {
                console.warn('Update failed:', data.message);
                app.showToast(data.message, 'error');
            }
        } catch (err) {
            console.error('Network error during update:', err);
            app.showToast('Update failed', 'error');
        }
    },

    // --- Student Functions ---
    handleStudentLogin: async (e) => {
        e.preventDefault();
        const name = document.getElementById('studentLoginName').value.trim();
        const regNo = document.getElementById('studentLoginRegNo').value.trim();

        if (!name || !regNo) {
            app.showToast('Please enter both name and register number', 'error');
            return;
        }

        try {
            const res = await fetch(`${API_BASE}/student/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, regNo })
            });
            const data = await res.json();

            if (data.success) {
                app.currentStudentRegNo = data.regNo;
                app.availableSemesters = data.availableSemesters || [];
                document.getElementById('welcomeStudentName').textContent = data.studentName;

                // Highlight semesters that have data
                app.highlightAvailableSemesters();

                app.navigateTo('studentSemesterSelect');
                app.showToast('Login Successful', 'success');
            } else {
                app.showToast(data.message || 'Login failed', 'error');
            }
        } catch (err) {
            app.showToast('Unable to connect to server', 'error');
            console.error('Login Error:', err);
        }
    },

    highlightAvailableSemesters: () => {
        const semesterButtons = document.querySelectorAll('#studentSemesterSelect .sem-btn');
        semesterButtons.forEach(btn => {
            const onclickAttr = btn.getAttribute('onclick');
            if (onclickAttr && onclickAttr.includes('viewMarksheet')) {
                const semesterId = onclickAttr.match(/'([^']+)'/)[1];
                const label = btn.querySelector('.sem-label');
                if (app.availableSemesters.includes(semesterId)) {
                    btn.classList.add('border-cyan-400');
                    btn.classList.remove('border-white/10');
                    if (label) {
                        label.textContent = 'Data Available';
                        label.classList.remove('text-slate-400');
                        label.classList.add('text-cyan-400');
                    }
                } else {
                    btn.classList.remove('border-cyan-400');
                    btn.classList.add('border-white/10');
                    if (label) {
                        label.textContent = 'Data Semester';
                        label.classList.remove('text-cyan-400');
                        label.classList.add('text-slate-400');
                    }
                }
            }
        });
    },

    viewMarksheet: async (semesterId) => {
        try {
            console.log(`Fetching marksheet for ${semesterId}...`);
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

                    // Result Logic - THE ULTIMATE DATA MIRROR
                    // We remove ALL logic here. If the DB has "P.", show "P.".
                    // No more mapping to "PASS" or "FAIL" words unless that's what's in the DB.
                    const statusText = (sub.result || "").toString().trim().toUpperCase();

                    // Simple loose check for visual color only (F = Fail)
                    const isFail = statusText.startsWith("F");
                    const statusClass = isFail ? "bg-rose-500/10 text-rose-400 border-rose-500/20" : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";

                    if (isFail) hasFail = true;

                    // Calculation Logic for Overall Total: Count everything except 'NON' paper types for percentage
                    if (paperType !== 'NON') {
                        totalObtained += subTotal;
                        totalMax += subMaxTotal;
                    }

                    const tr = document.createElement('tr');
                    tr.className = 'border-b border-white/5 hover:bg-white/[0.02] transition-colors';
                    tr.innerHTML = `
                        <td class="text-left py-5 pl-8 text-white font-bold tracking-wide text-sm whitespace-nowrap">${sub.name}</td>
                        <td class="text-left py-5 px-6">
                            <span class="text-[9px] font-black px-2.5 py-1 rounded border ${paperType === 'CORE' ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30' : (paperType === 'PRAC' || paperType === 'PRACTICAL' || paperType === 'PRAC' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'bg-slate-500/20 text-slate-400 border-slate-500/30')} tracking-widest uppercase">
                                ${paperType === 'NON' ? 'NON' : (paperType === 'CORE' ? 'COR' : paperType.substring(0, 3).toUpperCase())}
                            </span>
                        </td>
                        <td class="text-center py-5 text-slate-400 font-mono text-xs font-bold">${subMaxTotal}</td>
                        <td class="text-center py-5 text-slate-300 font-mono text-sm">${internal}</td>
                        <td class="text-center py-5 text-slate-300 font-mono text-sm">${external}</td>
                        <td class="text-center py-5 font-black text-white font-mono text-base">${subTotal}</td>
                        <td class="text-center py-5 pr-8">
                            <span class="inline-block px-4 py-1.5 rounded-lg border font-black text-[10px] tracking-[0.2em] shadow-lg ${statusClass}">
                                ${statusText || '—'}
                            </span>
                        </td>
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
                app.showToast(data.message || 'No record found for this semester', 'error');
            }
        } catch (err) {
            console.error('Fetch Marksheet Error:', err);
            app.showToast('Error fetching marksheet data', 'error');
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
    },

    // --- Marksheet Upload & Extraction ---
    handleMarksheetFileSelect: (e) => {
        const file = e.target.files[0];
        if (!file) return;
        app._handleMarksheetFile(file);
    },

    handleMarksheetFileDrop: (e) => {
        const file = e.dataTransfer.files[0];
        if (!file) return;
        app._handleMarksheetFile(file);
    },

    _handleMarksheetFile: (file) => {
        if (file.size > 10 * 1024 * 1024) {
            app.showToast('File size exceeds 10MB limit', 'error');
            return;
        }
        // Store file globally
        app._currentMarksheetFile = file;

        document.getElementById('fileName').textContent = file.name;
        document.getElementById('fileSize').textContent = (file.size / 1024).toFixed(1) + ' KB';
        document.getElementById('fileInfo').classList.remove('hidden');

        // Show preview in step 1
        const reader = new FileReader();
        reader.onload = (ev) => {
            const prev1 = document.getElementById('uploadPreviewImg1');
            const wrap1 = document.getElementById('uploadImagePreview1');
            if (prev1 && wrap1) {
                prev1.src = ev.target.result;
                wrap1.classList.remove('hidden');
            }
            // Also pre-store for step 2
            app._currentMarksheetDataUrl = ev.target.result;
        };
        reader.readAsDataURL(file);
    },

    processMarksheet: async () => {
        const fileInput = document.getElementById('marksheetFile');
        const file = app._currentMarksheetFile || (fileInput.files && fileInput.files[0]);
        if (!file) {
            app.showToast('Please select a file first', 'error');
            return;
        }

        // Hide step 1, show loader
        document.getElementById('uploadStep1').classList.add('hidden');
        document.getElementById('extractionLoader').classList.remove('hidden');
        document.getElementById('uploadStep2').classList.add('hidden');

        // Animate circular progress
        let pct = 5;
        const progressCircle = document.getElementById('ocrProgressCircle');
        const progressText = document.getElementById('ocrProgressText');
        const percentText = document.getElementById('ocrPercentVal');

        const setProgress = (percent) => {
            if (!progressCircle) return;
            const radius = progressCircle.r.baseVal.value;
            const circumference = radius * 2 * Math.PI;
            const offset = circumference - (percent / 100 * circumference);
            progressCircle.style.strokeDasharray = `${circumference} ${circumference}`;
            progressCircle.style.strokeDashoffset = offset;
            if (percentText) percentText.textContent = Math.round(percent) + '%';
        };

        const progressInterval = setInterval(() => {
            pct = Math.min(pct + Math.random() * 8, 92);
            setProgress(pct);
            if (progressText) {
                if (pct < 20) progressText.textContent = 'Engaging neural OCR core...';
                else if (pct < 50) progressText.textContent = 'Mapping data topologies...';
                else if (pct < 75) progressText.textContent = 'Resolving matrix nodes...';
                else progressText.textContent = 'Finalizing structural analysis...';
            }
        }, 800);

        const formData = new FormData();
        formData.append('marksheet', file);

        try {
            const res = await fetch(`${API_BASE}/extract-marksheet`, {
                method: 'POST',
                body: formData
            });
            const data = await res.json();

            clearInterval(progressInterval);
            setProgress(100);

            setTimeout(() => {
                document.getElementById('extractionLoader').classList.add('hidden');
            }, 600);

            if (data.success) {
                // Update confidence metrics
                const confPercent = data.confidence || 0;
                document.getElementById('confidenceBar').style.width = confPercent + '%';
                document.getElementById('confidencePercent').textContent = confPercent + '%';

                // Color bar based on confidence
                const bar = document.getElementById('confidenceBar');
                if (confPercent < 50) bar.className = 'h-full bg-rose-500 transition-all duration-1000';
                else if (confPercent < 75) bar.className = 'h-full bg-amber-500 transition-all duration-1000';
                else bar.className = 'h-full bg-emerald-500 transition-all duration-1000';

                // Show image in step 2
                const previewImg = document.getElementById('uploadedMarksheetPreview');
                if (previewImg && app._currentMarksheetDataUrl) {
                    previewImg.src = app._currentMarksheetDataUrl;
                }
                // Show raw OCR text
                const rawEl = document.getElementById('rawOcrText');
                if (rawEl) rawEl.textContent = data.rawText || '(No text extracted)';

                // Show OCR confidence warning if low
                const warn = document.getElementById('lowConfidenceWarning');
                const warnText = document.getElementById('lowConfidenceText');
                if (data.warning && warn && warnText) {
                    warnText.textContent = data.warning;
                    warn.classList.remove('hidden');
                } else if (warn) {
                    warn.classList.add('hidden');
                }

                app._currentMarksheetRemotePath = data.marksheetPath;

                if (data.ai_status) {
                    const badge = document.getElementById('ocrEngineBadge');
                    if (badge) {
                        badge.textContent = data.ai_status;
                        badge.classList.remove('text-cyan-400', 'text-amber-400');
                        badge.classList.add(data.ai_status.includes('Active') ? 'text-cyan-400' : 'text-amber-400');
                    }
                    app.showToast(data.ai_status, data.ai_status.includes('Active') ? 'success' : 'info');
                }

                console.log('[App] Extracted Data received:', data.data);
                app.displayExtractedData(data.data);
                document.getElementById('uploadStep2').classList.remove('hidden');
            } else {
                app.showToast(data.message || 'Extraction failed', 'error');
                document.getElementById('uploadStep1').classList.remove('hidden');
            }
        } catch (err) {
            clearInterval(progressInterval);
            console.error(err);
            app.showToast('Connection error — please try again', 'error');
            document.getElementById('extractionLoader').classList.add('hidden');
            document.getElementById('uploadStep1').classList.remove('hidden');
        }
    },

    displayExtractedData: (data) => {
        // Map new server JSON keys → form fields
        document.getElementById('extractedName').value = data.student_name || data.name || '';
        document.getElementById('extractedRegNo').value = data.register_number || data.regNo || '';
        document.getElementById('extractedTotalMarks').value = data.total_marks || '';

        const resultSel = document.getElementById('extractedOverallResult');
        if (resultSel) resultSel.value = data.result || '';

        // Add confidence highlighting
        const highlights = ['extractedName', 'extractedRegNo', 'extractedTotalMarks'];
        const isLow = (data.confidence || 100) < 65;
        highlights.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.classList.remove('confidence-low', 'confidence-high');
            if (el) el.classList.add(isLow ? 'confidence-low' : 'confidence-high');
        });

        const container = document.getElementById('extractedSubjectsContainer');
        container.innerHTML = '';

        const hint = document.getElementById('noSubjectsHint');

        if (data.subjects && data.subjects.length > 0) {
            data.subjects.forEach(sub => app.addExtractedSubjectRow(sub));
            if (hint) hint.classList.add('hidden');
            const nameVal = (data.student_name || data.name) ? `"${data.student_name || data.name}"` : 'student';
            app.showToast(`Extracted ${data.subjects.length} subject(s) for ${nameVal}`, 'success');
        } else {
            app.addExtractedSubjectRow();
            if (hint) hint.classList.remove('hidden');
            app.showToast('No subjects auto-detected — check raw OCR text and fill manually', 'info');
        }
    },

    // Enhanced 4-column subject row for OCR upload context (Subject, Type, Marks, Result)
    addExtractedSubjectRow: (initialData = null) => {
        const container = document.getElementById('extractedSubjectsContainer');
        if (!container) return;

        const subjectName = (initialData && (initialData.subject || initialData.name)) ? (initialData.subject || initialData.name) : '';
        const marks = (initialData && (initialData.marks !== undefined || initialData.mark !== undefined))
            ? (initialData.marks !== undefined ? initialData.marks : initialData.mark)
            : '';
        const result = (initialData && initialData.result) ? initialData.result : 'PASS';
        const paperType = (initialData && (initialData.paper_type || initialData.paperType)) ? (initialData.paper_type || initialData.paperType).toUpperCase() : 'NON';

        const div = document.createElement('div');
        div.className = 'grid grid-cols-[1fr_100px_100px_100px_40px] gap-3 items-center extracted-subject-row mb-3';
        div.innerHTML = `
            <input type="text" placeholder="Subject name (e.g. Mathematics)"
                class="extracted-subject-name w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-all text-sm font-bold"
                value="${subjectName}">
            
            <select class="extracted-subject-type w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-slate-300 transition-all text-[10px] font-bold text-center">
                <option value="CORE" ${paperType === 'CORE' ? 'selected' : ''}>CORE</option>
                <option value="ALLIED" ${paperType === 'ALLIED' ? 'selected' : ''}>ALLIED</option>
                <option value="PRACTICAL" ${paperType === 'PRACTICAL' ? 'selected' : ''}>PRAC</option>
                <option value="NON" ${paperType === 'NON' ? 'selected' : ''}>NON</option>
            </select>

            <input type="number" min="0" placeholder="Marks"
                class="extracted-subject-marks w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-all text-sm text-center font-mono font-bold"
                value="${marks}">
            
            <select class="extracted-subject-result w-full bg-slate-900 border border-slate-700 rounded-xl p-3 font-bold transition-all text-sm ${result.startsWith('P') ? 'text-emerald-400' : 'text-rose-400'}"
                onchange="this.className = 'extracted-subject-result w-full bg-slate-900 border border-slate-700 rounded-xl p-3 font-bold transition-all text-sm ' + (this.value.startsWith('P') ? 'text-emerald-400' : 'text-rose-400')">
                <option value="PASS" ${result === 'PASS' ? 'selected' : ''} style="color:#34d399">PASS</option>
                <option value="FAIL" ${result === 'FAIL' ? 'selected' : ''} style="color:#f87171">FAIL</option>
                <option value="P." ${result === 'P.' ? 'selected' : ''} style="color:#34d399">P.</option>
            </select>
            
            <button type="button" onclick="this.parentElement.remove()" class="w-8 h-8 rounded-lg bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 transition flex items-center justify-center">
                <i class="fas fa-trash-alt text-xs"></i>
            </button>
        `;
        container.appendChild(div);
    },

    recalculateTotal: () => {
        const container = document.getElementById('extractedSubjectsContainer');
        const rows = container.querySelectorAll('.extracted-subject-row');
        let total = 0;
        let allPass = true;

        rows.forEach(row => {
            const markInput = row.querySelector('.extracted-subject-marks');
            const resultSelect = row.querySelector('.extracted-subject-result');
            const val = parseInt(markInput.value || 0);
            total += val;
            if (resultSelect && resultSelect.value === 'FAIL') allPass = false;
        });

        document.getElementById('extractedTotalMarks').value = total;
        const resultSel = document.getElementById('extractedOverallResult');
        if (resultSel && !resultSel.value) {
            resultSel.value = allPass ? 'PASS' : 'FAIL';
        }
        app.showToast(`Recalculated: Total sum is ${total}`, 'info');
    },

    cancelUpload: () => {
        document.getElementById('uploadStep2').classList.add('hidden');
        document.getElementById('extractionLoader').classList.add('hidden');
        document.getElementById('uploadStep1').classList.remove('hidden');
        document.getElementById('marksheetFile').value = '';
        document.getElementById('fileInfo').classList.add('hidden');
        const wrap1 = document.getElementById('uploadImagePreview1');
        if (wrap1) wrap1.classList.add('hidden');
        app._currentMarksheetFile = null;
        app._currentMarksheetDataUrl = null;
        app.navigateTo('adminDashboard');
    },

    saveExtractedData: async () => {
        const name = document.getElementById('extractedName').value.trim();
        const regNo = document.getElementById('extractedRegNo').value.trim();

        if (!name || !regNo) {
            app.showToast('Student Name and Register Number are required', 'error');
            return;
        }

        // Collect rows from the simplified extracted subject rows
        const container = document.getElementById('extractedSubjectsContainer');
        const rows = container.querySelectorAll('.extracted-subject-row');
        const subjects = [];
        let rowError = null;

        rows.forEach(row => {
            if (rowError) return;
            const subjectName = (row.querySelector('.extracted-subject-name').value || '').trim();
            const paperType = row.querySelector('.extracted-subject-type').value;
            const marks = row.querySelector('.extracted-subject-marks').value;
            const result = row.querySelector('.extracted-subject-result').value;

            if (!subjectName) { rowError = 'Subject name cannot be empty'; return; }
            if (marks === '' || isNaN(parseInt(marks))) { rowError = `Marks for "${subjectName}" must be a valid number`; return; }

            // Map to the format the server/DB expects
            subjects.push({
                name: subjectName,
                mark: parseInt(marks),
                paper_type: paperType,
                overall_max_marks: 75, // Default for BU
                internal_marks: 0,
                result
            });
        });

        if (rowError) { app.showToast(rowError, 'error'); return; }
        if (subjects.length === 0) { app.showToast('Please add at least one subject row', 'error'); return; }

        const totalMarks = document.getElementById('extractedTotalMarks').value.trim();
        const overallResult = document.getElementById('extractedOverallResult').value;
        const marksheetPath = app._currentMarksheetRemotePath || '';

        try {
            console.log(`Saving to semester: ${app.currentSemester}, ${subjects.length} subjects`);
            const res = await fetch(`${API_BASE}/students/${app.currentSemester}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, regNo, subjects, totalMarks, result: overallResult, marksheetPath })
            });
            const data = await res.json();

            if (data.success) {
                app.showToast('✅ Student record saved to database!', 'success');
                app.loadStudentList();
                // Reset UI
                document.getElementById('uploadStep2').classList.add('hidden');
                document.getElementById('uploadStep1').classList.remove('hidden');
                document.getElementById('marksheetFile').value = '';
                document.getElementById('fileInfo').classList.add('hidden');
                const wrap1 = document.getElementById('uploadImagePreview1');
                if (wrap1) wrap1.classList.add('hidden');
                app._currentMarksheetFile = null;
                app._currentMarksheetDataUrl = null;
            } else {
                app.showToast(data.message || 'Save failed', 'error');
            }
        } catch (err) {
            console.error(err);
            app.showToast('Connection failed — please try again', 'error');
        }
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
