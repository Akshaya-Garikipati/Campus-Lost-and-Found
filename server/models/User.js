const mongoose = require('mongoose');

/**
 * User Model Schema — InSearch Sai University
 * Represents registered students and campus security/administrative staff.
 *
 * PHASE 3 SECURITY REQUIREMENT NOTE:
 * The `password` field in this schema stores ONLY the one-way bcrypt password hash.
 * In Phase 3 API request validation (controllers/auth.js), incoming plaintext passwords
 * must be strictly validated to be at least 8 characters before hashing.
 * No minlength validation is placed on the stored hash field itself to prevent
 * coupling plaintext rules with 60-character bcrypt hash strings.
 */
const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Full name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [100, 'Name cannot exceed 100 characters']
    },
    email: {
      type: String,
      required: [true, 'University email address is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [
        /^[a-zA-Z0-9._%+-]+@saiuniversity\.edu\.in$/,
        'Registration is restricted to official university emails (@saiuniversity.edu.in)'
      ]
    },
    password: {
      type: String,
      required: [true, 'Password hash is required'],
      select: false // Excluded by default in queries for credential protection
    },
    studentId: {
      type: String,
      required: [
        function () {
          return this.role === 'student';
        },
        'Student ID / PRN is required for student accounts'
      ],
      trim: true,
      uppercase: true,
      maxlength: [30, 'Student ID cannot exceed 30 characters']
    },
    department: {
      type: String,
      trim: true,
      default: 'School of Computing & Data Science',
      maxlength: [120, 'Department cannot exceed 120 characters']
    },
    phone: {
      type: String,
      trim: true,
      default: ''
    },
    role: {
      type: String,
      enum: {
        values: ['student', 'admin'],
        message: '{VALUE} is not a valid user role. Allowed: student, admin'
      },
      default: 'student'
    },
    avatar: {
      type: String,
      default: function () {
        return `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(
          this.name || 'User'
        )}&backgroundColor=17382A&textColor=ffffff`;
      }
    },
    status: {
      type: String,
      enum: {
        values: ['active', 'suspended'],
        message: '{VALUE} is not a valid account status. Allowed: active, suspended'
      },
      default: 'active'
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Indexes
userSchema.index(
  { studentId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      studentId: { $type: 'string' }
    }
  }
);
userSchema.index({ role: 1 });

module.exports = mongoose.models.User || mongoose.model('User', userSchema);
