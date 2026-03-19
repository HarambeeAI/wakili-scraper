// PA Drive tools: searchDrive
// Covers PA-08

import { google } from "googleapis";
import { getGoogleClient } from "./google-auth.js";
import type { DriveFile } from "./types.js";

/**
 * PA-08: Search Google Drive for files matching a query.
 * Searches both full text content and file names, ordered by modified time.
 */
export async function searchDrive(
  userId: string,
  query: string,
  maxResults: number = 10,
): Promise<{ files: DriveFile[]; count: number; message: string }> {
  const auth = await getGoogleClient(userId);
  const drive = google.drive({ version: "v3", auth });

  const { data } = await drive.files.list({
    q: `fullText contains '${query.replace(/'/g, "\\'")}' or name contains '${query.replace(/'/g, "\\'")}'`,
    fields: "files(id, name, mimeType, webViewLink, modifiedTime, size)",
    pageSize: maxResults,
    orderBy: "modifiedTime desc",
  });

  const items = data.files ?? [];

  if (items.length === 0) {
    return {
      files: [],
      count: 0,
      message: `No files found matching "${query}".`,
    };
  }

  const files: DriveFile[] = items.map((item) => ({
    id: item.id ?? "",
    name: item.name ?? "",
    mimeType: item.mimeType ?? "",
    webViewLink: item.webViewLink ?? "",
    modifiedTime: item.modifiedTime ?? "",
    size: item.size ?? undefined,
  }));

  return {
    files,
    count: files.length,
    message: `Found ${files.length} file(s) matching "${query}".`,
  };
}
