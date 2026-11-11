# FRM Server Setup Guide (Windows Server + SQL Server 2022 Express)

Follow these steps once on the **Server PC** so all laptops, desktops, and mobile phones on your office Wi-Fi / LAN can access FRM.

---

## Step 1: Configure SQL Server 2022 Express (One-Time)

SQL Server 2022 Express disables remote/TCP connections and `sa` SQL login by default. Enable both:

### A. Enable Mixed Mode Authentication & `sa` Login (in SSMS)
1. Open **SQL Server Management Studio (SSMS)** and connect using **Windows Authentication**.
2. Right-click the server node at the top -> **Properties** -> **Security**.
3. Select **SQL Server and Windows Authentication mode** -> click **OK**.
4. Expand **Security** -> **Logins** -> double-click **`sa`**:
   - On **General**: set a strong password.
   - On **Status**: set **Login** to **Enabled** -> click **OK**.
5. *(Optional — Move Existing Data from Dev PC)*:
   - Run `backup-database.bat` on your current PC to generate a `.bak` file in `backend\database\backups\`.
   - Copy that `.bak` file to the server PC, right-click **Databases** in SSMS -> **Restore Database...** -> **Device** -> restore it as `FRM_DB`.
   - *(Skip this if you want a fresh starter database — Step 3 will create `FRM_DB` automatically.)*

### B. Enable TCP/IP on Port `1433`
1. Open **SQL Server 2022 Configuration Manager**.
2. Expand **SQL Server Network Configuration** -> **Protocols for SQLEXPRESS** *(or `MSSQLSERVER` if installed as default instance)*.
3. Right-click **TCP/IP** -> **Enable**.
4. Double-click **TCP/IP** -> go to the **IP Addresses** tab -> scroll to the bottom (**IPAll**):
   - Clear **TCP Dynamic Ports** (make it blank).
   - Set **TCP Port** to `1433`.
5. Click **OK**, go to **SQL Server Services**, and **Restart** **`SQL Server (SQLEXPRESS)`**.

---

## Step 2: Copy / Clone FRM onto the Server PC

Either clone via Git or copy the `FRM` folder (for example to `C:\FRM` or `D:\FRM`):

```cmd
git clone https://github.com/Dhyey-19/FRM.git
cd FRM
```

*(Ensure Git, Node.js LTS, and SQL Server 2022 Express are installed.)*

---

## Step 3: Run the Automated Server Setup

1. Go into the `FRM` folder.
2. **Right-click `Setup-Server.bat` -> Run as administrator**.
3. Follow the prompts:
   - **SQL Server Host**: press Enter for `localhost`
   - **SQL Server Port**: press Enter for `1433`
   - **Database Name**: press Enter for `FRM_DB`
   - **SQL Login Username**: press Enter for `sa`
   - **SQL Password**: enter the `sa` password you set in Step 1A
   - **Activation Email** *(optional)*: press Enter to skip or enter your email credentials
   - If `FRM_DB` is new/empty, choose **`Y`** to initialize schema and starter data automatically.
   - Choose **`Y`** to create the **Desktop Shortcut** and **Auto-Start on Windows Boot**.

`Setup-Server.bat` automatically:
- Opens Windows Firewall ports **`5000` (HTTP)** and **`5443` (HTTPS)** for LAN devices.
- Installs Node packages (`npm install`).
- Creates `.env` and initializes/migrates `FRM_DB`.
- Generates local HTTPS SSL certificates (`backend/certs/`) for the server's LAN IP.
- Builds the production frontend (`frontend/dist/`).

---

## Step 4: Set a Static LAN IP for the Server PC (Recommended)

So client bookmarks don't change when the server restarts:
- Either reserve the Server PC's IP in your Wi-Fi router (**DHCP Reservation**), **or** set a static IPv4 address in Windows Network Settings (e.g. `192.168.1.100`).
- *(If your server's IP changes later, run `npm run cert` once so HTTPS certificates match the new IP.)*
- Make sure the Server PC's Wi-Fi/Ethernet network profile is set to **Private** in Windows Network Settings, and keep Sleep/Hibernate disabled in **Power & Sleep** settings so the server stays online.

---

## Step 5: Start the Server & Access from All Devices

1. Double-click **`Start-FRM.bat`** (or the **`FRM - Factory Flow`** desktop icon).
2. Keep that command window open (or minimized) while devices are using the software. The terminal prints the exact URLs:
   - **On the Server PC**: `http://localhost:5000`
   - **On Office Laptops / Phones (same Wi-Fi/LAN)**: `http://<SERVER-IP>:5000`
   - **For Mobile PWA "Install App"**: `https://<SERVER-IP>:5443` *(accept the self-signed certificate warning once -> "Advanced -> Proceed")*

### First-Time Activation & Login
- **First launch on the new Server PC**: Opens the Application Registration screen once. Activate it once on the Server PC (`%APPDATA%\FRM\registration.json`), after which all client devices go directly to the Login screen.
- **Default Admin Login** *(on a fresh database)*: **`admin`** / **`admin123`** *(change the password or add employee logins under Administration -> User Master).*

---

## Day-to-Day Maintenance

- **Backup Database**: Double-click `backup-database.bat` (creates `.bak` in `backend\database\backups\`) or use the in-app **Excel Backup**.
- **Update Software**: Close the running server window, double-click `update.bat`, then reopen `Start-FRM.bat`.
