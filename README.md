# Donor Dashboard

A comprehensive dashboard application for managing donors, students, scholarships, and schools. This application serves multiple user roles including Admins, Donors, and Teachers.

This project is open-sourced to increase transparency, foster collaboration, and enable reuse for social-impact purposes.

---

## Important Notice
This repository **does not contain real student, donor, or school data**. Any resemblance to real persons is coincidental. This software is provided *as-is*. The maintainers cannot provide individual support or customization.

---

## Governance & Maintenance
The project is currently maintained by a team of volunteers for the iCare Thailand Foundation. Governance may evolve as the community grows.

---

## Ethical Use
This project is intended for **educational, humanitarian, and social-impact purposes**.
The authors strongly discourage use for:
- Surveillance or profiling
- Discrimination or exclustion
- Exploitation of volunaerable groups
- Any activity that violates human rights or applicable data protection laws.

---

## Features

- **Admin Portal**:
  - Dashboard overview
  - Management of Users, Donors, Students, Scholarships, and Schools
  - Report generation and management
  - Branding customization
  - Grant type configuration

- **Donor Portal**:
  - Personalized dashboard
  - View assigned student details
  - Membership renewal requests

- **Teacher Portal**:
  - Dashboard overview
  - Student management
  - Report creation and editing

- **Authentication**:
  - Secure login
  - Password reset flows
  - Invite acceptance system

## Tech Stack

- **Frontend Framework**: [React](https://reactjs.org/) with [TypeScript](https://www.typescriptlang.org/)
- **Build Tool**: [Vite](https://vitejs.dev/)
- **UI Library**: [Mantine](https://mantine.dev/)
- **Routing**: [React Router](https://reactrouter.com/)
- **Backend/Database**: [Supabase](https://supabase.com/)
- **Icons**: [Tabler Icons](https://tabler-icons.io/)
- **Data Tables**: [TanStack Table](https://tanstack.com/table/v8)

## Prerequisites

- Node.js (Latest LTS version recommended)
- npm or yarn
- A Supabase project

## Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd donor-dashboard
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Environment Setup:
   Create a `.env` file in the root directory (or `.env.local`) and add your Supabase credentials:
   ```env
   VITE_SUPABASE_URL=your_supabase_project_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

## Running the Application

To start the development server:

```bash
npm run dev
```

The application will be available at `http://localhost:5173`.

## Building for Production

To build the application for production:

```bash
npm run build
```

To preview the production build locally:

```bash
npm run preview
```

## Database & Backend

This project uses Supabase for the backend.
- **Database Schema**: Refer to `full_schema.sql` or `schema_only.sql` for the database structure.
- **Edge Functions**: Located in `supabase/functions/`. These handle server-side logic like creating users and sending invites.

## Project Structure

```
src/
  ├── components/     # Reusable UI components
  ├── layout/         # App shell and layout components
  ├── lib/            # Utilities and Supabase client
  ├── modules/        # Feature-based modules (admin, auth, donor, etc.)
  ├── theme/          # Theme configuration
  ├── App.tsx         # Main application component
  └── main.tsx        # Entry point
supabase/
  └── functions/      # Supabase Edge Functions
```
