import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildRawPerformance } from './rawDataApi'

function csvResponse(text: string) {
  return new Response(text, { status: 200, headers: { 'Content-Type': 'text/csv' } })
}

describe('buildRawPerformance', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('includes sales rows for users whose NIK uses an alternate format', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      const sheet = new URL(url).searchParams.get('sheet')

      if (sheet === 'COPAS S2') {
        return csvResponse([
          'NIK,NAMA,,RECEIPT NO,ARTIKEL,DESKRIPSI,KODE,QTY,EMPTY1,EMPTY2,EMPTY3,TOTAL VALUE,,TANGGAL',
          '101902,Sales User,,R1,SKU1,Desc,Code,1,,,,100000,,17/07/2026',
          '101902,Sales User,,R2,SKU1,Desc,Code,1,,,,100000,,16/07/2026',
        ].join('\n'))
      }

      if (sheet === 'KUNCIAN SKU') {
        return csvResponse(['SKU', 'SKU1'].join('\n'))
      }

      if (sheet === 'TARGET') {
        return csvResponse([
          'NIK,NAMA,TARGET SALES DAILY,TARGET SALES BULAN,,,,,TARGET MTD KARYAWAN,OFF TERPAKAI,OFF BULAN INI',
          'I01902,Sales User,1000000,3000000,,,,,7000000,2,5',
        ].join('\n'))
      }

      if (sheet === 'MEMBER') {
        return csvResponse(['TANGGAL,TYPE,NAMA', ''].join('\n'))
      }

      if (sheet === 'SETTING') {
        return csvResponse(['SECTION,NAMA,AKTIF', ''].join('\n'))
      }

      if (sheet === 'ATLAS DATABASE') {
        return csvResponse(['NIK,NAMA', ''].join('\n'))
      }

      if (sheet === 'COPAS') {
        return csvResponse(['NIK,NAMA', ''].join('\n'))
      }

      if (sheet === 'USERS') {
        return csvResponse(['NIK,NAMA,ROLE,JOBTITLE,PASSWORD', 'I01902,Sales User,user,Sales,123456'].join('\n'))
      }

      return csvResponse('')
    }))

    const result = await buildRawPerformance('I01902', undefined, new Set(['I01902']))

    expect(result.todayPerf.actual).toBe(0)
    expect(result.todayPerf.ranking).toHaveLength(0)
    expect(result.mtdPerf.ranking.some(entry => entry.nik === '101902')).toBe(false)
    expect(result.mtdPerf.targetMTD).toBe(7000000)
    expect(result.mtdPerf.target).toBe(3000000)
    expect(result.teamMtdEmployees[0]?.fullMonthTargetSales).toBe(3000000)
    expect(result.mtdPerf.offBulanIni).toBe(5)
    expect(result.mtdPerf.offTerpakai).toBe(2)
  })

  it('does not use yesterday\'s sales when there is no transaction for today', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      const sheet = new URL(url).searchParams.get('sheet')

      if (sheet === 'COPAS S2') {
        return csvResponse([
          'NIK,NAMA,,RECEIPT NO,ARTIKEL,DESKRIPSI,KODE,QTY,EMPTY1,EMPTY2,EMPTY3,TOTAL VALUE,,TANGGAL',
          '101902,Sales User,,R1,SKU1,Desc,Code,1,,,,100000,,17/07/2026',
        ].join('\n'))
      }

      if (sheet === 'KUNCIAN SKU') {
        return csvResponse(['SKU', 'SKU1'].join('\n'))
      }

      if (sheet === 'TARGET') {
        return csvResponse([
          'NIK,NAMA,TARGET SALES DAILY,TARGET SALES BULAN',
          'I01902,Sales User,1000000,3000000',
        ].join('\n'))
      }

      if (sheet === 'MEMBER') {
        return csvResponse(['TANGGAL,TYPE,NAMA', ''].join('\n'))
      }

      if (sheet === 'SETTING') {
        return csvResponse(['SECTION,NAMA,AKTIF', ''].join('\n'))
      }

      if (sheet === 'ATLAS DATABASE') {
        return csvResponse(['NIK,NAMA', ''].join('\n'))
      }

      if (sheet === 'COPAS') {
        return csvResponse(['NIK,NAMA', ''].join('\n'))
      }

      if (sheet === 'USERS') {
        return csvResponse(['NIK,NAMA,ROLE,JOBTITLE,PASSWORD', 'I01902,Sales User,user,Sales,123456'].join('\n'))
      }

      return csvResponse('')
    }))

    const result = await buildRawPerformance('I01902', undefined, new Set(['I01902']))

    expect(result.todayPerf.actual).toBe(0)
    expect(result.todayPerf.dailyTrend?.[0]?.actual).toBe(0)
  })

  it('starts MTD from the current month after the month changes', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-01T12:00:00+07:00'))
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const sheet = new URL(String(input)).searchParams.get('sheet')

      if (sheet === 'COPAS S2') return csvResponse([
        'NIK,NAMA,,RECEIPT NO,ARTIKEL,DESKRIPSI,KODE,QTY,EMPTY1,EMPTY2,EMPTY3,TOTAL VALUE,,TANGGAL',
        '123702,Sales User,,R1,SKU1,Desc,Code,1,,,,100000,,01/10/2026',
      ].join('\n'))
      if (sheet === 'TARGET') return csvResponse([
        'NIK,NAMA,TARGET SALES DAILY,TARGET SALES BULAN',
        '123702,Sales User,100000,3000000',
      ].join('\n'))
      if (sheet === 'KUNCIAN SKU') return csvResponse(['SKU', 'SKU1'].join('\n'))
      if (sheet === 'USERS') return csvResponse(['NIK,NAMA,ROLE,JOBTITLE,PASSWORD', '123702,Sales User,user,Sales,123456'].join('\n'))
      if (sheet === 'ATLAS DATABASE' || sheet === 'COPAS') return csvResponse(['NIK,NAMA', '123702,Sales User'].join('\n'))
      if (sheet === 'MEMBER') return csvResponse(['TANGGAL,TYPE,NAMA', ''].join('\n'))
      if (sheet === 'SETTING') return csvResponse(['SECTION,NAMA,AKTIF', ''].join('\n'))
      return csvResponse('')
    }))

    try {
      const result = await buildRawPerformance('123702', undefined, new Set(['123702']))

      expect(result.dailyDate).toBe('01/10/2026')
      expect(result.dateFrom).toBe('01/10/2026')
      expect(result.dateTo).toBe('01/10/2026')
      expect(result.mtdPerf.workingDays).toBe(0)
      expect(result.mtdPerf.targetMTD).toBe(0)
      expect(result.mtdPerf.target).toBe(3000000)
      expect(result.teamMtdEmployees[0]?.fullMonthTargetSales).toBe(3000000)
    } finally {
      vi.useRealTimers()
    }
  })

  it('parses daily matrix rows when COPAS S2 is blank but COPAS has the data', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      const sheet = new URL(url).searchParams.get('sheet')

      if (sheet === 'COPAS S2') {
        return csvResponse('#REF!,,,,,,,,,,,,')
      }

      if (sheet === 'COPAS') {
        return csvResponse([
          'NIK,NAMA,12/07/2026,13/07/2026,14/07/2026',
          ',GWEN MALIKA,1,,3',
          '101902,GWEN MALIKA,,,4',
        ].join('\n'))
      }

      if (sheet === 'KUNCIAN SKU') {
        return csvResponse(['SKU', 'SKU1'].join('\n'))
      }

      if (sheet === 'TARGET') {
        return csvResponse([
          'NIK,NAMA,TARGET SALES DAILY,TARGET SALES BULAN',
          'I01902,GWEN MALIKA,1000000,3000000',
        ].join('\n'))
      }

      if (sheet === 'MEMBER') {
        return csvResponse(['TANGGAL,TYPE,NAMA', ''].join('\n'))
      }

      if (sheet === 'SETTING') {
        return csvResponse(['SECTION,NAMA,AKTIF', ''].join('\n'))
      }

      if (sheet === 'ATLAS DATABASE') {
        return csvResponse(['NIK,NAMA', ''].join('\n'))
      }

      if (sheet === 'USERS') {
        return csvResponse(['NIK,NAMA,ROLE,JOBTITLE,PASSWORD', 'I01902,GWEN MALIKA,user,Sales,123456'].join('\n'))
      }

      return csvResponse('')
    }))

    const result = await buildRawPerformance('I01902', undefined, new Set(['OTHER']))

    expect(result.todayPerf.actual).toBe(0)
    expect(result.todayPerf.ranking).toHaveLength(0)
    expect(result.mtdPerf.ranking.some(entry => entry.nik === '101902')).toBe(false)
  })

  it('derives qty and aur targets from target transaksi and target upt', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      const sheet = new URL(url).searchParams.get('sheet')

      if (sheet === 'COPAS S2') {
        return csvResponse([
          'NIK,NAMA,,RECEIPT NO,ARTIKEL,DESKRIPSI,KODE,QTY,EMPTY1,EMPTY2,EMPTY3,TOTAL VALUE,,TANGGAL',
          '101902,Sales User,,R1,SKU1,Desc,Code,2,,,,500000,,18/07/2026',
        ].join('\n'))
      }

      if (sheet === 'KUNCIAN SKU') {
        return csvResponse(['SKU', 'SKU1'].join('\n'))
      }

      if (sheet === 'TARGET') {
        return csvResponse([
          'NIK,NAMA,TARGET SALES DAILY,TARGET SALES BULAN,TARGET TRANSAKSI DAILY,TARGET TRANSAKSI SATU BULAN,TARGET BASKET SIZE DAILY,TARGET BASKET SIZE SATU BULAN,JOB TITLE',
          'I01902,Sales User,1000000,26000000,4,104,250000,250000,Sales',
        ].join('\n'))
      }

      if (sheet === 'SETTING') {
        return csvResponse([
          'SECTION,NAMA,AKTIF,TARGET_TYPE,TARGET_VALUE,UNIT,KETERANGAN',
          'KPI,Transaksi,TRUE,sheet,0,trx,',
          'KPI,Qty Item,TRUE,sheet,0,item,',
          'KPI,AUR,TRUE,sheet,0,rp,',
          'KPI,UPT,TRUE,tetap,2,x,',
        ].join('\n'))
      }

      if (sheet === 'MEMBER') {
        return csvResponse(['TANGGAL,TYPE,NAMA', ''].join('\n'))
      }

      if (sheet === 'ATLAS DATABASE') {
        return csvResponse(['NIK,NAMA', ''].join('\n'))
      }

      if (sheet === 'COPAS') {
        return csvResponse(['NIK,NAMA', ''].join('\n'))
      }

      if (sheet === 'USERS') {
        return csvResponse(['NIK,NAMA,ROLE,JOBTITLE,PASSWORD', 'I01902,Sales User,user,Sales,123456'].join('\n'))
      }

      return csvResponse('')
    }))

    const result = await buildRawPerformance('I01902', undefined, new Set(['I01902']))

    const transaksi = result.todayPerf.kpis.find(kpi => kpi.label === 'Transaksi')
    const qtyItem = result.todayPerf.kpis.find(kpi => kpi.label === 'Qty Item')
    const aur = result.todayPerf.kpis.find(kpi => kpi.label === 'AUR')
    const upt = result.todayPerf.kpis.find(kpi => kpi.label === 'UPT')

    expect(transaksi?.target).toBe(4)
    expect(upt?.target).toBe(5)
    expect(qtyItem?.target).toBe(20)
    expect(aur?.target).toBe(200000)
  })

  it('uses the first matching TARGET row for a duplicated NIK when reading target transaksi', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      const sheet = new URL(url).searchParams.get('sheet')

      if (sheet === 'COPAS S2') {
        return csvResponse([
          'NIK,NAMA,,RECEIPT NO,ARTIKEL,DESKRIPSI,KODE,QTY,EMPTY1,EMPTY2,EMPTY3,TOTAL VALUE,,TANGGAL',
          '123702,Wahyu Rianto,,R1,SKU1,Desc,Code,2,,,,500000,,18/07/2026',
        ].join('\n'))
      }

      if (sheet === 'KUNCIAN SKU') {
        return csvResponse(['SKU', 'SKU1'].join('\n'))
      }

      if (sheet === 'TARGET') {
        return csvResponse([
          'NIK,NAMA,TARGET SALES DAILY,TARGET SALES BULAN,TARGET TRANSAKSI DAILY,TARGET TRANSAKSI SATU BULAN,TARGET BASKET SIZE DAILY,TARGET BASKET SIZE SATU BULAN,JOB TITLE',
          '123702,WAHYU RIANTO,3826538,99489988,10,260,382654,382654,ADV',
          '123702,WAHYU RIANTO,3826538,99489988,15,390,255103,255103,ADV',
        ].join('\n'))
      }

      if (sheet === 'SETTING') {
        return csvResponse(['SECTION,NAMA,AKTIF', ''].join('\n'))
      }

      if (sheet === 'MEMBER') {
        return csvResponse(['TANGGAL,TYPE,NAMA', ''].join('\n'))
      }

      if (sheet === 'ATLAS DATABASE') {
        return csvResponse(['NIK,NAMA', '123702,WAHYU RIANTO'].join('\n'))
      }

      if (sheet === 'COPAS') {
        return csvResponse(['NIK,NAMA', '123702,WAHYU RIANTO'].join('\n'))
      }

      if (sheet === 'USERS') {
        return csvResponse(['NIK,NAMA,ROLE,JOBTITLE,PASSWORD', '123702,WAHYU RIANTO,user,Sales,123456'].join('\n'))
      }

      return csvResponse('')
    }))

    const result = await buildRawPerformance('123702', undefined, new Set(['123702']))

    const transaksi = result.todayPerf.kpis.find(kpi => kpi.label === 'Transaksi')
    expect(transaksi?.target).toBe(10)
  })

  it('counts all daily Proteksi rows when article formatting differs between sheets', async () => {
    const today = new Date()
    const todayText = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const sheet = new URL(String(input)).searchParams.get('sheet')
      if (sheet === 'COPAS S2') {
        return csvResponse([
          'NIK,NAMA,,RECEIPT NO,ARTIKEL,DESKRIPSI,KODE,QTY,EMPTY1,EMPTY2,EMPTY3,TOTAL VALUE,,TANGGAL',
          `123702,Wahyu Rianto,,R1,PROT-001,Proteksi,Code,1,,,,500000,,${todayText}`,
          `123702,Wahyu Rianto,,R2,prot 002,Proteksi,Code,1,,,,500000,,${todayText}`,
          `123702,Wahyu Rianto,,R3,PROT003,Proteksi,Code,1,,,,500000,,${todayText}`,
          `123702,Wahyu Rianto,,R4,PROT004,Proteksi,Code,1,,,,500000,,${todayText}`,
        ].join('\n'))
      }
      if (sheet === 'KUNCIAN SKU') return csvResponse(['REGULER,PROTEKSI', 'SKU1,PROT001', 'SKU2,PROT-002', 'SKU3,PROT003', 'SKU4,PROT004'].join('\n'))
      if (sheet === 'TARGET') return csvResponse(['NIK,NAMA,TARGET SALES DAILY,TARGET SALES BULAN', '123702,Wahyu Rianto,1000000,3000000'].join('\n'))
      if (sheet === 'SETTING') return csvResponse(['SECTION,NAMA,AKTIF', ''].join('\n'))
      if (sheet === 'MEMBER') return csvResponse(['TANGGAL,TYPE,NAMA', ''].join('\n'))
      if (sheet === 'ATLAS DATABASE') return csvResponse(['NIK,NAMA', '123702,Wahyu Rianto'].join('\n'))
      if (sheet === 'COPAS') return csvResponse(['NIK,NAMA', '123702,Wahyu Rianto'].join('\n'))
      if (sheet === 'USERS') return csvResponse(['NIK,NAMA,ROLE,JOBTITLE,PASSWORD', '123702,Wahyu Rianto,user,Sales,123456'].join('\n'))
      return csvResponse('')
    }))

    const result = await buildRawPerformance('123702', undefined, new Set(['123702']))
    const proteksi = result.todayPerf.kpis.find(kpi => kpi.label === 'PROTEKSI')
    expect(proteksi?.value).toBe(4)
    expect(result.todayPerf.ranking[0]?.protectionQty).toBe(4)
  })

  it('infers ambiguous Proteksi dates per row within MTD', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-09-13T12:00:00+07:00'))
    const today = new Date()
    const month = String(today.getMonth() + 1).padStart(2, '0')
    const year = today.getFullYear()
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const sheet = new URL(String(input)).searchParams.get('sheet')
      if (sheet === 'COPAS S2') {
        return csvResponse([
          'NIK,NAMA,,RECEIPT NO,ARTIKEL,DESKRIPSI,KODE,QTY,EMPTY1,EMPTY2,EMPTY3,TOTAL VALUE,,TANGGAL',
          `123702,Wahyu Rianto,,R1,PROT001,Proteksi,Code,1,,,,500000,,9/10/${year}`,
          `123702,Wahyu Rianto,,R2,PROT002,Proteksi,Code,1,,,,500000,,9/11/${year}`,
          `123702,Wahyu Rianto,,R3,PROT003,Proteksi,Code,1,,,,500000,,9/12/${year}`,
          `123702,Wahyu Rianto,,R4,PROT004,Proteksi,Code,1,,,,500000,,12/09/${year}`,
        ].join('\n'))
      }
      if (sheet === 'KUNCIAN SKU') return csvResponse(['REGULER,PROTEKSI', 'SKU1,PROT001', 'SKU2,PROT002', 'SKU3,PROT003', 'SKU4,PROT004'].join('\n'))
      if (sheet === 'TARGET') return csvResponse(['NIK,NAMA,TARGET SALES DAILY,TARGET SALES BULAN', '123702,Wahyu Rianto,1000000,3000000'].join('\n'))
      if (sheet === 'SETTING') return csvResponse(['SECTION,NAMA,AKTIF', ''].join('\n'))
      if (sheet === 'MEMBER') return csvResponse(['TANGGAL,TYPE,NAMA', ''].join('\n'))
      if (sheet === 'ATLAS DATABASE') return csvResponse(['NIK,NAMA', '123702,Wahyu Rianto'].join('\n'))
      if (sheet === 'COPAS') return csvResponse(['NIK,NAMA', '123702,Wahyu Rianto'].join('\n'))
      if (sheet === 'USERS') return csvResponse(['NIK,NAMA,ROLE,JOBTITLE,PASSWORD', '123702,Wahyu Rianto,user,Sales,123456'].join('\n'))
      return csvResponse('')
    }))

    const result = await buildRawPerformance('123702', undefined, new Set(['123702']))
    const mtdProteksi = result.mtdPerf.kpis.find(kpi => kpi.label === 'PROTEKSI')
    expect(mtdProteksi?.value).toBe(4)
    expect(result.mtdPerf.ranking[0]?.protectionQty).toBe(4)
  })
})
