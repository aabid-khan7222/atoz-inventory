import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

/**
 * Generate PDF from report data
 * @param {Object} options - PDF generation options
 * @param {string} options.title - Report title
 * @param {Array} options.columns - Column definitions [{header, field, render?}]
 * @param {Array} options.data - Report data array
 * @param {Object} options.totals - Totals object (optional)
 * @param {Object} options.filters - Filter information (optional)
 * @param {string} options.filename - Output filename
 */
export function generateReportPDF({ title, columns, data, totals = null, filters = null, filename = 'report.pdf' }) {
  const doc = new jsPDF('l', 'mm', 'a4'); // Landscape orientation for better table display
  
  // Add title
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(title, 14, 15);
  
  // Add date/time
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-IN', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
  doc.text(`Generated on: ${dateStr}`, 14, 22);
  
  // Add date range information
  let yPos = 28;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  
  // Format date for display
  const formatDateDDMMYYYY = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };
  
  let dateRangeText = '';
  if (filters && filters.dateFrom && filters.dateTo) {
    dateRangeText = `Report from ${formatDateDDMMYYYY(filters.dateFrom)} to ${formatDateDDMMYYYY(filters.dateTo)}`;
  } else if (filters && filters.period && filters.period !== 'all') {
    const periodLabels = {
      'today': 'Today',
      'this_month': 'This Month',
      'last_month': 'Last Month',
      'last_3_months': 'Last 3 Months',
      'last_year': 'Last Year'
    };
    dateRangeText = `Report Period: ${periodLabels[filters.period] || filters.period.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}`;
  } else {
    dateRangeText = 'Report Period: All Time';
  }
  
  doc.text(dateRangeText, 14, yPos);
  yPos += 6;
  
  // Add other filter information if available
  if (filters) {
    doc.setFontSize(9);
    const filterText = [];
    if (filters.category && filters.category !== 'all') {
      filterText.push(`Category: ${filters.category}`);
    }
    if (filters.series && filters.series !== 'all') {
      filterText.push(`Series: ${filters.series}`);
    }
    if (filterText.length > 0) {
      doc.text(filterText.join(' | '), 14, yPos);
      yPos += 5;
    }
  }
  
  // Prepare table data
  const tableColumns = columns.map(col => col.header);
  const tableRows = data.map(row =>
    columns.map(col => {
      if (col.render) {
        const rendered = col.render(row);
        if (typeof rendered === 'object' && rendered !== null) {
          if (rendered.props && rendered.props.children) {
            return String(rendered.props.children);
          }
          return String(rendered);
        }
        return String(rendered);
      }
      return row[col.field] !== null && row[col.field] !== undefined ? String(row[col.field]) : '-';
    })
  );

  // Build columnStyles: amount columns (with render) get overflow+width so values never overflow
  const TABLE_WIDTH_MM = 269; // landscape A4 minus margins 14+14
  const AMOUNT_COL_WIDTH = 42;
  const amountColCount = columns.filter(c => c.render).length;
  const otherColCount = columns.length - amountColCount;
  const otherColWidth = otherColCount > 0 ? Math.max(25, (TABLE_WIDTH_MM - AMOUNT_COL_WIDTH * amountColCount) / otherColCount) : 0;
  const columnStyles = {};
  columns.forEach((col, i) => {
    if (col.render) {
      columnStyles[i] = { halign: 'right', cellWidth: AMOUNT_COL_WIDTH, overflow: 'linebreak', fontSize: 7 };
    } else {
      columnStyles[i] = { cellWidth: otherColWidth, overflow: 'linebreak' };
    }
  });

  autoTable(doc, {
    head: [tableColumns],
    body: tableRows,
    startY: yPos + 5,
    styles: { fontSize: 8, cellPadding: 2, overflow: 'linebreak' },
    columnStyles,
    headStyles: {
      fillColor: [66, 139, 202],
      textColor: 255,
      fontStyle: 'bold',
      halign: 'center'
    },
    alternateRowStyles: { fillColor: [245, 245, 245] },
    margin: { top: yPos + 5, left: 14, right: 14 }
  });
  
  // Add totals if available
  if (totals) {
    const finalY = doc.lastAutoTable.finalY + 10;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('TOTAL SUMMARY', 14, finalY);
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    let totalsY = finalY + 7;
    const totalsText = [];
    
    if (totals.total_quantity !== undefined && totals.total_quantity !== 0) {
      totalsText.push(`Total Quantity: ${totals.total_quantity}`);
    }
    if (totals.total_revenue !== undefined || totals.total_sales_amount !== undefined) {
      const revenue = totals.total_revenue || totals.total_sales_amount || 0;
      totalsText.push(`Total Revenue: ₹${formatNumber(revenue)}`);
    }
    if (totals.total_commission_paid !== undefined) {
      totalsText.push(`Total Commission: ₹${formatNumber(totals.total_commission_paid)}`);
    }
    
    if (totalsText.length > 0) {
      doc.text(totalsText.join(' | '), 14, totalsY);
    }
  }
  
  // Add page numbers
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.text(
      `Page ${i} of ${pageCount}`,
      doc.internal.pageSize.getWidth() / 2,
      doc.internal.pageSize.getHeight() - 10,
      { align: 'center' }
    );
  }
  
  // Save PDF
  doc.save(filename);
}

