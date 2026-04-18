import { approvedJobHostFamilies } from '../shared/constants'

export const approvedProviderSet = new Set(
  approvedJobHostFamilies.map((family) => family.provider),
)

export const MAX_JOB_SUMMARY_LENGTH = 500

export const GENERIC_UNAVAILABLE_PATTERNS = [
  /job (posting|opening|listing|opportunity) (is )?(no longer available|closed|filled|expired|inactive)/i,
  /this (job|role|position|opportunity) (has been|is) (closed|filled|removed|unavailable)/i,
  /no longer accepting applications/i,
  /(job|position|requisition) not found/i,
  /the page you (requested|are looking for) (was not found|cannot be found|does not exist)/i,
  /this requisition is no longer available/i,
  /this job has expired/i,
] as const

export const HOST_UNAVAILABLE_PATTERNS = [
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
