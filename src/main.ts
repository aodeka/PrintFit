import { parse } from 'marked'
import { extractBlocks } from './markdown'
import { findOptimalFontSize, clearMeasureCache } from './measure'
import { createControls, getSettings } from './controls'
import type { StyleSettings } from './controls'
import './style.css'

const SAMPLE_MARKDOWN = `# 张伟

**高级软件工程师** | 上海
zhang.wei@email.com | +86 138-0000-0000

---

## 工作经历

### 技术负责人 — Acme 科技有限公司
*2022 - 至今*

- 带领 8 人工程团队交付实时数据分析平台
- 通过缓存优化和查询重构，将 API 响应时间降低 60%
- 设计并落地微服务架构，日均承载 5000 万+ 请求

### 高级工程师 — 字节流科技
*2019 - 2022*

- 搭建核心推荐引擎，基于协同过滤算法
- 实施 CI/CD 流水线，部署时间从 2 小时缩短至 15 分钟
- 通过 Code Review 和结对编程指导 5 名初级开发者

### 软件工程师 — 创业科技 XYZ
*2017 - 2019*

- 使用 React、Node.js 和 PostgreSQL 进行全栈开发
- 交付 3 个核心产品功能，保持 99.9% 可用率

---

## 技术技能

**编程语言：** TypeScript、Python、Go、Rust
**框架：** React、Next.js、FastAPI、Gin
**基础设施：** AWS、Kubernetes、Docker、Terraform
**数据：** PostgreSQL、Redis、Elasticsearch、Kafka

---

## 教育背景

### 复旦大学 — 计算机科学硕士
*2015 - 2017*

### 同济大学 — 软件工程学士
*2011 - 2015*
`

let debounceTimer: ReturnType<typeof setTimeout> | null = null
let lastLoadedFont = ''
let a4Content: HTMLElement
let a4Page: HTMLElement
let a4Wrapper: HTMLElement
let a4Placeholder: HTMLElement
let statusFontSize: HTMLElement
let statusOverflow: HTMLElement
let textarea: HTMLTextAreaElement

function buildDOM(): void {
  const app = document.getElementById('app')!
  app.className = 'app'

  // Top bar
  const topbar = document.createElement('div')
  topbar.className = 'topbar'

  const title = document.createElement('div')
  title.className = 'topbar-title'
  title.textContent = '一页印 PrintFit'

  const statusArea = document.createElement('div')
  statusArea.className = 'topbar-status'

  statusFontSize = document.createElement('span')
  statusFontSize.className = 'status-fontsize'
  statusFontSize.textContent = '—'

  statusOverflow = document.createElement('span')
  statusOverflow.className = 'status-overflow'
  statusOverflow.textContent = '内容溢出'

  const printBtn = document.createElement('button')
  printBtn.className = 'btn-print'
  printBtn.textContent = '打印 ⌘P'
  printBtn.addEventListener('click', () => window.print())

  statusArea.append(statusFontSize, statusOverflow, printBtn)
  topbar.append(title, statusArea)

  // Left panel
  const leftPanel = document.createElement('div')
  leftPanel.className = 'left-panel'

  const textareaWrapper = document.createElement('div')
  textareaWrapper.className = 'textarea-wrapper'

  const textareaHeader = document.createElement('div')
  textareaHeader.className = 'textarea-header'
  textareaHeader.textContent = '粘贴 / 编辑 Markdown'

  textarea = document.createElement('textarea')
  textarea.className = 'input-textarea'
  textarea.placeholder = '在此粘贴 Markdown 内容...\n\n支持粘贴后编辑修改\n\n# 标题\n\n正文内容...\n\n- 列表项'
  textarea.spellcheck = false

  textareaWrapper.append(textareaHeader, textarea)

  const controlsSection = document.createElement('div')
  controlsSection.className = 'controls-section'

  const controlsHeader = document.createElement('div')
  controlsHeader.className = 'controls-header'
  controlsHeader.textContent = '样式设置'

  const controlsBody = document.createElement('div')
  createControls(controlsBody, () => {
    clearMeasureCache()
    scheduleUpdate()
  })

  controlsSection.append(controlsHeader, controlsBody)
  leftPanel.append(textareaWrapper, controlsSection)

  // Right panel
  const rightPanel = document.createElement('div')
  rightPanel.className = 'right-panel'

  a4Page = document.createElement('div')
  a4Page.className = 'a4-page'

  a4Placeholder = document.createElement('div')
  a4Placeholder.className = 'a4-placeholder'
  a4Placeholder.textContent = '在左侧粘贴内容以预览'

  a4Content = document.createElement('div')
  a4Content.className = 'a4-content'

  a4Page.append(a4Placeholder, a4Content)

  a4Wrapper = document.createElement('div')
  a4Wrapper.className = 'a4-wrapper'
  a4Wrapper.appendChild(a4Page)
  rightPanel.appendChild(a4Wrapper)

  app.append(topbar, leftPanel, rightPanel)

  // Events: textarea supports both paste and live editing
  textarea.addEventListener('input', scheduleUpdate)

  // Auto-scale A4 page to fit the right panel
  const resizeObserver = new ResizeObserver(() => updateA4Scale())
  resizeObserver.observe(rightPanel)
}

