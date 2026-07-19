/**
 * Column Mapping Service
 * Manages which columns from spreadsheets are used in the application.
 * Allows admin to configure data extraction rules for all features.
 * 
 * Features supported:
 * - Performance SID: Individual sales performance (TODAY, MTD, YTD)
 * - Performance Toko: Store performance metrics
 * - Target Management: Sales and transaction targets
 * - Category Classification: SKU categorization
 */

import { writeColumnMappingsToSheet } from './loginTracker'

export type DataFeature = 'Performance SID' | 'Performance Toko' | 'Target Management' | 'Member Tracking' | 'Category'

export interface ColumnMapping {
  id: string                 // unique identifier: "COPAS_S2_NIK"
  sheet: string              // sheet name: "COPAS S2", "TARGET", "SETTING", "Pencapaian Toko"
  feature: DataFeature       // which feature uses this: "Performance SID", "Performance Toko"
  fieldName: string          // field name: "nik", "nama", "tanggal", "totalValue"
  columnLetter: string       // spreadsheet column: "A", "B", "C", "L"
  columnIndex: number        // 0-indexed: 0, 1, 2, 11
  description: string        // human-readable: "Employee NIK"
  section?: string           // sub-section within feature: "TODAY", "MTD", "DAILY", "MTD"
  dataType: 'text' | 'number' | 'date' | 'currency' // expected data type
  optional: boolean          // can be skipped if not found
  active: boolean            // is this mapping active
  uiVisible?: boolean        // show in the admin settings UI
}

export interface SheetColumnConfig {
  sheet: string              // "COPAS S2", "TARGET", etc
  columns: ColumnMapping[]   // all available/configured columns
}

