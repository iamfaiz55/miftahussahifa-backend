import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import authRoutes from './routes/auth.routes.js';
import teacherRoutes from './routes/teacher.routes.js';
import batchRoutes from './routes/batch.routes.js';
import studentRoutes from './routes/student.routes.js';
import attendanceRoutes from './routes/attendance.routes.js';
import whatsappRoutes from './routes/whatsapp.routes.js';
import absenceAlertService from './services/absenceAlert.service.js';
import { sequelize } from './models/index.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5600;

import { DataTypes } from 'sequelize';

// Sync database
const syncDatabase = async () => {
  try {
    await sequelize.sync();
    console.log('Database synced successfully');
  } catch (err) {
    console.error('Database sync/migration failed:', err);
  }
};

syncDatabase();


// CORS Middleware
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
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
app.use('/api/attendance', attendanceRoutes);
app.use('/api/whatsapp', whatsappRoutes);

// Start background auto-absence alert scheduler
absenceAlertService.startScheduler();


app.get('/', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'Miftahussahifa Backend API is running' });
});

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'Miftahussahifa Backend API is running' });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
