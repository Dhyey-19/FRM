const { sql, connectDB } = require('../config/db');
const nicApiService = require('../services/nicApiService');

// State Code lookup dictionary for Indian States and Union Territories
const STATE_CODES = {
  'JAMMU AND KASHMIR': '01',
  'HIMACHAL PRADESH': '02',
  'PUNJAB': '03',
  'CHANDIGARH': '04',
  'UTTARAKHAND': '05',
  'HARYANA': '06',
  'DELHI': '07',
  'RAJASTHAN': '08',
  'UTTAR PRADESH': '09',
  'BIHAR': '10',
  'SIKKIM': '11',
  'ARUNACHAL PRADESH': '12',
  'NAGALAND': '13',
  'MANIPUR': '14',
  'MIZORAM': '15',
  'TRIPURA': '16',
  'MEGHALAYA': '17',
  'ASSAM': '18',
  'WEST BENGAL': '19',
  'JHARKHAND': '20',
  'ODISHA': '21',
  'CHATTISGARH': '22',
  'MADHYA PRADESH': '23',
  'GUJARAT': '24',
  'DAMAN AND DIU': '25',
  'DADRA AND NAGAR HAVELI': '26',
  'MAHARASHTRA': '27',
  'ANDHRA PRADESH': '37',
  'KARNATAKA': '29',
  'GOA': '30',
  'LAKSHADWEEP': '31',
  'KERALA': '32',
  'TAMIL NADU': '33',
  'PUDUCHERRY': '34',
  'ANDAMAN AND NICOBAR ISLANDS': '35',
  'TELANGANA': '36',
  'LADAKH': '38',
  'OTHER TERRITORY': '97'
};

// Map units to official GST UQC codes
const UQC_CODES = {
  'PCS': 'PCS',
  'PIECES': 'PCS',
  'NOS': 'NOS',
  'NUMBER': 'NOS',
  'NUMBERS': 'NOS',
  'KG': 'KGS',
  'KGS': 'KGS',
  'KILOGRAM': 'KGS',
  'MTR': 'MTR',
  'METER': 'MTR',
  'METERS': 'MTR',
  'BOX': 'BOX',
  'BOXES': 'BOX',
  'SET': 'SET',
  'SETS': 'SET',
  'BAG': 'BAG',
  'BAGS': 'BAG',
  'LTR': 'LTR',
  'LITRE': 'LTR',
  'ROLL': 'ROL',
  'TON': 'TON',
  'TONNE': 'TON',
  'QUINTAL': 'QTL'
};

function extractStateCode(gstin, stateName = '') {
  if (gstin && typeof gstin === 'string') {
    const clean = gstin.trim().toUpperCase();
    if (clean.length >= 2 && /^\d{2}/.test(clean)) {
      return clean.substring(0, 2);
    }
  }

  if (stateName && typeof stateName === 'string') {
    const cleanState = stateName.trim().toUpperCase();
    if (STATE_CODES[cleanState]) {
      return STATE_CODES[cleanState];
    }
    // Partial match
    for (const [st, code] of Object.entries(STATE_CODES)) {
      if (cleanState.includes(st) || st.includes(cleanState)) {
        return code;
      }
    }
  }

  return '24'; // Default to Gujarat if not identified
}