// Default mapping based on current hardcoded structure
export const DEFAULT_COLUMN_MAPPINGS: ColumnMapping[] = [
  // ════════════════════════════════════════════════════════════════════════════════════════════════
  // FEATURE: PERFORMANCE SID (Individual Sales Performance - Today, MTD)
  // Sheet: COPAS S2 (Transaction Data)
  // ════════════════════════════════════════════════════════════════════════════════════════════════

  // ── Employee Identification ──
  { id: 'COPAS_S2_NIK', sheet: 'COPAS S2', feature: 'Performance SID', fieldName: 'nik', columnLetter: 'A', columnIndex: 0, description: 'Employee NIK (ID)', dataType: 'text', optional: false, active: true, section: 'Employee' },
  { id: 'COPAS_S2_NAMA', sheet: 'COPAS S2', feature: 'Performance SID', fieldName: 'nama', columnLetter: 'B', columnIndex: 1, description: 'Employee Name', dataType: 'text', optional: false, active: true, section: 'Employee' },

  // ── Transaction Details ──
  { id: 'COPAS_S2_TANGGAL', sheet: 'COPAS S2', feature: 'Performance SID', fieldName: 'tanggal', columnLetter: 'C', columnIndex: 2, description: 'Transaction Date (DD-MMM-YYYY or DD/MM/YYYY)', dataType: 'date', optional: false, active: true, section: 'Transaction' },
  { id: 'COPAS_S2_RECEIPT_NO', sheet: 'COPAS S2', feature: 'Performance SID', fieldName: 'receiptNo', columnLetter: 'D', columnIndex: 3, description: 'Receipt/Invoice Number', dataType: 'text', optional: true, active: true, section: 'Transaction' },

  // ── Product Details ──
  { id: 'COPAS_S2_ARTIKEL', sheet: 'COPAS S2', feature: 'Performance SID', fieldName: 'artikel', columnLetter: 'E', columnIndex: 4, description: 'Article Code (untuk category classification)', dataType: 'text', optional: false, active: true, section: 'Product' },
  { id: 'COPAS_S2_DESKRIPSI', sheet: 'COPAS S2', feature: 'Performance SID', fieldName: 'deskripsi', columnLetter: 'F', columnIndex: 5, description: 'Product Description', dataType: 'text', optional: true, active: true, section: 'Product', uiVisible: false },
  { id: 'COPAS_S2_KODE', sheet: 'COPAS S2', feature: 'Performance SID', fieldName: 'kode', columnLetter: 'G', columnIndex: 6, description: 'Product Code', dataType: 'text', optional: true, active: true, section: 'Product', uiVisible: false },

  // ── Sales Metrics ──
  { id: 'COPAS_S2_QTY', sheet: 'COPAS S2', feature: 'Performance SID', fieldName: 'qty', columnLetter: 'H', columnIndex: 7, description: 'Quantity/Units Sold', dataType: 'number', optional: false, active: true, section: 'Sales' },
  { id: 'COPAS_S2_TOTAL_VALUE', sheet: 'COPAS S2', feature: 'Performance SID', fieldName: 'totalValue', columnLetter: 'L', columnIndex: 11, description: 'Total Sales Value (Rp)', dataType: 'currency', optional: false, active: true, section: 'Sales' },

  // ════════════════════════════════════════════════════════════════════════════════════════════════
  // FEATURE: PERFORMANCE SID - TARGET DATA
  // Sheet: TARGET
  // ════════════════════════════════════════════════════════════════════════════════════════════════

  { id: 'TARGET_NIK', sheet: 'TARGET', feature: 'Performance SID', fieldName: 'nik', columnLetter: 'A', columnIndex: 0, description: 'Employee NIK', dataType: 'text', optional: false, active: true, section: 'Target Setup' },
  { id: 'TARGET_NAMA', sheet: 'TARGET', feature: 'Performance SID', fieldName: 'nama', columnLetter: 'B', columnIndex: 1, description: 'Employee Name', dataType: 'text', optional: false, active: true, section: 'Target Setup' },
  { id: 'TARGET_DAILY', sheet: 'TARGET', feature: 'Performance SID', fieldName: 'targetDaily', columnLetter: 'C', columnIndex: 2, description: 'Daily Sales Target (Rp)', dataType: 'currency', optional: false, active: true, section: 'Target Setup' },
  { id: 'TARGET_MONTHLY', sheet: 'TARGET', feature: 'Performance SID', fieldName: 'targetMonthly', columnLetter: 'D', columnIndex: 3, description: 'Monthly Sales Target (Rp)', dataType: 'currency', optional: true, active: true, section: 'Target Setup' },
  { id: 'TARGET_TRX_DAILY', sheet: 'TARGET', feature: 'Performance SID', fieldName: 'targetTrxDaily', columnLetter: 'E', columnIndex: 4, description: 'Daily Transaction Target (count)', dataType: 'number', optional: true, active: true, section: 'Target Setup' },
  { id: 'TARGET_TRX_MONTHLY', sheet: 'TARGET', feature: 'Performance SID', fieldName: 'targetTrxMonthly', columnLetter: 'F', columnIndex: 5, description: 'Monthly Transaction Target (count)', dataType: 'number', optional: true, active: true, section: 'Target Setup' },
  { id: 'TARGET_BASKET_SIZE_DAILY', sheet: 'TARGET', feature: 'Performance SID', fieldName: 'targetBasketSizeDaily', columnLetter: 'G', columnIndex: 6, description: 'Daily Basket Size Target (Rp)', dataType: 'currency', optional: true, active: true, section: 'Target Setup' },
  { id: 'TARGET_BASKET_SIZE_MONTHLY', sheet: 'TARGET', feature: 'Performance SID', fieldName: 'targetBasketSizeMonthly', columnLetter: 'H', columnIndex: 7, description: 'Monthly Basket Size Target (Rp)', dataType: 'currency', optional: true, active: true, section: 'Target Setup' },
  { id: 'TARGET_JOB_TITLE', sheet: 'TARGET', feature: 'Performance SID', fieldName: 'jobTitle', columnLetter: 'I', columnIndex: 8, description: 'Job Title (SPV, Kasir, dll)', dataType: 'text', optional: true, active: true, section: 'Target Setup' },

  // ════════════════════════════════════════════════════════════════════════════════════════════════
  // FEATURE: PERFORMANCE TOKO (Store Performance - Daily and MTD)
  // Sheet: Pencapaian Toko
  // ════════════════════════════════════════════════════════════════════════════════════════════════

  // ── Basic Info ──
  { id: 'TOKO_DATE', sheet: 'Pencapaian Toko', feature: 'Performance Toko', fieldName: 'date', columnLetter: 'B', columnIndex: 1, description: 'Date (DD/MM/YYYY)', dataType: 'date', optional: false, active: true, section: 'Basic' },

  // ── DAILY METRICS ──
  // Traffic
  { id: 'TOKO_TRAFFIC_DAILY', sheet: 'Pencapaian Toko', feature: 'Performance Toko', fieldName: 'trafficDaily', columnLetter: 'D', columnIndex: 3, description: 'Daily Store Traffic (visitors)', dataType: 'number', optional: true, active: true, section: 'Daily' },
  { id: 'TOKO_TARGET_TRAFFIC_DAILY', sheet: 'Pencapaian Toko', feature: 'Performance Toko', fieldName: 'targetTrafficDaily', columnLetter: 'R', columnIndex: 17, description: 'Daily Traffic Target', dataType: 'number', optional: true, active: true, section: 'Daily' },

  // Transactions
  { id: 'TOKO_TRANSAKSI_DAILY', sheet: 'Pencapaian Toko', feature: 'Performance Toko', fieldName: 'transaksiDaily', columnLetter: 'E', columnIndex: 4, description: 'Daily Transactions (count)', dataType: 'number', optional: true, active: true, section: 'Daily' },
  { id: 'TOKO_TARGET_TRANSAKSI_DAILY', sheet: 'Pencapaian Toko', feature: 'Performance Toko', fieldName: 'targetTransaksiDaily', columnLetter: 'W', columnIndex: 22, description: 'Daily Transaction Target', dataType: 'number', optional: true, active: true, section: 'Daily' },

  // Special Categories
  { id: 'TOKO_PROTEKSI_DAILY', sheet: 'Pencapaian Toko', feature: 'Performance Toko', fieldName: 'proteksiDaily', columnLetter: 'F', columnIndex: 5, description: 'Proteksi Products (count)', dataType: 'number', optional: true, active: true, section: 'Daily' },
  { id: 'TOKO_NEW_MEMBER_DAILY', sheet: 'Pencapaian Toko', feature: 'Performance Toko', fieldName: 'newMemberDaily', columnLetter: 'G', columnIndex: 6, description: 'New Members (daily)', dataType: 'number', optional: true, active: true, section: 'Daily' },
  { id: 'TOKO_INSTANT_UPGRADE_DAILY', sheet: 'Pencapaian Toko', feature: 'Performance Toko', fieldName: 'instantUpgradeDaily', columnLetter: 'H', columnIndex: 7, description: 'Instant Upgrade (count)', dataType: 'number', optional: true, active: true, section: 'Daily' },
  { id: 'TOKO_TARGET_NEW_MEMBER_DAILY', sheet: 'Pencapaian Toko', feature: 'Performance Toko', fieldName: 'targetNewMemberDaily', columnLetter: 'AM', columnIndex: 38, description: 'New Members Daily Target', dataType: 'number', optional: true, active: true, section: 'Daily' },
  { id: 'TOKO_TARGET_PROTEKSI_DAILY', sheet: 'Pencapaian Toko', feature: 'Performance Toko', fieldName: 'targetProteksiDaily', columnLetter: 'AH', columnIndex: 33, description: 'Proteksi Daily Target', dataType: 'number', optional: true, active: true, section: 'Daily' },

  // Sales Channel
  { id: 'TOKO_SALES_OFFLINE_DAILY', sheet: 'Pencapaian Toko', feature: 'Performance Toko', fieldName: 'salesOfflineDaily', columnLetter: 'O', columnIndex: 14, description: 'Offline Sales (Rp)', dataType: 'currency', optional: true, active: true, section: 'Daily' },
  { id: 'TOKO_SALES_ONLINE_DAILY', sheet: 'Pencapaian Toko', feature: 'Performance Toko', fieldName: 'salesOnlineDaily', columnLetter: 'Q', columnIndex: 16, description: 'Online Sales (Rp)', dataType: 'currency', optional: true, active: true, section: 'Daily' },
  { id: 'TOKO_TARGET_ONLINE_DAILY', sheet: 'Pencapaian Toko', feature: 'Performance Toko', fieldName: 'targetOnlineDaily', columnLetter: 'P', columnIndex: 15, description: 'Online Sales Daily Target (Rp)', dataType: 'currency', optional: true, active: true, section: 'Daily' },

  // Total Sales
  { id: 'TOKO_SALES_DAILY', sheet: 'Pencapaian Toko', feature: 'Performance Toko', fieldName: 'salesDaily', columnLetter: 'J', columnIndex: 9, description: 'Total Daily Sales (Rp)', dataType: 'currency', optional: false, active: true, section: 'Daily' },
  { id: 'TOKO_TARGET_SALES_DAILY', sheet: 'Pencapaian Toko', feature: 'Performance Toko', fieldName: 'targetSalesDaily', columnLetter: 'I', columnIndex: 8, description: 'Daily Sales Target (Rp)', dataType: 'currency', optional: false, active: true, section: 'Daily' },

  // Basket Size
  { id: 'TOKO_BASKET_SIZE_DAILY', sheet: 'Pencapaian Toko', feature: 'Performance Toko', fieldName: 'basketSizeDaily', columnLetter: 'AC', columnIndex: 28, description: 'Avg Basket Size (Rp)', dataType: 'currency', optional: true, active: true, section: 'Daily' },
  { id: 'TOKO_TARGET_BASKET_SIZE_DAILY', sheet: 'Pencapaian Toko', feature: 'Performance Toko', fieldName: 'targetBasketSizeDaily', columnLetter: 'AB', columnIndex: 27, description: 'Avg Basket Size Daily Target (Rp)', dataType: 'currency', optional: true, active: true, section: 'Daily' },

  // ── MTD METRICS ──
  // Sales
  { id: 'TOKO_SALES_MTD', sheet: 'Pencapaian Toko', feature: 'Performance Toko', fieldName: 'salesMTD', columnLetter: 'M', columnIndex: 12, description: 'MTD Sales (Rp)', dataType: 'currency', optional: false, active: true, section: 'MTD' },
  { id: 'TOKO_TARGET_SALES_MTD', sheet: 'Pencapaian Toko', feature: 'Performance Toko', fieldName: 'targetSalesMTD', columnLetter: 'L', columnIndex: 11, description: 'MTD Sales Target (Rp)', dataType: 'currency', optional: false, active: true, section: 'MTD' },

  // Traffic
  { id: 'TOKO_TRAFFIC_MTD', sheet: 'Pencapaian Toko', feature: 'Performance Toko', fieldName: 'trafficMTD', columnLetter: 'U', columnIndex: 20, description: 'MTD Traffic (visitors)', dataType: 'number', optional: true, active: true, section: 'MTD' },
  { id: 'TOKO_TARGET_TRAFFIC_MTD', sheet: 'Pencapaian Toko', feature: 'Performance Toko', fieldName: 'targetTrafficMTD', columnLetter: 'T', columnIndex: 19, description: 'MTD Traffic Target', dataType: 'number', optional: true, active: true, section: 'MTD' },

  // Transactions
  { id: 'TOKO_TRANSAKSI_MTD', sheet: 'Pencapaian Toko', feature: 'Performance Toko', fieldName: 'transaksiMTD', columnLetter: 'Z', columnIndex: 25, description: 'MTD Transactions', dataType: 'number', optional: true, active: true, section: 'MTD' },
  { id: 'TOKO_TARGET_TRANSAKSI_MTD', sheet: 'Pencapaian Toko', feature: 'Performance Toko', fieldName: 'targetTransaksiMTD', columnLetter: 'Y', columnIndex: 24, description: 'MTD Transaction Target', dataType: 'number', optional: true, active: true, section: 'MTD' },

  // New Members
  { id: 'TOKO_NEW_MEMBER_MTD', sheet: 'Pencapaian Toko', feature: 'Performance Toko', fieldName: 'newMemberMTD', columnLetter: 'AP', columnIndex: 41, description: 'New Members MTD', dataType: 'number', optional: true, active: true, section: 'MTD' },
  { id: 'TOKO_TARGET_NEW_MEMBER_MTD', sheet: 'Pencapaian Toko', feature: 'Performance Toko', fieldName: 'targetNewMemberMTD', columnLetter: 'AO', columnIndex: 40, description: 'New Members MTD Target', dataType: 'number', optional: true, active: true, section: 'MTD' },

  // Proteksi
  { id: 'TOKO_PROTEKSI_MTD', sheet: 'Pencapaian Toko', feature: 'Performance Toko', fieldName: 'proteksiMTD', columnLetter: 'AK', columnIndex: 36, description: 'Proteksi MTD', dataType: 'number', optional: true, active: true, section: 'MTD' },
  { id: 'TOKO_TARGET_PROTEKSI_MTD', sheet: 'Pencapaian Toko', feature: 'Performance Toko', fieldName: 'targetProteksiMTD', columnLetter: 'AJ', columnIndex: 35, description: 'Proteksi MTD Target', dataType: 'number', optional: true, active: true, section: 'MTD' },

  // Online Sales
  { id: 'TOKO_SALES_ONLINE_MTD', sheet: 'Pencapaian Toko', feature: 'Performance Toko', fieldName: 'salesOnlineMTD', columnLetter: 'AX', columnIndex: 49, description: 'Online Sales MTD (Rp)', dataType: 'currency', optional: true, active: true, section: 'MTD' },
  { id: 'TOKO_TARGET_ONLINE_MTD', sheet: 'Pencapaian Toko', feature: 'Performance Toko', fieldName: 'targetOnlineMTD', columnLetter: 'AW', columnIndex: 48, description: 'Online Sales MTD Target (Rp)', dataType: 'currency', optional: true, active: true, section: 'MTD' },

  // Basket Size
  { id: 'TOKO_BASKET_SIZE_MTD', sheet: 'Pencapaian Toko', feature: 'Performance Toko', fieldName: 'basketSizeMTD', columnLetter: 'AF', columnIndex: 31, description: 'Avg Basket Size MTD (Rp)', dataType: 'currency', optional: true, active: true, section: 'MTD' },
  { id: 'TOKO_TARGET_BASKET_SIZE_MTD', sheet: 'Pencapaian Toko', feature: 'Performance Toko', fieldName: 'targetBasketSizeMTD', columnLetter: 'AE', columnIndex: 30, description: 'Avg Basket Size MTD Target (Rp)', dataType: 'currency', optional: true, active: true, section: 'MTD' },

  // ════════════════════════════════════════════════════════════════════════════════════════════════
  // FEATURE: SETTING (Configuration for KPI and Menu)
  // Sheet: SETTING
  // ════════════════════════════════════════════════════════════════════════════════════════════════

  { id: 'SETTING_SECTION', sheet: 'SETTING', feature: 'Target Management', fieldName: 'section', columnLetter: 'A', columnIndex: 0, description: 'Section (KPI, KATEGORI, CONFIG)', dataType: 'text', optional: false, active: true, section: 'Configuration' },
  { id: 'SETTING_NAMA', sheet: 'SETTING', feature: 'Target Management', fieldName: 'nama', columnLetter: 'B', columnIndex: 1, description: 'Setting Name (e.g., Transaksi, Proteksi)', dataType: 'text', optional: false, active: true, section: 'Configuration' },
  { id: 'SETTING_AKTIF', sheet: 'SETTING', feature: 'Target Management', fieldName: 'aktif', columnLetter: 'C', columnIndex: 2, description: 'Active (TRUE/FALSE)', dataType: 'text', optional: true, active: true, section: 'Configuration' },
  { id: 'SETTING_TARGET_TYPE', sheet: 'SETTING', feature: 'Target Management', fieldName: 'targetType', columnLetter: 'D', columnIndex: 3, description: 'Target Type (sheet, per_trx, pct_harian, dll)', dataType: 'text', optional: true, active: true, section: 'Configuration' },
  { id: 'SETTING_TARGET_VALUE', sheet: 'SETTING', feature: 'Target Management', fieldName: 'targetValue', columnLetter: 'E', columnIndex: 4, description: 'Target Value', dataType: 'number', optional: true, active: true, section: 'Configuration' },
  { id: 'SETTING_UNIT', sheet: 'SETTING', feature: 'Target Management', fieldName: 'unit', columnLetter: 'F', columnIndex: 5, description: 'Unit (Rp, qty, count, dll)', dataType: 'text', optional: true, active: true, section: 'Configuration' },
  { id: 'SETTING_KETERANGAN', sheet: 'SETTING', feature: 'Target Management', fieldName: 'keterangan', columnLetter: 'G', columnIndex: 6, description: 'Description/Notes', dataType: 'text', optional: true, active: true, section: 'Configuration' },

  // ════════════════════════════════════════════════════════════════════════════════════════════════
  // FEATURE: MEMBER (New Member Tracking)
  // Sheet: MEMBER (2 tables)
  // ════════════════════════════════════════════════════════════════════════════════════════════════

  // Table 1
  { id: 'MEMBER_TABLE1_TANGGAL', sheet: 'MEMBER', feature: 'Member Tracking', fieldName: 'table1Tanggal', columnLetter: 'B', columnIndex: 1, description: 'Table 1: Date', dataType: 'date', optional: true, active: true, section: 'Table 1' },
  { id: 'MEMBER_TABLE1_LABEL', sheet: 'MEMBER', feature: 'Member Tracking', fieldName: 'table1Label', columnLetter: 'E', columnIndex: 4, description: 'Table 1: Label (contains "NEW MEMBER")', dataType: 'text', optional: true, active: true, section: 'Table 1' },
  { id: 'MEMBER_TABLE1_NAMA', sheet: 'MEMBER', feature: 'Member Tracking', fieldName: 'table1Nama', columnLetter: 'F', columnIndex: 5, description: 'Table 1: Employee Name', dataType: 'text', optional: true, active: true, section: 'Table 1' },

  // Table 2
  { id: 'MEMBER_TABLE2_TANGGAL', sheet: 'MEMBER', feature: 'Member Tracking', fieldName: 'table2Tanggal', columnLetter: 'H', columnIndex: 7, description: 'Table 2: Date', dataType: 'date', optional: true, active: true, section: 'Table 2' },
  { id: 'MEMBER_TABLE2_NIK', sheet: 'MEMBER', feature: 'Member Tracking', fieldName: 'table2Nik', columnLetter: 'J', columnIndex: 9, description: 'Table 2: Employee NIK', dataType: 'text', optional: true, active: true, section: 'Table 2' },
  { id: 'MEMBER_TABLE2_COUNT', sheet: 'MEMBER', feature: 'Member Tracking', fieldName: 'table2Count', columnLetter: 'K', columnIndex: 10, description: 'Table 2: New Member Count (text or number)', dataType: 'number', optional: true, active: true, section: 'Table 2' },

  // ════════════════════════════════════════════════════════════════════════════════════════════════
  // FEATURE: CATEGORY (SKU Categorization)
  // Sheet: KUNCIAN SKU
  // ════════════════════════════════════════════════════════════════════════════════════════════════

  // Note: KUNCIAN SKU has dynamic headers — categories are defined in first row
  // Columns contain article codes for each category
  { id: 'SKU_ARTICLE_CODE', sheet: 'KUNCIAN SKU', feature: 'Category', fieldName: 'articleCode', columnLetter: 'A', columnIndex: 0, description: 'Article Code (each column is a category)', dataType: 'text', optional: false, active: true, section: 'Categories', uiVisible: false },

  // ════════════════════════════════════════════════════════════════════════════════════════════════
  // FEATURE: PERFORMANCE SID - YTD DATA
  // Sheet: YEAR TO DATE
  // ════════════════════════════════════════════════════════════════════════════════════════════════

  { id: 'YTD_NIK', sheet: 'YEAR TO DATE', feature: 'Performance SID', fieldName: 'nik', columnLetter: 'A', columnIndex: 0, description: 'Employee NIK for YTD data', dataType: 'text', optional: false, active: true, section: 'Summary' },
  { id: 'YTD_NAMA', sheet: 'YEAR TO DATE', feature: 'Performance SID', fieldName: 'nama', columnLetter: 'B', columnIndex: 1, description: 'Employee Name for YTD data', dataType: 'text', optional: false, active: true, section: 'Summary' },
  { id: 'YTD_QUADRANT', sheet: 'YEAR TO DATE', feature: 'Performance SID', fieldName: 'quadrant', columnLetter: 'D', columnIndex: 3, description: 'YTD Quadrant', dataType: 'text', optional: true, active: true, section: 'Summary' },
  { id: 'YTD_SCORE', sheet: 'YEAR TO DATE', feature: 'Performance SID', fieldName: 'score', columnLetter: 'E', columnIndex: 4, description: 'YTD Score', dataType: 'number', optional: true, active: true, section: 'Summary' },
  { id: 'YTD_COLOR_ZONE', sheet: 'YEAR TO DATE', feature: 'Performance SID', fieldName: 'colorZone', columnLetter: 'F', columnIndex: 5, description: 'YTD Color Zone', dataType: 'text', optional: true, active: true, section: 'Summary' },
  { id: 'YTD_SALES_PCT', sheet: 'YEAR TO DATE', feature: 'Performance SID', fieldName: 'salesPct', columnLetter: 'H', columnIndex: 7, description: 'YTD Sales %', dataType: 'number', optional: true, active: true, section: 'Summary' },
  { id: 'YTD_MONTHLY_BLOCK_START', sheet: 'YEAR TO DATE', feature: 'Performance SID', fieldName: 'monthlyBlockStart', columnLetter: 'J', columnIndex: 9, description: 'Starting column for monthly YTD blocks', dataType: 'number', optional: false, active: true, section: 'Monthly' },
]

