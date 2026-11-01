import { useEffect, useMemo, useState } from "react"

import type { User } from "../data/mockData"

import { formatRupiahFull } from "../data/mockData"

import { useMobile } from "../hooks/useMobile"

import {
  buildBestProductReport,
  fetchBestProductRows,
  type BestProductArticle,
  type BestProductDepartment,
  type BestProductPeriod,
  type BestProductReport,
} from "../services/bestProductApi"

interface Props {
  user: User

  onBack: () => void
}

const BORDER = "#e8edf8"

const TEXT = "#1e293b"

const MUTED = "#94a3b8"

const SUB = "#64748b"

const PAGE_SIZE = 30

function formatQuantity(value: number): string {
  return value.toLocaleString("id-ID", { maximumFractionDigits: 2 })
}

function getProductImageUrl(article: string): string {
  return `https://cdn.ruparupa.io/fit-in/1000x1000/filters:format(webp)/filters:quality(90)/ruparupa-com/image/upload/Products/${encodeURIComponent(article)}_1.jpg`
}

function HighlightCard({
  title,

  article,

  metric,

  value,

  color,

  isMobile,
}: {
  title: string

  article: BestProductArticle | undefined

  metric: string

  value: (article: BestProductArticle) => string

  color: string

  isMobile: boolean
}) {
  const [imageFailed, setImageFailed] = useState(false)

  useEffect(() => {
    setImageFailed(false)
  }, [article?.article])

  return (
    <article
      style={{
        minWidth: 0,

        background: `linear-gradient(145deg, #fff 0%, ${color}08 100%)`,

        border: `1px solid ${color}30`,

        borderRadius: 16,

        padding: isMobile ? 15 : 18,
      }}
    >
      <div
        style={{
          color,

          fontSize: 10,

          fontWeight: 800,

          letterSpacing: "0.07em",

          textTransform: "uppercase",

          marginBottom: 10,
        }}
      >
        {title}
      </div>
      {article ? (
        <>
          <div
            style={{
              height: isMobile ? 190 : 260,
              margin: "0 -2px 13px",
              borderRadius: 12,
              overflow: "hidden",
              background: "#fff",
              border: `1px solid ${BORDER}`,
              display: "grid",
              placeItems: "center",
            }}
          >
            {!imageFailed ? (
              <img
                src={getProductImageUrl(article.article)}
                alt={`Gambar ${article.description || article.article}`}
                loading="lazy"
                onError={() => setImageFailed(true)}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "contain",
                  objectPosition: "center",
                  display: "block",
                }}
              />
            ) : (
              <div
                style={{
                  color: MUTED,
                  fontSize: 11,
                  textAlign: "center",
                  padding: 12,
                }}
              >
                Gambar produk tidak tersedia
              </div>
            )}
          </div>
          <div
            title={article.description || article.article}
            style={{
              color: TEXT,

              fontSize: 14,

              fontWeight: 800,

              lineHeight: 1.4,

              overflowWrap: "anywhere",

              marginBottom: 3,
            }}
          >
            {article.description || article.article}
          </div>
          <div
            style={{
              color: MUTED,
              fontSize: 10,
              fontFamily: "monospace",
              marginBottom: 12,
            }}
          >
            Artikel {article.article}
          </div>
          <div
            style={{
              color: TEXT,
              fontSize: isMobile ? 19 : 23,
              fontWeight: 900,
            }}
          >
            {value(article)}
          </div>
          <div style={{ color: SUB, fontSize: 10, marginTop: 3 }}>{metric}</div>
        </>
      ) : (
        <div style={{ color: MUTED, fontSize: 13, padding: "8px 0" }}>
          Belum ada penjualan pada periode ini.
        </div>
      )}
    </article>
  )
}

