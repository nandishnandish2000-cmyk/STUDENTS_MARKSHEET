const mysql = require('mysql2');
require('dotenv').config();

let host = (process.env.DB_HOST || 'localhost').trim();
let user = (process.env.DB_USER || 'root').trim();
let password = (process.env.DB_PASSWORD || '').trim();
let database = (process.env.DB_NAME || 'marksheet_db').trim();
let port = parseInt(process.env.DB_PORT || 3306);

// Support for full Connection URI (Aiven style: mysql://user:pass@host:port/db)
if (host.includes('://')) {
    try {
        const url = new URL(host);
        host = url.hostname;
        port = parseInt(url.port) || 3306;
        user = url.username || user;
        password = url.password || password;
        database = url.pathname.replace('/', '') || database;
        console.log('[DB] Parsed Connection URI successfully');
    } catch (e) {
        // Fallback to previous cleaning logic if URL parsing fails
        host = host.replace(/^.*:\/\//, '').split(':')[0];
    }
}

const pool = mysql.createPool({
    host: host,
    user: user,
    password: password,
    database: database,
    port: port,
    ssl: {
        rejectUnauthorized: false
    },
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

module.exports = pool.promise();
