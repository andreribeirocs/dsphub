import * as Handlebars from "handlebars";

interface InvoiceEmailData {
  readonly driverName: string;
  readonly invoiceNumber: string;
  readonly weekStart: string;
  readonly weekEnd: string;
  readonly totalAmount: string;
  readonly currency: string;
}

const invoiceEmailTemplate = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Weekly Invoice - {{invoiceNumber}}</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    .header {
      background-color: #2563eb;
      color: white;
      padding: 20px;
      text-align: center;
      border-radius: 8px 8px 0 0;
    }
    .content {
      background-color: #f9fafb;
      padding: 30px;
      border: 1px solid #e5e7eb;
      border-top: none;
    }
    .invoice-details {
      background-color: white;
      padding: 20px;
      border-radius: 8px;
      margin: 20px 0;
      border: 1px solid #e5e7eb;
    }
    .detail-row {
      display: flex;
      justify-content: space-between;
      padding: 10px 0;
      border-bottom: 1px solid #e5e7eb;
    }
    .detail-row:last-child {
      border-bottom: none;
    }
    .label {
      font-weight: bold;
      color: #6b7280;
    }
    .value {
      color: #111827;
    }
    .total {
      font-size: 24px;
      font-weight: bold;
      color: #2563eb;
    }
    .footer {
      text-align: center;
      padding: 20px;
      color: #6b7280;
      font-size: 14px;
    }
    .button {
      display: inline-block;
      padding: 12px 24px;
      background-color: #2563eb;
      color: white;
      text-decoration: none;
      border-radius: 6px;
      margin: 20px 0;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>Weekly Invoice</h1>
    <p>Driver Hub Payment System</p>
  </div>
  
  <div class="content">
    <h2>Hello {{driverName}},</h2>
    
    <p>Please find attached your weekly invoice for the period <strong>{{weekStart}}</strong> to <strong>{{weekEnd}}</strong>.</p>
    
    <div class="invoice-details">
      <div class="detail-row">
        <span class="label">Invoice Number:</span>
        <span class="value">{{invoiceNumber}}</span>
      </div>
      <div class="detail-row">
        <span class="label">Period:</span>
        <span class="value">{{weekStart}} - {{weekEnd}}</span>
      </div>
      <div class="detail-row">
        <span class="label">Total Amount:</span>
        <span class="value total">{{currency}}{{totalAmount}}</span>
      </div>
    </div>
    
    <p>The attached PDF contains a detailed breakdown of your earnings for the week, including:</p>
    <ul>
      <li>Daily route information</li>
      <li>Route types and codes</li>
      <li>Individual payment amounts</li>
      <li>Any extras or deductions applied</li>
    </ul>
    
    <p><strong>Note:</strong> Payment will be processed according to our standard payment schedule. If you have any questions regarding this invoice, please contact our finance team.</p>
    
    <p>Thank you for your hard work this week!</p>
    
    <p>Best regards,<br>
    <strong>Driver Hub Finance Team</strong></p>
  </div>
  
  <div class="footer">
    <p>This is an automated email. Please do not reply to this message.</p>
    <p>&copy; 2025 Driver Hub. All rights reserved.</p>
  </div>
</body>
</html>
`;

const compileInvoiceTemplate = Handlebars.compile(invoiceEmailTemplate);

export const generateInvoiceEmail = (data: InvoiceEmailData): string => {
  return compileInvoiceTemplate(data);
};

export const generateInvoiceEmailSubject = (
  invoiceNumber: string,
  weekStart: string,
  weekEnd: string
): string => {
  return `Weekly Invoice ${invoiceNumber} - ${weekStart} to ${weekEnd}`;
};
