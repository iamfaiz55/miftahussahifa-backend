import { DataTypes, Model } from 'sequelize';
import sequelize from '../utils/db.js';

export type NotificationChannel = 'WHATSAPP' | 'SMS';
export type DeliveryStatus = 'QUEUED' | 'SENT' | 'DELIVERED' | 'FAILED';

class NotificationLog extends Model {
  declare id: number;
  declare session_id: number;
  declare student_id: number;
  declare channel: NotificationChannel;
  declare recipient_phone: string;
  declare message_body: string;
  declare delivery_status: DeliveryStatus;
  declare gateway_message_id: string | null;
  declare error_reason: string | null;
  declare sent_at: Date | null;

  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

NotificationLog.init(
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
    channel: {
      type: DataTypes.ENUM('WHATSAPP', 'SMS'),
      allowNull: false,
      defaultValue: 'WHATSAPP',
    },
    recipient_phone: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    message_body: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    delivery_status: {
      type: DataTypes.ENUM('QUEUED', 'SENT', 'DELIVERED', 'FAILED'),
      allowNull: false,
      defaultValue: 'QUEUED',
    },
    gateway_message_id: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    error_reason: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    sent_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: 'NotificationLog',
    tableName: 'notification_logs',
    timestamps: true,
    indexes: [
      {
        fields: ['session_id'],
      },
      {
        fields: ['student_id'],
      },
      {
        fields: ['delivery_status'],
      },
      {
        fields: ['channel'],
      },
    ],
  }
);

export default NotificationLog;