/**
 * Generate PDF for summary report
 */
export function generateSummaryReportPDF({ title, summaryData, filters = null, filename = 'summary-report.pdf' }) {
  const doc = new jsPDF('p', 'mm', 'a4');
  
  // Add title
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(title, 14, 20);
  
  // Add date/time
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-IN', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
  doc.text(`Generated on: ${dateStr}`, 14, 27);
  
  // Add date range information
  let yPos = 33;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  
  // Format date for display
  const formatDateDDMMYYYY = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };
  
  let dateRangeText = '';
  if (filters && filters.dateFrom && filters.dateTo) {
    dateRangeText = `Report from ${formatDateDDMMYYYY(filters.dateFrom)} to ${formatDateDDMMYYYY(filters.dateTo)}`;
  } else if (filters && filters.period && filters.period !== 'all') {
    const periodLabels = {
      'today': 'Today',
      'this_month': 'This Month',
      'last_month': 'Last Month',
      'last_3_months': 'Last 3 Months',
      'last_year': 'Last Year'
    };
    dateRangeText = `Report Period: ${periodLabels[filters.period] || filters.period.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}`;
  } else {
    dateRangeText = 'Report Period: All Time';
  }
  
  doc.text(dateRangeText, 14, yPos);
  yPos += 8;
  
  if (!summaryData) {
    doc.text('No data available', 14, yPos);
    doc.save(filename);
    return;
  }
  
  // Sales Summary
  yPos += 5;
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Sales Summary', 14, yPos);
  
  yPos += 8;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const salesData = [
    ['Total Sales', summaryData.sales?.total_sales || 0],
    ['Total Invoices', summaryData.sales?.total_invoices || 0],
    ['Total Revenue', `₹${formatNumber(summaryData.sales?.total_revenue || 0)}`],
    ['Total MRP', `₹${formatNumber(summaryData.sales?.total_mrp || 0)}`],
    ['Total Discount', `₹${formatNumber(summaryData.sales?.total_discount || 0)}`],
    ['Total Tax', `₹${formatNumber(summaryData.sales?.total_tax || 0)}`],
    ['Total Quantity Sold', summaryData.sales?.total_quantity_sold || 0],
    ['Unique Customers', summaryData.sales?.unique_customers || 0]
  ];
  
  autoTable(doc, {
    body: salesData,
    startY: yPos,
    theme: 'grid',
    styles: { fontSize: 9, overflow: 'linebreak', cellPadding: 2 },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 70 },
      1: { halign: 'right', cellWidth: 112, fontSize: 8, overflow: 'linebreak' }
    },
    margin: { left: 14, right: 14 }
  });
  
  // Commission Summary
  if (summaryData.commission) {
    yPos = doc.lastAutoTable.finalY + 15;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Commission Summary', 14, yPos);
    
    yPos += 8;
    const commissionData = [
      ['Total Commission Sales', summaryData.commission.total_commission_sales || 0],
      ['Total Commission Paid', `₹${formatNumber(summaryData.commission.total_commission_paid || 0)}`],
      ['Unique Agents', summaryData.commission.unique_agents || 0]
    ];
    
    autoTable(doc, {
      body: commissionData,
      startY: yPos,
      theme: 'grid',
      styles: { fontSize: 9, overflow: 'linebreak', cellPadding: 2 },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 70 },
        1: { halign: 'right', cellWidth: 112, fontSize: 8, overflow: 'linebreak' }
      },
      margin: { left: 14, right: 14 }
    });
  }
  
  // Charging Services Summary
  if (summaryData.charging) {
    yPos = doc.lastAutoTable.finalY + 15;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Charging Services Summary', 14, yPos);
    
    yPos += 8;
    const chargingData = [
      ['Total Services', summaryData.charging.total_services || 0],
      ['Total Revenue', `₹${formatNumber(summaryData.charging.total_revenue || 0)}`]
    ];
    
    autoTable(doc, {
      body: chargingData,
      startY: yPos,
      theme: 'grid',
      styles: { fontSize: 9, overflow: 'linebreak', cellPadding: 2 },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 70 },
        1: { halign: 'right', cellWidth: 112, fontSize: 8, overflow: 'linebreak' }
      },
      margin: { left: 14, right: 14 }
    });
  }
  
  // Add page numbers
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.text(
      `Page ${i} of ${pageCount}`,
      doc.internal.pageSize.getWidth() / 2,
      doc.internal.pageSize.getHeight() - 10,
      { align: 'center' }
    );
  }
  
  doc.save(filename);
}

