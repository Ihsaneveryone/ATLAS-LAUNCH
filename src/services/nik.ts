export function getNikVariants(value: string | null | undefined): string[] {
  const raw = `${value ?? ''}`.trim().toUpperCase().replace(/^['"`]+|['"`]+$/g, '')
  const cleaned = raw.replace(/\s+/g, '').replace(/[^A-Z0-9]/g, '')
  const digits = cleaned.replace(/\D/g, '')
  const variants = new Set<string>()

  if (cleaned) variants.add(cleaned)
  
  if (digits) {
    variants.add(digits)
    
    // Format I + 5 digit (I01902) dapat menjadi 101902 (1 + 01902)
    if (cleaned.startsWith('I') && cleaned.length === 6) {
      const withDigit1 = '1' + cleaned.slice(1)  // 101902
      variants.add(withDigit1)
      variants.add(digits)  // 01902
      // Also add with leading zero removed: 1902
      if (digits.startsWith('0')) {
        variants.add(digits.slice(1))  // 1902
      }
    }
    
    // Format 6-digit: 101902 → add variants
    if (digits.length === 6 && digits.startsWith('1')) {
      variants.add(digits.slice(1))  // 01902
      // If it's exactly 1XXXXX, also try as single digit 1 + XXXXX
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
 * All I-prefix interns are converted to pure digit format
 */
export function canonicalNik(value: string | null | undefined): string {
  if (!value) return value ?? ''
  const cleaned = value.trim()
  // I01902 format → 101902
  if (cleaned.match(/^I\d{5}$/i)) {
    return '1' + cleaned.slice(1)
  }
  // Already in pure digit format or other format
  return cleaned
}
