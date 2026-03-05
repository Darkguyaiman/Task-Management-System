# Node.js Task Management System

Express + EJS + MySQL task management app with MVC structure and pooled `mysql2/promise` connections.

## 1) Install dependencies

```bash
npm install
```

## 2) Configure environment

Create `.env` from `.env.example` and set your DB credentials:

```env
PORT=3000
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=task_system
```

## 3) Create database schema + seed

```bash
mysql -u root -p < schema.sql
```

## 4) Run the app

```bash
npm start
```

Open `http://localhost:3000`.

## Project structure

- `server.js`
- `schema.sql`
- `config/db.js`
- `controllers/`
- `routes/`
- `views/`
- `public/`
- `.env.example`