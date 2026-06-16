const fs = require('fs');
const path = require('path');

const reportsDir = 'e:/FactoryFlow/frontend/src/pages/reports';
const files = fs.readdirSync(reportsDir).filter(f => f.endsWith('.jsx'));

files.forEach(file => {
  const filePath = path.join(reportsDir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  let originalContent = content;

  // Make sure localUser is defined before doc.text is called.
  // The easiest way is to add it inside the component or inside the function where doc.text is called.
  // Actually, let's just globally ensure localUser exists in the component scope if it doesn't already.
  if (!content.includes('const localUser = JSON.parse(')) {
    // Insert after component declaration
    content = content.replace(
      /(const \w+Report = \(\) => {)/,
      "$1\n  const localUser = JSON.parse(localStorage.getItem('user') || sessionStorage.getItem('user')) || {};"
    );
  }

  // Replace doc.text('FactoryFlow ERP', 14, 22);
  content = content.replace(
    /doc\.text\('FactoryFlow ERP',\s*14,\s*22\);/g,
    "doc.text(localUser.companyName || 'FactoryFlow', 14, 22);"
  );

  // Replace ['FactoryFlow ERP - Profit & Loss Statement']
  content = content.replace(
    /\['FactoryFlow ERP( - [^']+)'\]/g,
    "[`${localUser.companyName || 'FactoryFlow'}$1`]"
  );
  
  // Replace in other string contexts if any
  content = content.replace(
    /'FactoryFlow ERP/g,
    "`${localUser.companyName || 'FactoryFlow'}"
  );

  if (content !== originalContent) {
    fs.writeFileSync(filePath, content);
    console.log(`Updated ${file}`);
  }
});

// Update DashboardLayout if needed
const dlPath = 'e:/FactoryFlow/frontend/src/components/layout/DashboardLayout.jsx';
if (fs.existsSync(dlPath)) {
  let dlContent = fs.readFileSync(dlPath, 'utf8');
  if (dlContent.includes("companyName: 'FactoryFlow ERP'")) {
    dlContent = dlContent.replace("companyName: 'FactoryFlow ERP'", "companyName: user.companyName || 'FactoryFlow'");
    fs.writeFileSync(dlPath, dlContent);
    console.log("Updated DashboardLayout.jsx");
  }
}
