export type UserRole = 'admin' | 'user'

export interface User {
  nik: string
  nama: string
  role: UserRole
  jobTitle: string
  password: string
}

// USERS sheet: A=NIK, B=NAMA, C=ROLE, D=JOBTITLE, E=PASSWORD (data from row 2)
export const USERS: User[] = []

export interface KPIItem {
  label: string
  value: number
  target: number
  unit: string
  noTarget?: boolean
}

export interface DailyTrend {
  date: string
  actual: number
  target: number
}

export interface EmployeeRank {
  rank: number
  nama: string
  nik: string
  jobTitle: string
  value: number
  achievement: number
  target?: number
}

export interface PerformanceData {
  achievement: number
  target: number        // full month target
  targetMTD?: number   // prorated: dailyTarget × workingDays
  actual: number
  acv: number           // computed: actual / workingDays
  workingDays: number
  kpis: KPIItem[]
  dailyTrend?: DailyTrend[]
  monthlyTrend?: DailyTrend[]
  ranking: EmployeeRank[]
}

// DAILY SALES sheet columns:
// A=NIK, B=NAMA, C=JOB TITLE, F=TOTAL SALES, G=TARGET SALES,
// ACV=computed, K=TRANSAKSI, O=QTY ITEM, P=AUR, Q=UPT, R=BASKET SIZE,
// S=PROTEKSI, T=INSTANT UPGRADE, U=NEW MEMBER, date at T1

export const TODAY_PERFORMANCE: PerformanceData = {
  achievement: 87.4,
  target: 15_000_000,
  actual: 13_110_000,
  acv: 13_110_000,    // 1 working day
  workingDays: 1,
  kpis: [
    { label: 'Transaksi',       value: 23,       target: 25,       unit: 'trx'  },
    { label: 'Qty Item',        value: 48,        target: 55,       unit: 'item' },
    { label: 'AUR',             value: 273_125,   target: 250_000,  unit: 'Rp'  },
    { label: 'UPT',             value: 2.1,       target: 2.2,      unit: 'x'   },
    { label: 'Basket Size',     value: 570_000,   target: 600_000,  unit: 'Rp'  },
    { label: 'Proteksi',        value: 8,         target: 10,       unit: 'trx' },
    { label: 'Instant Upgrade', value: 3,         target: 5,        unit: 'trx' },
    { label: 'New Member',      value: 5,         target: 6,        unit: 'org' },
  ],
  dailyTrend: [
    { date: '1 Jul',  actual: 12_800_000, target: 15_000_000 },
    { date: '2 Jul',  actual: 16_200_000, target: 15_000_000 },
    { date: '3 Jul',  actual: 11_500_000, target: 15_000_000 },
    { date: '4 Jul',  actual: 17_800_000, target: 15_000_000 },
    { date: '5 Jul',  actual: 14_200_000, target: 15_000_000 },
    { date: '7 Jul',  actual: 15_600_000, target: 15_000_000 },
    { date: '8 Jul',  actual: 13_900_000, target: 15_000_000 },
    { date: '9 Jul',  actual: 18_100_000, target: 15_000_000 },
    { date: '10 Jul', actual: 12_300_000, target: 15_000_000 },
    { date: '11 Jul', actual: 13_110_000, target: 15_000_000 },
  ],
  ranking: [
    { rank: 1, nama: 'Riaji Kantoro',   nik: '113230', jobTitle: 'Sales Advisor', value: 18_500_000, achievement: 123.3 },
    { rank: 2, nama: 'Eko Yulwanto',    nik: '185002', jobTitle: 'Sales Advisor', value: 16_200_000, achievement: 108.0 },
    { rank: 3, nama: 'Muhammad Ihsar',  nik: '191924', jobTitle: 'Manajer',       value: 15_800_000, achievement: 105.3 },
    { rank: 4, nama: 'Rahmadiame',      nik: '176413', jobTitle: 'Sales Advisor', value: 13_110_000, achievement: 87.4  },
    { rank: 5, nama: 'MONICA',          nik: '187856', jobTitle: 'Sales',         value: 11_800_000, achievement: 78.7  },
    { rank: 6, nama: 'Destro Setiawan', nik: '190211', jobTitle: 'Sales Advisor', value: 9_500_000,  achievement: 63.3  },
    { rank: 7, nama: 'Basirul Ansoky',  nik: '172389', jobTitle: 'SPV',           value: 7_200_000,  achievement: 48.0  },
    { rank: 8, nama: 'Christy Ann',     nik: '165041', jobTitle: 'CCR',           value: 5_400_000,  achievement: 36.0  },
  ],
}

// MONTH TO DATE sheet columns:
// A=NIK, B=NAMA, C=JOB TITLE, E=SALES, F=TARGET,
// ACV=computed, J=TRANSAKSI, O=BASKET SIZE, S=PROTEKSI,
// T=NEW MEMBER, U=INSTANT UPGRADE, AB=TOTAL 5 STRATEGY, AC=OFF/CUTI

