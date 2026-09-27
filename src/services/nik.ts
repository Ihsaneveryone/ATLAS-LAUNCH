export function getNikVariants(value: string | null | undefined): string[] {
  const raw = `${value ?? ''}`.trim().toUpperCase().replace(/^['"`]+|['"`]+$/g, '')
  const cleaned = raw.replace(/\s+/g, '').replace(/[^A-Z0-9]/g, '')
  const digits = cleaned.replace(/\D/g, '')
  const variants = new Set<string>()

  if (cleaned) variants.add(cleaned)

  if (digits) {
    variants.add(digits)

    const compactDigits = digits.replace(/^0+/, '')
    if (compactDigits) variants.add(compactDigits)

    // Format I + 5 digit (I01902) dapat menjadi 101902 (1 + 01902)
    if (cleaned.startsWith('I') && digits.length >= 5) {
      const withDigit1 = '1' + digits  // I01902 -> 101902, I91924 -> 191924
      variants.add(withDigit1)
      if (digits.length > 5) {
        variants.add(`I${digits.startsWith('1') ? digits.slice(1) : digits}`)
      }
      if (digits.startsWith('0')) {
        variants.add(digits.slice(1))
      }
    }

    // Format 6-digit: 101902 / 191924
    if (digits.length >= 5) {
      const noLeadingOne = digits.startsWith('1') ? digits.slice(1) : digits
      variants.add(noLeadingOne)
      variants.add(`I${noLeadingOne}`)
    }

    // Strip leading zeros for all formats
    if (digits.length > 5) variants.add(digits.slice(-5))
    if (digits.length === 6 && digits.startsWith('0')) variants.add(digits.slice(1))
  }

  return Array.from(variants)
}

export function niksMatch(left: string | null | undefined, right: string | null | undefined): boolean {
  if (!left || !right) return false
  const leftVariants = getNikVariants(left)
  const rightVariants = getNikVariants(right)
  return leftVariants.some(v => rightVariants.includes(v))
}

export function looksLikeNik(value: string | null | undefined): boolean {
  const variants = getNikVariants(value)
  return variants.some(v => /\d/.test(v) && v.length >= 4)
}

/**
 * Normalize NIK to canonical form (I01902 or 101902 both → 101902)
 * All I-prefix interns are converted to pure digit format.
 * This also handles mixed exports such as I91924 / 191924.
 */
export function canonicalNik(value: string | null | undefined): string {
  if (!value) return value ?? ''
  const cleaned = `${value}`.trim().toUpperCase().replace(/^['"`]+|['"`]+$/g, '')

  if (!cleaned) return cleaned

  // I + digits -> add the missing leading 1 to keep the numeric NIK consistent
  if (/^I\d{4,6}$/i.test(cleaned)) {
    const withoutPrefix = cleaned.replace(/^I/i, '')
    return `1${withoutPrefix}`
  }

  const digits = cleaned.replace(/\D/g, '')
  return digits || cleaned
}
