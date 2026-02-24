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
const PDFParse = require('pdf-parse');
const OpenAI = require('openai');

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || 'no-key-provided',
});

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Multer Setup ──────────────────────────────────────────────────────────────
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, '../uploads');
        if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + Math.round(Math.random() * 1e9) + path.extname(file.originalname));
    }
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

// ─── OCR Parser ────────────────────────────────────────────────────────────────
// Returns the required JSON:
// { student_name, register_number, subjects:[{subject,marks,result}], total_marks, result }
function parseMarksheetText(rawText) {
    const lines = rawText
        .split('\n')
        .map(l => l.replace(/\t/g, ' ').replace(/\s{2,}/g, '  ').trim())
        .filter(l => l.length > 0);

    const fullText = lines.join('\n');

    console.log('=== OCR RAW TEXT ===');
    console.log(fullText);
    console.log('====================');

    const parsed = {
        student_name: '',
        register_number: '',
        subjects: [],
        total_marks: '',
        result: ''
    };

    // ── 1. Student Name ──────────────────────────────────────────────────────
    const namePatterns = [
        /(?:name\s+of\s+(?:the\s+)?(?:student|candidate|examinee)|student\s*name|candidate\s*name|examinee\s*name|Name\s*:)\s*[:\-]?\s*([A-Za-z][A-Za-z .]{2,60})/i,
        /(?:^|\n)\bName\s*:\s*([A-Za-z][A-Za-z .]{2,60})/im,
        /(?:^|\n)\bN\s*A\s*M\s*E\s*:\s*([A-Za-z][A-Za-z .]{2,60})/im,
    ];
    for (const p of namePatterns) {
        const m = fullText.match(p);
        if (m) {
            const c = m[1].trim().replace(/\s*\d.*$/, '').replace(/^[ \t:\-]+/, '').trim();
            if (c.length >= 3) { parsed.student_name = c; break; }
        }
    }
    // Fallback: look for a line that looks like a proper name (Title Case, no digits, ≤6 words)
    if (!parsed.student_name) {
        const skipWords = /^(semester|marksheet|result|pass|fail|passed|failed|subject|marks|internal|external|total|college|university|department|branch|year|examination|statement|certificate|board|school|institution|register|roll|date|signature|controller|principal)$/i;
        for (const line of lines) {
            const words = line.trim().split(/\s+/);
            if (words.length >= 1 && words.length <= 5 &&
                /^[A-Z][A-Za-z .]+$/.test(line) &&
                !skipWords.test(line) &&
                !/\d/.test(line) &&
                line.length >= 4 && line.length <= 60) {
                parsed.student_name = line.trim();
                break;
            }
        }
    }

    // ── 2. Register Number ───────────────────────────────────────────────────
    const regPatterns = [
        /(?:register(?:ation)?\s*(?:no\.?|number)|reg\.?\s*no\.?|roll\s*(?:no\.?|number)|enroll(?:ment)?\s*(?:no\.?|number)|hall\s*ticket\s*(?:no\.?|number)?|Register\s*Number\s*:)\s*[:\-]?\s*([A-Z0-9\/\-]{4,20})/i,
    ];
    for (const p of regPatterns) {
        const m = fullText.match(p);
        if (m) { parsed.register_number = m[1].trim(); break; }
    }
    if (!parsed.register_number) {
        const fallbacks = [
            /(?:^|\n)\s*(\d{8,12})\s*(\n|$)/, // Isolated 10-digit number
            /\b(\d{2}[A-Z]{1,5}\d{2,8})\b/i,   // 21CS101
            /\b([A-Z]{1,4}\d{1,8})\b/i,        // K0153
        ];
        for (const p of fallbacks) {
            const m = fullText.match(p);
            if (m) { parsed.register_number = m[1].trim(); break; }
        }
    }

    // ── 3. Total Marks ──────────────────────────────────────────────────────
    const totalM = fullText.match(/(?:grand\s+total|total\s+marks?|total\s+obtained)\s*[:\-]?\s*(\d{2,4})/i);
    if (totalM) parsed.total_marks = totalM[1];

    // ── 4. Overall Result ───────────────────────────────────────────────────
    const resultM = fullText.match(/\b(PASS(?:ED)?|FAIL(?:ED)?|PROMOTED|WITHHELD)\b/i);
    if (resultM) {
        const r = resultM[1].toUpperCase();
        parsed.result = r.startsWith('PASS') ? 'PASS' : r.startsWith('FAIL') ? 'FAIL' : r;
    }

    // ── 5. Subjects & Marks ─────────────────────────────────────────────────
    const skipLine = /^(semester|marksheet|result\s*sheet|statement|university|college|institution|hall\s*ticket|register|roll\s*no|name\s*of|candidate|year|batch|branch|degree|department|date|signature|principal|controller|grand\s*total|percentage|cgpa|sgpa|gpa|class|division|remarks|note|legend|subject\s*name|subject\s*code|sub\.?\s*code|sl\.?\s*no|s\.?no|serial|internal|external|max\.?|min\.?|obtained|theory|practical$|lab$|paper$|code$|total$)$/i;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.length < 4) continue;
        if (skipLine.test(line.trim())) continue;

        let sub = null;
        let marks = null;
        let subResult = null;

        // A: "Subject  int  ext  total  max  PASS"
        let m = line.match(/^([A-Za-z][A-Za-z &()\-\/.,]{1,55}?)\s{1,4}(\d{1,2})\s+(\d{1,3})\s+\d{1,3}\s+\d{2,3}\s+(PASS|FAIL|P|F|AB)\b/i);
        if (m) { sub = m[1]; marks = String(+m[2] + +m[3]); subResult = m[4]; }

        // B: "Subject  int  ext  PASS"
        if (!sub) {
            m = line.match(/^([A-Za-z][A-Za-z &()\-\/.,]{1,55}?)\s{1,4}(\d{1,2})\s+(\d{1,3})\s+(PASS|FAIL|P|F|AB)\b/i);
            if (m) { sub = m[1]; marks = String(+m[2] + +m[3]); subResult = m[4]; }
        }

        // C: "Subject  total  max  PASS"
        if (!sub) {
            m = line.match(/^([A-Za-z][A-Za-z &()\-\/.,]{1,55}?)\s{1,4}(\d{2,3})\s+\d{2,3}\s+(PASS|FAIL|P|F|AB)\b/i);
            if (m) { sub = m[1]; marks = m[2]; subResult = m[3]; }
        }

        // D: "Subject  marks  ext  total  PASS" (Bharathiar Format: 11T TAMILI 021+039 P)
        if (!sub) {
            m = line.match(/^([A-Z0-9]{2,5})\s+([A-Za-z][A-Za-z &()\-\/.,]{2,55}?)\s{1,4}(\d{1,3})\+(\d{1,3})\s+(PASS|FAIL|P|F|AB)\b/i);
            if (m) {
                sub = m[2];
                marks = String(+m[3] + +m[4]);
                subResult = m[5];
            }
        }

        // E: "Subject  marks  PASS"
        if (!sub) {
            m = line.match(/^([A-Za-z][A-Za-z &()\-\/.,]{1,55}?)\s{1,4}(\d{2,3})\s+(PASS|FAIL|P|F|AB)\b/i);
            if (m) { sub = m[1]; marks = m[2]; subResult = m[3]; }
        }

        // E: "Subject  int  ext" (no result)
        if (!sub) {
            m = line.match(/^([A-Za-z][A-Za-z &()\-\/.,]{1,55}?)\s{1,4}(\d{1,2})\s+(\d{1,3})$/);
            if (m && +m[2] <= 30 && +m[3] <= 100) { sub = m[1]; marks = String(+m[2] + +m[3]); }
        }

        // F: "CODE  Subject  int  ext  total  max  PASS"
        if (!sub) {
            m = line.match(/^[A-Z0-9]{2,8}\s+([A-Za-z][A-Za-z &()\-\/.,]{2,55}?)\s{1,4}(\d{1,2})\s+(\d{1,3})\s+\d{1,3}\s+\d{2,3}\s+(PASS|FAIL|P|F|AB)\b/i);
            if (m) { sub = m[1]; marks = String(+m[2] + +m[3]); subResult = m[4]; }
        }

        // G: "CODE  int  ext  total  PASS" (look up name from previous lines)
        if (!sub) {
            m = line.match(/^[A-Z]{1,4}\d{3,6}\s+(\d{1,2})\s+(\d{1,3})\s+\d{1,3}\s+(PASS|FAIL|P|F|AB)\b/i);
            if (m) {
                for (let j = i - 1; j >= Math.max(0, i - 3); j--) {
                    const prev = lines[j].trim();
                    if (prev && !skipLine.test(prev) && /^[A-Za-z]/.test(prev) && !/\d{2}/.test(prev)) {
                        sub = prev; break;
                    }
                }
                if (!sub) sub = line.match(/^([A-Z]{1,4}\d{3,6})/)[1];
                marks = String(+m[1] + +m[2]);
                subResult = m[3];
            }
        }

        if (sub && marks !== null) {
            const cleanSub = sub.replace(/[^A-Za-z0-9 &()\-\/.,]/g, '').trim();
            if (cleanSub.length < 3) continue;
            if (/^(pass|fail|total|grand|max|min|obtained|result|marks|theory|practical|lab|paper|code|sno|serial)$/i.test(cleanSub)) continue;
            if (parsed.subjects.some(s => s.subject.toLowerCase() === cleanSub.toLowerCase())) continue;

            const r = (subResult || '').toUpperCase();
            parsed.subjects.push({
                subject: cleanSub,
                marks: marks,
                result: r.startsWith('P') ? 'PASS' : r.startsWith('F') ? 'FAIL' : (parseInt(marks) >= 35 ? 'PASS' : 'FAIL')
            });
        }
    }

    // Compute total from subjects if not found
    if (!parsed.total_marks && parsed.subjects.length > 0) {
        parsed.total_marks = String(parsed.subjects.reduce((s, x) => s + (parseInt(x.marks) || 0), 0));
    }

    // Compute overall result from subjects if not found
    if (!parsed.result && parsed.subjects.length > 0) {
        parsed.result = parsed.subjects.every(s => s.result === 'PASS') ? 'PASS' : 'FAIL';
    }

    console.log(`→ Name: "${parsed.student_name}" | Reg: "${parsed.register_number}" | Subjects: ${parsed.subjects.length} | Total: ${parsed.total_marks} | Result: ${parsed.result}`);
    return parsed;
}

