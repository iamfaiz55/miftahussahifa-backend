import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import authRoutes from './routes/auth.routes.js';
import teacherRoutes from './routes/teacher.routes.js';
import batchRoutes from './routes/batch.routes.js';
import studentRoutes from './routes/student.routes.js';
import attendanceRoutes from './routes/attendance.routes.js';
import whatsappRoutes from './routes/whatsapp.routes.js';
import materialRoutes from './routes/material.routes.js';
import referrerRoutes from './routes/referrer.routes.js';
import absenceAlertService from './services/absenceAlert.service.js';
import { sequelize } from './models/index.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5600;

import { backfillAllStudentUsernames } from './controllers/student.controller.js';
import { syncPreviousMedicosAttendance } from './scripts/syncPreviousAttendance.js';

// Sync database
const syncDatabase = async () => {
  try {
    await sequelize.sync();
    console.log('Database synced successfully');

    // Auto-migrate: Ensure gender column exists in students table
    try {
      const [studentCols]: any = await sequelize.query("SHOW COLUMNS FROM `students` LIKE 'gender'");
      if (!studentCols || studentCols.length === 0) {
        await sequelize.query("ALTER TABLE `students` ADD COLUMN `gender` VARCHAR(20) NULL DEFAULT NULL");
        console.log("Successfully added 'gender' column to students table");
      }
    } catch (colErr: any) {
      console.warn("Could not check/add 'gender' on students:", colErr.message);
    }

    // Auto-migrate: Ensure gender column exists in users table
    try {
      const [userCols]: any = await sequelize.query("SHOW COLUMNS FROM `users` LIKE 'gender'");
      if (!userCols || userCols.length === 0) {
        await sequelize.query("ALTER TABLE `users` ADD COLUMN `gender` VARCHAR(20) NULL DEFAULT NULL");
        console.log("Successfully added 'gender' column to users table");
      }
    } catch (colErr: any) {
      console.warn("Could not check/add 'gender' on users:", colErr.message);
    }

    // Auto-migrate: Ensure referrers table exists
    try {
      await sequelize.query(`
        CREATE TABLE IF NOT EXISTS \`referrers\` (
          \`id\` INT AUTO_INCREMENT PRIMARY KEY,
          \`name\` VARCHAR(255) NOT NULL,
          \`mobile_number\` VARCHAR(50) NOT NULL,
          \`email\` VARCHAR(255) NULL DEFAULT NULL,
          \`relation_or_role\` VARCHAR(100) NULL DEFAULT NULL,
          \`is_active\` TINYINT(1) NOT NULL DEFAULT 1,
          \`notes\` TEXT NULL DEFAULT NULL,
          \`createdAt\` DATETIME NOT NULL,
          \`updatedAt\` DATETIME NOT NULL,
          INDEX \`referrers_name_idx\` (\`name\`),
          INDEX \`referrers_mobile_idx\` (\`mobile_number\`),
          INDEX \`referrers_is_active_idx\` (\`is_active\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);
      console.log("Ensured 'referrers' table exists");
    } catch (refTableErr: any) {
      console.warn("Could not check/create 'referrers' table:", refTableErr.message);
    }

    // Auto-migrate: Ensure referred_by column exists in students table
    try {
      const [refCols]: any = await sequelize.query("SHOW COLUMNS FROM `students` LIKE 'referred_by'");
      if (!refCols || refCols.length === 0) {
        await sequelize.query("ALTER TABLE `students` ADD COLUMN `referred_by` INT NULL DEFAULT NULL AFTER `is_active`");
        try {
          await sequelize.query("ALTER TABLE `students` ADD INDEX `students_referred_by_idx` (`referred_by`)");
        } catch {
          // Index might already exist
        }
        console.log("Successfully added 'referred_by' column and index to students table");
      }
    } catch (refErr: any) {
      console.warn("Could not check/add 'referred_by' on students:", refErr.message);
    }

    await backfillAllStudentUsernames();
    await syncPreviousMedicosAttendance();
  } catch (err) {
    console.error('Database sync/migration failed:', err);
  }
};

syncDatabase();


// CORS Middleware - Accepts miftahulquranwalhadees.factoz.in, miftahussahifa.factoz.in and all allowed origins
app.use((req, res, next) => {
  const origin = req.headers.origin;
  res.setHeader('Access-Control-Allow-Origin', origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
    return;
  }
  next();
});

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve static assets and uploads
app.use('/assets', express.static(path.join(process.cwd(), 'assets')));
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

app.use('/api/auth', authRoutes);
app.use('/api/teachers', teacherRoutes);
app.use('/api/batches', batchRoutes);
app.use('/api/classes', batchRoutes); // Friendly alias
app.use('/api/students', studentRoutes);
app.use('/api/referrers', referrerRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/whatsapp', whatsappRoutes);
app.use('/api/materials', materialRoutes);

// Start background auto-absence alert scheduler
absenceAlertService.startScheduler();


app.get('/', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'Miftahul Quran Wal Hadees Backend API is running' });
});

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'Miftahul Quran Wal Hadees Backend API is running' });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
