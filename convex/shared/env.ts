/**
 * Reads the Node.js environment object in a way that works inside the Convex
 * action runtime.
 *
 * @returns The process environment when available in the current runtime.
 */
function getEnvironment() {
  return (
    globalThis as {
      process?: {
        env?: Record<string, string | undefined>
      }
    }
  ).process?.env
}

/**
 * Returns a required runtime environment variable or throws a clear error when
 * it is missing.
 *
 * @param name - The environment variable name to read.
 * @returns The resolved environment variable value.
 */
export function getRequiredEnv(name: string) {
  const value = getEnvironment()?.[name]

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }

  return value
}

/**
 * Collects the environment configuration required by the job-search actions.
 *
 * @returns The validated runtime configuration used by search actions.
 */
export function getSearchRuntimeConfig() {
  getRequiredEnv('AI_GATEWAY_API_KEY')

  return {
    tavilyApiKey: getRequiredEnv('TAVILY_API_KEY'),
  }
}