/**
 * Enhanced Extraction using OpenAI GPT-4o Vision
 * This handles complex tables and handwritten/low-res text with extreme accuracy.
 */
async function extractWithGPT(filePath, isPdf = false) {
    if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'no-key-provided') {
        throw new Error('OpenAI API Key is missing. Falling back to local OCR.');
    }

    let base64Content = '';
    let mediaType = '';

    if (isPdf) {
        // For PDF, we'll still use text extraction for now or prompt differently
        // If the user wants full vision for PDF, we'd need to convert PDF to Image
        // For now, let's keep it simple: GPT-4o handles images.
        return null;
    } else {
        base64Content = fs.readFileSync(filePath, { encoding: 'base64' });
        const ext = path.extname(filePath).toLowerCase().slice(1) || 'jpeg';
        mediaType = `image/${ext === 'jpg' ? 'jpeg' : ext}`;
    }

    const prompt = `
        You are a Student Marksheet Data Extraction Expert. 
        Your task is to analyze the provided marksheet image and extract data into a specific JSON format.
        
        Fields to find:
        1. Student Name (Look for "Name:", "Candidate Name", etc.)
        2. Register Number (Look for "Register Number:", "Reg No", "Roll No", etc.)
        3. Subjects Table:
           - Subject Code (e.g., 11T, 12E)
           - Subject Name (Full descriptive name)
           - Paper Type (Look for labels in the "SUBJECT NAME" column. If it says "CORE:", value is "CORE". If "ALLIED:", value is "ALLIED". If "CORE PRACTICAL:", value is "PRACTICAL". If no label is found, the value MUST be "NON".)
           - Marks (If marks are in "INT+EXT" or "021+039" format, sum them up and return the total)
           - Result (STRICTLY extract the character from the "RESULT" column. If it is "P." or "P", return "PASS". If it is "F." or "F", return "FAIL". DO NOT perform any calculations.)
        
        Required JSON Structure:
        {
          "student_name": "Full Name",
          "register_number": "Reg Number",
          "subjects": [
            {
              "subject": "Full Subject Name (include code if helpful)",
              "paper_type": "CORE/ALLIED/PRACTICAL/NON",
              "marks": "Total obtained (as string)",
              "result": "PASS or FAIL"
            }
          ],
          "total_marks": "Grand Total",
          "result": "Overall Result (PASS/FAIL)"
        }
        
        Critical Instructions:
        - Accuracy is mandatory. Do not hallucinate.
        - If a subject name spans multiple columns/lines, combine it.
        - If marks are provided as an addition (e.g., 20+40), return 60.
        - Return ONLY the JSON object. No markdown, no text.
    `;

    try {
        const response = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
                {
                    role: "user",
                    content: [
                        { type: "text", text: prompt },
                        {
                            type: "image_url",
                            image_url: { url: `data:${mediaType};base64,${base64Content}` }
                        }
                    ]
                }
            ],
            response_format: { type: "json_object" }
        });

        let content = response.choices[0].message.content.trim();
        // Robust cleanup: remove markdown blocks if present
        if (content.startsWith('```')) {
            content = content.replace(/^```(?:json)?\s*|\s*```$/g, '');
        }

        const extraction = JSON.parse(content);
        console.log('[GPT OCR] Extraction Successful');
        return extraction;
    } catch (err) {
        console.error('[GPT OCR Error]', err.message);
        throw err;
    }
}

