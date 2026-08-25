import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../utils/db.js';

export interface CourseMaterialAttributes {
  id: number;
  batch_id: number | null; // Null means all batches / general institute resources
  title: string;
  description?: string;
  file_url: string;
  file_type: 'PDF' | 'DOCX' | 'LINK' | 'VIDEO' | 'AUDIO' | 'WORKSHEET';
  file_size?: string;
  uploaded_by?: number;
  created_at?: Date;
  updated_at?: Date;
}

export interface CourseMaterialCreationAttributes
  extends Optional<CourseMaterialAttributes, 'id' | 'description' | 'file_size' | 'uploaded_by' | 'created_at' | 'updated_at'> {}

class CourseMaterial
  extends Model<CourseMaterialAttributes, CourseMaterialCreationAttributes>
  implements CourseMaterialAttributes
{
  public id!: number;
  public batch_id!: number | null;
  public title!: string;
  public description?: string;
  public file_url!: string;
  public file_type!: 'PDF' | 'DOCX' | 'LINK' | 'VIDEO' | 'AUDIO' | 'WORKSHEET';
  public file_size?: string;
  public uploaded_by?: number;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;
}

CourseMaterial.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    batch_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'batches',
        key: 'id',
      },
      onDelete: 'CASCADE',
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    file_url: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    file_type: {
      type: DataTypes.ENUM('PDF', 'DOCX', 'LINK', 'VIDEO', 'AUDIO', 'WORKSHEET'),
      defaultValue: 'PDF',
      allowNull: false,
    },
    file_size: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    uploaded_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id',
      },
      onDelete: 'SET NULL',
    },
  },
  {
    sequelize,
    tableName: 'course_materials',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  }
);

export default CourseMaterial;