function updateA4Scale(): void {
  const rightPanel = a4Wrapper.parentElement
  if (!rightPanel) return

  const padding = 32
  const availW = rightPanel.clientWidth - padding * 2
  const availH = rightPanel.clientHeight - padding * 2

  // A4 at 96 DPI: 210mm = 794px, 297mm = 1123px
  const pageW = 794
  const pageH = 1123

  const scale = Math.min(availW / pageW, availH / pageH, 1)

  a4Page.style.transform = `scale(${scale})`
  a4Page.style.transformOrigin = 'top left'
  a4Wrapper.style.width = `${pageW * scale}px`
  a4Wrapper.style.height = `${pageH * scale}px`
}

function scheduleUpdate(): void {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(update, 150)
}

async function update(): Promise<void> {
  const markdown = textarea.value
  const settings = getSettings()

  if (!markdown.trim()) {
    a4Content.textContent = ''
    a4Placeholder.style.display = ''
    statusFontSize.textContent = '—'
    statusOverflow.classList.remove('visible')
    return
  }

  a4Placeholder.style.display = 'none'

  // Only load font when it changes
  if (lastLoadedFont !== settings.fontFamily) {
    await Promise.all([
      document.fonts.load(`16px "${settings.fontFamily}"`),
      document.fonts.load(`700 16px "${settings.fontFamily}"`),
    ])
    lastLoadedFont = settings.fontFamily
  }

  // Extract blocks and find optimal font size via Pretext
  const blocks = extractBlocks(markdown)
  const { fontSize, overflow } = findOptimalFontSize(blocks, settings)

  // Update status bar
  statusFontSize.textContent = `${fontSize.toFixed(1)}px`
  statusOverflow.classList.toggle('visible', overflow)

  // Render Markdown to HTML and apply to A4 page
  const html = await parse(markdown)
  let currentFontSize = fontSize
  applyStyles(settings, currentFontSize)

  // Use DOMParser to safely set content
  const doc = new DOMParser().parseFromString(html, 'text/html')
  a4Content.replaceChildren(...Array.from(doc.body.childNodes).map(n => n.cloneNode(true)))

  // DOM fallback: if content overflows, binary search for fitting font size (~5 reflows instead of ~20)
  const pageStyle = getComputedStyle(a4Page)
  const availableHeight = a4Page.clientHeight - parseFloat(pageStyle.paddingTop) - parseFloat(pageStyle.paddingBottom)

  if (a4Content.scrollHeight > availableHeight && currentFontSize > 6) {
    let lo = 6
    let hi = currentFontSize
    while (hi - lo > 0.25) {
      const mid = (lo + hi) / 2
      applyStyles(settings, mid)
      if (a4Content.scrollHeight <= availableHeight) {
        lo = mid
      } else {
        hi = mid
      }
    }
    currentFontSize = Math.floor(lo * 4) / 4
    applyStyles(settings, currentFontSize)
    statusFontSize.textContent = `${currentFontSize.toFixed(1)}px`
    statusOverflow.classList.toggle('visible', currentFontSize <= 6.25 && a4Content.scrollHeight > availableHeight)
  }
}

const THEME_CLASSES = ['theme-classic', 'theme-warm', 'theme-academic', 'theme-editorial']

function applyStyles(settings: StyleSettings, fontSize: number): void {
  // Theme class
  a4Page.classList.remove(...THEME_CLASSES)
  a4Page.classList.add(`theme-${settings.theme}`)

  a4Page.style.padding = `${settings.marginMm}mm`
  a4Page.style.fontFamily = `"${settings.fontFamily}", -apple-system, sans-serif`
  a4Page.style.fontSize = `${fontSize}px`
  a4Page.style.lineHeight = String(settings.lineHeightRatio)
  a4Page.style.setProperty('--ps', `${settings.paragraphSpacing}em`)
  a4Page.style.setProperty('--fi', `${settings.firstLineIndent}em`)
}

// Init
document.addEventListener('DOMContentLoaded', () => {
  buildDOM()
  // Pre-fill with sample resume for demo
  textarea.value = SAMPLE_MARKDOWN
  scheduleUpdate()
})
