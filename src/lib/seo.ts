export const SITE_NAME = 'Amaris'
export const SITE_TITLE = `${SITE_NAME} — Job Search After a Layoff`
export const SITE_DESCRIPTION =
  'Find your next role after a layoff. Amaris searches top job boards in real time, ranks matches, and helps you focus your job hunt.'
export const SITE_KEYWORDS = [
  'job search after layoff',
  'find a job after being laid off',
  'AI job search',
  'laid off job help',
  'new job search',
  'remote job search',
  'job board search',
  'career transition',
]
export const SITE_URL = (
  import.meta.env.VITE_SITE_URL || 'https://amaris.app'
).replace(/\/$/, '')
export const HOME_URL = new URL('/', `${SITE_URL}/`).toString()
export const LOGO_PATH = '/favicon.png'
export const LOGO_URL = new URL(LOGO_PATH, `${SITE_URL}/`).toString()
export const OG_IMAGE_PATH = '/app-screenshot.png'
export const OG_IMAGE_URL = new URL(OG_IMAGE_PATH, `${SITE_URL}/`).toString()
export const OG_IMAGE_ALT =
  'Screenshot of Amaris helping laid-off job seekers find ranked job matches.'
export const OG_IMAGE_WIDTH = 3106
export const OG_IMAGE_HEIGHT = 1888
