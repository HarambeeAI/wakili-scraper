import { RequestHandler } from 'express';
import type { AuthedRequest } from '../middleware/auth.js';
import { generateImageImagen3 } from '../lib/geminiImage.js';
import { pool } from '../db/pool.js';

interface InvoiceData {
  invoiceId?: string;
  vendorName: string;
  amount: number;
  currency: string;
  dueDate?: string;
  description?: string;
  status: string;
  businessName?: string;
  businessEmail?: string;
  invoiceNumber?: string;
}

export const generateInvoiceImage: RequestHandler = async (req, res) => {
  try {
    const invoiceData: InvoiceData = req.body;

    console.log('Generating invoice image for:', invoiceData.vendorName);

    const invoiceNumber = invoiceData.invoiceNumber || `INV-${Date.now().toString().slice(-6)}`;
    const currentDate = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const prompt = `Generate a clean, professional invoice document image with the following details:

INVOICE
Invoice Number: ${invoiceNumber}
Date: ${currentDate}
${invoiceData.dueDate ? `Due Date: ${invoiceData.dueDate}` : ''}

FROM:
${invoiceData.businessName || 'Your Company'}
${invoiceData.businessEmail || ''}

BILL TO:
${invoiceData.vendorName}

DESCRIPTION:
${invoiceData.description || 'Professional Services'}

AMOUNT: ${invoiceData.currency} ${invoiceData.amount.toLocaleString()}

Status: ${invoiceData.status.toUpperCase()}

Style: Modern, minimalist business invoice with clean typography, subtle grid lines, professional color scheme (navy blue accents), white background. The invoice should look like a real business document, suitable for professional use.`;

    const imageUrl = await generateImageImagen3(prompt);

    // Update the invoice record with the generated image URL
    if (invoiceData.invoiceId) {
      try {
        await pool.query(
          `UPDATE invoices SET image_url = $1 WHERE id = $2`,
          [imageUrl, invoiceData.invoiceId],
        );
        console.log('Invoice updated with image URL');
      } catch (dbErr) {
        console.error('Failed to update invoice with image:', dbErr);
      }
    }

    res.json({ success: true, imageUrl, invoiceNumber });
  } catch (error) {
    console.error('Error generating invoice image:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message, success: false });
  }
};
