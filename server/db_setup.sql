-- Create Database
CREATE DATABASE IF NOT EXISTS marksheet_db;
USE marksheet_db;

-- Students Table
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
);

-- Marks Table
CREATE TABLE IF NOT EXISTS marks (
    id INT AUTO_INCREMENT PRIMARY KEY,
    student_id INT NOT NULL,
    subject_name VARCHAR(100) NOT NULL,
    mark INT NOT NULL,
    paper_type VARCHAR(20) DEFAULT 'CORE',
    overall_max_marks INT DEFAULT 75,
    internal_marks INT DEFAULT 0,
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
);
