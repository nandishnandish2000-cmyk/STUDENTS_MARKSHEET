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

// --- Helper: Marksheet Text Parsing (Enhanced) ---
function parseMarksheetText(text) {
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 1);
    const data = {
        name: '',
        regNo: '',
        subjects: []
    };

    console.log("=== RAW OCR TEXT START ===");
    console.log(text);
    console.log("=== RAW OCR TEXT END ===");

    // ─── 1. Extract Student Name ─────────────────────────────────────────────
    const namePatterns = [
        /(?:name\s+of\s+(?:the\s+)?(?:examinee|student|candidate)|student\s+name|candidate\s+name|name)\s*[:\-]?\s*([A-Za-z][A-Za-z\s.]{2,50})/i,
        /(?:examinee|student)\s*[:\-]\s*([A-Za-z][A-Za-z\s.]{2,50})/i,
        /^name\s*[:\-]?\s+([A-Za-z][A-Za-z\s.]+)$/im,
    ];
    for (const pat of namePatterns) {
        const m = text.match(pat);
        if (m && m[1]) {
            // Clean: remove trailing numbers/codes
            let name = m[1].trim().replace(/\s*\d+.*$/, '').trim();
            if (name.length >= 3 && name.length <= 80) {
                data.name = name;
                break;
            }
        }
    }
    // Fallback: look line by line for "Name : XYZ"
    if (!data.name) {
        for (const line of lines) {
            const m = line.match(/^(?:name|student name|candidate)\s*[:\-]\s*(.+)$/i);
            if (m && m[1] && m[1].trim().length > 2) {
                data.name = m[1].trim().replace(/\s*\d+.*$/, '').trim();
                break;
            }
        }
    }

    // ─── 2. Extract Register / Roll Number ──────────────────────────────────
    const regPatterns = [
        /(?:register(?:ation)?\s*(?:number|no\.?)|reg(?:\.?\s*no\.?)|roll\s*(?:no\.?|number)|enrollment\s*(?:no\.?|number)|hall\s*ticket)\s*[:\-]?\s*([A-Z0-9\/\-]{4,20})/i,
        /\b([0-9]{2}[A-Z]{2,4}[0-9]{2,6})\b/,   // e.g. 21CS101, 20BCA003
        /\b([A-Z]{2,4}[0-9]{2,4}[A-Z0-9]{2,6})\b/, // e.g. CS21A001
    ];
    for (const pat of regPatterns) {
        const m = text.match(pat);
        if (m) {
            data.regNo = (m[1] || m[0]).trim();
            break;
        }
    }
    // Fallback: line-by-line
    if (!data.regNo) {
        for (const line of lines) {
            const m = line.match(/(?:reg(?:ister)?(?:ation)?\s*(?:no|number)?|roll\s*no)\s*[:\-]\s*([A-Z0-9\/\-]{4,20})/i);
            if (m && m[1]) {
                data.regNo = m[1].trim();
                break;
            }
        }
    }

    // ─── 3. Extract Subjects & Marks ─────────────────────────────────────────
    // We scan every line and try many patterns, covering most Indian university marksheet layouts.

    // Keywords to skip (header/footer lines)
    const skipKeywords = /^(semester|marksheet|result sheet|statement of marks|university|college|hall ticket|register|roll no|name of|candidate|year|branch|degree|department|date|signature|principal|controller|total|grand total|head of|percentage|cgpa|sgpa|gpa|class|division|remarks|note|legend|code|subject code|sub\.?\s*code|sl\.?\s*no|s\.no|sno|serial|subject\s+name|internal|external|max|min|obtain|theory|practical|lab|paper)$/i;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        if (skipKeywords.test(line)) continue;
        if (line.length < 3) continue;

        let subjectName = null;
        let internalMark = 0;
        let externalMark = null;
        let maxMarks = 75;
        let paperType = 'CORE';
        let result = null;

        // ── Pattern A: "Subject Name  INT  EXT  TOTAL  MAX  RESULT"
        // e.g. "MATHEMATICS  18  52  70  100  PASS"
        const patA = line.match(/^([A-Za-z][A-Za-z\s\-\/&().,']{1,60}?)\s{2,}(\d{1,2})\s+(\d{1,3})\s+\d{1,3}\s+(\d{2,3})\s+(PASS|FAIL|P|F|AB|ABSENT)\b/i);
        if (patA) {
            subjectName = patA[1].trim();
            internalMark = parseInt(patA[2]);
            externalMark = parseInt(patA[3]);
            maxMarks = parseInt(patA[4]) || 75;
            result = patA[5].toUpperCase();
        }

        // ── Pattern B: "Subject Name  INT  EXT  RESULT"
        // e.g. "ENGLISH  20  55  PASS"
        if (!subjectName) {
            const patB = line.match(/^([A-Za-z][A-Za-z\s\-\/&().,']{1,60}?)\s{2,}(\d{1,2})\s+(\d{1,3})\s+(PASS|FAIL|P|F|AB|ABSENT)\b/i);
            if (patB) {
                subjectName = patB[1].trim();
                internalMark = parseInt(patB[2]);
                externalMark = parseInt(patB[3]);
                result = patB[4].toUpperCase();
            }
        }

        // ── Pattern C: "Subject Name  TOTAL  MAX  RESULT"
        // e.g. "PHYSICS  68  100  PASS"
        if (!subjectName) {
            const patC = line.match(/^([A-Za-z][A-Za-z\s\-\/&().,']{1,60}?)\s{2,}(\d{2,3})\s+(\d{2,3})\s+(PASS|FAIL|P|F|AB|ABSENT)\b/i);
            if (patC) {
                subjectName = patC[1].trim();
                externalMark = parseInt(patC[2]);
                maxMarks = parseInt(patC[3]) || 75;
                result = patC[4].toUpperCase();
            }
        }

        // ── Pattern D: "Subject Name  MARK  RESULT"  (minimal)
        // e.g. "CHEMISTRY  72  PASS"
        if (!subjectName) {
            const patD = line.match(/^([A-Za-z][A-Za-z\s\-\/&().,']{1,60}?)\s{2,}(\d{2,3})\s+(PASS|FAIL|P|F|ABSENT)\b/i);
            if (patD) {
                subjectName = patD[1].trim();
                externalMark = parseInt(patD[2]);
                result = patD[3].toUpperCase();
            }
        }

        // ── Pattern E: "Subject Name  INT  EXT"  (no result column)
        // e.g. "DATA STRUCTURES  22  58"
        if (!subjectName) {
            const patE = line.match(/^([A-Za-z][A-Za-z\s\-\/&().,']{1,60}?)\s{2,}(\d{1,2})\s+(\d{1,3})$/);
            if (patE) {
                const int_ = parseInt(patE[2]);
                const ext_ = parseInt(patE[3]);
                // Only accept if looks like valid marks (int<=25, ext<=100)
                if (int_ <= 25 && ext_ <= 100) {
                    subjectName = patE[1].trim();
                    internalMark = int_;
                    externalMark = ext_;
                }
            }
        }

        // ── Pattern F: Mixed line "SubCode SubjectName INT EXT TOTAL MAX RESULT"
        // e.g. "CS101  DATA STRUCTURES  22  58  80  100  PASS"
        if (!subjectName) {
            const patF = line.match(/^[A-Z0-9]{3,8}\s+([A-Za-z][A-Za-z\s\-\/&().,']{3,50}?)\s{2,}(\d{1,2})\s+(\d{1,3})\s+\d{1,3}\s+(\d{2,3})\s+(PASS|FAIL|P|F|AB)\b/i);
            if (patF) {
                subjectName = patF[1].trim();
                internalMark = parseInt(patF[2]);
                externalMark = parseInt(patF[3]);
                maxMarks = parseInt(patF[4]) || 75;
                result = patF[5].toUpperCase();
            }
        }

        // ── Pattern G: "SubCode  INT  EXT  TOTAL  RESULT" (code only, look up subject name from prev line or next line)
        // e.g. "CS101  22  58  80  PASS"
        // For this, try to get name from adjacent lines
        if (!subjectName) {
            const patG = line.match(/^([A-Z]{1,4}\d{3,6})\s+(\d{1,2})\s+(\d{1,3})\s+\d{1,3}\s+(PASS|FAIL|P|F|AB)\b/i);
            if (patG) {
                // Try to get subject name from the previous non-empty, non-skip line
                let candidateName = patG[1]; // fallback: use code as name
                for (let j = i - 1; j >= Math.max(0, i - 3); j--) {
                    const prev = lines[j].trim();
                    if (prev && !skipKeywords.test(prev) && /^[A-Za-z]/.test(prev) && prev.length > 3 && !/\d{2,}/.test(prev)) {
                        candidateName = prev;
                        break;
                    }
                }
                subjectName = candidateName;
                internalMark = parseInt(patG[2]);
                externalMark = parseInt(patG[3]);
                result = patG[4].toUpperCase();
            }
        }

        // ── Validate & Push ──
        if (subjectName && externalMark !== null && !isNaN(externalMark)) {
            // Filter out obvious non-subject lines
            const cleanName = subjectName.replace(/[^A-Za-z\s\-\/&().,']/g, '').trim();
            if (cleanName.length < 3) continue;
            if (/^(pass|fail|total|grand|max|min|obtained|result|marks|theory|practical)$/i.test(cleanName)) continue;

            // Determine paper type
            if (/practical|lab|project|viva|workshop/i.test(cleanName)) {
                paperType = 'PRACTICAL';
            } else if (/allied|elective|open course|generic/i.test(cleanName)) {
                paperType = 'ALLIED';
            }

            // Use result to determine max marks if not explicitly extracted
            if (maxMarks <= 0) maxMarks = 75;

            data.subjects.push({
                name: cleanName,
                paper_type: paperType,
                overall_max_marks: maxMarks > 25 ? maxMarks - 25 : maxMarks, // store external max
                internal_marks: isNaN(internalMark) ? 0 : internalMark,
                mark: externalMark,
                result: result || ((internalMark + externalMark) >= ((maxMarks) * 0.4) ? 'PASS' : 'FAIL')
            });
        }
    }

    console.log(`Parsed: name="${data.name}", regNo="${data.regNo}", subjects=${data.subjects.length}`);
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
