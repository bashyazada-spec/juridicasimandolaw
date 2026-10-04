# 📋 Simando Law Case Management System – User Guide & Role-Based Workflows

## System Overview
**Simando Law** is a secure, real-time legal case management platform designed for law firms. It enables attorneys to track cases, manage deadlines, coordinate court appearances, and share case files with team members—all with end-to-end encryption (AES-GCM 256).

---

## 🎯 System Roles

Three distinct user roles manage access and permissions:

| Role | Access Level | Use Case |
|------|--------------|----------|
| **Attorney** | Standard user access | Regular case management, view shared cases, manage own profile |
| **Developer** | Limited to own cases | Internal support staff, system diagnostics, own case viewing |
| **Admin** | Full firm access | Manage all users, edit designations, grant permissions, system diagnostics |

---

## 📊 WORKFLOW 1: ATTORNEY (STANDARD USER)

### Entry Point: Dashboard → Command Center
**Objective:** Quickly view firm activity, recent cases, schedule, and team roster.

```
┌─────────────────────────────────────────────────────────────┐
│                     ATTORNEY DASHBOARD                       │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  3-METRIC SUMMARY ROW                                        │
│  ┌────────────────┐ ┌────────────────┐ ┌────────────────┐   │
│  │ Total Cases    │ │ Active Cases   │ │ Resolved Cases │   │
│  │       42       │ │       18       │ │       24       │   │
│  └────────────────┘ └────────────────┘ └────────────────┘   │
│                                                               │
│  3-COLUMN GRID (Responsive Layout)                          │
│  ┌──────────────────┐ ┌──────────────────┐ ┌─────────────┐  │
│  │ Recent Active    │ │ Google Calendar  │ │ Attorney    │  │
│  │ Cases (5/page)   │ │ Firm Agenda      │ │ Roster      │  │
│  │ • Case A         │ │ • Feb 10: Hearing│ │ • Atty. Cruz│  │
│  │ • Case B         │ │ • Feb 15: Pleading││ • Atty. Dela│ │
│  │ [PAGINATION]     │ │ • Feb 20: Meeting│ │ • Atty. San │  │
│  └──────────────────┘ └──────────────────┘ └─────────────┘  │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

### Step-by-Step Attorney Workflow

#### **1️⃣ CREATE A NEW CASE**
```
Dashboard
  ↓
Click "Add Case" (Sidebar or Top Button)
  ↓
CASE FORM (Case Details Section)
  ├─ Case Title *required
  ├�� Category (Criminal, Civil, Administrative, etc.)
  ├─ Case Type / Sub-Category (Theft, Contract, etc.)
  ├─ Date Filed *required
  ├─ Case/Docket Number
  ├─ Status (On-going, Completed, Resolved)
  └─ Venue/Court (Select from dropdown or custom entry)
  ↓
PARTIES INVOLVED Section
  ├─ Add Petitioner/Plaintiff (Can add multiple)
  └─ Add Respondent/Defendant (Can add multiple)
  ↓
COURT HEARING DATES & HISTORY (Optional)
  ├─ Hearing Date *required
  ├─ Time (Default: 08:30 AM)
  ├─ Stage/Purpose (Pre-Trial, Arraignment, Evidence, etc.)
  └─ Remarks/Description
  ↓
DOCUMENT & PLEADING DEADLINES (Optional)
  ├─ Filing Deadline Date *required
  ├─ Document Flow (Outbound: Firm Filing | Inbound: Opposing Counsel)
  ├─ Document/Pleading Subtype
  └─ Remarks/Description
  ↓
Case Narrative *required
  └─ Summarize background, claims, current posture
  ↓
ATTACH DOCUMENTS Section
  ├─ Select Inbound/Outbound Radio Button
  ├─ Click Upload Area
  └─ Select files (Multiple files supported)
  ↓
[SAVE] → Case Created in Firestore (Encrypted)
  ↓
Confirmation Toast + Redirect to Case Detail View
```

#### **2️⃣ VIEW & MANAGE EXISTING CASES**
```
Navigate to "All Cases" (Sidebar)
  ↓
CASE FILTERING & SEARCH
  ├─ Search by: Title, Parties, Docket Number
  ├─ Category Filter (All, Criminal, Civil, etc.)
  ├─ Status Filter (All, On-going, Completed, Resolved)
  ├─ Type Filter (All subcategories)
  └─ Sort by Due Date (Soonest/Furthest/Date Added)
  ↓
10-CASE PAGINATED LIST
  ├─ Each row shows: Case Title, Party, Status, Due Date
  ├─ Click row → Open Case Detail
  └─ [Pagination Controls] (Prev/Next)
  ↓
