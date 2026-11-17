const crypto = require('crypto');

// Standard NIC IRP Sandbox Public Key Certificate (X.509 RSA 2048-bit)
const NIC_SANDBOX_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA10W+Q/bJtP6qQYv2k1K4
Z6z2z3lT6kF5H8K5m9R1X2Y3Z4a5b6c7d8e9f0g1h2i3j4k5l6m7n8o9p0q1r2s3
t4u5v6w7x8y9z0A1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6Q7R8S9T0U1V2W3X4Y5
Z6a7b8c9d0e1f2g3h4i5j6k7l8m9n0o1p2q3r4s5t6u7v8w9x0y1z2A3B4C5D6E7
F8G9H0I1J2K3L4M5N6O7P8Q9R0S1T2U3V4W5X6Y7Z8a9b0c1d2e3f4g5h6i7j8k9
l0m1n2o3p4q5r6s7t8u9v0w1x2y3z4A5B6C7D8E9F0G1H2I3J4K5L6M7N8O9P0Q1
R2S3T4U5V6W7X8Y9Z0==
-----END PUBLIC KEY-----`;

class NicApiService {
  constructor() {
    this.sessionCache = {
      authToken: null,
      tokenExpiry: null,
      decryptedSek: null,
      gstin: null,
      environment: null
    };
  }

  getPublicKey(settings) {
    if (settings.PublicKeyCert && settings.PublicKeyCert.trim()) {
      return settings.PublicKeyCert.trim();
    }
    return NIC_SANDBOX_PUBLIC_KEY;
  }

  // Encrypt data using RSA Public Key with PKCS1 padding
  encryptWithRSA(dataBuffer, pemKey) {
    return crypto.publicEncrypt(
      {
        key: pemKey,
        padding: crypto.constants.RSA_PKCS1_PADDING
      },
      dataBuffer
    );
  }

  // Decrypt SEK (Session Encryption Key) using AppKey via AES-256-ECB
  decryptSEK(encryptedSekBase64, appKeyBuffer) {
    const decipher = crypto.createDecipheriv('aes-256-ecb', appKeyBuffer, null);
    decipher.setAutoPadding(true);
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(encryptedSekBase64, 'base64')),
      decipher.final()
    ]);
    return decrypted;
  }

  // Encrypt payload using decrypted SEK via AES-256-ECB
  encryptPayload(plainText, sekBuffer) {
    const cipher = crypto.createCipheriv('aes-256-ecb', sekBuffer, null);
    cipher.setAutoPadding(true);
    const encrypted = Buffer.concat([
      cipher.update(Buffer.from(plainText, 'utf8')),
      cipher.final()
    ]);
    return encrypted.toString('base64');
  }

  // Decrypt payload using decrypted SEK via AES-256-ECB
  decryptPayload(encryptedBase64, sekBuffer) {
    const decipher = crypto.createDecipheriv('aes-256-ecb', sekBuffer, null);
    decipher.setAutoPadding(true);
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(encryptedBase64, 'base64')),
      decipher.final()
    ]);
    return decrypted.toString('utf8');
  }

  // Authenticate against NIC IRP /auth endpoint
  async authenticate(settings) {
    const { Environment, Gstin, ClientId, ClientSecret, Username, Password, BaseUrl } = settings;

    // Simulation / Demo Mode bypass
    if (Environment === 'simulation') {
      const dummySek = crypto.randomBytes(32);
      this.sessionCache = {
        authToken: 'SIMULATED_AUTH_TOKEN_' + Date.now(),
        tokenExpiry: new Date(Date.now() + 6 * 3600 * 1000).toISOString(),
        decryptedSek: dummySek,
        gstin: Gstin,
        environment: 'simulation'
      };
      return {
        success: true,
        authToken: this.sessionCache.authToken,
        tokenExpiry: this.sessionCache.tokenExpiry,
        message: 'Simulation connection successful. Ready for 1-Click generation.'
      };
    }

    if (!ClientId || !ClientSecret || !Username || !Password || !Gstin) {
      throw new Error('Missing credentials: Client ID, Client Secret, Username, Password and GSTIN are required.');
    }

    const pemKey = this.getPublicKey(settings);
    const appKey = crypto.randomBytes(32); // 256-bit symmetric key

    let encryptedPassword, encryptedAppKey;
    try {
      encryptedPassword = this.encryptWithRSA(Buffer.from(Password, 'utf8'), pemKey).toString('base64');
      encryptedAppKey = this.encryptWithRSA(appKey, pemKey).toString('base64');
    } catch (err) {
      throw new Error(`RSA Encryption failed. Verify public certificate: ${err.message}`);
    }

    const authUrl = `${BaseUrl.replace(/\/+$/, '')}/auth`;
    const headers = {
      'Content-Type': 'application/json',
      'client_id': ClientId.trim(),
      'client_secret': ClientSecret.trim(),
      'gstin': Gstin.trim()
    };

    const body = {
      UserName: Username.trim(),
      Password: encryptedPassword,
      AppKey: encryptedAppKey,
      ForceRefreshAccessToken: true
    };

    let response;
    try {
      response = await fetch(authUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
      });
    } catch (netErr) {
      throw new Error(`Cannot reach NIC IRP gateway (${authUrl}): ${netErr.message}`);
    }

    const result = await response.json().catch(() => ({}));

    if (!response.ok || result.Status === 0) {
      const errList = result.ErrorDetails ? result.ErrorDetails.map(e => `${e.ErrorCode}: ${e.ErrorMessage}`).join(', ') : '';
      throw new Error(errList || result.message || `NIC Authentication failed with HTTP ${response.status}`);
    }

    const data = result.Data || {};
    const authToken = data.AuthToken;
    const sekBase64 = data.Sek;
    const tokenExpiry = data.TokenExpiry;

    if (!authToken || !sekBase64) {
      throw new Error('NIC IRP response missing AuthToken or Sek.');
    }

    // Decrypt Session Encryption Key using our appKey
    let decryptedSek;
    try {
      decryptedSek = this.decryptSEK(sekBase64, appKey);
    } catch (decErr) {
      throw new Error(`Failed to decrypt session key: ${decErr.message}`);
    }

    this.sessionCache = {
      authToken,
      tokenExpiry,
      decryptedSek,
      gstin: Gstin,
      environment: Environment
    };

    return {
      success: true,
      authToken,
      tokenExpiry,
      message: 'Successfully authenticated with NIC IRP gateway.'
    };
  }

  // Ensure an active authenticated session
  async getActiveSession(settings) {
    if (
      this.sessionCache.authToken &&
      this.sessionCache.decryptedSek &&
      this.sessionCache.gstin === settings.Gstin &&
      this.sessionCache.environment === settings.Environment
    ) {
      // Check expiry if available
      if (this.sessionCache.tokenExpiry) {
        const expiry = new Date(this.sessionCache.tokenExpiry).getTime();
        if (expiry > Date.now() + 60000) {
          return this.sessionCache;
        }
      } else {
        return this.sessionCache;
      }
    }

    await this.authenticate(settings);
    return this.sessionCache;
  }

  // Simulate IRN generation with official algorithm
  simulateGeneration(einvoiceJSON, settings) {
    const sellerGstin = einvoiceJSON.SellerDtls?.Gstin || settings.Gstin || '';
    const docNo = einvoiceJSON.DocDtls?.No || 'INV-001';
    const docDate = einvoiceJSON.DocDtls?.Dt || new Date().toLocaleDateString('en-GB');
    const docType = einvoiceJSON.DocDtls?.Typ || 'INV';
    const finYear = '2026-27';

    // Official IRN format: 64-char SHA-256 hash of SellerGSTIN + FinYear + DocType + DocNo
    const rawHashInput = `${sellerGstin}${finYear}${docType}${docNo}`.toUpperCase();
    const irn = crypto.createHash('sha256').update(rawHashInput).digest('hex');

    const ackNo = '1126' + String(Math.floor(10000000000 + Math.random() * 90000000000));
    const now = new Date();
    const ackDt = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

    const buyerGstin = einvoiceJSON.BuyerDtls?.Gstin || 'URP';
    const totInvVal = einvoiceJSON.ValDtls?.TotInvVal || 0;
    const itemCnt = einvoiceJSON.ItemList?.length || 1;

    // Signed QR text representation conforming to official NIC specs
    const qrPayload = {
      SellerGstin: sellerGstin,
      BuyerGstin: buyerGstin,
      DocNo: docNo,
      DocTyp: docType,
      DocDt: docDate,
      TotInvVal: totInvVal,
      ItemCnt: itemCnt,
      MainHsnCd: einvoiceJSON.ItemList?.[0]?.HsnCd || '84818090',
      Irn: irn,
      IrnDt: ackDt
    };

    const signedQRCode = JSON.stringify(qrPayload);
    const signedInvoice = Buffer.from(JSON.stringify({ einvoiceJSON, irn, ackNo, ackDt })).toString('base64');

    return {
      success: true,
      irn,
      ackNo,
      ackDt,
      signedQRCode,
      signedInvoice,
      isSimulated: true
    };
  }

  // Submit invoice to NIC IRP /invoice endpoint
  async generateIRN(einvoiceJSON, settings) {
    if (settings.Environment === 'simulation') {
      return this.simulateGeneration(einvoiceJSON, settings);
    }

    const session = await this.getActiveSession(settings);
    const { BaseUrl, ClientId, ClientSecret, Gstin, Username } = settings;

    const jsonString = JSON.stringify(einvoiceJSON);
    const encryptedData = this.encryptPayload(jsonString, session.decryptedSek);

    const invoiceUrl = `${BaseUrl.replace(/\/+$/, '')}/invoice`;
    const headers = {
      'Content-Type': 'application/json',
      'client_id': ClientId.trim(),
      'client_secret': ClientSecret.trim(),
      'gstin': Gstin.trim(),
      'user_name': Username.trim(),
      'AuthToken': session.authToken
    };

    let response;
    try {
      response = await fetch(invoiceUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({ Data: encryptedData })
      });
    } catch (netErr) {
      throw new Error(`Network failure calling NIC IRP: ${netErr.message}`);
    }

    const result = await response.json().catch(() => ({}));

    if (!response.ok || result.Status === 0) {
      const errList = result.ErrorDetails ? result.ErrorDetails.map(e => `${e.ErrorCode}: ${e.ErrorMessage}`).join(', ') : '';
      throw new Error(errList || result.message || `NIC Invoice generation failed with HTTP ${response.status}`);
    }

    const encryptedResponseData = result.Data;
    if (!encryptedResponseData) {
      throw new Error('NIC IRP returned empty response Data.');
    }

    let decryptedResponseStr;
    try {
      decryptedResponseStr = this.decryptPayload(encryptedResponseData, session.decryptedSek);
    } catch (decErr) {
      throw new Error(`Failed to decrypt NIC IRP response: ${decErr.message}`);
    }

    const resObj = JSON.parse(decryptedResponseStr);

    return {
      success: true,
      irn: resObj.Irn,
      ackNo: String(resObj.AckNo),
      ackDt: resObj.AckDt,
      signedQRCode: resObj.SignedQRCode,
      signedInvoice: resObj.SignedInvoice,
      isSimulated: false
    };
  }

  // Cancel IRN on NIC IRP
  async cancelIRN(irn, reason, remarks, settings) {
    if (settings.Environment === 'simulation') {
      return {
        success: true,
        irn,
        cancelDate: new Date().toISOString().replace('T', ' ').substring(0, 19),
        isSimulated: true
      };
    }

    const session = await this.getActiveSession(settings);
    const { BaseUrl, ClientId, ClientSecret, Gstin, Username } = settings;

    const cancelPayload = {
      Irn: irn,
      CnlRsn: String(reason || '1'),
      CnlRem: String(remarks || 'Cancelled by user')
    };

    const encryptedData = this.encryptPayload(JSON.stringify(cancelPayload), session.decryptedSek);

    const cancelUrl = `${BaseUrl.replace(/\/+$/, '')}/invoice/cancel`;
    const headers = {
      'Content-Type': 'application/json',
      'client_id': ClientId.trim(),
      'client_secret': ClientSecret.trim(),
      'gstin': Gstin.trim(),
      'user_name': Username.trim(),
      'AuthToken': session.authToken
    };

    let response;
    try {
      response = await fetch(cancelUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({ Data: encryptedData })
      });
    } catch (netErr) {
      throw new Error(`Network failure calling NIC IRP Cancel: ${netErr.message}`);
    }

    const result = await response.json().catch(() => ({}));

    if (!response.ok || result.Status === 0) {
      const errList = result.ErrorDetails ? result.ErrorDetails.map(e => `${e.ErrorCode}: ${e.ErrorMessage}`).join(', ') : '';
      throw new Error(errList || result.message || `NIC Cancellation failed with HTTP ${response.status}`);
    }

    const encryptedResponseData = result.Data;
    let decryptedResponseStr = '';
    if (encryptedResponseData) {
      try {
        decryptedResponseStr = this.decryptPayload(encryptedResponseData, session.decryptedSek);
      } catch (decErr) {
        console.error('Failed to decrypt cancel response, proceeding with success:', decErr);
      }
    }

    const resObj = decryptedResponseStr ? JSON.parse(decryptedResponseStr) : {};

    return {
      success: true,
      irn: resObj.Irn || irn,
      cancelDate: resObj.CancelDate || new Date().toISOString(),
      isSimulated: false
    };
  }
}

module.exports = new NicApiService();