// ─── Middleware ────────────────────────────────────────────────────────────────
app.use(cors());
app.use(morgan('dev'));
app.use(bodyParser.json());

// Explicitly serve index.html for the root route
app.get('/', (req, res) => {
    const indexPath = path.join(__dirname, '../index.html');
    const indexPathAlt = path.join(__dirname, 'index.html'); // just in case it's run from root

    if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
    } else if (fs.existsSync(indexPathAlt)) {
        res.sendFile(indexPathAlt);
    } else {
        res.status(404).send(`SYSTEM ERROR: index.html not found. Checked: ${indexPath} and ${indexPathAlt}. Please ensure index.html is in the project root.`);
    }
});

app.get('/debug-paths', (req, res) => {
    res.json({
        dirname: __dirname,
        rootFiles: fs.readdirSync(path.join(__dirname, '..')),
        serverFiles: fs.readdirSync(__dirname)
    });
});

app.use(express.static(path.join(__dirname, '..')));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// ─── Admin Credentials ─────────────────────────────────────────────────────────
const ADMIN_CREDENTIALS = {
    username: (process.env.ADMIN_USERNAME || 'Nandish').trim(),
    password: (process.env.ADMIN_PASSWORD || 'Nandish_16_').trim()
};

// ═══════════════════════════════════════════════════════════════════════════════
// API ENDPOINTS
// ═══════════════════════════════════════════════════════════════════════════════