function formatDateNIC(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

function cleanPincode(pincode, address = '') {
  if (pincode && /^\d{6}$/.test(String(pincode).trim())) {
    return parseInt(String(pincode).trim(), 10);
  }

  // Try extracting 6 digit number from address
  if (address) {
    const match = String(address).match(/\b[1-9][0-9]{5}\b/);
    if (match) {
      return parseInt(match[0], 10);
    }
  }

  return 380001; // Default fallback PIN
}

function mapUQC(unit) {
  if (!unit) return 'OTH';
  const u = String(unit).trim().toUpperCase();
  return UQC_CODES[u] || (u.length <= 3 ? u : 'OTH');
}

// Build standard NIC INV-01 JSON object for an invoice
function buildNICInvoiceJSON(header, details, seller, buyer) {
  const errors = [];
  const warnings = [];

  // 1. Validate Seller GSTIN
  const sellerGSTIN = String(seller?.GSTIN || '').trim().toUpperCase();
  if (!sellerGSTIN || !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(sellerGSTIN)) {
    warnings.push(`Company Profile GSTIN '${sellerGSTIN}' does not strictly match 15-character GST format.`);
  }

  // 2. Validate Buyer GSTIN
  const buyerGSTIN = String(buyer?.GSTIN || '').trim().toUpperCase();
  if (!buyerGSTIN) {
    errors.push('Buyer GSTIN is required for B2B e-Invoicing. Please update GSTIN in Ledger Master for this customer.');
  } else if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(buyerGSTIN)) {
    warnings.push(`Buyer GSTIN '${buyerGSTIN}' does not strictly match 15-character GST format.`);
  }

  const sellerStateCode = extractStateCode(sellerGSTIN, seller?.StateName);
  const buyerStateCode = extractStateCode(buyerGSTIN, buyer?.State);
  const isInterState = sellerStateCode !== buyerStateCode;

  // 3. Process Items
  let totalAssVal = 0;
  let totalCgstVal = 0;
  let totalSgstVal = 0;
  let totalIgstVal = 0;
  let totalDiscountVal = 0;

  const itemList = [];
  let slNo = 1;

  for (const item of details) {
    const qty = parseFloat(item.QUANTITY) || 0;
    const rate = parseFloat(item.RATE) || 0;
    const itemTot = Math.round(qty * rate * 100) / 100;
    const discountPct = parseFloat(item.DISCOUNT) || 0;
    const discountAmt = Math.round(itemTot * (discountPct / 100) * 100) / 100;
    const assAmt = Math.max(0, Math.round((itemTot - discountAmt) * 100) / 100);

    const gstRate = parseFloat(header.GSTPER) || 18;
    let igstAmt = 0;
    let cgstAmt = 0;
    let sgstAmt = 0;

    if (isInterState) {
      igstAmt = Math.round(assAmt * (gstRate / 100) * 100) / 100;
    } else {
      cgstAmt = Math.round(assAmt * ((gstRate / 2) / 100) * 100) / 100;
      sgstAmt = Math.round(assAmt * ((gstRate / 2) / 100) * 100) / 100;
    }

    const totItemVal = Math.round((assAmt + igstAmt + cgstAmt + sgstAmt) * 100) / 100;

    totalAssVal += assAmt;
    totalCgstVal += cgstAmt;
    totalSgstVal += sgstAmt;
    totalIgstVal += igstAmt;
    totalDiscountVal += discountAmt;

    let hsn = String(item.HSNCode || item.HSN || '').trim();
    if (!hsn || hsn.length < 4) {
      hsn = '84818090'; // Standard valves/fittings default HSN
      warnings.push(`Item '${item.ITEMCODE}' has no HSN code. Using default '${hsn}'.`);
    }

    itemList.push({
      SlNo: String(slNo++),
      PrdDesc: item.ItemName || item.ITEMCODE,
      IsServc: 'N',
      HsnCd: hsn,
      Barcde: null,
      Qty: qty,
      FreeQty: 0,
      Unit: mapUQC(item.UNIT),
      UnitPrice: rate,
      TotAmt: itemTot,
      Discount: discountAmt,
      PreTaxVal: 0,
      AssAmt: assAmt,
      GstRt: gstRate,
      IgstAmt: igstAmt,
      CgstAmt: cgstAmt,
      SgstAmt: sgstAmt,
      CesRt: 0,
      CesAmt: 0,
      CesNonAdvlAmt: 0,
      StateCesRt: 0,
      StateCesAmt: 0,
      StateCesNonAdvlAmt: 0,
      OthChrg: 0,
      TotItemVal: totItemVal
    });
  }

  const expense = parseFloat(header.EXPENSE) || 0;
  const roundOff = parseFloat(header.ROUNDOFF) || 0;
  const headerTotal = parseFloat(header.TOTALAMOUNT) || 0;
  const computedTotal = Math.round((totalAssVal + totalCgstVal + totalSgstVal + totalIgstVal + expense + roundOff) * 100) / 100;
  const finalTotal = headerTotal > 0 ? headerTotal : computedTotal;

  const nicJSON = {
    Version: '1.1',
    TranDtls: {
      TaxSch: 'GST',
      SupTyp: 'B2B',
      RegRev: 'N',
      EcmGstin: null,
      IgstOnIntra: 'N'
    },
    DocDtls: {
      Typ: 'INV',
      No: String(header.OUTWARDNO).trim(),
      Dt: formatDateNIC(header.OUTWARDDATE)
    },
    SellerDtls: {
      Gstin: sellerGSTIN,
      LglNm: seller?.CompanyName || 'FRM Precision Manufacturing Ltd',
      TrdNm: seller?.CompanyName || 'FRM Precision Manufacturing Ltd',
      Addr1: (seller?.Address1 || 'Plot No. 42-45, GIDC Industrial Estate').substring(0, 100),
      Addr2: (seller?.Address2 || '').substring(0, 100),
      Loc: (seller?.City || 'Ahmedabad').substring(0, 50),
      Pin: cleanPincode(seller?.Pincode, seller?.Address1),
      Stcd: sellerStateCode,
      Ph: seller?.MobileNo || seller?.PhoneNo || null,
      Em: seller?.EmailID || null
    },
    BuyerDtls: {
      Gstin: buyerGSTIN,
      LglNm: (buyer?.LedgerName || 'Customer').substring(0, 100),
      TrdNm: (buyer?.LedgerName || 'Customer').substring(0, 100),
      Pos: buyerStateCode,
      Addr1: (buyer?.Address || buyer?.City || 'Commercial Hub').substring(0, 100),
      Addr2: '',
      Loc: (buyer?.City || 'City').substring(0, 50),
      Pin: cleanPincode(buyer?.Pincode, buyer?.Address),
      Stcd: buyerStateCode,
      Ph: buyer?.MobileNo || null,
      Em: buyer?.Email || null
    },
    DispDtls: null,
    ShipDtls: null,
    ItemList: itemList,
    ValDtls: {
      AssVal: Math.round(totalAssVal * 100) / 100,
      CgstVal: Math.round(totalCgstVal * 100) / 100,
      SgstVal: Math.round(totalSgstVal * 100) / 100,
      IgstVal: Math.round(totalIgstVal * 100) / 100,
      CesVal: 0,
      StCesVal: 0,
      Discount: Math.round(totalDiscountVal * 100) / 100,
      OthChrg: expense,
      RndOffAmt: roundOff,
      TotInvVal: finalTotal
    },
    PayDtls: null,
    RefDtls: null,
    AddlDocDtls: null,
    ExpDtls: null,
    EwbDtls: null
  };

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    einvoiceJSON: nicJSON
  };
}

