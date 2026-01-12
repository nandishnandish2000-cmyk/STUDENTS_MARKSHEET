const http = require('http');

http.get('http://localhost:3000/api/students/semester_1', (res) => {
    let body = '';
    res.on('data', chunk => body += chunk);
    res.on('end', () => {
        try {
            const data = JSON.parse(body);
            if (data.success && data.students.length > 0) {
                console.log('Sample Student Subject:', JSON.stringify(data.students[0].subjects[0], null, 2));
            } else {
                console.log('No students found or failed.');
            }
        } catch (e) {
            console.error('Error parsing JSON:', e);
        }
    });
});
