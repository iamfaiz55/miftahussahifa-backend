import { sequelize } from '../models/index.js';

export async function addGenderColumns() {
  try {
    console.log('--- Checking & adding gender columns ---');
    try {
      const [studentCols]: any = await sequelize.query("SHOW COLUMNS FROM `students` LIKE 'gender'");
      if (!studentCols || studentCols.length === 0) {
        await sequelize.query("ALTER TABLE `students` ADD COLUMN `gender` VARCHAR(20) NULL DEFAULT NULL");
        console.log("✓ Added 'gender' column to students table (default NULL)");
      } else {
        console.log("✓ Column 'gender' already exists on students table");
      }
    } catch (e: any) {
      console.error("Error on students table:", e.message);
    }

    try {
      const [userCols]: any = await sequelize.query("SHOW COLUMNS FROM `users` LIKE 'gender'");
      if (!userCols || userCols.length === 0) {
        await sequelize.query("ALTER TABLE `users` ADD COLUMN `gender` VARCHAR(20) NULL DEFAULT NULL");
        console.log("✓ Added 'gender' column to users table (default NULL)");
      } else {
        console.log("✓ Column 'gender' already exists on users table");
      }
    } catch (e: any) {
      console.error("Error on users table:", e.message);
    }

    console.log('--- Done ---');
  } catch (error) {
    console.error('Migration error:', error);
  }
}

if (process.argv[1]?.includes('addGenderColumn')) {
  addGenderColumns().then(() => process.exit(0)).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