// GET /api/einvoice/generate-json/:id
exports.generateEInvoiceJSON = async (req, res) => {
  const { id } = req.params;

  try {
    const pool = await connectDB();

    // 1. Fetch Header
    const headerRes = await pool.request()
      .input('ID', sql.Numeric(8, 0), id)
      .query('SELECT * FROM OutwardHeader WHERE ID = @ID');

    if (headerRes.recordset.length === 0) {
      return res.status(404).json({ message: 'Sales Outward invoice not found' });
    }
    const header = headerRes.recordset[0];

    // 2. Fetch Buyer (LedgerMaster)
    const ledgerRes = await pool.request()
      .input('LedgerID', sql.Numeric(10, 0), header.LEDGERID)
      .query('SELECT * FROM LedgerMaster WHERE Id = @LedgerID');
    const buyer = ledgerRes.recordset[0] || {};

    // 3. Fetch Seller (CompanyProfile)
    const companyRes = await pool.request().query('SELECT TOP 1 * FROM CompanyProfile');
    const seller = companyRes.recordset[0] || {};

    // 4. Fetch Details
    const detailRes = await pool.request()
      .input('OutwardID', sql.Numeric(8, 0), id)
      .query(`
        SELECT d.*, i.ItemName, i.HSNCode 
        FROM OutwardDetail d
        LEFT JOIN ItemMaster i ON d.ITEMCODE = i.ItemCode AND ISNULL(d.SUBCODE, '') = ISNULL(i.SubCode, '')
        WHERE d.OUTWARDID = @OutwardID
      `);
    const details = detailRes.recordset || [];

    if (details.length === 0) {
      return res.status(400).json({ message: 'Invoice has no line items' });
    }

    const result = buildNICInvoiceJSON(header, details, seller, buyer);

    // If query param ?download=true is passed, send as downloadable JSON file
    if (req.query.download === 'true') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename=einvoice_${header.OUTWARDNO}.json`);
      // NIC portal expects an array of invoices for bulk upload
      return res.status(200).send(JSON.stringify([result.einvoiceJSON], null, 2));
    }

    res.status(200).json({
      ...result,
      invoiceSummary: {
        id: header.ID,
        outwardNo: header.OUTWARDNO,
        outwardDate: header.OUTWARDDATE,
        totalAmount: header.TOTALAMOUNT,
        einvoiceStatus: header.EInvoiceStatus || 'Pending',
        irn: header.IRN,
        ackNo: header.AckNo,
        ackDate: header.AckDate
      }
    });
  } catch (error) {
    console.error('Error generating e-Invoice JSON:', error);
    res.status(500).json({ message: 'Server error generating e-Invoice JSON', error: error.message });
  }
};

// POST /api/einvoice/bulk-json
exports.generateBulkEInvoiceJSON = async (req, res) => {
  const { invoiceIds } = req.body;
  if (!Array.isArray(invoiceIds) || invoiceIds.length === 0) {
    return res.status(400).json({ message: 'invoiceIds array is required' });
  }

  try {
    const pool = await connectDB();
    const companyRes = await pool.request().query('SELECT TOP 1 * FROM CompanyProfile');
    const seller = companyRes.recordset[0] || {};

    const bulkList = [];
    const skipped = [];

    for (const id of invoiceIds) {
      const headerRes = await pool.request()
        .input('ID', sql.Numeric(8, 0), id)
        .query('SELECT * FROM OutwardHeader WHERE ID = @ID');

      if (headerRes.recordset.length === 0) continue;
      const header = headerRes.recordset[0];

      const ledgerRes = await pool.request()
        .input('LedgerID', sql.Numeric(10, 0), header.LEDGERID)
        .query('SELECT * FROM LedgerMaster WHERE Id = @LedgerID');
      const buyer = ledgerRes.recordset[0] || {};

      const detailRes = await pool.request()
        .input('OutwardID', sql.Numeric(8, 0), id)
        .query(`
          SELECT d.*, i.ItemName, i.HSNCode 
          FROM OutwardDetail d
          LEFT JOIN ItemMaster i ON d.ITEMCODE = i.ItemCode AND ISNULL(d.SUBCODE, '') = ISNULL(i.SubCode, '')
          WHERE d.OUTWARDID = @OutwardID
        `);
      const details = detailRes.recordset || [];

      if (details.length === 0) {
        skipped.push({ id, reason: 'No line items' });
        continue;
      }

      const result = buildNICInvoiceJSON(header, details, seller, buyer);
      if (result.isValid) {
        bulkList.push(result.einvoiceJSON);
      } else {
        skipped.push({ id, outwardNo: header.OUTWARDNO, errors: result.errors });
      }
    }

    if (req.query.download === 'true') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename=einvoice_bulk_${Date.now()}.json`);
      return res.status(200).send(JSON.stringify(bulkList, null, 2));
    }

    res.status(200).json({
      totalInvoices: invoiceIds.length,
      validInvoicesCount: bulkList.length,
      skippedCount: skipped.length,
      skipped,
      bulkJSON: bulkList
    });
  } catch (error) {
    console.error('Error generating bulk e-Invoice JSON:', error);
    res.status(500).json({ message: 'Server error generating bulk e-Invoice JSON', error: error.message });
  }
};