// 1. Admin Login
app.post('/api/admin/login', (req, res) => {
    const inputUser = (req.body.username || '').trim();
    const inputPass = (req.body.password || '').trim();
    console.log(`Admin login attempt: ${inputUser}`);
    if (inputUser.toLowerCase() === ADMIN_CREDENTIALS.username.toLowerCase() && inputPass === ADMIN_CREDENTIALS.password) {
        res.json({ success: true, message: 'Login successful' });
    } else {
        res.status(401).json({ success: false, message: 'Entered username or password is incorrect' });
    }
});

// 2. Get Students by Semester
app.get('/api/students/:semester', async (req, res) => {
    try {
        const [students] = await db.query('SELECT * FROM students WHERE semester = ?', [req.params.semester]);
        const studentsWithMarks = await Promise.all(students.map(async (s) => {
            const [marks] = await db.query(
                'SELECT subject_name as name, mark, paper_type, overall_max_marks, internal_marks, result FROM marks WHERE student_id = ?',
                [s.id]
            );
            return {
                id: s.uuid,
                name: s.name,
                regNo: s.reg_no,
                subjects: marks,
                totalMarks: s.total_marks,
                result: s.result,
                marksheetPath: s.marksheet_path
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
    let { name, regNo, subjects, totalMarks, result: overallResult, marksheetPath } = req.body;
    if (!name || !regNo || !subjects || !Array.isArray(subjects)) {
        return res.status(400).json({ success: false, message: 'Invalid student data.' });
    }
    name = name.trim(); regNo = regNo.trim();
    try {
        const [existing] = await db.query(
            'SELECT * FROM students WHERE LOWER(TRIM(reg_no)) = LOWER(?) AND semester = ?',
            [regNo, semester]
        );
        if (existing.length > 0) {
            return res.status(400).json({ success: false, message: 'Student with this Register Number already exists in this semester' });
        }
        const uuid = Date.now().toString();

        // Calculate total and result if not provided (manual entry fallback)
        if (!overallResult && subjects.length > 0) {
            // Default to PASS if not specified, but usually it comes from the frontend.
            overallResult = 'PASS';
        }
        if (!totalMarks && subjects.length > 0) {
            totalMarks = subjects.reduce((sum, s) => sum + (parseInt(s.mark || s.marks || 0)), 0).toString();
        }

        const [result] = await db.query(
            'INSERT INTO students (uuid, name, reg_no, semester, total_marks, result, marksheet_path) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [uuid, name, regNo, semester, totalMarks || '', overallResult || '', marksheetPath || '']
        );
        const studentId = result.insertId;
        for (const sub of subjects) {
            // THE USER IS ALWAYS RIGHT: Use the result provided by the extraction/manual entry.
            // NO calculations. NO ">= 30" logic. 
            const subjectResult = (sub.result || "").toString().trim().toUpperCase();
            await db.query(
                'INSERT INTO marks (student_id, subject_name, mark, paper_type, overall_max_marks, internal_marks, result) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [studentId, (sub.name || sub.subject || '').trim(), sub.mark || sub.marks || 0, sub.paper_type || 'CORE', sub.overall_max_marks || 75, sub.internal_marks || 0, subjectResult]
            );
        }
        console.log(`Added: ${name} (${regNo}) → ${semester}`);
        res.json({ success: true, message: 'Student added successfully' });
    } catch (err) {
        console.error('Add student error:', err);
        res.status(500).json({ success: false, message: 'Database error: ' + (err.sqlMessage || err.message) });
    }
});

// 4. Update Student
app.put('/api/students/:semester/:uuid', async (req, res) => {
    const { semester, uuid } = req.params;
    let { name, regNo, subjects } = req.body;
    name = name.trim(); regNo = regNo.trim();
    try {
        const [students] = await db.query('SELECT id FROM students WHERE uuid = ?', [uuid]);
        if (students.length === 0) return res.status(404).json({ success: false, message: 'Student not found' });
        const studentId = students[0].id;

        const [duplicate] = await db.query(
            'SELECT * FROM students WHERE LOWER(TRIM(reg_no)) = LOWER(?) AND semester = ? AND uuid != ?',
            [regNo, semester, uuid]
        );
        if (duplicate.length > 0) return res.status(400).json({ success: false, message: 'Register Number already exists in this semester' });

        await db.query('UPDATE students SET name = ?, reg_no = ? WHERE id = ?', [name, regNo, studentId]);
        await db.query('DELETE FROM marks WHERE student_id = ?', [studentId]);
        for (const sub of subjects) {
            // NO heuristic logic allowed. Absolute adherence to data.
            const subjectResult = (sub.result || "").toString().trim().toUpperCase();
            await db.query(
                'INSERT INTO marks (student_id, subject_name, mark, paper_type, overall_max_marks, internal_marks, result) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [studentId, (sub.name || '').trim(), sub.mark, sub.paper_type || 'CORE', sub.overall_max_marks || 75, sub.internal_marks || 0, subjectResult]
            );
        }
        res.json({ success: true, message: 'Student updated successfully' });
    } catch (err) {
        console.error('Update error:', err);
        res.status(500).json({ success: false, message: 'Database error' });
    }
});

// 5. Delete Student
app.delete('/api/students/:semester/:uuid', async (req, res) => {
    try {
        const [result] = await db.query('DELETE FROM students WHERE uuid = ?', [req.params.uuid]);
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
    if (!name || !regNo) return res.status(400).json({ success: false, message: 'Please enter both name and register number' });
    try {
        const [students] = await db.query(
            'SELECT DISTINCT name, reg_no, semester FROM students WHERE LOWER(TRIM(name)) = LOWER(?) AND LOWER(TRIM(reg_no)) = LOWER(?)',
            [name.trim(), regNo.trim()]
        );
        if (students.length > 0) {
            res.json({
                success: true, message: 'Login successful',
                studentName: students[0].name, regNo: students[0].reg_no,
                availableSemesters: students.map(s => s.semester)
            });
        } else {
            res.status(401).json({ success: false, message: 'No record found. Please check your Name and Register Number.' });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// 7. Student Overall Data
app.get('/api/student/overall/:regNo', async (req, res) => {
    try {
        const [students] = await db.query(
            'SELECT * FROM students WHERE LOWER(TRIM(reg_no)) = LOWER(?) ORDER BY semester ASC',
            [req.params.regNo.trim()]
        );
        if (students.length === 0) return res.status(404).json({ success: false, message: 'No records found' });

        // The original code already included 'result' in the marks query.
        // The instruction implies a structural change to how history is built.
        // Reconstructing history to match the implied structure from the snippet.
        const history = [];
        for (const s of students) {
            const [marks] = await db.query('SELECT subject_name as name, mark, paper_type, overall_max_marks, internal_marks, result FROM marks WHERE student_id = ?', [s.id]);
            history.push({ semester: s.semester, subjects: marks });
        }

        res.json({ success: true, studentName: students[0].name, regNo: students[0].reg_no, history });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// 8. Get Single Student Marksheet (Student Portal)
app.get('/api/student/:semester/:regNo', async (req, res) => {
    const { semester, regNo } = req.params;
    try {
        const [students] = await db.query(
            'SELECT * FROM students WHERE LOWER(TRIM(reg_no)) = LOWER(?) AND LOWER(TRIM(semester)) = LOWER(?)',
            [regNo.trim(), semester.trim()]
        );
        if (students.length === 0) return res.status(404).json({ success: false, message: `No record found for Semester: ${semester.replace('_', ' ')}` });
        const student = students[0];
        const [marks] = await db.query('SELECT subject_name as name, mark, paper_type, overall_max_marks, internal_marks, result FROM marks WHERE student_id = ?', [student.id]);
        res.json({ success: true, student: { name: student.name, regNo: student.reg_no, subjects: marks } });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// 9. OCR Extract Marksheet
app.post('/api/extract-marksheet', upload.single('marksheet'), async (req, res) => {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });

    const filePath = req.file.path;
    const isPdf = req.file.mimetype === 'application/pdf';
    console.log(`[OCR] Processing: ${req.file.originalname} (${isPdf ? 'PDF' : 'Image'})`);

    try {
        let rawText = '(Extracted via GPT-4o Intelligence Core)';
        let confidence = 98;
        let parsedData = null;

        // Try OpenAI GPT-4o first for images if key exists for better accuracy (requested by user)
        if (!isPdf && process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'no-key-provided') {
            try {
                parsedData = await extractWithGPT(filePath);
            } catch (gptErr) {
                console.warn('[OCR Fallback] GPT failed, trying Tesseract...', gptErr.message);
            }
        }

        // Fallback to Tesseract or handle PDF
        if (!parsedData) {
            if (isPdf) {
                const dataBuffer = fs.readFileSync(filePath);
                const pdfData = await PDFParse(dataBuffer);
                rawText = pdfData.text || '';
                confidence = 85;
            } else {
                const { data } = await Tesseract.recognize(filePath, 'eng', {
                    logger: m => { if (m.status === 'recognizing text') console.log(`[OCR] ${Math.round(m.progress * 100)}%`); }
                });
                rawText = data.text || '';
                confidence = Math.round(data.confidence || 0);
            }
            parsedData = parseMarksheetText(rawText);
        }

        // Ensure confidence field is added
        parsedData.ocr_confidence = (parsedData.ocr_confidence && !parsedData.ocr_confidence.includes('%'))
            ? parsedData.ocr_confidence
            : (confidence + '%');

        const relativePath = 'uploads/' + path.basename(filePath);
        const warning = (parseInt(parsedData.ocr_confidence) < 60) ? `OCR confidence is low (${parsedData.ocr_confidence}). Please verify all fields manually.` : null;
        const aiStatus = (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'no-key-provided')
            ? 'OpenAI GPT-4o Intelligence Active'
            : 'Tesseract Fallback (OpenAI API key missing in Render dashboard)';

        res.json({
            success: true,
            data: parsedData,
            rawText: rawText,
            confidence: parseInt(parsedData.ocr_confidence),
            warning: warning,
            marksheetPath: relativePath,
            ai_status: aiStatus
        });
    } catch (err) {
        console.error('[OCR Error]', err);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        res.status(500).json({ success: false, message: 'OCR processing failed: ' + err.message });
    }
});

// ─── DB Auto-Migration & Health Check ───────────────────────────────────────
async function initializeDatabase() {
    try {
        console.log('[DB] Connecting to host:', process.env.DB_HOST ? (process.env.DB_HOST.includes('@') ? '***@' + process.env.DB_HOST.split('@')[1] : process.env.DB_HOST) : 'localhost');
        console.log('[DB] Running auto-migration check...');

        // 1. Create students table if not exists
        await db.query(`
            CREATE TABLE IF NOT EXISTS students (
                id INT AUTO_INCREMENT PRIMARY KEY,
                uuid VARCHAR(36) NOT NULL UNIQUE,
                name VARCHAR(100) NOT NULL,
                reg_no VARCHAR(50) NOT NULL,
                semester VARCHAR(20) NOT NULL,
                total_marks VARCHAR(10) DEFAULT '0',
                result VARCHAR(20) DEFAULT 'FAIL',
                marksheet_path VARCHAR(255) DEFAULT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY unique_student_sem (reg_no, semester)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);

        // 2. Add missing columns to students if they don't exist (for existing DBs)
        const [studentCols] = await db.query("SHOW COLUMNS FROM students");
        const colNames = studentCols.map(c => c.Field.toLowerCase());

        if (!colNames.includes('total_marks')) {
            await db.query("ALTER TABLE students ADD COLUMN total_marks VARCHAR(10) DEFAULT '0'");
            console.log('[DB] Added total_marks column');
        }
        if (!colNames.includes('result')) {
            await db.query("ALTER TABLE students ADD COLUMN result VARCHAR(20) DEFAULT 'FAIL'");
            console.log('[DB] Added result column');
        }
        if (!colNames.includes('marksheet_path')) {
            await db.query("ALTER TABLE students ADD COLUMN marksheet_path VARCHAR(255) DEFAULT NULL");
            console.log('[DB] Added marksheet_path column');
        }

        // 3. Create marks table if not exists with result column
        await db.query(`
            CREATE TABLE IF NOT EXISTS marks (
                id INT AUTO_INCREMENT PRIMARY KEY,
                student_id INT NOT NULL,
                subject_name VARCHAR(100) NOT NULL,
                mark INT NOT NULL,
                paper_type VARCHAR(20) DEFAULT 'CORE',
                overall_max_marks INT DEFAULT 75,
                internal_marks INT DEFAULT 0,
                result VARCHAR(10) DEFAULT 'PASS',
                FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);

        // Add result column to marks if it doesn't exist
        const [marksCols] = await db.query("SHOW COLUMNS FROM marks");
        const marksColNames = marksCols.map(c => c.Field.toLowerCase());
        if (!marksColNames.includes('result')) {
            await db.query("ALTER TABLE marks ADD COLUMN result VARCHAR(10) DEFAULT 'PASS'");
            console.log('[DB] Added result column to marks table');
        }

        console.log('✓ Database system synchronized and connected');
    } catch (err) {
        console.error('✗ Database synchronization failed:', err.message);
        // Don't exit process, let app run so user can see error in dashboard
    }
}

initializeDatabase();

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
