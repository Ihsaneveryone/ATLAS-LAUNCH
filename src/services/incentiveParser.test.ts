import { describe, expect, it } from 'vitest'
import { parseIncentiveSheets } from './incentiveParser'

describe('parseIncentiveSheets', () => {
  it('parses conditional and unconditional incentive rows from sheet data', () => {
    const sheets = {
      'INSENTIF BERSYARAT': [
        ['NIK', 'Nama', 'Jumlah Insentif Toko', 'Status', 'Insentif Challenge Juli', 'Status'],
        ['191924', 'Muhammad Ihsar', '1000000', 'Terpenuhi', '500000', 'Terpenuhi'],
        ['187856', 'MONICA', '750000', 'Belum Terpenuhi', '250000', 'Belum Terpenuhi'],
      ],
      'INSENTIF TANPA SYARAT': [
        ['NIK', 'Nama', 'Insentif Produk / kategori', 'Bonus', 'Keterangan'],
        ['191924', 'Muhammad Ihsar', 'Produk A', '250000', 'Lunas'],
        ['187856', 'MONICA', 'Produk B', '150000', 'Lunas'],
      ],
      'SKU INSENTIF': [
        ['SKU / artikel', 'Nama produk / deskripsi', 'Syarat', 'Insentif value'],
        ['SKU-1', 'Produk A', '>10', '500000'],
        ['SKU-2', 'Produk B', '>5', '300000'],
      ],
    }

    const result = parseIncentiveSheets(sheets)

    expect(result.conditional.rows).toHaveLength(2)
    expect(result.conditional.rows[0]).toMatchObject({ nik: '191924', nama: 'Muhammad Ihsar', tokoValue: 1000000, status: 'Terpenuhi', challengeValue: 500000 })
    expect(result.unconditional.rows).toHaveLength(2)
    expect(result.unconditional.rows[0]).toMatchObject({ nik: '191924', nama: 'Muhammad Ihsar', category: 'Produk A', value: 250000 })
    expect(result.unconditional.rows[0].items).toEqual([{ label: 'Bonus', amount: 250000 }])
    expect(result.unconditional.rows[1].items).toEqual([{ label: 'Bonus', amount: 150000 }])
    expect(result.sku.rows).toHaveLength(2)
    expect(result.sku.rows[0]).toMatchObject({ sku: 'SKU-1', name: 'Produk A', requirement: '>10', incentiveValue: 500000 })
  })

  it('parses updated conditional sheet when NIK header cell is blank', () => {
    const sheets = {
      'INSENTIF BERSYARAT': [
        ['', 'NAMA', 'INSENTIF TOKO', 'STATUS', 'TRAFFIC PULLER', 'STATUS', 'SALES DRIVER', 'STATUS'],
        ['191125', 'DEFRI SETIAWAN', '', '', '87940', '', '117433', ''],
      ],
    }

    const result = parseIncentiveSheets(sheets)

    expect(result.conditional.rows).toHaveLength(1)
    expect(result.conditional.rows[0]).toMatchObject({
      nik: '191125',
      nama: 'DEFRI SETIAWAN',
    })
    expect(result.conditional.rows[0].items).toEqual([
      { label: 'INSENTIF TOKO', amount: 0, status: '' },
      { label: 'TRAFFIC PULLER', amount: 87940, status: '' },
      { label: 'SALES DRIVER', amount: 117433, status: '' },
    ])
  })

  it('keeps conditional incentive cards visible when values are empty by treating them as zero', () => {
    const sheets = {
      'INSENTIF BERSYARAT': [
        ['', 'NAMA', 'INSENTIF TOKO', 'STATUS', 'TRAFFIC PULLER', 'STATUS', 'SALES DRIVER', 'STATUS'],
        ['191125', 'DEFRI SETIAWAN', '', '', '', '', '', ''],
      ],
    }

    const result = parseIncentiveSheets(sheets)

    expect(result.conditional.rows).toHaveLength(1)
    expect(result.conditional.rows[0].items).toEqual([
      { label: 'INSENTIF TOKO', amount: 0, status: '' },
      { label: 'TRAFFIC PULLER', amount: 0, status: '' },
      { label: 'SALES DRIVER', amount: 0, status: '' },
    ])
  })

  it('prefers column F for boomsale price and uses direct value when column H is filled', () => {
    const sheets = {
      'INSENTIF BOOMSALE': [
        ['Artikel', 'Departemen', 'Nama Produk', 'Harga E', 'Harga F', 'Persentase', 'Nominal', 'Target Qty', 'Remark', 'Kategori', 'Gambar'],
        ['', 'Electrical', 'A100', 'Lampu', '400000', '500000', '5', '25000', '', '', '', '', '', '4', 'Bonus khusus', 'Traffic Puller', 'https://example.com/lampu.jpg'],
      ],
      'COMPARE DATA COPAS S2': [
        ['Artikel', 'Nama', 'Foo', 'Bar', 'Col E', 'Col F', 'Col G', 'Qty Actual'],
        ['A100', 'Lampu', '', '', '', '', '', '2'],
      ],
    }

    const result = parseIncentiveSheets(sheets)
    expect(result.boomsale.rows[0]).toMatchObject({
      artikel: 'A100',
      name: 'Lampu',
      departemen: 'Electrical',
      price: 500000,
      incentivePercent: 5,
      incentiveNominal: 25000,
      incentiveIsPercentage: false,
      incentiveValue: 25000,
      targetQty: 4,
      actualQty: 2,
      category: 'Traffic Puller',
      remark: 'Bonus khusus',
    })
  })

  it('uses percentage from column G when column H is empty', () => {
    const sheets = {
      'INSENTIF BOOMSALE': [
        ['Artikel', 'Departemen', 'Nama Produk', 'Harga E', 'Harga F', 'Persentase', 'Nominal', 'Target Qty', 'Remark', 'Kategori', 'Gambar'],
        ['', 'Electrical', 'A200', 'Kipas', '300000', '', '2', '', '', '', '', '', '', '3', '', 'Sales Driver', 'https://example.com/kipas.jpg'],
      ],
      'COMPARE DATA COPAS S2': [
        ['Artikel', 'Nama', 'Qty Actual'],
        ['A200', 'Kipas', '1'],
      ],
    }

    const result = parseIncentiveSheets(sheets)
    expect(result.boomsale.rows[0]).toMatchObject({
      artikel: 'A200',
      name: 'Kipas',
      price: 300000,
      incentivePercent: 2,
      incentiveIsPercentage: true,
      incentiveValue: 6000,
      targetQty: 3,
      actualQty: 1,
      category: 'Sales Driver',
    })
  })

  it('parses syarat insentif rows with target qty, article list and acv from compare sheet', () => {
    const sheets = {
      'SYARAT INSENTIF': [
        ['Jenis Insentif', 'Syarat', 'Target Qty', 'Artikel', 'Value per Qty'],
        ['Promo A', 'Beli 2 SKU', '10', 'SKU1/SKU2', '50000'],
      ],
      'COPAS S2': [
        ['', 'Nama', 'Tanggal', 'Receipt', 'Artikel', 'Deskripsi', 'Kode', 'Qty'],
        ['', 'NONAME', '01-07-2026', '123', 'SKU1', 'Product 1', 'P1', '2'],
        ['', 'NONAME', '01-07-2026', '124', 'SKU2', 'Product 2', 'P2', '1'],
      ],
    }

    const result = parseIncentiveSheets(sheets)
    expect(result.syarat.rows[0]).toMatchObject({
      jenis: 'Promo A',
      syarat: 'Beli 2 SKU',
      targetQty: 10,
      acvValue: 3,
      incentiveValuePerQty: 50000,
      articleList: ['SKU1', 'SKU2'],
    })
  })

  it('uses summed qty values from column H of compare sheet for proteksi acv', () => {
    const sheets = {
      'SYARAT INSENTIF': [
        ['Jenis Insentif', 'Syarat', 'Target Qty', 'Artikel', 'Value per Qty'],
        ['Proteksi', 'Pencapaian proteksi', '10', 'SKU1/SKU2', '50000'],
      ],
      'COPAS S2': [
        ['', 'Nama', 'Tanggal', 'Receipt', 'Artikel', 'Deskripsi', 'Kode', 'Qty'],
        ['', 'NONAME', '01-07-2026', '123', 'SKU1', 'Product 1', 'P1', '2'],
        ['', 'NONAME', '01-07-2026', '124', 'SKU2', 'Product 2', 'P2', '1'],
      ],
    }

    const result = parseIncentiveSheets(sheets)
    expect(result.syarat.rows[0]).toMatchObject({
      acvValue: 3,
      articleList: ['SKU1', 'SKU2'],
    })
  })

  it('parses receipt incentive rows from current live sheet headers', () => {
    const sheets = {
      'INSENTIF RECEIPT DEPT': [
        ['NO', 'Dept Grp', 'Minimum Receipt Value', 'Incentive %'],
        ['1', 'ELECTRICAL', '40.000.000', '1%'],
        ['2', 'LIGHTING', '20.000.000', '2%'],
      ],
    }

    const result = parseIncentiveSheets(sheets)

    expect(result.receipt.rows).toEqual([
      expect.objectContaining({ no: '1', departemen: 'ELECTRICAL', targetValue: 40000000, percentage: 1 }),
      expect.objectContaining({ no: '2', departemen: 'LIGHTING', targetValue: 20000000, percentage: 2 }),
    ])
  })
})