const STORAGE_KEY = 'atlas_column_mappings_v1'
const COLUMN_MAPPING_SHEET = 'COLUMN_MAPPING'
const SHEET_ID = '1mNGKDPFNnF1Ca0CtNzyriwTE8zjuwdJei0RafXxna38'
let columnMappingsCache: ColumnMapping[] | null = null
let columnMappingSyncStarted = false

function parseCSV(text: string): string[][] {
  const rows: string[][] = []
  for (const line of text.split('\n')) {
    if (!line.trim()) continue
    const cells: string[] = []
    let inQuote = false
    let cell = ''
    for (let i = 0; i < line.length; i++) {
      const c = line[i]
      if (c === '"') {
        if (inQuote && line[i + 1] === '"') { cell += '"'; i++ }
        else { inQuote = !inQuote }
      } else if (c === ',' && !inQuote) {
        cells.push(cell)
        cell = ''
      } else {
        cell += c
      }
    }
    cells.push(cell)
    rows.push(cells)
  }
  return rows
}

function parseBoolean(value: string | undefined): boolean {
  const normalized = (value ?? '').trim().toLowerCase()
  return normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'on'
}

function parseColumnMappingsFromRows(rows: string[][]): ColumnMapping[] {
  if (rows.length < 2) return []

  const headers = rows[0].map(header => header.trim())
  const parsed: ColumnMapping[] = []

  for (const row of rows.slice(1)) {
    if (!row.some(cell => (cell ?? '').trim())) continue

    const record: Record<string, string> = {}
    headers.forEach((header, index) => {
      record[header] = row[index] ?? ''
    })

    const id = (record.id || '').trim()
    if (!id) continue

    const base = DEFAULT_COLUMN_MAPPINGS.find(mapping => mapping.id === id)
    const fallback = base ?? DEFAULT_COLUMN_MAPPINGS[0]
    parsed.push({
      ...fallback,
      id,
      sheet: record.sheet || fallback.sheet,
      feature: (record.feature as DataFeature) || fallback.feature,
      fieldName: record.fieldName || fallback.fieldName,
      columnLetter: record.columnLetter || fallback.columnLetter,
      columnIndex: Number(record.columnIndex ?? fallback.columnIndex) || fallback.columnIndex,
      description: record.description || fallback.description,
      section: record.section || fallback.section,
      dataType: (record.dataType as ColumnMapping['dataType']) || fallback.dataType,
      optional: parseBoolean(record.optional ?? String(fallback.optional)),
      active: parseBoolean(record.active ?? String(fallback.active)),
      uiVisible: record.uiVisible === '' ? fallback.uiVisible : parseBoolean(record.uiVisible ?? String(fallback.uiVisible ?? true)),
    })
  }

  return parsed
}

