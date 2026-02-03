# Student Marksheet Management System

## How to Run Locally

1.  **Install Dependencies**:
    ```bash
    npm install
    ```

2.  **Setup Database**:
    - Import `server/db_setup.sql` into your MySQL server.
    - Create a `.env` file based on `.env.example` and update your credentials.

3.  **Start Server**:
    ```bash
    npm start
    ```

4.  **Open Browser**:
    Go to [http://localhost:3000](http://localhost:3000)

## Deployment Guide

To deploy this project for your college submission, follow these steps:

### 1. Database (MySQL)
Since this is a MySQL-based project, you need an online MySQL database.
- **Recommended**: [Aiven.io](https://aiven.io/) or [Freemysqlhosting.net](https://www.freemysqlhosting.net/) provide free tiers.
- Once created, copy the Host, User, Password, and DB Name.

### 2. Hosting (Node.js)
Use **Render** (easiest/free) to host the server:
1.  Push your code to GitHub (You've already done this!).
2.  Go to [Render.com](https://render.com/) and create a "Web Service".
3.  Connect your GitHub repository.
4.  In **Environment Variables**, add:
    - `DB_HOST`: `your-database-host`
    - `DB_USER`: `your-database-user`
    - `DB_PASSWORD`: `your-database-password`
    - `DB_NAME`: `your-database-name`
    - `DB_PORT`: `3306`
    - `PORT`: `10000`
5.  Click **Deploy**.

## Credentials (Example)
-   **Admin**: `Admin` / `Password123`