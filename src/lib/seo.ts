export const SITE_NAME = 'Amaris'
export const SITE_TITLE = `${SITE_NAME} — AI-Powered Job Search`
export const SITE_DESCRIPTION =
  'Describe your ideal role and Amaris searches top job boards in real time with AI-powered matching and ranked results.'
export const SITE_URL = (
  import.meta.env.VITE_SITE_URL || 'https://amaris.app'
).replace(/\/$/, '')
export const HOME_URL = new URL('/', `${SITE_URL}/`).toString()
export const LOGO_PATH = '/favicon.png'
export const LOGO_URL = new URL(LOGO_PATH, `${SITE_URL}/`).toString()
export const OG_IMAGE_PATH = '/app-screenshot.png'
export const OG_IMAGE_URL = new URL(OG_IMAGE_PATH, `${SITE_URL}/`).toString()
export const OG_IMAGE_ALT =
  'Screenshot of the Amaris AI-powered job search homepage.'
export const OG_IMAGE_WIDTH = 3106
export const OG_IMAGE_HEIGHT = 1888
