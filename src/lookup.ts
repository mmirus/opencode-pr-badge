import { execFile } from "node:child_process"
import { parsePullRequest, type PullRequest } from "./model"

export type Run = (command: string, args: string[], signal: AbortSignal) => Promise<string>

export function commandRunner(directory: string): Run {
  return (command, args, signal) =>
    new Promise((resolve, reject) => {
      execFile(
        command,
        args,
        {
          cwd: directory,
          signal,
          timeout: 10_000,
          maxBuffer: 64 * 1024,
          env: { ...process.env, GH_PROMPT_DISABLED: "1", GIT_TERMINAL_PROMPT: "0" },
        },
        (error, stdout) => (error ? reject(error) : resolve(stdout)),
      )
    })
}

export function createLookup(run: Run, now = Date.now) {
  let cached: { branch: string; expires: number; pr: PullRequest | null } | undefined
  return async (signal: AbortSignal): Promise<PullRequest | null> => {
    let branch: string | undefined
    try {
      branch = (await run("git", ["symbolic-ref", "--quiet", "--short", "HEAD"], signal)).trim()
      if (!branch) return null
      if (cached?.branch === branch && cached.expires > now()) return cached.pr
      cached = undefined
      const value: unknown = JSON.parse(
        await run(
          "gh",
          ["pr", "list", "--head", branch, "--state", "open", "--limit", "1", "--json", "number,url,headRefName"],
          signal,
        ),
      )
      const item: unknown = Array.isArray(value) ? value[0] : undefined
      const pr =
        item && typeof item === "object" && "headRefName" in item && item.headRefName === branch
          ? parsePullRequest(item)
          : null
      const current = (await run("git", ["symbolic-ref", "--quiet", "--short", "HEAD"], signal)).trim()
      if (signal.aborted || current !== branch) return null
      cached = { branch, expires: now() + 60_000, pr }
      return pr
    } catch {
      if (!signal.aborted && branch) cached = { branch, expires: now() + 60_000, pr: null }
      return null
    }
  }
}
