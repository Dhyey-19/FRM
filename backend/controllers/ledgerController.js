const { sql, connectDB } = require('../config/db');

exports.getLedgers = async (req, res) => {
  try {
    const pool = await connectDB();
    const result = await pool.request().query(`
      SELECT l.*, a.GroupName as AccountGroupName
      FROM LedgerMaster l
      LEFT JOIN AccountGroup a ON l.AccountGroupID = a.Id
      ORDER BY l.LedgerName ASC
    `);
    res.status(200).json(result.recordset);
  } catch (error) {
    console.error('Error fetching ledgers:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getPayableReport = async (req, res) => {
  try {
    const pool = await connectDB();
    const result = await pool.request().query(`
      SELECT 
          l.Id as RowId,
          l.LedgerName as VendorName,
          l.MobileNo,
          l.BankName,
          l.AccountNo,
          l.IFSC,
          l.UPI,
          ISNULL(l.OpeningBalance, 0) as OpeningBalance,
          ISNULL(SUM(h.TOTALAMOUNT), 0) AS TotalInwardAmount,
          ISNULL(l.ClosingBalance, 0) as ClosingBalance
      FROM LedgerMaster l
      INNER JOIN AccountGroup a ON l.AccountGroupID = a.Id
      LEFT JOIN InwardHeader h ON l.Id = h.LEDGERID
      WHERE a.GroupName IN ('Sundry Debtors', 'Sundry Creditors', 'Vendor', 'Party') 
        AND ISNULL(l.ClosingBalance, 0) < 0
      GROUP BY l.Id, l.LedgerName, l.MobileNo, l.BankName, l.AccountNo, l.IFSC, l.UPI, l.OpeningBalance, l.ClosingBalance
      ORDER BY l.LedgerName ASC
    `);
    res.status(200).json(result.recordset);
  } catch (error) {
    console.error('Error fetching payable report:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getReceivableReport = async (req, res) => {
  try {
    const pool = await connectDB();
    const result = await pool.request().query(`
      SELECT 
          l.Id as RowId,
          l.LedgerName as PartyName,
          l.MobileNo,
          ISNULL(l.OpeningBalance, 0) as OpeningBalance,
          ISNULL(SUM(h.TOTALAMOUNT), 0) AS TotalOutwardAmount,
          ISNULL(l.ClosingBalance, 0) as ClosingBalance
      FROM LedgerMaster l
      INNER JOIN AccountGroup a ON l.AccountGroupID = a.Id
      LEFT JOIN OutwardHeader h ON l.Id = h.LEDGERID
      WHERE a.GroupName IN ('Sundry Debtors', 'Sundry Creditors', 'Vendor', 'Party') 
        AND ISNULL(l.ClosingBalance, 0) > 0
      GROUP BY l.Id, l.LedgerName, l.MobileNo, l.OpeningBalance, l.ClosingBalance
      ORDER BY l.LedgerName ASC
    `);
    res.status(200).json(result.recordset);
  } catch (error) {
    console.error('Error fetching receivable report:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.addLedger = async (req, res) => {
  const { 
    LedgerName, AccountGroupID, Address, City, State, GSTIN, MobileNo, Email, 
    OpeningBalance, ClosingBalance, BankName, AccountNo, IFSC, UPI, OwnBrand, OtherBrand, 
    Discount, CD, Bill, PaymentTerm, Transport, Remark 
  } = req.body;

  if (!LedgerName || !AccountGroupID) {
    return res.status(400).json({ message: 'Ledger Name and Account Group are required' });
  }

  try {
    const pool = await connectDB();
    
    // Check if name exists
    const check = await pool.request()
      .input('LedgerName', sql.VarChar(100), LedgerName)
      .query('SELECT * FROM LedgerMaster WHERE LedgerName = @LedgerName');
      
    if (check.recordset.length > 0) {
      return res.status(400).json({ message: 'Ledger Name already exists' });
    }

    await pool.request()
      .input('LedgerName', sql.VarChar(100), LedgerName)
      .input('AccountGroupID', sql.Int, parseInt(AccountGroupID))
      .input('Address', sql.VarChar(255), Address || null)
      .input('City', sql.VarChar(20), City || null)
      .input('State', sql.VarChar(20), State || null)
      .input('GSTIN', sql.VarChar(15), GSTIN || null)
      .input('MobileNo', sql.VarChar(10), MobileNo || null)
      .input('Email', sql.VarChar(50), Email || null)
      .input('OpeningBalance', sql.Numeric(12,2), OpeningBalance || 0)
      .input('ClosingBalance', sql.Numeric(12,2), ClosingBalance !== undefined && ClosingBalance !== null && ClosingBalance !== '' ? ClosingBalance : (OpeningBalance || 0))
      .input('BankName', sql.VarChar(100), BankName || null)
      .input('AccountNo', sql.VarChar(30), AccountNo || null)
      .input('IFSC', sql.VarChar(15), IFSC || null)
      .input('UPI', sql.VarChar(50), UPI || null)
      .input('OwnBrand', sql.VarChar(15), OwnBrand || null)
      .input('OtherBrand', sql.VarChar(15), OtherBrand || null)
      .input('Discount', sql.Decimal(5,2), Discount || null)
      .input('CD', sql.Numeric(3,0), CD || null)
      .input('Bill', sql.Decimal(5,2), Bill || null)
      .input('PaymentTerm', sql.Numeric(3,0), PaymentTerm || null)
      .input('Transport', sql.VarChar(50), Transport || null)
      .input('Remark', sql.VarChar(100), Remark || null)
      .query(`
        INSERT INTO LedgerMaster (
          LedgerName, AccountGroupID, Address, City, State, GSTIN, MobileNo, Email,
          OpeningBalance, ClosingBalance, BankName, AccountNo, IFSC, UPI, OwnBrand, OtherBrand,
          Discount, CD, Bill, PaymentTerm, Transport, Remark
        ) VALUES (
          @LedgerName, @AccountGroupID, @Address, @City, @State, @GSTIN, @MobileNo, @Email,
          @OpeningBalance, @ClosingBalance, @BankName, @AccountNo, @IFSC, @UPI, @OwnBrand, @OtherBrand,
          @Discount, @CD, @Bill, @PaymentTerm, @Transport, @Remark
        )
      `);
      
    res.status(201).json({ message: 'Ledger added successfully' });
  } catch (error) {
    console.error('Error adding ledger:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.updateLedger = async (req, res) => {
  const { id } = req.params; // This is the numeric Id now
  const { 
    LedgerName, AccountGroupID, Address, City, State, GSTIN, MobileNo, Email, 
    OpeningBalance, ClosingBalance, BankName, AccountNo, IFSC, UPI, OwnBrand, OtherBrand, 
    Discount, CD, Bill, PaymentTerm, Transport, Remark 
  } = req.body;

  if (!LedgerName || !AccountGroupID) {
    return res.status(400).json({ message: 'Ledger Name and Account Group are required' });
  }

  try {
    const pool = await connectDB();
    
    const checkSys = await pool.request()
      .input('Id', sql.Numeric(10,0), id)
      .query('SELECT Id FROM LedgerMaster WHERE Id = @Id');
      
    if (checkSys.recordset.length === 0) {
      return res.status(404).json({ message: 'Ledger not found' });
    }

    await pool.request()
      .input('Id', sql.Numeric(10,0), id)
      .input('LedgerName', sql.VarChar(100), LedgerName)
      .input('AccountGroupID', sql.Int, parseInt(AccountGroupID))
      .input('Address', sql.VarChar(255), Address || null)
      .input('City', sql.VarChar(20), City || null)
      .input('State', sql.VarChar(20), State || null)
      .input('GSTIN', sql.VarChar(15), GSTIN || null)
      .input('MobileNo', sql.VarChar(10), MobileNo || null)
      .input('Email', sql.VarChar(50), Email || null)
      .input('OpeningBalance', sql.Numeric(12,2), OpeningBalance || 0)
      .input('ClosingBalance', sql.Numeric(12,2), ClosingBalance || 0)
      .input('BankName', sql.VarChar(100), BankName || null)
      .input('AccountNo', sql.VarChar(30), AccountNo || null)
      .input('IFSC', sql.VarChar(15), IFSC || null)
      .input('UPI', sql.VarChar(50), UPI || null)
      .input('OwnBrand', sql.VarChar(15), OwnBrand || null)
      .input('OtherBrand', sql.VarChar(15), OtherBrand || null)
      .input('Discount', sql.Decimal(5,2), Discount || null)
      .input('CD', sql.Numeric(3,0), CD || null)
      .input('Bill', sql.Decimal(5,2), Bill || null)
      .input('PaymentTerm', sql.Numeric(3,0), PaymentTerm || null)
      .input('Transport', sql.VarChar(50), Transport || null)
      .input('Remark', sql.VarChar(100), Remark || null)
      .query(`
        UPDATE LedgerMaster SET 
          LedgerName = @LedgerName, AccountGroupID = @AccountGroupID, Address = @Address, 
          City = @City, State = @State, GSTIN = @GSTIN, MobileNo = @MobileNo, Email = @Email,
          OpeningBalance = @OpeningBalance, ClosingBalance = @ClosingBalance, BankName = @BankName, 
          AccountNo = @AccountNo, IFSC = @IFSC, UPI = @UPI, OwnBrand = @OwnBrand, OtherBrand = @OtherBrand,
          Discount = @Discount, CD = @CD, Bill = @Bill, PaymentTerm = @PaymentTerm, 
          Transport = @Transport, Remark = @Remark
        WHERE Id = @Id
      `);
      
    res.status(200).json({ message: 'Ledger updated successfully' });
  } catch (error) {
    console.error('Error updating ledger:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.deleteLedger = async (req, res) => {
  const { id } = req.params;

  try {
    const pool = await connectDB();
    
    const checkSys = await pool.request()
      .input('Id', sql.Numeric(10,0), id)
      .query('SELECT Id FROM LedgerMaster WHERE Id = @Id');
      
    if (checkSys.recordset.length === 0) {
      return res.status(404).json({ message: 'Ledger not found' });
    }

    await pool.request()
      .input('Id', sql.Numeric(10,0), id)
      .query('DELETE FROM LedgerMaster WHERE Id = @Id');
      
    res.status(200).json({ message: 'Ledger deleted successfully' });
  } catch (error) {
    console.error('Error deleting ledger:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const plExpenseGroups = ['Purchase Accounts', 'Direct Expenses', 'Indirect Expenses'];
const plIncomeGroups = ['Sales Accounts', 'Direct Incomes', 'Indirect Incomes'];

const bsAssetGroups = [
  'Bank Accounts', 'Cash-in-Hand', 'Current Assets', 'Deposits (Asset)',
  'Fixed Assets', 'Investments', 'Loans & Advances (Asset)', 'Misc. Expenses (ASSET)',
  'Sundry Debtors', 'Party'
];
const bsLiabilityGroups = [
  'Capital Account', 'Current Liabilities', 'Duties & Taxes', 'Loans (Liability)',
  'Provisions', 'Reserves & Surplus', 'Secured Loans', 'Sundry Creditors',
  'Unsecured Loans', 'Vendor'
];

exports.getProfitLossReport = async (req, res) => {
  try {
    const pool = await connectDB();
    const result = await pool.request().query(`
      SELECT l.LedgerName, ISNULL(l.ClosingBalance, 0) as ClosingBalance, a.GroupName
      FROM LedgerMaster l
      LEFT JOIN AccountGroup a ON l.AccountGroupID = a.Id
    `);
    
    const records = result.recordset;
    
    // Groups structure
    const expenseGroupsMap = {};
    const incomeGroupsMap = {};
    
    plExpenseGroups.forEach(g => {
      expenseGroupsMap[g] = { groupName: g, ledgers: [], total: 0 };
    });
    plIncomeGroups.forEach(g => {
      incomeGroupsMap[g] = { groupName: g, ledgers: [], total: 0 };
    });
    
    let totalExpenses = 0;
    let totalIncomes = 0;
    
    records.forEach(r => {
      const balance = r.ClosingBalance;
      if (plExpenseGroups.includes(r.GroupName)) {
        const amt = Math.abs(balance);
        if (amt !== 0) {
          expenseGroupsMap[r.GroupName].ledgers.push({ ledgerName: r.LedgerName, balance: amt });
          expenseGroupsMap[r.GroupName].total += amt;
          totalExpenses += amt;
        }
      } else if (plIncomeGroups.includes(r.GroupName)) {
        const amt = Math.abs(balance);
        if (amt !== 0) {
          incomeGroupsMap[r.GroupName].ledgers.push({ ledgerName: r.LedgerName, balance: amt });
          incomeGroupsMap[r.GroupName].total += amt;
          totalIncomes += amt;
        }
      }
    });
    
    // Clean empty groups
    const leftSide = Object.values(expenseGroupsMap).filter(g => g.ledgers.length > 0);
    const rightSide = Object.values(incomeGroupsMap).filter(g => g.ledgers.length > 0);
    
    const netProfit = totalIncomes - totalExpenses;
    
    res.status(200).json({
      leftSide,
      rightSide,
      totalExpenses,
      totalIncomes,
      netProfit
    });
  } catch (error) {
    console.error('Error generating Profit & Loss report:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getBalanceSheetReport = async (req, res) => {
  try {
    const pool = await connectDB();
    const result = await pool.request().query(`
      SELECT l.LedgerName, ISNULL(l.ClosingBalance, 0) as ClosingBalance, a.GroupName
      FROM LedgerMaster l
      LEFT JOIN AccountGroup a ON l.AccountGroupID = a.Id
    `);
    
    const records = result.recordset;
    
    // Calculate Net Profit from PL accounts
    let totalExpenses = 0;
    let totalIncomes = 0;
    records.forEach(r => {
      const balance = r.ClosingBalance;
      if (plExpenseGroups.includes(r.GroupName)) {
        totalExpenses += Math.abs(balance);
      } else if (plIncomeGroups.includes(r.GroupName)) {
        totalIncomes += Math.abs(balance);
      }
    });
    const netProfit = totalIncomes - totalExpenses;
    
    // Group Balance Sheet accounts
    const assetGroupsMap = {};
    const liabilityGroupsMap = {};
    
    bsAssetGroups.forEach(g => {
      assetGroupsMap[g] = { groupName: g, ledgers: [], total: 0 };
    });
    bsLiabilityGroups.forEach(g => {
      liabilityGroupsMap[g] = { groupName: g, ledgers: [], total: 0 };
    });
    
    // Resolving generic/unmapped groups
    const extraAssetGroup = 'Other Asset Accounts';
    const extraLiabilityGroup = 'Other Liability Accounts';
    assetGroupsMap[extraAssetGroup] = { groupName: extraAssetGroup, ledgers: [], total: 0 };
    liabilityGroupsMap[extraLiabilityGroup] = { groupName: extraLiabilityGroup, ledgers: [], total: 0 };
    
    let rawAssetsTotal = 0;
    let rawLiabilitiesTotal = 0;
    
    records.forEach(r => {
      const balance = r.ClosingBalance;
      if (bsAssetGroups.includes(r.GroupName)) {
        if (balance !== 0) {
          assetGroupsMap[r.GroupName].ledgers.push({ ledgerName: r.LedgerName, balance: balance });
          assetGroupsMap[r.GroupName].total += balance;
          rawAssetsTotal += balance;
        }
      } else if (bsLiabilityGroups.includes(r.GroupName)) {
        if (balance !== 0) {
          const amt = Math.abs(balance);
          liabilityGroupsMap[r.GroupName].ledgers.push({ ledgerName: r.LedgerName, balance: amt });
          liabilityGroupsMap[r.GroupName].total += amt;
          rawLiabilitiesTotal += amt;
        }
      } else if (r.GroupName === 'Branch / Divisions' || r.GroupName === 'Suspense A/c') {
        if (balance !== 0) {
          if (balance >= 0) {
            assetGroupsMap[extraAssetGroup].ledgers.push({ ledgerName: `${r.LedgerName} (${r.GroupName})`, balance: balance });
            assetGroupsMap[extraAssetGroup].total += balance;
            rawAssetsTotal += balance;
          } else {
            const amt = Math.abs(balance);
            liabilityGroupsMap[extraLiabilityGroup].ledgers.push({ ledgerName: `${r.LedgerName} (${r.GroupName})`, balance: amt });
            liabilityGroupsMap[extraLiabilityGroup].total += amt;
            rawLiabilitiesTotal += amt;
          }
        }
      }
    });
    
    // Clean empty groups
    const leftSide = Object.values(liabilityGroupsMap).filter(g => g.ledgers.length > 0);
    const rightSide = Object.values(assetGroupsMap).filter(g => g.ledgers.length > 0);
    
    let liabilitiesSum = rawLiabilitiesTotal;
    let assetsSum = rawAssetsTotal;
    
    let profitLossItem = null;
    if (netProfit > 0) {
      profitLossItem = { label: 'Profit & Loss A/c (Net Profit)', amount: netProfit };
      liabilitiesSum += netProfit;
    } else if (netProfit < 0) {
      profitLossItem = { label: 'Profit & Loss A/c (Net Loss)', amount: Math.abs(netProfit) };
      assetsSum += Math.abs(netProfit);
    }
    
    // Calculate difference in Trial Balance
    let differenceAmount = 0;
    let differenceSide = null;
    const diff = assetsSum - liabilitiesSum;
    if (Math.abs(diff) > 0.01) {
      differenceAmount = Math.abs(diff);
      if (diff > 0) {
        differenceSide = 'left'; // Add to Liabilities
        liabilitiesSum += differenceAmount;
      } else {
        differenceSide = 'right'; // Add to Assets
        assetsSum += differenceAmount;
      }
    }
    
    res.status(200).json({
      leftSide, // Liabilities
      rightSide, // Assets
      profitLossItem,
      netProfit,
      rawAssetsTotal,
      rawLiabilitiesTotal,
      differenceAmount,
      differenceSide,
      totalAssets: assetsSum,
      totalLiabilities: liabilitiesSum
    });
  } catch (error) {
    console.error('Error generating Balance Sheet report:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getInvoiceWisePayableReport = async (req, res) => {
  try {
    const pool = await connectDB();
    const result = await pool.request().query(`
      SELECT 
          h.ID AS InwardId,
          h.OUTWARDNO AS InwardNo,
          h.OUTWARDDATE AS InwardDate,
          h.TOTALAMOUNT AS InvoiceAmount,
          l.Id AS LedgerId,
          l.LedgerName AS VendorName,
          l.BankName,
          l.AccountNo,
          l.IFSC,
          l.UPI,
          ISNULL(l.PaymentTerm, 0) AS CreditDays,
          ISNULL(l.ClosingBalance, 0) AS VendorClosingBalance
      FROM OutwardHeader h
      INNER JOIN LedgerMaster l ON h.LEDGERID = l.Id
      INNER JOIN AccountGroup a ON l.AccountGroupID = a.Id
      WHERE a.GroupName IN ('Sundry Debtors', 'Party', 'Sundry Creditors', 'Vendor')
      ORDER BY l.LedgerName ASC, h.OUTWARDDATE ASC
    `);

    const vendors = {};
    result.recordset.forEach(row => {
      if (!vendors[row.LedgerId]) {
        vendors[row.LedgerId] = {
          vendorName: row.VendorName,
          closingBalance: parseFloat(row.VendorClosingBalance) || 0,
          bankName: row.BankName,
          accountNo: row.AccountNo,
          ifsc: row.IFSC,
          upi: row.UPI,
          invoices: []
        };
      }
      vendors[row.LedgerId].invoices.push({
        inwardId: row.InwardId,
        inwardNo: row.InwardNo,
        inwardDate: row.InwardDate,
        invoiceAmount: parseFloat(row.InvoiceAmount) || 0,
        creditDays: parseInt(row.CreditDays) || 0
      });
    });

    const finalReport = [];
    
    for (const ledgerId in vendors) {
      const v = vendors[ledgerId];
      // Payable logic: outstanding limit is positive balance
      let outstandingLimit = v.closingBalance > 0 ? v.closingBalance : 0;
      
      // Sort invoices: newest first to allocate outstanding amount from newest backward
      const sortedInvoices = [...v.invoices].sort((a, b) => new Date(b.inwardDate) - new Date(a.inwardDate));
      
      sortedInvoices.forEach(inv => {
        let outstandingAmount = 0;
        if (outstandingLimit > 0) {
          outstandingAmount = Math.min(inv.invoiceAmount, outstandingLimit);
          outstandingLimit -= outstandingAmount;
        }
        
        const invoiceDate = new Date(inv.inwardDate);
        const dueDate = new Date(invoiceDate);
        dueDate.setDate(dueDate.getDate() + inv.creditDays);
        
        // Calculate due days relative to today
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        dueDate.setHours(0, 0, 0, 0);
        
        const diffTime = dueDate.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        finalReport.push({
          RowId: `${inv.inwardId}_${ledgerId}`, // Unique ID for DataGrid
          inwardId: inv.inwardId,
          inwardNo: inv.inwardNo,
          inwardDate: inv.inwardDate,
          ledgerId: parseInt(ledgerId),
          vendorName: v.vendorName,
          BankName: v.bankName,
          AccountNo: v.accountNo,
          IFSC: v.ifsc,
          UPI: v.upi,
          invoiceAmount: inv.invoiceAmount,
          creditDays: inv.creditDays,
          dueDate: dueDate.toISOString().split('T')[0],
          dueDays: diffDays, // Positive: days remaining, Negative: overdue by X days, 0: due today
          outstandingAmount: Number(outstandingAmount.toFixed(2)),
          status: outstandingAmount === 0 ? 'Paid' : (outstandingAmount < inv.invoiceAmount ? 'Partially Paid' : 'Pending')
        });
      });
    }
    
    // Sort report by Vendor Name, then Invoice Date ascending
    finalReport.sort((a, b) => {
      if (a.vendorName.toLowerCase() < b.vendorName.toLowerCase()) return -1;
      if (a.vendorName.toLowerCase() > b.vendorName.toLowerCase()) return 1;
      return new Date(a.inwardDate) - new Date(b.inwardDate);
    });

    res.status(200).json(finalReport);
  } catch (error) {
    console.error('Error generating invoice-wise payable report:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getInvoiceWiseReceivableReport = async (req, res) => {
  try {
    const pool = await connectDB();
    const result = await pool.request().query(`
      SELECT 
          h.ID AS OutwardId,
          h.INWARDNO AS OutwardNo,
          h.INWARDDATE AS OutwardDate,
          h.TOTALAMOUNT AS InvoiceAmount,
          l.Id AS LedgerId,
          l.LedgerName AS PartyName,
          ISNULL(l.PaymentTerm, 0) AS CreditDays,
          ISNULL(l.ClosingBalance, 0) AS PartyClosingBalance
      FROM InwardHeader h
      INNER JOIN LedgerMaster l ON h.LEDGERID = l.Id
      INNER JOIN AccountGroup a ON l.AccountGroupID = a.Id
      WHERE a.GroupName IN ('Sundry Debtors', 'Party', 'Sundry Creditors', 'Vendor')
      ORDER BY l.LedgerName ASC, h.INWARDDATE ASC
    `);

    const parties = {};
    result.recordset.forEach(row => {
      if (!parties[row.LedgerId]) {
        parties[row.LedgerId] = {
          partyName: row.PartyName,
          closingBalance: parseFloat(row.PartyClosingBalance) || 0,
          invoices: []
        };
      }
      parties[row.LedgerId].invoices.push({
        outwardId: row.OutwardId,
        outwardNo: row.OutwardNo,
        outwardDate: row.OutwardDate,
        invoiceAmount: parseFloat(row.InvoiceAmount) || 0,
        creditDays: parseInt(row.CreditDays) || 0
      });
    });

    const finalReport = [];
    
    for (const ledgerId in parties) {
      const p = parties[ledgerId];
      // Receivable logic: outstanding limit is negative balance
      let outstandingLimit = p.closingBalance < 0 ? Math.abs(p.closingBalance) : 0;
      
      // Sort invoices: newest first to allocate outstanding amount from newest backward (FIFO for collection tracking)
      const sortedInvoices = [...p.invoices].sort((a, b) => new Date(b.outwardDate) - new Date(a.outwardDate));
      
      sortedInvoices.forEach(inv => {
        let outstandingAmount = 0;
        if (outstandingLimit > 0) {
          outstandingAmount = Math.min(inv.invoiceAmount, outstandingLimit);
          outstandingLimit -= outstandingAmount;
        }
        
        const invoiceDate = new Date(inv.outwardDate);
        const dueDate = new Date(invoiceDate);
        dueDate.setDate(dueDate.getDate() + inv.creditDays);
        
        // Calculate due days relative to today
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        dueDate.setHours(0, 0, 0, 0);
        
        const diffTime = dueDate.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        finalReport.push({
          RowId: `${inv.outwardId}_${ledgerId}`, // Unique ID for DataGrid
          outwardId: inv.outwardId,
          outwardNo: inv.outwardNo,
          outwardDate: inv.outwardDate,
          ledgerId: parseInt(ledgerId),
          partyName: p.partyName,
          invoiceAmount: inv.invoiceAmount,
          creditDays: inv.creditDays,
          dueDate: dueDate.toISOString().split('T')[0],
          dueDays: diffDays, // Positive: days remaining, Negative: overdue by X days, 0: due today
          outstandingAmount: Number(outstandingAmount.toFixed(2)),
          status: outstandingAmount === 0 ? 'Received' : (outstandingAmount < inv.invoiceAmount ? 'Partially Received' : 'Pending')
        });
      });
    }
    
    // Sort report by Party Name, then Invoice Date ascending
    finalReport.sort((a, b) => {
      if (a.partyName.toLowerCase() < b.partyName.toLowerCase()) return -1;
      if (a.partyName.toLowerCase() > b.partyName.toLowerCase()) return 1;
      return new Date(a.outwardDate) - new Date(b.outwardDate);
    });

    res.status(200).json(finalReport);
  } catch (error) {
    console.error('Error generating invoice-wise receivable report:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
