import fs from 'fs'
import { resolve } from 'path'

export default {
  base: '/morphogeneric/',
  plugins: [
    {
      name: 'custom-404-fallback',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          // If the request expects HTML and is not the root path
          if (req.headers.accept?.includes('text/html') && req.url !== '/' && req.url !== '/morphogeneric/') {
            const public404Path = resolve(__dirname, 'public/404.html')
            if (fs.existsSync(public404Path)) {
              const html = fs.readFileSync(public404Path, 'utf8')
              res.statusCode = 404
              res.setHeader('Content-Type', 'text/html')
              res.end(html)
              return
            }
          }
          next()
        })
      }
    }
  ]
}
