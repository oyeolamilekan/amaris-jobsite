import { SearchStageError, serializeFailureDetails } from './failure'

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

export function assertAiGatewayConfigured() {
  try {
    getRequiredEnv('AI_GATEWAY_API_KEY')
  } catch (error) {
    throw new SearchStageError({
      stage: 'runtime-config',
      message:
        'Search is not configured. Set AI_GATEWAY_API_KEY in the runtime environment.',
      underlyingErrorName: error instanceof Error ? error.name : undefined,
      details: serializeFailureDetails({
        variable: 'AI_GATEWAY_API_KEY',
        error: error instanceof Error ? error.message : String(error),
      }),
      cause: error,
    })
  }
}

/**
 * Collects the environment configuration required by the job-search actions.
 *
 * @returns The validated runtime configuration used by search actions.
 */
export function getSearchRuntimeConfig() {
  assertAiGatewayConfigured()

  try {
    return {
      tavilyApiKey: getRequiredEnv('TAVILY_API_KEY'),
    }
  } catch (error) {
    throw new SearchStageError({
      stage: 'runtime-config',
      message:
        'Search is not configured. Set TAVILY_API_KEY in the runtime environment.',
      underlyingErrorName: error instanceof Error ? error.name : undefined,
      details: serializeFailureDetails({
        variable: 'TAVILY_API_KEY',
        error: error instanceof Error ? error.message : String(error),
      }),
      cause: error,
    })
  }
}

// Safe env access that doesn't throw — returns '' when unavailable (module init).
export const getEnv = (name: string) =>
  (globalThis as { process?: { env?: Record<string, string | undefined> } })
    .process?.env?.[name] ?? ''
