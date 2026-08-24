import { DataTypes, Model } from 'sequelize';
import sequelize from '../utils/db.js';

export interface CohortSummary {
  batch_name: string;
  start_date: string;
  student_count: number;
  regularity_pct: number;
}

class PublicMetricsCache extends Model {
  declare id: number;
  declare snapshot_timestamp: Date;
  declare total_active_students: number;
  declare total_batches_running: number;
  declare global_attendance_rate: number;
  declare total_sessions_conducted: number;
  declare active_cohort_summaries: CohortSummary[];

  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

PublicMetricsCache.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    snapshot_timestamp: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    total_active_students: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    total_batches_running: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    global_attendance_rate: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false,
      defaultValue: 0.0,
    },
    total_sessions_conducted: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    active_cohort_summaries: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: [],
    },
  },
  {
    sequelize,
    modelName: 'PublicMetricsCache',
    tableName: 'public_metrics_cache',
    timestamps: true,
    indexes: [
      {
        fields: ['snapshot_timestamp'],
      },
    ],
  }
);

export default PublicMetricsCache;
