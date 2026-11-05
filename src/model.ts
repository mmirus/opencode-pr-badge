export interface PullRequest {
  number: number
  url: string
}

export function parsePullRequest(value: unknown): PullRequest | null {
  if (!value || typeof value !== "object") return null
  if (!("number" in value) || !Number.isSafeInteger(value.number) || Number(value.number) <= 0) return null
  if (!("url" in value) || typeof value.url !== "string") return null
  try {
    const url = new URL(value.url)
    if (url.protocol !== "https:" || url.username || url.password) return null
    if (!/^\/[^/]+\/[^/]+\/pull\/\d+$/.test(url.pathname)) return null
    if (!url.pathname.endsWith(`/pull/${value.number}`)) return null
    return { number: Number(value.number), url: url.href }
  } catch {
    return null
  }
}
