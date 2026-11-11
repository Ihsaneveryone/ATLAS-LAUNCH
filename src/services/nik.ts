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
    // Format I + 6 digit yang sudah diawali 1 (I152532) harus tetap 152532,
    // bukan berubah jadi 1152532.
    if (cleaned.startsWith('I') && digits.length >= 4 && digits.length <= 6) {
      const withDigit1 =
        digits.length === 6 && digits.startsWith('1') ? digits : `1${digits}`
      variants.add(withDigit1)

      const noLeadingOne = digits.startsWith('1') ? digits.slice(1) : digits
      if (noLeadingOne) {
        variants.add(`I${noLeadingOne}`)
        variants.add(noLeadingOne)
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

export function isValidNikFormat(value: string | null | undefined): boolean {
  const cleaned = `${value ?? ''}`.trim().toUpperCase().replace(/^['"`]+|['"`]+$/g, '')
  return /^(?:I\d{4,6}|\d{4,})$/.test(cleaned)
}

/**
 * Normalize NIK to canonical form (I01902 or 101902 both → 101902)
 * All I-prefix interns are converted to pure digit format.
 * This also handles mixed exports such as I91924 / 191924 and I152535 / 152535.
 */
export function canonicalNik(value: string | null | undefined): string {
  if (!value) return value ?? ''
  const cleaned = `${value}`.trim().toUpperCase().replace(/^['"`]+|['"`]+$/g, '')

  if (!cleaned) return cleaned

  const digits = cleaned.replace(/\D/g, '')
  if (!digits) return cleaned

  // I + digits -> add the missing leading 1 to keep the numeric NIK consistent.
  // If the value is already a 6-digit NIK that starts with 1 (e.g. I152532), do
  // not prepend another 1; it would incorrectly turn into 1152532.
  if (/^I\d+$/i.test(cleaned)) {
    const withoutPrefix = digits
    if (withoutPrefix.length === 6 && withoutPrefix.startsWith('1')) {
      return withoutPrefix
    }
    if (withoutPrefix.length >= 4 && withoutPrefix.length <= 6) {
      return `1${withoutPrefix}`
    }
    return withoutPrefix
  }

  return digits
}
