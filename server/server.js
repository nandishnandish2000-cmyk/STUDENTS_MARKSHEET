require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const morgan = require('morgan');
const multer = require('multer');
const Tesseract = require('tesseract.js');
const fs = require('fs');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// Configure Multer for Marksheet Uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, '../uploads');
        if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage });

// ... existing logic ...

// --- Helper: Marksheet Text Parsing ---
function parseMarksheetText(text) {
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 2);
    const data = {
        name: '',
        regNo: '',
        subjects: []
    };

    console.log("Analyzing extracted text matrix...");

    // 1. Extract Name
    const namePatterns = [
        /(?:NAME OF THE EXAMINEE|CANDIDATE NAME|STUDENT NAME|NAME)[:\s]+([A-Z\s.]+)/i,
        /^(?:NAME|CANDIDATE)\s*[:\s].*$/im
    ];
    for (const pat of namePatterns) {
        const match = text.match(pat);
        if (match && match[1]) {
            data.name = match[1].trim();
            break;
        }
    }

    // 2. Extract Register Number
    const regPatterns = [
        /(?:REGISTER NUMBER|REG\.? NO|ROLL NO|ENROLLMENT|MATRIX ID)[:\s]+([A-Z0-9]+)/i,
        /\b[0-9]{2}[A-Z]{3}[0-9]{3}\b/ // Common format like 18MER013
    ];
    for (const pat of regPatterns) {
        const match = text.match(pat);
        if (match) {
            data.regNo = (match[1] || match[0]).trim();
            break;
        }
    }

    // 3. Extract Subjects and Marks
    // We look for patterns like: "ENGLISH 25 60 PASS" or "MATHEMATICS CORE 75 10 50"
    for (const line of lines) {
        // Skip header lines
        if (/semester|marksheet|result|statement|examinee|register/i.test(line)) continue;

        // Pattern 1: [Subject] [Int] [Ext] [Result]
        const pattern1 = line.match(/^([A-Za-z\s]+)\s+(\d{1,2})\s+(\d{1,3})\s+(PASS|FAIL|P|F|E)\b/i);
        if (pattern1) {
            data.subjects.push({
                name: pattern1[1].trim(),
                paper_type: 'CORE',
                overall_max_marks: 75,
                internal_marks: parseInt(pattern1[2]),
                mark: parseInt(pattern1[3])
            });
            continue;
        }

        // Pattern 2: [Subject] [Mark] [Result] (Less detailed)
        const pattern2 = line.match(/^([A-Za-z\s]+)\s+(\d{2,3})\s+(PASS|FAIL|P|F|E)\b/i);
        if (pattern2) {
            data.subjects.push({
                name: pattern2[1].trim(),
                paper_type: 'CORE',
                overall_max_marks: 75,
                internal_marks: 0,
                mark: parseInt(pattern2[2])
            });
        }
    }

    return data;
}

// Middleware
app.use(cors());
app.use(morgan('dev'));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '..')));

// Admin Credentials
const ADMIN_CREDENTIALS = {
    username: (process.env.ADMIN_USERNAME || 'Nandish').trim(),
    password: (process.env.ADMIN_PASSWORD || 'Nandish_16_').trim()
};

// --- API Endpoints ---

