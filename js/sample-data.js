/**
 * InSearch — Sai University Lost & Found Portal
 * Realistic Seed Data for Sai University Campus
 */

const SAMPLE_USERS = [
  {
    id: "usr_admin_01",
    name: "Campus Security Admin",
    email: "admin@saiuniversity.edu.in",
    role: "admin",
    studentId: "SAI-ADMIN-01",
    department: "Campus Security & Safety",
    phone: "+91 98401 23456",
    avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80"
  },
  {
    id: "usr_student_01",
    name: "Akshaya Ramesh",
    email: "akshaya@saiuniversity.edu.in",
    role: "student",
    studentId: "SAI2023CSE042",
    department: "School of Computing & Data Science",
    phone: "+91 98412 34567",
    avatar: "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=150&q=80"
  },
  {
    id: "usr_student_02",
    name: "Rohan Verma",
    email: "rohan.v@saiuniversity.edu.in",
    role: "student",
    studentId: "SAI2023ECE018",
    department: "School of Engineering",
    phone: "+91 98765 43210",
    avatar: "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=150&q=80"
  },
  {
    id: "usr_student_03",
    name: "Pooja Sundaram",
    email: "pooja.s@saiuniversity.edu.in",
    role: "student",
    studentId: "SAI2024LAW009",
    department: "School of Law",
    phone: "+91 94440 98765",
    avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&q=80"
  }
];

