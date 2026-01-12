const http = require('http');

console.log('Starting Add/Edit Repro...');
const regNo = "TEST_EDIT_001";
const initialData = JSON.stringify({
    name: "Edit Test Student",
    regNo: regNo,
    subjects: [
        { name: "Initial Subject", mark: 50, paper_type: "CORE", overall_max_marks: 75, internal_marks: 10 }
    ]
});

// Helper for requests
function request(method, path, data = null) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'localhost',
            port: 3000,
            path: path,
            method: method,
            headers: { 'Content-Type': 'application/json' }
        };
        if (data) options.headers['Content-Length'] = data.length;

        const req = http.request(options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => resolve(JSON.parse(body || '{}')));
        });
        if (data) req.write(data);
        req.end();
    });
}

(async () => {
    try {
        // 1. Add Student
        console.log('Adding student...');
        await request('POST', '/api/students/semester_1', initialData);

        // 2. Fetch List (Simulate loading list)
        console.log('Fetching list...');
        const list = await request('GET', '/api/students/semester_1');
        const student = list.students.find(s => s.regNo === regNo);

        if (!student) throw new Error('Student not found after add');
        console.log('Student found:', student.id);

        // 3. Simulate Edit (Frontend Logic Check)
        // Check if subject data is correct for form population
        const sub = student.subjects[0];
        console.log('Subject Data for Form:', sub);
        if (sub.paper_type !== 'CORE' || sub.mark !== 50) {
            throw new Error('Initial data incorrect');
        }

        // 4. Update Student
        console.log('Updating student...');
        const updatedData = JSON.stringify({
            name: "Edit Test Student Updated",
            regNo: regNo,
            subjects: [
                { name: "Updated Subject", mark: 80, paper_type: "PRACTICAL", overall_max_marks: 50, internal_marks: 25 }
            ]
        });
        await request('PUT', `/api/students/semester_1/${student.id}`, updatedData); // Using UUID as ID

        // 5. Verify Update
        console.log('Verifying update...');
        const list2 = await request('GET', '/api/students/semester_1');
        const updatedStudent = list2.students.find(s => s.regNo === regNo);
        const updatedSub = updatedStudent.subjects[0];

        console.log('Updated details:', updatedSub);

        if (updatedSub.name === "Updated Subject" && updatedSub.paper_type === "PRACTICAL") {
            console.log('PASS: Edit flow successful.');
        } else {
            console.error('FAIL: Update mismatch');
        }

        // Cleanup
        // await request('DELETE', `/api/students/semester_1/${student.id}`);

    } catch (e) {
        console.error('Error:', e);
    }
})();