function ProductTable({
  department,

  isMobile,

  page,

  onPageChange,
}: {
  department: BestProductDepartment

  isMobile: boolean

  page: number

  onPageChange: (page: number) => void
}) {
  const pageCount = Math.max(
    1,
    Math.ceil(department.articles.length / PAGE_SIZE),
  )

  const visibleProducts = department.articles.slice(
    (page - 1) * PAGE_SIZE,

    page * PAGE_SIZE,
  )

  return (
    <section
      style={{
        background: "#fff",

        border: `1px solid ${BORDER}`,

        borderRadius: 16,

        overflow: "hidden",

        boxShadow: "0 2px 8px rgba(0,0,0,0.035)",
      }}
    >
      <div
        style={{
          padding: isMobile ? "14px" : "17px 20px",

          display: "flex",

          alignItems: "center",

          justifyContent: "space-between",

          gap: 12,

          flexWrap: "wrap",

          borderBottom: `1px solid ${BORDER}`,
        }}
      >
        <div>
          <div style={{ color: TEXT, fontSize: 14, fontWeight: 800 }}>
            Detail Penjualan Artikel
          </div>
          <div style={{ color: MUTED, fontSize: 11, marginTop: 3 }}>
            {department.articles.length.toLocaleString("id-ID")} artikel · urut
            berdasarkan value terbesar
          </div>
        </div>
        <div style={{ display: "flex", gap: 7 }}>
          <button
            type="button"
            onClick={() => onPageChange(Math.max(1, page - 1))}
            disabled={page <= 1}
            style={{
              border: `1px solid ${BORDER}`,

              background: "#fff",

              borderRadius: 8,

              padding: "7px 10px",

              color: page <= 1 ? MUTED : SUB,

              fontWeight: 700,

              cursor: page <= 1 ? "not-allowed" : "pointer",
            }}
          >
            ‹
          </button>
          <span style={{ alignSelf: "center", color: SUB, fontSize: 11 }}>
            {page} / {pageCount}
          </span>
          <button
            type="button"
            onClick={() => onPageChange(Math.min(pageCount, page + 1))}
            disabled={page >= pageCount}
            style={{
              border: `1px solid ${BORDER}`,

              background: "#fff",

              borderRadius: 8,

              padding: "7px 10px",

              color: page >= pageCount ? MUTED : SUB,

              fontWeight: 700,

              cursor: page >= pageCount ? "not-allowed" : "pointer",
            }}
          >
            ›
          </button>
        </div>
      </div>
      <div style={{ maxHeight: 440, overflow: "auto" }}>
        <table
          style={{
            width: "100%",

            minWidth: isMobile ? 510 : 0,

            borderCollapse: "separate",

            borderSpacing: 0,
          }}
        >
          <thead style={{ position: "sticky", top: 0, zIndex: 1 }}>
            <tr style={{ background: "#f8faff" }}>
              {["#", "Nama Artikel", "Kode Artikel", "Qty", "Value"].map(
                (heading) => (
                  <th
                    key={heading}
                    style={{
                      padding: "11px 13px",

                      borderBottom: `1px solid ${BORDER}`,

                      color: MUTED,

                      fontSize: 9,

                      fontWeight: 800,

                      textAlign:
                        heading === "Qty" || heading === "Value"
                          ? "right"
                          : "left",

                      textTransform: "uppercase",

                      letterSpacing: "0.04em",

                      whiteSpace: "nowrap",

                      background: "#f8faff",
                    }}
                  >
                    {heading}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {visibleProducts.map((article, index) => (
              <tr
                key={article.article}
                style={{ background: index % 2 === 0 ? "#fff" : "#fcfdff" }}
              >
                <td
                  style={{
                    padding: "10px 13px",
                    borderBottom: `1px solid ${BORDER}`,
                    color: MUTED,
                    fontSize: 11,
                    width: 40,
                  }}
                >
                  {(page - 1) * PAGE_SIZE + index + 1}
                </td>
                <td
                  style={{
                    padding: "10px 13px",
                    borderBottom: `1px solid ${BORDER}`,
                    color: TEXT,
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                >
                  {article.description || "—"}
                </td>
                <td
                  style={{
                    padding: "10px 13px",
                    borderBottom: `1px solid ${BORDER}`,
                    color: SUB,
                    fontSize: 11,
                    fontFamily: "monospace",
                    whiteSpace: "nowrap",
                  }}
                >
                  {article.article}
                </td>
                <td
                  style={{
                    padding: "10px 13px",
                    borderBottom: `1px solid ${BORDER}`,
                    color: TEXT,
                    fontSize: 12,
                    fontWeight: 700,
                    textAlign: "right",
                    whiteSpace: "nowrap",
                  }}
                >
                  {formatQuantity(article.qty)}
                </td>
                <td
                  style={{
                    padding: "10px 13px",
                    borderBottom: `1px solid ${BORDER}`,
                    color: TEXT,
                    fontSize: 12,
                    fontWeight: 800,
                    textAlign: "right",
                    whiteSpace: "nowrap",
                  }}
                >
                  {formatRupiahFull(article.value)}
                </td>
              </tr>
            ))}
            {visibleProducts.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  style={{
                    padding: 32,
                    textAlign: "center",
                    color: MUTED,
                    fontSize: 12,
                  }}
                >
                  Belum ada transaksi artikel untuk departemen ini.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}

export default function BestProdukDept({ user, onBack }: Props) {
  const isMobile = useMobile()

  const [period, setPeriod] = useState<BestProductPeriod>("mtd")

  const [rows, setRows] = useState<string[][] | null>(null)

  const [loading, setLoading] = useState(true)

  const [error, setError] = useState<string | null>(null)

  const [selectedDepartment, setSelectedDepartment] = useState("")

  const [tablePage, setTablePage] = useState(1)

  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let active = true

    setLoading(true)

    setError(null)

    fetchBestProductRows(reloadKey > 0)
      .then((result) => {
        if (!active) return

        setRows(result)
        setTablePage(1)
      })

      .catch((reason) => {
        if (active)
          setError(reason instanceof Error ? reason.message : String(reason))
      })

      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [reloadKey])

  const report: BestProductReport | null = useMemo(
    () => (rows ? buildBestProductReport(rows, period) : null),
    [rows, period],
  )

  useEffect(() => {
    if (!report) return
    setSelectedDepartment((current) =>
      report.departments.some((department) => department.name === current)
        ? current
        : (report.departments[0]?.name ?? ""),
    )
    setTablePage(1)
  }, [report])

  const department = useMemo(
    () => report?.departments.find((item) => item.name === selectedDepartment),

    [report, selectedDepartment],
  )

  const bestByQty = department
    ? [...department.articles].sort(
        (a, b) => b.qty - a.qty || b.value - a.value,
      )[0]
    : undefined

  const bestByValue = department?.articles[0]

  const px = isMobile ? 16 : 28

  return (
    <div style={{ minHeight: "100vh", background: "#f0f4ff", color: TEXT }}>
      <header
        style={{
          position: "sticky",

          top: 0,

          zIndex: 5,

          background: "#fff",

          borderBottom: `1px solid ${BORDER}`,

          padding: isMobile ? "12px 16px" : "14px 28px",

          boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
        }}
      >
        <div
          style={{
            maxWidth: 1200,
            margin: "0 auto",
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <button
            onClick={onBack}
            aria-label="Kembali ke menu"
            style={{
              width: 36,
              height: 36,
              border: `1px solid ${BORDER}`,
              borderRadius: 10,
              background: "#fff",
              color: SUB,
              fontSize: 20,
              cursor: "pointer",
            }}
          >
            ‹
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                color: MUTED,
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.07em",
              }}
            >
              ATLAS · {user.nama}
            </div>
            <h1
              style={{
                margin: "2px 0 0",
                color: TEXT,
                fontSize: 17,
                fontWeight: 900,
              }}
            >
              BEST PRODUK DEPT
            </h1>
          </div>
          <button
            onClick={() => setReloadKey((key) => key + 1)}
            disabled={loading}
            title="Muat ulang data"
            style={{
              height: 36,
              padding: "0 12px",
              border: `1px solid ${BORDER}`,
              borderRadius: 9,
              background: "#fff",
              color: SUB,
              fontSize: 12,
              fontWeight: 700,
              cursor: loading ? "wait" : "pointer",
            }}
          >
            {loading ? "Memuat…" : "↻"}
          </button>
        </div>
      </header>

      <main
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          padding: px,
          display: "grid",
          gap: 16,
        }}
      >
        <section
          style={{
            display: "flex",

            alignItems: isMobile ? "stretch" : "center",

            justifyContent: "space-between",

            gap: 14,

            flexWrap: "wrap",

            padding: isMobile ? 15 : 19,

            border: `1px solid ${BORDER}`,

            borderRadius: 16,

            background: "#fff",
          }}
        >
          <div>
            <div style={{ color: TEXT, fontWeight: 800, fontSize: 14 }}>
              Produk terlaris per departemen
            </div>
            <div style={{ color: SUB, fontSize: 11, marginTop: 4 }}>
              Peringkat berdasarkan jumlah unit dan nilai penjualan artikel.
            </div>
          </div>
          <div
            style={{
              display: "inline-flex",
              gap: 3,
              padding: 4,
              background: "#f0f4ff",
              border: `1px solid ${BORDER}`,
              borderRadius: 10,
            }}
          >
            {([
              ["sbd", "SBD"],

              ["mtd", "MTD"],
            ] as const).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setPeriod(key)}
                style={{
                  border: 0,

                  borderRadius: 7,

                  padding: "8px 14px",

                  background: period === key ? "#D93119" : "transparent",

                  color: period === key ? "#fff" : SUB,

                  fontSize: 11,

                  fontWeight: 800,

                  cursor: "pointer",
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </section>

        {error && (
          <div
            role="alert"
            style={{
              padding: 14,
              border: "1px solid #fecaca",
              borderRadius: 12,
              background: "#fff7f7",
              color: "#991b1b",
              fontSize: 12,
            }}
          >
            Data produk gagal dimuat: {error}
            <button
              onClick={() => setReloadKey((key) => key + 1)}
              style={{
                marginLeft: 10,
                border: 0,
                background: "transparent",
                color: "#991b1b",
                textDecoration: "underline",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Coba lagi
            </button>
          </div>
        )}

        {loading && (
          <div
            style={{
              padding: 30,
              textAlign: "center",
              border: `1px solid ${BORDER}`,
              borderRadius: 16,
              background: "#fff",
              color: SUB,
              fontSize: 13,
            }}
          >
            Mengambil data artikel COPAS S2…
          </div>
        )}

        {!loading && report && report.departments.length === 0 && (
          <div
            style={{
              padding: 28,
              textAlign: "center",
              border: `1px solid ${BORDER}`,
              borderRadius: 16,
              background: "#fff",
              color: SUB,
              fontSize: 13,
            }}
          >
            Belum ada penjualan artikel untuk periode {period.toUpperCase()}.
          </div>
        )}

        {!loading && department && (
          <>
            <section
              aria-label="Pilih departemen"
              style={{
                display: "flex",
                gap: 7,
                overflowX: "auto",
                paddingBottom: 3,
              }}
            >
              {report?.departments.map((item) => {
                const active = item.name === department.name

                return (
                  <button
                    key={item.name}
                    onClick={() => {
                      setSelectedDepartment(item.name)

                      setTablePage(1)
                    }}
                    style={{
                      flexShrink: 0,

                      border: `1px solid ${active ? "#D93119" : BORDER}`,

                      borderRadius: 10,

                      padding: "9px 12px",

                      background: active ? "#D93119" : "#fff",

                      color: active ? "#fff" : SUB,

                      fontSize: 11,

                      fontWeight: 800,

                      cursor: "pointer",
                    }}
                  >
                    {item.name}
                    <span
                      style={{ opacity: active ? 0.8 : 0.6, marginLeft: 6 }}
                    >
                      {item.articleCount}
                    </span>
                  </button>
                )
              })}
            </section>

            <section>
              <div
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  justifyContent: "space-between",
                  gap: 10,
                  flexWrap: "wrap",
                  marginBottom: 10,
                }}
              >
                <div>
                  <div style={{ color: TEXT, fontSize: 16, fontWeight: 900 }}>
                    {department.name}
                  </div>
                  <div style={{ color: MUTED, fontSize: 11, marginTop: 3 }}>
                    {department.articleCount.toLocaleString("id-ID")} artikel ·{" "}
                    {report?.transactionCount.toLocaleString("id-ID")} transaksi
                    · {period.toUpperCase()}
                  </div>
                </div>
                <div style={{ color: SUB, fontSize: 11 }}>
                  Total {formatQuantity(department.totalQty)} unit ·{" "}
                  {formatRupiahFull(department.totalValue)}
                </div>
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: isMobile
                    ? "1fr"
                    : "repeat(2, minmax(0, 1fr))",
                  gap: 12,
                }}
              >
                <HighlightCard
                  title="Artikel terlaris · Qty"
                  article={bestByQty}
                  metric="unit terjual"
                  value={(article) => `${formatQuantity(article.qty)} unit`}
                  color="#0e7490"
                  isMobile={isMobile}
                />
                <HighlightCard
                  title="Artikel terbesar · Value"
                  article={bestByValue}
                  metric="nilai penjualan"
                  value={(article) => formatRupiahFull(article.value)}
                  color="#7c3aed"
                  isMobile={isMobile}
                />
              </div>
            </section>

            <ProductTable
              department={department}
              isMobile={isMobile}
              page={tablePage}
              onPageChange={setTablePage}
            />
          </>
        )}

        {!loading && Boolean(report?.unmatchedCategories.length) && (
          <details style={{ color: SUB, fontSize: 11 }}>
            <summary style={{ cursor: "pointer" }}>
              Kategori belum dipetakan ({report?.unmatchedCategories.length})
            </summary>
            <div style={{ marginTop: 7 }}>
              {report?.unmatchedCategories.join(", ")}
            </div>
          </details>
        )}
      </main>
    </div>
  )
}