const SAMPLE_ITEMS = [
  {
    id: "item_01",
    title: "MacBook Air M2 (Midnight)",
    type: "found",
    category: "Electronics",
    location: "Central Library",
    specificLocation: "2nd Floor Quiet Study Hall, Desk #14",
    date: "2026-11-09",
    description: "Found a 13-inch MacBook Air M2 in Midnight blue finish. Has a distinctive NASA sticker on the top right lid and a clear protective casing. Plugged into charging port when discovered.",
    image: "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=800&q=80",
    status: "open",
    reportedBy: {
      id: "usr_student_02",
      name: "Rohan Verma",
      email: "rohan.v@saiuniversity.edu.in"
    },
    createdAt: "2026-11-09T14:30:00.000Z"
  },
  {
    id: "item_02",
    title: "Sai University Student ID Card (Akshaya R)",
    type: "lost",
    category: "ID Cards & Keys",
    location: "Student Cafeteria",
    specificLocation: "Near the South Indian breakfast counter",
    date: "2026-11-10",
    description: "Lost official Sai University RFID smart student ID card for Akshaya R (School of Computing). Enclosed in a transparent purple lanyard with a small metal carabiner clip.",
    image: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80",
    status: "open",
    reportedBy: {
      id: "usr_student_01",
      name: "Akshaya Ramesh",
      email: "akshaya@saiuniversity.edu.in"
    },
    createdAt: "2026-11-10T09:15:00.000Z"
  },
  {
    id: "item_03",
    title: "Sony WH-1000XM4 Noise-Cancelling Headphones",
    type: "lost",
    category: "Electronics",
    location: "Academic Block A",
    specificLocation: "Lecture Hall A-204, 3rd row aisle seat",
    date: "2026-11-08",
    description: "Black Sony wireless over-ear noise-cancelling headphones in its original grey hard zipper case. Has gold branding accents and a slight scratch on the left ear cup hinge.",
    image: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=800&q=80",
    status: "claimed",
    reportedBy: {
      id: "usr_student_03",
      name: "Pooja Sundaram",
      email: "pooja.s@saiuniversity.edu.in"
    },
    createdAt: "2026-11-08T16:45:00.000Z"
  },
  {
    id: "item_04",
    title: "Hydro Flask Stainless Water Bottle (Cobalt Blue)",
    type: "found",
    category: "Personal Accessories",
    location: "Sports Complex",
    specificLocation: "Bleachers beside Indoor Badminton Court 2",
    date: "2026-11-10",
    description: "32oz Cobalt Blue wide-mouth Hydro Flask with flex straw cap. Has several hiking and outdoor national park stickers around the base.",
    image: "https://images.unsplash.com/photo-1602143407151-7111542de6e8?auto=format&fit=crop&w=800&q=80",
    status: "open",
    reportedBy: {
      id: "usr_student_01",
      name: "Akshaya Ramesh",
      email: "akshaya@saiuniversity.edu.in"
    },
    createdAt: "2026-11-10T18:20:00.000Z"
  },
  {
    id: "item_05",
    title: "Set of 3 Dorm Keys with Marvel Keychain",
    type: "found",
    category: "ID Cards & Keys",
    location: "Hostels",
    specificLocation: "Hostel Block B Main Entrance foyer bench",
    date: "2026-11-07",
    description: "Ring with three silver Yale keys and an iron-man enamel keychain. Number '204' stamped faintly on one brass key.",
    image: "https://images.unsplash.com/photo-1582139329536-e7284fece509?auto=format&fit=crop&w=800&q=80",
    status: "recovered",
    reportedBy: {
      id: "usr_admin_01",
      name: "Campus Security Admin",
      email: "admin@saiuniversity.edu.in"
    },
    createdAt: "2026-11-07T11:00:00.000Z"
  },
  {
    id: "item_06",
    title: "Black Leather Fossil Wallet",
    type: "lost",
    category: "Wallets & Bags",
    location: "Innovation Lab",
    specificLocation: "Robotics Workstation Table 3",
    date: "2026-11-09",
    description: "Bifold dark brown/black textured leather wallet containing SBI debit card, driver's license, and university mess card. High sentimental value.",
    image: "https://images.unsplash.com/photo-1627123424574-724758594e93?auto=format&fit=crop&w=800&q=80",
    status: "open",
    reportedBy: {
      id: "usr_student_02",
      name: "Rohan Verma",
      email: "rohan.v@saiuniversity.edu.in"
    },
    createdAt: "2026-11-09T19:10:00.000Z"
  },
  {
    id: "item_07",
    title: "Casio Scientific Calculator FX-991EX ClassWiz",
    type: "found",
    category: "Books & Stationery",
    location: "Academic Block B",
    specificLocation: "Exam Hall B-102 on teacher's podium",
    date: "2026-11-08",
    description: "Casio FX-991EX high-resolution calculator with black and white casing. Has initials 'R.V.' written with silver permanent marker inside the slide cover.",
    image: "https://images.unsplash.com/photo-1594980596870-8aa52a78d8cd?auto=format&fit=crop&w=800&q=80",
    status: "open",
    reportedBy: {
      id: "usr_student_03",
      name: "Pooja Sundaram",
      email: "pooja.s@saiuniversity.edu.in"
    },
    createdAt: "2026-11-08T17:30:00.000Z"
  },
  {
    id: "item_08",
    title: "Titan Edge Minimalist Watch (Silver Mesh Strap)",
    type: "lost",
    category: "Personal Accessories",
    location: "Admin Block",
    specificLocation: "Reception Lounge waiting sofa",
    date: "2026-11-06",
    description: "Ultra-thin stainless steel analog wristwatch with white dial and sapphire crystal. Stainless steel woven mesh magnetic strap.",
    image: "https://images.unsplash.com/photo-1524805444758-089113d48a6d?auto=format&fit=crop&w=800&q=80",
    status: "open",
    reportedBy: {
      id: "usr_student_01",
      name: "Akshaya Ramesh",
      email: "akshaya@saiuniversity.edu.in"
    },
    createdAt: "2026-11-06T12:00:00.000Z"
  },
  {
    id: "item_09",
    title: "Denim Trucker Jacket (Levi's, Medium)",
    type: "found",
    category: "Clothing & Footwear",
    location: "Sports Complex",
    specificLocation: "Student Amphitheatre stage steps",
    date: "2026-11-07",
    description: "Classic blue faded Levi's denim jacket, size Medium. Left pocket contains a pair of wired 3.5mm EarPods and a mint packet.",
    image: "https://images.unsplash.com/photo-1576995853123-5a10305d93c0?auto=format&fit=crop&w=800&q=80",
    status: "open",
    reportedBy: {
      id: "usr_admin_01",
      name: "Campus Security Admin",
      email: "admin@saiuniversity.edu.in"
    },
    createdAt: "2026-11-07T18:15:00.000Z"
  },
  {
    id: "item_10",
    title: "Apple AirPods Pro (2nd Gen) in MagSafe Case",
    type: "lost",
    category: "Electronics",
    location: "Student Cafeteria",
    specificLocation: "Outdoor pergola seating area under oak tree",
    date: "2026-11-10",
    description: "White charging case with engraving 'SAI-AIR-02' on the front. Left earbud has small medium silicone tip, right is small.",
    image: "https://images.unsplash.com/photo-1600294037681-c80b4cb5b434?auto=format&fit=crop&w=800&q=80",
    status: "open",
    reportedBy: {
      id: "usr_student_02",
      name: "Rohan Verma",
      email: "rohan.v@saiuniversity.edu.in"
    },
    createdAt: "2026-11-10T13:40:00.000Z"
  },
  {
    id: "item_11",
    title: "Data Structures & Algorithms in Java (Robert Sedgewick)",
    type: "found",
    category: "Books & Stationery",
    location: "Central Library",
    specificLocation: "Group Study Room 4 on round glass table",
    date: "2026-11-11",
    description: "Hardcover textbook, 4th edition. Contains multicolored sticky flags on Chapter 4 (Graphs). Sai University library barcode on the back.",
    image: "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=800&q=80",
    status: "open",
    reportedBy: {
      id: "usr_student_01",
      name: "Akshaya Ramesh",
      email: "akshaya@saiuniversity.edu.in"
    },
    createdAt: "2026-11-11T10:00:00.000Z"
  }
];

