import { Op } from 'sequelize';
import { sequelize, Student, Batch, ClassSession, AttendanceLog } from '../models/index.js';

export interface StudentHistoryRecord {
  name: string;
  phone: string;
  attendance: { [dateStr: string]: 'PRESENT' | 'ABSENT' | null };
}

// 1. Medicos 30 Mon/Tue (Boys Register)
export const BOYS_ATTENDANCE: StudentHistoryRecord[] = [
  {
    name: 'Waseem Syed Siddiqui',
    phone: '9049894953',
    attendance: {
      '2026-08-11': 'PRESENT',
      '2026-08-17': 'ABSENT',
      '2026-08-18': 'ABSENT',
      '2026-08-24': 'PRESENT',
      '2026-08-25': 'PRESENT',
      '2026-08-31': 'PRESENT',
      '2026-09-01': 'PRESENT',
      '2026-09-07': 'PRESENT',
      '2026-09-08': 'PRESENT',
    },
  },
  {
    name: 'A-Hamid',
    phone: '7666643841',
    attendance: {
      '2026-08-11': 'PRESENT',
      '2026-08-17': 'PRESENT',
      '2026-08-18': 'PRESENT',
      '2026-08-24': 'PRESENT',
      '2026-08-25': 'PRESENT',
      '2026-08-31': 'PRESENT',
      '2026-09-01': 'PRESENT',
      '2026-09-07': 'PRESENT',
      '2026-09-08': 'PRESENT',
    },
  },
  {
    name: 'Anwar Sayyed',
    phone: '9960784403',
    attendance: {
      '2026-08-11': 'ABSENT',
      '2026-08-17': 'PRESENT',
      '2026-08-18': 'PRESENT',
      '2026-08-24': 'ABSENT',
      '2026-08-25': 'PRESENT',
      '2026-08-31': 'PRESENT',
      '2026-09-01': 'PRESENT',
      '2026-09-07': 'PRESENT',
      '2026-09-08': 'PRESENT',
    },
  },
  {
    name: 'Tarique Anwar',
    phone: '7972363692',
    attendance: {
      '2026-08-11': 'PRESENT',
      '2026-08-17': 'PRESENT',
      '2026-08-18': 'PRESENT',
      '2026-08-24': 'PRESENT',
      '2026-08-25': 'PRESENT',
      '2026-08-31': 'PRESENT',
      '2026-09-01': 'PRESENT',
      '2026-09-07': 'PRESENT',
      '2026-09-08': 'PRESENT',
    },
  },
  {
    name: 'Syed Qamaruddin',
    phone: '9422177551',
    attendance: {
      '2026-08-11': 'ABSENT',
      '2026-08-17': 'PRESENT',
      '2026-08-18': 'PRESENT',
    },
  },
  {
    name: 'Rehan Patel',
    phone: '7057015785',
    attendance: {
      '2026-08-11': 'PRESENT',
      '2026-08-17': 'PRESENT',
      '2026-08-18': 'ABSENT',
      '2026-08-24': 'PRESENT',
      '2026-08-25': 'PRESENT',
      '2026-08-31': 'PRESENT',
      '2026-09-01': 'PRESENT',
      '2026-09-07': 'PRESENT',
      '2026-09-08': 'PRESENT',
    },
  },
  {
    name: 'Shaikh Umais',
    phone: '7800313313',
    attendance: {
      '2026-08-11': 'ABSENT',
      '2026-08-17': 'PRESENT',
      '2026-08-18': 'PRESENT',
      '2026-08-24': 'PRESENT',
      '2026-08-25': 'PRESENT',
      '2026-08-31': 'PRESENT',
      '2026-09-01': 'PRESENT',
      '2026-09-07': 'PRESENT',
      '2026-09-08': 'PRESENT',
    },
  },
  {
    name: 'Altaf Khan',
    phone: '7040182872',
    attendance: {
      '2026-08-11': 'PRESENT',
      '2026-08-17': 'PRESENT',
      '2026-08-18': 'PRESENT',
      '2026-08-24': 'PRESENT',
      '2026-08-25': 'PRESENT',
      '2026-08-31': 'PRESENT',
      '2026-09-01': 'PRESENT',
      '2026-09-07': 'PRESENT',
      '2026-09-08': 'PRESENT',
    },
  },
  {
    name: 'Umar Farooque',
    phone: '7385730021',
    attendance: {
      '2026-08-11': 'ABSENT',
      '2026-08-17': 'ABSENT',
      '2026-08-18': 'ABSENT',
      '2026-08-24': 'PRESENT',
      '2026-08-25': 'PRESENT',
    },
  },
  {
    name: 'MD Zohaib',
    phone: '8669165941',
    attendance: {
      '2026-08-11': 'PRESENT',
      '2026-08-17': 'PRESENT',
      '2026-08-18': 'PRESENT',
      '2026-08-24': 'PRESENT',
      '2026-08-25': 'PRESENT',
      '2026-08-31': 'PRESENT',
      '2026-09-01': 'PRESENT',
      '2026-09-07': 'PRESENT',
      '2026-09-08': 'PRESENT',
    },
  },
  {
    name: 'Mohammad Sameeuddin',
    phone: '9422715097',
    attendance: {
      '2026-08-11': 'PRESENT',
      '2026-08-17': 'PRESENT',
      '2026-08-18': 'PRESENT',
      '2026-08-24': 'PRESENT',
      '2026-08-25': 'PRESENT',
      '2026-08-31': 'PRESENT',
      '2026-09-01': 'PRESENT',
      '2026-09-07': 'PRESENT',
      '2026-09-08': 'PRESENT',
    },
  },
  {
    name: 'Sufiyan Kasmi',
    phone: '8308998886',
    attendance: {
      '2026-08-11': 'ABSENT',
      '2026-08-17': 'ABSENT',
      '2026-08-18': 'ABSENT',
      '2026-08-24': 'PRESENT',
      '2026-08-25': 'PRESENT',
      '2026-08-31': 'PRESENT',
      '2026-09-01': 'PRESENT',
      '2026-09-07': 'PRESENT',
      '2026-09-08': 'PRESENT',
    },
  },
  {
    name: 'Sayyed Faraz Nehri',
    phone: '9561812966',
    attendance: {
      '2026-08-11': 'ABSENT',
      '2026-08-17': 'PRESENT',
      '2026-08-18': 'PRESENT',
      '2026-08-24': 'ABSENT',
      '2026-08-25': 'PRESENT',
      '2026-08-31': 'PRESENT',
      '2026-09-01': 'PRESENT',
      '2026-09-07': 'PRESENT',
      '2026-09-08': 'PRESENT',
    },
  },
  {
    name: 'Mudassir Khan',
    phone: '9895688388',
    attendance: {
      '2026-08-11': 'PRESENT',
      '2026-08-17': 'PRESENT',
      '2026-08-18': 'PRESENT',
      '2026-08-24': 'ABSENT',
      '2026-08-25': 'PRESENT',
      '2026-09-01': 'PRESENT',
      '2026-09-07': 'PRESENT',
      '2026-09-08': 'PRESENT',
    },
  },
  {
    name: 'Syed Rizwan',
    phone: '9860053123',
    attendance: {
      '2026-08-11': 'PRESENT',
      '2026-08-17': 'ABSENT',
      '2026-08-18': 'ABSENT',
      '2026-08-24': 'PRESENT',
      '2026-08-25': 'PRESENT',
      '2026-08-31': 'PRESENT',
      '2026-09-01': 'PRESENT',
      '2026-09-07': 'PRESENT',
      '2026-09-08': 'PRESENT',
    },
  },
  {
    name: 'Junaid Ahmad Khan',
    phone: '8668426629',
    attendance: {
      '2026-08-11': 'PRESENT',
      '2026-08-17': 'PRESENT',
      '2026-08-18': 'ABSENT',
      '2026-08-24': 'PRESENT',
      '2026-08-25': 'PRESENT',
      '2026-08-31': 'PRESENT',
      '2026-09-01': 'PRESENT',
      '2026-09-07': 'PRESENT',
      '2026-09-08': 'PRESENT',
    },
  },
  {
    name: 'A. Aziz Khan',
    phone: '9860194248',
    attendance: {
      '2026-08-11': 'PRESENT',
      '2026-08-17': 'PRESENT',
      '2026-08-18': 'PRESENT',
      '2026-08-24': 'PRESENT',
      '2026-08-25': 'PRESENT',
      '2026-08-31': 'PRESENT',
      '2026-09-01': 'PRESENT',
      '2026-09-07': 'PRESENT',
      '2026-09-08': 'PRESENT',
    },
  },
  {
    name: 'Taufiq Ahmad Siddiqui',
    phone: '8275003454',
    attendance: {
      '2026-08-11': 'PRESENT',
      '2026-08-17': 'PRESENT',
      '2026-08-18': 'PRESENT',
      '2026-08-24': 'PRESENT',
      '2026-08-25': 'PRESENT',
      '2026-08-31': 'PRESENT',
      '2026-09-01': 'PRESENT',
      '2026-09-07': 'PRESENT',
      '2026-09-08': 'PRESENT',
    },
  },
  {
    name: 'Syed Asifuddin',
    phone: '9923069273',
    attendance: {
      '2026-08-11': 'PRESENT',
      '2026-08-17': 'PRESENT',
      '2026-08-18': 'PRESENT',
      '2026-08-24': 'PRESENT',
      '2026-08-25': 'PRESENT',
      '2026-08-31': 'PRESENT',
      '2026-09-01': 'PRESENT',
      '2026-09-07': 'PRESENT',
      '2026-09-08': 'PRESENT',
    },
  },
  {
    name: 'Mohammad Kausaruddin',
    phone: '9762739837',
    attendance: {
      '2026-08-11': 'PRESENT',
      '2026-08-17': 'PRESENT',
      '2026-08-18': 'PRESENT',
      '2026-08-24': 'PRESENT',
      '2026-08-25': 'PRESENT',
      '2026-08-31': 'PRESENT',
      '2026-09-01': 'PRESENT',
      '2026-09-07': 'PRESENT',
      '2026-09-08': 'PRESENT',
    },
  },
  {
    name: 'Awais Farooqui',
    phone: '9834097922',
    attendance: {
      '2026-08-11': 'PRESENT',
      '2026-08-17': 'PRESENT',
      '2026-08-18': 'PRESENT',
      '2026-08-24': 'PRESENT',
      '2026-08-25': 'PRESENT',
      '2026-08-31': 'PRESENT',
      '2026-09-01': 'PRESENT',
      '2026-09-07': 'PRESENT',
      '2026-09-08': 'PRESENT',
    },
  },
  {
    name: 'Parvez Farooqui',
    phone: '8308748888',
    attendance: {
      '2026-08-11': 'PRESENT',
      '2026-08-17': 'PRESENT',
      '2026-08-18': 'PRESENT',
      '2026-08-24': 'PRESENT',
      '2026-08-25': 'PRESENT',
      '2026-08-31': 'ABSENT',
      '2026-09-01': 'PRESENT',
      '2026-09-07': 'PRESENT',
      '2026-09-08': 'PRESENT',
    },
  },
  {
    name: 'Syed Raifuddin Nehri',
    phone: '9890241252',
    attendance: {
      '2026-08-11': 'PRESENT',
      '2026-08-17': 'PRESENT',
      '2026-08-18': 'PRESENT',
      '2026-08-24': 'PRESENT',
      '2026-08-25': 'PRESENT',
      '2026-08-31': 'PRESENT',
      '2026-09-01': 'PRESENT',
      '2026-09-07': 'PRESENT',
      '2026-09-08': 'PRESENT',
    },
  },
  {
    name: 'Nadeem Chaudhari',
    phone: '9371712771',
    attendance: {
      '2026-08-11': 'PRESENT',
      '2026-08-17': 'PRESENT',
      '2026-08-18': 'PRESENT',
      '2026-08-24': 'PRESENT',
      '2026-08-25': 'PRESENT',
      '2026-08-31': 'PRESENT',
      '2026-09-01': 'PRESENT',
      '2026-09-07': 'PRESENT',
      '2026-09-08': 'PRESENT',
    },
  },
  {
    name: 'Farooq Khan',
    phone: '9764999556',
    attendance: {
      '2026-08-11': 'PRESENT',
      '2026-08-17': 'PRESENT',
      '2026-08-18': 'PRESENT',
      '2026-08-24': 'PRESENT',
      '2026-08-25': 'ABSENT',
      '2026-08-31': 'PRESENT',
      '2026-09-01': 'PRESENT',
      '2026-09-07': 'PRESENT',
      '2026-09-08': 'PRESENT',
    },
  },
  {
    name: 'Abdul Rafe Sultan',
    phone: '9960028647',
    attendance: {
      '2026-08-11': 'PRESENT',
      '2026-08-18': 'PRESENT',
      '2026-08-24': 'PRESENT',
      '2026-08-25': 'PRESENT',
      '2026-08-31': 'PRESENT',
      '2026-09-01': 'PRESENT',
      '2026-09-07': 'PRESENT',
      '2026-09-08': 'PRESENT',
    },
  },
  {
    name: 'Abdul Muqsit',
    phone: '9175281752',
    attendance: {
      '2026-08-11': 'PRESENT',
      '2026-08-17': 'ABSENT',
      '2026-08-18': 'PRESENT',
      '2026-08-24': 'PRESENT',
      '2026-08-25': 'PRESENT',
      '2026-09-01': 'PRESENT',
      '2026-09-08': 'PRESENT',
    },
  },
  {
    name: 'Mohd. Misbah',
    phone: '9823839999',
    attendance: {
      '2026-08-17': 'PRESENT',
      '2026-08-18': 'PRESENT',
      '2026-08-24': 'PRESENT',
      '2026-08-25': 'PRESENT',
      '2026-08-31': 'ABSENT',
      '2026-09-01': 'ABSENT',
    },
  },
  {
    name: 'Khan Jameel Ahmed',
    phone: '9423711878',
    attendance: {
      '2026-08-11': 'ABSENT',
      '2026-08-17': 'ABSENT',
      '2026-08-18': 'ABSENT',
      '2026-08-24': 'ABSENT',
      '2026-08-25': 'PRESENT',
      '2026-08-31': 'PRESENT',
      '2026-09-01': 'PRESENT',
      '2026-09-07': 'PRESENT',
      '2026-09-08': 'PRESENT',
    },
  },
];

