import { searchFailureStageValues } from './searchConstants'

const MAX_FAILURE_RESPONSE_LENGTH = 8_000
const MAX_FAILURE_DETAILS_LENGTH = 12_000

export type SearchFailureStage = (typeof searchFailureStageValues)[number]

export const NOT_JOB_SEARCH_SUMMARY =
  'This prompt was not classified as a job search. Try asking for roles, companies hiring, locations, or job filters.'

export const FAILED_SEARCH_SUMMARY =
  'This search failed before results could be completed. The request was saved for internal debugging.'

function truncateText(value: string, maxLength: number) {
  if (value.length <= maxLength) {
    return value
  }

  return `${value.slice(0, maxLength).trimEnd()}...`
}

export function truncateFailureResponse(value: string | undefined) {
  return value ? truncateText(value, MAX_FAILURE_RESPONSE_LENGTH) : undefined
}

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
 */
function stripUndefined<T extends Record<string, unknown>>(obj: T): T {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined),
  ) as T
}

/**
 * Builds a serializable failure trace from any caught error.
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
