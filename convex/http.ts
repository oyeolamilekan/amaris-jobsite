import { httpRouter } from 'convex/server'
import { authComponent, createAuth } from './betterAuth/auth'

const http = httpRouter()

authComponent.registerRoutes(http, createAuth, {
  cors: {
    allowedOrigins: ['http://localhost:3000'],
  },
})

export default http
