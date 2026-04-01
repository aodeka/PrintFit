export interface StyleSettings {
  theme: string
  fontFamily: string
  monoFontFamily: string
  marginMm: number
  lineHeightRatio: number
  paragraphSpacing: number
  firstLineIndent: number
}

const THEME_OPTIONS = [
  { label: '经典', value: 'classic' },
  { label: '暖纸', value: 'warm' },
  { label: '学术', value: 'academic' },
  { label: '杂志', value: 'editorial' },
  { label: '锤子便签', value: 'smartisan' },
  { label: '暗夜', value: 'noir' },
  { label: '薄荷', value: 'mint' },
  { label: '水墨', value: 'ink' },
  { label: '科技', value: 'tech' },
  { label: '牛皮纸', value: 'kraft' },
  { label: '精英红', value: 'elite-red' },
]

const FONT_OPTIONS = [
  { label: '思源黑体 (Noto Sans SC)', value: 'Noto Sans SC' },
  { label: '思源宋体 (Noto Serif SC)', value: 'Noto Serif SC' },
  { label: '霞鹜文楷 (LXGW WenKai TC)', value: 'LXGW WenKai TC' },
  { label: '苹方 (PingFang SC)', value: 'PingFang SC' },
  { label: '站酷小薇体 (ZCOOL XiaoWei)', value: 'ZCOOL XiaoWei' },
  { label: 'Inter', value: 'Inter' },
  { label: 'Georgia', value: 'Georgia' },
  { label: 'Helvetica Neue', value: 'Helvetica Neue' },
  { label: 'Times New Roman', value: 'Times New Roman' },
]

const DEFAULTS: StyleSettings = {
  theme: 'classic',
  fontFamily: 'Noto Sans SC',
  monoFontFamily: 'Fira Code',
  marginMm: 20,
  lineHeightRatio: 1.5,
  paragraphSpacing: 0.5,
  firstLineIndent: 0,
}

function el<T extends HTMLElement>(tag: string, attrs?: Record<string, string>, children?: (HTMLElement | string)[]): T {
  const e = document.createElement(tag) as T
  if (attrs) for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v)
  if (children) for (const c of children) {
    if (typeof c === 'string') e.appendChild(document.createTextNode(c))
    else e.appendChild(c)
  }
  return e
}

function makeSelect(id: string, options: { label: string; value: string }[], defaultValue: string, onChange: () => void): HTMLSelectElement {
  const select = el<HTMLSelectElement>('select', { id, class: 'control-select' })
  for (const o of options) {
    const opt = el<HTMLOptionElement>('option', { value: o.value }, [o.label])
    if (o.value === defaultValue) opt.selected = true
    select.appendChild(opt)
  }
  select.addEventListener('change', onChange)
  return select
}

function makeRange(id: string, min: string, max: string, step: string, value: string, label: string, formatVal: (v: string) => string, onChange: () => void): HTMLDivElement {
  const val = el<HTMLSpanElement>('span', { id: `${id}-val`, class: 'control-value' }, [formatVal(value)])
  const range = el<HTMLInputElement>('input', {
    type: 'range', id, class: 'control-range',
    min, max, step, value,
  })
  range.addEventListener('input', () => {
    val.textContent = formatVal(range.value)
    onChange()
  })
  return el('div', { class: 'control-group' }, [
    el('label', { class: 'control-label' }, [
      el('span', { class: 'control-label-text' }, [label + ' ', val]),
      range,
    ]),
  ])
}

export function createControls(container: HTMLElement, onChange: () => void): void {
  while (container.firstChild) container.removeChild(container.firstChild)

  // Theme select
  const themeSelect = makeSelect('ctrl-theme', THEME_OPTIONS, DEFAULTS.theme, onChange)
  const themeGroup = el('div', { class: 'control-group' }, [
    el('label', { class: 'control-label' }, [
      el('span', { class: 'control-label-text' }, ['主题']),
      themeSelect,
    ]),
  ])

  // Font select
  const fontSelect = makeSelect('ctrl-font', FONT_OPTIONS, DEFAULTS.fontFamily, onChange)
  const fontGroup = el('div', { class: 'control-group' }, [
    el('label', { class: 'control-label' }, [
      el('span', { class: 'control-label-text' }, ['字体']),
      fontSelect,
    ]),
  ])

  // Margin range
  const marginGroup = makeRange('ctrl-margin', '10', '30', '1', String(DEFAULTS.marginMm),
    '页边距', v => `${v}mm`, onChange)

  // Line height range
  const lhGroup = makeRange('ctrl-lh', '1.2', '2.0', '0.05', String(DEFAULTS.lineHeightRatio),
    '行高', v => v, onChange)

  // Paragraph spacing range
  const psGroup = makeRange('ctrl-ps', '0', '1.5', '0.1', String(DEFAULTS.paragraphSpacing),
    '段落间距', v => `${v}em`, onChange)

  // First line indent range
  const fiGroup = makeRange('ctrl-fi', '0', '4', '0.5', String(DEFAULTS.firstLineIndent),
    '首行缩进', v => v === '0' ? '无' : `${v}em`, onChange)

  container.append(themeGroup, fontGroup, marginGroup, lhGroup, psGroup, fiGroup)
}

export function getSettings(): StyleSettings {
  const q = (id: string) => document.querySelector(id) as HTMLInputElement | null

  return {
    theme: (q('#ctrl-theme') as HTMLSelectElement | null)?.value ?? DEFAULTS.theme,
    fontFamily: (q('#ctrl-font') as HTMLSelectElement | null)?.value ?? DEFAULTS.fontFamily,
    monoFontFamily: DEFAULTS.monoFontFamily,
    marginMm: Number(q('#ctrl-margin')?.value ?? DEFAULTS.marginMm),
    lineHeightRatio: Number(q('#ctrl-lh')?.value ?? DEFAULTS.lineHeightRatio),
    paragraphSpacing: Number(q('#ctrl-ps')?.value ?? DEFAULTS.paragraphSpacing),
    firstLineIndent: Number(q('#ctrl-fi')?.value ?? DEFAULTS.firstLineIndent),
  }
}
