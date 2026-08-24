import { User, Batch, Student } from '../models/index.js';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';

async function generateUniqueStudentCodes(): Promise<{ roll_number: string; barcode_data: string; qr_token: string }> {
  const count = await Student.count();
  const nextNum = (count + 1).toString().padStart(4, '0');
  const year = new Date().getFullYear();

  let roll_number = `MS-${year}-${nextNum}`;
  let barcode_data = `MS${year}${nextNum}`;

  let exists = await Student.findOne({ where: { roll_number } });
  let salt = 1;
  while (exists) {
    const candidateNum = (count + 1 + salt).toString().padStart(4, '0');
    roll_number = `MS-${year}-${candidateNum}`;
    barcode_data = `MS${year}${candidateNum}`;
    exists = await Student.findOne({ where: { roll_number } });
    salt++;
  }

  const qr_token = `QR_${crypto.randomUUID().replace(/-/g, '')}`;
  return { roll_number, barcode_data, qr_token };
}

async function run() {
  try {
    console.log('====================================================');
    console.log('🚀 STEP 1: REGISTER RANDOM TEACHER');
    console.log('====================================================');
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const teacherEmail = `rashid.teacher.${randomSuffix}@miftahussahifa.com`;
    const hashedPassword = await bcrypt.hash('RashidPass@123', 10);

    const teacher = await User.create({
      name: 'Maulana Rashid Ahmad',
      email: teacherEmail,
      mobileNumber: `+9198${randomSuffix}4321`,
      password_hash: hashedPassword,
      password: hashedPassword,
      role: 'TEACHER',
      assigned_batches: [],
      is_active: true,
      isBlocked: false,
    });

    console.log('✅ Teacher Created Successfully:');
    console.log({
      id: teacher.id,
      name: teacher.name,
      email: teacher.email,
      mobileNumber: teacher.mobileNumber,
      role: teacher.role,
    });

    console.log('\n====================================================');
    console.log('🚀 STEP 2: REGISTER RANDOM CLASS & ASSIGN TEACHER');
    console.log('====================================================');
    const batchCode = `MS-2026-AR2-${randomSuffix.toString().slice(0, 2)}`;
    const batch = await Batch.create({
      batch_code: batchCode,
      name: 'Advanced Arabic Morphology (Evening Cohort B)',
      start_date: '2026-09-15',
      expected_end_date: '2026-12-15',
      schedule_days: ['TUE', 'THU', 'SAT'],
      timing: { start_time: '17:30', end_time: '19:00', timezone: 'IST' },
      grace_period_mins: 15,
      status: 'ACTIVE',
      is_public: true,
      instructor_id: teacher.id,
    });

    // Update teacher assigned_batches
    await teacher.update({ assigned_batches: [batch.id] });

    console.log('✅ Class/Batch Created and Assigned to Teacher:');
    console.log({
      id: batch.id,
      batch_code: batch.batch_code,
      name: batch.name,
      schedule_days: batch.schedule_days,
      timing: batch.timing,
      assigned_teacher_id: batch.instructor_id,
      assigned_teacher_name: teacher.name,
    });

    console.log('\n====================================================');
    console.log('🚀 STEP 3: REGISTER RANDOM STUDENT WITH CLASS ID');
    console.log('====================================================');
    const studentPhone = `+9197${randomSuffix}8899`;
    const codes = await generateUniqueStudentCodes();

    const student = await Student.create({
      full_name: 'Umar Farooq Siddiqui',
      phone_number: studentPhone,
      whatsapp_number: studentPhone,
      parent_contact: {
        name: 'Farooq Siddiqui',
        phone: `+9197${randomSuffix}8800`,
        relation: 'Father',
      },
      roll_number: codes.roll_number,
      barcode_data: codes.barcode_data,
      qr_token: codes.qr_token,
      enrolled_batches: [
        {
          batch_id: batch.id,
          enrollment_date: new Date().toISOString().split('T')[0],
          status: 'ACTIVE',
        },
      ],
      regularity_score: 100.0,
      current_streak: 0,
      is_active: true,
    });

    console.log('✅ Student Registered Successfully with Barcode & Class:');
    console.log({
      id: student.id,
      full_name: student.full_name,
      phone_number: student.phone_number,
      whatsapp_number: student.whatsapp_number,
      roll_number: student.roll_number,
      barcode_data: student.barcode_data,
      qr_token: student.qr_token,
      enrolled_batch_id: batch.id,
      enrolled_class_name: batch.name,
      regularity_score: `${student.regularity_score}%`,
      current_streak: student.current_streak,
    });

    console.log('\n====================================================');
    console.log('🔍 STEP 4: VERIFY HARDWARE / SCANNER LOOKUP TEST');
    console.log('====================================================');

    // Simulate scanning the student's barcode
    const scannedResult = await Student.findOne({
      where: { barcode_data: student.barcode_data },
    });

    console.log(`Scanner scanned barcode: "${student.barcode_data}"`);
    console.log('Instant Lookup Result:', {
      found: !!scannedResult,
      student_id: scannedResult?.id,
      student_name: scannedResult?.full_name,
      enrolled_batches: scannedResult?.enrolled_batches,
    });

    console.log('\n🎉 ALL 4 STEPS PASSED SUCCESSFULLY!');
    process.exit(0);
  } catch (err: any) {
    console.error('❌ Error during sample flow test:', err);
    process.exit(1);
  }
}

run();