// 2. Medicos 30 (Ladies Register)
export const LADIES_ATTENDANCE: StudentHistoryRecord[] = [
  {
    name: 'Tehleel Parvez',
    phone: '9922331662',
    attendance: {
      '2026-07-14': 'PRESENT',
      '2026-07-20': 'PRESENT',
      '2026-07-21': 'PRESENT',
      '2026-07-27': 'PRESENT',
      '2026-08-03': 'PRESENT',
      '2026-08-04': 'PRESENT',
      '2026-08-10': 'PRESENT',
      '2026-08-11': 'PRESENT',
      '2026-08-17': 'PRESENT',
      '2026-08-18': 'PRESENT',
      '2026-08-24': 'PRESENT',
      '2026-08-25': 'PRESENT',
      '2026-08-31': 'PRESENT',
      '2026-09-01': 'PRESENT',
      '2026-09-07': 'PRESENT',
      '2026-09-08': 'PRESENT',
    },
  },
  {
    name: 'Nuzhat Parvez',
    phone: '9518313135',
    attendance: {
      '2026-07-14': 'PRESENT',
      '2026-07-20': 'PRESENT',
      '2026-07-21': 'PRESENT',
      '2026-07-27': 'PRESENT',
      '2026-08-03': 'PRESENT',
      '2026-08-04': 'PRESENT',
      '2026-08-10': 'PRESENT',
      '2026-08-11': 'PRESENT',
      '2026-08-17': 'PRESENT',
      '2026-08-18': 'PRESENT',
      '2026-08-24': 'PRESENT',
      '2026-08-25': 'PRESENT',
      '2026-08-31': 'PRESENT',
      '2026-09-01': 'PRESENT',
      '2026-09-07': 'PRESENT',
      '2026-09-08': 'PRESENT',
    },
  },
  {
    name: 'Shaikh Zainab Fatima',
    phone: '9359150524',
    attendance: {
      '2026-07-14': 'PRESENT',
      '2026-07-20': 'PRESENT',
      '2026-07-21': 'PRESENT',
      '2026-07-27': 'PRESENT',
      '2026-08-03': 'PRESENT',
      '2026-08-04': 'PRESENT',
      '2026-08-10': 'PRESENT',
      '2026-08-11': 'PRESENT',
      '2026-08-17': 'PRESENT',
      '2026-08-18': 'PRESENT',
      '2026-08-24': 'PRESENT',
      '2026-08-25': 'PRESENT',
      '2026-08-31': 'PRESENT',
      '2026-09-01': 'PRESENT',
      '2026-09-07': 'PRESENT',
      '2026-09-08': 'PRESENT',
    },
  },
  {
    name: 'Asiya Sultana',
    phone: '9673217040',
    attendance: {
      '2026-07-14': 'PRESENT',
      '2026-07-20': 'PRESENT',
      '2026-07-21': 'PRESENT',
      '2026-07-27': 'PRESENT',
      '2026-08-03': 'PRESENT',
      '2026-08-04': 'PRESENT',
      '2026-08-10': 'PRESENT',
      '2026-08-11': 'PRESENT',
      '2026-08-17': 'PRESENT',
      '2026-08-18': 'PRESENT',
      '2026-08-24': 'PRESENT',
      '2026-08-25': 'PRESENT',
      '2026-08-31': 'PRESENT',
      '2026-09-01': 'PRESENT',
      '2026-09-07': 'PRESENT',
      '2026-09-08': 'PRESENT',
    },
  },
  {
    name: 'Shamim Sultana',
    phone: '9890507642',
    attendance: {
      '2026-07-14': 'PRESENT',
      '2026-07-20': 'ABSENT',
      '2026-07-21': 'PRESENT',
      '2026-08-03': 'PRESENT',
      '2026-08-04': 'PRESENT',
      '2026-08-10': 'PRESENT',
      '2026-08-11': 'PRESENT',
      '2026-08-17': 'PRESENT',
      '2026-08-18': 'PRESENT',
      '2026-08-24': 'PRESENT',
      '2026-08-25': 'PRESENT',
      '2026-08-31': 'PRESENT',
      '2026-09-01': 'PRESENT',
      '2026-09-07': 'PRESENT',
      '2026-09-08': 'PRESENT',
    },
  },
  {
    name: 'Asra Parvez',
    phone: '9970670786',
    attendance: {
      '2026-07-14': 'PRESENT',
      '2026-07-20': 'PRESENT',
      '2026-07-21': 'PRESENT',
      '2026-07-27': 'PRESENT',
      '2026-08-03': 'PRESENT',
      '2026-08-10': 'PRESENT',
      '2026-08-11': 'PRESENT',
      '2026-08-17': 'PRESENT',
      '2026-08-18': 'PRESENT',
      '2026-08-24': 'PRESENT',
      '2026-08-25': 'PRESENT',
      '2026-08-31': 'PRESENT',
      '2026-09-01': 'PRESENT',
      '2026-09-07': 'PRESENT',
      '2026-09-08': 'PRESENT',
    },
  },
  {
    name: 'Khadija Fatima',
    phone: '7620265441',
    attendance: {
      '2026-07-14': 'PRESENT',
      '2026-07-20': 'PRESENT',
      '2026-07-21': 'PRESENT',
      '2026-07-27': 'PRESENT',
      '2026-08-03': 'PRESENT',
      '2026-08-04': 'PRESENT',
      '2026-08-10': 'PRESENT',
    },
  },
  {
    name: 'Fauzia Fatima',
    phone: '9049733887',
    attendance: {
      '2026-07-14': 'PRESENT',
      '2026-07-20': 'PRESENT',
      '2026-07-21': 'PRESENT',
      '2026-07-27': 'PRESENT',
      '2026-08-03': 'PRESENT',
      '2026-08-04': 'PRESENT',
      '2026-08-10': 'PRESENT',
    },
  },
  {
    name: 'Afroz Anjum',
    phone: '8485833979',
    attendance: {
      '2026-07-14': 'PRESENT',
      '2026-07-20': 'PRESENT',
      '2026-07-27': 'PRESENT',
      '2026-08-03': 'PRESENT',
      '2026-08-04': 'PRESENT',
      '2026-08-10': 'PRESENT',
      '2026-08-11': 'PRESENT',
      '2026-08-18': 'PRESENT',
      '2026-08-25': 'PRESENT',
      '2026-08-31': 'PRESENT',
      '2026-09-01': 'PRESENT',
      '2026-09-07': 'PRESENT',
      '2026-09-08': 'PRESENT',
    },
  },
  {
    name: 'Khadija Tul Kubra',
    phone: '8605215404',
    attendance: {
      '2026-07-20': 'PRESENT',
      '2026-07-21': 'PRESENT',
      '2026-07-27': 'PRESENT',
      '2026-08-03': 'PRESENT',
      '2026-08-04': 'PRESENT',
      '2026-08-10': 'PRESENT',
      '2026-08-17': 'PRESENT',
      '2026-08-18': 'PRESENT',
      '2026-08-31': 'PRESENT',
      '2026-09-01': 'PRESENT',
      '2026-09-07': 'PRESENT',
      '2026-09-08': 'PRESENT',
    },
  },
  {
    name: 'Mubashira Amreen',
    phone: '8805029834',
    attendance: {
      '2026-07-20': 'PRESENT',
      '2026-07-21': 'PRESENT',
      '2026-07-27': 'PRESENT',
      '2026-08-03': 'PRESENT',
      '2026-08-04': 'PRESENT',
      '2026-08-10': 'PRESENT',
      '2026-08-17': 'PRESENT',
      '2026-08-18': 'PRESENT',
      '2026-08-24': 'PRESENT',
      '2026-08-31': 'PRESENT',
      '2026-09-01': 'PRESENT',
      '2026-09-07': 'PRESENT',
      '2026-09-08': 'PRESENT',
    },
  },
  {
    name: 'Syeda Afshan',
    phone: '8806033300',
    attendance: {
      '2026-07-14': 'PRESENT',
      '2026-08-03': 'PRESENT',
      '2026-08-04': 'PRESENT',
      '2026-08-17': 'PRESENT',
      '2026-08-18': 'PRESENT',
    },
  },
  {
    name: 'Nazish Uzair Sk.',
    phone: '9921861991',
    attendance: {
      '2026-07-27': 'PRESENT',
      '2026-08-03': 'PRESENT',
      '2026-08-04': 'PRESENT',
      '2026-08-17': 'PRESENT',
      '2026-08-18': 'PRESENT',
      '2026-08-24': 'PRESENT',
      '2026-08-25': 'PRESENT',
      '2026-08-31': 'PRESENT',
      '2026-09-01': 'PRESENT',
      '2026-09-07': 'PRESENT',
      '2026-09-08': 'PRESENT',
    },
  },
  {
    name: 'Parween Choudhari',
    phone: '9423541126',
    attendance: {
      '2026-08-11': 'PRESENT',
      '2026-08-17': 'PRESENT',
      '2026-08-18': 'PRESENT',
      '2026-08-24': 'PRESENT',
      '2026-08-25': 'PRESENT',
      '2026-08-31': 'PRESENT',
      '2026-09-01': 'ABSENT',
      '2026-09-07': 'PRESENT',
      '2026-09-08': 'PRESENT',
    },
  },
  {
    name: 'Nargis A. Rasheed',
    phone: '9420315791',
    attendance: {
      '2026-09-01': 'PRESENT',
      '2026-09-07': 'PRESENT',
      '2026-09-08': 'PRESENT',
    },
  },
  {
    name: 'Shamshis A. Sk',
    phone: '8007239363',
    attendance: {
      '2026-09-07': 'PRESENT',
      '2026-09-08': 'PRESENT',
    },
  },
  {
    name: 'Shahjehan A. Sh.',
    phone: '9975005065',
    attendance: {
      '2026-09-07': 'PRESENT',
      '2026-09-08': 'PRESENT',
    },
  },
];

