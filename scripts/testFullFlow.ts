import { User, Batch, Student } from '../models/index.js';
import bcrypt from 'bcryptjs';

async function testFullFlow() {
  try {
    console.log('--- 1. Testing Teacher Registration ---');
    let teacher = await User.findOne({ where: { email: 'bilal.teacher@gmail.com' } });
    if (!teacher) {
      const hashedPassword = await bcrypt.hash('teacher123', 10);
      teacher = await User.create({
        name: 'Ustadh Bilal',
        email: 'bilal.teacher@gmail.com',
        mobileNumber: '+919876543220',
        password_hash: hashedPassword,
        password: hashedPassword,
        role: 'TEACHER',
        is_active: true,
        assigned_batches: [],
      });
      console.log('✅ Teacher Registered:', teacher.id, teacher.name, teacher.email);
    } else {
      console.log('ℹ️ Existing Teacher Found:', teacher.id, teacher.name);
    }

    console.log('\n--- 2. Testing Class / Batch Registration ---');
    let batch = await Batch.findOne({ where: { batch_code: 'MS-2026-AG1-01' } });
    if (!batch) {
      batch = await Batch.create({
        batch_code: 'MS-2026-AG1-01',
        name: 'Arabic Grammar Level 1 (Morning)',
        start_date: '2026-09-01',
        expected_end_date: '2026-12-31',
        schedule_days: ['MON', 'WED', 'FRI'],
        timing: { start_time: '07:00', end_time: '08:30', timezone: 'IST' },
        grace_period_mins: 15,
        instructor_id: teacher.id,
        status: 'ACTIVE',
        is_public: true,
      });
      console.log('✅ Class/Batch Registered:', batch.id, batch.name, 'Teacher ID:', batch.instructor_id);
    } else {
      console.log('ℹ️ Existing Class/Batch Found:', batch.id, batch.name);
    }

    console.log('\n--- 3. Testing Student Registration with Class ID ---');
    const roll_number = 'MS-2026-0002';
    let student = await Student.findOne({ where: { roll_number } });
    if (!student) {
      student = await Student.create({
        full_name: 'Tariq Mansoor',
        phone_number: '+919876500010',
        whatsapp_number: '+919876500010',
        parent_contact: { name: 'Mansoor Ali', phone: '+919876500011', relation: 'Father' },
        roll_number,
        barcode_data: 'MS20260002',
        qr_token: 'QR_98234abcf43142ab81ef9328472910fa',
        enrolled_batches: [{ batch_id: batch.id, enrollment_date: '2026-08-17', status: 'ACTIVE' }],
        regularity_score: 100.0,
        current_streak: 0,
        is_active: true,
      });
      console.log('✅ Student Registered with Class ID:', student.id, student.full_name, 'Enrolled Batch:', student.enrolled_batches);
    } else {
      console.log('ℹ️ Existing Student Found:', student.id, student.full_name);
    }

    console.log('\n🎉 Complete 3-tier flow verified successfully!');
    process.exit(0);
  } catch (err: any) {
    console.error('❌ Flow verification error:', err);
    process.exit(1);
  }
}

testFullFlow();
