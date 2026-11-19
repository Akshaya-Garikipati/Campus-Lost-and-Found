const path = require('path');
const dotenv = require('dotenv');
const mongoose = require('mongoose');

// Load environment variables if running as standalone CLI script
if (require.main === module) {
  dotenv.config({ path: path.join(__dirname, '../.env') });
}

const User = require('../models/User');
const { hashPassword } = require('./password');
const { connectDB } = require('../config/db');

/**
 * Predefined Demo Users from frontend SAMPLE_USERS (js/sample-data.js)
 */
const DEMO_ACCOUNTS = [
  {
    name: 'Campus Security Admin',
    email: 'admin@saiuniversity.edu.in',
    role: 'admin',
    studentId: 'SAI-ADMIN-01',
    department: 'Campus Security & Safety',
    phone: '+91 98401 23456',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80',
    status: 'active',
    passwordType: 'admin'
  },
  {
    name: 'Akshaya Ramesh',
    email: 'akshaya@saiuniversity.edu.in',
    role: 'student',
    studentId: 'SAI2023CSE042',
    department: 'School of Computing & Data Science',
    phone: '+91 98412 34567',
    avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=150&q=80',
    status: 'active',
    passwordType: 'student'
  },
  {
    name: 'Rohan Verma',
    email: 'rohan.v@saiuniversity.edu.in',
    role: 'student',
    studentId: 'SAI2023ECE018',
    department: 'School of Engineering',
    phone: '+91 98765 43210',
    avatar: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=150&q=80',
    status: 'active',
    passwordType: 'student'
  },
  {
    name: 'Pooja Sundaram',
    email: 'pooja.s@saiuniversity.edu.in',
    role: 'student',
    studentId: 'SAI2024LAW009',
    department: 'School of Law',
    phone: '+91 94440 98765',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&q=80',
    status: 'active',
    passwordType: 'student'
  }
];

/**
 * Validates environment passwords and returns verified plaintext strings.
 * @throws {Error} If DEMO_ADMIN_PASSWORD or DEMO_STUDENT_PASSWORD is missing or < 8 chars
 */
function validateDemoPasswords() {
  const adminPassword = process.env.DEMO_ADMIN_PASSWORD;
  const studentPassword = process.env.DEMO_STUDENT_PASSWORD;

  if (!adminPassword || typeof adminPassword !== 'string' || adminPassword.trim().length < 8) {
    throw new Error(
      'DEMO_ADMIN_PASSWORD environment variable is missing, empty, or shorter than 8 characters.'
    );
  }

  if (!studentPassword || typeof studentPassword !== 'string' || studentPassword.trim().length < 8) {
    throw new Error(
      'DEMO_STUDENT_PASSWORD environment variable is missing, empty, or shorter than 8 characters.'
    );
  }

  return { adminPassword, studentPassword };
}

/**
 * Seeds demo accounts into MongoDB idempotently.
 * Never modifies or overwrites existing account records.
 * Reports conflicts if an account exists with mismatched roles or attributes.
 *
 * @param {Object} [options={}]
 * @param {boolean} [options.silent=false] Suppresses console logs if true
 * @returns {Promise<Object>} Seeding statistics { created, skipped, conflicts }
 */
async function seedDemoUsers(options = {}) {
  const silent = options.silent === true;
  const log = (...args) => {
    if (!silent) console.log(...args);
  };
  const warn = (...args) => {
    if (!silent) console.warn(...args);
  };

  // 1. Validate environment configuration before any database operations
  const { adminPassword, studentPassword } = validateDemoPasswords();

  const stats = {
    total: DEMO_ACCOUNTS.length,
    created: 0,
    skipped: 0,
    conflicts: 0
  };

  log('🌱 Starting InSearch Demo Users Seeder...');

  // 2. Iterate through all 4 demo accounts
  for (const account of DEMO_ACCOUNTS) {
    try {
      // Check existing by email
      const existingByEmail = await User.findOne({ email: account.email });

      if (existingByEmail) {
        // Check for privilege or role conflicts
        const roleMismatch = existingByEmail.role !== account.role;
        const statusMismatch = existingByEmail.status !== account.status;
        const studentIdMismatch =
          account.studentId &&
          existingByEmail.studentId &&
          existingByEmail.studentId !== account.studentId;

        if (roleMismatch || statusMismatch || studentIdMismatch) {
          warn(
            `⚠️  [CONFLICT] Account ${account.email} already exists with conflicting properties: ` +
              `role='${existingByEmail.role}' (expected '${account.role}'), ` +
              `status='${existingByEmail.status}' (expected '${account.status}'). ` +
              `Preserving existing database record without modification.`
          );
          stats.conflicts++;
        } else {
          log(`ℹ️  [SKIPPED] Demo ${account.role} account already exists: ${account.email} (preserved)`);
          stats.skipped++;
        }
        continue;
      }

      // Check existing by studentId to prevent index collision
      if (account.studentId) {
        const existingById = await User.findOne({ studentId: account.studentId });
        if (existingById) {
          warn(
            `⚠️  [CONFLICT] Student ID '${account.studentId}' is already registered to ${existingById.email}. ` +
              `Cannot seed ${account.email}. Preserving existing database record.`
          );
          stats.conflicts++;
          continue;
        }
      }

      // Hash password using 12 salt rounds (never stored or logged in plaintext)
      const plainPassword = account.passwordType === 'admin' ? adminPassword : studentPassword;
      const hashedPassword = await hashPassword(plainPassword);

      // Create new user in database
      await User.create({
        name: account.name,
        email: account.email,
        password: hashedPassword,
        studentId: account.studentId,
        department: account.department,
        phone: account.phone,
        avatar: account.avatar,
        role: account.role,
        status: account.status
      });

      log(`✓  [CREATED] Seeded demo ${account.role} account: ${account.email}`);
      stats.created++;
    } catch (err) {
      if (err.code === 11000) {
        warn(`⚠️  [CONFLICT] Duplicate key detected during insertion for ${account.email}. Preserved existing record.`);
        stats.conflicts++;
      } else {
        throw err;
      }
    }
  }

  log(`\n====================================================`);
  log(`📊 Seeding Complete: ${stats.created} created, ${stats.skipped} skipped, ${stats.conflicts} conflicts`);
  log(`====================================================`);

  return stats;
}

/**
 * Standalone CLI runner
 */
if (require.main === module) {
  (async () => {
    let connection = null;
    try {
      connection = await connectDB();
      if (!connection) {
        console.error('❌ Cannot run seeder: MongoDB connection failed.');
        process.exit(1);
      }

      await seedDemoUsers();
      process.exit(0);
    } catch (error) {
      console.error(`❌ Seeding aborted: ${error.message}`);
      process.exit(1);
    } finally {
      if (mongoose.connection && mongoose.connection.readyState !== 0) {
        await mongoose.disconnect();
      }
    }
  })();
}

module.exports = {
  seedDemoUsers,
  validateDemoPasswords,
  DEMO_ACCOUNTS
};
