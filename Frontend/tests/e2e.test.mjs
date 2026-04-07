import puppeteer from 'puppeteer'

const BASE = 'http://localhost:5173'
let browser, page
const results = []

function log(name, pass, detail = '') {
  results.push({ name, pass, detail })
  console.log(`${pass ? 'PASS' : 'FAIL'}: ${name}${detail ? ' — ' + detail : ''}`)
}

async function setup() {
  browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] })
  page = await browser.newPage()
}

async function teardown() {
  await browser.close()
  const passed = results.filter(r => r.pass).length
  const failed = results.filter(r => !r.pass).length
  console.log(`\n${passed}/${results.length} passed, ${failed} failed`)
  if (failed > 0) process.exit(1)
}

// Test 1: Landing page loads
async function testLanding() {
  await page.goto(BASE, { waitUntil: 'networkidle0', timeout: 15000 })
  const title = await page.title()
  log('Landing page loads', title.length > 0, `title="${title}"`)
}

// Test 2: API proxy works — /api/v1/documents/ returns 401 (not 404/502)
async function testApiProxy() {
  const resp = await page.evaluate(async () => {
    const r = await fetch('/api/v1/documents/')
    return { status: r.status }
  })
  log('API proxy works (documents/ → 401)', resp.status === 401, `status=${resp.status}`)
}

// Test 3: Trailing slash on upload returns 404 (redirect_slashes=False)
async function testTrailingSlash404() {
  const resp = await page.evaluate(async () => {
    const r = await fetch('/api/v1/documents/upload/', { method: 'POST' })
    return { status: r.status }
  })
  log('Trailing slash upload/ → 404', resp.status === 404, `status=${resp.status}`)
}

// Test 4: Correct upload path returns 401 (auth needed, not 404)
async function testUploadRoute() {
  const resp = await page.evaluate(async () => {
    const r = await fetch('/api/v1/documents/upload', { method: 'POST' })
    return { status: r.status }
  })
  log('POST /documents/upload → 401 or 422', [401, 403, 422].includes(resp.status), `status=${resp.status}`)
}

// Test 5: GET single document returns 401 (auth needed)
async function testGetDocRoute() {
  const resp = await page.evaluate(async () => {
    const r = await fetch('/api/v1/documents/test-id')
    return { status: r.status }
  })
  log('GET /documents/test-id → 401', [401, 403].includes(resp.status), `status=${resp.status}`)
}

// Test 6: Protected route redirects to sign-in
async function testProtectedRedirect() {
  await page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle0', timeout: 15000 })
  await new Promise(r => setTimeout(r, 3000))
  const url = page.url()
  const redirected = url.includes('sign-in') || url.includes('clerk')
  log('Dashboard redirects to sign-in', redirected, `url=${url}`)
}

async function main() {
  await setup()
  try {
    await testLanding()
    await testApiProxy()
    await testTrailingSlash404()
    await testUploadRoute()
    await testGetDocRoute()
    await testProtectedRedirect()
  } catch (e) {
    console.error('Test error:', e.message)
  }
  await teardown()
}

main()
