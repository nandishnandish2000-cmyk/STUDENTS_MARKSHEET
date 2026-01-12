const http = require('http');

console.log('Starting View Student Repro...');
const regNo = "TEST_VIEW_001";
const initialData = JSON.stringify({
    name: "View Test Student",
    regNo: regNo,
    subjects: [
        { name: "View Subject", mark: 60, paper_type: "CORE", overall_max_marks: 75, internal_marks: 15 }
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

        // 2. Fetch List to simulate View Logic
        console.log('Fetching list...');
        const list = await request('GET', '/api/students/semester_1');
        const student = list.students.find(s => s.regNo === regNo);

        if (!student) throw new Error('Student not found after add');
        console.log('Student found:', student.id);

        // 3. Verify Data Availability for View
        // The viewStudent function uses the list data effectively (or re-fetches it).
        // We verify that the API provides all necessary fields for display.
        const sub = student.subjects[0];
        console.log('Subject Data for View:', sub);

        if (sub.paper_type === 'CORE' && sub.internal_marks === 15 && sub.overall_max_marks === 75) {
            console.log('PASS: Data available for View Page.');
        } else {
            console.error('FAIL: Data missing or incorrect');
        }

        // Cleanup
        // await request('DELETE', `/api/students/semester_1/${student.id}`);

    } catch (e) {
        console.error('Error:', e);
    }
})();