// POST /api/einvoice/import-response/:id
exports.importEInvoiceResponse = async (req, res) => {
  const { id } = req.params;
  const { irn, ackNo, ackDate, signedQRCode, signedInvoice, rawResponse } = req.body;

  try {
    const pool = await connectDB();

    // Check if rawResponse object was pasted/uploaded directly from portal
    let resolvedIRN = (irn || '').trim();
    let resolvedAckNo = (ackNo || '').trim();
    let resolvedAckDate = (ackDate || '').trim();
    let resolvedSignedQR = (signedQRCode || '').trim();
    let resolvedSignedInvoice = (signedInvoice || '').trim();

    if (rawResponse && typeof rawResponse === 'object') {
      resolvedIRN = rawResponse.Irn || rawResponse.irn || rawResponse.IRN || resolvedIRN;
      resolvedAckNo = String(rawResponse.AckNo || rawResponse.ackNo || rawResponse.ACKNO || resolvedAckNo);
      resolvedAckDate = rawResponse.AckDt || rawResponse.ackDt || rawResponse.AckDate || rawResponse.ackDate || resolvedAckDate;
      resolvedSignedQR = rawResponse.SignedQRCode || rawResponse.signedQRCode || rawResponse.signedQrCode || resolvedSignedQR;
      resolvedSignedInvoice = rawResponse.SignedInvoice || rawResponse.signedInvoice || resolvedSignedInvoice;
    }

    if (!resolvedIRN) {
      return res.status(400).json({ message: 'IRN (Invoice Reference Number) is required.' });
    }

    if (resolvedIRN.length !== 64) {
      return res.status(400).json({ 
        message: `Invalid IRN length (${resolvedIRN.length} chars). Official government IRN must be exactly 64 characters long.` 
      });
    }

    const updateReq = pool.request()
      .input('ID', sql.Numeric(8, 0), id)
      .input('IRN', sql.VarChar(64), resolvedIRN)
      .input('AckNo', sql.VarChar(30), resolvedAckNo || String(Date.now()))
      .input('AckDate', sql.VarChar(30), resolvedAckDate || new Date().toISOString())
      .input('SignedQRCode', sql.NVarChar(sql.MAX), resolvedSignedQR || null)
      .input('SignedInvoice', sql.NVarChar(sql.MAX), resolvedSignedInvoice || null)
      .input('EInvoiceStatus', sql.VarChar(20), 'Generated');

    const result = await updateReq.query(`
      UPDATE OutwardHeader
      SET 
        IRN = @IRN,
        AckNo = @AckNo,
        AckDate = @AckDate,
        SignedQRCode = @SignedQRCode,
        SignedInvoice = @SignedInvoice,
        EInvoiceStatus = @EInvoiceStatus,
        EInvoiceCancelReason = NULL,
        EInvoiceCancelDate = NULL
      WHERE ID = @ID
    `);

    if (result.rowsAffected && result.rowsAffected[0] === 0) {
      return res.status(404).json({ message: 'Invoice not found' });
    }

    res.status(200).json({
      message: 'Government e-Invoice details successfully attached to invoice.',
      irn: resolvedIRN,
      ackNo: resolvedAckNo,
      ackDate: resolvedAckDate,
      einvoiceStatus: 'Generated'
    });
  } catch (error) {
    console.error('Error importing e-Invoice response:', error);
    res.status(500).json({ message: 'Server error importing e-Invoice response', error: error.message });
  }
};

