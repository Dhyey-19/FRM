import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

const getQRBase64 = async (upiUrl) => {
  try {
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(upiUrl)}`;
    const res = await fetch(qrUrl);
    const blob = await res.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.readAsDataURL(blob);
    });
  } catch (err) {
    console.error('Error fetching QR image:', err);
    return null;
  }
};

/**
 * Generate standard invoice PDF for Inward (Purchase) or Outward (Sales)
 * @param {'outward' | 'inward' | 'sales' | 'purchase'} type 
 * @param {Object} invoice - Inward or Outward record with Details
 * @param {Object} ledgerObj - Customer or Vendor Ledger object
 * @param {Object} companyProfile - FactoryFlow Company Profile
 * @param {Array} items - Items array from ItemMaster
 * @returns {Promise<{ blobUrl: string, fileName: string }>}
 */
export const generateInvoicePDF = async (type, invoice, ledgerObj = {}, companyProfile = null, items = []) => {
  const isSales = type === 'outward' || type === 'sales';
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const compName = companyProfile ? companyProfile.CompanyName : 'FACTORY FLOW ERP';

  if (isSales) {
    // --- SALES INVOICE ---
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 59, 102);
    doc.text(compName, 14, 20);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100);
    
    let currentHeaderY = 25;
    if (companyProfile) {
      const addr = [companyProfile.Address1, companyProfile.Address2].filter(Boolean).join(', ');
      const cityDetails = [companyProfile.City, companyProfile.StateName, companyProfile.Pincode].filter(Boolean).join(', ');
      
      if (addr) {
        doc.text(addr, 14, currentHeaderY);
        currentHeaderY += 4;
      }
      if (cityDetails) {
        doc.text(cityDetails, 14, currentHeaderY);
        currentHeaderY += 4;
      }
      
      const taxDetails = [];
      if (companyProfile.GSTIN) taxDetails.push(`GSTIN: ${companyProfile.GSTIN}`);
      if (companyProfile.PANNo) taxDetails.push(`PAN: ${companyProfile.PANNo}`);
      if (companyProfile.MobileNo) taxDetails.push(`Phone: ${companyProfile.MobileNo}`);
      
      if (taxDetails.length > 0) {
        doc.text(taxDetails.join(' | '), 14, currentHeaderY);
        currentHeaderY += 4;
      }
    } else {
      doc.text('Factory Site Address, City, State, ZIP', 14, 25);
      doc.text('GSTIN: 27AAAAA0000A1Z5 | Phone: +91 9876543210', 14, 29);
      currentHeaderY = 33;
    }

    // Title
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 59, 102);
    doc.text('SALES INVOICE', 196, 20, { align: 'right' });

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(50);
    doc.text(`Invoice No: ${invoice.OUTWARDNO || invoice.OutwardNO || invoice.Remark || ''}`, 196, 25, { align: 'right' });
    
    const dateVal = invoice.OUTWARDDATE || invoice.OutwardDATE || invoice.VoucherDate || new Date();
    const formattedDate = new Date(dateVal).toLocaleDateString('en-GB'); // DD/MM/YYYY
    doc.text(`Date: ${formattedDate}`, 196, 29, { align: 'right' });

    const dividerY = Math.max(currentHeaderY + 2, 33);
    doc.setDrawColor(15, 59, 102);
    doc.setLineWidth(0.5);
    doc.line(14, dividerY, 196, dividerY);

    // Customer Details
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 59, 102);
    doc.text('BILL TO', 14, dividerY + 7);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0);
    doc.text(ledgerObj.LedgerName || 'Walk-in Customer', 14, dividerY + 12);
    
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80);
    let currentY = dividerY + 16;
    if (ledgerObj.Address) {
      doc.text(ledgerObj.Address, 14, currentY);
      currentY += 4;
    }
    const location = [ledgerObj.City, ledgerObj.State].filter(Boolean).join(', ');
    if (location) {
      doc.text(location, 14, currentY);
      currentY += 4;
    }
    if (ledgerObj.GSTIN) {
      doc.text(`GSTIN: ${ledgerObj.GSTIN}`, 14, currentY);
      currentY += 4;
    }
    if (ledgerObj.MobileNo) {
      doc.text(`Mobile: ${ledgerObj.MobileNo}`, 14, currentY);
      currentY += 4;
    }

    const tableStartY = Math.max(currentY + 5, dividerY + 35);
    const tableColumn = ["Sr.", "Item Code & Name", "Gross Wt", "Net Wt", "Qty", "Unit", "Rate", "Discount", "Amount"];
    const detailsSource = invoice.Details || [];
    
    const tableRows = detailsSource.map((d, index) => {
      const itemName = d.ItemName || items.find(item => item.ItemCode === d.ITEMCODE)?.ItemName || '';
      const discVal = parseFloat(d.DISCOUNT) || 0;
      return [
        index + 1,
        `${d.ITEMCODE} - ${itemName}`,
        (parseFloat(d.GROSSWT) || 0).toFixed(3),
        (parseFloat(d.NETWT) || 0).toFixed(3),
        (parseFloat(d.QUANTITY) || 0).toFixed(2),
        d.UNIT || '-',
        (parseFloat(d.RATE) || 0).toFixed(2),
        discVal > 0 ? `${discVal.toFixed(2)}%` : '-',
        (parseFloat(d.AMOUNT) || 0).toFixed(2)
      ];
    });

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: tableStartY,
      theme: 'grid',
      headStyles: { fillColor: [15, 59, 102], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9 },
      styles: { fontSize: 8.5, cellPadding: 1.5 },
      columnStyles: {
        0: { width: 8, halign: 'center' },
        2: { halign: 'right' },
        3: { halign: 'right' },
        4: { halign: 'right' },
        5: { halign: 'center' },
        6: { halign: 'right' },
        7: { halign: 'center' },
        8: { halign: 'right' }
      },
      margin: { top: tableStartY }
    });

    const finalY = doc.lastAutoTable.finalY + 8;
    const pageHeight = doc.internal.pageSize.height;

    let checkY = finalY;
    if (checkY + 50 > pageHeight - 30) {
      doc.addPage();
      checkY = 20;
    }

    const subTotal = detailsSource.reduce((sum, row) => sum + (parseFloat(row.AMOUNT) || 0), 0);
    const exp = parseFloat(invoice.EXPENSE) || 0;
    const cdP = parseFloat(invoice.CDPER) || 0;
    const cdAmt = parseFloat(invoice.CDAMOUNT) || (cdP > 0 ? (subTotal * cdP / 100) : 0);
    const taxableVal = Math.max(0, subTotal - cdAmt + exp);
    const sgstAmt = parseFloat(invoice.SGST) || 0;
    const cgstAmt = parseFloat(invoice.CGST) || 0;
    const igstAmt = parseFloat(invoice.IGST) || 0;
    const roundOffDiff = parseFloat(invoice.ROUNDOFF) || 0;
    const totalRounded = parseFloat(invoice.TOTALAMOUNT) || 0;

    let labelY = checkY;
    const drawTotalLine = (label, value, isBold = false) => {
      doc.setFont('helvetica', isBold ? 'bold' : 'normal');
      doc.setTextColor(isBold ? 15 : 80);
      doc.text(label, 140, labelY, { align: 'right' });
      doc.text(value, 196, labelY, { align: 'right' });
      labelY += 5;
    };

    drawTotalLine('Sub Total:', subTotal.toFixed(2));
    if (cdAmt > 0) {
      const cdLabel = cdP > 0 ? `Cash Discount (-${cdP}%):` : 'Cash Discount:';
      drawTotalLine(cdLabel, `-${cdAmt.toFixed(2)}`);
    }
    if (exp > 0) drawTotalLine('Expense:', exp.toFixed(2));
    if (cdAmt > 0 || exp > 0) drawTotalLine('Taxable Value:', taxableVal.toFixed(2));
    if (sgstAmt > 0) drawTotalLine('SGST:', sgstAmt.toFixed(2));
    if (cgstAmt > 0) drawTotalLine('CGST:', cgstAmt.toFixed(2));
    if (igstAmt > 0) drawTotalLine('IGST:', igstAmt.toFixed(2));
    if (roundOffDiff !== 0) drawTotalLine('Round Off:', roundOffDiff.toFixed(2));
    labelY += 1;
    doc.line(120, labelY - 3, 196, labelY - 3);
    drawTotalLine('Grand Total:', totalRounded.toFixed(2), true);

    let leftInfoY = checkY;
    if (companyProfile && (companyProfile.BankName || companyProfile.UPI)) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(15, 59, 102);
      doc.text('PAYMENT DETAILS', 14, leftInfoY);
      leftInfoY += 5;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(50);

      if (companyProfile.BankName) {
        doc.text(`Bank Name: ${companyProfile.BankName}`, 14, leftInfoY);
        leftInfoY += 4;
        doc.text(`A/c No: ${companyProfile.AccountNo || '-'}`, 14, leftInfoY);
        leftInfoY += 4;
        doc.text(`IFSC Code: ${companyProfile.IFSCCode || '-'}`, 14, leftInfoY);
        leftInfoY += 4;
        doc.text(`Branch: ${companyProfile.BranchName || '-'}`, 14, leftInfoY);
        leftInfoY += 5;
      }

      if (companyProfile.UPI) {
        doc.setFont('helvetica', 'bold');
        doc.text(`UPI ID: ${companyProfile.UPI}`, 14, leftInfoY);
        
        const upiUrl = `upi://pay?pa=${companyProfile.UPI}&pn=${encodeURIComponent(compName)}&am=${totalRounded.toFixed(2)}&cu=INR`;
        const qrBase64 = await getQRBase64(upiUrl);
        if (qrBase64) {
          doc.addImage(qrBase64, 'JPEG', 75, checkY + 2, 25, 25);
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(7);
          doc.text('Scan to Pay', 87.5, checkY + 29, { align: 'center' });
        }
      }
    }

    const remarkY = Math.max(leftInfoY + 5, labelY + 2);
    if (invoice.REMARK) {
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 59, 102);
      doc.text('Remarks:', 14, remarkY);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(50);
      doc.text(invoice.REMARK, 32, remarkY);
    }

    const finalPageHeight = doc.internal.pageSize.height;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100);
    doc.line(14, finalPageHeight - 30, 70, finalPageHeight - 30);
    doc.text('Prepared By', 42, finalPageHeight - 25, { align: 'center' });

    doc.line(140, finalPageHeight - 30, 196, finalPageHeight - 30);
    doc.text('Authorized Signatory', 168, finalPageHeight - 25, { align: 'center' });

  } else {
    // --- PURCHASE INVOICE ---
    const vendorName = ledgerObj.LedgerName || 'Walk-in Vendor';
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 59, 102);
    doc.text(vendorName, 14, 20);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100);
    let headerY = 25;
    if (ledgerObj.Address) {
      doc.text(ledgerObj.Address, 14, headerY);
      headerY += 4;
    }
    const vendorLoc = [ledgerObj.City, ledgerObj.State].filter(Boolean).join(', ');
    if (vendorLoc) {
      doc.text(vendorLoc, 14, headerY);
      headerY += 4;
    }
    const headerTaxDetails = [];
    if (ledgerObj.GSTIN) headerTaxDetails.push(`GSTIN: ${ledgerObj.GSTIN}`);
    if (ledgerObj.MobileNo) headerTaxDetails.push(`Phone: ${ledgerObj.MobileNo}`);
    if (headerTaxDetails.length > 0) {
      doc.text(headerTaxDetails.join(' | '), 14, headerY);
    }

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 59, 102);
    doc.text('PURCHASE INVOICE', 196, 20, { align: 'right' });

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(50);
    doc.text(`Invoice No: ${invoice.INWARDNO || invoice.InwardNO || invoice.Remark || ''}`, 196, 25, { align: 'right' });
    
    const dateVal = invoice.INWARDDATE || invoice.InwardDATE || invoice.VoucherDate || new Date();
    const formattedDate = new Date(dateVal).toLocaleDateString('en-GB');
    doc.text(`Date: ${formattedDate}`, 196, 29, { align: 'right' });

    doc.setDrawColor(15, 59, 102);
    doc.setLineWidth(0.5);
    const dividerY = Math.max(headerY + 2, 33);
    doc.line(14, dividerY, 196, dividerY);

    // Buyer Details
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 59, 102);
    doc.text('BUYER DETAILS', 14, dividerY + 7);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0);
    doc.text(compName, 14, dividerY + 12);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80);
    let buyerY = dividerY + 16;
    if (companyProfile) {
      const addr = [companyProfile.Address1, companyProfile.Address2].filter(Boolean).join(', ');
      const cityDetails = [companyProfile.City, companyProfile.StateName, companyProfile.Pincode].filter(Boolean).join(', ');
      
      if (addr) {
        doc.text(addr, 14, buyerY);
        buyerY += 4;
      }
      if (cityDetails) {
        doc.text(cityDetails, 14, buyerY);
        buyerY += 4;
      }
      
      const buyerTax = [];
      if (companyProfile.GSTIN) buyerTax.push(`GSTIN: ${companyProfile.GSTIN}`);
      if (companyProfile.PANNo) buyerTax.push(`PAN: ${companyProfile.PANNo}`);
      if (companyProfile.MobileNo) buyerTax.push(`Mobile: ${companyProfile.MobileNo}`);
      if (buyerTax.length > 0) {
        doc.text(buyerTax.join(' | '), 14, buyerY);
      }
    } else {
      doc.text('Factory Site Address, City, State, ZIP', 14, buyerY);
      buyerY += 4;
      doc.text('GSTIN: 27AAAAA0000A1Z5 | Phone: +91 9876543210', 14, buyerY);
    }

    const tableStartY = Math.max(buyerY + 5, dividerY + 35);
    const tableColumn = ["Sr.", "Item Code & Name", "Gross Wt", "Net Wt", "Qty", "Unit", "Rate", "Amount"];
    const detailsSource = invoice.Details || [];
    
    const tableRows = detailsSource.map((d, index) => {
      const itemName = d.ItemName || items.find(item => item.ItemCode === d.ITEMCODE)?.ItemName || '';
      return [
        index + 1,
        `${d.ITEMCODE} - ${itemName}`,
        (parseFloat(d.GROSSWT) || 0).toFixed(3),
        (parseFloat(d.NETWT) || 0).toFixed(3),
        (parseFloat(d.QUANTITY) || 0).toFixed(2),
        d.UNIT || '-',
        (parseFloat(d.RATE) || 0).toFixed(2),
        (parseFloat(d.AMOUNT) || 0).toFixed(2)
      ];
    });

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: tableStartY,
      theme: 'grid',
      headStyles: { fillColor: [15, 59, 102], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9 },
      styles: { fontSize: 8.5, cellPadding: 1.5 },
      columnStyles: {
        0: { width: 8, halign: 'center' },
        2: { halign: 'right' },
        3: { halign: 'right' },
        4: { halign: 'right' },
        5: { halign: 'center' },
        6: { halign: 'right' },
        7: { halign: 'right' }
      },
      margin: { top: 30 }
    });

    const finalY = doc.lastAutoTable.finalY + 8;
    const pageHeight = doc.internal.pageSize.height;

    let checkY = finalY;
    if (checkY + 45 > pageHeight - 30) {
      doc.addPage();
      checkY = 20;
    }

    const subTotal = detailsSource.reduce((sum, row) => sum + (parseFloat(row.AMOUNT) || 0), 0);
    const exp = parseFloat(invoice.EXPENSE) || 0;
    const sgstAmt = parseFloat(invoice.SGST) || 0;
    const cgstAmt = parseFloat(invoice.CGST) || 0;
    const igstAmt = parseFloat(invoice.IGST) || 0;
    const roundOffDiff = parseFloat(invoice.ROUNDOFF) || 0;
    const totalRounded = parseFloat(invoice.TOTALAMOUNT) || 0;

    let labelY = checkY;
    const drawTotalLine = (label, value, isBold = false) => {
      doc.setFont('helvetica', isBold ? 'bold' : 'normal');
      doc.setTextColor(isBold ? 15 : 80);
      doc.text(label, 140, labelY, { align: 'right' });
      doc.text(value, 196, labelY, { align: 'right' });
      labelY += 5;
    };

    drawTotalLine('Sub Total:', subTotal.toFixed(2));
    if (exp > 0) drawTotalLine('Expense:', exp.toFixed(2));
    if (sgstAmt > 0) drawTotalLine('SGST:', sgstAmt.toFixed(2));
    if (cgstAmt > 0) drawTotalLine('CGST:', cgstAmt.toFixed(2));
    if (igstAmt > 0) drawTotalLine('IGST:', igstAmt.toFixed(2));
    if (roundOffDiff !== 0) drawTotalLine('Round Off:', roundOffDiff.toFixed(2));
    labelY += 1;
    doc.line(120, labelY - 3, 196, labelY - 3);
    drawTotalLine('Grand Total:', totalRounded.toFixed(2), true);

    let leftInfoY = checkY;
    if (ledgerObj && (ledgerObj.BankName || ledgerObj.UPI)) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(15, 59, 102);
      doc.text('BANK & PAYMENT DETAILS', 14, leftInfoY);
      leftInfoY += 5;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(50);

      if (ledgerObj.BankName) {
        doc.text(`Bank Name: ${ledgerObj.BankName}`, 14, leftInfoY);
        leftInfoY += 4;
        doc.text(`A/c No: ${ledgerObj.AccountNo || '-'}`, 14, leftInfoY);
        leftInfoY += 4;
        doc.text(`IFSC Code: ${ledgerObj.IFSC || '-' }`, 14, leftInfoY);
        leftInfoY += 5;
      }

      if (ledgerObj.UPI) {
        doc.setFont('helvetica', 'bold');
        doc.text(`UPI ID: ${ledgerObj.UPI}`, 14, leftInfoY);
        
        const upiUrl = `upi://pay?pa=${ledgerObj.UPI}&pn=${encodeURIComponent(ledgerObj.LedgerName || '')}&am=${totalRounded.toFixed(2)}&cu=INR`;
        const qrBase64 = await getQRBase64(upiUrl);
        if (qrBase64) {
          doc.addImage(qrBase64, 'JPEG', 75, checkY + 2, 25, 25);
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(7);
          doc.text('Scan to Pay', 87.5, checkY + 29, { align: 'center' });
        }
      }
    }

    const remarkY = Math.max(leftInfoY + 5, labelY + 2);
    if (invoice.REMARK) {
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 59, 102);
      doc.text('Remarks:', 14, remarkY);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(50);
      doc.text(invoice.REMARK, 32, remarkY);
    }

    const finalPageHeight = doc.internal.pageSize.height;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100);
    doc.line(14, finalPageHeight - 30, 70, finalPageHeight - 30);
    doc.text('Received By', 42, finalPageHeight - 25, { align: 'center' });

    doc.line(140, finalPageHeight - 30, 196, finalPageHeight - 30);
    doc.text('Authorized Signatory', 168, finalPageHeight - 25, { align: 'center' });
  }

  const blob = doc.output('blob');
  const blobUrl = URL.createObjectURL(blob);
  const invNo = isSales 
    ? (invoice.OUTWARDNO || invoice.OutwardNO || invoice.Remark || 'inv')
    : (invoice.INWARDNO || invoice.InwardNO || invoice.Remark || 'inv');
  const fileName = `${isSales ? 'sales_invoice' : 'purchase_invoice'}_${invNo}.pdf`;

  return { blobUrl, fileName };
};