/**
 * Generate PDF for profit report
 */
export function generateProfitReportPDF({ profitReport, filters = null, filename = 'profit-report.pdf' }) {
  const doc = new jsPDF('p', 'mm', 'a4');
  
  // Add title
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('Profit Report', 14, 20);
  
  // Add date/time
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-IN', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
  doc.text(`Generated on: ${dateStr}`, 14, 27);
  
  // Add date range information
  let yPos = 33;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  
  // Format date for display
  const formatDateDDMMYYYY = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };
  
  let dateRangeText = '';
  if (filters && filters.dateFrom && filters.dateTo) {
    dateRangeText = `Report from ${formatDateDDMMYYYY(filters.dateFrom)} to ${formatDateDDMMYYYY(filters.dateTo)}`;
  } else if (filters && filters.period && filters.period !== 'all') {
    const periodLabels = {
      'today': 'Today',
      'this_month': 'This Month',
      'last_month': 'Last Month',
      'last_3_months': 'Last 3 Months',
      'last_year': 'Last Year'
    };
    dateRangeText = `Report Period: ${periodLabels[filters.period] || filters.period.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}`;
  } else {
    dateRangeText = 'Report Period: All Time';
  }
  
  doc.text(dateRangeText, 14, yPos);
  yPos += 8;
  
  if (!profitReport || !profitReport.overall) {
    doc.text('No data available', 14, yPos);
    doc.save(filename);
    return;
  }
  
  // Overall Profit
  yPos += 5;
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Overall Profit', 14, yPos);
  
  yPos += 8;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const overallData = [
    ['Total Revenue', `₹${formatNumber(profitReport.overall.total_revenue || 0)}`],
    ['Purchase Cost', `₹${formatNumber(profitReport.overall.total_purchase_cost || 0)}`],
    ['Total Trade-in Value', `₹${formatNumber(profitReport.overall.total_trade_in_value || 0)}`],
    ['Total Profit', `₹${formatNumber(profitReport.overall.total_profit || 0)}`],
    ['Profit Margin', `${profitReport.overall.profit_margin_percent || 0}%`]
  ];
  
  autoTable(doc, {
    body: overallData,
    startY: yPos,
    theme: 'grid',
    styles: { fontSize: 9, overflow: 'linebreak', cellPadding: 2 },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 70 },
      1: { halign: 'right', cellWidth: 112, fontSize: 8, overflow: 'linebreak' }
    },
    margin: { left: 14, right: 14 }
  });
  
  // Profit by Category
  if (profitReport.by_category && profitReport.by_category.length > 0) {
    yPos = doc.lastAutoTable.finalY + 15;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Profit by Category', 14, yPos);
    
    yPos += 8;
    const categoryRows = profitReport.by_category.map(item => [
      item.category,
      `₹${formatNumber(item.revenue)}`,
      `₹${formatNumber(item.purchase_cost)}`,
      `₹${formatNumber(item.profit)}`,
      `${item.profit_margin_percent}%`
    ]);
    
    autoTable(doc, {
      head: [['Category', 'Revenue', 'Purchase Cost', 'Profit', 'Margin %']],
      body: categoryRows,
      startY: yPos,
      styles: { fontSize: 8, overflow: 'linebreak', cellPadding: 2 },
      headStyles: {
        fillColor: [66, 139, 202],
        textColor: 255,
        fontStyle: 'bold'
      },
      columnStyles: {
        0: { cellWidth: 50, overflow: 'linebreak' },
        1: { halign: 'right', cellWidth: 45, overflow: 'linebreak', fontSize: 7 },
        2: { halign: 'right', cellWidth: 45, overflow: 'linebreak', fontSize: 7 },
        3: { halign: 'right', cellWidth: 45, overflow: 'linebreak', fontSize: 7 },
        4: { halign: 'right', cellWidth: 44, overflow: 'linebreak' }
      },
      margin: { left: 14, right: 14 }
    });
  }
  
  // Profit by Series
  if (profitReport.by_series && profitReport.by_series.length > 0) {
    yPos = doc.lastAutoTable.finalY + 15;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Profit by Series', 14, yPos);
    
    yPos += 8;
    const seriesRows = profitReport.by_series.map(item => [
      item.series,
      `₹${formatNumber(item.revenue)}`,
      `₹${formatNumber(item.purchase_cost)}`,
      `₹${formatNumber(item.profit)}`,
      `${item.profit_margin_percent}%`
    ]);
    
    autoTable(doc, {
      head: [['Series', 'Revenue', 'Purchase Cost', 'Profit', 'Margin %']],
      body: seriesRows,
      startY: yPos,
      styles: { fontSize: 8, overflow: 'linebreak', cellPadding: 2 },
      headStyles: {
        fillColor: [66, 139, 202],
        textColor: 255,
        fontStyle: 'bold'
      },
      columnStyles: {
        0: { cellWidth: 50, overflow: 'linebreak' },
        1: { halign: 'right', cellWidth: 45, overflow: 'linebreak', fontSize: 7 },
        2: { halign: 'right', cellWidth: 45, overflow: 'linebreak', fontSize: 7 },
        3: { halign: 'right', cellWidth: 45, overflow: 'linebreak', fontSize: 7 },
        4: { halign: 'right', cellWidth: 44, overflow: 'linebreak' }
      },
      margin: { left: 14, right: 14 }
    });
  }
  
  // Profit by Product (limit to first 50 for PDF)
  if (profitReport.by_product && profitReport.by_product.length > 0) {
    yPos = doc.lastAutoTable.finalY + 15;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Profit by Product (Top 50)', 14, yPos);
    
    yPos += 8;
    const productRows = profitReport.by_product.slice(0, 50).map(item => [
      item.name,
      item.sku,
      `₹${formatNumber(item.revenue)}`,
      `₹${formatNumber(item.purchase_cost)}`,
      `₹${formatNumber(item.profit)}`,
      `${item.profit_margin_percent}%`
    ]);
    
    autoTable(doc, {
      head: [['Product', 'SKU', 'Revenue', 'Purchase Cost', 'Profit', 'Margin %']],
      body: productRows,
      startY: yPos,
      styles: { fontSize: 7, overflow: 'linebreak', cellPadding: 2 },
      headStyles: {
        fillColor: [66, 139, 202],
        textColor: 255,
        fontStyle: 'bold'
      },
      columnStyles: {
        0: { cellWidth: 45, overflow: 'linebreak' },
        1: { cellWidth: 35, overflow: 'linebreak' },
        2: { halign: 'right', cellWidth: 40, overflow: 'linebreak', fontSize: 7 },
        3: { halign: 'right', cellWidth: 40, overflow: 'linebreak', fontSize: 7 },
        4: { halign: 'right', cellWidth: 40, overflow: 'linebreak', fontSize: 7 },
        5: { halign: 'right', cellWidth: 39, overflow: 'linebreak' }
      },
      margin: { left: 14, right: 14 }
    });
  }
  
  // Add page numbers
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.text(
      `Page ${i} of ${pageCount}`,
      doc.internal.pageSize.getWidth() / 2,
      doc.internal.pageSize.getHeight() - 10,
      { align: 'center' }
    );
  }
  
  doc.save(filename);
}

