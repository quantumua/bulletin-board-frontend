import { describe, expect, it } from 'vitest'

describe('test runner', () => {
  it('runs in a jsdom environment with jest-dom matchers', () => {
    const element = document.createElement('p')
    element.textContent = 'ready'
    document.body.append(element)

    expect(window.navigator.userAgent).toContain('jsdom')
    expect(element).toBeInTheDocument()
    expect(element).toHaveTextContent('ready')
  })
})