function normalizeColumnMappings(mappings: ColumnMapping[] = DEFAULT_COLUMN_MAPPINGS): ColumnMapping[] {
  const storedById = new Map(mappings.map(mapping => [mapping.id, mapping]))
  return DEFAULT_COLUMN_MAPPINGS.map(defaultMapping => {
    const storedMapping = storedById.get(defaultMapping.id)
    return storedMapping ? { ...defaultMapping, ...storedMapping } : defaultMapping
  })
}

function getVisibleMappings(mappings: ColumnMapping[] = getColumnMappings()): ColumnMapping[] {
  return mappings.filter(mapping => mapping.uiVisible !== false)
}

export function columnLetterToIndex(columnLetter: string): number {
  const normalized = (columnLetter || '').trim().toUpperCase()
  if (!normalized) return -1

  let result = 0
  for (const char of normalized) {
    const code = char.charCodeAt(0) - 64
    if (code < 1 || code > 26) return -1
    result = result * 26 + code
  }

  return result - 1
}

export function getConfiguredColumnIndex(sheet: string, mappingId: string, fallbackIndex: number): number {
  const mapping = getColumnMappings().find(m => m.sheet === sheet && m.id === mappingId && m.active)
  if (!mapping) return fallbackIndex

  const configuredIndex = mapping.columnIndex >= 0 ? mapping.columnIndex : columnLetterToIndex(mapping.columnLetter)
  return configuredIndex >= 0 ? configuredIndex : fallbackIndex
}