export const MTD_PERFORMANCE: PerformanceData = {
  achievement: 72.1,
  target: 165_000_000,
  actual: 118_965_000,
  acv: 10_815_000,   // 118.9Jt / 11 hari kerja (Juli berjalan)
  workingDays: 11,
  kpis: [
    { label: 'Transaksi',         value: 198,      target: 250,      unit: 'trx'  },
    { label: 'Basket Size',       value: 600_750,  target: 660_000,  unit: 'Rp'  },
    { label: 'Proteksi',          value: 62,       target: 100,      unit: 'trx' },
    { label: 'New Member',        value: 38,       target: 60,       unit: 'org' },
    { label: 'Instant Upgrade',   value: 22,       target: 40,       unit: 'trx' },
    { label: 'Total 5 Strategy',  value: 112,      target: 150,      unit: 'poin' },
    { label: 'Off/Cuti',          value: 1,        target: 0,        unit: 'hari', noTarget: true },
  ],
  monthlyTrend: [
    { date: '1 Jul',  actual: 9_500_000,   target: 15_000_000 },
    { date: '2 Jul',  actual: 21_200_000,  target: 15_000_000 },
    { date: '3 Jul',  actual: 30_900_000,  target: 15_000_000 },
    { date: '4 Jul',  actual: 48_700_000,  target: 15_000_000 },
    { date: '5 Jul',  actual: 58_400_000,  target: 15_000_000 },
    { date: '7 Jul',  actual: 73_200_000,  target: 15_000_000 },
    { date: '8 Jul',  actual: 82_900_000,  target: 15_000_000 },
    { date: '9 Jul',  actual: 96_300_000,  target: 15_000_000 },
    { date: '10 Jul', actual: 106_500_000, target: 15_000_000 },
    { date: '11 Jul', actual: 118_965_000, target: 15_000_000 },
  ],
  ranking: [
    { rank: 1, nama: 'Eko Yulwanto',    nik: '185002', jobTitle: 'Sales Advisor', value: 32_000_000, achievement: 116.4 },
    { rank: 2, nama: 'Riaji Kantoro',   nik: '113230', jobTitle: 'Sales Advisor', value: 28_500_000, achievement: 103.6 },
    { rank: 3, nama: 'Muhammad Ihsar',  nik: '191924', jobTitle: 'Manajer',       value: 26_100_000, achievement: 94.9  },
    { rank: 4, nama: 'MONICA',          nik: '187856', jobTitle: 'Sales',         value: 18_500_000, achievement: 67.3  },
    { rank: 5, nama: 'Rahmadiame',      nik: '176413', jobTitle: 'Sales Advisor', value: 14_500_000, achievement: 52.7  },
    { rank: 6, nama: 'Destro Setiawan', nik: '190211', jobTitle: 'Sales Advisor', value: 11_200_000, achievement: 40.7  },
    { rank: 7, nama: 'Basirul Ansoky',  nik: '172389', jobTitle: 'SPV',           value: 8_900_000,  achievement: 32.4  },
    { rank: 8, nama: 'Christy Ann',     nik: '165041', jobTitle: 'CCR',           value: 6_765_000,  achievement: 24.6  },
  ],
}

// YTD — data menyusul, menggunakan estimasi sementara
export const YTD_PERFORMANCE: PerformanceData = {
  achievement: 91.3,
  target: 1_155_000_000,
  actual: 1_054_615_000,
  acv: 8_112_000,   // ~130 hari kerja
  workingDays: 130,
  kpis: [
    { label: 'Transaksi',       value: 1542,     target: 1750,     unit: 'trx'  },
    { label: 'Basket Size',     value: 683_900,  target: 660_000,  unit: 'Rp'  },
    { label: 'Proteksi',        value: 480,      target: 700,      unit: 'trx' },
    { label: 'New Member',      value: 310,      target: 420,      unit: 'org' },
    { label: 'Instant Upgrade', value: 198,      target: 280,      unit: 'trx' },
    { label: 'Total 5 Strategy',value: 890,      target: 1050,     unit: 'poin' },
  ],
  monthlyTrend: [
    { date: 'Jan', actual: 145_000_000, target: 165_000_000 },
    { date: 'Feb', actual: 132_000_000, target: 165_000_000 },
    { date: 'Mar', actual: 178_000_000, target: 165_000_000 },
    { date: 'Apr', actual: 156_000_000, target: 165_000_000 },
    { date: 'Mei', actual: 189_000_000, target: 165_000_000 },
    { date: 'Jun', actual: 162_000_000, target: 165_000_000 },
    { date: 'Jul', actual: 92_615_000,  target: 165_000_000 },
  ],
  ranking: [
    { rank: 1, nama: 'Riaji Kantoro',   nik: '113230', jobTitle: 'Sales Advisor', value: 285_000_000, achievement: 111.8 },
    { rank: 2, nama: 'Eko Yulwanto',    nik: '185002', jobTitle: 'Sales Advisor', value: 262_000_000, achievement: 102.7 },
    { rank: 3, nama: 'Muhammad Ihsar',  nik: '191924', jobTitle: 'Manajer',       value: 241_000_000, achievement: 94.5  },
    { rank: 4, nama: 'MONICA',          nik: '187856', jobTitle: 'Sales',         value: 198_000_000, achievement: 77.6  },
    { rank: 5, nama: 'Rahmadiame',      nik: '176413', jobTitle: 'Sales Advisor', value: 168_000_000, achievement: 65.9  },
    { rank: 6, nama: 'Destro Setiawan', nik: '190211', jobTitle: 'Sales Advisor', value: 68_615_000,  achievement: 26.9  },
    { rank: 7, nama: 'Basirul Ansoky',  nik: '172389', jobTitle: 'SPV',           value: 42_000_000,  achievement: 16.5  },
    { rank: 8, nama: 'Christy Ann',     nik: '165041', jobTitle: 'CCR',           value: 31_000_000,  achievement: 12.2  },
  ],
}

