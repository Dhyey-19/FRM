const { PDFParse } = require('pdf-parse');

/**
 * Parses time string "HH:MM" into decimal hours (e.g., "10:30" => 10.5).
 * Returns 0 if invalid or empty.
 */
function parseTimeToDecimal(timeStr) {
  if (!timeStr || timeStr === '-' || timeStr === '--') return 0;
  const parts = String(timeStr).trim().split(':');
  if (parts.length < 2) return 0;
  const h = parseFloat(parts[0]) || 0;
  const m = parseFloat(parts[1]) || 0;
  return parseFloat((h + m / 60).toFixed(2));
}

/**
 * Formats decimal hours back into "HH:MM".
 */
function formatDecimalToTime(decimalHours) {
  if (decimalHours === null || decimalHours === undefined || isNaN(decimalHours)) return '00:00';
  const totalMinutes = Math.round(decimalHours * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

const MONTH_MAP = {
  'JANUARY': '01', 'FEBRUARY': '02', 'MARCH': '03', 'APRIL': '04',
  'MAY': '05', 'JUNE': '06', 'JULY': '07', 'AUGUST': '08',
  'SEPTEMBER': '09', 'OCTOBER': '10', 'NOVEMBER': '11', 'DECEMBER': '12'
};

/**
 * Parses a Biometric Machine Monthly Attendance Log PDF.
 * Handles single or multi-page employee logs.
 *
 * @param {Buffer|Uint8Array} pdfBuffer
 * @returns {Promise<{ organization: string, monthName: string, monthYear: string, totalDaysInMonth: number, employees: Array }>}
 */
async function parseMonthlyAttendancePdf(pdfBuffer) {
  const parser = new PDFParse(new Uint8Array(pdfBuffer));
  const parsedData = await parser.getText();

  if (!parsedData || !parsedData.pages || parsedData.pages.length === 0) {
    throw new Error('Unable to extract text from the biometric attendance PDF file.');
  }

  let organization = 'BHAGWATI BRASS PRODUCT';
  let monthName = 'OCTOBER-2026';
  let monthYear = '2026-10';
  let totalDaysInMonth = 31;

  // Detect Month & Organization from first page
  const firstPageText = parsedData.pages[0].text;
  const orgMatch = firstPageText.match(/^([^\n]+?)\s+Page\s+\d+/m);
  if (orgMatch && orgMatch[1]) {
    organization = orgMatch[1].trim();
  }

  const monthMatch = firstPageText.match(/Monthly Log For\s+([A-Z]+)[ -](\d{4})/i);
  if (monthMatch) {
    const rawMonth = monthMatch[1].toUpperCase();
    const rawYear = monthMatch[2];
    monthName = `${rawMonth}-${rawYear}`;
    const mNum = MONTH_MAP[rawMonth] || '10';
    monthYear = `${rawYear}-${mNum}`;
  }

  // Days in month calculation from monthYear
  const [yStr, mStr] = monthYear.split('-');
  const numYear = parseInt(yStr, 10);
  const numMonth = parseInt(mStr, 10);
  totalDaysInMonth = new Date(numYear, numMonth, 0).getDate();

  const employees = [];

  for (let pageIdx = 0; pageIdx < parsedData.pages.length; pageIdx++) {
    const page = parsedData.pages[pageIdx];
    const lines = page.text.split('\n').map(l => l.trim()).filter(Boolean);

    // 1. Locate the summary user data row
    let userLine = '';
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('Day Count : PR') || lines[i].includes('Day Count')) {
        userLine = lines[i + 1] === organization ? lines[i + 2] : lines[i + 1];
        break;
      }
    }

    if (!userLine) continue;

    const parts = userLine.split('\t');
    // Tab parts layout based on machine format:
    // parts[0]: "{Sr} 0"
    // parts[1]: "0"
    // parts[2]: "{BiometricCode} 0.0"
    // parts[3]: "0.0 0"
    // parts[4]: "{WO}"
    // parts[5]: "{AB}"
    // parts[6]: "{PR}"
    // parts[7]: "{Designation}"
    // parts[8]: "{Department}"
    // parts[9]: "{EmployeeName} 0.0"
    const biometricCode = parts[2] ? parts[2].split(' ')[0].trim() : String(pageIdx + 1).padStart(4, '0');
    const weekOffDays = parseFloat(parts[4]) || 0;
    const absentDays = parseFloat(parts[5]) || 0;
    const presentDays = parseFloat(parts[6]) || 0;
    const designation = parts[7] ? parts[7].trim() : 'Operator';
    const department = parts[8] ? parts[8].trim() : 'LABOUR';
    let employeeName = parts[9] ? parts[9].replace(/\s+\d+(\.\d+)?$/, '').trim() : `Employee ${biometricCode}`;

    // 2. Locate Total Hours line (comes right after "Hours Hours Hours..." header, before "Legend:")
    let grossHoursStr = '00:00';
    let breakHoursStr = '00:00';
    const totalLineIdx = lines.findIndex(l => l.startsWith('Total') || l.includes('Gross Break Net-Work'));
    if (totalLineIdx !== -1) {
      for (let j = totalLineIdx; j < lines.length; j++) {
        if (/^\d{2,3}:\d{2}/.test(lines[j])) {
          const tParts = lines[j].split(/\s+/);
          grossHoursStr = tParts[0] || '00:00';
          breakHoursStr = tParts[1] || '00:00';
          break;
        }
      }
    }

    const grossHoursDecimal = parseTimeToDecimal(grossHoursStr);
    const breakHoursDecimal = parseTimeToDecimal(breakHoursStr);
    const netWorkHoursDecimal = Math.max(0, parseFloat((grossHoursDecimal - breakHoursDecimal).toFixed(2)));

    // 3. Extract Day-by-Day punches
    const shiftList = lines.find(l => l.startsWith('Shift '))?.replace(/^Shift\s+/, '').split(/\s+/) || [];
    const firstInList = lines.find(l => l.startsWith('First IN'))?.replace(/^First\s+IN\s+/, '').split(/\s+/) || [];
    const lastOutList = lines.find(l => l.startsWith('Last OUT'))?.replace(/^Last\s+OUT\s+/, '').split(/\s+/) || [];
    const grossList = lines.find(l => l.startsWith('Gross '))?.replace(/^Gross\s+/, '').split(/\s+/) || [];
    const breakList = lines.find(l => l.startsWith('Break '))?.replace(/^Break\s+/, '').split(/\s+/) || [];
    const h1List = lines.find(l => l.startsWith('1st Half'))?.replace(/^1st\s+Half\s+/, '').split(/\s+/) || [];
    const h2List = lines.find(l => l.startsWith('2nd Half'))?.replace(/^2nd\s+Half\s+/, '').split(/\s+/) || [];

    const dailyLogs = [];
    let halfDaysCount = 0;

    for (let dayNum = 1; dayNum <= totalDaysInMonth; dayNum++) {
      const idx = dayNum - 1;
      const dateObj = new Date(numYear, numMonth - 1, dayNum);
      const dayOfWeek = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
      const dateStr = `${numYear}-${String(numMonth).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;

      const shift = shiftList[idx] || 'GS';
      const firstIn = (firstInList[idx] && firstInList[idx] !== '-' && firstInList[idx] !== '--') ? firstInList[idx] : null;
      const lastOut = (lastOutList[idx] && lastOutList[idx] !== '-' && lastOutList[idx] !== '--') ? lastOutList[idx] : null;
      const dayGrossStr = (grossList[idx] && grossList[idx] !== '-' && grossList[idx] !== '--') ? grossList[idx] : '00:00';
      const dayBreakStr = (breakList[idx] && breakList[idx] !== '-' && breakList[idx] !== '--') ? breakList[idx] : '00:00';
      const dayGrossDecimal = parseTimeToDecimal(dayGrossStr);
      const dayBreakDecimal = parseTimeToDecimal(dayBreakStr);
      const dayNetDecimal = Math.max(0, parseFloat((dayGrossDecimal - dayBreakDecimal).toFixed(2)));

      const firstHalfStatus = h1List[idx] || '-';
      const secondHalfStatus = h2List[idx] || '-';

      // Determine final status for this day
      let finalStatus = 'A';
      if (firstHalfStatus === 'WO' && secondHalfStatus === 'WO') {
        finalStatus = 'WO';
      } else if (
        (firstHalfStatus === 'PR' || firstHalfStatus === 'IN') &&
        (secondHalfStatus === 'PR' || secondHalfStatus === 'IN')
      ) {
        finalStatus = 'P';
      } else if (firstHalfStatus === 'AB' && secondHalfStatus === 'AB') {
        finalStatus = 'A';
      } else if (
        ((firstHalfStatus === 'PR' || firstHalfStatus === 'IN') && secondHalfStatus === 'AB') ||
        (firstHalfStatus === 'AB' && (secondHalfStatus === 'PR' || secondHalfStatus === 'IN'))
      ) {
        finalStatus = 'HD';
        halfDaysCount += 1;
      } else if (firstHalfStatus === 'PH' || secondHalfStatus === 'PH') {
        finalStatus = 'PH';
      } else if (firstHalfStatus === 'PR' || secondHalfStatus === 'PR' || firstIn || dayGrossDecimal > 0) {
        finalStatus = 'P';
      } else if (dayOfWeek === 'Sun') {
        finalStatus = 'WO';
      } else {
        finalStatus = firstHalfStatus !== '-' ? firstHalfStatus : 'A';
      }

      dailyLogs.push({
        dayNumber: dayNum,
        attendanceDate: dateStr,
        dayOfWeek,
        shift,
        firstIn,
        lastOut,
        grossHours: dayGrossStr,
        grossHoursDecimal: dayGrossDecimal,
        breakHours: dayBreakStr,
        netHoursDecimal: dayNetDecimal,
        firstHalfStatus,
        secondHalfStatus,
        finalStatus
      });
    }

    employees.push({
      biometricCode,
      employeeName,
      department,
      designation,
      presentDays,
      absentDays,
      halfDays: halfDaysCount,
      weekOffDays,
      publicHolidays: 0,
      paidLeaveDays: 0,
      unpaidLeaveDays: 0,
      totalGrossHours: grossHoursStr,
      totalGrossHoursDecimal: grossHoursDecimal,
      totalBreakHours: breakHoursStr,
      totalBreakHoursDecimal: breakHoursDecimal,
      totalNetWorkHoursDecimal: netWorkHoursDecimal,
      dailyLogs
    });
  }

  return {
    organization,
    monthName,
    monthYear,
    totalDaysInMonth,
    employees
  };
}

module.exports = {
  parseMonthlyAttendancePdf,
  parseTimeToDecimal,
  formatDecimalToTime
};

