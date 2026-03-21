import type { Response } from 'express';
import type { AuthedRequest } from '../middleware/auth.js';
import { pool } from '../db/pool.js';

// Simple CSV parser that handles quoted fields and commas inside quotes
function parseCSV(content: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = '';
  let insideQuotes = false;

  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    const nextChar = content[i + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        currentCell += '"';
        i++;
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === ',' && !insideQuotes) {
      currentRow.push(currentCell.trim());
      currentCell = '';
    } else if ((char === '\n' || (char === '\r' && nextChar === '\n')) && !insideQuotes) {
      currentRow.push(currentCell.trim());
      if (currentRow.some(cell => cell !== '')) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentCell = '';
      if (char === '\r') i++;
    } else if (char !== '\r') {
      currentCell += char;
    }
  }

  if (currentCell !== '' || currentRow.length > 0) {
    currentRow.push(currentCell.trim());
    if (currentRow.some(cell => cell !== '')) {
      rows.push(currentRow);
    }
  }

  return rows;
}

function parseTSV(content: string): string[][] {
  const lines = content.split(/\r?\n/).filter(line => line.trim() !== '');
  return lines.map(line => line.split('\t').map(cell => cell.trim()));
}

function parseSpreadsheetContent(content: string): string[][] {
  const firstLine = content.split(/\r?\n/)[0];
  if (firstLine.includes('\t') && !firstLine.includes(',')) {
    return parseTSV(content);
  }
  return parseCSV(content);
}

function parseValue(val: string): string | number | boolean | null {
  if (val === '' || val === null || val === undefined) return null;
  if (val.toLowerCase() === 'true') return true;
  if (val.toLowerCase() === 'false') return false;
  const cleanedNum = val.replace(/[$,]/g, '');
  if (!isNaN(Number(cleanedNum)) && cleanedNum !== '') {
    return Number(cleanedNum);
  }
  return val;
}

export const parseDatasheet = async (req: AuthedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.auth!.userId;
    const { fileUrl, fileName, name, description } = req.body;

    if (!fileUrl || !fileName || !name || !description) {
      res.status(400).json({
        error: 'Missing required fields: fileUrl, fileName, name, description',
      });
      return;
    }

    const fileExtension = fileName.split('.').pop()?.toLowerCase() || '';

    if (!['csv', 'tsv', 'txt'].includes(fileExtension)) {
      if (['xls', 'xlsx'].includes(fileExtension)) {
        res.status(400).json({
          error:
            'Excel files (.xlsx, .xls) need to be converted to CSV format first. Please save your Excel file as CSV (File > Save As > CSV) and upload again.',
          suggestion: 'csv_required',
        });
        return;
      }
      res.status(400).json({
        error: `Unsupported file format: .${fileExtension}. Please upload a CSV file.`,
      });
      return;
    }

    console.log(`Fetching file from: ${fileUrl}`);
    const fileResponse = await fetch(fileUrl);
    if (!fileResponse.ok) {
      throw new Error(`Failed to fetch file: ${fileResponse.statusText}`);
    }

    const textContent = await fileResponse.text();
    console.log(`File fetched, size: ${textContent.length} characters`);

    const parsedData = parseSpreadsheetContent(textContent);

    if (parsedData.length < 2) {
      res.status(400).json({
        error: 'File must have at least a header row and one data row',
      });
      return;
    }

    const rawHeaders = parsedData[0];
    const headers = rawHeaders.map((h, i) => {
      if (!h || h.trim() === '') return `Column_${i + 1}`;
      return h.trim();
    });

    const dataRows = parsedData.slice(1);
    const validRows = dataRows.filter(row =>
      row.some(cell => cell !== null && cell !== undefined && String(cell).trim() !== ''),
    );

    console.log(`Parsed ${headers.length} columns and ${validRows.length} data rows`);

    // Create the datasheet metadata record
    const datasheetResult = await pool.query(
      `INSERT INTO user_datasheets (user_id, name, description, file_name, file_url, column_names, row_count)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [userId, name, description, fileName, fileUrl, JSON.stringify(headers), validRows.length],
    );
    const datasheet = datasheetResult.rows[0];

    console.log(`Created datasheet record: ${datasheet.id}`);

    // Insert rows in batches
    const BATCH_SIZE = 100;
    let insertedRows = 0;

    for (let i = 0; i < validRows.length; i += BATCH_SIZE) {
      const batch = validRows.slice(i, i + BATCH_SIZE);

      for (let j = 0; j < batch.length; j++) {
        const row = batch[j];
        const rowData: Record<string, unknown> = {};
        headers.forEach((header, colIndex) => {
          const cellValue = row[colIndex];
          rowData[header] = parseValue(cellValue || '');
        });

        try {
          await pool.query(
            `INSERT INTO datasheet_rows (datasheet_id, user_id, row_index, row_data)
             VALUES ($1, $2, $3, $4)`,
            [datasheet.id, userId, i + j, JSON.stringify(rowData)],
          );
          insertedRows++;
        } catch (rowErr) {
          console.error(`Failed to insert row ${i + j}:`, rowErr);
        }
      }
    }

    console.log(`Inserted ${insertedRows} rows into datasheet_rows`);

    res.json({
      success: true,
      datasheet: {
        id: datasheet.id,
        name: datasheet.name,
        description: datasheet.description,
        fileName: datasheet.file_name,
        columnNames: datasheet.column_names,
        rowCount: validRows.length,
        insertedRows,
      },
    });
  } catch (error: unknown) {
    console.error('Parse datasheet error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: errorMessage });
  }
};
