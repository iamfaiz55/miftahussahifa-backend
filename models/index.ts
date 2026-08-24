import sequelize from '../utils/db.js';
import User from './User.js';
import Batch from './Batch.js';
import Student from './Student.js';
import ClassSession from './ClassSession.js';
import AttendanceLog from './AttendanceLog.js';
import NotificationLog from './NotificationLog.js';
import PublicMetricsCache from './PublicMetricsCache.js';

// --- Associations ---

// 1. User (Instructor) <-> Batch
User.hasMany(Batch, { foreignKey: 'instructor_id', as: 'instructedBatches' });
Batch.belongsTo(User, { foreignKey: 'instructor_id', as: 'instructor' });

// 2. Batch <-> ClassSession
Batch.hasMany(ClassSession, { foreignKey: 'batch_id', as: 'sessions' });
ClassSession.belongsTo(Batch, { foreignKey: 'batch_id', as: 'batch' });

// 3. ClassSession <-> AttendanceLog
ClassSession.hasMany(AttendanceLog, { foreignKey: 'session_id', as: 'attendanceLogs' });
AttendanceLog.belongsTo(ClassSession, { foreignKey: 'session_id', as: 'session' });

// 4. Batch <-> AttendanceLog
Batch.hasMany(AttendanceLog, { foreignKey: 'batch_id', as: 'attendanceLogs' });
AttendanceLog.belongsTo(Batch, { foreignKey: 'batch_id', as: 'batch' });

// 5. Student <-> AttendanceLog
Student.hasMany(AttendanceLog, { foreignKey: 'student_id', as: 'attendanceLogs' });
AttendanceLog.belongsTo(Student, { foreignKey: 'student_id', as: 'student' });

// 6. User (Marker) <-> AttendanceLog
User.hasMany(AttendanceLog, { foreignKey: 'marked_by', as: 'markedLogs' });
AttendanceLog.belongsTo(User, { foreignKey: 'marked_by', as: 'marker' });

// 7. ClassSession <-> NotificationLog
ClassSession.hasMany(NotificationLog, { foreignKey: 'session_id', as: 'notifications' });
NotificationLog.belongsTo(ClassSession, { foreignKey: 'session_id', as: 'session' });

// 8. Student <-> NotificationLog
Student.hasMany(NotificationLog, { foreignKey: 'student_id', as: 'notifications' });
NotificationLog.belongsTo(Student, { foreignKey: 'student_id', as: 'student' });

export {
  sequelize,
  User,
  Batch,
  Student,
  ClassSession,
  AttendanceLog,
  NotificationLog,
  PublicMetricsCache,
};

export default {
  sequelize,
  User,
  Batch,
  Student,
  ClassSession,
  AttendanceLog,
  NotificationLog,
  PublicMetricsCache,
};