// POST /api/einvoice/cancel/:id
exports.cancelEInvoice = async (req, res) => {
  const { id } = req.params;
  const { cancelReason = 'Data entry mistake', cancelDate } = req.body;

  try {
    const pool = await connectDB();
    const updateReq = pool.request()
      .input('ID', sql.Numeric(8, 0), id)
      .input('EInvoiceStatus', sql.VarChar(20), 'Cancelled')
      .input('EInvoiceCancelReason', sql.VarChar(100), cancelReason)
      .input('EInvoiceCancelDate', sql.VarChar(30), cancelDate || new Date().toISOString());

    const result = await updateReq.query(`
      UPDATE OutwardHeader
      SET 
        EInvoiceStatus = @EInvoiceStatus,
        EInvoiceCancelReason = @EInvoiceCancelReason,
        EInvoiceCancelDate = @EInvoiceCancelDate
      WHERE ID = @ID
    `);

    if (result.rowsAffected && result.rowsAffected[0] === 0) {
      return res.status(404).json({ message: 'Invoice not found' });
    }

    res.status(200).json({
      message: 'e-Invoice status updated to Cancelled.',
      einvoiceStatus: 'Cancelled'
    });
  } catch (error) {
    console.error('Error cancelling e-Invoice:', error);
    res.status(500).json({ message: 'Server error cancelling e-Invoice', error: error.message });
  }
};

