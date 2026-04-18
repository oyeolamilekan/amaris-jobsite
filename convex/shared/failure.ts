import { searchFailureStageValues } from './constants'

const MAX_FAILURE_RESPONSE_LENGTH = 8_000
const MAX_FAILURE_DETAILS_LENGTH = 12_000

export type SearchFailureStage = (typeof searchFailureStageValues)[number]

export const NOT_JOB_SEARCH_SUMMARY =
  'This prompt was not classified as a job search. Try asking for roles, companies hiring, locations, or job filters.'

export const FAILED_SEARCH_SUMMARY =
  'This search failed before results could be completed. The request was saved for internal debugging.'

/**
 * Truncates long strings to a bounded length while preserving a readable
 * trailing ellipsis.
 *
 * @param value - The string to shorten.
 * @param maxLength - Maximum length to retain before appending `...`.
 * @returns The original string when short enough, otherwise a truncated copy.
 */
function truncateText(value: string, maxLength: number) {
  if (value.length <= maxLength) {
    return value
  }

  return `${value.slice(0, maxLength).trimEnd()}...`
}

/**
 * Truncates raw response text captured from downstream services so failure
 * traces stay within a safe storage size.
 *
 * @param value - Optional raw response body from a failed request.
 * @returns A bounded response string or `undefined` when no response text was
 * provided.
 */
export function truncateFailureResponse(value: string | undefined) {
  return value ? truncateText(value, MAX_FAILURE_RESPONSE_LENGTH) : undefined
}

/**
 * Serializes arbitrary failure metadata into a bounded string that can be saved
 * on a Convex document.
 *
 * @param value - Unknown failure details such as objects, strings, or nested
 * error metadata.
 * @returns A serialized and truncated string, or `undefined` when there is no
 * detail payload to save.
 */
export function serializeFailureDetails(value: unknown) {
  if (value === undefined || value === null) {
    return undefined
  }

  if (typeof value === 'string') {
    return truncateText(value, MAX_FAILURE_DETAILS_LENGTH)
  }

  try {
    return truncateText(
      JSON.stringify(value, null, 2),
      MAX_FAILURE_DETAILS_LENGTH,
    )
  } catch {
    return truncateText(String(value), MAX_FAILURE_DETAILS_LENGTH)
  }
}

/**
 * Error type used to retain pipeline-stage context and optional downstream
 * response metadata as failures move through the search stack.
 */
export class SearchStageError extends Error {
  readonly stage: SearchFailureStage
  readonly underlyingErrorName?: string
  readonly responseText?: string
  readonly details?: string
  readonly tavilyRequestId?: string

  constructor({
    stage,
    message,
    underlyingErrorName,
    responseText,
    details,
    tavilyRequestId,
    cause,
  }: {
    stage: SearchFailureStage
    message: string
    underlyingErrorName?: string
    responseText?: string
    details?: string
    tavilyRequestId?: string
    cause?: unknown
  }) {
    super(message, cause ? { cause } : undefined)
    this.name = 'SearchStageError'
    this.stage = stage
    this.underlyingErrorName = underlyingErrorName
    this.responseText = truncateFailureResponse(responseText)
    this.details = details
    this.tavilyRequestId = tavilyRequestId
  }
}

/**
 * Strips keys with `undefined` values from a plain object.
 *
 * @param obj - Plain object that may include optional fields.
 * @returns A shallow copy with `undefined` fields removed so it can be safely
 * serialized and persisted.
 */
function stripUndefined<T extends Record<string, unknown>>(obj: T): T {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined),
  ) as T
}

/**
 * Builds a serializable failure trace from any caught error.
 *
 * @param error - The caught error or non-error thrown value.
 * @param fallbackStage - Stage label to use when the error itself does not
 * carry stage information.
 * @param tavilyRequestId - Optional Tavily request id to attach when the
 * underlying error did not already carry one.
 * @returns A plain object safe to persist in `searchRuns.failureTrace`.
 */
export function toFailureTrace(
  error: unknown,
  fallbackStage: SearchFailureStage,
  tavilyRequestId?: string,
) {
  if (error instanceof SearchStageError) {
    return stripUndefined({
      stage: error.stage,
      errorMessage: error.message,
      errorName: error.underlyingErrorName,
      responseText: error.responseText,
      details: error.details,
      tavilyRequestId: error.tavilyRequestId ?? tavilyRequestId,
    })
  }

  if (error instanceof Error) {
    const details =
      error.cause !== undefined
        ? serializeFailureDetails({
            cause:
              error.cause instanceof Error ? error.cause.message : error.cause,
          })
        : undefined

    return stripUndefined({
      stage: fallbackStage,
      errorMessage: error.message,
      errorName: error.name || undefined,
      details,
      tavilyRequestId,
    })
  }

  return stripUndefined({
    stage: fallbackStage,
    errorMessage: 'Unknown search failure.',
    tavilyRequestId,
  })
}
