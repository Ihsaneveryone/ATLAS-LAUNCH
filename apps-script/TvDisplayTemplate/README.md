# AZKO TV Display Template

This is a standalone Google Apps Script web app. It lives separately from the Atlas website; editing or deploying this project does not change Atlas.

## Configure the sources

1. Create a new Apps Script project at [script.google.com](https://script.google.com/) and copy `Code.gs` and `Index.html` from this folder.
2. In `Code.gs`, set `TV_CONFIG.spreadsheetId` to the new source Spreadsheet ID and `TV_CONFIG.mediaFolderId` to the Drive folder ID. Leave the media folder ID empty if no Drive media is needed.
3. Confirm or change the sheet names in `TV_CONFIG.sheetNames`.
4. Enable `appsscript.json` in project settings if necessary. Save, run `getTvDisplayData` once in the Apps Script editor, and authorize read-only access to the configured Spreadsheet and Drive folder.
5. Deploy as a web app. Use **Execute as: Me** and restrict **Who has access** to the appropriate Google Workspace users/domain. Do not publish employee sales data to anyone with a link unless that data is approved for public display.

## Spreadsheet format

The template uses the following tabs. Header matching is case-insensitive and supports common Indonesian/English names; fallback column indexes follow the current Atlas COPAS S2 and TARGET layout.

| Tab | Required columns |
| --- | --- |
| `COPAS S2` | NIK, Nama, Tanggal, Receipt, Artikel, Qty, Total Value |
| `TARGET` | NIK, Nama, Target Sales Daily, Target Sales Bulan (or Target Month); optional Target MTD Karyawan and Job Title |
| `TV DEPARTEMEN` | Department, Zone, Sales Today, Target Today, Sales MTD, Target MTD |
| `TV RECEIPT` | NIK, Nama, Qualifying Receipt, Target Minimal Cair, Progress, Total Value Receipt, Insentif per Receipt, Total Insentif, Status |
| `INSENTIF BOOMSALE` | Artikel, Nama Produk, Target Qty, optional Image URL |

Sales rankings and product quantity totals are calculated from `COPAS S2`. The SID/source rows are treated as the intended current-month dataset and are not filtered by month in the template; the Today slide alone matches the transaction date to today's Jakarta date. Department and receipt tabs are precomputed/imported presentation tables. TV media is read from the configured Drive folder; supported files are images and PDFs. To display Drive media on the TV, ensure the TV browser account can view each file or that the file's sharing policy permits the display URL to load.

## TV controls

- Slides advance automatically and refresh source data every 60 seconds.
- Press **F** to toggle fullscreen; use **left/right arrows** to navigate slides.
- Missing required source data is shown as a visible error on the TV rather than replaced with mock data.