/**
 * Generate PDF for charging services report
 */
export function generateChargingServicesReportPDF({ chargingReport, filters = null, filename = 'charging-services-report.pdf' }) {
  const doc = new jsPDF('p', 'mm', 'a4');
  
  // Add title
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('Charging Services Report', 14, 20);
  
  // Add date/time
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-IN', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
  doc.text(`Generated on: ${dateStr}`, 14, 27);
  
  // Add date range information
  let yPos = 33;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  
  // Format date for display
  const formatDateDDMMYYYY = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };
  
  let dateRangeText = '';
  if (filters && filters.dateFrom && filters.dateTo) {
    dateRangeText = `Report from ${formatDateDDMMYYYY(filters.dateFrom)} to ${formatDateDDMMYYYY(filters.dateTo)}`;
  } else if (filters && filters.period && filters.period !== 'all') {
    const periodLabels = {
      'today': 'Today',
      'this_month': 'This Month',
      'last_month': 'Last Month',
      'last_3_months': 'Last 3 Months',
      'last_year': 'Last Year'
    };
    dateRangeText = `Report Period: ${periodLabels[filters.period] || filters.period.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}`;
  } else {
    dateRangeText = 'Report Period: All Time';
  }
  
  doc.text(dateRangeText, 14, yPos);
  yPos += 8;
  
  if (!chargingReport) {
    doc.text('No data available', 14, yPos);
    doc.save(filename);
    return;
  }
  
  // Charging Services Overview
  yPos += 5;
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Charging Services Overview', 14, yPos);
  
  yPos += 8;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const overviewData = [
    ['Total Services', chargingReport.total_services || 0],
    ['Completed Services', chargingReport.completed_services || 0],
    ['Collected Services', chargingReport.collected_services || 0],
    ['Total Revenue', `₹${formatNumber(chargingReport.total_revenue || 0)}`],
    ['Average Service Price', `₹${formatNumber(chargingReport.avg_service_price || 0)}`]
  ];
  
  if (chargingReport.estimated_profit !== undefined) {
    overviewData.push(['Estimated Profit', `₹${formatNumber(chargingReport.estimated_profit || 0)}`]);
    overviewData.push(['Profit Margin', `${chargingReport.profit_margin_percent || 0}%`]);
  }
  
  autoTable(doc, {
    body: overviewData,
    startY: yPos,
    theme: 'grid',
    styles: { fontSize: 9, overflow: 'linebreak', cellPadding: 2 },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 70 },
      1: { halign: 'right', cellWidth: 112, fontSize: 8, overflow: 'linebreak' }
    },
    margin: { left: 14, right: 14 }
  });
  
  // Add page numbers
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.text(
      `Page ${i} of ${pageCount}`,
      doc.internal.pageSize.getWidth() / 2,
      doc.internal.pageSize.getHeight() - 10,
      { align: 'center' }
    );
  }
  
  doc.save(filename);
}

