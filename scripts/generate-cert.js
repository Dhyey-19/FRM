const fs = require('fs');
const path = require('path');
const os = require('os');
const selfsigned = require('selfsigned');

async function generateLocalCert() {
  const certsDir = path.join(__dirname, '../backend/certs');
  if (!fs.existsSync(certsDir)) {
    fs.mkdirSync(certsDir, { recursive: true });
  }

  // Collect all local IPv4 addresses
  const interfaces = os.networkInterfaces();
  const altNames = [
    { type: 2, value: 'localhost' },
    { type: 7, ip: '127.0.0.1' }
  ];

  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        altNames.push({ type: 7, ip: iface.address });
      }
    }
  }

  console.log('[CertGen] Generating self-signed SSL certificate with SANs:', altNames);

  const attrs = [{ name: 'commonName', value: 'FRM Local Server' }];
  const pems = await selfsigned.generate(attrs, {
    keySize: 2048,
    days: 3650, // 10 years validity
    algorithm: 'sha256',
    extensions: [
      {
        name: 'basicConstraints',
        cA: true
      },
      {
        name: 'subjectAltName',
        altNames
      }
    ]
  });

  fs.writeFileSync(path.join(certsDir, 'key.pem'), pems.private);
  fs.writeFileSync(path.join(certsDir, 'cert.pem'), pems.cert);

  console.log('[CertGen] SSL Certificates generated successfully in backend/certs/');
  console.log(' - Key:  ' + path.join(certsDir, 'key.pem'));
  console.log(' - Cert: ' + path.join(certsDir, 'cert.pem'));
}

if (require.main === module) {
  generateLocalCert()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = { generateLocalCert };