const SAMPLE_CLAIMS = [
  {
    id: "clm_01",
    itemId: "item_03",
    itemTitle: "Sony WH-1000XM4 Noise-Cancelling Headphones",
    claimantId: "usr_student_03",
    claimantName: "Pooja Sundaram",
    claimantEmail: "pooja.s@saiuniversity.edu.in",
    claimantPhone: "+91 94440 98765",
    proofDescription: "I have the original invoice from Croma and the serial number ending in 8492. Bluetooth name is set to 'Pooja-Sony-M4'.",
    status: "pending",
    submittedAt: "2026-11-09T10:00:00.000Z",
    adminNotes: ""
  },
  {
    id: "clm_02",
    itemId: "item_05",
    itemTitle: "Set of 3 Dorm Keys with Marvel Keychain",
    claimantId: "usr_student_02",
    claimantName: "Rohan Verma",
    claimantEmail: "rohan.v@saiuniversity.edu.in",
    claimantPhone: "+91 98765 43210",
    proofDescription: "My room is 204 in Hostel Block B. The key fits my room lock perfectly. I brought the duplicate key from warden to verify.",
    status: "approved",
    submittedAt: "2026-11-08T09:30:00.000Z",
    adminNotes: "Physical verification conducted at Security Office. Keys verified and handed over."
  }
];

const SAMPLE_NOTIFICATIONS = [
  {
    id: "notif_01",
    userId: "usr_student_02",
    title: "Claim Approved!",
    message: "Your claim for 'Set of 3 Dorm Keys with Marvel Keychain' was approved by Campus Security. You may collect it at the Admin Block.",
    type: "success",
    timestamp: "2026-11-08T14:30:00.000Z",
    read: false
  },
  {
    id: "notif_02",
    userId: "usr_student_01",
    title: "Potential Match Found",
    message: "A new found item matching 'Casio Scientific Calculator' was reported at Academic Block B.",
    type: "info",
    timestamp: "2026-11-08T18:00:00.000Z",
    read: true
  }
];

const CAMPUS_LOCATIONS = [
  "Admin Block",
  "Academic Block A",
  "Academic Block B",
  "Central Library",
  "Student Cafeteria",
  "Sports Complex",
  "Hostels",
  "Innovation Lab"
];

const ITEM_CATEGORIES = [
  { name: "Electronics", icon: "laptop" },
  { name: "ID Cards & Keys", icon: "id-badge" },
  { name: "Wallets & Bags", icon: "wallet" },
  { name: "Books & Stationery", icon: "book" },
  { name: "Clothing & Footwear", icon: "shirt" },
  { name: "Personal Accessories", icon: "watch" },
  { name: "Others", icon: "box" }
];
