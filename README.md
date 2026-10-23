# Pennywise — Expense Tracker & Analytics

A responsive personal finance dashboard built with **React, Firebase, Chart.js**, and Vite. Track income and expenses, inspect monthly trends, manage budgets, and export reports to CSV or PDF.

## Features

- Dashboard with total income, expenses, balance, savings rate, and recent transactions
- Add, edit, delete, and search income/expense transactions
- Category breakdown and six-month income-vs-expense charts
- Monthly report selector and insights based on recorded data
- Category budgets with progress indicators
- CSV export for spreadsheet workflows
- PDF report export with transaction table
- Firebase Authentication (email/password) and Firestore persistence when configured
- Local demo mode when Firebase credentials are not configured
- Responsive layout for desktop and mobile

## Run locally

Requires Node.js 18+.

```bash
npm install
npm run dev
```

Open the local URL printed by Vite.

## Enable Firebase

1. Create a project at the [Firebase Console](https://console.firebase.google.com/).
2. Add a Web App and copy its config.
3. Copy `.env.example` to `.env.local` and fill in the values.
4. In Firebase Authentication, enable **Email/Password**.
5. Create a Cloud Firestore database.
6. Start the app again with `npm run dev`.

When Firebase is configured, users can register and sign in. Transactions are stored under `users/{uid}/transactions` and budgets under `users/{uid}/budgets`.

### Suggested Firestore security rules

Use authenticated, user-scoped access. Review and test rules before production deployment.

```text
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

## Deploy

Build with:

```bash
npm run build
```

Deploy the `dist` folder to Firebase Hosting, Vercel, or Netlify. Add the same `VITE_FIREBASE_*` environment variables in your hosting provider. For Firebase Hosting, initialize Hosting and set the public directory to `dist`.

## Notes

- If Firebase is not configured, the app uses browser `localStorage` and loads sample transactions so you can explore the dashboard.
- Demo/local data stays in that browser and is not synced across devices.
- Never commit `.env.local` or service-account credentials.
- The included rules are a starting point; production apps should validate data and add appropriate limits.
