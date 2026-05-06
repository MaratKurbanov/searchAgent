const { chromium } = require('playwright')

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

;(async () => {
  const browser = await chromium.launch({ headless: true })
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } }) // mobile
  const page = await ctx.newPage()

  // Mock the API so we don't hit rate limits
  await page.route('**/chat/completions', async route => {
    const body = route.request().postDataJSON()
    const stream = body?.stream !== false
    if (stream) {
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
        body: [
          'data: {"choices":[{"delta":{"content":"Hello"}}]}',
          'data: {"choices":[{"delta":{"content":"! This is a test response."}}]}',
          'data: [DONE]',
          '',
        ].join('\n'),
      })
    } else {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ choices: [{ message: { content: 'Summary: prior convo.' } }] }),
      })
    }
  })

  let pass = 0
  let fail = 0
  function check(label, cond) {
    if (cond) { console.log('  ✓', label); pass++ }
    else       { console.error('  ✗', label); fail++ }
  }

  await page.goto('http://localhost:5173/')
  await sleep(1000)

  console.log('\n── Mobile (390×844) ───────────────────────────────')

  // Tab bar visible
  const chatTab = page.locator('.tab-button', { hasText: 'Chat' })
  check('Chat tab visible', await chatTab.isVisible())

  const searchTab = page.locator('.tab-button', { hasText: 'Search' })
  check('Search tab visible', await searchTab.isVisible())

  // Chat tab is active by default
  const activeChatTab = page.locator('.tab-button.active', { hasText: 'Chat' })
  check('Chat tab active by default', await activeChatTab.isVisible())

  // cv-root is present
  const cvRoot = page.locator('.cv-root')
  check('ChatView root rendered', await cvRoot.isVisible())

  // Empty state shown
  const emptyMsg = page.locator('.cv-empty')
  check('Empty state shown before new chat', await emptyMsg.isVisible())

  // Hamburger present on mobile
  const hamburger = page.locator('.cv-hamburger')
  check('Hamburger button present', await hamburger.isVisible())

  // Sidebar is not open initially
  const sidebar = page.locator('.cv-sidebar')
  const sidebarClass = await sidebar.getAttribute('class')
  check('Sidebar closed initially', !sidebarClass?.includes('cv-sidebar--open'))

  // Open sidebar via hamburger — but first need a conv to show hamburger in header
  // Start new chat from empty state
  const newChatBtn = page.locator('.cv-empty .cv-new-btn')
  check('New Chat button in empty state', await newChatBtn.isVisible())
  await newChatBtn.click()
  await sleep(200)

  // Textarea should be focused / visible
  const textarea = page.locator('.cv-textarea')
  check('Textarea visible after new chat', await textarea.isVisible())

  // Header shows conversation title
  const headerTitle = page.locator('.cv-header-title')
  check('Header title visible', await headerTitle.isVisible())

  // Type and send a message
  await textarea.fill('What is grace?')
  await textarea.press('Enter')
  await sleep(300)

  // User bubble appears
  const userBubble = page.locator('.cv-bubble--user')
  check('User message bubble rendered', await userBubble.isVisible())

  // AI bubble appears (may show typing dots first)
  const aiBubble = page.locator('.cv-bubble--assistant')
  check('AI message bubble rendered', await aiBubble.isVisible())

  // Wait for streaming to complete
  await sleep(1000)

  const aiText = await aiBubble.textContent()
  check('AI response has content', aiText.includes('Hello'))

  // Conversation title auto-set from first message
  const titleText = await headerTitle.textContent()
  check('Title auto-set from first message', titleText.includes('What is grace'))

  // Sidebar opens via hamburger
  await hamburger.click()
  await sleep(200)
  const sidebarClassAfter = await sidebar.getAttribute('class')
  check('Sidebar opens on hamburger click', sidebarClassAfter?.includes('cv-sidebar--open'))

  // Conversation appears in sidebar
  const convItem = page.locator('.cv-conv-item')
  check('Conversation appears in sidebar', await convItem.count() > 0)

  // New Chat button in sidebar
  const sidebarNewBtn = page.locator('.cv-sidebar-header .cv-new-btn')
  check('New Chat button in sidebar', await sidebarNewBtn.isVisible())

  // Close sidebar via backdrop
  const backdrop = page.locator('.cv-backdrop')
  check('Backdrop visible when sidebar open', await backdrop.isVisible())
  await backdrop.click()
  await sleep(200)
  const sidebarClassClosed = await sidebar.getAttribute('class')
  check('Sidebar closes via backdrop', !sidebarClassClosed?.includes('cv-sidebar--open'))

  console.log('\n── Tab switching ──────────────────────────────────')
  // Switch to Search tab
  await searchTab.click()
  await sleep(200)
  const searchWrapper = page.locator('.search-bar-wrapper')
  check('Search tab content visible', await searchWrapper.isVisible())

  // Switch back to Chat — state preserved
  await chatTab.click()
  await sleep(200)
  const userBubbleAgain = page.locator('.cv-bubble--user')
  check('Chat messages retained after tab switch', await userBubbleAgain.isVisible())

  console.log('\n── Desktop (1280×800) ─────────────────────────────')
  await ctx.setViewportSize(1280, 800)
  await sleep(300)

  const hamburgerDesktop = page.locator('.cv-hamburger')
  check('Hamburger hidden on desktop', !await hamburgerDesktop.isVisible())

  const sidebarDesktop = page.locator('.cv-sidebar')
  check('Sidebar always visible on desktop', await sidebarDesktop.isVisible())

  console.log('\n── Results ────────────────────────────────────────')
  console.log(`  Passed: ${pass}  Failed: ${fail}`)

  await browser.close()
  process.exit(fail > 0 ? 1 : 0)
})()