async function fetchColumnMappingsFromSheet(): Promise<ColumnMapping[] | null> {
  if (typeof window === 'undefined') return null

  try {
    const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(COLUMN_MAPPING_SHEET)}&_t=${Date.now()}`
    const res = await fetch(url, { cache: 'no-store' })
    const text = await res.text()
    if (!res.ok || text.trimStart().startsWith('<!')) throw new Error('Sheet unavailable')

    const rows = parseCSV(text)
    const mappings = parseColumnMappingsFromRows(rows)
    if (mappings.length > 0) return normalizeColumnMappings(mappings)
  } catch (e) {
    console.warn('[ColumnMapping] Could not load shared sheet config:', e)
  }

  return null
}

export async function refreshColumnMappingsFromSheet(): Promise<ColumnMapping[]> {
  const sharedMappings = await fetchColumnMappingsFromSheet()
  if (sharedMappings && sharedMappings.length > 0) {
    setColumnMappings(sharedMappings)
    return getColumnMappings()
  }
  return getColumnMappings()
}

export function startColumnMappingSync(): void {
  if (columnMappingSyncStarted || typeof window === 'undefined') return

  columnMappingSyncStarted = true
  void refreshColumnMappingsFromSheet()

  window.setInterval(() => {
    void refreshColumnMappingsFromSheet()
  }, 30_000)

  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      void refreshColumnMappingsFromSheet()
    }
  })
}

/**
 * Get current column mappings from localStorage (and shared sheet when available)
 */
export function getColumnMappings(): ColumnMapping[] {
  if (columnMappingsCache) return columnMappingsCache

  if (typeof window === 'undefined') {
    const defaults = normalizeColumnMappings(DEFAULT_COLUMN_MAPPINGS)
    columnMappingsCache = defaults
    return defaults
  }

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored) as ColumnMapping[]
      const normalized = normalizeColumnMappings(parsed)
      columnMappingsCache = normalized
      return normalized
    }
  } catch (e) {
    console.error('[ColumnMapping] Error reading from localStorage:', e)
  }

  const defaults = normalizeColumnMappings(DEFAULT_COLUMN_MAPPINGS)
  columnMappingsCache = defaults
  return defaults
}

/**
 * Save column mappings to localStorage and push them to the shared config source
 */
export function setColumnMappings(mappings: ColumnMapping[]): void {
  try {
    const normalized = normalizeColumnMappings(mappings)
    columnMappingsCache = normalized

    if (typeof window === 'undefined') return

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized))
    window.dispatchEvent(new Event('atlas-column-mappings-changed'))
    void writeColumnMappingsToSheet(normalized as unknown as Array<Record<string, unknown>>)
  } catch (e) {
    console.error('[ColumnMapping] Error writing to localStorage:', e)
  }
}

/**
 * Reset to defaults
 */
export function resetColumnMappings(): void {
  setColumnMappings(DEFAULT_COLUMN_MAPPINGS)
}

/**
 * Get mappings for a specific sheet
 */
export function getSheetMappings(sheet: string): ColumnMapping[] {
  return getVisibleMappings(getColumnMappings()).filter(m => m.sheet === sheet)
}

/**
 * Get only active mappings for a specific sheet
 */
export function getActiveSheetMappings(sheet: string): ColumnMapping[] {
  return getSheetMappings(sheet).filter(m => m.active)
}

/**
 * Update a single mapping
 */
export function updateMapping(id: string, updates: Partial<ColumnMapping>): ColumnMapping[] {
  const mappings = getColumnMappings()
  const index = mappings.findIndex(m => m.id === id)
  if (index !== -1) {
    mappings[index] = { ...mappings[index], ...updates }
    setColumnMappings(mappings)
  }
  return mappings
}

/**
 * Toggle mapping active status
 */
export function toggleMappingActive(id: string): ColumnMapping[] {
  const mappings = getColumnMappings()
  const mapping = mappings.find(m => m.id === id)
  if (mapping) {
    mapping.active = !mapping.active
    setColumnMappings(mappings)
  }
  return mappings
}

/**
 * Get all available sheets
 */
export function getAvailableSheets(): string[] {
  const sheets = new Set(getVisibleMappings().map(m => m.sheet))
  return Array.from(sheets).sort()
}

/**
 * Get all available features
 */
export function getAvailableFeatures(): DataFeature[] {
  const features = new Set(getVisibleMappings().map(m => m.feature))
  return Array.from(features).sort() as DataFeature[]
}

/**
 * Get mappings for a specific feature
 */
export function getFeatureMappings(feature: DataFeature): ColumnMapping[] {
  return getVisibleMappings(getColumnMappings()).filter(m => m.feature === feature)
}

/**
 * Get mappings for a specific feature AND sheet
 */
export function getFeatureSheetMappings(feature: DataFeature, sheet: string): ColumnMapping[] {
  return getVisibleMappings(getColumnMappings()).filter(m => m.feature === feature && m.sheet === sheet)
}

/**
 * Get sections for a specific feature
 */
export function getFeatureSections(feature: DataFeature): string[] {
  const sections = new Set(getFeatureMappings(feature).filter(m => m.section).map(m => m.section!))
  return Array.from(sections).sort()
}

/**
 * Get mappings for a specific feature section
 */
export function getFeatureSectionMappings(feature: DataFeature, section: string): ColumnMapping[] {
  return getFeatureMappings(feature).filter(m => m.section === section)
}

/**
 * Get mapping index by column letter for a specific sheet
 * Useful for accessing row data when you know the column letter
 */
export function getColumnIndexByLetter(sheet: string, columnLetter: string): number {
  const mapping = getSheetMappings(sheet).find(m => m.columnLetter === columnLetter)
  return mapping?.columnIndex ?? columnLetterToIndex(columnLetter)
}

/**
 * Get all column letters used in a sheet (useful for validation)
 */
export function getUsedColumnLetters(sheet: string): Set<string> {
  return new Set(getSheetMappings(sheet).filter(m => m.active).map(m => m.columnLetter))
}

/**
 * Get column mapping by ID
 */
export function getMapping(id: string): ColumnMapping | undefined {
  return getColumnMappings().find(m => m.id === id)
}

/**
 * Get field value from row by column mapping
 * Useful for data extraction using configured mappings
 */
export function getFieldValue(row: string[], fieldId: string): string {
  const mapping = getMapping(fieldId)
  if (!mapping || !mapping.active) return ''
  return (row[mapping.columnIndex] ?? '').trim()
}

if (typeof window !== 'undefined') {
  startColumnMappingSync()
}