// GET /api/einvoice/status/:id
exports.getEInvoiceDetails = async (req, res) => {
  const { id } = req.params;

  try {
    const pool = await connectDB();
    const result = await pool.request()
      .input('ID', sql.Numeric(8, 0), id)
      .query(`
        SELECT 
          h.ID, h.OUTWARDNO, h.OUTWARDDATE, h.TOTALAMOUNT, h.Bill,
          h.IRN, h.AckNo, h.AckDate, h.SignedQRCode, h.EInvoiceStatus,
          h.EInvoiceCancelReason, h.EInvoiceCancelDate,
          l.LedgerName, l.GSTIN AS BuyerGSTIN, l.State AS BuyerState
        FROM OutwardHeader h
        LEFT JOIN LedgerMaster l ON h.LEDGERID = l.Id
        WHERE h.ID = @ID
      `);

    if (result.recordset.length === 0) {
      return res.status(404).json({ message: 'Invoice not found' });
    }

    res.status(200).json(result.recordset[0]);
  } catch (error) {
    console.error('Error fetching e-Invoice details:', error);
    res.status(500).json({ message: 'Server error fetching e-Invoice details', error: error.message });
  }
};

// Helper: Get Settings from DB
async function getSettingsFromDB() {
  const pool = await connectDB();
  const res = await pool.request().query('SELECT * FROM EInvoiceSettings WHERE Id = 1');
  if (res.recordset.length > 0) return res.recordset[0];
  return {
    Id: 1,
    IsEnabled: 1,
    Environment: 'sandbox',
    Gstin: '24AAACF1234K1Z5',
    ClientId: '',
    ClientSecret: '',
    Username: '',
    Password: '',
    BaseUrl: 'https://einv-apisandbox.nic.in/eivital/v1.03'
  };
}

// GET /api/einvoice/settings - Fetch saved NIC API settings
exports.getSettings = async (req, res) => {
  try {
    const settings = await getSettingsFromDB();
    res.status(200).json({
      Id: settings.Id,
      IsEnabled: settings.IsEnabled === 1 || settings.IsEnabled === true,
      Environment: settings.Environment || 'sandbox',
      Gstin: settings.Gstin || '',
      ClientId: settings.ClientId || '',
      ClientSecret: settings.ClientSecret ? '••••••••' : '',
      Username: settings.Username || '',
      Password: settings.Password ? '••••••••' : '',
      BaseUrl: settings.BaseUrl || 'https://einv-apisandbox.nic.in/eivital/v1.03',
      HasPassword: Boolean(settings.Password),
      HasClientSecret: Boolean(settings.ClientSecret),
      UpdatedAt: settings.UpdatedAt
    });
  } catch (error) {
    console.error('Error fetching e-Invoice settings:', error);
    res.status(500).json({ message: 'Error fetching settings', error: error.message });
  }
};

// POST /api/einvoice/settings - Save or update NIC API settings
exports.saveSettings = async (req, res) => {
  const {
    IsEnabled, Environment, Gstin, ClientId, ClientSecret,
    Username, Password, BaseUrl, PublicKeyCert
  } = req.body;

  try {
    const pool = await connectDB();
    const current = await getSettingsFromDB();

    // Preserve existing password / secret if masked placeholder passed
    const finalPassword = (Password && !Password.includes('••') && Password.trim() !== '') ? Password.trim() : current.Password;
    const finalSecret = (ClientSecret && !ClientSecret.includes('••') && ClientSecret.trim() !== '') ? ClientSecret.trim() : current.ClientSecret;
    const finalEnv = Environment || current.Environment || 'sandbox';

    let defaultBaseUrl = 'https://einv-apisandbox.nic.in/eivital/v1.03';
    if (finalEnv === 'production') {
      defaultBaseUrl = 'https://api.einvoice1.gst.gov.in/eivital/v1.03';
    }

    const finalBaseUrl = (BaseUrl && BaseUrl.trim()) ? BaseUrl.trim() : defaultBaseUrl;

    await pool.request()
      .input('IsEnabled', sql.Int, (IsEnabled === false || IsEnabled === 0) ? 0 : 1)
      .input('Environment', sql.VarChar(20), finalEnv)
      .input('Gstin', sql.VarChar(20), (Gstin || '').trim())
      .input('ClientId', sql.VarChar(100), (ClientId || '').trim())
      .input('ClientSecret', sql.VarChar(200), finalSecret || '')
      .input('Username', sql.VarChar(100), (Username || '').trim())
      .input('Password', sql.VarChar(200), finalPassword || '')
      .input('BaseUrl', sql.VarChar(255), finalBaseUrl)
      .input('PublicKeyCert', sql.NVarChar(sql.MAX), PublicKeyCert ? PublicKeyCert.trim() : (current.PublicKeyCert || null))
      .query(`
        UPDATE EInvoiceSettings
        SET 
          IsEnabled = @IsEnabled,
          Environment = @Environment,
          Gstin = @Gstin,
          ClientId = @ClientId,
          ClientSecret = @ClientSecret,
          Username = @Username,
          Password = @Password,
          BaseUrl = @BaseUrl,
          PublicKeyCert = @PublicKeyCert,
          UpdatedAt = CURRENT_TIMESTAMP
        WHERE Id = 1
      `);

    res.status(200).json({
      message: 'e-Invoice settings successfully saved.',
      environment: finalEnv
    });
  } catch (error) {
    console.error('Error saving e-Invoice settings:', error);
    res.status(500).json({ message: 'Error saving settings', error: error.message });
  }
};

