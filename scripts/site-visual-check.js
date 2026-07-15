const { app, BrowserWindow } = require('electron')
const fs = require('node:fs/promises')
const path = require('node:path')

app.whenReady().then(async () => {
  const window = new BrowserWindow({ width: 1440, height: 900, show: false, backgroundColor: '#0e0e15' })
  await window.loadFile(path.join(__dirname, '..', 'docs', 'index.html'))
  await new Promise((resolve) => setTimeout(resolve, 800))
  const image = await window.webContents.capturePage()
  const output = path.join(__dirname, '..', 'work', 'site-visual.png')
  await fs.mkdir(path.dirname(output), { recursive: true })
  await fs.writeFile(output, image.toPNG())
  app.quit()
})
