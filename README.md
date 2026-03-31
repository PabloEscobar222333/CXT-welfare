# CXT Welfare Management Platform

A modern, role-based internal web application designed to track and manage employee welfare contributions, event budgets, and financial reporting for CXT.

## 🚀 Features

*   **Role-Based Access Control:** Distinct views and permissions for Super Admins, Treasurers, Chairmen, Secretaries, Auditors, and standard Members.
*   **Member Management:** Add, edit, disable, and assign roles to members safely.
*   **Contributions Tracking:** Log monthly member contributions with partial payment capabilities and instant visual progress indicators.
*   **Event & Expense Management:** Create events, assign budgets, and log specific expenses against those events. Upload receipt evidence directly to logs.
*   **Automated Reporting:** Real-time generation of Monthly Contribution reports, Event Expense tracking, and a Year-to-Date Income vs Expenditure statement.
*   **Immutable Audit Log:** A read-only ledger tracking all critical system actions (logins, edits, role changes) for compliance.

## 🛠 Tech Stack

*   **Frontend:** Vite + React + Vanilla CSS
*   **Routing:** React Router DOM
*   **Icons:** Lucide React
*   **Charts:** Recharts
*   **Backend (Prepared):** Supabase (PostgreSQL + Auth + Storage)

## 📁 Project Structure

```
src/
├── components/
│   ├── layout/       # AppLayout, Header, Sidebar
│   └── ui/           # Reusable UI components (Card, Button, Input, Badge)
├── context/          # Global State Management (AuthContext, DataContext, ToastContext)
├── pages/
│   ├── auth/         # Login, Forgot Password, Reset Password
│   ├── dashboard/    # Role-aware generic dashboard
│   ├── members/      # Member directory
│   ├── contributions/# Monthly tracking
│   ├── events/       # Events & Event Details
│   ├── expenses/     # Expenses & Receipt logging
│   ├── reports/      # Reporting Engine
│   └── audit/        # Immutable audit log
├── services/         # Scaffolded API calls (Supabase wrapper)
├── App.jsx           # Main routing layer
└── index.css         # Global stylesheet & design system variables
```

## ⚙️ Running Locally

1.  **Install dependencies:**
    ```bash
    npm install
    ```
2.  **Start the development server:**
    ```bash
    npm run dev
    ```

## 🗄 Backend Architecture Plan (Supabase)

This application is built with a decoupled context architecture (`DataContext.jsx`). Currently, it relies on mock local state. To transition to a live Supabase backend, update `src/services/api.js` and connect the context to these expected tables:

1.  **`users`:** `id` (uuid), `email`, `full_name`, `role`, `status`, `must_change_password`.
2.  **`contributions`:** `id`, `member_id` (fk), `month`, `year`, `expected_amount`, `paid_amount`, `payment_method`, `status`.
3.  **`events`:** `id`, `name`, `type`, `date`, `organiser`, `budget_limit`, `status`.
4.  **`expenses`:** `id`, `event_id` (fk), `category`, `description`, `amount`, `vendor`, `receipt_url`, `logged_by_id`.
5.  **`audit_logs`:** `id`, `user_id` (fk), `action_type`, `description`, `ip_address`, `timestamp`.

*(Storage buckets will be required for profile pictures and expense receipts).*
