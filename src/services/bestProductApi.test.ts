import { afterEach, describe, expect, it, vi } from "vitest"
import { buildBestProductReport, fetchBestProductRows } from "./bestProductApi"

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("buildBestProductReport", () => {
  const today = new Date(2026, 9, 7, 12)

  it("maps COPAS categories to departments and ranks articles by quantity and value", () => {
    const report = buildBestProductReport(
      [
        [
          "101",
          "Sales",
          "",
          "R1",
          "CLEAN-1",
          "Cairan pembersih",
          "",
          "3",
          "",
          "",
          "",
          "150000",
          "",
          "07/10/2026",
          "Cleaning Supplies",
        ],

        [
          "101",
          "Sales",
          "",
          "R2",
          "CLEAN-1",
          "Cairan pembersih",
          "",
          "2",
          "",
          "",
          "",
          "200000",
          "",
          "07/10/2026",
          "Cleaning Supplies",
        ],

        [
          "101",
          "Sales",
          "",
          "R3",
          "CLEAN-2",
          "Sikat",
          "",
          "6",
          "",
          "",
          "",
          "100000",
          "",
          "07/10/2026",
          "Cleaning Appliances",
        ],

        [
          "101",
          "Sales",
          "",
          "R4",
          "HOME-1",
          "Kotak penyimpanan",
          "",
          "9",
          "",
          "",
          "",
          "900000",
          "",
          "07/10/2026",
          "Home Storage",
        ],

        [
          "101",
          "Sales",
          "",
          "R5",
          "OLD-1",
          "Barang lama",
          "",
          "99",
          "",
          "",
          "",
          "999999",
          "",
          "06/10/2026",
          "Cleaning Supplies",
        ],
      ],
      "sbd",
      today,
    )

    const cleaning = report.departments.find(
      (department) => department.name === "Cleaning",
    )

    expect(cleaning?.articles).toMatchObject([
      { article: "CLEAN-1", qty: 5, value: 350000 },

      { article: "CLEAN-2", qty: 6, value: 100000 },
    ])

    expect(
      cleaning?.articles.reduce((top, item) =>
        item.qty > top.qty ? item : top,
      ).article,
    )

      .toBe("CLEAN-2")

    expect(
      report.departments.find(
        (department) => department.name === "Home Storage",
      )?.totalValue,
    ).toBe(900000)

    expect(report.transactionCount).toBe(4)
  })

  it("limits MTD data to the current Jakarta month through today", () => {
    const report = buildBestProductReport(
      [
        [
          "101",
          "Sales",
          "",
          "R1",
          "JAN",
          "Current month",
          "",
          "1",
          "",
          "",
          "",
          "100",
          "",
          "01/10/2026",
          "Appliances",
        ],

        [
          "101",
          "Sales",
          "",
          "R2",
          "SEP",
          "Previous month",
          "",
          "3",
          "",
          "",
          "",
          "300",
          "",
          "30/09/2026",
          "Appliances",
        ],

        [
          "101",
          "Sales",
          "",
          "R3",
          "FUTURE",
          "Future",
          "",
          "9",
          "",
          "",
          "",
          "900",
          "",
          "08/10/2026",
          "Appliances",
        ],
      ],
      "mtd",
      today,
    )

    expect(
      report.departments.find((department) => department.name === "Appliances")
        ?.articles,
    )

      .toMatchObject([{ article: "JAN", qty: 1, value: 100 }])
  })

  it("reuses COPAS rows and fetches again only when explicitly refreshed", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(
          [
            "NIK,NAMA,,RECEIPT NO,ARTIKEL,DESKRIPSI,KODE,QTY,I,J,K,TOTAL VALUE,,TANGGAL,SUB CATEGORY",
            "101,Sales,,R1,SKU1,Product,Code,1,,,,100,,07/10/2026,Kitchenware",
          ].join("\n"),
          { status: 200 },
        ),
    )
    vi.stubGlobal("fetch", fetchMock)

    const first = await fetchBestProductRows()
    const second = await fetchBestProductRows()

    expect(first).toBe(second)
    expect(fetchMock).toHaveBeenCalledTimes(1)

    await fetchBestProductRows(true)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
