import { useState } from 'react'
import azkoLogo from '../imports/logo-azko_ratio-16x9__1_.jpg'
import type { User } from '../data/mockData'

interface Props { user: User; onBack: () => void }

type SheetKey = 'users' | 'daily' | 'mtd' | 'ytd'

const S = { bg: '#f0f4ff', card: '#fff', border: '#e8edf8', muted: '#94a3b8', text: '#1e293b', sub: '#64748b' }

const SHEETS: { key: SheetKey; label: string; tab: string; emoji: string; color: string }[] = [
  { key: 'users', label: 'USERS',         tab: 'Sheet 1',  emoji: '👤', color: '#D93119' },
  { key: 'daily', label: 'DAILY SALES',   tab: 'Sheet 2',  emoji: '📊', color: '#f59e0b' },
  { key: 'mtd',   label: 'MONTH TO DATE', tab: 'Sheet 3',  emoji: '📅', color: '#059669' },
  { key: 'ytd',   label: 'YEAR TO DATE',  tab: 'Sheet 4',  emoji: '📈', color: '#7c3aed' },
]

interface ColDef { col: string; header: string; type: string; contoh: string; desc: string }

const COLUMNS: Record<SheetKey, ColDef[]> = {
  users: [
    { col: 'A', header: 'NIK',      type: 'Text',          contoh: '191924',          desc: 'Nomor Induk Karyawan (Primary Key login)' },
    { col: 'B', header: 'NAMA',     type: 'Text',          contoh: 'KARYAWAN A',      desc: 'Nama lengkap karyawan' },
    { col: 'C', header: 'ROLE',     type: 'admin / user',  contoh: 'admin',           desc: '"admin" untuk manajer, "user" untuk karyawan' },
    { col: 'D', header: 'JOBTITLE', type: 'Text',          contoh: 'Manajer',         desc: 'Jabatan karyawan (Manajer, Sales, SPV, CCR, dll)' },
    { col: 'E', header: 'PASSWORD', type: 'Text',          contoh: '123456',          desc: 'Password login karyawan' },
    { col: 'F', header: 'DEPARTEMEN USER', type: 'Text',   contoh: 'Home Comfort',    desc: 'Departemen user untuk filter ranking (bisa lebih dari 1 pilihan saat filter)' },
    { col: 'G', header: 'ZONA',     type: 'Text',          contoh: 'Zona 1',          desc: 'Zona user untuk filter ranking admin/user' },
  ],
  daily: [
    { col: 'A',  header: 'NIK',            type: 'Text',    contoh: '187856',      desc: 'NIK karyawan — harus sama dengan sheet USERS' },
    { col: 'B',  header: 'NAMA',           type: 'Text',    contoh: 'KARYAWAN A',  desc: 'Nama karyawan' },
    { col: 'C',  header: 'JOB TITLE',      type: 'Text',    contoh: 'Sales',       desc: 'Jabatan karyawan' },
    { col: 'F',  header: 'TOTAL SALES',    type: 'Number',  contoh: '13500000',    desc: 'Total nilai penjualan hari itu (Rupiah)' },
    { col: 'G',  header: 'TARGET SALES',   type: 'Number',  contoh: '15000000',    desc: 'Target penjualan harian (Rupiah)' },
    { col: 'K',  header: 'TRANSAKSI',      type: 'Number',  contoh: '23',          desc: 'Jumlah transaksi yang terjadi' },
    { col: 'O',  header: 'QTY ITEM',       type: 'Number',  contoh: '48',          desc: 'Total item terjual' },
    { col: 'P',  header: 'AUR',            type: 'Number',  contoh: '273125',      desc: 'Average Unit Retail = Total Sales ÷ Qty Item' },
    { col: 'Q',  header: 'UPT',            type: 'Desimal', contoh: '2.1',         desc: 'Unit Per Transaction = Qty Item ÷ Transaksi' },
    { col: 'R',  header: 'BASKET SIZE',    type: 'Number',  contoh: '570000',      desc: 'Rata-rata nilai per transaksi = Sales ÷ TRX' },
    { col: 'S',  header: 'PROTEKSI',       type: 'Number',  contoh: '8',           desc: 'Jumlah penjualan proteksi/garansi' },
    { col: 'T',  header: 'INSTANT UPGRADE',type: 'Number',  contoh: '3',           desc: 'Jumlah transaksi instant upgrade' },
    { col: 'U',  header: 'NEW MEMBER',     type: 'Number',  contoh: '5',           desc: 'Jumlah member baru didaftarkan' },
  ],
  mtd: [
    { col: 'A',  header: 'NIK',             type: 'Text',    contoh: '187856',  desc: 'NIK karyawan' },
    { col: 'B',  header: 'NAMA',            type: 'Text',    contoh: 'KARYAWAN A', desc: 'Nama karyawan' },
    { col: 'C',  header: 'JOB TITLE',       type: 'Text',    contoh: 'Sales',   desc: 'Jabatan karyawan' },
    { col: 'E',  header: 'SALES',           type: 'Number',  contoh: '118965000', desc: 'Total sales bulan berjalan (Rupiah)' },
    { col: 'F',  header: 'TARGET',          type: 'Number',  contoh: '165000000', desc: 'Target sales bulanan (Rupiah)' },
    { col: 'J',  header: 'TRANSAKSI',       type: 'Number',  contoh: '198',     desc: 'Total transaksi bulan berjalan' },
    { col: 'O',  header: 'BASKET SIZE',     type: 'Number',  contoh: '600750',  desc: 'Rata-rata nilai transaksi MTD' },
    { col: 'S',  header: 'PROTEKSI',        type: 'Number',  contoh: '62',      desc: 'Total proteksi terjual MTD' },
    { col: 'T',  header: 'NEW MEMBER',      type: 'Number',  contoh: '38',      desc: 'Total new member MTD' },
    { col: 'U',  header: 'INSTANT UPGRADE', type: 'Number',  contoh: '22',      desc: 'Total instant upgrade MTD' },
    { col: 'AB', header: 'TOTAL 5 STRATEGY',type: 'Number',  contoh: '112',     desc: 'Total poin dari 5 strategi penjualan' },
    { col: 'AC', header: 'OFF/CUTI',        type: 'Number',  contoh: '1',       desc: 'Jumlah hari off / cuti dalam periode MTD' },
  ],
  ytd: [],
}