/**
 * Generate PDF for customer history
 */
export function generateCustomerHistoryPDF({ customerHistory, filters = null, filename = 'customer-history.pdf' }) {
  const doc = new jsPDF('p', 'mm', 'a4');
  
  if (!customerHistory || !customerHistory.customer) {
    doc.text('No customer history data available', 14, 20);
    doc.save(filename);
    return;
  }

  const customer = customerHistory.customer;
  const sales = customerHistory.sales || [];
  const replacements = customerHistory.replacements || [];
  const chargingServices = customerHistory.chargingServices || [];
  const serviceRequests = customerHistory.serviceRequests || [];

  // Add title
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('Customer History Report', 14, 20);
  
  // Add date/time
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-IN', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
  doc.text(`Generated on: ${dateStr}`, 14, 27);
  
  // Add filter information
  let yPos = 33;
  if (filters) {
    doc.setFontSize(9);
    const filterText = [];
    if (filters.fromDate && filters.toDate) {
      filterText.push(`Date Range: ${filters.fromDate} to ${filters.toDate}`);
    } else if (filters.fromDate) {
      filterText.push(`From Date: ${filters.fromDate}`);
    } else if (filters.toDate) {
      filterText.push(`To Date: ${filters.toDate}`);
    }
    if (filters.product) {
      filterText.push(`Product: ${filters.product}`);
    }
    if (filters.series) {
      filterText.push(`Series: ${filters.series}`);
    }
    if (filterText.length > 0) {
      doc.text(filterText.join(' | '), 14, yPos);
      yPos += 8;
    }
  }

  // Customer Information
  yPos += 5;
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Customer Information', 14, yPos);
  
  yPos += 8;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const customerData = [
    ['Name', customer.full_name || 'N/A'],
    ['Phone', customer.phone || 'N/A'],
  ];
  
  if (customer.email && !customer.email.includes('@customer.local')) {
    customerData.push(['Email', customer.email]);
  }
  if (customer.company_name) {
    customerData.push(['Company', customer.company_name]);
  }
  if (customer.gst_number) {
    customerData.push(['GST Number', customer.gst_number]);
  }
  if (customer.address || customer.city || customer.state || customer.pincode) {
    const address = [customer.address, customer.city, customer.state, customer.pincode]
      .filter(Boolean)
      .join(', ');
    customerData.push(['Address', address || 'N/A']);
  }
  
  autoTable(doc, {
    body: customerData,
    startY: yPos,
    theme: 'grid',
    styles: { fontSize: 9, overflow: 'linebreak', cellPadding: 2 },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 70 },
      1: { cellWidth: 112, overflow: 'linebreak' }
    },
    margin: { left: 14, right: 14 }
  });

  // Purchase History
  if (sales.length > 0) {
    yPos = doc.lastAutoTable.finalY + 15;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(`Purchase History (${sales.length})`, 14, yPos);
    
    yPos += 8;
    const salesRows = sales.map(sale => [
      sale.invoice_number || 'N/A',
      formatDateForPDF(sale.purchase_date),
      sale.sales_type || 'retail',
      sale.item_count || 0,
      `₹${formatNumber(sale.total_amount || 0)}`,
      sale.customer_vehicle_number || 'N/A'
    ]);
    
    autoTable(doc, {
      head: [['Invoice', 'Date', 'Type', 'Items', 'Amount', 'Vehicle']],
      body: salesRows,
      startY: yPos,
      styles: { fontSize: 8, overflow: 'linebreak', cellPadding: 2 },
      headStyles: {
        fillColor: [66, 139, 202],
        textColor: 255,
        fontStyle: 'bold'
      },
      columnStyles: {
        0: { cellWidth: 34, overflow: 'linebreak' },
        1: { cellWidth: 26, overflow: 'linebreak' },
        2: { cellWidth: 22, overflow: 'linebreak' },
        3: { halign: 'center', cellWidth: 16, overflow: 'linebreak' },
        4: { halign: 'right', cellWidth: 46, overflow: 'linebreak', fontSize: 7 },
        5: { cellWidth: 26, overflow: 'linebreak' }
      },
      margin: { left: 14, right: 14 }
    });
  }

  // Warranty & Guarantee Services
  if (replacements.length > 0) {
    yPos = doc.lastAutoTable.finalY + 15;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(`Warranty & Guarantee Services (${replacements.length})`, 14, yPos);
    
    yPos += 8;
    const replacementRows = replacements.map(rep => [
      formatDateForPDF(rep.replacement_date),
      rep.replacement_type || 'N/A',
      rep.original_serial_number || 'N/A',
      rep.new_serial_number || 'N/A',
      rep.product_name || rep.product_sku || 'N/A',
      rep.discount_percentage > 0 
        ? `${rep.discount_percentage}%`
        : rep.replacement_type === 'guarantee' ? 'Free' : 'N/A',
      rep.new_invoice_number || 'N/A'
    ]);
    
    autoTable(doc, {
      head: [['Date', 'Type', 'Original Serial', 'New Serial', 'Product', 'Discount', 'Invoice']],
      body: replacementRows,
      startY: yPos,
      styles: { fontSize: 7, overflow: 'linebreak', cellPadding: 2 },
      headStyles: {
        fillColor: [66, 139, 202],
        textColor: 255,
        fontStyle: 'bold'
      },
      columnStyles: {
        0: { cellWidth: 22, overflow: 'linebreak' },
        1: { cellWidth: 20, overflow: 'linebreak' },
        2: { cellWidth: 26, overflow: 'linebreak' },
        3: { cellWidth: 26, overflow: 'linebreak' },
        4: { cellWidth: 34, overflow: 'linebreak' },
        5: { cellWidth: 20, overflow: 'linebreak' },
        6: { cellWidth: 26, overflow: 'linebreak' }
      },
      margin: { left: 14, right: 14 }
    });
  }

  // Charging Services
  if (chargingServices.length > 0) {
    yPos = doc.lastAutoTable.finalY + 15;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(`Charging Services (${chargingServices.length})`, 14, yPos);
    
    yPos += 8;
    const chargingRows = chargingServices.map(service => [
      formatDateForPDF(service.created_at),
      service.battery_serial_number || 'N/A',
      service.vehicle_number || 'N/A',
      service.status || 'pending',
      `₹${formatNumber(service.service_price || 0)}`,
      formatDateForPDF(service.expected_completion_time)
    ]);
    
    autoTable(doc, {
      head: [['Date', 'Battery Serial', 'Vehicle', 'Status', 'Price', 'Expected Completion']],
      body: chargingRows,
      startY: yPos,
      styles: { fontSize: 8, overflow: 'linebreak', cellPadding: 2 },
      headStyles: {
        fillColor: [66, 139, 202],
        textColor: 255,
        fontStyle: 'bold'
      },
      columnStyles: {
        0: { cellWidth: 24, overflow: 'linebreak' },
        1: { cellWidth: 34, overflow: 'linebreak' },
        2: { cellWidth: 24, overflow: 'linebreak' },
        3: { cellWidth: 22, overflow: 'linebreak' },
        4: { halign: 'right', cellWidth: 40, overflow: 'linebreak', fontSize: 7 },
        5: { cellWidth: 30, overflow: 'linebreak' }
      },
      margin: { left: 14, right: 14 }
    });
  }

  // Service Requests
  if (serviceRequests.length > 0) {
    yPos = doc.lastAutoTable.finalY + 15;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(`Service Requests (${serviceRequests.length})`, 14, yPos);
    
    yPos += 8;
    const serviceRows = serviceRequests.map(request => {
      let details = 'N/A';
      if (request.vehicle_name && request.vehicle_number) {
        details = `${request.vehicle_name} (${request.vehicle_number})`;
      } else if (request.inverter_va && request.inverter_voltage) {
        details = `Inverter ${request.inverter_va}VA ${request.inverter_voltage}V`;
      } else if (request.battery_ampere_rating) {
        details = `Battery ${request.battery_ampere_rating}Ah`;
      }
      return [
        formatDateForPDF(request.created_at),
        request.service_type || 'N/A',
        details,
        request.notes || 'N/A',
        request.status || 'pending'
      ];
    });
    
    autoTable(doc, {
      head: [['Date', 'Service Type', 'Vehicle/Details', 'Notes', 'Status']],
      body: serviceRows,
      startY: yPos,
      styles: { fontSize: 8, overflow: 'linebreak', cellPadding: 2 },
      headStyles: {
        fillColor: [66, 139, 202],
        textColor: 255,
        fontStyle: 'bold'
      },
      columnStyles: {
        0: { cellWidth: 30, overflow: 'linebreak' },
        1: { cellWidth: 35, overflow: 'linebreak' },
        2: { cellWidth: 50, overflow: 'linebreak' },
        3: { cellWidth: 50, overflow: 'linebreak' },
        4: { cellWidth: 24, overflow: 'linebreak' }
      },
      margin: { left: 14, right: 14 }
    });
  }

  // Add page numbers
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.text(
      `Page ${i} of ${pageCount}`,
      doc.internal.pageSize.getWidth() / 2,
      doc.internal.pageSize.getHeight() - 10,
      { align: 'center' }
    );
  }
  
  doc.save(filename);
}

/**
 * Helper function to format dates for PDF
 */
function formatDateForPDF(dateString) {
  if (!dateString) return 'N/A';
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  } catch (e) {
    return dateString;
  }
}

/**
 * Helper function to format numbers with Indian number system
 */
function formatNumber(num) {
  if (!num && num !== 0) return '0.00';
  return new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(num);
}

