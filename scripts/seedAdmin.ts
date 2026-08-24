import { sequelize, User } from '../models/index.js';
import bcrypt from 'bcryptjs';

async function seed() {
  try {
    console.log('Connecting to database...');
    await sequelize.authenticate();
    console.log('Database connected successfully.');

    // Ensure tables exist
    await sequelize.sync();
    console.log('Database synced.');

    const email = 'admin@gmail.com';
    const plainPassword = '121212';
    const hashedPassword = await bcrypt.hash(plainPassword, 10);

    const existing = await User.findOne({ where: { email } });
    if (existing) {
      await existing.update({
        name: 'Super Admin',
        password_hash: hashedPassword,
        password: hashedPassword,
        role: 'SUPER_ADMIN',
        is_active: true,
        isBlocked: false,
        mobileNumber: '+919876543210',
        assigned_batches: [],
      });
      console.log('✅ Existing admin updated successfully!');
      console.log('ID:', existing.id);
      console.log('Email:', existing.email);
      console.log('Role:', existing.role);
    } else {
      const newUser = await User.create({
        name: 'Super Admin',
        email,
        password_hash: hashedPassword,
        password: hashedPassword,
        role: 'SUPER_ADMIN',
        is_active: true,
        isBlocked: false,
        mobileNumber: '+919876543210',
        assigned_batches: [],
      });
      console.log('✅ Super admin created successfully!');
      console.log('ID:', newUser.id);
      console.log('Email:', newUser.email);
      console.log('Role:', newUser.role);
    }

    process.exit(0);
  } catch (err: any) {
    console.error('❌ Seeding failed:', err);
    process.exit(1);
  }
}

seed();
