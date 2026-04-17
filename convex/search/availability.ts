import {
  JOB_AVAILABILITY_CHECK_TIMEOUT_MS,
  JOB_AVAILABILITY_RECHECK_INTERVAL_MS,
} from '../shared/constants'

export type JobAvailabilityCheck = {
  status: 'available' | 'unavailable' | 'unknown'
  checkedAt: number
  reason?: string
}

const GENERIC_UNAVAILABLE_PATTERNS = [
  /job (posting|opening|listing|opportunity) (is )?(no longer available|closed|filled|expired|inactive)/i,
  /this (job|role|position|opportunity) (has been|is) (closed|filled|removed|unavailable)/i,
  /no longer accepting applications/i,
  /(job|position|requisition) not found/i,
  /the page you (requested|are looking for) (was not found|cannot be found|does not exist)/i,
  /this requisition is no longer available/i,
  /this job has expired/i,
] as const

const HOST_UNAVAILABLE_PATTERNS = [
  {
    host: 'greenhouse.io',
    patterns: [
      /this job post is no longer available/i,
      /job board posting has expired/i,
    ],
  },
  {
    host: 'lever.co',
    patterns: [/this job posting is no longer available/i],
  },
  {
    host: 'ashbyhq.com',
    patterns: [
      /this opportunity is no longer available/i,
      /this role is closed/i,
    ],
  },
  {
    host: 'myworkdayjobs.com',
    patterns: [
      /the job posting you are looking for is no longer available/i,
      /this job is no longer available/i,
    ],
  },
  {
    host: 'smartrecruiters.com',
    patterns: [/job ad is no longer available/i],
  },
] as const

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, ' ').trim()
}

function decodeCommonEntities(value: string) {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
}

function extractPageTitle(html: string) {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  if (!match?.[1]) return ''

  return normalizeWhitespace(
    decodeCommonEntities(match[1]).replace(/<[^>]+>/g, ' '),
  )
}

function stripHtmlToText(html: string) {
  return normalizeWhitespace(
    decodeCommonEntities(
      html
        .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
        .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, ' ')
        .replace(/<!--[\s\S]*?-->/g, ' ')
        .replace(/<[^>]+>/g, ' '),
    ),
  )
}

function hostnameMatches(hostname: string, expectedHost: string) {
  return hostname === expectedHost || hostname.endsWith(`.${expectedHost}`)
}

function getUnavailablePatternsForHost(hostname: string) {
  return HOST_UNAVAILABLE_PATTERNS.flatMap((entry) =>
    hostnameMatches(hostname, entry.host) ? entry.patterns : [],
  )
}

function parseHostname(url: string) {
  try {
    return new URL(url).hostname.toLowerCase()
  } catch {
    return ''
  }
}

function hasUnavailableMarker(text: string, hostname: string) {
  return [...GENERIC_UNAVAILABLE_PATTERNS, ...getUnavailablePatternsForHost(hostname)]
    .some((pattern) => pattern.test(text))
}

export function shouldRecheckJobPosting(
  availabilityCheckedAt?: number,
  now = Date.now(),
) {
  if (availabilityCheckedAt === undefined) {
    return true
  }

  return now - availabilityCheckedAt >= JOB_AVAILABILITY_RECHECK_INTERVAL_MS
}

/**
 * Fetches a job URL directly and classifies whether the posting still looks
 * live. Only clear removals/closures are treated as unavailable.
 */
export async function checkJobPostingAvailability(
  url: string,
): Promise<JobAvailabilityCheck> {
  const checkedAt = Date.now()

  let response: Response

  try {
    response = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: AbortSignal.timeout(JOB_AVAILABILITY_CHECK_TIMEOUT_MS),
      headers: {
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'User-Agent': 'Mozilla/5.0 (compatible; AmarisBot/1.0; +https://amaris.app)',
      },
    })
  } catch (error) {
    return {
      status: 'unknown',
      checkedAt,
      reason: error instanceof Error ? error.message : String(error),
    }
  }

  if ([404, 410, 451].includes(response.status)) {
    return {
      status: 'unavailable',
      checkedAt,
      reason: `HTTP ${response.status}`,
    }
  }

  if (
    response.status === 401 ||
    response.status === 403 ||
    response.status === 429 ||
    response.status >= 500
  ) {
    return {
      status: 'unknown',
      checkedAt,
      reason: `HTTP ${response.status}`,
    }
  }

  let body: string

  try {
    body = await response.text()
  } catch (error) {
    return {
      status: 'unknown',
      checkedAt,
      reason: error instanceof Error ? error.message : String(error),
    }
  }

  const finalUrl = response.url || url
  const hostname = parseHostname(finalUrl)
  const title = extractPageTitle(body)
  const text = stripHtmlToText(body).slice(0, 50_000)
  const combinedText = normalizeWhitespace(`${title} ${text}`)

  if (hasUnavailableMarker(combinedText, hostname)) {
    return {
      status: 'unavailable',
      checkedAt,
      reason: 'Page content indicates the posting is no longer available.',
    }
  }

  return {
    status: 'available',
    checkedAt,
  }
}

/**
 * Runs direct availability checks for a batch of job URLs in parallel.
 */
export async function checkJobPostingAvailabilityBatch(
  items: readonly { url: string }[],
) {
  return await Promise.all(
    items.map((item) => checkJobPostingAvailability(item.url)),
  )
}
