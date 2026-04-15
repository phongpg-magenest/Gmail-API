import express from 'express'
import authRoutes from './routes/auth'
import gmailRoutes from './routes/gmail'
import { env } from './config'
import { attachSessionUser } from './auth/session'
import './db'

const app = express()

app.use(express.urlencoded({ extended: true }))
app.use(express.json())
app.use(attachSessionUser)

app.use(authRoutes)
app.use(gmailRoutes)

app.listen(env.PORT, () => {
  console.log(`Mail demo running at ${env.APP_BASE_URL}`)
})
