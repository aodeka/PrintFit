import { type Token, type Tokens, lexer } from 'marked'

export type BlockType = 'paragraph' | 'heading' | 'code' | 'blockquote' | 'listitem' | 'hr' | 'space'

export interface Block {
  type: BlockType
  text: string
  headingLevel?: number
  listIndentLevel?: number
}

function extractPlainText(tokens: Token[]): string {
  let result = ''
  for (const token of tokens) {
    if (token.type === 'text' || token.type === 'codespan') {
      result += token.text
    } else if (token.type === 'br') {
      result += '\n'
    } else if ('tokens' in token && Array.isArray(token.tokens)) {
      result += extractPlainText(token.tokens)
    }
  }
  return result
}

function processListItems(items: Tokens.ListItem[], depth: number): Block[] {
  const blocks: Block[] = []
  for (const item of items) {
    for (const tok of item.tokens) {
      if (tok.type === 'text') {
        const text = 'tokens' in tok && Array.isArray(tok.tokens)
          ? extractPlainText(tok.tokens)
          : tok.text
        if (text.trim()) {
          blocks.push({ type: 'listitem', text, listIndentLevel: depth })
        }
      } else if (tok.type === 'paragraph') {
        const text = extractPlainText((tok as Tokens.Paragraph).tokens)
        if (text.trim()) {
          blocks.push({ type: 'listitem', text, listIndentLevel: depth })
        }
      } else if (tok.type === 'list') {
        blocks.push(...processListItems((tok as Tokens.List).items, depth + 1))
      }
    }
  }
  return blocks
}

function processTokens(tokens: Token[]): Block[] {
  const blocks: Block[] = []

  for (const token of tokens) {
    switch (token.type) {
      case 'heading': {
        const t = token as Tokens.Heading
        const text = extractPlainText(t.tokens)
        if (text.trim()) {
          blocks.push({ type: 'heading', text, headingLevel: t.depth })
        }
        break
      }
      case 'paragraph': {
        const t = token as Tokens.Paragraph
        const text = extractPlainText(t.tokens)
        if (text.trim()) {
          blocks.push({ type: 'paragraph', text })
        }
        break
      }
      case 'code': {
        const t = token as Tokens.Code
        if (t.text.trim()) {
          blocks.push({ type: 'code', text: t.text })
        }
        break
      }
      case 'blockquote': {
        const t = token as Tokens.Blockquote
        const inner = processTokens(t.tokens)
        for (const b of inner) {
          blocks.push({ ...b, type: 'blockquote' })
        }
        break
      }
      case 'list': {
        const t = token as Tokens.List
        blocks.push(...processListItems(t.items, 0))
        break
      }
      case 'hr': {
        blocks.push({ type: 'hr', text: '' })
        break
      }
      case 'space': {
        blocks.push({ type: 'space', text: '' })
        break
      }
    }
  }

  return blocks
}

export function extractBlocks(markdown: string): Block[] {
  const tokens = lexer(markdown)
  return processTokens(tokens)
}
