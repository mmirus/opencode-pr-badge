import { parsePullRequest, type PullRequest } from "./model"

export function createPoller(
  read: (signal: AbortSignal) => Promise<unknown>,
  publish: (pr: PullRequest | null) => void,
) {
  let pending: AbortController | undefined
  let stopped = false
  return {
    async refresh() {
      if (stopped || pending) return
      const controller = new AbortController()
      pending = controller
      try {
        const value = await read(controller.signal)
        if (!stopped) publish(parsePullRequest(value))
      } catch {
        if (!stopped) publish(null)
      } finally {
        pending = undefined
      }
    },
    stop() {
      stopped = true
      pending?.abort()
    },
  }
}
