/**
 * Apps Script template for shared Atlas dashboard configuration.
 * Deploy this as a Web App and use the resulting URL in the tracker input.
 *
 * Expected actions:
 * - action=menuConfig&key=MENU_FORECASTING&val=true
 * - action=menuConfig&key=TV_TODAY&val=false
 * - action=adminSettings&targetFormula=...&layout=...
 * - action=columnMappings&mappings=[...]
 */

const SPREADSHEET_ID = '1mNGKDPFNnF1Ca0CtNzyriwTE8zjuwdJei0RafXxna38';
const SHEET_NAMES = {
  setting: 'SETTING',
  adminSettings: 'ADMIN_SETTINGS',
  columnMappings: 'COLUMN_MAPPING',
};

function getSheet(name) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  return ss.getSheetByName(name) || ss.insertSheet(name);
}

function getOrCreateHeader(sheet, headers) {
  const existing = sheet.getDataRange().getValues();
  if (existing.length === 0) {
    sheet.appendRow(headers);
    return;
  }

  const firstRow = existing[0] || [];
  const headerMap = new Map(firstRow.map((value, index) => [String(value).trim(), index]));
  headers.forEach((header, index) => {
    if (!headerMap.has(header)) {
      sheet.getRange(1, firstRow.length + 1 + index).setValue(header);
    }
  });
}

function normalizeValue(raw) {
  if (raw === undefined || raw === null) return '';
  return String(raw);
}

function doGet(e) {
  const action = (e.parameter.action || '').toString().trim();
  const lock = LockService.getScriptLock();
  lock.tryLock(10000);

  try {
    if (action === 'menuConfig') {
      const key = (e.parameter.key || '').toString();
      const val = (e.parameter.val || 'true').toString();
      const sheet = getSheet(SHEET_NAMES.setting);
      getOrCreateHeader(sheet, ['section', 'nama', 'aktif', 'targetType', 'targetValue', 'unit', 'keterangan']);

      const rows = sheet.getDataRange().getValues();
      const targetRow = rows.findIndex(row => String(row[0] || '').trim().toUpperCase() === 'CONFIG' && String(row[1] || '').trim().toUpperCase() === key.toUpperCase());

      if (targetRow >= 0) {
        sheet.getRange(targetRow + 1, 3).setValue(val === 'true' ? 'TRUE' : 'FALSE');
      } else {
        sheet.appendRow(['CONFIG', key, val === 'true' ? 'TRUE' : 'FALSE', '', '', '', '']);
      }

      return ContentService.createTextOutput(JSON.stringify({ ok: true, action, key, val }));
    }

    if (action === 'adminSettings') {
      const sheet = getSheet(SHEET_NAMES.adminSettings);
      getOrCreateHeader(sheet, ['key', 'value']);

      const payload = Object.entries(e.parameter || {})
        .filter(([k]) => k !== 'action' && k !== 't')
        .map(([k, v]) => [k, normalizeValue(v)]);

      const existing = sheet.getDataRange().getValues();
      const rowMap = new Map();
      existing.slice(1).forEach((row, index) => {
        const key = String(row[0] || '').trim();
        if (key) rowMap.set(key, index + 2);
      });

      payload.forEach(([key, value]) => {
        if (!key) return;
        if (rowMap.has(key)) {
          sheet.getRange(rowMap.get(key), 2).setValue(value);
        } else {
          sheet.appendRow([key, value]);
        }
      });

      return ContentService.createTextOutput(JSON.stringify({ ok: true, action, saved: payload.length }));
    }

    if (action === 'columnMappings') {
      const sheet = getSheet(SHEET_NAMES.columnMappings);
      const mappingsRaw = e.parameter.mappings || '[]';
      let mappings = [];
      try {
        mappings = JSON.parse(mappingsRaw);
      } catch (err) {
        return ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'invalid mappings payload' }));
      }

      const headers = ['id', 'sheet', 'feature', 'fieldName', 'columnLetter', 'columnIndex', 'description', 'section', 'dataType', 'optional', 'active', 'uiVisible'];
      getOrCreateHeader(sheet, headers);

      const rows = sheet.getDataRange().getValues();
      const rowById = new Map();
      rows.slice(1).forEach((row, index) => {
        const id = String(row[0] || '').trim();
        if (id) rowById.set(id, index + 2);
      });

      mappings.forEach((mapping) => {
        const values = headers.map(header => {
          const value = mapping[header];
          if (value === undefined || value === null) return '';
          if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
          return String(value);
        });
        const rowNumber = rowById.get(mapping.id);
        if (rowNumber) {
          sheet.getRange(rowNumber, 1, 1, headers.length).setValues([values]);
        } else {
          sheet.appendRow(values);
        }
      });

      return ContentService.createTextOutput(JSON.stringify({ ok: true, action, saved: mappings.length }));
    }

    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'unknown action' }));
  } finally {
    lock.releaseLock();
  }
}

function doPost(e) {
  return doGet(e);
}
