const { sql, connectDB } = require('../config/db');
const nodemailer = require('nodemailer');

exports.signup = async (req, res) => {
  const { username, password, mobileNo } = req.body;

  try {
    const pool = await connectDB();
    const result = await pool.request()
      .input('Username', sql.VarChar(30), username)
      .input('Password', sql.VarChar(10), password)
      .input('MobileNo', sql.VarChar(10), mobileNo)
      .query(`
        INSERT INTO Users (Username, Password, MobileNo)
        OUTPUT inserted.UserId, inserted.Username, inserted.UserRole
        VALUES (@Username, @Password, @MobileNo)
      `);
    
    res.status(201).json({ message: 'User created successfully', user: result.recordset[0] });
  } catch (error) {
    console.error('Signup error:', error);
    // Check if it's a unique constraint violation
    if (error.number === 2627) {
      return res.status(400).json({ message: 'Username already exists' });
    }
    res.status(500).json({ message: 'Server error during signup' });
  }
};

exports.login = async (req, res) => {
  const { username, password } = req.body;

  try {
    const pool = await connectDB();
    const result = await pool.request()
      .input('Username', sql.VarChar(30), username)
      .input('Password', sql.VarChar(10), password)
      .query(`
        SELECT UserId, Username, MobileNo, UserRole, IsActive, IsAdd, IsEdit, IsDelete 
        FROM Users 
        WHERE Username = @Username AND Password = @Password
      `);

    if (result.recordset.length === 0) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const user = result.recordset[0];
    if (!user.IsActive || user.IsActive === 0) {
      return res.status(401).json({ message: 'Your Account is Inactive' });
    }

    res.status(200).json({ message: 'Login successful', user });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error during login' });
  }
};

const fs = require('fs');
const path = require('path');

const getRegistrationFilePath = () => {
  const appDataDir = process.env.APPDATA || (process.platform === 'darwin' ? `${process.env.HOME}/Library/Application Support` : `${process.env.HOME}/.config`);
  const folderPath = path.join(appDataDir, 'FactoryFlow');
  if (!fs.existsSync(folderPath)) {
    fs.mkdirSync(folderPath, { recursive: true });
  }
  return path.join(folderPath, 'registration.json');
};