// POST /api/einvoice/test-connection - Test credentials against gateway
exports.testConnection = async (req, res) => {
  try {
    const current = await getSettingsFromDB();
    const env = req.body?.Environment || current.Environment || 'sandbox';

    const settingsToTest = {
      ...current,
      Environment: env,
      Gstin: req.body?.Gstin || current.Gstin,
      ClientId: req.body?.ClientId || current.ClientId,
      ClientSecret: (req.body?.ClientSecret && !req.body.ClientSecret.includes('••')) ? req.body.ClientSecret : current.ClientSecret,
      Username: req.body?.Username || current.Username,
      Password: (req.body?.Password && !req.body.Password.includes('••')) ? req.body.Password : current.Password,
      BaseUrl: req.body?.BaseUrl || current.BaseUrl
    };

    const authRes = await nicApiService.authenticate(settingsToTest);
    res.status(200).json({
      success: true,
      message: authRes.message,
      environment: env,
      tokenExpiry: authRes.tokenExpiry
    });
  } catch (error) {
    console.error('Test connection error:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to authenticate with NIC IRP gateway.'
    });
  }
};

// POST /api/einvoice/auto-generate/:id - 1-Click Automated NIC IRP Generation
exports.autoGenerateIRN = async (req, res) => {
  const { id } = req.params;

  try {
    const pool = await connectDB();

    // 1. Fetch Header
    const headerRes = await pool.request()
      .input('ID', sql.Numeric(8, 0), id)
      .query('SELECT * FROM OutwardHeader WHERE ID = @ID');

    if (headerRes.recordset.length === 0) {
      return res.status(404).json({ message: 'Sales Outward invoice not found' });
    }
    const header = headerRes.recordset[0];

    if (header.IRN && header.EInvoiceStatus === 'Generated') {
      return res.status(400).json({
        message: 'e-Invoice is already generated for this invoice.',
        irn: header.IRN
      });
    }

    // 2. Fetch Buyer (LedgerMaster)
    const ledgerRes = await pool.request()
      .input('LedgerID', sql.Numeric(10, 0), header.LEDGERID)
      .query('SELECT * FROM LedgerMaster WHERE Id = @LedgerID');
    const buyer = ledgerRes.recordset[0] || {};

    // 3. Fetch Seller (CompanyProfile)
    const companyRes = await pool.request().query('SELECT TOP 1 * FROM CompanyProfile');
    const seller = companyRes.recordset[0] || {};

    // 4. Fetch Details
    const detailRes = await pool.request()
      .input('OutwardID', sql.Numeric(8, 0), id)
      .query(`
        SELECT d.*, i.ItemName, i.HSNCode 
        FROM OutwardDetail d
        LEFT JOIN ItemMaster i ON d.ITEMCODE = i.ItemCode AND ISNULL(d.SUBCODE, '') = ISNULL(i.SubCode, '')
        WHERE d.OUTWARDID = @OutwardID
      `);
    const details = detailRes.recordset || [];

    if (details.length === 0) {
      return res.status(400).json({ message: 'Invoice has no line items' });
    }

    // 5. Build NIC INV-01 Schema
    const schemaResult = buildNICInvoiceJSON(header, details, seller, buyer);
    if (!schemaResult.isValid && schemaResult.errors.length > 0) {
      return res.status(400).json({
        message: 'Schema validation failed before submission to NIC portal.',
        errors: schemaResult.errors,
        warnings: schemaResult.warnings
      });
    }

    // 6. Get settings
    const settings = await getSettingsFromDB();

    // 7. Call NIC API Service (or simulation engine)
    const nicResult = await nicApiService.generateIRN(schemaResult.einvoiceJSON, settings);

    if (!nicResult || !nicResult.irn) {
      return res.status(502).json({ message: 'NIC IRP did not return a valid IRN hash.' });
    }

    // 8. Update database record
    await pool.request()
      .input('ID', sql.Numeric(8, 0), id)
      .input('IRN', sql.VarChar(64), nicResult.irn)
      .input('AckNo', sql.VarChar(30), String(nicResult.ackNo || ''))
      .input('AckDate', sql.VarChar(30), String(nicResult.ackDt || ''))
      .input('SignedQRCode', sql.NVarChar(sql.MAX), nicResult.signedQRCode || '')
      .input('SignedInvoice', sql.NVarChar(sql.MAX), nicResult.signedInvoice || '')
      .query(`
        UPDATE OutwardHeader
        SET 
          IRN = @IRN,
          AckNo = @AckNo,
          AckDate = @AckDate,
          SignedQRCode = @SignedQRCode,
          SignedInvoice = @SignedInvoice,
          EInvoiceStatus = 'Generated',
          EInvoiceCancelReason = NULL,
          EInvoiceCancelDate = NULL
        WHERE ID = @ID
      `);

    res.status(200).json({
      success: true,
      message: nicResult.isSimulated 
        ? 'e-Invoice generated successfully via Simulation Engine (Official SHA256 & QR).' 
        : 'e-Invoice generated successfully directly from NIC IRP Gateway!',
      irn: nicResult.irn,
      ackNo: nicResult.ackNo,
      ackDate: nicResult.ackDt,
      signedQRCode: nicResult.signedQRCode,
      einvoiceStatus: 'Generated',
      isSimulated: nicResult.isSimulated,
      warnings: schemaResult.warnings
    });
  } catch (error) {
    console.error('Auto e-Invoice generation error:', error);
    res.status(500).json({
      message: error.message || 'Error communicating with NIC e-Invoice Gateway',
      error: error.message
    });
  }
};

