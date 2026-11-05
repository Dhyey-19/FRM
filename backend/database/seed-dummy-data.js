const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');

async function seedDummyData(dbFilePath) {
  const schemaPath = path.join(__dirname, 'schema.sql');
  if (!fs.existsSync(schemaPath)) {
    throw new Error(`Schema file not found at ${schemaPath}`);
  }

  // Remove existing DB file to start fresh with clean schemas
  if (fs.existsSync(dbFilePath)) {
    fs.unlinkSync(dbFilePath);
  }

  const wasmBinary = fs.readFileSync(require.resolve('sql.js/dist/sql-wasm.wasm'));
  const SQL = await initSqlJs({ wasmBinary });
  const rawDb = new SQL.Database();

  const db = {
    exec: (sql) => rawDb.exec(sql),
    prepare: (sql) => ({
      run: (...args) => {
        rawDb.run(sql, args);
      },
      all: () => {
        const res = rawDb.exec(sql);
        if (!res.length) return [];
        const { columns, values } = res[0];
        return values.map(row => Object.fromEntries(columns.map((c, i) => [c, row[i]])));
      },
      get: () => {
        const res = rawDb.exec(sql);
        if (!res.length || !res[0].values.length) return null;
        const { columns, values } = res[0];
        return Object.fromEntries(columns.map((c, i) => [c, values[0][i]]));
      }
    }),
    export: () => rawDb.export(),
    close: () => rawDb.close()
  };

  db.exec('PRAGMA foreign_keys = OFF;');

  // 1. Create tables
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');
  db.exec(schemaSql);

  // 2. Insert Dummy Data within transaction
  db.exec('BEGIN TRANSACTION;');

  // --- 1. AccountGroup ---
  const insertAccountGroup = db.prepare(`
    INSERT INTO "AccountGroup" ("Id", "GroupName", "IsSystem") VALUES (?, ?, ?)
  `);
  [
    [1, 'Capital Account', 1],
    [2, 'Current Assets', 1],
    [3, 'Current Liabilities', 1],
    [4, 'Sundry Debtors', 0],
    [5, 'Sundry Creditors', 0],
    [6, 'Bank Accounts', 0],
    [7, 'Direct Expenses', 0],
    [8, 'Sales Accounts', 0],
    [9, 'Purchase Accounts', 0]
  ].forEach(row => insertAccountGroup.run(...row));

  // --- 2. DepartmentMaster ---
  const insertDept = db.prepare(`
    INSERT INTO "DepartmentMaster" ("DeptID", "DeptName", "IsSystem") VALUES (?, ?, ?)
  `);
  [
    [1, 'Cutting & Sawing', 0],
    [2, 'Forging & Casting', 0],
    [3, 'Machining & CNC', 0],
    [4, 'Polishing & Plating', 0],
    [5, 'Assembly & Testing', 0],
    [6, 'Finished Goods Store', 0]
  ].forEach(row => insertDept.run(...row));

  // --- 3. BrandMaster ---
  const insertBrand = db.prepare(`
    INSERT INTO "BrandMaster" ("BrandId", "BrandName") VALUES (?, ?)
  `);
  [
    [1, 'FlowPro'],
    [2, 'AquaPlumb'],
    [3, 'Valvetech'],
    [4, 'Zenith']
  ].forEach(row => insertBrand.run(...row));

  // --- 4. ItemTypeMaster ---
  const insertItemType = db.prepare(`
    INSERT INTO "ItemTypeMaster" ("ItemType", "IsSystem") VALUES (?, ?)
  `);
  [
    ['RAW MATERIAL', 1],
    ['SEMI-FINISHED', 1],
    ['FINISHED GOOD', 1],
    ['CONSUMABLE', 0],
    ['SCRAP', 1]
  ].forEach(row => insertItemType.run(...row));

  // --- 5. UnitMaster ---
  const insertUnit = db.prepare(`
    INSERT INTO "UnitMaster" ("Unit", "IsSystem") VALUES (?, ?)
  `);
  [
    ['PCS', 1],
    ['KGS', 1],
    ['MTR', 0],
    ['BOX', 0],
    ['SET', 0]
  ].forEach(row => insertUnit.run(...row));

  // --- 6. CompanyProfile ---
  const insertCompany = db.prepare(`
    INSERT INTO "CompanyProfile" (
      "CompanyName", "Address1", "Address2", "City", "StateName", "CountryName", "Pincode",
      "ContactPerson", "PhoneNo", "MobileNo", "EmailID", "Website", "GSTIN", "PANNo",
      "BankName", "BranchName", "AccountNo", "IFSCCode", "UPI", "LogoPath"
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertCompany.run(
    'FRM Manufacturing & Engineering Ltd',
    'Plot No. 42-45, GIDC Industrial Estate',
    'Phase II, Odhav',
    'Ahmedabad',
    'Gujarat',
    'India',
    '382415',
    'Rajesh Sharma',
    '079-22874512',
    '9876543210',
    'contact@frm.demo',
    'https://www.frm.demo',
    '24AAACF1234K1Z5',
    'AAACF1234K',
    'State Bank of India',
    'Industrial Finance Branch',
    '33889900112',
    'SBIN0004052',
    'frm@sbi',
    '/assets/app_logo.jpeg'
  );

  // --- 7. Users ---
  const insertUser = db.prepare(`
    INSERT INTO "Users" (
      "UserId", "Username", "Password", "MobileNo", "UserRole", "IsActive", "IsAdd", "IsEdit", "IsDelete", "AllowedMenus"
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  [
    [1, 'admin', 'admin123', '9876500001', 'ADMIN', 1, 1, 1, 1, '*'],
    [2, 'manager', 'mgr123', '9876500002', 'MANAGER', 1, 1, 1, 1, 'Dashboard,Masters,Entries,Reports'],
    [3, 'operator', 'oper123', '9876500003', 'OPERATOR', 1, 1, 0, 0, 'Entries'],
    [4, 'accountant', 'acct123', '9876500004', 'ACCOUNTANT', 1, 1, 1, 0, 'Vouchers,Reports']
  ].forEach(row => insertUser.run(...row));

  // --- 8. Assets ---
  const insertAsset = db.prepare(`
    INSERT INTO "Assets" ("AssetId", "AssetName", "Quantity", "UnitValue", "TotalValue") VALUES (?, ?, ?, ?, ?)
  `);
  [
    [1, 'CNC Turning Center', 2, 1850000, 3700000],
    [2, 'Hydraulic Press 50 Ton', 1, 650000, 650000],
    [3, 'Rotary Air Compressor 15HP', 2, 180000, 360000],
    [4, 'Heavy Duty Band Saw Machine', 3, 120000, 360000],
    [5, 'Forklift 2.5 Ton Diesel', 1, 920000, 920000]
  ].forEach(row => insertAsset.run(...row));

  // --- 9. ItemMaster ---
  const insertItem = db.prepare(`
    INSERT INTO "ItemMaster" (
      "ItemCode", "ItemName", "ItemType", "Series", "StdWeight", "Costing", "MRP", "Unit", "OpeningStock", "ClosingStock"
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  [
    ['RM-BR01', 'Brass Rod 25mm Round', 'RAW MATERIAL', 'B-SERIES', 4.150, 480, 550, 'KGS', 2500.000, 2200.000],
    ['RM-BR02', 'Brass Hex Bar 19mm', 'RAW MATERIAL', 'B-SERIES', 2.850, 495, 570, 'KGS', 1800.000, 1650.000],
    ['RM-SS01', 'Stainless Steel Rod 12mm', 'RAW MATERIAL', 'SS-304', 0.890, 280, 340, 'KGS', 950.000, 900.000],
    ['SF-VB01', 'Valve Body Cast 1/2" (Rough)', 'SEMI-FINISHED', 'VALVE-SF', 0.350, 190, 240, 'PCS', 500.000, 420.000],
    ['SF-SP01', 'Spindle Stem Machined 1/2"', 'SEMI-FINISHED', 'VALVE-SF', 0.080, 45, 65, 'PCS', 600.000, 530.000],
    ['SF-BL01', 'Brass Ball 1/2" Turned & Polished', 'SEMI-FINISHED', 'VALVE-SF', 0.065, 38, 55, 'PCS', 750.000, 680.000],
    ['FG-BV01', 'Full Bore Brass Ball Valve 1/2"', 'FINISHED GOOD', 'PREMIUM', 0.520, 320, 495, 'PCS', 300.000, 250.000],
    ['FG-PT01', 'Quarter Turn Pillar Cock Chrome', 'FINISHED GOOD', 'ELEGANCE', 0.680, 410, 680, 'PCS', 200.000, 160.000],
    ['FG-BT01', 'Bib Tap with Wall Flange 15mm', 'FINISHED GOOD', 'STANDARD', 0.440, 260, 425, 'PCS', 400.000, 340.000],
    ['SCRAP-BR', 'Brass Turning & Boring Scrap', 'SCRAP', 'SCRAP', 1.000, 360, 390, 'KGS', 650.000, 720.000]
  ].forEach(row => insertItem.run(...row));

  // --- 10. LedgerMaster ---
  const insertLedger = db.prepare(`
    INSERT INTO "LedgerMaster" (
      "Id", "LedgerName", "AccountGroupID", "Address", "City", "State", "GSTIN", "MobileNo",
      "Email", "BankName", "AccountNo", "IFSC", "UPI", "OwnBrand", "OtherBrand", "Discount",
      "CD", "Bill", "PaymentTerm", "Transport", "OpeningBalance", "ClosingBalance", "Remark"
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  [
    [1, 'Acme Hardware & Pipe Fittings', 4, '102 Industrial Area, Andheri East', 'Mumbai', 'Maharashtra', '27AABCA1122D1Z1', '9820011223', 'purchase@acme.demo', 'HDFC Bank', '50200098765432', 'HDFC0000001', 'acme@hdfc', 'FlowPro', 'Standard', 5.00, 0, 1, 30, 'Navkar Roadlines', 45000.00, 52000.00, 'Regular Dealer A'],
    [2, 'Apex Sanitary Distributors', 4, 'B-45 Wholesale Market', 'Delhi', 'Delhi', '07AABCA3344D1Z2', '9811022334', 'info@apexdelhi.demo', 'ICICI Bank', '001105001234', 'ICIC0000011', 'apex@icici', 'FlowPro', 'Standard', 3.50, 0, 1, 21, 'Delhi Gujarat Freight', 28000.00, 31500.00, 'North Region Distributor'],
    [3, 'Gujarat Metal Alloys Corp', 5, 'Plot 88 Industrial Zone', 'Jamnagar', 'Gujarat', '24AABCG5566K1Z3', '9825033445', 'sales@gujmetal.demo', 'SBI', '110022334455', 'SBIN0001234', 'gujmetal@sbi', null, null, 0.00, 0, 1, 15, 'Direct Truck', -65000.00, -42000.00, 'Raw Material Supplier'],
    [4, 'Shreeji Brass Extrusions', 5, 'Shreeji Compound, Patel Nagar', 'Jamnagar', 'Gujarat', '24AABCS7788P1Z4', '9825044556', 'order@shreejibrass.demo', 'Bank of Baroda', '01230200001234', 'BARB0JAMNAG', 'shreeji@bob', null, null, 0.00, 0, 1, 30, 'Patel Transport', -88000.00, -60000.00, 'Extrusion Rod Supplier'],
    [5, 'Prime Jobwork & Electroplaters', 5, 'Survey 14, Metoda GIDC', 'Rajkot', 'Gujarat', '24AABCP9900M1Z5', '9824055667', 'billing@primejob.demo', 'Axis Bank', '912010012345678', 'UTIB0000123', 'primejob@axis', null, null, 0.00, 0, 1, 15, 'Local Tempo', -12500.00, -8400.00, 'Casting & Nickel Plating Vendor'],
    [6, 'HDFC Current Bank A/C', 6, 'Navrangpura Branch', 'Ahmedabad', 'Gujarat', '24AAACH1234A1Z0', '0792658000', 'ahmedabad@hdfcbank.com', 'HDFC Bank', '50200012345678', 'HDFC0000060', 'frm@hdfc', null, null, 0.00, 0, 1, 0, null, 350000.00, 412500.00, 'Primary Operating Account'],
    [7, 'Petty Cash Account', 6, 'Factory Office Counter', 'Ahmedabad', 'Gujarat', null, '0792287451', 'cashier@frm.demo', null, null, null, null, null, null, 0.00, 0, 1, 0, null, 25000.00, 18450.00, 'Factory Floor Petty Cash']
  ].forEach(row => insertLedger.run(...row));

  // --- 11. BOM_Master ---
  const insertBOM = db.prepare(`
    INSERT INTO "BOM_Master" ("ParentItemCode", "ChildItemCode", "Quantity") VALUES (?, ?, ?)
  `);
  [
    ['FG-BV01', 'SF-VB01', 1.000],
    ['FG-BV01', 'SF-SP01', 1.000],
    ['FG-BV01', 'SF-BL01', 1.000],
    ['SF-VB01', 'RM-BR01', 0.450],
    ['SF-SP01', 'RM-SS01', 0.095],
    ['SF-BL01', 'RM-BR02', 0.080],
    ['FG-PT01', 'SF-VB01', 1.000],
    ['FG-PT01', 'SF-SP01', 1.000]
  ].forEach(row => insertBOM.run(...row));

  // --- 12. DepartmentStock ---
  const insertDeptStock = db.prepare(`
    INSERT INTO "DepartmentStock" ("DeptID", "ItemCode", "Pcs", "Weight") VALUES (?, ?, ?, ?)
  `);
  [
    [1, 'RM-BR01', 120.000, 498.000],
    [1, 'RM-SS01', 80.000, 71.200],
    [2, 'RM-BR01', 95.000, 394.250],
    [3, 'SF-VB01', 180.000, 63.000],
    [3, 'SF-SP01', 240.000, 19.200],
    [4, 'SF-BL01', 300.000, 19.500],
    [5, 'FG-BV01', 50.000, 26.000],
    [6, 'FG-BV01', 250.000, 130.000],
    [6, 'FG-PT01', 160.000, 108.800]
  ].forEach(row => insertDeptStock.run(...row));

  // --- 13. AssemblyTransactions ---
  const insertAssembly = db.prepare(`
    INSERT INTO "AssemblyTransactions" (
      "Id", "AssemblyNo", "AssemblyDate", "ItemCode", "Quantity", "Remark", "CreatedBy", "UpdatedBy"
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  [
    [1, 101, '2026-10-15', 'FG-BV01', 50, 'Batch A-101 assembled and pressure tested', 'operator', 'manager'],
    [2, 102, '2026-10-20', 'FG-PT01', 40, 'Batch A-102 chrome pillar cock assembly', 'operator', 'admin']
  ].forEach(row => insertAssembly.run(...row));

  // --- 14. InwardHeader ---
  const insertInwardHdr = db.prepare(`
    INSERT INTO "InwardHeader" (
      "ID", "Bill", "INWARDNO", "INWARDDATE", "LEDGERID", "EXPENSE", "SGST", "CGST", "IGST",
      "GSTPER", "ROUNDOFF", "TOTALAMOUNT", "REMARK", "CREATEDBY", "UPDATEDBY"
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  [
    [1, 1, 'INW-26-001', '2026-10-05', 3, 500.00, 2646.00, 2646.00, 0.00, 18.00, 0.00, 35192.00, 'Brass rods batch receipt', 'admin', 'admin'],
    [2, 1, 'INW-26-002', '2026-10-12', 4, 350.00, 1978.02, 1978.02, 0.00, 18.00, 0.00, 26284.04, 'Hex bar supply receipt', 'operator', null]
  ].forEach(row => insertInwardHdr.run(...row));

  // --- 15. InwardDetail ---
  const insertInwardDtl = db.prepare(`
    INSERT INTO "InwardDetail" (
      "ID", "INWARDID", "ITEMCODE", "GROSSWT", "NETWT", "QUANTITY", "UNIT", "RATE", "AMOUNT", "TENPCSWT"
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  [
    [1, 1, 'RM-BR01', 62.500, 61.250, 61.25, 'KGS', 480.00, 29400.00, 41.500],
    [2, 2, 'RM-BR02', 45.200, 44.400, 44.40, 'KGS', 495.00, 21978.00, 28.500]
  ].forEach(row => insertInwardDtl.run(...row));

  // --- 16. OutwardHeader ---
  const insertOutwardHdr = db.prepare(`
    INSERT INTO "OutwardHeader" (
      "ID", "Bill", "OUTWARDNO", "OUTWARDDATE", "LEDGERID", "EXPENSE", "SGST", "CGST", "IGST",
      "GSTPER", "ROUNDOFF", "TOTALAMOUNT", "REMARK", "CREATEDBY", "UPDATEDBY", "CDPER", "CDAMOUNT"
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  [
    [1, 1, 'OUT-26-001', '2026-10-18', 1, 450.00, 2227.50, 2227.50, 0.00, 18.00, 0.00, 29655.00, 'Sales order dispatch to Acme', 'admin', 'admin', 0.00, 0.00],
    [2, 1, 'OUT-26-002', '2026-10-22', 2, 300.00, 0.00, 0.00, 4896.00, 18.00, 0.00, 32396.00, 'Interstate dispatch to Apex Delhi', 'operator', null, 0.00, 0.00]
  ].forEach(row => insertOutwardHdr.run(...row));

  // --- 17. OutwardDetail ---
  const insertOutwardDtl = db.prepare(`
    INSERT INTO "OutwardDetail" (
      "ID", "OUTWARDID", "ITEMCODE", "GROSSWT", "NETWT", "QUANTITY", "UNIT", "RATE", "AMOUNT", "DISCOUNT", "TENPCSWT"
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  [
    [1, 1, 'FG-BV01', 26.500, 26.000, 50.00, 'PCS', 495.00, 24750.00, 0.00, 5.200],
    [2, 2, 'FG-PT01', 27.500, 27.200, 40.00, 'PCS', 680.00, 27200.00, 0.00, 6.800]
  ].forEach(row => insertOutwardDtl.run(...row));

  // --- 18. JobworkOutHeader ---
  const insertJobOutHdr = db.prepare(`
    INSERT INTO "JobworkOutHeader" (
      "ID", "JWOUTWARDNO", "JWOUTWARDDATE", "LEDGERID", "REMARK", "CREATEDBY", "UPDATEDBY", "Bill", "DeptID"
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  [
    [1, 'JWO-26-001', '2026-10-08', 5, 'Issue raw brass for rough body casting', 'admin', 'admin', 1, 2],
    [2, 'JWO-26-002', '2026-10-14', 5, 'Issue turned balls for nickel-chrome plating', 'operator', null, 1, 4]
  ].forEach(row => insertJobOutHdr.run(...row));

  // --- 19. JobworkOutDetail ---
  const insertJobOutDtl = db.prepare(`
    INSERT INTO "JobworkOutDetail" (
      "ID", "JWOUTWARDID", "ITEMCODE", "GROSSWT", "NETWT", "QUANTITY", "UNIT", "RATE", "PROCESS", "TENPCSWT"
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  [
    [1, 1, 'RM-BR01', 125.000, 124.500, 124.50, 'KGS', 0.00, 'Casting & Forging', 41.500],
    [2, 2, 'SF-BL01', 13.200, 13.000, 200.00, 'PCS', 0.00, 'Electroplating', 0.650]
  ].forEach(row => insertJobOutDtl.run(...row));

  // --- 20. JobworkInHeader ---
  const insertJobInHdr = db.prepare(`
    INSERT INTO "JobworkInHeader" (
      "ID", "JWINWARDNO", "JWINWARDDATE", "LEDGERID", "JWOUTWARDNO", "TOTALAMOUNT", "REMARK", "CREATEDBY", "UPDATEDBY", "Bill"
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  [
    [1, 'JWI-26-001', '2026-10-16', 5, 'JWO-26-001', 4200.00, 'Received forged valve bodies', 'admin', 'admin', 1]
  ].forEach(row => insertJobInHdr.run(...row));

  // --- 21. JobworkInDetail ---
  const insertJobInDtl = db.prepare(`
    INSERT INTO "JobworkInDetail" (
      "ID", "JWINWARDID", "OUTITEMCODE", "INITEMCODE", "GROSSWT", "NETWT", "SCRAPITEMCODE",
      "SCRAPPCS", "SCRAPWT", "QUANTITY", "PROCESS", "UNIT", "RATE", "AMOUNT", "TENPCSWT"
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  [
    [1, 1, 'RM-BR01', 'SF-VB01', 88.000, 87.500, 'SCRAP-BR', 0.00, 32.500, 250.00, 'Casting & Forging', 'PCS', 16.80, 4200.00, 3.500]
  ].forEach(row => insertJobInDtl.run(...row));

  // --- 22. StockJournal ---
  const insertStockJournal = db.prepare(`
    INSERT INTO "StockJournal" ("SJID", "SJDate", "SJType", "ItemCode", "Qty", "Remarks", "CreatedBy", "UpdatedBy")
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  [
    [1, '2026-10-25', 'PHYSICAL_VERIF', 'RM-BR01', 15.000, 'Stock audit physical verification surplus', 'manager', 'admin'],
    [2, '2026-10-26', 'DAMAGE_SCRAP', 'SF-VB01', -3.000, 'Found casting porosity defect - scrapped', 'operator', 'manager']
  ].forEach(row => insertStockJournal.run(...row));

  // --- 23. StockTransfer ---
  const insertStockTransfer = db.prepare(`
    INSERT INTO "StockTransfer" (
      "MoveID", "TransferID", "MoveDate", "FromDeptID", "ToDeptID", "OutItemCode", "OutPcs",
      "OutWeight", "InItemCode", "InPcs", "InWeight", "ScrapItemCode", "ScrapPcs", "ScrapWeight",
      "LossWeight", "Remarks", "CreatedBy", "UpdatedBy", "Rate", "Amount", "LossRate",
      "LossAmount", "Unit", "ManualChallanNo"
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  [
    [1, 'ST-26-001', '2026-10-10', 1, 3, 'RM-BR01', 50.000, 207.500, 'SF-SP01', 450.000, 171.000, 'SCRAP-BR', 0.000, 34.200, 2.300, 'Spindle rod turning movement', 'operator', 'admin', 480.00, 99600.00, 0.00, 0.00, 'PCS', 'CH-1001'],
    [2, 'ST-26-002', '2026-10-19', 5, 6, 'FG-BV01', 50.000, 26.000, 'FG-BV01', 50.000, 26.000, null, 0.000, 0.000, 0.000, 'Transfer tested goods to Finished Goods store', 'operator', 'manager', 320.00, 16000.00, 0.00, 0.00, 'PCS', 'CH-1002']
  ].forEach(row => insertStockTransfer.run(...row));

  // --- 24. VoucherEntry ---
  const insertVoucher = db.prepare(`
    INSERT INTO "VoucherEntry" (
      "VoucherId", "VoucherType", "VoucherNo", "VoucherDate", "Mode", "LedgerId", "Amount",
      "Through", "Remark", "CREATEDBY", "UPDATEDBY", "Bill"
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  [
    [1, 'RECEIPT', 1001, '2026-10-20', 'BANK', 1, 25000.00, 'NEFT Ref #998877', 'Part payment received for Inv #OUT-26-001', 'accountant', 'admin', 1],
    [2, 'PAYMENT', 2001, '2026-10-21', 'BANK', 3, 20000.00, 'RTGS Ref #112233', 'Payment against raw material purchase', 'accountant', 'admin', 1],
    [3, 'PAYMENT', 2002, '2026-10-24', 'CASH', 5, 4200.00, 'Cash Voucher #89', 'Jobwork casting charges cleared', 'accountant', null, 1]
  ].forEach(row => insertVoucher.run(...row));

  db.exec('COMMIT;');

  // Enable foreign keys and validate
  db.exec('PRAGMA foreign_keys = ON;');
  const integrity = db.prepare('PRAGMA integrity_check;').all();
  const fkCheck = db.prepare('PRAGMA foreign_key_check;').all();

  console.log(`[Seed] Successfully seeded dummy data into: ${dbFilePath}`);
  console.log(`[Seed] Integrity check: ${integrity[0]?.integrity_check || 'ok'}`);
  console.log(`[Seed] Foreign key check: ${fkCheck.length === 0 ? 'PASSED (0 violations)' : JSON.stringify(fkCheck)}`);

  // Print summary count for each table
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name;").all();
  console.log('\n--- DUMMY DATA SUMMARY PER TABLE ---');
  tables.forEach(t => {
    const count = db.prepare(`SELECT COUNT(*) as cnt FROM "${t.name}"`).get();
    console.log(`  ${t.name.padEnd(25)} : ${count.cnt} rows`);
  });

  const exportedBuffer = Buffer.from(db.export());
  fs.writeFileSync(dbFilePath, exportedBuffer);

  db.close();
}

if (require.main === module) {
  const targetDb = path.join(__dirname, 'factoryflow.db');
  seedDummyData(targetDb)
    .then(() => console.log('[Seed] Done!'))
    .catch(err => {
      console.error('[Seed] Error:', err);
      process.exit(1);
    });
}

module.exports = { seedDummyData };

