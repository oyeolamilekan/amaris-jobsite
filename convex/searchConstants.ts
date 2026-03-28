/**
 * Shared model identifier used by the AI Gateway for both job and LinkedIn
 * enrichment flows.
 */
export const JOB_SEARCH_MODEL = 'google/gemini-2.0-flash'

/**
 * Maximum number of structured job results persisted for a single search run.
 */
export const MAX_SAVED_JOB_RESULTS = 10

/**
 * Maximum number of human-readable categories saved on a search run.
 */
export const MAX_CATEGORY_COUNT = 8

/**
 * Maximum number of tags retained per saved job result.
 */
export const MAX_TAG_COUNT = 6

/**
 * Maximum number of LinkedIn people records saved for one job/company lookup.
 */
export const MAX_LINKEDIN_PEOPLE_RESULTS = 6

/**
 * Default number of recent search runs returned by the admin search view.
 */
export const DEFAULT_ADMIN_SEARCH_LIMIT = 25

/**
 * Maximum number of search runs the admin search view can request at once.
 */
export const MAX_ADMIN_SEARCH_LIMIT = 50

/**
 * Progress stages reported during a live search for real-time frontend updates.
 */
export const searchProgressStageValues = [
  'analyzing',
  'searching',
  'saving',
  'completed',
  'failed',
] as const

/**
 * TypeScript type for search progress stages.
 */
export type SearchProgressStage =
  (typeof searchProgressStageValues)[number]

/**
 * Allowed lifecycle states for the top-level job search flow.
 */
export const searchStatusValues = [
  'completed',
  'not_job_search',
  'failed',
] as const

/**
 * Pipeline stages used when persisting saved search failures for debugging.
 */
export const searchFailureStageValues = [
  'runtime-config',
  'prompt-analysis',
  'tavily-search',
  'job-structuring',
  'search-processing',
  'search-persistence',
] as const

/**
 * Allowed lifecycle states for the LinkedIn people lookup flow.
 */
export const linkedinPeopleSearchStatusValues = [
  'completed',
  'no_results',
] as const

/**
 * Supported high-level categories used to bucket saved job results.
 */
export const jobCategoryValues = [
  'engineering',
  'design',
  'product',
  'data',
  'marketing',
  'sales',
  'operations',
  'customer-success',
  'finance',
  'hr',
  'other',
] as const

/**
 * Supported workplace arrangements recognized by the search pipeline.
 */
export const workArrangementValues = [
  'remote',
  'hybrid',
  'on-site',
  'unspecified',
] as const

/**
 * Supported employment types recognized by the search pipeline.
 */
export const employmentTypeValues = [
  'full-time',
  'part-time',
  'contract',
  'internship',
  'temporary',
  'apprenticeship',
  'unspecified',
] as const

/**
 * Tavily search endpoint used for all live web retrieval.
 */
export const TAVILY_SEARCH_URL = 'https://api.tavily.com/search'

/**
 * Hard Tavily query length cap enforced before making a request.
 */
export const MAX_TAVILY_QUERY_LENGTH = 400

/**
 * Default Tavily depth for the main job search flow.
 */
export const DEFAULT_TAVILY_SEARCH_DEPTH = 'advanced' as const

/**
 * Default Tavily result count for the main job search flow.
 */
export const DEFAULT_TAVILY_MAX_RESULTS = 10

/**
 * Default Tavily depth for LinkedIn people lookups.
 */
export const DEFAULT_LINKEDIN_PEOPLE_SEARCH_DEPTH = 'basic' as const

/**
 * Default Tavily result count for LinkedIn people lookups.
 */
export const DEFAULT_LINKEDIN_PEOPLE_MAX_RESULTS = 8

/**
 * Maximum length for the company term in a LinkedIn people search query.
 */
export const LINKEDIN_COMPANY_TERM_MAX_LENGTH = 60

/**
 * Maximum length for the role term in a LinkedIn people search query.
 */
export const LINKEDIN_ROLE_TERM_MAX_LENGTH = 50

/**
 * Default people-oriented terms that bias LinkedIn lookups toward useful
 * contacts.
 */
export const LINKEDIN_PEOPLE_PRIORITY_TERMS = [
  'recruiter',
  'talent acquisition',
  'hiring manager',
] as const

/**
 * Describes one ATS provider family and the hostnames used for both matching
 * and outward-facing search clauses. For multi-tenant providers, `queryHost`
 * can be the shared base domain so one `site:` clause can cover many company
 * subdomains.
 */
export type ApprovedJobHostFamily = {
  provider: string
  queryHost: string
  hosts: readonly string[]
}

/**
 * Canonical ATS host catalog used to constrain live job searches to approved
 * job-host providers.
 */
export const approvedJobHostFamilies = [
  {
    provider: 'greenhouse',
    queryHost: 'boards.greenhouse.io',
    hosts: ['boards.greenhouse.io', 'job-boards.greenhouse.io'],
  },
  {
    provider: 'lever',
    queryHost: 'jobs.lever.co',
    hosts: ['jobs.lever.co'],
  },
  {
    provider: 'smartrecruiters',
    queryHost: 'smartrecruiters.com',
    hosts: ['jobs.smartrecruiters.com', 'careers.smartrecruiters.com'],
  },
  {
    provider: 'workday',
    queryHost: 'myworkdayjobs.com',
    hosts: ['wd1.myworkdayjobs.com', 'myworkdayjobs.com'],
  },
  {
    provider: 'bamboohr',
    queryHost: 'jobs.bamboohr.com',
    hosts: ['jobs.bamboohr.com'],
  },
  {
    provider: 'jobvite',
    queryHost: 'jobvite.com',
    hosts: ['jobs.jobvite.com'],
  },
  {
    provider: 'icims',
    queryHost: 'icims.com',
    hosts: ['careers.icims.com', 'jobs.icims.com'],
  },
  {
    provider: 'jazzhr',
    queryHost: 'apply.jazz.co',
    hosts: ['apply.jazz.co'],
  },
  {
    provider: 'workable',
    queryHost: 'workable.com',
    hosts: ['careers.workable.com', 'apply.workable.com'],
  },
  {
    provider: 'factorialhr',
    queryHost: 'factorialhr.com',
    hosts: ['factorialhr.com'],
  },
  {
    provider: 'jobs.ashbyhq.com',
    queryHost: 'jobs.ashbyhq.com',
    hosts: ['jobs.ashbyhq.com'],
  },
  {
    provider: 'notion',
    queryHost: 'notion.site',
    hosts: ['notion.site'],
  },
] satisfies readonly ApprovedJobHostFamily[]

/**
 * Human-friendly labels for each ATS provider, keyed by the `provider` field
 * in `approvedJobHostFamilies`.
 */
export const providerLabels: Record<string, string> = {
  greenhouse: 'Greenhouse',
  lever: 'Lever',
  smartrecruiters: 'SmartRecruiters',
  workday: 'Workday',
  bamboohr: 'BambooHR',
  jobvite: 'Jobvite',
  icims: 'iCIMS',
  jazzhr: 'JazzHR',
  workable: 'Workable',
  factorialhr: 'Factorial',
  'jobs.ashbyhq.com': 'Ashby',
  notion: 'Notion',
}

/**
 * Flattened list of every approved ATS hostname recognized by the app.
 */
export const approvedJobHosts = Array.from(
  new Set(approvedJobHostFamilies.flatMap((family) => family.hosts)),
)

/**
 * Flattened list of the outward-facing hostnames used in Boolean `site:`
 * clauses for live job search.
 */
export const approvedJobSearchHosts = approvedJobHostFamilies.map(
  (family) => family.queryHost,
)
