const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const morgan = require('morgan');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(morgan('dev'));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '..')));

// Admin Credentials (Hardcoded)
const ADMIN_CREDENTIALS = {
    username: 'Nandish',
    password: 'Nandish_16_'
};

// --- API Endpoints ---

// 1. Admin Login
app.post('/api/admin/login', (req, res) => {
    const { username, password } = req.body;
    if (username === ADMIN_CREDENTIALS.username && password === ADMIN_CREDENTIALS.password) {
        res.json({ success: true, message: 'Login successful' });
    } else {
        res.status(401).json({ success: false, message: 'Entered username or password is incorrect' });
    }
});

// 2. Get Students by Semester
app.get('/api/students/:semester', async (req, res) => {
    const { semester } = req.params;
    try {
        const [students] = await db.query('SELECT * FROM students WHERE semester = ?', [semester]);

        // Fetch subjects for each student
        const studentsWithMarks = await Promise.all(students.map(async (student) => {
            const [marks] = await db.query('SELECT subject_name as name, mark, paper_type, overall_max_marks, internal_marks FROM marks WHERE student_id = ?', [student.id]);
            return {
                id: student.uuid,
                name: student.name,
                regNo: student.reg_no,
                subjects: marks
            };
        }));

        res.json({ success: true, students: studentsWithMarks });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Database error' });
    }
});

// 3. Add Student
app.post('/api/students/:semester', async (req, res) => {
    const { semester } = req.params;
    const { name, regNo, subjects } = req.body;

    if (!name || !regNo || !subjects || !Array.isArray(subjects)) {
        return res.status(400).json({ success: false, message: 'Invalid student data.' });
    }

    try {
        // Check if student exists in this semester
        const [existing] = await db.query('SELECT * FROM students WHERE reg_no = ? AND semester = ?', [regNo, semester]);
        if (existing.length > 0) {
            return res.status(400).json({ success: false, message: 'Student with this Register Number already exists' });
        }

        const uuid = Date.now().toString();
        const [result] = await db.query('INSERT INTO students (uuid, name, reg_no, semester) VALUES (?, ?, ?, ?)', [uuid, name, regNo, semester]);
        const studentId = result.insertId;

        // Insert subjects
        for (const sub of subjects) {
            await db.query('INSERT INTO marks (student_id, subject_name, mark, paper_type, overall_max_marks, internal_marks) VALUES (?, ?, ?, ?, ?, ?)', [studentId, sub.name, sub.mark, sub.paper_type || 'CORE', sub.overall_max_marks || 75, sub.internal_marks || 0]);
        }

        res.json({ success: true, message: 'Student added successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Database error' });
    }
});

// 4. Update Student
app.put('/api/students/:semester/:uuid', async (req, res) => {
    const { semester, uuid } = req.params;
    const { name, regNo, subjects } = req.body;

    try {
        const [students] = await db.query('SELECT id FROM students WHERE uuid = ?', [uuid]);
        if (students.length === 0) return res.status(404).json({ success: false, message: 'Student not found' });

        const studentId = students[0].id;

        // Check for duplicate RegNo
        const [duplicate] = await db.query('SELECT * FROM students WHERE reg_no = ? AND semester = ? AND uuid != ?', [regNo, semester, uuid]);
        if (duplicate.length > 0) return res.status(400).json({ success: false, message: 'Register Number already exists' });

        // Update student info
        await db.query('UPDATE students SET name = ?, reg_no = ? WHERE id = ?', [name, regNo, studentId]);

        // Replace subjects (Delete and Re-insert)
        await db.query('DELETE FROM marks WHERE student_id = ?', [studentId]);
        for (const sub of subjects) {
            await db.query('INSERT INTO marks (student_id, subject_name, mark, paper_type, overall_max_marks, internal_marks) VALUES (?, ?, ?, ?, ?, ?)', [studentId, sub.name, sub.mark, sub.paper_type || 'CORE', sub.overall_max_marks || 75, sub.internal_marks || 0]);
        }

        res.json({ success: true, message: 'Student updated successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Database error' });
    }
});

// 5. Delete Student
app.delete('/api/students/:semester/:uuid', async (req, res) => {
    const { uuid } = req.params;
    try {
        const [result] = await db.query('DELETE FROM students WHERE uuid = ?', [uuid]);
        if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Student not found' });
        res.json({ success: true, message: 'Student deleted successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Database error' });
    }
});

// 6. Student Login
app.post('/api/student/login', async (req, res) => {
    const { name, regNo } = req.body;
    try {
        const [students] = await db.query('SELECT * FROM students WHERE name = ? AND reg_no = ?', [name, regNo]);
        if (students.length > 0) {
            res.json({ success: true, message: 'Login successful', studentName: name, regNo: regNo });
        } else {
            res.status(401).json({ success: false, message: 'Entered details are incorrect' });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Database error' });
    }
});

// 8. Get Overall Data for all Semesters
app.get('/api/student/overall/:regNo', async (req, res) => {
    const { regNo } = req.params;
    try {
        const [students] = await db.query('SELECT * FROM students WHERE reg_no = ? ORDER BY semester ASC', [regNo]);
        if (students.length > 0) {
            const overallData = await Promise.all(students.map(async (student) => {
                const [marks] = await db.query('SELECT subject_name as name, mark, paper_type, overall_max_marks, internal_marks FROM marks WHERE student_id = ?', [student.id]);
                return {
                    semester: student.semester,
                    subjects: marks
                };
            }));
            res.json({
                success: true,
                studentName: students[0].name,
                regNo: students[0].reg_no,
                history: overallData
            });
        } else {
            res.status(404).json({ success: false, message: 'No records found for this student' });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Database error' });
    }
});

// 7. Get Single Student Data (for Student Portal)
app.get('/api/student/:semester/:regNo', async (req, res) => {
    const { semester, regNo } = req.params;
    try {
        const [students] = await db.query('SELECT * FROM students WHERE reg_no = ? AND semester = ?', [regNo, semester]);
        if (students.length > 0) {
            const student = students[0];
            const [marks] = await db.query('SELECT subject_name as name, mark, paper_type, overall_max_marks, internal_marks FROM marks WHERE student_id = ?', [student.id]);
            res.json({
                success: true,
                student: {
                    name: student.name,
                    regNo: student.reg_no,
                    subjects: marks
                }
            });
        } else {
            res.status(404).json({ success: false, message: 'No record found for this semester' });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Database error' });
    }
});


app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
