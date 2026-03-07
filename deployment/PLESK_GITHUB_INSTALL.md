# BotDash on Plesk (Simple Client Guide)
It shows exactly where to click in Plesk and how to run this project from GitHub.

---

## A) Before you start (you need these)

1. Your Plesk login
2. Your domain already pointing to the server
3. GitHub repository URL
4. Telegram bot token from @BotFather
5. Database password you want to use

---

## B) Understand Plesk screen positions

Use this quick map while reading steps:

- **Left Sidebar (server/global tools)**
  - `Tools & Settings`
  - `Websites & Domains`

- **Main Content Area (center/right panel)**
  - Cards/buttons like `Databases`, `Node.js`, `Git`, `File Manager`, `SSL/TLS Certificates`

- **Top-right area (inside pages)**
  - Buttons like `Add`, `Pull Updates`, `Restart App`

---

## C) Recommended setup (easy)

Use 2 subdomains:
- `app.yourdomain.com` → frontend (`admin-panel`)
- `api.yourdomain.com` → backend (`backend`)

This is easiest in Plesk and easiest to maintain.

---

## D) Step-by-step deployment

## Step 1: Check Node.js support in Plesk

**Where:**
- **Left Sidebar** → `Tools & Settings`
- **Main Area** → `Updates`

Do:
1. Open `Tools & Settings`.
2. Open `Updates`.
3. Ensure Node.js support is installed.

---

## Step 2: Create subdomains

**Where:**
- **Left Sidebar** → `Websites & Domains`
- **Main Area** → your domain page
- **Top-right** → `Add Subdomain`

Create:
1. `app.yourdomain.com`
2. `api.yourdomain.com`

---

## Step 3: Add GitHub repo for each subdomain

Do these steps two times (once in `app`, once in `api`).

**Where:**
- **Left Sidebar** → `Websites & Domains`
- Click subdomain (`app...` or `api...`)
- **Main Area** card/button → `Git`
- **Top-right** → `Add Repository`

Git settings:
- Repository URL: your GitHub URL
- Branch: your deploy branch (example: `main`)
- Deployment path: default of that subdomain

Then:
- Click `Pull Updates` (top-right in Git page)

---

## Step 4: Create database

**Where:**
- **Left Sidebar** → `Websites & Domains`
- Click `api.yourdomain.com`
- **Main Area** → `Databases`
- **Top-right** → `Add Database`

Create:
- DB name: `botdash`
- DB user: `botdash_user`
- Strong password

Save these for env vars.

---

## Step 5: Configure backend Node.js app (api subdomain)

**Where:**
- **Left Sidebar** → `Websites & Domains`
- Click `api.yourdomain.com`
- **Main Area** → `Node.js`

Set:
- Node version: `20.x`
- Application mode: `production`
- Application root: repo root folder
- Startup file: `backend/index.js`

Then in same Node.js page:
- Open `Environment Variables`
- Add:

```env
DATABASE_URL=postgresql://botdash_user:YOUR_DB_PASSWORD@localhost:5432/botdash
BOT_TOKEN=YOUR_TELEGRAM_BOT_TOKEN
BOT_USERNAME=YOUR_BOT_USERNAME
DEFAULT_ADMIN_USERNAME=admin
DEFAULT_ADMIN_PASSWORD=CHANGE_ME_STRONG
ADMIN_JWT_SECRET=VERY_LONG_RANDOM_SECRET
NODE_ENV=production
PORT=3001
DISABLE_TELEGRAM_AUTH=false
```

---

## Step 6: Configure frontend Node.js app (app subdomain)

**Where:**
- **Left Sidebar** → `Websites & Domains`
- Click `app.yourdomain.com`
- **Main Area** → `Node.js`

Set:
- Node version: `20.x`
- Application mode: `production`
- Application root: `admin-panel`
- Startup file: `node_modules/next/dist/bin/next`
- Application parameters: `start -p 3000`

Environment variable in same page:

```env
NEXT_PUBLIC_API_URL=https://api.yourdomain.com
```

---

## Step 7: Install packages and build

Use Plesk terminal or SSH.

### 7.1 Backend

```bash
cd backend
npm install
npm run migrate
```

### 7.2 Frontend

```bash
cd admin-panel
npm install
npm run build
```

---

## Step 8: Restart both apps

### 8.1 Restart API app

**Where:**
- `Websites & Domains` → `api.yourdomain.com` → `Node.js`
- **Top-right** button: `Restart App`

### 8.2 Restart APP app

**Where:**
- `Websites & Domains` → `app.yourdomain.com` → `Node.js`
- **Top-right** button: `Restart App`

---

## Step 9: SSL (HTTPS)

Do this for both `app` and `api`.

**Where:**
- `Websites & Domains` → choose subdomain
- **Main Area** → `SSL/TLS Certificates`

Do:
1. Issue Let’s Encrypt certificate
2. Enable HTTPS redirect in Hosting Settings

---

## Step 10: Test everything

1. Open `https://app.yourdomain.com` → login page should open
2. Open `https://api.yourdomain.com` (or any API endpoint) → API responds
3. Login admin and test broadcast message
4. Test image/video send from admin panel

---

## E) Where to find common items quickly

- **Database server engine (PostgreSQL/MySQL):**
  - Left Sidebar → `Tools & Settings` → `Database Servers`

- **Project database/user:**
  - Left Sidebar → `Websites & Domains` → `api.yourdomain.com` → `Databases`

- **Backend env vars:**
  - Left Sidebar → `Websites & Domains` → `api.yourdomain.com` → `Node.js` → `Environment Variables`

- **Frontend env vars:**
  - Left Sidebar → `Websites & Domains` → `app.yourdomain.com` → `Node.js` → `Environment Variables`

- **Git pull updates:**
  - Left Sidebar → `Websites & Domains` → subdomain → `Git` → top-right `Pull Updates`

- **Logs:**
  - Left Sidebar → `Websites & Domains` → subdomain → `Logs`

- **File manager:**
  - Left Sidebar → `Websites & Domains` → subdomain → `File Manager`

---

## F) Update in future (quick process)

For `api` and `app`:
1. Open subdomain → `Git` → `Pull Updates`
2. Run installs/build again if needed:

```bash
cd backend && npm install && npm run migrate
cd ../admin-panel && npm install && npm run build
```

3. Restart both Node.js apps

---

## G) If something is not working

1. Check subdomain `Logs`
2. Check Node.js app status in `Node.js` page
3. Confirm env vars are saved in correct subdomain
4. Confirm DB credentials in `DATABASE_URL`
5. Confirm `NEXT_PUBLIC_API_URL` points to `https://api.yourdomain.com`

---

Deployment is complete when:
- `app.yourdomain.com` opens admin panel
- `api.yourdomain.com` backend is running
- login works
- Telegram text + media sending works
