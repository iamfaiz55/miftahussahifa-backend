import { DataTypes, Model } from 'sequelize';
import sequelize from '../utils/db.js';

export type SessionStatus = 'SCHEDULED' | 'OPEN' | 'COMPLETED' | 'CANCELLED';

export interface SessionSummary {
  total_enrolled: number;
  present: number;
  late: number;
  absent: number;
}

class ClassSession extends Model {
  declare id: number;
  declare batch_id: number;
  declare session_date: string;
  declare actual_start_time: Date | null;
  declare cutoff_time: Date | null;
  declare status: SessionStatus;
  declare summary: SessionSummary;

  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

ClassSession.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
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
    session_date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    actual_start_time: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    cutoff_time: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM('SCHEDULED', 'OPEN', 'COMPLETED', 'CANCELLED'),
      allowNull: false,
      defaultValue: 'SCHEDULED',
    },
    summary: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: {
        total_enrolled: 0,
        present: 0,
        late: 0,
        absent: 0,
      },
    },
  },
  {
    sequelize,
    modelName: 'ClassSession',
    tableName: 'class_sessions',
    timestamps: true,
    indexes: [
      {
        fields: ['batch_id'],
      },
      {
        fields: ['session_date'],
      },
      {
        fields: ['status'],
      },
      {
        fields: ['batch_id', 'session_date'],
      },
    ],
  }
);

export default ClassSession;