const readRegistrationFile = () => {
  const filePath = getRegistrationFilePath();
  if (fs.existsSync(filePath)) {
    try {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (e) {
      console.error('Error reading registration file:', e);
    }
  }
  return null;
};

const writeRegistrationFile = (data) => {
  const filePath = getRegistrationFilePath();
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {
    console.error('Error writing registration file:', e);
  }
};

exports.getRegistrationStatus = async (req, res) => {
  try {
    let regData = readRegistrationFile();
    if (!regData) {
      // Generate a new 10-digit random number
      const min = 1000000000;
      const max = 9999999999;
      const randomNumber = Math.floor(Math.random() * (max - min + 1) + min).toString();
      regData = {
        isRegistered: false,
        randomNumber: randomNumber
      };
      writeRegistrationFile(regData);
    }
    res.status(200).json(regData);
  } catch (error) {
    console.error('Get registration status error:', error);
    res.status(500).json({ message: 'Server error checking registration' });
  }
};

exports.registerApp = async (req, res) => {
  try {
    let regData = readRegistrationFile() || {};
    regData.isRegistered = true;
    writeRegistrationFile(regData);
    res.status(200).json({ message: 'App registered successfully', isRegistered: true });
  } catch (error) {
    console.error('Register app error:', error);
    res.status(500).json({ message: 'Server error registering app' });
  }
};

const { exec } = require('child_process');
const os = require('os');

exports.sharePDF = async (req, res) => {
  const { pdfBase64, reportName } = req.body;
  
  if (!pdfBase64) {
    return res.status(400).json({ message: 'No PDF data provided' });
  }

  try {
    const cleanReportName = (reportName || 'report').replace(/[^a-zA-Z0-9]/g, '_');
    
    // Save to user's Documents/FactoryFlow_Reports folder
    const userHome = os.homedir();
    const targetDir = path.join(userHome, 'Documents', 'FactoryFlow_Reports');
    
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
    const targetFile = path.join(targetDir, `${cleanReportName}_${timestamp}.pdf`);
    
    // Convert base64 back to buffer
    const buffer = Buffer.from(pdfBase64, 'base64');
    fs.writeFileSync(targetFile, buffer);

    // Open the folder in Windows Explorer and highlight the file
    if (process.platform === 'win32') {
      exec(`explorer.exe /select,"${targetFile}"`);
    } else if (process.platform === 'darwin') {
      exec(`open -R "${targetFile}"`);
    } else {
      exec(`xdg-open "${targetDir}"`);
    }

    res.status(200).json({ 
      message: 'PDF saved and opened in explorer', 
      filePath: targetFile, 
      folderPath: targetDir 
    });
  } catch (error) {
    console.error('Share PDF error:', error);
    res.status(500).json({ message: 'Server error sharing PDF' });
  }
};

exports.requestActivation = async (req, res) => {
  const { appName, randomNumber, activationKey } = req.body;

  if (!randomNumber || !activationKey) {
    return res.status(400).json({ message: 'Device verification number and activation key are required.' });
  }

  const emailUser = process.env.EMAIL_USER || 'softechit@gmail.com';
  const emailPass = process.env.EMAIL_PASS;

  if (!emailPass) {
    console.error('SMTP Password (EMAIL_PASS) is not configured in environment variables.');
    return res.status(500).json({ 
      message: 'SMTP credentials are not configured on the server. Please add EMAIL_PASS to the .env file.' 
    });
  }

  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: emailUser,
        pass: emailPass
      },
      tls: {
        rejectUnauthorized: false
      }
    });

    const mailOptions = {
      from: emailUser,
      to: 'softechit@gmail.com',
      subject: `Activation - App: ${appName || 'FactoryFlow'}, Device Verification: ${randomNumber}, Activation Key: ${activationKey}`,
      text: `Hello,

A request for application activation has been made.

Application Details:
- Application Name: ${appName || 'FactoryFlow'}
- Device Verification Number: ${randomNumber}
- Generated Activation Key: ${activationKey}

Please use the Activation Key above to register the application on the user's device.

Best regards,
FactoryFlow System`
    };

    await transporter.sendMail(mailOptions);
    res.status(200).json({ message: 'Activation request email sent successfully!' });
  } catch (error) {
    console.error('Send activation email error:', error);
    res.status(500).json({ message: 'Failed to send activation email: ' + error.message });
  }
};

exports.surrenderApp = async (req, res) => {
  try {
    let regData = readRegistrationFile() || {};
    regData.isRegistered = false;
    
    // Regenerate a new randomNumber to ensure a completely fresh registration lifecycle
    const min = 1000000000;
    const max = 9999999999;
    regData.randomNumber = Math.floor(Math.random() * (max - min + 1) + min).toString();
    
    writeRegistrationFile(regData);
    res.status(200).json({ message: 'App license surrendered successfully', isRegistered: false });
  } catch (error) {
    console.error('Surrender app error:', error);
    res.status(500).json({ message: 'Server error surrendering license' });
  }
};

const exceljs = require('exceljs');

exports.backupDatabase = async (req, res) => {
  try {
    const pool = await connectDB();
    const tablesResult = await pool.request().query("SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE'");
    const tables = tablesResult.recordset.map(row => row.TABLE_NAME);

    const workbook = new exceljs.Workbook();

    for (const table of tables) {
      const dataResult = await pool.request().query(`SELECT * FROM [${table}]`);
      const data = dataResult.recordset;

      const worksheet = workbook.addWorksheet(table);

      if (data.length > 0) {
        // Add headers
        const columns = Object.keys(data[0]).map(key => ({ header: key, key: key }));
        worksheet.columns = columns;

        // Add rows
        worksheet.addRows(data);
      } else {
        worksheet.addRow(['No Data']);
      }
    }

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    
    // Generate filename with current date and time
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-');
    const filename = `Factory Flow Backup ${dateStr} ${timeStr}.xlsx`;

    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Backup database error:', error);
    res.status(500).json({ message: 'Server error backing up database' });
  }
};
