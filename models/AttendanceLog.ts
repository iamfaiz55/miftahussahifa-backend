import { DataTypes, Model } from 'sequelize';
import sequelize from '../utils/db.js';

export type AttendanceStatus = 'PRESENT' | 'LATE' | 'ABSENT' | 'EXCUSED';
export type ScanMethod = 'QR_CAMERA' | 'BARCODE_USB' | 'MANUAL_OVERRIDE' | 'AUTO_ABSENT';

class AttendanceLog extends Model {
  declare id: number;
  declare session_id: number;
  declare batch_id: number;
  declare student_id: number;
  declare scan_timestamp: Date;
  declare status: AttendanceStatus;
  declare scan_method: ScanMethod;
  declare scanned_code: string | null;
  declare marked_by: number | null;
  declare notes: string | null;

  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

AttendanceLog.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    session_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'class_sessions',
        key: 'id',
      },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE',
    },
    batch_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'batches',
        key: 'id',
      },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE',
    },
    student_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'students',
        key: 'id',
      },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE',
    },
    scan_timestamp: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    status: {
      type: DataTypes.ENUM('PRESENT', 'LATE', 'ABSENT', 'EXCUSED'),
      allowNull: false,
      defaultValue: 'PRESENT',
    },
    scan_method: {
      type: DataTypes.ENUM('QR_CAMERA', 'BARCODE_USB', 'MANUAL_OVERRIDE', 'AUTO_ABSENT'),
      allowNull: false,
      defaultValue: 'QR_CAMERA',
    },
    scanned_code: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    marked_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id',
      },
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE',
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: 'AttendanceLog',
    tableName: 'attendance_logs',
    timestamps: true,
    indexes: [
      {
        unique: true,
        name: 'unique_session_student_log',
        fields: ['session_id', 'student_id'],
      },
      {
        fields: ['session_id'],
      },
      {
        fields: ['batch_id'],
      },
      {
        fields: ['student_id'],
      },
      {
        fields: ['scan_timestamp'],
      },
      {
        fields: ['status'],
      },
    ],
  }
);

export default AttendanceLog;