export interface InsentifItem {
  nama: string
  type: 'bersyarat' | 'tanpa_syarat'
  nilai_target: number
  nilai_tercapai: number
  persen: number
}

export interface InsentifKategori {
  id: string
  nama: string
  icon: string
  total_target: number
  total_tercapai: number
  produk: InsentifProduk[]
}

export interface InsentifProduk {
  nama: string
  sku: string
  target_unit: number
  tercapai_unit: number
  nilai_insentif: number
  tercapai_insentif: number
}

export const INSENTIF_SUMMARY: InsentifItem[] = [
  { nama: 'Insentif Bersyarat',    type: 'bersyarat',    nilai_target: 4_500_000, nilai_tercapai: 2_870_000, persen: 63.8 },
  { nama: 'Insentif Tanpa Syarat', type: 'tanpa_syarat', nilai_target: 2_000_000, nilai_tercapai: 1_650_000, persen: 82.5 },
]

export const INSENTIF_KATEGORI: InsentifKategori[] = [
  {
    id: 'appliances', nama: 'Appliances', icon: '🏠',
    total_target: 2_000_000, total_tercapai: 1_250_000,
    produk: [
      { nama: 'AC Split 1PK Sharp',     sku: 'AH-A9SEY',     target_unit: 5, tercapai_unit: 3, nilai_insentif: 150_000, tercapai_insentif: 90_000  },
      { nama: 'Mesin Cuci LG 8Kg',      sku: 'T2108VS2W',    target_unit: 4, tercapai_unit: 4, nilai_insentif: 200_000, tercapai_insentif: 200_000 },
      { nama: 'Kulkas Samsung 2 Pintu', sku: 'RT38CG6000B1', target_unit: 3, tercapai_unit: 1, nilai_insentif: 300_000, tercapai_insentif: 100_000 },
      { nama: 'Vacuum Dyson V12',       sku: 'DY-V12',       target_unit: 2, tercapai_unit: 2, nilai_insentif: 400_000, tercapai_insentif: 400_000 },
    ],
  },
  {
    id: 'elektronik', nama: 'Elektronik', icon: '📱',
    total_target: 1_500_000, total_tercapai: 980_000,
    produk: [
      { nama: 'TV LED Sony 55"',    sku: 'KD-55X75WL', target_unit: 2, tercapai_unit: 1, nilai_insentif: 500_000, tercapai_insentif: 250_000 },
      { nama: 'Soundbar Samsung',   sku: 'HW-B650',    target_unit: 5, tercapai_unit: 5, nilai_insentif: 100_000, tercapai_insentif: 100_000 },
      { nama: 'Smart Speaker Bose', sku: 'BOSE-SM2',   target_unit: 3, tercapai_unit: 2, nilai_insentif: 210_000, tercapai_insentif: 140_000 },
    ],
  },
  {
    id: 'home_comfort', nama: 'Home Comfort', icon: '🛋',
    total_target: 500_000, total_tercapai: 420_000,
    produk: [
      { nama: 'Dispenser Panas Dingin Miyako', sku: 'MYK-WD-389', target_unit: 8, tercapai_unit: 7, nilai_insentif: 35_000, tercapai_insentif: 245_000 },
      { nama: 'Air Purifier Sharp',            sku: 'FU-A80Y',    target_unit: 5, tercapai_unit: 4, nilai_insentif: 43_750, tercapai_insentif: 175_000 },
    ],
  },
]

export const formatRupiah = (value: number): string => {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}M`
  if (value >= 1_000_000)    return `${(value / 1_000_000).toFixed(1)}Jt`
  if (value >= 1_000)        return `${(value / 1_000).toFixed(0)}Rb`
  return value.toFixed(0)
}

export const formatRupiahFull = (value: number): string =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value)