CASE DETAIL VIEW
  ├─ Full case info + associated profile
  ├─ Action Toolbar (Edit, Delete, Share, More…)
  ├─ Case Info Card (Title, Parties, Narrative, Status)
  ├─ Court Hearings List (Chronological history)
  ├─ Documents & Pleading Deadlines
  └─ Status Panel (Current case state)
```

#### **3️⃣ SHARE CASE WITH TEAM**
```
Case Detail View
  ↓
Click "Share Case" (Action Toolbar)
  ↓
SHARE CASE MODAL
  ├─ Displays list of all attorneys in firm
  ├─ Checkboxes to select associates
  ├─ Pre-checked: Already shared attorneys
  └─ [Save Permissions] button
  ↓
Firestore Update: allowedUids array updated
  ↓
Shared attorneys gain access (Read/Edit)
```

#### **4️⃣ MONITOR DEADLINES & HEARINGS**
```
Multiple Entry Points:

(A) Notifications Icon (Top-Right)
    ├─ Bell icon shows unread count badge
    ├─ Click → Dropdown list of notifications
    └─ Notifications: Deadlines, Hearings, Team updates
    
(B) Dashboard Calendar Widget
    ├─ Displays firm-wide schedule
    ├─ Color-coded events:
    │  ├─ 🏛️ Court Hearing (Gold)
    │  ├─ 📋 Pleading Deadline (Violet)
    │  ├─ 🚫 Out of Office (Red)
    │  └─ 👥 Consultation (Green)
    └─ Click date → See event details
    
(C) Firm Schedule View
    ├─ Navigate to "Firm Schedule" (Sidebar)
    ├─ Interactive calendar (Month view)
    ├─ Filter by attorney (Dropdown)
    ├─ Click date → Schedule Details Modal
    └─ Shows all events for that day
    
(D) Proactive Notification Tiers
    ├─ 30-Day Reminder: Initial notice
    ├─ 15-Day Notice: Review & prepare
    ├─ 7-Day Deadline: Critical attention
    ├─ 3-Day Critical: Urgent action required
    ├─ Due Today: Final reminder
    └─ Overdue: Escalation alert
```

#### **5️⃣ MANAGE PROFILE & SETTINGS**
```
Sidebar Footer
  ↓
Click User Chip or "My Settings" (Sidebar)
  ↓
MY SETTINGS PAGE
  ├─ PROFILE DETAILS Section
  │  ├─ Display Name
  │  ├─ Role/Designation
  │  ├─ Contact Number
  │  └─ Attorney Profile Photo (Camera upload)
  │
  ├─ GOOGLE DRIVE INTEGRATION Section
  │  ├─ Status indicator (Connected/Not Connected)
  │  ├─ [Connect Google Drive Account] button
  │  └─ OAuth permission prompt
  │
  ├─ TWO-FACTOR AUTHENTICATION Section
  │  ├─ Current status (Enabled/Disabled)
  │  ├─ [Setup 2FA] button
  │  │  └─ QR Code + Manual Entry Key + Backup Codes
  │  └─ Verify 6-digit code
  │
  ├─ DISPLAY MODE Section
  │  ├─ Dark/Light theme toggle
  │  └─ Preference saved to local storage
  │
  └─ ACCOUNT & ACTIONS Section
      ├─ [Sign Out] button
      └─ System info (Version, Privacy Policy, Terms)
```

---

## 📊 WORKFLOW 2: DEVELOPER (INTERNAL SUPPORT STAFF)

### Access Restrictions
- Can only view cases they personally created (`ownerUid === currentUser.uid`)
- Cannot access other developers' cases
- Cannot view firm-wide analytics
- Limited admin features

```
┌──────────────────────────────────────────────┐
│        DEVELOPER ROLE CAPABILITIES           │
├──────────────────────────────────────────────┤
│                                              │
│  ALLOWED FEATURES:                           │
│  ✅ View own cases only                      │
│  ✅ Create cases                             │
│  ✅ Edit cases (own only)                    │
│  ✅ Access "System Diagnostics" button       │
│  ✅ Run health checks                        │
│  ✅ View own profile                         │
│                                              │
│  RESTRICTED FEATURES:                        │
│  ❌ View other developers' cases             │
│  ❌ View shared/team cases                   │
│  ❌ Access Admin Console                     │
│  ❌ Manage user permissions                  │
│  ❌ View firm roster (limited profile list)  │
│                                              │
└──────────────────────────────────────────────┘
```

### Developer Workflow

#### **Step 1️⃣: Authenticate & Load Own Cases**
```
Developer Logs In
  ↓
System checks: role === "developer"
  ↓
Firestore Query Filter Applied:
  WHERE ownerUid == currentUser.uid
  ↓
Dashboard displays:
  ├─ Only own cases (5 per page pagination)
  ├─ Own calendar events only
  └─ Own profile in roster
  ↓