/**
 * Sync function that creates missing students/sessions and logs historical attendance records
 */
export async function syncPreviousMedicosAttendance(): Promise<void> {
  console.log('🔄 [AttendanceSync] Starting previous attendance sync for Medicos 30 Mon/Tue...');

  try {
    // 1. Locate or create Batch 'Medicos 30 Mon/Tue'
    let batch = await Batch.findOne({
      where: { name: 'Medicos 30 Mon/Tue' },
    });

    if (!batch) {
      batch = await Batch.findOne({
        where: { id: 3 },
      });
    }

    if (!batch) {
      batch = await Batch.create({
        name: 'Medicos 30 Mon/Tue',
        batch_code: 'MS-2026-M3M-03',
        start_date: '2026-08-11',
        schedule_days: ['MON', 'TUE'],
        timing: { start_time: '17:30', end_time: '18:30', timezone: 'IST' },
        grace_period_mins: 15,
        status: 'ACTIVE',
        is_public: true,
      });
      console.log('✅ Created batch Medicos 30 Mon/Tue with ID:', batch.id);
    } else {
      console.log(`ℹ️ Using batch: ${batch.name} (ID: ${batch.id})`);
    }

    const allRegisters = [
      { label: 'Boys Register', records: BOYS_ATTENDANCE },
      { label: 'Ladies Register', records: LADIES_ATTENDANCE },
    ];

    let totalSynced = 0;
    let studentsProcessed = 0;

    for (const group of allRegisters) {
      console.log(`\n📋 Processing ${group.label} (${group.records.length} students)...`);

      for (const record of group.records) {
        // Clean digits
        const cleanPhone = record.phone.replace(/\D/g, '');

        // Find student by phone or exact name
        let student = await Student.findOne({
          where: {
            [Op.or]: [
              { phone_number: cleanPhone },
              { whatsapp_number: cleanPhone },
              { full_name: record.name },
            ],
          },
        });

        if (!student) {
          // Generate a guaranteed unique roll number
          const latestStudent = await Student.findOne({ order: [['id', 'DESC']] });
          let nextCounter = (latestStudent ? latestStudent.id : 0) + 1;
          let rollNumber = `MS-2026-${String(nextCounter).padStart(4, '0')}`;
          while (await Student.findOne({ where: { roll_number: rollNumber } })) {
            nextCounter++;
            rollNumber = `MS-2026-${String(nextCounter).padStart(4, '0')}`;
          }

          const username = (cleanPhone.length >= 4 ? `user${cleanPhone.slice(-4)}` : `user${nextCounter}`).toLowerCase();

          student = await Student.create({
            roll_number: rollNumber,
            username,
            full_name: record.name,
            phone_number: cleanPhone,
            whatsapp_number: cleanPhone,
            barcode_data: rollNumber,
            qr_token: `token_${cleanPhone || rollNumber}`,
            enrolled_batches: [
              {
                batch_id: batch.id,
                enrollment_date: '2026-08-11',
                status: 'ACTIVE',
              },
            ],
            current_streak: 0,
            regularity_score: 100,
            is_active: true,
          });
          console.log(`➕ Enrolled new student: ${record.name} (${cleanPhone}) -> ${rollNumber}`);
        } else {
          // Ensure student is enrolled in batch 3
          let enrolledArr: any[] = [];
          try {
            if (Array.isArray(student.enrolled_batches)) enrolledArr = student.enrolled_batches;
            else if (typeof student.enrolled_batches === 'string') enrolledArr = JSON.parse(student.enrolled_batches || '[]');
          } catch {
            enrolledArr = [];
          }

          if (!enrolledArr.some((b: any) => b.batch_id === batch.id)) {
            enrolledArr.push({
              batch_id: batch.id,
              enrollment_date: '2026-08-11',
              status: 'ACTIVE',
            });
            await student.update({ enrolled_batches: enrolledArr });
          }
        }

        studentsProcessed++;

        // Process each attendance date
        for (const [dateStr, status] of Object.entries(record.attendance)) {
          if (!status) continue;

          // 1. Find or create ClassSession for this date
          let session = await ClassSession.findOne({
            where: {
              batch_id: batch.id,
              session_date: dateStr,
            },
          });

          if (!session) {
            const [y, m, d] = dateStr.split('-').map(Number);
            const sessionDateObj = new Date(y, m - 1, d, 17, 30, 0);

            session = await ClassSession.create({
              batch_id: batch.id,
              session_date: dateStr,
              actual_start_time: sessionDateObj,
              status: 'COMPLETED',
              summary: {
                total_enrolled: group.records.length,
                present: 0,
                late: 0,
                absent: 0,
              },
            });
          }

          // 2. Find or create AttendanceLog
          const existingLog = await AttendanceLog.findOne({
            where: {
              session_id: session.id,
              student_id: student.id,
            },
          });

          const [y, m, d] = dateStr.split('-').map(Number);
          const scanTime = new Date(y, m - 1, d, 17, 45, 0);

          if (!existingLog) {
            await AttendanceLog.create({
              session_id: session.id,
              batch_id: batch.id,
              student_id: student.id,
              scan_timestamp: scanTime,
              status: status,
              scan_method: 'MANUAL_OVERRIDE',
              scanned_code: student.roll_number,
              marked_by: 1,
              notes: `Historical physical register sync (${dateStr})`,
            });
            totalSynced++;
          } else if (existingLog.status !== status) {
            await existingLog.update({
              status: status,
              notes: `Historical register sync update (${dateStr})`,
            });
            totalSynced++;
          }
        }

        // Calculate and update student streak
        const presentLogsCount = await AttendanceLog.count({
          where: {
            student_id: student.id,
            status: 'PRESENT',
          },
        });
        await student.update({ current_streak: presentLogsCount });
      }
    }

    console.log(`\n🎉 [AttendanceSync] Sync complete! Processed ${studentsProcessed} students, created/updated ${totalSynced} historical attendance logs.`);
  } catch (err) {
    console.error('❌ [AttendanceSync] Sync failed:', err);
  }
}

// Standalone execution if run via tsx / node
if (process.argv[1]?.includes('syncPreviousAttendance')) {
  (async () => {
    await sequelize.authenticate();
    await syncPreviousMedicosAttendance();
    process.exit(0);
  })();
}
