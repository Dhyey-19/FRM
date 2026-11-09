const { sql, connectDB } = require('../config/db');

exports.getLedgers = async (req, res) => {
  try {
    const pool = await connectDB();
    const result = await pool.request().query(`
      SELECT 
        l.Id, l.LedgerName, l.AccountGroupID, l.Address, l.City, l.State, l.GSTIN, l.MobileNo, l.Email,
        l.BankName, l.AccountNo, l.IFSC, l.UPI, l.OwnBrand, l.OtherBrand, l.Discount, l.CD, l.Bill,
        l.PaymentTerm, l.Transport, ISNULL(l.DeliveryDays, 0) AS DeliveryDays, l.Remark,
        ISNULL(l.OpeningBalance, 0) as OpeningBalance,
        ISNULL(l.OpeningBalance, 0) + ISNULL(v.NetVouchers, 0) AS ClosingBalance,
        a.GroupName as AccountGroupName
      FROM LedgerMaster l
      LEFT JOIN AccountGroup a ON l.AccountGroupID = a.Id
      LEFT JOIN (
        SELECT LedgerId, SUM(CASE WHEN Mode = 'Debit' THEN Amount ELSE -Amount END) AS NetVouchers
        FROM VoucherEntry
        GROUP BY LedgerId
      ) v ON l.Id = v.LedgerId
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
      WITH LedgerBillSums AS (
        SELECT 
          l.Id as RowId,
          l.LedgerName as VendorName,
          l.MobileNo,
          l.BankName,
          l.AccountNo,
          l.IFSC,
          l.UPI,
          ISNULL(l.OpeningBalance, 0) as OpeningBalance,
          ISNULL(l.ClosingBalance, 0) as StoredClosingBalance,
          ISNULL(l.OpeningBalance, 0) + ISNULL(SUM(CASE WHEN (v.Bill = 1 OR v.Bill IS NULL) THEN (CASE WHEN v.Mode = 'Debit' THEN v.Amount ELSE -v.Amount END) ELSE 0 END), 0) AS WithBillBalance,
          ISNULL(SUM(CASE WHEN v.Bill = 0 THEN (CASE WHEN v.Mode = 'Debit' THEN v.Amount ELSE -v.Amount END) ELSE 0 END), 0) AS WithoutBillBalance
        FROM LedgerMaster l
        INNER JOIN AccountGroup a ON l.AccountGroupID = a.Id
        LEFT JOIN VoucherEntry v ON l.Id = v.LedgerId
        WHERE a.GroupName IN ('Sundry Debtors', 'Sundry Creditors', 'Vendor', 'Party')
        GROUP BY l.Id, l.LedgerName, l.MobileNo, l.BankName, l.AccountNo, l.IFSC, l.UPI, l.OpeningBalance, l.ClosingBalance
      ),
      ComputedLedgers AS (
        SELECT 
          RowId,
          VendorName,
          MobileNo,
          BankName,
          AccountNo,
          IFSC,
          UPI,
          OpeningBalance,
          StoredClosingBalance,
          WithBillBalance,
          WithoutBillBalance,
          (WithBillBalance + WithoutBillBalance) AS NetBalance
        FROM LedgerBillSums
      )
      SELECT 
        RowId,
        VendorName,
        MobileNo,
        BankName,
        AccountNo,
        IFSC,
        UPI,
        OpeningBalance,
        StoredClosingBalance AS ClosingBalance,
        WithBillBalance,
        WithoutBillBalance,
        NetBalance,
        -NetBalance AS PayableCombined,
        -WithBillBalance AS PayableWithBill,
        -WithoutBillBalance AS PayableWithoutBill
      FROM ComputedLedgers
      WHERE NetBalance < 0
      ORDER BY VendorName ASC;
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
      WITH LedgerBillSums AS (
        SELECT 
          l.Id as RowId,
          l.LedgerName as PartyName,
          l.MobileNo,
          l.BankName,
          l.AccountNo,
          l.IFSC,
          l.UPI,
          ISNULL(l.OpeningBalance, 0) as OpeningBalance,
          ISNULL(l.ClosingBalance, 0) as StoredClosingBalance,
          ISNULL(l.OpeningBalance, 0) + ISNULL(SUM(CASE WHEN (v.Bill = 1 OR v.Bill IS NULL) THEN (CASE WHEN v.Mode = 'Debit' THEN v.Amount ELSE -v.Amount END) ELSE 0 END), 0) AS WithBillBalance,
          ISNULL(SUM(CASE WHEN v.Bill = 0 THEN (CASE WHEN v.Mode = 'Debit' THEN v.Amount ELSE -v.Amount END) ELSE 0 END), 0) AS WithoutBillBalance
        FROM LedgerMaster l
        INNER JOIN AccountGroup a ON l.AccountGroupID = a.Id
        LEFT JOIN VoucherEntry v ON l.Id = v.LedgerId
        WHERE a.GroupName IN ('Sundry Debtors', 'Sundry Creditors', 'Vendor', 'Party')
        GROUP BY l.Id, l.LedgerName, l.MobileNo, l.BankName, l.AccountNo, l.IFSC, l.UPI, l.OpeningBalance, l.ClosingBalance
      ),
      ComputedLedgers AS (
        SELECT 
          RowId,
          PartyName,
          MobileNo,
          BankName,
          AccountNo,
          IFSC,
          UPI,
          OpeningBalance,
          StoredClosingBalance,
          WithBillBalance,
          WithoutBillBalance,
          (WithBillBalance + WithoutBillBalance) AS NetBalance
        FROM LedgerBillSums
      )
      SELECT 
        RowId,
        PartyName,
        MobileNo,
        BankName,
        AccountNo,
        IFSC,
        UPI,
        OpeningBalance,
        StoredClosingBalance AS ClosingBalance,
        WithBillBalance,
        WithoutBillBalance,
        NetBalance,
        NetBalance AS ReceivableCombined,
        WithBillBalance AS ReceivableWithBill,
        WithoutBillBalance AS ReceivableWithoutBill
      FROM ComputedLedgers
      WHERE NetBalance > 0
      ORDER BY PartyName ASC;
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
    Discount, CD, Bill, PaymentTerm, Transport, DeliveryDays, Remark 
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
      .input('DeliveryDays', sql.Int, DeliveryDays !== undefined && DeliveryDays !== null && DeliveryDays !== '' ? parseInt(DeliveryDays, 10) : 0)
      .input('Remark', sql.VarChar(100), Remark || null)
      .query(`
        INSERT INTO LedgerMaster (
          LedgerName, AccountGroupID, Address, City, State, GSTIN, MobileNo, Email,
          OpeningBalance, ClosingBalance, BankName, AccountNo, IFSC, UPI, OwnBrand, OtherBrand,
          Discount, CD, Bill, PaymentTerm, Transport, DeliveryDays, Remark
        ) VALUES (
          @LedgerName, @AccountGroupID, @Address, @City, @State, @GSTIN, @MobileNo, @Email,
          @OpeningBalance, @ClosingBalance, @BankName, @AccountNo, @IFSC, @UPI, @OwnBrand, @OtherBrand,
          @Discount, @CD, @Bill, @PaymentTerm, @Transport, @DeliveryDays, @Remark
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
    Discount, CD, Bill, PaymentTerm, Transport, DeliveryDays, Remark 
  } = req.body;

  if (!LedgerName || !AccountGroupID) {
    return res.status(400).json({ message: 'Ledger Name and Account Group are required' });
  }

  try {
    const pool = await connectDB();
    
    const checkSys = await pool.request()
      .input('Id', sql.Numeric(10,0), id)
      .query('SELECT Id FROM LedgerMaster WHERE Id = @Id');
      
    if (checkSys.recordset.length > 0 === false) {
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
      .input('DeliveryDays', sql.Int, DeliveryDays !== undefined && DeliveryDays !== null && DeliveryDays !== '' ? parseInt(DeliveryDays, 10) : 0)
      .input('Remark', sql.VarChar(100), Remark || null)
      .query(`
        UPDATE LedgerMaster SET 
          LedgerName = @LedgerName, AccountGroupID = @AccountGroupID, Address = @Address, 
          City = @City, State = @State, GSTIN = @GSTIN, MobileNo = @MobileNo, Email = @Email,
          OpeningBalance = @OpeningBalance, 
          ClosingBalance = @OpeningBalance + ISNULL((SELECT SUM(CASE WHEN Mode = 'Debit' THEN Amount ELSE -Amount END) FROM VoucherEntry WHERE LedgerId = @Id), 0),
          BankName = @BankName, 
          AccountNo = @AccountNo, IFSC = @IFSC, UPI = @UPI, OwnBrand = @OwnBrand, OtherBrand = @OtherBrand,
          Discount = @Discount, CD = @CD, Bill = @Bill, PaymentTerm = @PaymentTerm, 
          Transport = @Transport, DeliveryDays = @DeliveryDays, Remark = @Remark
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
  'Sundry Debtors', 'Party', 'Stock-in-Hand'
];
const bsLiabilityGroups = [
  'Capital Account', 'Current Liabilities', 'Duties & Taxes', 'Loans (Liability)',
  'Provisions', 'Reserves & Surplus', 'Secured Loans', 'Sundry Creditors',
  'Unsecured Loans', 'Vendor'
];

// Helper to fetch live Inventory & WIP Valuation (shared between Profit & Loss and Balance Sheet)
const getInventoryAndWIPValuation = async (pool) => {
  // Stock valuation from ItemMaster
  const stockResult = await pool.request().query(`
    SELECT 
      ISNULL(SUM(ISNULL(OpeningStock, 0) * ISNULL(Costing, 0)), 0) AS totalOpeningStockValue,
      ISNULL(SUM(ISNULL(ClosingStock, 0) * ISNULL(Costing, 0)), 0) AS totalClosingStockValue
    FROM ItemMaster
  `);
  
  const openingStockValue = Math.round((stockResult.recordset[0]?.totalOpeningStockValue || 0) * 100) / 100;
  const mainClosingStockValue = Math.round((stockResult.recordset[0]?.totalClosingStockValue || 0) * 100) / 100;

  // In-process stock valuation from DepartmentStock using Stock Transfer rates & valuation
  const deptStockResult = await pool.request().query(`
    WITH TransferRates AS (
      SELECT 
        ds.DeptID,
        ds.ItemCode,
        COALESCE(
          (SELECT TOP 1 st.Rate FROM StockTransfer st WHERE st.ToDeptID = ds.DeptID AND st.InItemCode = ds.ItemCode AND st.Rate > 0 ORDER BY st.MoveDate DESC, st.MoveID DESC),
          (SELECT TOP 1 st.Rate FROM StockTransfer st WHERE st.FromDeptID = ds.DeptID AND st.OutItemCode = ds.ItemCode AND st.Rate > 0 ORDER BY st.MoveDate DESC, st.MoveID DESC),
          (SELECT TOP 1 st.Rate FROM StockTransfer st WHERE (st.InItemCode = ds.ItemCode OR st.OutItemCode = ds.ItemCode) AND st.Rate > 0 ORDER BY st.MoveDate DESC, st.MoveID DESC),
          im.Costing,
          0
        ) AS TransferRate,
        COALESCE(
          (SELECT TOP 1 st.Unit FROM StockTransfer st WHERE st.ToDeptID = ds.DeptID AND st.InItemCode = ds.ItemCode AND st.Rate > 0 ORDER BY st.MoveDate DESC, st.MoveID DESC),
          (SELECT TOP 1 st.Unit FROM StockTransfer st WHERE st.FromDeptID = ds.DeptID AND st.OutItemCode = ds.ItemCode AND st.Rate > 0 ORDER BY st.MoveDate DESC, st.MoveID DESC),
          (SELECT TOP 1 st.Unit FROM StockTransfer st WHERE (st.InItemCode = ds.ItemCode OR st.OutItemCode = ds.ItemCode) AND st.Rate > 0 ORDER BY st.MoveDate DESC, st.MoveID DESC),
          im.Unit
        ) AS ValuationUnit
      FROM DepartmentStock ds
      JOIN ItemMaster im ON ds.ItemCode = im.ItemCode
    )
    SELECT 
      dm.DeptID,
      dm.DeptName,
      ds.ItemCode,
      im.ItemName,
      im.Costing AS MasterCosting,
      tr.TransferRate AS Costing,
      tr.TransferRate AS Rate,
      tr.ValuationUnit AS Unit,
      ISNULL(ds.Pcs, 0) AS Pcs,
      ISNULL(ds.Weight, 0) AS Weight,
      (CASE 
        WHEN UPPER(tr.ValuationUnit) IN ('KG', 'KGS') AND ISNULL(ds.Weight, 0) != 0 THEN ISNULL(ds.Weight, 0)
        WHEN UPPER(tr.ValuationUnit) NOT IN ('KG', 'KGS') AND ISNULL(ds.Pcs, 0) != 0 THEN ISNULL(ds.Pcs, 0)
        WHEN ISNULL(ds.Weight, 0) != 0 THEN ISNULL(ds.Weight, 0)
        ELSE ISNULL(ds.Pcs, 0)
      END) AS EffectiveQty,
      ROUND(
        (CASE 
          WHEN UPPER(tr.ValuationUnit) IN ('KG', 'KGS') AND ISNULL(ds.Weight, 0) != 0 THEN ISNULL(ds.Weight, 0)
          WHEN UPPER(tr.ValuationUnit) NOT IN ('KG', 'KGS') AND ISNULL(ds.Pcs, 0) != 0 THEN ISNULL(ds.Pcs, 0)
          WHEN ISNULL(ds.Weight, 0) != 0 THEN ISNULL(ds.Weight, 0)
          ELSE ISNULL(ds.Pcs, 0)
        END) * tr.TransferRate,
        2
      ) AS Valuation
    FROM DepartmentStock ds
    JOIN DepartmentMaster dm ON ds.DeptID = dm.DeptID
    JOIN ItemMaster im ON ds.ItemCode = im.ItemCode
    JOIN TransferRates tr ON ds.DeptID = tr.DeptID AND ds.ItemCode = tr.ItemCode
    WHERE (ISNULL(ds.Pcs, 0) > 0 OR ISNULL(ds.Weight, 0) > 0)
      AND LOWER(dm.DeptName) != 'stock'
    ORDER BY dm.DeptName ASC, im.ItemName ASC
  `);

  const deptMap = {};
  let processStockValue = 0;

  deptStockResult.recordset.forEach(row => {
    if (!deptMap[row.DeptID]) {
      deptMap[row.DeptID] = {
        deptId: row.DeptID,
        deptName: row.DeptName,
        totalPcs: 0,
        totalWeight: 0,
        totalValuation: 0,
        items: []
      };
    }
    deptMap[row.DeptID].totalPcs += (row.Pcs || 0);
    deptMap[row.DeptID].totalWeight = Math.round((deptMap[row.DeptID].totalWeight + (row.Weight || 0)) * 1000) / 1000;
    deptMap[row.DeptID].totalValuation = Math.round((deptMap[row.DeptID].totalValuation + (row.Valuation || 0)) * 100) / 100;
    deptMap[row.DeptID].items.push({
      itemCode: row.ItemCode,
      itemName: row.ItemName,
      unit: row.Unit,
      costing: row.Costing,
      rate: row.Rate,
      masterCosting: row.MasterCosting,
      pcs: row.Pcs,
      weight: row.Weight,
      effectiveQty: row.EffectiveQty,
      valuation: row.Valuation
    });

    processStockValue = Math.round((processStockValue + (row.Valuation || 0)) * 100) / 100;
  });

  const departmentStockBreakdown = Object.values(deptMap);
  const combinedClosingStockValue = Math.round((mainClosingStockValue + processStockValue) * 100) / 100;

  // Stock Transfer Process Loss
  const lossResult = await pool.request().query(`
    SELECT ISNULL(SUM(TransferLoss), 0) AS totalStockTransferLoss
    FROM (
      SELECT TransferID, MAX(ISNULL(LossAmount, 0)) AS TransferLoss
      FROM StockTransfer
      GROUP BY TransferID
    ) t
  `);
  const stockTransferLoss = Math.round((lossResult.recordset[0]?.totalStockTransferLoss || 0) * 100) / 100;

  return {
    openingStockValue,
    mainClosingStockValue,
    processStockValue,
    combinedClosingStockValue,
    departmentStockBreakdown,
    stockTransferLoss
  };
};

exports.getProfitLossReport = async (req, res) => {
  try {
    const pool = await connectDB();
    const result = await pool.request().query(`
      SELECT 
        l.LedgerName, 
        ISNULL(l.OpeningBalance, 0) + ISNULL(v.NetVouchers, 0) as ClosingBalance, 
        a.GroupName
      FROM LedgerMaster l
      LEFT JOIN AccountGroup a ON l.AccountGroupID = a.Id
      LEFT JOIN (
        SELECT LedgerId, SUM(CASE WHEN Mode = 'Debit' THEN Amount ELSE -Amount END) AS NetVouchers
        FROM VoucherEntry
        GROUP BY LedgerId
      ) v ON l.Id = v.LedgerId
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

    // Fetch shared live inventory & WIP valuation
    const inventory = await getInventoryAndWIPValuation(pool);

    if (inventory.stockTransferLoss > 0) {
      if (expenseGroupsMap['Direct Expenses']) {
        expenseGroupsMap['Direct Expenses'].ledgers.push({
          ledgerName: 'Stock Transfer Process Loss',
          balance: inventory.stockTransferLoss
        });
        expenseGroupsMap['Direct Expenses'].total = Math.round((expenseGroupsMap['Direct Expenses'].total + inventory.stockTransferLoss) * 100) / 100;
        totalExpenses = Math.round((totalExpenses + inventory.stockTransferLoss) * 100) / 100;
      } else {
        expenseGroupsMap['Direct Expenses'] = {
          groupName: 'Direct Expenses',
          ledgers: [{ ledgerName: 'Stock Transfer Process Loss', balance: inventory.stockTransferLoss }],
          total: inventory.stockTransferLoss
        };
        totalExpenses = Math.round((totalExpenses + inventory.stockTransferLoss) * 100) / 100;
      }
    }

    const leftSide = [];
    if (inventory.openingStockValue > 0) {
      leftSide.push({
        groupName: 'Opening Stock',
        isStock: true,
        ledgers: [{ ledgerName: 'Opening Stock', balance: inventory.openingStockValue }],
        total: inventory.openingStockValue
      });
    }
    leftSide.push(...Object.values(expenseGroupsMap).filter(g => g.ledgers.length > 0));

    const rightSide = Object.values(incomeGroupsMap).filter(g => g.ledgers.length > 0);
    
    // Build Closing Stock group including Main Store stock + Stock in Process per Department
    const closingStockLedgers = [];
    if (inventory.mainClosingStockValue > 0) {
      closingStockLedgers.push({
        ledgerName: 'Closing Stock (Main Store)',
        balance: inventory.mainClosingStockValue,
        type: 'main_stock'
      });
    }
    inventory.departmentStockBreakdown.forEach(dept => {
      if (dept.totalValuation > 0) {
        closingStockLedgers.push({
          ledgerName: `Stock in Process - ${dept.deptName}`,
          balance: dept.totalValuation,
          type: 'department_wip',
          deptId: dept.deptId,
          deptName: dept.deptName,
          totalPcs: dept.totalPcs,
          totalWeight: dept.totalWeight,
          itemsCount: dept.items.length,
          items: dept.items
        });
      }
    });

    if (closingStockLedgers.length > 0) {
      rightSide.push({
        groupName: 'Closing Stock',
        isStock: true,
        ledgers: closingStockLedgers,
        total: inventory.combinedClosingStockValue
      });
    }
    
    const ledgerExpenses = totalExpenses;
    const ledgerIncomes = totalIncomes;

    const finalTotalExpenses = Math.round((ledgerExpenses + inventory.openingStockValue) * 100) / 100;
    const finalTotalIncomes = Math.round((ledgerIncomes + inventory.combinedClosingStockValue) * 100) / 100;
    const netProfit = Math.round((finalTotalIncomes - finalTotalExpenses) * 100) / 100;
    
    res.status(200).json({
      leftSide,
      rightSide,
      openingStockValue: inventory.openingStockValue,
      mainClosingStockValue: inventory.mainClosingStockValue,
      processStockValue: inventory.processStockValue,
      closingStockValue: inventory.combinedClosingStockValue,
      departmentStockBreakdown: inventory.departmentStockBreakdown,
      stockTransferLoss: inventory.stockTransferLoss,
      ledgerExpenses,
      ledgerIncomes,
      totalExpenses: finalTotalExpenses,
      totalIncomes: finalTotalIncomes,
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
      SELECT 
        l.LedgerName, 
        ISNULL(l.OpeningBalance, 0) + ISNULL(v.NetVouchers, 0) as ClosingBalance, 
        a.GroupName
      FROM LedgerMaster l
      LEFT JOIN AccountGroup a ON l.AccountGroupID = a.Id
      LEFT JOIN (
        SELECT LedgerId, SUM(CASE WHEN Mode = 'Debit' THEN Amount ELSE -Amount END) AS NetVouchers
        FROM VoucherEntry
        GROUP BY LedgerId
      ) v ON l.Id = v.LedgerId
    `);
    
    const records = result.recordset;
    
    // Total Asset Value from Assets table (as available on dashboard)
    const assetResult = await pool.request().query(`
      SELECT SUM(TotalValue) AS totalAssetValue FROM Assets
    `);
    const totalAssetValue = Math.round((assetResult.recordset[0]?.totalAssetValue || 0) * 100) / 100;

    const assetsListResult = await pool.request().query(`
      SELECT AssetId, AssetName, Quantity, UnitValue, TotalValue FROM Assets ORDER BY AssetName
    `);
    const fixedAssetsList = assetsListResult.recordset;

    // Fetch exact same live inventory & WIP valuation as Profit & Loss
    const inventory = await getInventoryAndWIPValuation(pool);

    // Calculate Net Profit identically from PL accounts + stock
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

    if (inventory.stockTransferLoss > 0) {
      totalExpenses = Math.round((totalExpenses + inventory.stockTransferLoss) * 100) / 100;
    }

    const finalTotalExpenses = Math.round((totalExpenses + inventory.openingStockValue) * 100) / 100;
    const finalTotalIncomes = Math.round((totalIncomes + inventory.combinedClosingStockValue) * 100) / 100;
    const netProfit = Math.round((finalTotalIncomes - finalTotalExpenses) * 100) / 100;
    
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

    // Add Total Asset Value under Fixed Assets (as available on dashboard)
    if (totalAssetValue > 0) {
      assetGroupsMap['Fixed Assets'] = {
        groupName: 'Fixed Assets',
        isAssetMaster: true,
        ledgers: [{
          ledgerName: 'Total Asset Value',
          balance: totalAssetValue
        }],
        total: totalAssetValue
      };
      rawAssetsTotal += totalAssetValue;
    }

    // Add Closing Stock under Current Assets / Stock-in-Hand (Exact match to Profit & Loss!)
    const closingStockLedgers = [];
    if (inventory.mainClosingStockValue > 0) {
      closingStockLedgers.push({
        ledgerName: 'Closing Stock (Main Store)',
        balance: inventory.mainClosingStockValue,
        type: 'main_stock'
      });
    }
    inventory.departmentStockBreakdown.forEach(dept => {
      if (dept.totalValuation > 0) {
        closingStockLedgers.push({
          ledgerName: `Stock in Process - ${dept.deptName}`,
          balance: dept.totalValuation,
          type: 'department_wip',
          deptId: dept.deptId,
          deptName: dept.deptName,
          totalPcs: dept.totalPcs,
          totalWeight: dept.totalWeight,
          itemsCount: dept.items.length,
          items: dept.items
        });
      }
    });

    if (closingStockLedgers.length > 0) {
      assetGroupsMap['Stock-in-Hand'] = {
        groupName: 'Stock-in-Hand (Closing Stock)',
        isStock: true,
        ledgers: closingStockLedgers,
        total: inventory.combinedClosingStockValue
      };
      rawAssetsTotal += inventory.combinedClosingStockValue;
    }
    
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
    
    // Clean empty groups - put Fixed Assets first, then Stock-in-Hand, then other Assets
    const leftSide = Object.values(liabilityGroupsMap).filter(g => g.ledgers.length > 0);
    const rightSide = [];
    if (assetGroupsMap['Fixed Assets'] && assetGroupsMap['Fixed Assets'].ledgers.length > 0) {
      rightSide.push(assetGroupsMap['Fixed Assets']);
    }
    if (assetGroupsMap['Stock-in-Hand'] && assetGroupsMap['Stock-in-Hand'].ledgers.length > 0) {
      rightSide.push(assetGroupsMap['Stock-in-Hand']);
    }
    Object.values(assetGroupsMap).forEach(g => {
      if (g.groupName !== 'Fixed Assets' && g.groupName !== 'Stock-in-Hand (Closing Stock)' && g.ledgers.length > 0) {
        rightSide.push(g);
      }
    });
    
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
      differenceAmount = Math.round(Math.abs(diff) * 100) / 100;
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
      totalAssetValue,
      rawAssetsTotal,
      rawLiabilitiesTotal,
      differenceAmount,
      differenceSide,
      totalAssets: Math.round(assetsSum * 100) / 100,
      totalLiabilities: Math.round(liabilitiesSum * 100) / 100,
      openingStockValue: inventory.openingStockValue,
      mainClosingStockValue: inventory.mainClosingStockValue,
      processStockValue: inventory.processStockValue,
      closingStockValue: inventory.combinedClosingStockValue,
      departmentStockBreakdown: inventory.departmentStockBreakdown
    });
  } catch (error) {
    console.error('Error generating Balance Sheet report:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const calculateDueInfo = (dateInput, creditDays = 0) => {
  let y, m, d;
  if (typeof dateInput === 'string' && dateInput.includes('-')) {
    const parts = dateInput.split('T')[0].split('-');
    y = parseInt(parts[0], 10);
    m = parseInt(parts[1], 10) - 1;
    d = parseInt(parts[2], 10);
  } else {
    const dt = new Date(dateInput);
    y = dt.getUTCFullYear();
    m = dt.getUTCMonth();
    d = dt.getUTCDate();
  }
  const dueUTC = Date.UTC(y, m, d + (Number(creditDays) || 0));
  const dueDate = new Date(dueUTC);
  const dueDateStr = dueDate.toISOString().split('T')[0];

  const now = new Date();
  const todayUTC = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const diffDays = Math.round((dueUTC - todayUTC) / (1000 * 60 * 60 * 24));
  return { dueDate: dueDateStr, dueDays: diffDays };
};

exports.getInvoiceWisePayableReport = async (req, res) => {
  try {
    const pool = await connectDB();
    const result = await pool.request().query(`
      WITH LedgerBalances AS (
        SELECT 
          l.Id,
          l.LedgerName,
          l.BankName,
          l.AccountNo,
          l.IFSC,
          l.UPI,
          ISNULL(l.PaymentTerm, 0) AS CreditDays,
          ISNULL(l.ClosingBalance, 0) AS ClosingBalance,
          ISNULL(l.OpeningBalance, 0) + ISNULL(SUM(CASE WHEN (v.Bill = 1 OR v.Bill IS NULL) THEN (CASE WHEN v.Mode = 'Debit' THEN v.Amount ELSE -v.Amount END) ELSE 0 END), 0) AS WithBillBalance,
          ISNULL(SUM(CASE WHEN v.Bill = 0 THEN (CASE WHEN v.Mode = 'Debit' THEN v.Amount ELSE -v.Amount END) ELSE 0 END), 0) AS WithoutBillBalance
        FROM LedgerMaster l
        INNER JOIN AccountGroup a ON l.AccountGroupID = a.Id
        LEFT JOIN VoucherEntry v ON l.Id = v.LedgerId
        WHERE a.GroupName IN ('Sundry Debtors', 'Party', 'Sundry Creditors', 'Vendor')
        GROUP BY l.Id, l.LedgerName, l.BankName, l.AccountNo, l.IFSC, l.UPI, l.PaymentTerm, l.OpeningBalance, l.ClosingBalance
      )
      SELECT 
          h.ID AS InwardId,
          h.INWARDNO AS InwardNo,
          h.INWARDDATE AS InwardDate,
          h.TOTALAMOUNT AS InvoiceAmount,
          ISNULL(h.Bill, 1) AS Bill,
          lb.Id AS LedgerId,
          lb.LedgerName AS VendorName,
          lb.BankName,
          lb.AccountNo,
          lb.IFSC,
          lb.UPI,
          lb.CreditDays,
          lb.ClosingBalance AS VendorClosingBalance,
          lb.WithBillBalance,
          lb.WithoutBillBalance
      FROM InwardHeader h
      INNER JOIN LedgerBalances lb ON h.LEDGERID = lb.Id
      ORDER BY lb.LedgerName ASC, h.INWARDDATE ASC
    `);

    const vendors = {};
    result.recordset.forEach(row => {
      if (!vendors[row.LedgerId]) {
        vendors[row.LedgerId] = {
          vendorName: row.VendorName,
          closingBalance: parseFloat(row.VendorClosingBalance) || 0,
          withBillBalance: parseFloat(row.WithBillBalance) || 0,
          withoutBillBalance: parseFloat(row.WithoutBillBalance) || 0,
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
        creditDays: parseInt(row.CreditDays) || 0,
        bill: row.Bill === 1 || row.Bill === true || row.Bill === '1'
      });
    });

    const finalReport = [];
    
    for (const ledgerId in vendors) {
      const v = vendors[ledgerId];
      // Payable logic: outstanding limit is negative balance in ledger
      let outstandingLimitCombined = v.closingBalance < 0 ? Math.abs(v.closingBalance) : 0;
      let outstandingLimitWithBill = v.withBillBalance < 0 ? Math.abs(v.withBillBalance) : 0;
      let outstandingLimitWithoutBill = v.withoutBillBalance < 0 ? Math.abs(v.withoutBillBalance) : 0;
      
      // Sort invoices: newest first to allocate outstanding amount
      const sortedInvoices = [...v.invoices].sort((a, b) => new Date(b.inwardDate) - new Date(a.inwardDate));
      
      sortedInvoices.forEach(inv => {
        let outstandingCombined = 0;
        if (outstandingLimitCombined > 0) {
          outstandingCombined = Math.min(inv.invoiceAmount, outstandingLimitCombined);
          outstandingLimitCombined -= outstandingCombined;
        }

        let outstandingWithBill = 0;
        if (inv.bill && outstandingLimitWithBill > 0) {
          outstandingWithBill = Math.min(inv.invoiceAmount, outstandingLimitWithBill);
          outstandingLimitWithBill -= outstandingWithBill;
        }

        let outstandingWithoutBill = 0;
        if (!inv.bill && outstandingLimitWithoutBill > 0) {
          outstandingWithoutBill = Math.min(inv.invoiceAmount, outstandingLimitWithoutBill);
          outstandingLimitWithoutBill -= outstandingWithoutBill;
        }
        
        const { dueDate, dueDays } = calculateDueInfo(inv.inwardDate, inv.creditDays);
        const relevantOutstanding = inv.bill ? outstandingWithBill : outstandingWithoutBill;

        finalReport.push({
          RowId: `${inv.inwardId}_${ledgerId}`,
          inwardId: inv.inwardId,
          inwardNo: inv.inwardNo,
          inwardDate: inv.inwardDate,
          bill: inv.bill,
          ledgerId: parseInt(ledgerId),
          vendorName: v.vendorName,
          BankName: v.bankName,
          AccountNo: v.accountNo,
          IFSC: v.ifsc,
          UPI: v.upi,
          invoiceAmount: inv.invoiceAmount,
          creditDays: inv.creditDays,
          dueDate,
          dueDays,
          outstandingAmount: Number(outstandingCombined.toFixed(2)),
          outstandingWithBill: Number(outstandingWithBill.toFixed(2)),
          outstandingWithoutBill: Number(outstandingWithoutBill.toFixed(2)),
          status: outstandingCombined === 0 ? 'Paid' : (outstandingCombined < inv.invoiceAmount ? 'Partially Paid' : 'Pending')
        });
      });
    }
    
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
      WITH LedgerBalances AS (
        SELECT 
          l.Id,
          l.LedgerName,
          ISNULL(l.PaymentTerm, 0) AS CreditDays,
          ISNULL(l.ClosingBalance, 0) AS ClosingBalance,
          ISNULL(l.OpeningBalance, 0) + ISNULL(SUM(CASE WHEN (v.Bill = 1 OR v.Bill IS NULL) THEN (CASE WHEN v.Mode = 'Debit' THEN v.Amount ELSE -v.Amount END) ELSE 0 END), 0) AS WithBillBalance,
          ISNULL(SUM(CASE WHEN v.Bill = 0 THEN (CASE WHEN v.Mode = 'Debit' THEN v.Amount ELSE -v.Amount END) ELSE 0 END), 0) AS WithoutBillBalance
        FROM LedgerMaster l
        INNER JOIN AccountGroup a ON l.AccountGroupID = a.Id
        LEFT JOIN VoucherEntry v ON l.Id = v.LedgerId
        WHERE a.GroupName IN ('Sundry Debtors', 'Party', 'Sundry Creditors', 'Vendor')
        GROUP BY l.Id, l.LedgerName, l.PaymentTerm, l.OpeningBalance, l.ClosingBalance
      )
      SELECT 
          h.ID AS OutwardId,
          h.OUTWARDNO AS OutwardNo,
          h.OUTWARDDATE AS OutwardDate,
          h.TOTALAMOUNT AS InvoiceAmount,
          ISNULL(h.Bill, 1) AS Bill,
          lb.Id AS LedgerId,
          lb.LedgerName AS PartyName,
          lb.CreditDays,
          lb.ClosingBalance AS PartyClosingBalance,
          lb.WithBillBalance,
          lb.WithoutBillBalance
      FROM OutwardHeader h
      INNER JOIN LedgerBalances lb ON h.LEDGERID = lb.Id
      ORDER BY lb.LedgerName ASC, h.OUTWARDDATE ASC
    `);

    const parties = {};
    result.recordset.forEach(row => {
      if (!parties[row.LedgerId]) {
        parties[row.LedgerId] = {
          partyName: row.PartyName,
          closingBalance: parseFloat(row.PartyClosingBalance) || 0,
          withBillBalance: parseFloat(row.WithBillBalance) || 0,
          withoutBillBalance: parseFloat(row.WithoutBillBalance) || 0,
          invoices: []
        };
      }
      parties[row.LedgerId].invoices.push({
        outwardId: row.OutwardId,
        outwardNo: row.OutwardNo,
        outwardDate: row.OutwardDate,
        invoiceAmount: parseFloat(row.InvoiceAmount) || 0,
        creditDays: parseInt(row.CreditDays) || 0,
        bill: row.Bill === 1 || row.Bill === true || row.Bill === '1'
      });
    });

    const finalReport = [];
    
    for (const ledgerId in parties) {
      const p = parties[ledgerId];
      // Receivable logic: outstanding limit is positive balance
      let outstandingLimitCombined = p.closingBalance > 0 ? p.closingBalance : 0;
      let outstandingLimitWithBill = p.withBillBalance > 0 ? p.withBillBalance : 0;
      let outstandingLimitWithoutBill = p.withoutBillBalance > 0 ? p.withoutBillBalance : 0;
      
      // Sort invoices: newest first to allocate outstanding amount
      const sortedInvoices = [...p.invoices].sort((a, b) => new Date(b.outwardDate) - new Date(a.outwardDate));
      
      sortedInvoices.forEach(inv => {
        let outstandingCombined = 0;
        if (outstandingLimitCombined > 0) {
          outstandingCombined = Math.min(inv.invoiceAmount, outstandingLimitCombined);
          outstandingLimitCombined -= outstandingCombined;
        }

        let outstandingWithBill = 0;
        if (inv.bill && outstandingLimitWithBill > 0) {
          outstandingWithBill = Math.min(inv.invoiceAmount, outstandingLimitWithBill);
          outstandingLimitWithBill -= outstandingWithBill;
        }

        let outstandingWithoutBill = 0;
        if (!inv.bill && outstandingLimitWithoutBill > 0) {
          outstandingWithoutBill = Math.min(inv.invoiceAmount, outstandingLimitWithoutBill);
          outstandingLimitWithoutBill -= outstandingWithoutBill;
        }
        
        const { dueDate, dueDays } = calculateDueInfo(inv.outwardDate, inv.creditDays);
        
        finalReport.push({
          RowId: `${inv.outwardId}_${ledgerId}`,
          outwardId: inv.outwardId,
          outwardNo: inv.outwardNo,
          outwardDate: inv.outwardDate,
          bill: inv.bill,
          ledgerId: parseInt(ledgerId),
          partyName: p.partyName,
          invoiceAmount: inv.invoiceAmount,
          creditDays: inv.creditDays,
          dueDate,
          dueDays,
          outstandingAmount: Number(outstandingCombined.toFixed(2)),
          outstandingWithBill: Number(outstandingWithBill.toFixed(2)),
          outstandingWithoutBill: Number(outstandingWithoutBill.toFixed(2)),
          status: outstandingCombined === 0 ? 'Received' : (outstandingCombined < inv.invoiceAmount ? 'Partially Received' : 'Pending')
        });
      });
    }
    
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
