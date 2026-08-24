import { Student } from '../models/index.js';

async function run() {
  try {
    const existing = await Student.findOne({ where: { roll_number: 'MS-2026-0001' } });
    if (existing) {
      console.log('Existing student found:', existing.toJSON());
    } else {
      const student = await Student.create({
        full_name: 'Zaid Ahmed',
        phone_number: '+919876500001',
        whatsapp_number: '+919876500001',
        parent_contact: { name: 'Ahmed Khan', phone: '+919876500002', relation: 'Father' },
        roll_number: 'MS-2026-0001',
        barcode_data: 'MS20260001',
        qr_token: 'QR_d78f99e414164cb8ab67c6eb2d69cf39',
        enrolled_batches: [{ batch_id: 1, enrollment_date: '2026-08-17', status: 'ACTIVE' }],
        regularity_score: 100.0,
        current_streak: 0,
        is_active: true,
      });
      console.log('Created student:', student.toJSON());
    }
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

run();
