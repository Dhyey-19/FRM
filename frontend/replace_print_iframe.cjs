const fs = require('fs');
const path = require('path');

const pagesDir = 'e:/FactoryFlow/frontend/src/pages';
const filesToProcess = [
  'InwardEntry.jsx',
  'OutwardEntry.jsx',
  'JobworkInEntry.jsx',
  'JobworkOutEntry.jsx',
  'VoucherEntry.jsx',
  'StockTransfer.jsx',
  'StockJournal.jsx'
];

filesToProcess.forEach(file => {
  const filePath = path.join(pagesDir, file);
  if (!fs.existsSync(filePath)) {
    console.log(`File not found: ${file}`);
    return;
  }
  
  let content = fs.readFileSync(filePath, 'utf8');
  let originalContent = content;

  // 1. Add Import
  if (!content.includes("PdfPreviewModal")) {
    content = content.replace(
      /(import .* from '@mui\/material';\r?\n)/,
      "$1import PdfPreviewModal from '../components/common/PdfPreviewModal';\n"
    );
  }

  // 2. Add State
  const componentNameMatch = content.match(/const (\w+) = \(\) => \{/);
  if (componentNameMatch && !content.includes("const [previewOpen, setPreviewOpen]")) {
    const componentName = componentNameMatch[1];
    content = content.replace(
      new RegExp(`const ${componentName} = \\(\\) => \\{\\r?\\n`),
      `const ${componentName} = () => {\n  const [previewOpen, setPreviewOpen] = useState(false);\n  const [previewUrl, setPreviewUrl] = useState('');\n`
    );
  }

  // 3. Replace iframe logic
  const iframeRegex = /\/\/\s*Use iframe for printing[\s\S]*?\}, 200\);\r?\n\s*\};\r?\n/g;
  if (content.match(iframeRegex)) {
    content = content.replace(iframeRegex, 
      `    const blob = doc.output('blob');\n    const url = URL.createObjectURL(blob);\n    setPreviewUrl(url);\n    setPreviewOpen(true);\n`
    );
  } else {
    // If exact regex fails, let's try a broader one
    const broaderRegex = /const blob = doc\.output\('blob'\);[\s\S]*?document\.body\.appendChild\(iframe\);[\s\S]*?\}, 200\);\r?\n\s*\};\r?\n/g;
    content = content.replace(broaderRegex, 
      `const blob = doc.output('blob');\n    const url = URL.createObjectURL(blob);\n    setPreviewUrl(url);\n    setPreviewOpen(true);\n`
    );
  }

  // 4. Add Component at the end
  if (!content.includes("<PdfPreviewModal")) {
    content = content.replace(
      /(\s*)<\/Box>\r?\n\s*\);\r?\n\};\r?\n\r?\nexport default/g,
      `$1  <PdfPreviewModal open={previewOpen} onClose={() => setPreviewOpen(false)} pdfUrl={previewUrl} title="Document Preview" />\n$1</Box>\n  );\n};\n\nexport default`
    );
  }

  if (content !== originalContent) {
    fs.writeFileSync(filePath, content);
    console.log(`Updated ${file}`);
  } else {
    console.log(`No changes made to ${file}. Maybe already updated or regex failed.`);
  }
});
