# InSearch — Campus Lost and Found Portal for Sai University

**InSearch** is a full-featured, responsive, student-friendly Web Portal designed specifically for Sai University campus community to report lost belongings, log found items, submit ownership claims, and streamline campus security moderation.

Built using **HTML5, CSS3, and Vanilla JavaScript (ES6+)** without heavy frontend frameworks, adhering strictly to university web technology curriculum requirements.

---

## 🎨 Design System & Color Palette

Designed with modern SaaS aesthetics, smooth hover elevation, rounded cards, and student-focused clarity:

- **Primary Purple**: `#7C3AED` (Brand headers, primary actions)
- **Sky Blue**: `#38BDF8` (Found items badge, tags, secondary highlights)
- **Pink**: `#F9A8D4` / `#EC4899` (Lost items accent)
- **Yellow**: `#FDE68A` / `#F59E0B` (Pending claims, warning alerts, duplicate notifications)
- **Success Green**: `#10B981` (Recovered items, approved claims)
- **Background**: `#F8FAFC`
- **Text**: `#1E293B`

---

## 🚀 How to Run the Frontend

The frontend is ready to run immediately:

1. Navigate to:
   `C:\Users\AKSHAYA\OneDrive\Documents\InSearch\`
2. Double-click **`index.html`** to open it directly in Google Chrome, Microsoft Edge, Firefox, or any modern web browser.
   *(Or right click and choose "Open with Live Server" in VS Code / Antigravity IDE).*
3. Everything works out-of-the-box! Pre-seeded with 11 realistic Sai University campus records, demo student account (`Akshaya Ramesh`), and campus security admin account.

---

## ✨ Key Features Implemented

### 1. Student Portal
- **Authentication**: Modal for sign-in & sign-up with demo quick-switch buttons.
- **Lost & Found Reporting**:
  - Item name, category, campus location (Admin Block, Academic Blocks, Central Library, Cafeteria, Sports Complex, Hostels, Innovation Lab).
  - Specific location details and date picker.
  - Image upload with instant DataURL photo preview.
- **Smart Duplicate-Item Detection**:
  - Live scanning as the student types title, category, building, and description.
  - Displays an attention-grabbing warning banner showing matching records, match score percentage, and one-click preview links without blocking submission.
- **Browse & Filter Directory**:
  - Real-time search by keyword across title, location, category, and description.
  - Quick filter pills: `All Items`, `Lost`, `Found`, `Recovered`.
  - Dropdown filters for Category and Campus Location.
  - Sorting: Newest First, Oldest First, Title (A-Z), Title (Z-A).
- **Detailed Item View & Similar Items**:
  - Modal with high-res photo, badges, location pin, date, and reporter details.
  - **Smart Similar Items Section**: Recommends potential opposite matches (e.g. lost item matching a found report).
  - Claim button for found items, or contact reporter for lost items.
- **Claim Submission**:
  - Claim form requiring proof of ownership (serial number, distinctive marks, stickers).
- **Personal Student Dashboard**:
  - **My Reported Items**: Review personal listings with inline **Edit** and **Delete** actions.
  - **My Submitted Claims**: Track live status (`PENDING`, `APPROVED`, `REJECTED`) with admin review notes.
  - **Notifications**: Bell icon with unread count badge and notifications drawer.

### 2. Admin & Security Console
- **Role-Protected Access**: Admin console accessible only by campus security administrators (or via the 1-click Admin Demo switch).
- **KPI Metrics Cards**:
  - Total Users
  - Lost Reports
  - Found Reports
  - Items Recovered
  - Pending Claims
- **Interactive HTML5 Canvas Analytics**:
  - **Bar Chart**: Lost vs. Found Reports distributed across Campus Buildings.
  - **Doughnut Chart**: Item category breakdown with percentage legend.
- **Claim Moderation**:
  - Inspect student claims and proof of ownership.
  - **Approve Claim**: Automatically marks the item as `RECOVERED` and sends a notification to the student.
  - **Reject Claim**: Allows entering review feedback/notes for the student.
- **All-Items Moderation**:
  - Search, filter by status, toggle item state, or delete listings.
- **User Management**:
  - Overview of registered student/admin accounts, department, reported items, and claims.

---

## 📁 Directory Structure

```
InSearch/
├── index.html                    # Main HTML5 entry point & multi-view portal
├── README.md                     # Documentation & usage guide
├── css/
│   ├── style.css                 # Master design tokens, typography, hero banner, buttons, toasts
│   ├── components.css            # Filter toolbar, colorful cards, report form, modals, duplicate banner
│   └── admin.css                 # Admin dashboard KPI cards, canvas charts, moderation tables
└── js/
    ├── sample-data.js            # 11 realistic Sai University campus records, categories, locations, demo users
    ├── state.js                  # Central reactive StateManager with localStorage persistence & event bus
    ├── duplicate-detector.js     # Tokenizer & multi-criteria similarity engine for duplicates and match suggestions
    ├── auth.js                   # Authentication & role-based UI controller (Student vs Admin)
    ├── admin.js                  # Admin metrics calculator, HTML5 canvas chart rendering, claim moderation
    └── app.js                    # UI router, filter & search handler, modals, toasts, claim submission
```

---

## 🔮 Next Step: Backend & MongoDB Integration

The frontend state layer (`js/state.js`) has been designed with an API abstraction layer ready to connect to:
- **Node.js & Express.js** backend (`routes/`, `controllers/`, `models/`, `middleware/`, `config/`)
- **MongoDB Atlas** with Mongoose schemas (`User`, `Item`, `Claim`, `Notification`)
- **JWT & bcryptjs** authentication and authorization
- **Postman API test suite** documenting at least 8 test cases.
