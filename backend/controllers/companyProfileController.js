const { sql, connectDB } = require('../config/db');

exports.getProfile = async (req, res) => {
  try {
    const pool = await connectDB();
    const result = await pool.request().query('SELECT TOP 1 * FROM CompanyProfile');
    if (result.recordset.length === 0) {
      return res.status(200).json(null);
    }
    res.status(200).json(result.recordset[0]);
  } catch (error) {
    console.error('Error fetching company profile:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.addProfile = async (req, res) => {
  const {
    CompanyName, Address1, Address2, City, StateName, CountryName, Pincode,
    ContactPerson, PhoneNo, MobileNo, EmailID, Website, GSTIN, PANNo,
    BankName, BranchName, AccountNo, IFSCCode, UPI
  } = req.body;

  if (!CompanyName) {
    return res.status(400).json({ message: 'Company Name is required' });
  }

  try {
    const pool = await connectDB();
    
    // Check if a record already exists
    const check = await pool.request().query('SELECT COUNT(*) as count FROM CompanyProfile');
    if (check.recordset[0].count > 0) {
      return res.status(400).json({ message: 'Company Profile already exists. You can only update it.' });
    }

    await pool.request()
      .input('CompanyName', sql.VarChar(200), CompanyName)
      .input('Address1', sql.VarChar(250), Address1 || null)
      .input('Address2', sql.VarChar(250), Address2 || null)
      .input('City', sql.VarChar(100), City || null)
      .input('StateName', sql.VarChar(100), StateName || null)
      .input('CountryName', sql.VarChar(100), CountryName || null)
      .input('Pincode', sql.VarChar(20), Pincode || null)
      .input('ContactPerson', sql.VarChar(100), ContactPerson || null)
      .input('PhoneNo', sql.VarChar(50), PhoneNo || null)
      .input('MobileNo', sql.VarChar(50), MobileNo || null)
      .input('EmailID', sql.VarChar(150), EmailID || null)
      .input('Website', sql.VarChar(200), Website || null)
      .input('GSTIN', sql.VarChar(20), GSTIN || null)
      .input('PANNo', sql.VarChar(20), PANNo || null)
      .input('BankName', sql.VarChar(150), BankName || null)
      .input('BranchName', sql.VarChar(150), BranchName || null)
      .input('AccountNo', sql.VarChar(50), AccountNo || null)
      .input('IFSCCode', sql.VarChar(20), IFSCCode || null)
      .input('UPI', sql.VarChar(50), UPI || null)
      .query(`
        INSERT INTO CompanyProfile (
          CompanyName, Address1, Address2, City, StateName, CountryName, Pincode,
          ContactPerson, PhoneNo, MobileNo, EmailID, Website, GSTIN, PANNo,
          BankName, BranchName, AccountNo, IFSCCode, UPI
        ) VALUES (
          @CompanyName, @Address1, @Address2, @City, @StateName, @CountryName, @Pincode,
          @ContactPerson, @PhoneNo, @MobileNo, @EmailID, @Website, @GSTIN, @PANNo,
          @BankName, @BranchName, @AccountNo, @IFSCCode, @UPI
        )
      `);
      
    res.status(201).json({ message: 'Company Profile added successfully' });
  } catch (error) {
    console.error('Error adding company profile:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.updateProfile = async (req, res) => {
  const {
    CompanyName, Address1, Address2, City, StateName, CountryName, Pincode,
    ContactPerson, PhoneNo, MobileNo, EmailID, Website, GSTIN, PANNo,
    BankName, BranchName, AccountNo, IFSCCode, UPI
  } = req.body;

  if (!CompanyName) {
    return res.status(400).json({ message: 'Company Name is required' });
  }

  try {
    const pool = await connectDB();
    
    // Check if a record exists to update
    const check = await pool.request().query('SELECT COUNT(*) as count FROM CompanyProfile');
    if (check.recordset[0].count === 0) {
      return res.status(404).json({ message: 'No Company Profile exists to update' });
    }

    await pool.request()
      .input('CompanyName', sql.VarChar(200), CompanyName)
      .input('Address1', sql.VarChar(250), Address1 || null)
      .input('Address2', sql.VarChar(250), Address2 || null)
      .input('City', sql.VarChar(100), City || null)
      .input('StateName', sql.VarChar(100), StateName || null)
      .input('CountryName', sql.VarChar(100), CountryName || null)
      .input('Pincode', sql.VarChar(20), Pincode || null)
      .input('ContactPerson', sql.VarChar(100), ContactPerson || null)
      .input('PhoneNo', sql.VarChar(50), PhoneNo || null)
      .input('MobileNo', sql.VarChar(50), MobileNo || null)
      .input('EmailID', sql.VarChar(150), EmailID || null)
      .input('Website', sql.VarChar(200), Website || null)
      .input('GSTIN', sql.VarChar(20), GSTIN || null)
      .input('PANNo', sql.VarChar(20), PANNo || null)
      .input('BankName', sql.VarChar(150), BankName || null)
      .input('BranchName', sql.VarChar(150), BranchName || null)
      .input('AccountNo', sql.VarChar(50), AccountNo || null)
      .input('IFSCCode', sql.VarChar(20), IFSCCode || null)
      .input('UPI', sql.VarChar(50), UPI || null)
      .query(`
        UPDATE CompanyProfile SET
          CompanyName = @CompanyName,
          Address1 = @Address1,
          Address2 = @Address2,
          City = @City,
          StateName = @StateName,
          CountryName = @CountryName,
          Pincode = @Pincode,
          ContactPerson = @ContactPerson,
          PhoneNo = @PhoneNo,
          MobileNo = @MobileNo,
          EmailID = @EmailID,
          Website = @Website,
          GSTIN = @GSTIN,
          PANNo = @PANNo,
          BankName = @BankName,
          BranchName = @BranchName,
          AccountNo = @AccountNo,
          IFSCCode = @IFSCCode,
          UPI = @UPI
      `);
      
    res.status(200).json({ message: 'Company Profile updated successfully' });
  } catch (error) {
    console.error('Error updating company profile:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
