import { parse } from 'marked'
import { extractBlocks } from './markdown'
import { findOptimalFontSize, clearMeasureCache } from './measure'
import { createControls, getSettings } from './controls'
import { SAMPLES } from './samples'
import type { StyleSettings } from './controls'
import './style.css'

let debounceTimer: ReturnType<typeof setTimeout> | null = null
let lastLoadedFont = ''
let a4Content: HTMLElement
let a4Page: HTMLElement
let a4Wrapper: HTMLElement
let a4Placeholder: HTMLElement
let statusFontSize: HTMLElement
let statusOverflow: HTMLElement
let statusZoom: HTMLElement
let textarea: HTMLTextAreaElement
let fitScale = 1
let userZoom = 1

// Avatar functionality
let avatarElement: HTMLImageElement | null = null
let avatarScaleHandle: HTMLElement | null = null

function buildDOM(): void {
  const app = document.getElementById('app')!
  app.className = 'app'

  // Top bar
  const topbar = document.createElement('div')
  topbar.className = 'topbar'

  const title = document.createElement('div')
  title.className = 'topbar-title'
  title.textContent = '文印v1'

  const statusArea = document.createElement('div')
  statusArea.className = 'topbar-status'

  statusFontSize = document.createElement('span')
  statusFontSize.className = 'status-fontsize'
  statusFontSize.textContent = '—'

  statusOverflow = document.createElement('span')
  statusOverflow.className = 'status-overflow'
  statusOverflow.textContent = '内容溢出'

  statusZoom = document.createElement('span')
  statusZoom.className = 'status-zoom'
  statusZoom.textContent = '100%'
  statusZoom.title = '⌘+滚轮缩放，双击重置'

  const printBtn = document.createElement('button')
  printBtn.className = 'btn-print'
  printBtn.textContent = '打印 ⌘P'
  printBtn.addEventListener('click', () => window.print())

  statusArea.append(statusFontSize, statusZoom, statusOverflow, printBtn)
  topbar.append(title, statusArea)

  // Left panel
  const leftPanel = document.createElement('div')
  leftPanel.className = 'left-panel'

  const textareaWrapper = document.createElement('div')
  textareaWrapper.className = 'textarea-wrapper'

  const textareaHeader = document.createElement('div')
  textareaHeader.className = 'textarea-header'

  const headerLabel = document.createElement('span')
  headerLabel.textContent = '粘贴 / 编辑 Markdown'

  const sampleSelect = document.createElement('select')
  sampleSelect.className = 'sample-select'
  const emptyOpt = document.createElement('option')
  emptyOpt.value = ''
  emptyOpt.textContent = '加载示例…'
  sampleSelect.appendChild(emptyOpt)
  for (const s of SAMPLES) {
    const opt = document.createElement('option')
    opt.value = s.value
    opt.textContent = s.label
    sampleSelect.appendChild(opt)
  }
  sampleSelect.value = SAMPLES[0].value
  sampleSelect.addEventListener('change', () => {
    const sample = SAMPLES.find(s => s.value === sampleSelect.value)
    if (sample) {
      textarea.value = sample.content
      scheduleUpdate()
    }
  })

  textareaHeader.append(headerLabel, sampleSelect)

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

  // Avatar upload section
  const avatarSection = document.createElement('div')
  avatarSection.className = 'controls-section'

  const avatarHeader = document.createElement('div')
  avatarHeader.className = 'controls-header'
  avatarHeader.textContent = '头像设置'

  const avatarBody = document.createElement('div')
  avatarBody.className = 'avatar-upload'

  const avatarInput = document.createElement('input')
  avatarInput.type = 'file'
  avatarInput.accept = 'image/*'
  avatarInput.style.display = 'none'

  const avatarButton = document.createElement('button')
  avatarButton.className = 'avatar-button'
  avatarButton.textContent = '上传头像'

  const avatarClearButton = document.createElement('button')
  avatarClearButton.className = 'avatar-clear'
  avatarClearButton.textContent = '清除头像'
  avatarClearButton.style.display = 'none'

  avatarButton.addEventListener('click', () => avatarInput.click())

  avatarInput.addEventListener('change', (e) => {
    const file = (e.target as HTMLInputElement).files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (event) => {
        setAvatar(event.target?.result as string)
        avatarClearButton.style.display = 'inline-block'
      }
      reader.readAsDataURL(file)
    }
  })

  avatarClearButton.addEventListener('click', () => {
    clearAvatar()
    avatarClearButton.style.display = 'none'
    avatarInput.value = ''
  })

  avatarBody.append(avatarButton, avatarClearButton)
  avatarSection.append(avatarHeader, avatarBody)
  leftPanel.append(avatarSection)

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

  // Cmd + scroll wheel to zoom preview
  rightPanel.addEventListener('wheel', (e) => {
    if (!e.metaKey) return
    e.preventDefault()
    const factor = e.deltaY > 0 ? 0.95 : 1.05
    userZoom = Math.max(0.3, Math.min(3, userZoom * factor))
    applyScale()
    updateZoomStatus()
  }, { passive: false })

  // Mouse drag to pan preview
  let isDragging = false
  let dragStartX = 0
  let dragStartY = 0
  let scrollStartX = 0
  let scrollStartY = 0

  rightPanel.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return
    isDragging = true
    dragStartX = e.clientX
    dragStartY = e.clientY
    scrollStartX = rightPanel.scrollLeft
    scrollStartY = rightPanel.scrollTop
    rightPanel.classList.add('dragging')
    e.preventDefault()
  })

  window.addEventListener('mousemove', (e) => {
    if (!isDragging) return
    rightPanel.scrollLeft = scrollStartX - (e.clientX - dragStartX)
    rightPanel.scrollTop = scrollStartY - (e.clientY - dragStartY)
  })

  window.addEventListener('mouseup', () => {
    if (!isDragging) return
    isDragging = false
    rightPanel.classList.remove('dragging')
  })

  // Double-click to reset zoom
  rightPanel.addEventListener('dblclick', () => {
    userZoom = 1
    applyScale()
    updateZoomStatus()
  })
}