const SAMPLES: Record<SheetKey, string[][]> = {
  users: [
    ['191924', 'KARYAWAN A', 'admin', 'Manajer',       '123456', 'Management',   'Zona 1'],
    ['187856', 'KARYAWAN B', 'user',  'Sales',         '654321', 'Home Comfort', 'Zona 2'],
    ['176413', 'KARYAWAN C', 'user',  'Sales Advisor', 'azko123', 'Kitchenware',  'Zona 2'],
    ['113230', 'KARYAWAN D', 'user',  'Sales Advisor', 'azko123', 'Kitchenware',  'Zona 3'],
  ],
  daily: [
    ['187856', 'KARYAWAN B', 'Sales', '13500000', '15000000', '23', '48', '273125', '2.1', '570000', '8', '3', '5'],
    ['176413', 'KARYAWAN C', 'Sales Advisor', '18500000', '15000000', '30', '62', '298387', '2.1', '616666', '12', '5', '7'],
    ['113230', 'KARYAWAN D', 'Sales Advisor', '16200000', '15000000', '27', '55', '294545', '2.0', '600000', '10', '4', '6'],
  ],
  mtd: [
    ['187856', 'KARYAWAN B', 'Sales', '118965000', '165000000', '198', '600750', '62', '38', '22', '112', '1'],
    ['176413', 'KARYAWAN C', 'Sales Advisor', '145200000', '165000000', '242', '599173', '78', '45', '30', '138', '0'],
    ['113230', 'KARYAWAN D', 'Sales Advisor', '168400000', '165000000', '270', '623703', '91', '52', '36', '156', '0'],
  ],
  ytd: [],
}

