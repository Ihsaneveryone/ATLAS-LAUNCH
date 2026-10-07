import { describe, expect, it } from 'vitest'
import type { User } from '../data/mockData'
import { getYesterdayJakartaDate, parseMgbDate, selectYesterdayMgbReviews } from './mgbReviewApi'

const user: User = {
  nik: '100829',
  nama: 'Harini',
  role: 'user',
  jobTitle: 'Crew',
  password: '',
  departmentUser: 'Cleaning',
}

describe('MGB review date handling', () => {
  it('parses sheet dates as day/month/year and ISO dates', () => {
    expect(parseMgbDate('05/10/2026')).toBe('2026-10-05')
    expect(parseMgbDate('2026-10-05')).toBe('2026-10-05')
    expect(parseMgbDate('31/02/2026')).toBeNull()
  })

  it('uses yesterday in Jakarta even when UTC is on another calendar day', () => {
    expect(getYesterdayJakartaDate(new Date('2026-10-05T18:00:00.000Z'))).toBe('2026-10-05')
  })
})

describe('selectYesterdayMgbReviews', () => {
  it('shows only reviewed rows from the logged-in user department and yesterday', () => {
    const csv = [
      '"TANGGAL","NIK","NAMA","DEPT","MGB 1","MGB 2","MGB 3","","","NIK CHECKER","NAMA CHECKER","FOTO CHECKER 1","FOTO CHECKER 2","FOTO CHECKER 3","NILAI","KATEGORI","NOTED"',
      '"04/10/2026","100829","Harini","Cleaning","","","","","","","","","","","","",""',
      '"05/10/2026","112256","Heni","Cleaning","https://example.com/mgb.jpg","","","","","191924","Checker","https://example.com/checker.jpg","","","85","B","Rapi"',
      '"05/10/2026","106789","Oki","Cleaning","","","","","","191924","Checker","","","","92","A","Sesuai standar"',
      '"05/10/2026","123456","Other dept","Appliances","","","","","","191924","Checker","","","","90","A","Catatan"',
      '"04/10/2026","100829","Harini","Cleaning","","","","","","191924","Checker","","","","85","B","Hari sebelumnya"',
      '"05/10/2026","106789","No review","Cleaning","","","","","","","","","","","","",""',
    ].join('\n')

    const reviews = selectYesterdayMgbReviews(csv, user, '2026-10-05')

    expect(reviews).toHaveLength(2)
    expect(reviews[0]).toMatchObject({
      nik: '112256',
      name: 'Heni',
      department: 'Cleaning',
      score: '85',
      category: 'B',
      note: 'Rapi',
      mgbPhotos: ['https://example.com/mgb.jpg'],
      checkerPhotos: ['https://example.com/checker.jpg'],
    })
    expect(reviews[1]).toMatchObject({
      nik: '106789',
      name: 'Oki',
      score: '92',
      category: 'A',
      note: 'Sesuai standar',
    })
  })
})