const PAGE_W = 794
const PAGE_H = 1123

function updateA4Scale(): void {
  const rightPanel = a4Wrapper.parentElement
  if (!rightPanel) return

  const padding = 32
  const availW = rightPanel.clientWidth - padding * 2
  const availH = rightPanel.clientHeight - padding * 2

  fitScale = Math.min(availW / PAGE_W, availH / PAGE_H)
  applyScale()
}

function applyScale(): void {
  const scale = fitScale * userZoom
  a4Page.style.transform = `scale(${scale})`
  a4Page.style.transformOrigin = 'top left'
  a4Wrapper.style.width = `${PAGE_W * scale}px`
  a4Wrapper.style.height = `${PAGE_H * scale}px`
}

function updateZoomStatus(): void {
  const pct = Math.round(userZoom * 100)
  statusZoom.textContent = `${pct}%`
  statusZoom.classList.toggle('zoom-modified', userZoom !== 1)
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

const THEME_CLASSES = [
  'theme-classic', 'theme-warm', 'theme-academic', 'theme-editorial',
  'theme-smartisan', 'theme-noir', 'theme-mint', 'theme-ink', 'theme-tech', 'theme-kraft',
]

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

// Avatar functions
function setAvatar(src: string): void {
  if (avatarElement) {
    avatarElement.src = src
    return
  }

  // Create avatar wrapper
  const avatarWrapper = document.createElement('div')
  avatarWrapper.className = 'avatar-wrapper'
  avatarWrapper.style.left = '20px'
  avatarWrapper.style.top = '20px'

  // Create avatar image
  avatarElement = document.createElement('img')
  avatarElement.className = 'avatar-image'
  avatarElement.src = src
  avatarElement.draggable = false

  // Create scale handle
  avatarScaleHandle = document.createElement('div')
  avatarScaleHandle.className = 'avatar-scale-handle'

  avatarWrapper.append(avatarElement, avatarScaleHandle)
  a4Page.appendChild(avatarWrapper)

  // Setup drag functionality
  setupAvatarDrag(avatarWrapper, avatarElement)
  // Setup scale functionality
  setupAvatarScale(avatarWrapper, avatarScaleHandle)
}

function clearAvatar(): void {
  if (avatarElement) {
    const wrapper = avatarElement.parentElement
    wrapper?.remove()
    avatarElement = null
    avatarScaleHandle = null
  }
}

function setupAvatarDrag(wrapper: HTMLElement, img: HTMLImageElement): void {
  let isDragging = false
  let startX = 0
  let startY = 0
  let startLeft = 0
  let startTop = 0

  img.addEventListener('mousedown', (e) => {
    isDragging = true
    startX = e.clientX
    startY = e.clientY
    startLeft = parseInt(wrapper.style.left) || 0
    startTop = parseInt(wrapper.style.top) || 0
    e.stopPropagation()
    e.preventDefault()
  })

  window.addEventListener('mousemove', (e) => {
    if (!isDragging) return
    
    const dx = e.clientX - startX
    const dy = e.clientY - startY
    
    // Convert screen pixels to A4 pixels (accounting for scale)
    const scale = fitScale * userZoom
    const a4Dx = dx / scale
    const a4Dy = dy / scale
    
    let newLeft = startLeft + a4Dx
    let newTop = startTop + a4Dy
    
    // Constrain to A4 page
    const pageWidth = a4Page.clientWidth
    const pageHeight = a4Page.clientHeight
    const imgWidth = img.offsetWidth
    const imgHeight = img.offsetHeight
    
    newLeft = Math.max(0, Math.min(newLeft, pageWidth - imgWidth))
    newTop = Math.max(0, Math.min(newTop, pageHeight - imgHeight))
    
    wrapper.style.left = `${newLeft}px`
    wrapper.style.top = `${newTop}px`
  })

  window.addEventListener('mouseup', () => {
    isDragging = false
  })
}

function setupAvatarScale(wrapper: HTMLElement, handle: HTMLElement): void {
  let isScaling = false
  let startX = 0
  let startY = 0
  let startWidth = 0
  let startHeight = 0

  handle.addEventListener('mousedown', (e) => {
    isScaling = true
    startX = e.clientX
    startY = e.clientY
    startWidth = wrapper.offsetWidth
    startHeight = wrapper.offsetHeight
    e.stopPropagation()
    e.preventDefault()
  })

  window.addEventListener('mousemove', (e) => {
    if (!isScaling || !avatarElement) return
    
    const dx = e.clientX - startX
    const dy = e.clientY - startY
    
    // Convert screen pixels to A4 pixels
    const scale = fitScale * userZoom
    const a4Dx = dx / scale
    const a4Dy = dy / scale
    
    let newWidth = startWidth + a4Dx
    let newHeight = startHeight + a4Dy
    
    // Shift key for aspect ratio
    if (e.shiftKey) {
      const ratio = startWidth / startHeight
      newHeight = newWidth / ratio
    }
    
    // Minimum size
    const minSize = 30
    newWidth = Math.max(minSize, newWidth)
    newHeight = Math.max(minSize, newHeight)
    
    avatarElement.style.width = `${newWidth}px`
    avatarElement.style.height = `${newHeight}px`
  })

  window.addEventListener('mouseup', () => {
    isScaling = false
  })
}

// Init
document.addEventListener('DOMContentLoaded', () => {
  buildDOM()
  // Pre-fill with default sample (resume)
  textarea.value = SAMPLES[0].content
  scheduleUpdate()
})