// 1. Admin Login
app.post('/api/admin/login', (req, res) => {
    const { username, password } = req.body;

    const inputUser = (username || '').trim();
    const inputPass = (password || '').trim();

    console.log(`Admin login attempt: ${inputUser}`);

    if (inputUser.toLowerCase() === ADMIN_CREDENTIALS.username.toLowerCase() && inputPass === ADMIN_CREDENTIALS.password) {
        console.log('Admin login successful');
        res.json({ success: true, message: 'Login successful' });
    } else {
        console.warn('Admin login failed');
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
    let { name, regNo, subjects } = req.body;

    if (!name || !regNo || !subjects || !Array.isArray(subjects)) {
        return res.status(400).json({ success: false, message: 'Invalid student data.' });
    }

    // Clean data before saving
    name = name.trim();
    regNo = regNo.trim();

    try {
        // Check if student exists in this semester (Case-insensitive check)
        const [existing] = await db.query(
            'SELECT * FROM students WHERE LOWER(TRIM(reg_no)) = LOWER(?) AND semester = ?',
            [regNo, semester]
        );

        if (existing.length > 0) {
            return res.status(400).json({ success: false, message: 'Student with this Register Number already exists in this semester' });
        }

        const uuid = Date.now().toString();
        const [result] = await db.query(
            'INSERT INTO students (uuid, name, reg_no, semester) VALUES (?, ?, ?, ?)',
            [uuid, name, regNo, semester]
        );
        const studentId = result.insertId;

        // Insert subjects
        for (const sub of subjects) {
            await db.query(
                'INSERT INTO marks (student_id, subject_name, mark, paper_type, overall_max_marks, internal_marks) VALUES (?, ?, ?, ?, ?, ?)',
                [studentId, sub.name.trim(), sub.mark, sub.paper_type || 'CORE', sub.overall_max_marks || 75, sub.internal_marks || 0]
            );
        }

        console.log(`Successfully added student: ${name} (${regNo}) to ${semester}`);
        res.json({ success: true, message: 'Student added successfully' });
    } catch (err) {
        console.error('Error adding student:', err);
        res.status(500).json({
            success: false,
            message: 'Database error: ' + (err.sqlMessage || err.message || 'Unknown error'),
            details: err.code === 'ER_DUP_ENTRY' ? 'Duplicate record detected' : undefined
        });
    }
});

// 4. Update Student
app.put('/api/students/:semester/:uuid', async (req, res) => {
    const { semester, uuid } = req.params;
    let { name, regNo, subjects } = req.body;

    name = name.trim();
    regNo = regNo.trim();

    try {
        const [students] = await db.query('SELECT id FROM students WHERE uuid = ?', [uuid]);
        if (students.length === 0) return res.status(404).json({ success: false, message: 'Student not found' });

        const studentId = students[0].id;

        // Check for duplicate RegNo in the same semester (excluding this student)
        const [duplicate] = await db.query(
            'SELECT * FROM students WHERE LOWER(TRIM(reg_no)) = LOWER(?) AND semester = ? AND uuid != ?',
            [regNo, semester, uuid]
        );
        if (duplicate.length > 0) return res.status(400).json({ success: false, message: 'Register Number already exists in this semester' });

        // Update student info
        await db.query('UPDATE students SET name = ?, reg_no = ? WHERE id = ?', [name, regNo, studentId]);

        // Replace subjects (Delete and Re-insert)
        await db.query('DELETE FROM marks WHERE student_id = ?', [studentId]);
        for (const sub of subjects) {
            await db.query(
                'INSERT INTO marks (student_id, subject_name, mark, paper_type, overall_max_marks, internal_marks) VALUES (?, ?, ?, ?, ?, ?)',
                [studentId, sub.name.trim(), sub.mark, sub.paper_type || 'CORE', sub.overall_max_marks || 75, sub.internal_marks || 0]
            );
        }

        console.log(`Successfully updated student: ${name} (${regNo})`);
        res.json({ success: true, message: 'Student updated successfully' });
    } catch (err) {
        console.error('Error updating student:', err);
        res.status(500).json({ success: false, message: 'Database error while updating student' });
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

// 6. Student Login (Check if student exists in ANY semester)
app.post('/api/student/login', async (req, res) => {
    const { name, regNo } = req.body;
    if (!name || !regNo) {
        return res.status(400).json({ success: false, message: 'Please enter both name and register number' });
    }

    const trimmedName = name.trim();
    const trimmedRegNo = regNo.trim();

    try {
        console.log(`Student login attempt: Name="${trimmedName}", RegNo="${trimmedRegNo}"`);

        // Search for student across ALL semesters
        const [students] = await db.query(
            'SELECT DISTINCT name, reg_no, semester FROM students WHERE LOWER(TRIM(name)) = LOWER(?) AND LOWER(TRIM(reg_no)) = LOWER(?)',
            [trimmedName, trimmedRegNo]
        );

        if (students.length > 0) {
            const availableSemesters = students.map(s => s.semester);
            console.log(`Login successful for ${students[0].name}. Available semesters:`, availableSemesters);

            res.json({
                success: true,
                message: 'Login successful',
                studentName: students[0].name,
                regNo: students[0].reg_no,
                availableSemesters: availableSemesters
            });
        } else {
            console.warn(`Login failed for Name="${trimmedName}", RegNo="${trimmedRegNo}"`);
            res.status(401).json({ success: false, message: 'No record found with these details. Please check your Name and Register Number.' });
        }
    } catch (err) {
        console.error('Login Error:', err);
        res.status(500).json({ success: false, message: 'Internal server error occurred during login' });
    }
});

// 8. Get Overall Data for all Semesters
app.get('/api/student/overall/:regNo', async (req, res) => {
    const regNo = req.params.regNo.trim();
    try {
        console.log(`Fetching overall data for RegNo: ${regNo}`);
        const [students] = await db.query(
            'SELECT * FROM students WHERE LOWER(TRIM(reg_no)) = LOWER(?) ORDER BY semester ASC',
            [regNo]
        );

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
            res.status(404).json({ success: false, message: 'No records found for this student ID' });
        }
    } catch (err) {
        console.error('Overall Data Error:', err);
        res.status(500).json({ success: false, message: 'Internal server error while fetching overall data' });
    }
});

// 7. Get Single Student Data (for Student Portal)
app.get('/api/student/:semester/:regNo', async (req, res) => {
    const semester = req.params.semester.trim();
    const regNo = req.params.regNo.trim();
    try {
        console.log(`Fetching specific marksheet: Sem=${semester}, RegNo=${regNo}`);
        const [students] = await db.query(
            'SELECT * FROM students WHERE LOWER(TRIM(reg_no)) = LOWER(?) AND LOWER(TRIM(semester)) = LOWER(?)',
            [regNo, semester]
        );
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
            res.status(404).json({ success: false, message: `No record found for Semester: ${semester.replace('_', ' ')}` });
        }
    } catch (err) {
        console.error('Student Marksheet Error:', err);
        res.status(500).json({ success: false, message: 'Internal server error while fetching marksheet' });
    }
});


// 9. Extract Marksheet Data via OCR
app.post('/api/extract-marksheet', upload.single('marksheet'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const filePath = req.file.path;
    console.log(`[OCR] Incoming file: ${req.file.originalname} -> ${filePath}`);

    try {
        const { data: { text } } = await Tesseract.recognize(filePath, 'eng', {
            logger: m => console.log(`[OCR Status] ${m.status}: ${Math.round(m.progress * 100)}%`)
        });

        const extractedData = parseMarksheetText(text);

        // Clean up temp file
        fs.unlinkSync(filePath);

        res.json({
            success: true,
            message: 'Image decoded successfully',
            data: extractedData,
            rawText: text // Useful for debugging
        });
    } catch (err) {
        console.error('[OCR Error]', err);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        res.status(500).json({ success: false, message: 'Neural matrix extraction failed', error: err.message });
    }
});

// Connection Test
db.query('SELECT 1').then(() => {
    console.log('Database connected successfully');
}).catch(err => {
    console.error('Database connection failed:', err);
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
