# Live Demo Link

Visit:

- Mobile App: https://pinjam-lah.vercel.app

- IoT Kiosk Screen: https://pinjam-lah.vercel.app/kiosk

# PinjamLah (Library of Things) · Full-Stack Next.js PWA

> **Township of Tomorrow | Sime Darby Property University Hackathon 2026**  
> **Primary Track:** PLANET (Circular Economy) · **Secondary Track:** PEOPLE (Neighbourhood Connection)  
> **Location:** Taman Kita, Selangor (Central Park shed & Garden Walk shed)

Sharing Shed is a township-owned, automated "Library of Things" smart locker platform. Verified residents borrow tools and equipment for free via IoT smart lockers in neighbourhood parks, matched with neighbour skill-sharing and automated **Google Gemini AI Computer Vision return verification**.

---

## 🛠️ Architecture & Tech Stack

- **Framework:** Next.js 16 (App Router, Turbopack, TypeScript, Strict Mode)
- **Database & Storage:** Supabase PostgreSQL (`profiles`, `items`, `lockers`, `loans`, `skill_helpers`, `assistance_requests`, `return-photos` bucket)
- **Realtime Sync:** Supabase Realtime WebSocket subscriptions on `lockers` and `loans` tables
- **AI Computer Vision:** Google Gemini Vision (`gemini-2.5-flash`) via Next.js Server Route `/api/verify-return`
- **QR Engine:** `qrcode.react` (Dynamic encrypted QR generation)
- **Styling & Charts:** Tailwind CSS v4, `recharts` (reactive SVG analytics), `lucide-react`
- **PWA Ready:** Installable standalone mobile Progressive Web App (`manifest.json`)

---

## 📱 User Flows Across All 10 Screens + IoT Kiosk

1. **Screen 01 · Welcome & Auth (`/welcome` & `/`):**  
   Clean onboarding with township value pillars (Save money, Reduce waste, Share resources) and resident session authentication.
2. **Screen 02 · Home Dashboard (`/home`):**  
   Live personal impact hero card (RM saved & CO₂e avoided), project search, 5 category quick-filters, popular items, and active borrow tracking banner.
3. **Screen 03 · Explore Inventory (`/explore`):**  
   Real-time search and filter pills (*All items*, *Availability*, *Within 1 km*), showing condition scores, distance, and locker bay codes.
4. **Screen 04 · Item Booking (`/items/[id]`):**  
   Full kit photo gallery, safety guide, interactive calendar date picker, and free reservation flow that writes a new `RESERVED` loan to Supabase.
5. **Screen 05 · Borrow & Smart Locker Pickup (`/scan?mode=borrow`):**  
   Step-by-step pickup journey with dynamic QR code generation. Triggers hardware locker bay unlock (`is_unlocked = true`) via Supabase Realtime and transitions loan to `ACTIVE`.
6. **Screen 06 · Return & AI Vision Inspection (`/scan?mode=return`):**  
   Return tracker with condition checks, camera/photo capture, and real AI visual inspection via `/api/verify-return` (`gemini-2.5-flash`). Updates loan to `RETURNED`, closes the locker, and increments the resident's saved RM and avoided CO₂.
7. **Screen 07 · Neighbour Skills Matching (`/skills`):**  
   Neighbour skill directory filtered by craft (Carpentry, Gardening, Home repair, Furniture assembly). Includes working assistance requests sent directly to Supabase.
8. **Screen 08 · Personal Impact Dashboard (`/impact`):**  
   Timeframe-based savings analytics, Recharts monthly bar chart, and borrow statistics.
9. **Screen 09 · Community Insights (`/impact?view=community`):**  
   Township-wide metrics: 72% household participation ring chart, monthly demand line chart, favourite items, and locker utilisation.
10. **Screen 10 · Resident Profile (`/profile`):**  
    Verified resident pass (TK-029), achievement badges, CO₂ milestone bar, and live borrow history joined from Supabase `loans` + `items`.
11. **Hardware Companion Route (`/kiosk`):**  
    Simulates the physical IoT touch terminal at Central Park Sharing Shed. Listens to Supabase Realtime changes and unlocks locker doors live when QR codes are processed.

---

## 🚀 Quick Start Guide

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables
Copy `.env.local.example` to `.env.local` and add your keys:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
GEMINI_API_KEY=your-gemini-api-key
```

### 3. Setup Supabase Database
Open the Supabase SQL Editor and run the complete schema script:
```bash
# File location:
supabase/schema.sql
```
This single script creates:
- All 6 tables with proper relations and constraints
- Permissive Row Level Security (RLS) policies
- Supabase Realtime publications on `lockers` and `loans`
- Public Storage bucket `return-photos`
- Comprehensive seed data for resident **Aina Rahman**, 5 smart lockers, 5 tools/equipment, and 3 neighbour skill helpers

### 4. Run Development Server
```bash
npm run dev
```
Visit:
- Mobile App: [http://localhost:3000](http://localhost:3000)
- IoT Kiosk Screen: [http://localhost:3000/kiosk](http://localhost:3000/kiosk)

### 5. Build for Production
```bash
npm run build
```
