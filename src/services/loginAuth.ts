import type { User } from "../data/mockData"

import { normalizeJobTitle } from "./jobTitle"

export function findAuthenticatedUser(
  users: User[],

  inputNik: string,

  inputPassword: string,
): User | undefined {
  const normalizeNik = (value: string) => value.trim().toLowerCase()

  const normalizePassword = (value: string) => value.trim().toLowerCase()

  const accounts = users.filter(
    (account) => normalizeNik(account.nik) === normalizeNik(inputNik),
  )

  const authenticatedAccount = accounts.find(
    (account) =>
      normalizePassword(account.password) === normalizePassword(inputPassword),
  )

  if (!authenticatedAccount) return undefined

  return (
    accounts.find(
      (account) => normalizeJobTitle(account.jobTitle) === "MANAGER",
    ) ?? authenticatedAccount
  )
}
