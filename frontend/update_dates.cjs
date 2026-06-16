const fs = require('fs');
const path = require('path');

const dir = 'e:/FactoryFlow/frontend/src/pages/reports';
const files = [
  'InwardReport.jsx',
  'OutwardReport.jsx',
  'JobworkInReport.jsx',
  'JobworkOutReport.jsx',
  'StockJournalReport.jsx',
  'AssemblyReport.jsx',
  'InvoiceWisePayableReport.jsx',
  'InvoiceWiseReceivableReport.jsx'
];

files.forEach(file => {
  const filePath = path.join(dir, file);
  if (!fs.existsSync(filePath)) return;
  let content = fs.readFileSync(filePath, 'utf8');

  // Add DatePicker import if not exists
  if (!content.includes("import DatePicker from 'react-datepicker'")) {
    content = content.replace(
      "import * as XLSX from 'xlsx';",
      "import * as XLSX from 'xlsx';\nimport DatePicker from 'react-datepicker';\nimport 'react-datepicker/dist/react-datepicker.css';"
    );
  }

  // Replace getFirstDayOfMonth for the ones that have strings
  content = content.replace(
    /return new Date\(date\.getFullYear\(\), date\.getMonth\(\), 1\)\.toISOString\(\)\.split\('T'\)\[0\];/g,
    "return new Date(date.getFullYear(), date.getMonth(), 1);"
  );
  content = content.replace(
    /return new Date\(date\.getFullYear\(\), date\.getMonth\(\) \+ 1, 0\)\.toISOString\(\)\.split\('T'\)\[0\];/g,
    "return new Date(date.getFullYear(), date.getMonth() + 1, 0);"
  );

  // Replace state
  content = content.replace(
    /const \[fromDate, setFromDate\] = useState\(getFirstDayOfMonth\(\)\);\n\s*const \[toDate, setToDate\] = useState\(getLastDayOfMonth\(\)\);/g,
    "const [dateRange, setDateRange] = useState([getFirstDayOfMonth(), getLastDayOfMonth()]);\n  const [startDate, endDate] = dateRange;"
  );

  // Replace UI
  content = content.replace(
    /<TextField\s*label="From Date"\s*type="date"\s*value=\{fromDate\}\s*onChange=\{\(e\) => setFromDate\(e\.target\.value\)\}\s*size="small"\s*InputLabelProps=\{\{ shrink: true \}\}\s*\/>\s*<TextField\s*label="To Date"\s*type="date"\s*value=\{toDate\}\s*onChange=\{\(e\) => setToDate\(e\.target\.value\)\}\s*size="small"\s*InputLabelProps=\{\{ shrink: true \}\}\s*\/>/g,
    `<Box sx={{ width: 250 }}>
            <DatePicker
              selectsRange={true}
              startDate={startDate}
              endDate={endDate}
              onChange={(update) => setDateRange(update)}
              isClearable={true}
              customInput={<TextField size="small" label="Date Range" InputLabelProps={{ shrink: true }} fullWidth />}
              dateFormat="dd/MM/yyyy"
            />
          </Box>`
  );

  // Replace filtering logic
  content = content.replace(
    /const rowDate = new Date\(row\.(\w+)\)\.toISOString\(\)\.split\('T'\)\[0\];\s*const isAfterFrom = fromDate \? rowDate >= fromDate : true;\s*const isBeforeTo = toDate \? rowDate <= toDate : true;\s*return isAfterFrom && isBeforeTo;/g,
    `const rowDate = new Date(row.$1);
              rowDate.setHours(0,0,0,0);
              const start = startDate ? new Date(startDate).setHours(0,0,0,0) : null;
              const end = endDate ? new Date(endDate).setHours(23,59,59,999) : null;
              
              const isAfterFrom = start ? rowDate.getTime() >= start : true;
              const isBeforeTo = end ? rowDate.getTime() <= end : true;
              return isAfterFrom && isBeforeTo;`
  );

  fs.writeFileSync(filePath, content);
  console.log(`Updated ${file}`);
});
