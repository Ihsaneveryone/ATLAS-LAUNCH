import { useState, useEffect } from 'react'
import {
  getColumnMappings,
  setColumnMappings,
  resetColumnMappings,
  getAvailableFeatures,
  getFeatureSheetMappings,
  getFeatureSections,
  getFeatureSectionMappings,
  toggleMappingActive,
  columnLetterToIndex,
  type ColumnMapping,
  type DataFeature,
} from '../services/columnMappingService'

export default function ColumnMappingPanel() {
  const [mappings, setMappingsState] = useState<ColumnMapping[]>([])
  const [selectedFeature, setSelectedFeature] = useState<DataFeature>('Performance SID')
  const [selectedSheet, setSelectedSheet] = useState<string>('COPAS S2')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editColumn, setEditColumn] = useState<string>('')

  const features = getAvailableFeatures()

  useEffect(() => {
    setMappingsState(getColumnMappings())
  }, [])

  // Get sheets used by current feature
  const featureMappings = mappings.filter(m => m.feature === selectedFeature)
  const featureSheets = [...new Set(featureMappings.map(m => m.sheet))]

  // Update selected sheet if it's not available for current feature
  useEffect(() => {
    if (!featureSheets.includes(selectedSheet) && featureSheets.length > 0) {
      setSelectedSheet(featureSheets[0])
    }
  }, [selectedFeature])

  // Get mappings for current feature + sheet combination
  const currentMappings = getFeatureSheetMappings(selectedFeature as DataFeature, selectedSheet)

  // Group by section
  const sections = getFeatureSections(selectedFeature as DataFeature)
  const mappingsBySection = sections.map(section => ({
    section,
    mappings: getFeatureSectionMappings(selectedFeature as DataFeature, section)
  }))

  const handleToggle = (id: string) => {
    const updated = toggleMappingActive(id)
    setMappingsState(updated)
  }

  const handleEdit = (id: string) => {
    const mapping = mappings.find(m => m.id === id)
    if (mapping) {
      setEditingId(id)
      setEditColumn(mapping.columnLetter)
    }
  }

  const handleSaveEdit = (id: string) => {
    const updated = [...mappings]
    const idx = updated.findIndex(m => m.id === id)
    if (idx !== -1) {
      const normalized = editColumn.toUpperCase().replace(/[^A-Z]/g, '')
      const colIndex = columnLetterToIndex(normalized)
      if (colIndex >= 0) {
        updated[idx].columnLetter = normalized
        updated[idx].columnIndex = colIndex
        setColumnMappings(updated)
        setMappingsState(updated)
      }
    }
    setEditingId(null)
  }

  const handleReset = () => {
    if (confirm('Reset semua column mapping ke default? Ini akan menghapus semua perubahan Anda.')) {
      resetColumnMappings()
      setMappingsState(getColumnMappings())
    }
  }

  const getTypeColor = (dataType: string) => {
    switch (dataType) {
      case 'text': return '#60a5fa'
      case 'number': return '#34d399'
      case 'date': return '#fbbf24'
      case 'currency': return '#f87171'
      default: return '#9ca3af'
    }
  }

  return (
    <div style={{ background: '#fff', borderRadius: 18, padding: '24px', border: '1.5px solid #e8edf8', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 20, fontWeight: 900, color: '#1e293b', marginBottom: 8 }}>
          📋 Konfigurasi Column Mapping
        </h2>
        <p style={{ fontSize: 12, color: '#64748b', marginBottom: 16 }}>
          Atur mapping kolom dari spreadsheet. Pilih feature → sheet → lihat semua field yang tersedia dengan kolom mana yang digunakan.
        </p>

        {/* Feature Selection */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 8, display: 'block' }}>
            📊 Feature
          </label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {features.map(feature => (
              <button
                key={feature}
                onClick={() => setSelectedFeature(feature)}
                style={{
                  padding: '8px 14px',
                  borderRadius: 8,
                  border: 'none',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  background: selectedFeature === feature ? '#2563eb' : '#e2e8f0',
                  color: selectedFeature === feature ? '#fff' : '#475569',
                }}
              >
                {feature}
              </button>
            ))}
          </div>
        </div>

        {/* Sheet Selection (for current feature) */}
        {featureSheets.length > 1 && (
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 8, display: 'block' }}>
              📄 Sheet
            </label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {featureSheets.map(sheet => (
                <button
                  key={sheet}
                  onClick={() => setSelectedSheet(sheet)}
                  style={{
                    padding: '8px 14px',
                    borderRadius: 8,
                    border: 'none',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    background: selectedSheet === sheet ? '#7c3aed' : '#f3e8ff',
                    color: selectedSheet === sheet ? '#fff' : '#6b21a8',
                  }}
                >
                  {sheet}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Mappings by Section */}
      <div style={{ marginBottom: 24 }}>
        {mappingsBySection.length > 0 ? (
          mappingsBySection.map(({ section, mappings: sectionMappings }) => {
            // Filter to current sheet
            const sheetMappings = sectionMappings.filter(m => m.sheet === selectedSheet)
            if (sheetMappings.length === 0) return null

            const activeCount = sheetMappings.filter(m => m.active).length
            return (
              <div key={section} style={{ marginBottom: 20 }}>
                {/* Section Header */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    marginBottom: 12,
                    paddingBottom: 8,
                    borderBottom: '2px solid #e2e8f0',
                  }}
                >
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 800,
                      color: '#7c3aed',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                    }}
                  >
                    {section}
                  </span>
                  <span
                    style={{
                      fontSize: 10,
                      color: '#94a3b8',
                      background: '#f1f5f9',
                      padding: '2px 6px',
                      borderRadius: 4,
                    }}
                  >
                    {activeCount}/{sheetMappings.length}
                  </span>
                </div>

                {/* Mappings Table for this section */}
                <div style={{ overflowX: 'auto', marginBottom: 16 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', borderBottom: '1.5px solid #cbd5e1' }}>
                        <th
                          style={{
                            padding: '8px 12px',
                            textAlign: 'left',
                            fontWeight: 700,
                            color: '#475569',
                          }}
                        >
                          Field
                        </th>
                        <th
                          style={{
                            padding: '8px 12px',
                            textAlign: 'left',
                            fontWeight: 700,
                            color: '#475569',
                          }}
                        >
                          Description
                        </th>
                        <th
                          style={{
                            padding: '8px 12px',
                            textAlign: 'center',
                            fontWeight: 700,
                            color: '#475569',
                          }}
                        >
                          Column
                        </th>
                        <th
                          style={{
                            padding: '8px 12px',
                            textAlign: 'center',
                            fontWeight: 700,
                            color: '#475569',
                          }}
                        >
                          Type
                        </th>
                        <th
                          style={{
                            padding: '8px 12px',
                            textAlign: 'center',
                            fontWeight: 700,
                            color: '#475569',
                          }}
                        >
                          Status
                        </th>
                        <th
                          style={{
                            padding: '8px 12px',
                            textAlign: 'center',
                            fontWeight: 700,
                            color: '#475569',
                          }}
                        >
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {sheetMappings.map(mapping => (
                        <tr
                          key={mapping.id}
                          style={{
                            borderBottom: '1px solid #e2e8f0',
                            background: !mapping.active ? 'rgba(15, 23, 42, 0.02)' : '#fff',
                            opacity: !mapping.active ? 0.6 : 1,
                          }}
                        >
                          <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontWeight: 600, color: '#1e293b' }}>
                            {mapping.fieldName}
                          </td>
                          <td style={{ padding: '8px 12px', color: '#475569' }}>
                            {mapping.description}
                          </td>
                          <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                            {editingId === mapping.id ? (
                              <input
                                type="text"
                                value={editColumn}
                                onChange={e => setEditColumn(e.target.value.toUpperCase())}
                                maxLength={2}
                                style={{
                                  width: '40px',
                                  padding: '4px 6px',
                                  textAlign: 'center',
                                  border: '2px solid #3b82f6',
                                  borderRadius: 6,
                                  fontFamily: 'monospace',
                                  fontWeight: 700,
                                  fontSize: 11,
                                }}
                                autoFocus
                              />
                            ) : (
                              <span
                                style={{
                                  display: 'inline-block',
                                  background: '#dbeafe',
                                  color: '#1e40af',
                                  padding: '4px 8px',
                                  borderRadius: 6,
                                  fontFamily: 'monospace',
                                  fontWeight: 700,
                                }}
                              >
                                {mapping.columnLetter}
                              </span>
                            )}
                          </td>
                          <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                            <span
                              style={{
                                display: 'inline-block',
                                background: getTypeColor(mapping.dataType) + '20',
                                color: getTypeColor(mapping.dataType),
                                padding: '2px 8px',
                                borderRadius: 4,
                                fontSize: 10,
                                fontWeight: 600,
                              }}
                            >
                              {mapping.dataType}
                            </span>
                          </td>
                          <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                            <button
                              onClick={() => handleToggle(mapping.id)}
                              style={{
                                padding: '4px 8px',
                                borderRadius: 6,
                                border: 'none',
                                fontSize: 10,
                                fontWeight: 600,
                                cursor: 'pointer',
                                background: mapping.active ? '#dcfce7' : '#fee2e2',
                                color: mapping.active ? '#16a34a' : '#dc2626',
                                transition: 'all 0.2s',
                              }}
                            >
                              {mapping.active ? '✓ Active' : '✗ Inactive'}
                            </button>
                          </td>
                          <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                            {editingId === mapping.id ? (
                              <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                                <button
                                  onClick={() => handleSaveEdit(mapping.id)}
                                  style={{
                                    padding: '4px 8px',
                                    background: '#16a34a',
                                    color: '#fff',
                                    border: 'none',
                                    borderRadius: 4,
                                    fontSize: 10,
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                  }}
                                >
                                  Save
                                </button>
                                <button
                                  onClick={() => setEditingId(null)}
                                  style={{
                                    padding: '4px 8px',
                                    background: '#94a3b8',
                                    color: '#fff',
                                    border: 'none',
                                    borderRadius: 4,
                                    fontSize: 10,
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                  }}
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => handleEdit(mapping.id)}
                                style={{
                                  padding: '4px 8px',
                                  background: '#2563eb',
                                  color: '#fff',
                                  border: 'none',
                                  borderRadius: 4,
                                  fontSize: 10,
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                }}
                              >
                                Edit
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          })
        ) : (
          <div style={{ textAlign: 'center', padding: '20px', color: '#94a3b8' }}>
            Tidak ada mapping untuk feature/sheet ini.
          </div>
        )}
      </div>

      {/* Summary */}
      <div style={{ background: '#eff6ff', border: '1.5px solid #bfdbfe', borderRadius: 12, padding: 12, marginBottom: 16 }}>
        <p style={{ fontSize: 11, color: '#1e40af', margin: 0 }}>
          <strong>Summary:</strong> {currentMappings.filter(m => m.active).length} / {currentMappings.length} columns active untuk {selectedFeature} → {selectedSheet}
        </p>
      </div>

      {/* Reset Button */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <button
          onClick={handleReset}
          style={{
            padding: '10px 16px',
            background: '#dc2626',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            fontSize: 12,
            fontWeight: 700,
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
          onMouseOver={e => (e.currentTarget.style.background = '#b91c1c')}
          onMouseOut={e => (e.currentTarget.style.background = '#dc2626')}
        >
          🔄 Reset ke Default
        </button>
        <span style={{ fontSize: 11, color: '#64748b' }}>
          Reset semua mapping ke konfigurasi standar
        </span>
      </div>

      {/* Info Box */}
      <div style={{ background: '#fef3c7', border: '1.5px solid #fcd34d', borderRadius: 12, padding: 12, marginTop: 16 }}>
        <p style={{ fontSize: 11, color: '#78350f', margin: '0 0 8px 0' }}>
          <strong>ℹ️ Tips Penggunaan:</strong>
        </p>
        <ul style={{ fontSize: 10, color: '#78350f', margin: 0, paddingLeft: 16 }}>
          <li>Gunakan <strong>Toggle Active</strong> untuk mengaktifkan/menonaktifkan pengambilan data dari kolom tertentu</li>
          <li>Gunakan <strong>Edit</strong> untuk mengubah kolom mana yang digunakan (misal: ubah dari A ke B)</li>
          <li>Perubahan akan dikirim ke backend bersama lewat Apps Script agar semua device membaca konfigurasi yang sama</li>
          <li>Beberapa kolom bersifat <strong>optional</strong> dan bisa dinonaktifkan tanpa masalah</li>
        </ul>
      </div>
    </div>
  )
}
