import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildRawPerformance, fetchCopasS2TableData, fetchReceiptSegmentation, fetchTargets, salesContributionKeyForZone } from './rawDataApi'

function csvResponse(text: string) {
  return new Response(text, { status: 200, headers: { 'Content-Type': 'text/csv' } })
}

describe('buildRawPerformance', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  describe('fetchTargets', () => {
    it('reads daily sales targets from column O instead of the old column C', async () => {
      const headers = Array(15).fill('')
      headers[0] = 'NIK'
      headers[1] = 'NAMA'
      headers[2] = 'TARGET SALES DAILY'
      headers[3] = 'TARGET SALES BULAN'
      headers[14] = 'TARGET SALES DAILY'

      const row = Array(15).fill('')
      row[0] = '123702'
      row[1] = 'Sales User'
      row[2] = '111000'
      row[3] = '3000000'
      row[14] = '222000'

      vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
        const sheet = new URL(String(input)).searchParams.get('sheet')
        if (sheet === 'TARGET') return csvResponse([headers.join(','), row.join(',')].join('\n'))
        if (sheet === 'ATLAS DATABASE') return csvResponse('NIK,NAMA')
        return csvResponse('')
      }))

      const targets = await fetchTargets()

      expect(targets.get('123702')?.daily).toBe(222000)
      expect(targets.get('123702')?.monthly).toBe(3000000)
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('loads COPAS S2 A:L rows for Search Receipt', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => csvResponse([
      'NIK,NAMA,,RECEIPT NO,ARTIKEL,DESKRIPSI,KODE,QTY,I,J,K,TOTAL VALUE,,TANGGAL',
      '123702,Sales User,,R1,SKU1,Desc,Code,1,1,2,3,100000,,01/10/2026',
    ].join('\n'))))

    const data = await fetchCopasS2TableData()

    expect(data.headers).toHaveLength(12)
    expect(data.rows).toHaveLength(1)
    expect(data.rows[0]?.slice(0, 12)).toEqual(['123702', 'Sales User', '', 'R1', 'SKU1', 'Desc', 'Code', '1', '1', '2', '3', '100000'])
  })

  it('maps USERS zones to target groups and leaves support roles without a zone target', () => {
    expect(salesContributionKeyForZone('Home Living')).toBe('homeLiving')
    expect(salesContributionKeyForZone('Home Improvment')).toBe('homeImprovement')
    expect(salesContributionKeyForZone('Hobbies & LifeStyle')).toBe('hobbiesLifestyle')
    expect(salesContributionKeyForZone('Support')).toBeNull()
    expect(salesContributionKeyForZone('Cashier')).toBeNull()
    expect(salesContributionKeyForZone('ONLINE')).toBeNull()
  })

  it('includes sales for 6-digit I-prefixed NIKs in all sales periods', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-07-17T12:00:00+07:00'))

    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      const sheet = new URL(url).searchParams.get('sheet')

      if (sheet === 'COPAS S2') {
        return csvResponse([
          'NIK,NAMA,,RECEIPT NO,ARTIKEL,DESKRIPSI,KODE,QTY,EMPTY1,EMPTY2,EMPTY3,TOTAL VALUE,,TANGGAL',
          'I152535,Sales User,,R1,SKU1,Desc,Code,1,,,,250000,,16/07/2026',
          'I152535,Sales User,,R2,SKU1,Desc,Code,1,,,,300000,,17/07/2026',
        ].join('\n'))
      }

      if (sheet === 'KUNCIAN SKU') {
        return csvResponse(['SKU', 'SKU1'].join('\n'))
      }

      if (sheet === 'TARGET') {
        return csvResponse([
          'NIK,NAMA,TARGET SALES DAILY,TARGET SALES BULAN',
          'I152535,Sales User,1000000,3000000',
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
        return csvResponse(['NIK,NAMA,ROLE,JOBTITLE,PASSWORD', 'I152535,Sales User,user,Sales,123456'].join('\n'))
      }

      return csvResponse('')
    }))

    try {
      const result = await buildRawPerformance('I152535', undefined, new Set(['I152535']))

      expect(result.mtdPerf.actual).toBe(250000)
      expect(result.mtdPerf.ranking.find(entry => entry.nik === '152535')?.value).toBe(250000)
      expect(result.todayPerf.actual).toBe(300000)
      expect(result.teamMtdEmployees.find(employee => employee.nik === '152535')?.sales).toBe(250000)
      expect(result.teamFullMonthEmployees.find(employee => employee.nik === '152535')?.sales).toBe(550000)
    } finally {
      vi.useRealTimers()
    }
  })

  it('reads the live SALES_DATA layout with TANGGAL in column O', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-22T12:00:00+07:00'))

    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input))
      const sheet = url.searchParams.get('sheet')

      if (sheet === 'SALES_DATA') {
        return csvResponse([
          'NIK,NAMA,DATE,NO RECEIPT,ARTICLE CODE,ARTICLE NAME,DEPARTMENT,QUANTITY,PRICE,DISCOUNT,INCLUDE PPN,EXCLUDE PPN,JOBTITLE,CHANNEL,TANGGAL,ZONA',
          '191924,Manager Test,22/11/2026,R1,SKU1,Product,Dept,2,250000,0,500000,450000,,ONLINE,22-11-2026,Home Improvement',
        ].join('\n'))
      }
      if (sheet === 'KUNCIAN SKU') return csvResponse('SKU,SKU1')
      if (sheet === 'TARGET') return csvResponse([
        'NIK,NAMA,TARGET SALES DAILY,TARGET SALES BULAN',
        '191924,Manager Test,1000000,30000000',
      ].join('\n'))
      if (sheet === 'MEMBER') return csvResponse('TANGGAL,TYPE,NAMA')
      if (sheet === 'SETTING') return csvResponse('SECTION,NAMA,AKTIF')
      if (sheet === 'USERS') return csvResponse(
        'NIK,NAMA,ROLE,JOBTITLE,PASSWORD\n191924,Manager Test,user,Manager,123456',
      )
      if (sheet === 'ATLAS DATABASE' || sheet === 'COPAS') return csvResponse('NIK,NAMA')
      return csvResponse('')
    }))

    try {
      const result = await buildRawPerformance('191924', undefined, new Set(['191924']))

      expect(result.todayPerf.actual).toBe(450000)
      expect(result.todayPerf.ranking.find(entry => entry.nik === '191924')?.value).toBe(450000)
      expect(result.teamTodayEmployees.find(employee => employee.nik === '191924')?.sales).toBe(450000)
      expect(result.dailyDate).toBe('22/11/2026')
    } finally {
      vi.useRealTimers()
    }
  })

  it('loads team ranking for a regular user without downloading all history', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-24T12:00:00+07:00'))

    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input))
      const sheet = url.searchParams.get('sheet')
      if (sheet === 'SALES_DATA') {
        expect(url.searchParams.get('tq')).toContain('where O >=')
        expect(url.searchParams.get('tq')).not.toContain('A =')
        return csvResponse([
          'NIK,NAMA,NO RECEIPT,ARTICLE CODE,QUANTITY,EXCLUDE PPN,TANGGAL,ZONA,CHANNEL',
          '191924,Manager Test,R1,SKU1,1,1.000.000,24-11-2026,Home Improvement,OFFLINE',
          '176419,Second User,R2,SKU2,1,2.000.000,24-11-2026,Home Living,ONLINE',
        ].join('\n'))
      }
      if (sheet === 'KUNCIAN SKU') return csvResponse('REGULER,SKU1,SKU2')
      if (sheet === 'TARGET') return csvResponse([
        'NIK,NAMA,TARGET SALES DAILY,TARGET SALES BULAN',
        '191924,Manager Test,1000000,30000000',
        '176419,Second User,1000000,30000000',
      ].join('\n'))
      if (sheet === 'USERS') return csvResponse([
        'NIK,NAMA,ROLE,JOBTITLE,PASSWORD',
        '191924,Manager Test,user,ADVISOR,123456',
        '176419,Second User,user,ADVISOR,123456',
      ].join('\n'))
      if (sheet === 'ATLAS DATABASE' || sheet === 'COPAS') {
        return csvResponse('NIK,NAMA\n191924,Manager Test\n176419,Second User')
      }
      if (sheet === 'MEMBER' || sheet === 'SETTING') return csvResponse('SECTION,NAMA,AKTIF')
      return csvResponse('')
    }))

    try {
      const result = await buildRawPerformance(
        '191924',
        undefined,
        new Set(['191924', '176419']),
        false,
        true,
        true,
      )

      expect(result.todayPerf.ranking.map((employee) => employee.nik)).toEqual([
        '176419',
        '191924',
      ])
      expect(result.todayPerf.ranking.map((employee) => employee.value)).toEqual([
        2_000_000,
        1_000_000,
      ])
    } finally {
      vi.useRealTimers()
    }
  })

  it('segments unique receipts by combined receipt value and returns low/high details', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input))
      if (url.searchParams.get('sheet') === 'SALES_DATA') {
        return csvResponse([
          'NO RECEIPT,NIK,NAMA,EXCLUDE PPN,DATE,TANGGAL,CHANNEL',
          'R-LOW,100001,User Low,120.000,22/11/2026,22-11-2026,OFFLINE',
          'R-LOW,100001,User Low,70.000,22/11/2026,22-11-2026,OFFLINE',
          'R-HIGH,100002,User High,12.000.000,22/11/2026,22-11-2026,ONLINE',
          'R-MID,100003,User Mid,350.000,22/11/2026,22-11-2026,OFFLINE',
          'R-NEGATIVE,100004,User Negative,-50.000,22/11/2026,22-11-2026,OFFLINE',
        ].join('\n'))
      }
      return csvResponse('')
    }))

    const result = await fetchReceiptSegmentation('2026-11-22')

    expect(result.totalReceipts).toBe(3)
    expect(result.segments.find(segment => segment.key === '0-200')?.count).toBe(1)
    expect(result.segments.find(segment => segment.key === '300-400')?.count).toBe(1)
    expect(result.segments.find(segment => segment.key === 'gt-10000')?.count).toBe(1)
    expect(result.lowValueReceipts[0]?.nik).toBe('100001')
    expect(result.lowValueReceipts[0]?.receiptCount).toBe(1)
    expect(result.lowValueReceipts[0]?.averageValue).toBe(190000)
    expect(result.lowValueOffline[0]?.nik).toBe('100001')
    expect(result.highValueReceipts[0]?.nik).toBe('100002')
    expect(result.highValueReceipts[0]?.receiptCount).toBe(1)
    expect(result.highValueOnline[0]?.averageValue).toBe(12000000)
    expect(result.segments.flatMap(segment => segment.receipts).some(receipt => receipt.receiptNo === 'R-NEGATIVE')).toBe(false)
  })

  it('maps blank-NIK sales using USERS even when ATLAS DATABASE has other employees', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-11T12:00:00+07:00'))

    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const sheet = new URL(String(input)).searchParams.get('sheet')

      if (sheet === 'COPAS S2') {
        return csvResponse([
          'NIK,NAMA,DATE,NO RECEIPT,ARTICLE CODE,ARTICLE NAME,DEPARTMENT,QUANTITY,PRICE,DISCOUNT,INCLUDE PPN,EXCLUDE PPN,JOBTITLE,TANGGAL,ZONA',
          ',BASTOMI FEBRIANTO,01/11/2026,R1,SKU1,Product,Dept,1,400000,0,400000,360270,,01-11-2026,Outdoor Comfort',
          ',BASTOMI FEBRIANTO,04/11/2026,R2,SKU2,Product,Dept,1,600000,0,600000,531441,,04-11-2026,Home Textile',
          ',UNMAPPED FORMER EMPLOYEE,05/11/2026,R3,SKU3,Product,Dept,1,500000,0,500000,450000,,05-11-2026,Other',
        ].join('\n'))
      }

      if (sheet === 'KUNCIAN SKU') return csvResponse('SKU,SKU1')
      if (sheet === 'TARGET') return csvResponse([
        'NIK,NAMA,TARGET SALES DAILY,TARGET SALES BULAN',
        '152535,BASTOMI FEBRIANTO,1000000,30000000',
      ].join('\n'))
      if (sheet === 'USERS') return csvResponse([
        'NIK,NAMA,ROLE,JOBTITLE,PASSWORD',
        '152535,BASTOMI FEBRIANTO,user,ADVISOR,123456',
      ].join('\n'))
      if (sheet === 'ATLAS DATABASE') {
        return csvResponse('NIK,NAMA\n190001,Other Employee')
      }
      if (sheet === 'COPAS') {
        return csvResponse('NIK,NAMA\n190002,Another Employee')
      }
      if (sheet === 'MEMBER' || sheet === 'SETTING') return csvResponse('SECTION,NAMA,AKTIF')
      return csvResponse('')
    }))

    try {
      const debugLog: string[] = []
      const result = await buildRawPerformance(
        '152535',
        message => debugLog.push(message),
        new Set(['152535']),
      )

      expect(result.mtdPerf.actual).toBe(891711)
      expect(result.mtdPerf.ranking.find(entry => entry.nik === '152535')?.value).toBe(891711)
      expect(result.teamMtdEmployees.find(employee => employee.nik === '152535')?.sales).toBe(891711)
      expect(result.mtdPerf.actual).not.toBe(1341711)
      expect(result.salesAttributionWarning).toContain('UNMAPPED FORMER EMPLOYEE')
      expect(debugLog.some(message => message.includes('UNMAPPED FORMER EMPLOYEE'))).toBe(true)
    } finally {
      vi.useRealTimers()
    }
  })

  it('does not assign blank-NIK sales when the employee name maps to multiple NIKs', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-11T12:00:00+07:00'))

    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const sheet = new URL(String(input)).searchParams.get('sheet')
      if (sheet === 'COPAS S2') {
        return csvResponse([
          'NIK,NAMA,DATE,NO RECEIPT,ARTICLE CODE,ARTICLE NAME,DEPARTMENT,QUANTITY,PRICE,DISCOUNT,INCLUDE PPN,EXCLUDE PPN,JOBTITLE,TANGGAL,ZONA',
          ',SHARED EMPLOYEE NAME,01/11/2026,R1,SKU1,Product,Dept,1,500000,0,500000,450000,,01-11-2026,Zone',
        ].join('\n'))
      }
      if (sheet === 'KUNCIAN SKU') return csvResponse('SKU,SKU1')
      if (sheet === 'TARGET') return csvResponse([
        'NIK,NAMA,TARGET SALES DAILY,TARGET SALES BULAN',
        '152535,SHARED EMPLOYEE NAME,1000000,30000000',
      ].join('\n'))
      if (sheet === 'USERS') return csvResponse([
        'NIK,NAMA,ROLE,JOBTITLE,PASSWORD',
        '152535,SHARED EMPLOYEE NAME,user,ADVISOR,123456',
        '152536,SHARED EMPLOYEE NAME,user,ADVISOR,123456',
      ].join('\n'))
      if (sheet === 'ATLAS DATABASE' || sheet === 'COPAS') return csvResponse('NIK,NAMA')
      if (sheet === 'MEMBER' || sheet === 'SETTING') return csvResponse('SECTION,NAMA,AKTIF')
      return csvResponse('')
    }))

    try {
      const result = await buildRawPerformance(
        '152535',
        undefined,
        new Set(['152535', '152536']),
      )

      expect(result.mtdPerf.actual).toBe(0)
      expect(result.teamMtdEmployees.find(employee => employee.nik === '152535')?.sales).toBe(0)
      expect(result.teamMtdEmployees.find(employee => employee.nik === '152536')?.sales).toBe(0)
    } finally {
      vi.useRealTimers()
    }
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

  it('includes current-month US dates in today sales even when today is not in the first rows', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-02T12:00:00+07:00'))

    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const sheet = new URL(String(input)).searchParams.get('sheet')

      if (sheet === 'COPAS S2') {
        return csvResponse([
          'NIK,NAMA,,RECEIPT NO,ARTIKEL,DESKRIPSI,KODE,QTY,EMPTY1,EMPTY2,EMPTY3,TOTAL VALUE,,TANGGAL',
          '123702,Sales User,,R1,SKU1,Desc,Code,1,,,,100000,,11/1/2026',
          '123702,Sales User,,R2,SKU1,Desc,Code,1,,,,200000,,11/1/2026',
          '123702,Sales User,,R3,SKU1,Desc,Code,1,,,,300000,,11/1/2026',
          '123702,Sales User,,R4,SKU1,Desc,Code,1,,,,400000,,11/1/2026',
          '123702,Sales User,,R5,SKU1,Desc,Code,1,,,,500000,,11/1/2026',
          '123702,Sales User,,R6,SKU1,Desc,Code,1,,,,600000,,11/2/2026',
        ].join('\n'))
      }
      if (sheet === 'KUNCIAN SKU') return csvResponse('SKU,SKU1')
      if (sheet === 'TARGET') return csvResponse('NIK,NAMA,TARGET SALES DAILY,TARGET SALES BULAN\n123702,Sales User,1000000,3000000')
      if (sheet === 'MEMBER') return csvResponse('TANGGAL,TYPE,NAMA')
      if (sheet === 'SETTING') return csvResponse('SECTION,NAMA,AKTIF')
      if (sheet === 'ATLAS DATABASE' || sheet === 'COPAS') return csvResponse('NIK,NAMA')
      return csvResponse('')
    }))

    const result = await buildRawPerformance('123702', undefined, new Set(['123702']))

    expect(result.todayPerf.actual).toBe(600000)
    expect(result.teamTodayEmployees.find(employee => employee.nik === '123702')?.sales).toBe(600000)
  })

  it('keeps MTD sales on days 1 through yesterday and excludes today and prior months', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-08T12:00:00+07:00'))

    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const sheet = new URL(String(input)).searchParams.get('sheet')
      if (sheet === 'COPAS S2') {
        const rows = [
          'NIK,NAMA,,RECEIPT NO,ARTIKEL,DESKRIPSI,KODE,QTY,EMPTY1,EMPTY2,EMPTY3,TOTAL VALUE,,TANGGAL',
          '123702,Sales User,,R-OLD,SKU1,Desc,Code,1,,,,5000,,2026-10-31',
          ...Array.from({ length: 7 }, (_, index) =>
            `123702,Sales User,,R-${index + 1},SKU1,Desc,Code,1,,,,${(index + 1) * 100},,2026-11-${String(index + 1).padStart(2, '0')}`,
          ),
          '123702,Sales User,,R-TODAY,SKU1,Desc,Code,1,,,,800,,2026-11-08',
        ]
        return csvResponse(rows.join('\n'))
      }
      if (sheet === 'KUNCIAN SKU') return csvResponse('SKU,SKU1')
      if (sheet === 'TARGET') return csvResponse('NIK,NAMA,TARGET SALES DAILY,TARGET SALES BULAN\n123702,Sales User,1000000,3000000')
      if (sheet === 'SETTING') return csvResponse('SECTION,NAMA,AKTIF')
      if (sheet === 'MEMBER') return csvResponse('TANGGAL,TYPE,NAMA')
      if (sheet === 'ATLAS DATABASE' || sheet === 'COPAS') return csvResponse('NIK,NAMA')
      return csvResponse('')
    }))

    const result = await buildRawPerformance('123702', undefined, new Set(['123702']))

    expect(result.dateFrom).toBe('01/11/2026')
    expect(result.dateTo).toBe('07/11/2026')
    expect(result.mtdPerf.actual).toBe(2800)
    expect(result.teamMtdEmployees[0]?.sales).toBe(2800)
    expect(result.todayPerf.actual).toBe(800)
    expect(result.teamFullMonthEmployees[0]?.sales).toBe(3600)
  })

  it('reassigns blank-NIK sales rows to the employee named in the row', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-08T12:00:00+07:00'))

    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const sheet = new URL(String(input)).searchParams.get('sheet')
      if (sheet === 'COPAS S2') {
        return csvResponse([
          'NIK,NAMA,,RECEIPT NO,ARTIKEL,DESKRIPSI,KODE,QTY,EMPTY1,EMPTY2,EMPTY3,TOTAL VALUE,,TANGGAL',
          ',IRNA RIWAYATI.,,R0,SKU1,Desc,Code,1,,,,500000,,2026-11-01',
          '92022,IRNA RIWAYATI.,,R1,SKU1,Desc,Code,1,,,,1000000,,2026-11-01',
          '12345,OTHER EMPLOYEE,,R2,SKU1,Desc,Code,1,,,,9000000,,2026-11-02',
          ',IRNA RIWAYATI.,,R3,SKU1,Desc,Code,1,,,,2000000,,2026-11-02',
          ',IRNA RIWAYATI.,,R4,SKU1,Desc,Code,1,,,,3000000,,2026-11-03',
          ',UNMAPPED EMPLOYEE,,R5,SKU1,Desc,Code,1,,,,7000000,,2026-11-03',
        ].join('\n'))
      }
      if (sheet === 'KUNCIAN SKU') return csvResponse('SKU,SKU1')
      if (sheet === 'TARGET') return csvResponse([
        'NIK,NAMA,TARGET SALES DAILY,TARGET SALES BULAN',
        '92022,IRNA RIWAYATI,1000000,30000000',
        '12345,OTHER EMPLOYEE,1000000,30000000',
      ].join('\n'))
      if (sheet === 'SETTING') return csvResponse('SECTION,NAMA,AKTIF')
      if (sheet === 'MEMBER') return csvResponse('TANGGAL,TYPE,NAMA')
      if (sheet === 'ATLAS DATABASE') return csvResponse('NIK,NAMA')
      if (sheet === 'USERS') return csvResponse([
        'NIK,NAMA,ROLE,JOBTITLE,PASSWORD',
        '12345,OTHER EMPLOYEE,user,Sales,123456',
      ].join('\n'))
      if (sheet === 'COPAS') return csvResponse('NIK,NAMA')
      return csvResponse('')
    }))

    const result = await buildRawPerformance(
      '92022',
      undefined,
      new Set(['92022', '12345']),
    )

    expect(result.mtdPerf.actual).toBe(6500000)
    expect(result.mtdPerf.ranking.find(employee => employee.nik === '92022')?.value).toBe(6500000)
    expect(result.teamMtdEmployees.find(employee => employee.nik === '92022')?.sales).toBe(6500000)
    expect(result.teamMtdEmployees.find(employee => employee.nik === '12345')?.sales).toBe(9000000)
  })

  it('starts MTD from the current month after the month changes', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-01T12:00:00+07:00'))
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const sheet = new URL(String(input)).searchParams.get('sheet')

      if (sheet === 'COPAS S2') {
        const transaction = (nik: string, receipt: string, value: number, subcategory: string) => {
          const row = Array(15).fill('')
          row[0] = nik
          row[1] = nik === '123702' ? 'Sales User' : 'Other User'
          row[3] = receipt
          row[4] = 'SKU1'
          row[5] = 'Desc'
          row[6] = 'Code'
          row[7] = '1'
          row[11] = String(value)
          row[13] = '01/10/2026'
          row[14] = subcategory
          return row.join(',')
        }
        return csvResponse([
          'NIK,NAMA,,RECEIPT NO,ARTIKEL,DESKRIPSI,KODE,QTY,I,J,K,TOTAL VALUE,,TANGGAL,SUBKATEGORI',
          transaction('123702', 'A321.78', 100000, 'Cleaning Supplies'),
          transaction('123702', 'UA321.78', 50000, 'Appliances'),
          transaction('123702', 'R3.780', 250000, 'Paint & Sundries'),
          transaction('123702', 'A321.78.261007.45', 300000, 'Bicycles'),
          transaction('123702', 'R5', 50000, 'Lainnya'),
          transaction('123703', 'R6', 999000, 'Cleaning Supplies'),
        ].join('\n'))
      }
      if (sheet === 'TARGET') return csvResponse([
        'NIK,NAMA,OLD TARGET DAILY,TARGET SALES BULAN,,,,,,,,,,,TARGET SALES DAILY',
        '123702,Sales User,100000,3000000,,,,,,,,,,,100000',
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
      expect(result.todayPerf.actual).toBe(750000)
      expect(result.todayPerf.salesChannelContributions).toEqual({
        online: 450000,
        offline: 300000,
      })
      expect(
        (result.todayPerf.salesChannelContributions?.online ?? 0)
        + (result.todayPerf.salesChannelContributions?.offline ?? 0),
      ).toBe(result.todayPerf.actual)
      expect(result.todayPerf.salesContributions).toEqual({
        homeLiving: 150000,
        homeImprovement: 250000,
        hobbiesLifestyle: 300000,
        other: 50000,
      })
      expect(result.teamTodayEmployees[0]?.topSalesGroup).toBe('HOBBIES & LIFESTYLE')
      expect(result.teamTodayEmployees[0]?.topSalesGroupPct).toBe(40)
      expect(result.teamTodayEmployees[0]?.salesChannelContributions).toEqual({
        online: 450000,
        offline: 300000,
      })
      expect(result.teamTodayEmployees[0]?.salesByDepartment).toEqual({
        'Cleaning Supplies': 100000,
        Appliances: 50000,
        'Paint & Sundries': 250000,
        Bicycles: 300000,
        Lainnya: 50000,
      })
      expect(result.teamFullMonthEmployees[0]?.sales).toBe(750000)
      expect(result.teamFullMonthEmployees[0]?.salesChannelContributions).toEqual({
        online: 450000,
        offline: 300000,
      })
      expect(result.mtdPerf.salesContributions).toEqual({
        homeLiving: 0,
        homeImprovement: 0,
        hobbiesLifestyle: 0,
        other: 0,
      })
      expect(result.mtdPerf.salesChannelContributions).toEqual({ online: 0, offline: 0 })
      expect(result.mtdPerf.workingDays).toBe(0)
      expect(result.mtdPerf.targetMTD).toBe(0)
      expect(result.mtdPerf.target).toBe(3000000)
      expect(result.teamMtdEmployees[0]?.fullMonthTargetSales).toBe(3000000)
    } finally {
      vi.useRealTimers()
    }
  })

  it('does not use another sheet as a sales fallback when COPAS S2 is unavailable', async () => {
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

    await expect(buildRawPerformance('I01902', undefined, new Set(['OTHER'])))
      .rejects.toThrow('Data sales COPAS S2 tidak dapat dibaca')
  })

  it('merges Today sales for the same employee across alternate NIK formats', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-07T12:00:00+07:00'))
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input))
      const sheet = url.searchParams.get('sheet')

      if (sheet === 'COPAS S2') {
        const transaction = (nik: string, receipt: string, article: string, value: number) => {
          const row = Array(15).fill('')
          row[0] = nik
          row[1] = 'Kuncara Adi Wijaya'
          row[3] = receipt
          row[4] = article
          row[7] = '1'
          row[11] = String(value)
          row[13] = '07-Okt-2026'
          return row.join(',')
        }
        const unassignedRow = Array(15).fill('')
        unassignedRow[0] = '0'
        unassignedRow[3] = 'A321.78.261007.45'
        unassignedRow[4] = '70110976'
        unassignedRow[5] = 'Unassigned item'
        unassignedRow[7] = '1'
        unassignedRow[10] = '55500'
        unassignedRow[11] = '55500'
        unassignedRow[13] = '07-Okt-2026'
        return csvResponse([
          'NIK,NAMA,DATE,NO RECEIPT,ARTICLE CODE,ARTICLE NAME,DEPARTMENT,QUANTITY,PRICE,DISCOUNT,INCLUDE PPN,EXCLUDE PPN,JOBTITLE,TANGGAL,ZONA',
          transaction('116566', 'A321.78.261007.45', '10562164', 2297027),
          transaction('I16566', 'A321.1.261007.14', '10687760', 5315),
          unassignedRow.join(','),
        ].join('\n'))
      }
      if (sheet === 'KUNCIAN SKU') return csvResponse(['SKU', 'SKU1'].join('\n'))
      if (sheet === 'TARGET') return csvResponse(['NIK,NAMA,TARGET SALES DAILY,TARGET SALES BULAN', '116566,Kuncara Adi Wijaya,1000000,3000000'].join('\n'))
      if (sheet === 'SETTING') return csvResponse(['SECTION,NAMA,AKTIF', ''].join('\n'))
      if (sheet === 'MEMBER') return csvResponse(['TANGGAL,TYPE,NAMA', ''].join('\n'))
      if (sheet === 'ATLAS DATABASE') return csvResponse(['NIK,NAMA', '116566,Kuncara Adi Wijaya'].join('\n'))
      if (sheet === 'USERS') return csvResponse(['NIK,NAMA,ROLE,JOBTITLE,PASSWORD', '116566,Kuncara Adi Wijaya,user,Sales,123456'].join('\n'))
      return csvResponse('')
    }))

    const result = await buildRawPerformance('116566', undefined, new Set(['116566']))

    expect(result.todayPerf.actual).toBe(2302342)
    expect(result.todayPerf.ranking).toHaveLength(1)
    expect(result.todayPerf.ranking[0]?.value).toBe(2302342)
    expect(result.teamTodayEmployees[0]?.sales).toBe(2302342)
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
          'NIK,NAMA,OLD TARGET DAILY,TARGET SALES BULAN,TARGET TRANSAKSI DAILY,TARGET TRANSAKSI SATU BULAN,TARGET BASKET SIZE DAILY,TARGET BASKET SIZE SATU BULAN,JOB TITLE,,,,,,TARGET SALES DAILY',
          'I01902,Sales User,1000000,26000000,4,104,250000,250000,Sales,,,,,,1000000',
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
          'NIK,NAMA,OLD TARGET DAILY,TARGET SALES BULAN,TARGET TRANSAKSI DAILY,TARGET TRANSAKSI SATU BULAN,TARGET BASKET SIZE DAILY,TARGET BASKET SIZE SATU BULAN,JOB TITLE,,,,,,TARGET SALES DAILY',
          '123702,WAHYU RIANTO,3826538,99489988,10,260,382654,382654,ADV,,,,,,3826538',
          '123702,WAHYU RIANTO,3826538,99489988,15,390,255103,255103,ADV,,,,,,3826538',
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

  it('sums Proteksi Qty from column H for NIK 92022 across mapped and description-matched rows', async () => {
    const today = new Date()
    const todayText = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const sheet = new URL(String(input)).searchParams.get('sheet')
      if (sheet === 'COPAS S2') {
        return csvResponse([
          'NIK,NAMA,,RECEIPT NO,ARTIKEL,DESKRIPSI,KODE,QTY,EMPTY1,EMPTY2,EMPTY3,TOTAL VALUE,,TANGGAL',
          `92022,Sales User,,R1,PROT-001,Proteksi,Code,2,,,,500000,,${todayText}`,
          `92022,Sales User,,R2,prot 002,Proteksi,Code,1,,,,500000,,${todayText}`,
          `92022,Sales User,,R3,UNMAPPED-03,Proteksi,Code,3,,,,500000,,${todayText}`,
        ].join('\n'))
      }
      if (sheet === 'KUNCIAN SKU') return csvResponse(['REGULER,PROTEKSI', 'SKU1,PROT001', 'SKU2,PROT-002'].join('\n'))
      if (sheet === 'TARGET') return csvResponse(['NIK,NAMA,TARGET SALES DAILY,TARGET SALES BULAN', '92022,Sales User,1000000,3000000'].join('\n'))
      if (sheet === 'SETTING') return csvResponse([
        'SECTION,NAMA,AKTIF,TARGET_TYPE,TARGET_VALUE,UNIT,KETERANGAN',
        'KATEGORI,PROTEKSI,TRUE,tetap,10,pcs,',
      ].join('\n'))
      if (sheet === 'MEMBER') return csvResponse(['TANGGAL,TYPE,NAMA', ''].join('\n'))
      if (sheet === 'ATLAS DATABASE') return csvResponse(['NIK,NAMA', '92022,Sales User'].join('\n'))
      if (sheet === 'COPAS') return csvResponse(['NIK,NAMA', '92022,Sales User'].join('\n'))
      if (sheet === 'USERS') return csvResponse(['NIK,NAMA,ROLE,JOBTITLE,PASSWORD', '92022,Sales User,user,Sales,123456'].join('\n'))
      return csvResponse('')
    }))

    const result = await buildRawPerformance('92022', undefined, new Set(['92022']))
    const proteksi = result.todayPerf.kpis.find(kpi => kpi.label === 'PROTEKSI')
    expect(proteksi?.value).toBe(6)
    expect(result.todayPerf.ranking[0]?.protectionQty).toBe(6)
    expect(result.teamTodayEmployees[0]?.proteksi).toBe(6)
  })

  it('infers ambiguous Proteksi dates per row within MTD', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-09-13T12:00:00+07:00'))
    const today = new Date()
    const year = today.getFullYear()
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const sheet = new URL(String(input)).searchParams.get('sheet')
      if (sheet === 'COPAS S2') {
        return csvResponse([
          'NIK,NAMA,,RECEIPT NO,ARTIKEL,DESKRIPSI,KODE,QTY,EMPTY1,EMPTY2,EMPTY3,TOTAL VALUE,,TANGGAL',
          `123702,Wahyu Rianto,,R1,PROT001,Proteksi,Code,2,,,,500000,,9/10/${year}`,
          `123702,Wahyu Rianto,,R2,PROT002,Proteksi,Code,1,,,,500000,,9/11/${year}`,
          `123702,Wahyu Rianto,,R3,PROT003,Proteksi,Code,3,,,,500000,,9/12/${year}`,
          `123702,Wahyu Rianto,,R4,PROT004,Proteksi,Code,4,,,,500000,,12/09/${year}`,
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
    expect(mtdProteksi?.value).toBe(10)
    expect(result.mtdPerf.ranking[0]?.protectionQty).toBe(10)
    expect(result.teamMtdEmployees[0]?.proteksi).toBe(10)
  })
})