Admin Console button: HIDDEN (Role-based)
```

#### **Step 2️⃣: Create & Manage Internal Cases**
```
Same as Attorney workflow (Steps 1-5 above)
BUT:
  ├─ allowedUids = [ownUid] (Only visible to creator)
  ├─ Cannot share with other developers
  └─ Encryption still applied (Full E2EE)
```

#### **Step 3️⃣: Access System Diagnostics**
```
My Settings Page
  ↓
SYSTEM DIAGNOSTIC ACCESS Section
  ├─ Status Indicator (Green = Healthy)
  └─ [Run Health Check] button
  ↓
Diagnostic Modal Opens:
  ├─ Network & Courtroom Connection
  ├─ Cloud Firestore Sync Status
  ├─ Google Drive Storage & OAuth Token
  └─ [Re-run Health Check] button
```

---

## 🛡️ WORKFLOW 3: ADMIN (FIRM MANAGEMENT)

### Full System Access
- View ALL cases (firm-wide)
- Manage user profiles and permissions
- Grant/revoke admin privileges
- Access Admin Console
- Run system diagnostics

### Access Control Logic
```
User Email in ADMIN_EMAILS array?
  ├─ YES → Automatically assigned role: "admin"
  ├─ Granted full Firestore access
  ├─ Admin Console link appears in sidebar
  └─ Can see all cases/profiles
    
NO → Check manual role assignment
  ├─ Attorney (Standard)
  └─ Developer (Limited)
```

### Admin Workflow

#### **Step 1️⃣: Access Admin Console**
```
My Settings Page
  ↓
"Admin Control Console" card visible
  ├─ Gold highlight + ADMIN ACCESS badge
  └─ [Open Admin Console] button
  ↓
Redirects to: admin.html
```

#### **Step 2️⃣: Manage Attorney Accounts**
```
Admin Console Dashboard
  ├─ Attorney Directory (All profiles)
  ├─ Search/Filter by name
  ├─ View profile cards with:
  │  ├─ Avatar + Name
  │  ├─ Current role designation
  │  ├─ Email
  │  ├─ Google Drive status
  │  └─ Action buttons
  │
  └─ ACTIONS:
      ├─ [Edit Profile] → Modify name, role, contact
      ├─ [Designate Role] → Change to Admin/Developer/Attorney
      ├─ [Grant Admin] → Promote to admin
      ├─ [Revoke Admin] → Demote to attorney
      └─ [Delete Profile] → Remove user (with confirmation)
```

#### **Step 3️⃣: Grant/Revoke Admin Privileges**
```
Attorney Profile Card (in Admin Console)
  ↓
Click [Designate Role] dropdown
  ├─ Attorney (Default)
  ├─ Admin (Full access)
  └─ Developer (Limited)
  ↓
Click [Save Changes]
  ↓
Firestore Update: profile.role = "admin"
  ↓
User logout → Login again
  ↓
Admin Console link now VISIBLE in their sidebar
```

#### **Step 4️⃣: View All Cases (Firm-wide)**
```
Admin navigates to "All Cases"
  ↓
Firestore Query (NO filter applied):
  WHERE collection === "cases" (All documents)
  ↓
Admin sees:
  ├─ Cases from all attorneys
  ├─ All statuses, categories, types
  ├─ Shared & private cases
  ├─ Full case history & deadlines
  └─ Can edit/delete any case
```

#### **Step 5️⃣: System Health & Diagnostics**
```
Admin Console
  ├─ System Health Dashboard
  └─ [Run Full Diagnostics] button
  ↓
Comprehensive report:
  ├─ Firebase connectivity
  ├─ Firestore real-time sync status
  ├─ Google Drive OAuth tokens
  ├─ User authentication state
  ├─ Encryption key derivation
  ├─ Network latency
  └─ Database operation logs
  ↓
Detailed troubleshooting recommendations
```

#### **Step 6️⃣: Audit & Compliance Logs**
```
Admin Console → Audit Logs Section
  ├─ Immutable audit trail
  ├─ Every action logged:
  │  ├─ PROFILE_CREATED
  │  ├─ CASE_CREATED_ENCRYPTED
  │  ├─ CASE_UPDATED_ENCRYPTED
  │  ├─ CASE_DELETED
  │  ├─ APPOINTMENT_REQUESTED
  │  └─ [system actions...]
  │
  ├─ Log details:
  │  ├─ Timestamp
  │  ├─ User (email + uid)
  │  ├─ Action type
  │  └─ Related resource (Case ID, Profile ID, etc.)
  │
  └─ Export/Filter options
```

---

## 🔐 Security & Data Protection Features

### End-to-End Encryption (E2EE)
```
Case Data Lifecycle:

1. Attorney creates case with sensitive info
2. Client-side AES-GCM 256 encryption
   ├─ Plaintext → Encrypted blob
   └─ Format: enc:v1:[base64-encoded-ciphertext]
3. Sent to Firestore (Appears as gibberish)
4. Stored in encrypted form (Zero-Knowledge)
5. Only authorized users decrypt on client
6. Browser decryption (LocalStorage cache safe)
```

### Two-Factor Authentication (2FA)
```
My Settings → Setup 2FA
  ├─ Scan QR Code with Google/Microsoft/Apple Authenticator
  ├─ Manual Entry Key (Backup if QR fails)
  ├─ Backup Recovery Codes (10 codes for emergencies)
  └─ Verify 6-digit code from app
  ↓
Enabled: 2FA protects account login
```

### Role-Based Access Control (RBAC)
```
Authentication Flow:
  
1. User email matches ADMIN_EMAILS?
   └─ YES → Assign role: "admin"
   
2. Manual role assignment (Admin can change)
   ├─ "Attorney" (Default)
   ├─ "Developer" (Limited)
   └─ "Admin" (Full access)
   
3. Case visibility filter applied:
   ├─ Admin → See all cases
   ├─ Attorney → See own + shared cases
   └─ Developer → See own cases only
   
4. UI elements conditionally rendered:
   ├─ Admin Console → Show only for admins
   ├─ Share Case → Show for all
   └─ Delete User → Show only for admins
```

---

## 📱 Multi-Device Support

### Desktop (index.html)
```
Full-featured interface
├─ 3-column responsive grid
├─ Sidebar navigation
├─ All features accessible
└─ Optimized for 1920px+ screens
```

### Tablet (tablet.html)
```
Optimized touch interface
├─ 2-column layout
├─ Larger tap targets
├─ PWA install card
├─ Mobile-friendly modals
└─ Optimized for 768px+ screens
```

### Mobile (mobile.html)
```
Mobile-first interface
├─ Single column layout
├─ Bottom navigation
├─ Progressive Web App (PWA) support
├─ Installable as mobile app
└─ Optimized for <768px screens
```

---

## 🚀 Key Features by Role

### Feature Matrix

| Feature | Attorney | Developer | Admin |
|---------|----------|-----------|-------|
| Create Cases | ✅ | ✅ | ✅ |
| View Own Cases | ✅ | ✅ | ✅ |
| View Team Cases | ✅ (if shared) | ❌ | ✅ |
| Share Cases | ✅ | ❌ | ✅ |
| Edit Cases | ✅ (own+shared) | ✅ (own) | ✅ (all) |
| Delete Cases | ✅ (own+shared) | ✅ (own) | ✅ (all) |
| View Dashboard | ✅ | ✅ | ✅ |
| View Calendar | ✅ | ✅ | ✅ |
| View All Profiles | ✅ | ✅ (limited) | ✅ |
| Edit Own Profile | ✅ | ✅ | ✅ |
| Edit Other Profiles | ❌ | ❌ | ✅ |
| Admin Console | ❌ | ❌ | ✅ |
| Manage Permissions | ❌ | ❌ | ✅ |
| View Audit Logs | ❌ | ❌ | ✅ |
| System Diagnostics | ❌ (own) | ✅ | ✅ |
| Setup 2FA | ✅ | ✅ | ✅ |
| Connect Google Drive | ✅ | ✅ | ✅ |

---

## 📞 Getting Help

### Support Resources
- **System Diagnostics**: My Settings → Run Health Check
- **Google Drive Issues**: My Settings → Reconnect Google Account
- **2FA Problems**: Use backup recovery codes
- **Case Access Issues**: Ask an admin to grant permissions
- **Performance Lag**: Check System Diagnostics → Network status

### Documentation
- View built-in tooltips on every field
- Hover over icons for descriptions
- Check Privacy Policy & Terms of Service links (Footer)

---

## 🎓 Quick Tips

1. **Mobile Users**: Install as PWA for offline access (My Settings → Install as Mobile App)
2. **Bulk Upload**: Attach multiple documents to cases at once
3. **Calendar Filtering**: Filter firm schedule by individual attorney (Dropdown)
4. **Case Status Tracking**: Use All Cases page with status filters for quick view
5. **Notification Management**: Mark all as read or review one-by-one in dropdown
6. **Drive Access**: Cases linked to Google Drive for seamless document storage
7. **Dark Mode**: Toggle theme in sidebar (Moon/Sun icon)
8. **Profile Photo**: Upload avatar to personalize your profile
9. **Case Sharing**: Share complex cases with multiple attorneys for collaboration
10. **Deadline Alerts**: Receive proactive notifications at 30, 15, 7, 3 days, today, and overdue

---

## Version Info
**Simando Law v5.2**  
Est. 2026 · Legal Counsel  
Last Updated: October 2026
