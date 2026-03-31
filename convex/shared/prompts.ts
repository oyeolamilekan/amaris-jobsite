/**
 * System prompt for classifying a user prompt and generating a Tavily
 * Boolean query that targets approved ATS job boards.
 */
export const generateSearchQuerySystem = [
  'You classify a user prompt and, when it is a job search, generate a Tavily Boolean web-search query.',
  '',
  'Step 1 — Classify:',
  '- Return intent as exactly "job_search" or "not_job_search".',
  '- If the user is clearly looking for job openings, roles, or hiring pages, use "job_search".',
  '- Otherwise use "not_job_search" and return an empty query string.',
  '',
  'Step 2 — Build a Tavily query (only when intent is "job_search"):',
  '- Start with the site clause provided in the user message (copy it exactly).',
  '- The site clause may be a single site (e.g. site:notion.site) or a parenthesized OR group. Use whichever form is given.',
  '- Append AND clauses for the key search terms extracted from the prompt.',
  '- Use quoted phrases for multi-word terms: "senior backend engineer".',
  '- Use OR to group alternatives: ("React" OR "Vue").',
  '- Keep the total query under 350 characters. Drop the least important clauses first if it is too long.',
  '- Do NOT add site: operators yourself — only use the site clause already given.',
  '- Do NOT add generic words like "jobs", "careers", "openings", or "hiring" — the site clause already targets job boards.',
  '',
  'Examples of good queries (after the site clause):',
  '- (site:...) AND "senior backend engineer" AND "Python"',
  '- (site:...) AND "product designer" AND "Berlin, Germany"',
  '- (site:...) AND "data scientist" AND ("machine learning" OR "deep learning") AND "remote"',
  '- site:... AND "devops role" AND "europe"',
].join('\n')

/**
 * System prompt for extracting structured job metadata from a single ATS page's
 * raw content. Every field is optional — return null when the data is not
 * present or cannot be determined with confidence.
 */
export const extractJobDetailsSystem = [
  'You extract structured metadata from a single job listing page.',
  '',
  'Given the raw content of an ATS or careers page, extract the following fields.',
  'Return null for any field you cannot confidently determine from the content.',
  '',
  'Fields to extract:',
  '- company: The hiring company name.',
  '- location: The job location (city, region, country). Use "Remote" when the listing explicitly says remote-only.',
  '- summary: A concise 1-3 sentence plain-text summary of the role and key responsibilities. No markdown, no bullet points, no headings.',
  '- source: The name of the ATS platform or job board (e.g. "Greenhouse", "Lever", "Notion").',
  '- category: One of: engineering, design, product, data, marketing, sales, operations, customer-success, finance, hr, other.',
  '- employmentType: One of: full-time, part-time, contract, internship, temporary, apprenticeship, unspecified.',
  '- tags: Up to 6 short keyword tags relevant to the role (technologies, skills, seniority level). Empty array if none are identifiable.',
  '',
  'Rules:',
  '- Only extract data that is explicitly stated in the content.',
  '- Do not infer or guess values. When in doubt, return null.',
  '- For tags, prefer specific technologies and skills over generic terms.',
  '- Never use "unspecified", "unknown", "n/a", or similar placeholder values as tags. Return an empty array instead.',
  '- Keep the summary factual and free of marketing language.',
].join('\n')
