import { DataTypes, Model } from 'sequelize';
import sequelize from '../utils/db.js';

export type UserRole = 'SUPER_ADMIN' | 'TEACHER' | 'SCAN_OPERATOR' | 'admin' | 'user';

class User extends Model {
  declare id: number;
  declare name: string;
  declare email: string;
  declare password_hash: string;
  declare password: string | null;
  declare mobileNumber: string | null;
  declare role: UserRole;
  declare assigned_batches: number[];
  declare is_active: boolean;
  declare isBlocked: boolean;

  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

User.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true,
      },
    },
    password_hash: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    password: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    mobileNumber: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    role: {
      type: DataTypes.ENUM('SUPER_ADMIN', 'TEACHER', 'SCAN_OPERATOR', 'admin', 'user'),
      defaultValue: 'TEACHER',
      allowNull: false,
    },
    assigned_batches: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: [],
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      allowNull: false,
    },
    isBlocked: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false,
    },
  },
  {
    sequelize,
    modelName: 'User',
    tableName: 'users',
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ['email'],
      },
    ],
  }
);

export default User;
