import { DataTypes, Model } from 'sequelize';
import sequelize from '../utils/db.js';

class Referrer extends Model {
  declare id: number;
  declare name: string;
  declare mobile_number: string;
  declare email: string | null;
  declare relation_or_role: string | null;
  declare is_active: boolean;
  declare notes: string | null;

  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

Referrer.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
      set(val: string) {
        this.setDataValue('name', val ? val.trim() : val);
      },
    },
    mobile_number: {
      type: DataTypes.STRING(50),
      allowNull: false,
      set(val: string) {
        this.setDataValue('mobile_number', val ? val.trim() : val);
      },
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: true,
      defaultValue: null,
      set(val: string | null) {
        this.setDataValue('email', val ? val.toLowerCase().trim() : null);
      },
    },
    relation_or_role: {
      type: DataTypes.STRING(100),
      allowNull: true,
      defaultValue: null,
      set(val: string | null) {
        this.setDataValue('relation_or_role', val ? val.trim() : null);
      },
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: null,
    },
  },
  {
    sequelize,
    modelName: 'Referrer',
    tableName: 'referrers',
    timestamps: true,
    indexes: [
      {
        fields: ['name'],
      },
      {
        fields: ['mobile_number'],
      },
      {
        fields: ['is_active'],
      },
    ],
  }
);

export default Referrer;
