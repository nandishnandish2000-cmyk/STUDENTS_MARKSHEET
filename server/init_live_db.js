const mysql = require('mysql2/promise');

async function initDB() {
    const config = {
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        ssl: {
            rejectUnauthorized: false
        }
    };

    const connection = await mysql.createConnection(config);

    try {
        console.log('Connected to Aiven MySQL');

        // Students Table
        const createStudentsTable = `
            CREATE TABLE IF NOT EXISTS students (
                id INT AUTO_INCREMENT PRIMARY KEY,
                uuid VARCHAR(36) NOT NULL UNIQUE,
                name VARCHAR(100) NOT NULL,
                reg_no VARCHAR(50) NOT NULL,
                semester VARCHAR(20) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY unique_student_sem (reg_no, semester)
            )
        `;
        await connection.query(createStudentsTable);
        console.log('Students table created or already exists');

        // Marks Table
        const createMarksTable = `
            CREATE TABLE IF NOT EXISTS marks (
                id INT AUTO_INCREMENT PRIMARY KEY,
                student_id INT NOT NULL,
                subject_name VARCHAR(100) NOT NULL,
                mark INT NOT NULL,
                paper_type VARCHAR(20) DEFAULT 'CORE',
                overall_max_marks INT DEFAULT 75,
                internal_marks INT DEFAULT 0,
                FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
            )
        `;
        await connection.query(createMarksTable);
        console.log('Marks table created or already exists');

        console.log('Database initialization complete!');
    } catch (err) {
        console.error('Error initializing database:', err);
    } finally {
        await connection.end();
    }
}

initDB();
