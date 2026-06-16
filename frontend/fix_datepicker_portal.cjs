const fs = require('fs');
const path = require('path');

const reportsDir = 'e:/FactoryFlow/frontend/src/pages/reports';
const files = fs.readdirSync(reportsDir).filter(f => f.endsWith('.jsx'));

files.forEach(file => {
  const filePath = path.join(reportsDir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  let originalContent = content;

  // Add portalId="root" if it doesn't already exist
  if (!content.includes('portalId="root"')) {
    content = content.replace(
      /<DatePicker\s+selectsRange=\{true\}/g,
      '<DatePicker\n              portalId="root"\n              selectsRange={true}'
    );
  }

  if (content !== originalContent) {
    fs.writeFileSync(filePath, content);
    console.log(`Updated ${file}`);
  }
});
