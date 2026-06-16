const fs = require('fs');
const path = require('path');

const reportsDir = 'e:/FactoryFlow/frontend/src/pages/reports';
const sidebarPath = 'e:/FactoryFlow/frontend/src/components/layout/Sidebar.jsx';

// 1. Update Sidebar
let sidebarContent = fs.readFileSync(sidebarPath, 'utf8');
sidebarContent = sidebarContent.replace(/primary="([^"]*?) Report"/g, 'primary="$1"');
fs.writeFileSync(sidebarPath, sidebarContent);
console.log('Sidebar updated');

// 2. Update all report files
const files = fs.readdirSync(reportsDir).filter(f => f.endsWith('.jsx'));

files.forEach(file => {
  const filePath = path.join(reportsDir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  let originalContent = content;

  // We want to replace `<Typography variant="h4" ...> Something Report </Typography>`
  content = content.replace(/(<Typography variant="h4"[^>]*>\s*)([\s\S]*?)( Report)(\s*<\/Typography>)/g, (match, p1, p2, p3, p4) => {
    if (p2.includes('<')) return match; // prevent massive spanning
    return p1 + p2 + p4;
  });

  if (content !== originalContent) {
    fs.writeFileSync(filePath, content);
    console.log(`Updated ${file}`);
  }
});
