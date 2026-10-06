import { expect, test } from 'vitest'

test('test tooling runs in jsdom', () => {
  document.body.innerHTML = '<p>hello</p>'
  expect(document.querySelector('p')).toHaveTextContent('hello')
})
