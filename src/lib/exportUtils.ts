import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { formatSalaryTypeLabel } from './api.ts';
import type { Driver, SalaryRecord } from '../types.ts';

export function downloadSalaryPdf(
  salary: SalaryRecord,
  driver: Driver | undefined,
  currencySymbol = 'Rs. ',
): void {
  const doc = new jsPDF();
  const pdfPrefix = currencySymbol === '₹' ? 'Rs. ' : currencySymbol;
  const fmt = (n: number) =>
    `${pdfPrefix}${n.toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  // Header band
  doc.setFillColor(30, 58, 138); // Dark Blue #1E3A8A
  doc.rect(0, 0, 210, 32, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('FleetFlow Transport Operations', 14, 15);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Official Monthly Salary Statement — Period ${salary.month}`, 14, 23);

  doc.setTextColor(15, 23, 42);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Driver & Payroll Details', 14, 44);

  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'normal');
  const leftDetails = [
    `Driver Name: ${driver?.name ?? salary.driverId}`,
    `Driver ID: ${salary.driverId}`,
    `Licence No: ${driver?.licenceNumber ?? '—'}`,
    `Joining Date: ${driver?.joiningDate ?? '—'}`,
  ];
  const rightDetails = [
    `Statement ID: ${salary.id}`,
    `Pay Structure: ${formatSalaryTypeLabel(salary.salaryType)}`,
    `Completed Trips: ${salary.completedTrips}`,
    `Status: ${salary.status}`,
  ];

  leftDetails.forEach((line, i) => doc.text(line, 14, 52 + i * 6));
  rightDetails.forEach((line, i) => doc.text(line, 115, 52 + i * 6));

  autoTable(doc, {
    startY: 82,
    head: [['Compensation / Adjustment Line Item', 'Category', 'Amount']],
    body: [
      ['Basic Monthly Salary', 'Earnings', fmt(salary.basicSalary)],
      [
        `Trip Allowances (${salary.completedTrips} completed trips)`,
        'Allowances',
        fmt(salary.tripAllowances),
      ],
      ['Night Shift Allowances', 'Allowances', fmt(salary.nightAllowances)],
      [`Overtime Pay (${salary.overtimeHours} hrs)`, 'Earnings', fmt(salary.overtimePay)],
      ['Approved Performance Bonuses', 'Earnings', fmt(salary.approvedBonuses)],
      ['Approved Deductions', 'Deduction (-)', `-${fmt(salary.approvedDeductions)}`],
      ['Advance Payments Recovered', 'Advance (-)', `-${fmt(salary.advancePayments)}`],
    ],
    theme: 'grid',
    headStyles: { fillColor: [30, 58, 138], textColor: 255, fontStyle: 'bold' },
    styles: { fontSize: 9.5, cellPadding: 3.5 },
    columnStyles: {
      2: { halign: 'right', fontStyle: 'bold' },
    },
  });

  const finalY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 160;

  doc.setFillColor(241, 245, 249);
  doc.rect(14, finalY + 8, 182, 16, 'F');
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 58, 138);
  doc.text('Final Payable Salary:', 18, finalY + 18);
  doc.text(fmt(salary.finalPayableSalary), 192, finalY + 18, { align: 'right' });

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(`Delay Compliance Note: ${salary.delayAuditNote}`, 14, finalY + 34, { maxWidth: 182 });
  if (salary.notes) {
    doc.text(`Remarks: ${salary.notes}`, 14, finalY + 42, { maxWidth: 182 });
  }
  if (salary.approvedBy) {
    doc.text(
      `Approved by ${salary.approvedBy} on ${salary.approvedAt?.slice(0, 10) ?? ''}`,
      14,
      finalY + 52,
    );
  }

  doc.save(`FleetFlow_Payslip_${driver?.name.replace(/\s+/g, '_') ?? salary.driverId}_${salary.month}.pdf`);
}

export function exportReportToPdf(params: {
  title: string;
  subtitle: string;
  columns: string[];
  rows: Array<Array<string | number>>;
  filename: string;
}): void {
  const doc = new jsPDF({ orientation: 'landscape' });

  doc.setFillColor(30, 58, 138);
  doc.rect(0, 0, 297, 26, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(15);
  doc.setFont('helvetica', 'bold');
  doc.text(`FleetFlow — ${params.title}`, 14, 12);
  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'normal');
  doc.text(params.subtitle, 14, 20);

  autoTable(doc, {
    startY: 34,
    head: [params.columns],
    body: params.rows.map((r) => r.map((c) => String(c).replace(/₹/g, 'Rs. '))),
    theme: 'striped',
    headStyles: { fillColor: [30, 58, 138], textColor: 255, fontSize: 8.5 },
    styles: { fontSize: 8.5, cellPadding: 2.5 },
  });

  doc.save(params.filename.endsWith('.pdf') ? params.filename : `${params.filename}.pdf`);
}

export function exportReportToExcel(
  filename: string,
  sheetName: string,
  records: Array<Record<string, string | number>>,
): void {
  const worksheet = XLSX.utils.json_to_sheet(records);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName.slice(0, 31));
  XLSX.writeFile(
    workbook,
    filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`,
  );
}
