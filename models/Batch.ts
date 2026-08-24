import { DataTypes, Model } from 'sequelize';
import sequelize from '../utils/db.js';

export type ScheduleDay = 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT' | 'SUN';
export type BatchStatus = 'UPCOMING' | 'ACTIVE' | 'PAUSED' | 'COMPLETED';

export interface BatchTiming {
  start_time: string;
  end_time: string;
  timezone: string;
}

class Batch extends Model {
  declare id: number;
  declare batch_code: string;
  declare name: string;
  declare start_date: string;
  declare expected_end_date: string | null;
  declare schedule_days: ScheduleDay[];
  declare timing: BatchTiming;
  declare grace_period_mins: number;
  declare status: BatchStatus;
  declare is_public: boolean;
  declare instructor_id: number | null;

  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

Batch.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    batch_code: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    start_date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    expected_end_date: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    schedule_days: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: ['MON', 'TUE', 'WED', 'THU', 'FRI'],
      get() {
        const raw = this.getDataValue('schedule_days');
        if (!raw) return [];
        if (Array.isArray(raw)) return raw;
        if (typeof raw === 'string') {
          try {
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed : [];
          } catch {
            return [];
          }
        }
        return [];
      },
    },
    timing: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: {
        start_time: '07:00',
        end_time: '08:30',
        timezone: 'IST',
      },
      get() {
        const raw = this.getDataValue('timing');
        if (!raw) return { start_time: '07:00', end_time: '08:30', timezone: 'IST' };
        if (typeof raw === 'object' && !Array.isArray(raw)) return raw;
        if (typeof raw === 'string') {
          try {
            return JSON.parse(raw);
          } catch {
            return { start_time: '07:00', end_time: '08:30', timezone: 'IST' };
          }
        }
        return { start_time: '07:00', end_time: '08:30', timezone: 'IST' };
      },
    },
    grace_period_mins: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 15,
    },
    status: {
      type: DataTypes.ENUM('UPCOMING', 'ACTIVE', 'PAUSED', 'COMPLETED'),
      allowNull: false,
      defaultValue: 'ACTIVE',
    },
    is_public: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    instructor_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id',
      },
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE',
    },
  },
  {
    sequelize,
    modelName: 'Batch',
    tableName: 'batches',
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ['batch_code'],
      },
      {
        fields: ['start_date'],
      },
      {
        fields: ['status'],
      },
      {
        fields: ['instructor_id'],
      },
    ],
  }
);

export default Batch;
