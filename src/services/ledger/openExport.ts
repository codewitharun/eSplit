// src/services/ledger/openExport.ts
// Hands an exported report (a file:// URI in the app's private cache) to
// the Android share sheet, where the user can open it in a PDF/Sheets app,
// save it to Drive/Files, or send it. Replaces react-native-file-viewer.
import * as Sharing from 'expo-sharing';

const MIME = {
  pdf: 'application/pdf',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  csv: 'text/csv',
} as const;

export async function openExportedFile(
  uri: string,
  kind: keyof typeof MIME,
): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) {
    return;
  }
  await Sharing.shareAsync(uri, {
    mimeType: MIME[kind],
    dialogTitle: 'Open or share report',
  });
}
