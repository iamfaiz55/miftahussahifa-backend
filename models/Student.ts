import { DataTypes, Model } from 'sequelize';
import sequelize from '../utils/db.js';

export interface ParentContact {
  name: string;
  phone: string;
  relation: string;
}

export interface EnrolledBatch {
  batch_id: number;
  enrollment_date: string | Date;
  status: 'ACTIVE' | 'DROPPED';
}

class Student extends Model {
  declare id: number;
  declare roll_number: string;
  declare username: string;
  declare full_name: string;
  declare gender: 'MALE' | 'FEMALE' | null;
  declare phone_number: string;
  declare whatsapp_number: string;
  declare parent_contact: ParentContact;
  declare barcode_data: string;
  declare qr_token: string;
  declare enrolled_batches: EnrolledBatch[];
  declare regularity_score: number;
  declare current_streak: number;
  declare is_active: boolean;
  declare referred_by: number | null;

  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

Student.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    roll_number: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
    },
    username: {
      type: DataTypes.STRING(100),
      allowNull: true,
      unique: true,
      set(val: string) {
        this.setDataValue('username', val ? val.toLowerCase().trim() : val);
      },
    },
    full_name: {
      type: DataTypes.STRING(255),
      allowNull: false,
      set(val: string) {
        this.setDataValue('full_name', val ? val.trim() : val);
      },
    },
    gender: {
      type: DataTypes.STRING(20),
      allowNull: true,
      defaultValue: null,
      set(val: string | null) {
        if (!val) {
          this.setDataValue('gender', null);
        } else {
          this.setDataValue('gender', val.toString().toUpperCase().trim());
        }
      },
    },
    phone_number: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    whatsapp_number: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    parent_contact: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: {
        name: '',
        phone: '',
        relation: '',
      },
      get() {
        const raw = this.getDataValue('parent_contact');
        if (!raw) return { name: '', phone: '', relation: '' };
        if (typeof raw === 'object' && !Array.isArray(raw)) return raw;
        if (typeof raw === 'string') {
          try {
            return JSON.parse(raw);
          } catch {
            return { name: '', phone: '', relation: '' };
          }
        }
        return { name: '', phone: '', relation: '' };
      },
    },
    barcode_data: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
    },
    qr_token: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
    },
    enrolled_batches: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: [],
      get() {
        const raw = this.getDataValue('enrolled_batches');
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
    regularity_score: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false,
      defaultValue: 100.0,
    },
    current_streak: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    referred_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: null,
      references: {
        model: 'referrers',
        key: 'id',
      },
    },
  },
  {
    sequelize,
    modelName: 'Student',
    tableName: 'students',
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ['roll_number'],
      },
      {
        unique: true,
        fields: ['barcode_data'],
      },
      {
        unique: true,
        fields: ['qr_token'],
      },
      {
        fields: ['phone_number'],
      },
      {
        fields: ['whatsapp_number'],
      },
      {
        fields: ['is_active'],
      },
      {
        fields: ['referred_by'],
      },
    ],
  }
);

export default Student;