// POST /api/einvoice/auto-cancel/:id - 1-Click Automated NIC IRP Cancellation
exports.autoCancelIRN = async (req, res) => {
  const { id } = req.params;
  const { cancelReason, cancelRemarks } = req.body;

  try {
    const pool = await connectDB();
    const result = await pool.request()
      .input('ID', sql.Numeric(8, 0), id)
      .query('SELECT IRN, EInvoiceStatus, OUTWARDNO FROM OutwardHeader WHERE ID = @ID');

    if (result.recordset.length === 0) {
      return res.status(404).json({ message: 'Invoice not found' });
    }

    const invoice = result.recordset[0];
    if (!invoice.IRN) {
      return res.status(400).json({ message: 'Invoice does not have an IRN to cancel.' });
    }

    const settings = await getSettingsFromDB();
    const cancelRes = await nicApiService.cancelIRN(invoice.IRN, cancelReason, cancelRemarks, settings);

    const reasonMap = {
      '1': 'Duplicate Entry',
      '2': 'Data Entry Error',
      '3': 'Order Cancelled',
      '4': 'Others'
    };
    const reasonText = reasonMap[String(cancelReason)] || cancelRemarks || 'Cancelled';

    await pool.request()
      .input('ID', sql.Numeric(8, 0), id)
      .input('Reason', sql.VarChar(100), reasonText)
      .input('CancelDate', sql.VarChar(30), String(cancelRes.cancelDate || new Date().toISOString()))
      .query(`
        UPDATE OutwardHeader
        SET 
          EInvoiceStatus = 'Cancelled',
          EInvoiceCancelReason = @Reason,
          EInvoiceCancelDate = @CancelDate
        WHERE ID = @ID
      `);

    res.status(200).json({
      success: true,
      message: cancelRes.isSimulated
        ? 'e-Invoice cancelled successfully via Simulation Engine.'
        : 'e-Invoice cancelled successfully on NIC IRP Gateway.',
      einvoiceStatus: 'Cancelled',
      cancelDate: cancelRes.cancelDate
    });
  } catch (error) {
    console.error('Auto e-Invoice cancel error:', error);
    res.status(500).json({
      message: error.message || 'Error cancelling e-Invoice with NIC Gateway',
      error: error.message
    });
  }
};