export default function SpreadsheetGuide({ onBack }: Props) {
  const [active, setActive] = useState<SheetKey>('users')
  const cols  = COLUMNS[active]
  const rows  = SAMPLES[active]
  const sheet = SHEETS.find(s => s.key === active)!

  return (
    <div style={{ minHeight: '100vh', background: S.bg }}>
      <header style={{ background: S.card, borderBottom: `1px solid ${S.border}`, padding: '14px 32px', display: 'flex', alignItems: 'center', gap: 12, position: 'sticky', top: 0, zIndex: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
        <img src={azkoLogo} alt="Azko" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', objectPosition: 'center', boxShadow: '0 2px 8px rgba(217,49,25,0.25)' }}/>
        <span style={{ color: S.text, fontWeight: 800, fontSize: 14, letterSpacing: '0.06em' }}>ATLAS</span>
        <div style={{ width: 1, height: 20, background: S.border }}/>
        <button onClick={onBack} style={{ background: 'none', border: 'none', color: S.muted, fontSize: 13, cursor: 'pointer', fontWeight: 600, padding: 0, transition: 'color 0.15s' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = S.text }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = S.muted }}
        >← Menu</button>
        <div style={{ width: 1, height: 20, background: S.border }}/>
        <span style={{ color: S.text, fontWeight: 700, fontSize: 14 }}>Template Spreadsheet</span>
        <span style={{ color: S.muted, fontSize: 12 }}>ATLAS DATABASE</span>
      </header>

      <main style={{ maxWidth: 1100, margin: '0 auto', padding: '28px 32px', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Info banner */}
        <div style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 18, padding: '20px 24px', display: 'flex', gap: 16, alignItems: 'flex-start', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: '#f0f4ff', border: `1px solid ${S.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>📄</div>
          <div>
            <p style={{ color: S.text, fontWeight: 700, fontSize: 14, marginBottom: 6 }}>File: <span style={{ color: '#059669', fontFamily: 'monospace' }}>ATLAS DATABASE</span> — Google Sheets</p>
            <p style={{ color: S.sub, fontSize: 13, lineHeight: 1.65 }}>
              Buat <b>1 file Google Sheets</b> dengan nama <b>ATLAS DATABASE</b> berisi <b>4 tab sheet</b> sesuai format di bawah.
              Baris pertama adalah header — jangan diubah. Data karyawan mulai dari <b>baris ke-2</b>.
              Kolom ACV tidak perlu diisi — ATLAS menghitungnya otomatis.
            </p>
          </div>
        </div>

        {/* Sheet tabs */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {SHEETS.map(s => (
            <button key={s.key} onClick={() => setActive(s.key)}
              style={{
                padding: '9px 18px', borderRadius: 12,
                border: `1.5px solid ${active === s.key ? s.color : S.border}`,
                background: active === s.key ? `${s.color}10` : S.card,
                cursor: 'pointer', transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: 7,
                boxShadow: active === s.key ? `0 4px 14px ${s.color}20` : 'none',
              }}
              onMouseEnter={e => { if (active !== s.key) (e.currentTarget as HTMLElement).style.borderColor = s.color }}
              onMouseLeave={e => { if (active !== s.key) (e.currentTarget as HTMLElement).style.borderColor = S.border }}
            >
              <span style={{ fontSize: 15 }}>{s.emoji}</span>
              <div style={{ textAlign: 'left' }}>
                <div style={{ color: active === s.key ? s.color : S.sub, fontWeight: 700, fontSize: 12 }}>{s.label}</div>
                <div style={{ color: S.muted, fontSize: 10 }}>{s.tab}</div>
              </div>
            </button>
          ))}
        </div>

        {active === 'ytd' ? (
          <div style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 18, padding: '48px 24px', textAlign: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📈</div>
            <h3 style={{ color: S.text, fontSize: 18, fontWeight: 800, marginBottom: 8 }}>Year to Date — Segera Hadir</h3>
            <p style={{ color: S.muted, fontSize: 14 }}>Format kolom sheet YEAR TO DATE akan diinformasikan menyusul.</p>
          </div>
        ) : (
          <>
            {/* Date note for daily */}
            {active === 'daily' && (
              <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 12, padding: '12px 18px', display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 16 }}>📌</span>
                <p style={{ color: '#92400e', fontSize: 13, margin: 0 }}>
                  <b>Tanggal</b> disimpan di sel <b style={{ fontFamily: 'monospace' }}>T1</b> (bukan sebagai kolom data). Isi dengan format tanggal: <span style={{ fontFamily: 'monospace' }}>DD/MM/YYYY</span>
                </p>
              </div>
            )}

            {/* Column definitions */}
            <div style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 18, overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
              <div style={{ padding: '16px 22px', borderBottom: `1px solid ${S.border}`, display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 18 }}>{sheet.emoji}</span>
                <span style={{ color: S.text, fontWeight: 700, fontSize: 14 }}>Sheet: {sheet.label} — Definisi Kolom</span>
                <span style={{ marginLeft: 'auto', color: S.muted, fontSize: 12 }}>{cols.length} kolom aktif</span>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${S.border}`, background: S.bg }}>
                      {['Kolom', 'Header', 'Tipe Data', 'Contoh', 'Keterangan'].map(h => (
                        <th key={h} style={{ padding: '10px 16px', color: S.muted, fontSize: 11, fontWeight: 700, textAlign: 'left', textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {cols.map((col, i) => (
                      <tr key={i} style={{ borderBottom: `1px solid ${S.border}`, transition: 'background 0.12s' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = S.bg }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                      >
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{ color: sheet.color, fontFamily: 'monospace', fontSize: 13, fontWeight: 800, background: `${sheet.color}10`, padding: '2px 8px', borderRadius: 5 }}>{col.col}</span>
                        </td>
                        <td style={{ padding: '12px 16px', color: S.text, fontFamily: 'monospace', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap' }}>{col.header}</td>
                        <td style={{ padding: '12px 16px', color: '#7c3aed', fontSize: 12, whiteSpace: 'nowrap' }}>{col.type}</td>
                        <td style={{ padding: '12px 16px', color: '#059669', fontFamily: 'monospace', fontSize: 12, whiteSpace: 'nowrap' }}>{col.contoh}</td>
                        <td style={{ padding: '12px 16px', color: S.sub, fontSize: 13 }}>{col.desc}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Sample data */}
            <div style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 18, overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
              <div style={{ padding: '16px 22px', borderBottom: `1px solid ${S.border}` }}>
                <span style={{ color: S.text, fontWeight: 700, fontSize: 14 }}>Contoh Data — {sheet.label}</span>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'monospace' }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${S.border}`, background: S.bg }}>
                      <th style={{ padding: '9px 14px', color: S.muted, fontSize: 11, textAlign: 'center', width: 40 }}>Baris</th>
                      {cols.map(c => (
                        <th key={c.col} style={{ padding: '9px 14px', textAlign: 'left', whiteSpace: 'nowrap' }}>
                          <span style={{ color: sheet.color, fontSize: 11, display: 'block' }}>Kol {c.col}</span>
                          <span style={{ color: S.text, fontSize: 11, fontWeight: 700 }}>{c.header}</span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, ri) => (
                      <tr key={ri} style={{ borderBottom: `1px solid ${S.border}`, transition: 'background 0.12s' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = S.bg }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                      >
                        <td style={{ padding: '10px 14px', color: S.muted, fontSize: 12, textAlign: 'center' }}>{ri + 2}</td>
                        {row.map((cell, ci) => (
                          <td key={ci} style={{ padding: '10px 14px', color: S.text, fontSize: 12, whiteSpace: 'nowrap' }}>{cell}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* Notes */}
        <div style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 18, padding: '22px 24px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
          <p style={{ color: S.text, fontWeight: 700, fontSize: 14, marginBottom: 16 }}>Catatan Penting</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              { icon: '🔑', text: 'NIK di semua sheet harus konsisten persis (huruf & angka sama) dengan NIK di sheet USERS.' },
              { icon: '🧮', text: 'Kolom ACV tidak perlu diisi di spreadsheet — ATLAS menghitung otomatis dari Total Sales ÷ Hari Kerja.' },
              { icon: '📌', text: 'Tanggal di sheet DAILY SALES disimpan di sel T1, bukan sebagai kolom per baris.' },
              { icon: '📅', text: 'Sheet MONTH TO DATE berisi akumulasi bulan berjalan — update setiap hari dari awal bulan.' },
              { icon: '☁️', text: 'Bagikan file Google Sheets dengan akses "Viewer" ke sistem ATLAS untuk integrasi data otomatis.' },
            ].map((n, i) => (
              <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>{n.icon}</span>
                <p style={{ color: S.sub, fontSize: 13, margin: 0, lineHeight: 1.6 }}>{n.text}</p>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}
