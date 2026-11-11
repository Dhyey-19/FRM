# FRM Server Setup & Multi-Device Deployment Guide

FRM runs on **one central Windows Server PC** connected to **Microsoft SQL Server 2022 Express**.  
All client devices (**Windows, macOS, Android, and iOS**) access FRM through the server over your office Wi-Fi / LAN (or VPN) with **zero source code or database stored on client devices**.

---

## Step 1: Build Compiled Server Package on Your Dev PC (Zero Source Code)

On your development computer, run:

```cmd
npm run package:server
```

This creates **`dist\FRM-Server-Package.zip`** containing:
- **Compiled & minified frontend** (`public/` — no React `.jsx` source files)
- **Compiled & minified backend** (`backend/server.js`, `backend/database/backup.js` — no readable `controllers/`, `routes/`, `config/`, `middlewares/`, `services/` files)
- **Database schema/migrations** (`backend/database/mssql_init_FRM_DB.sql`, `migrations/`)
- **One-click setup & launch utilities** (`Setup-Server.bat`, `Start-FRM.bat`, `Create-Desktop-Icon.bat`, `Enable-AutoStart-On-Boot.bat`, `backup-database.bat`)
- **Zero `.git/` folder** and **zero dev tooling**.

---

## Step 2: Configure SQL Server 2022 Express on Server PC (One-Time)

### A. Enable Mixed Mode Authentication & `sa` Login (in SSMS)
1. Open **SQL Server Management Studio (SSMS)** and connect using **Windows Authentication**.
2. Right-click the server node -> **Properties** -> **Security** -> select **SQL Server and Windows Authentication mode** -> **OK**.
3. Expand **Security** -> **Logins** -> double-click **`sa`**:
   - Set a strong password on **General**.
   - On **Status**: set **Login: Enabled** -> **OK**.
4. *(Optional — copy an existing database)*: Run `backup-database.bat` on your current PC, copy the `.bak` file to the server, and restore it in SSMS as `FRM_DB`.

### B. Enable TCP/IP on Port `1433`
1. Open **SQL Server 2022 Configuration Manager**.
2. Expand **SQL Server Network Configuration** -> **Protocols for SQLEXPRESS** *(or `MSSQLSERVER`)*.
3. Right-click **TCP/IP** -> **Enable**.
4. Double-click **TCP/IP** -> **IP Addresses** -> scroll to **IPAll**:
   - Clear **TCP Dynamic Ports** (leave blank).
   - Set **TCP Port** to `1433`.
5. Go to **SQL Server Services** and **Restart** **`SQL Server (SQLEXPRESS)`**.

---

## Step 3: Install & Configure on the Server PC

1. Copy **`FRM-Server-Package.zip`** to the Server PC (USB / network folder) and extract it to e.g. **`C:\FRM`**.
2. **Right-click `Setup-Server.bat` -> Run as administrator**.
3. Follow the prompts:
   - Press **Enter** for `localhost`, `1433`, `FRM_DB`, `sa`, `5000`, `5443`.
   - Enter your `sa` SQL password.
   - Choose **`Y`** to initialize `FRM_DB` schema (if empty), create the Desktop Icon, and enable Boot Auto-Start.

`Setup-Server.bat` opens Windows Firewall ports **`5000` (HTTP)** and **`5443` (HTTPS)**, installs runtime dependencies, generates LAN SSL certificates (`backend/certs/`), and sets up `FRM_DB`.

### Recommended Server PC Network Settings
- Assign a **Static LAN IP** (via router DHCP Reservation or Windows IPv4 settings). *(If the server's LAN IP changes later, run `npm run cert` once.)*
- Set the Wi-Fi/Ethernet network profile to **Private** in Windows Network Settings.
- Disable Sleep / Hibernate in Windows Power Settings.

---

## Step 4: Start Server & Access on Windows, Mac, Android & iOS

Double-click **`Start-FRM.bat`** (or the Desktop icon **`FRM - Factory Flow`**). Keep that window open or minimized. The console prints your exact LAN addresses:

| Client Device | How to Access / Install |
| :--- | :--- |
| **Server PC** | Open `http://localhost:5000` |
| **Windows Laptops / Desktops** | Open Chrome/Edge to `http://<SERVER-IP>:5000` -> click **Install** icon in address bar (or `Install App` button) for a standalone desktop app |
| **macOS (MacBook / iMac)** | Open Safari or Chrome to `http://<SERVER-IP>:5000` -> in Safari click **File -> Add to Dock**, or in Chrome click **Install App** |
| **Android Phones / Tablets** | Open Chrome to `http://<SERVER-IP>:5000` -> **⋮ -> Add to Home screen**, or use `https://<SERVER-IP>:5443` (accept cert once) for direct PWA install |
| **iPhone / iPad (iOS)** | Open **Safari** to `http://<SERVER-IP>:5000` -> tap **Share** -> **Add to Home Screen** |

*(For access outside the office over the internet without exposing ports, install **Tailscale** on the Server PC and client devices — `Start-FRM.bat` automatically detects and prints the Tailscale URL too.)*

- **First-Time Activation**: The very first launch on a new Server PC prompts once for Application Registration; once activated on the server, all connected Windows/Mac/mobile devices go straight to Login (`admin` / `admin123` on a fresh DB).

---

## Step 5: How to Update the Server Later (No Git, No Source Code, No Manual Overwrite)

Whenever you build an updated release on your development PC:
1. Run `npm run package:server` on your dev PC to generate the new **`dist\FRM-Server-Package.zip`**.
2. Open FRM from **any** browser logged in as Admin -> go to **Settings -> App Updates**.
3. Click **Choose .zip File**, pick `FRM-Server-Package.zip`, and click **Install Update**.

FRM automatically unpacks the compiled frontend & backend bundles, preserves `.env`, SSL certs, and backups, applies any new MS SQL database migrations safely in transactions, and restarts the server cleanly in ~2 seconds.
