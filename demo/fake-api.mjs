// A stand-in for the Anthropic API so the demo runs offline: one scripted turn
// (read, edit, test, answer). Start with `node demo/fake-api.mjs <port>` and
// point Claude Code at it with ANTHROPIC_BASE_URL.
import { createServer } from 'node:http'

const STEPS = [
  [
    { type: 'text', text: "I'll look at the login check." },
    { type: 'tool_use', name: 'Read', input: { file_path: 'src/login.ts' } },
  ],
  [{ type: 'tool_use', name: 'Edit', input: { file_path: 'src/login.ts', old_string: 'exp < now', new_string: 'exp <= now' } }],
  [{ type: 'tool_use', name: 'Bash', input: { command: 'npm test', description: 'Run the tests' } }],
  [{ type: 'text', text: 'Fixed. The expiry check let a session through on its last second; it now uses `<=`, and all 14 tests pass.' }],
]

// The step is the number of tool results so far; side requests (titles, etc.) carry no tools.
function reply(body) {
  if (!body.tools?.length) return [{ type: 'text', text: 'Fix the login bug' }]
  const done = body.messages.flatMap(m => (Array.isArray(m.content) ? m.content : [])).filter(c => c.type === 'tool_result').length
  return STEPS[Math.min(done, STEPS.length - 1)]
}

let n = 0
function send(res, body) {
  const content = reply(body).map(c => (c.type === 'tool_use' ? { ...c, id: `toolu_${++n}` } : c))
  const stop_reason = content.some(c => c.type === 'tool_use') ? 'tool_use' : 'end_turn'
  const message = { id: `msg_${++n}`, type: 'message', role: 'assistant', model: body.model, content, stop_reason, stop_sequence: null, usage: { input_tokens: 10, output_tokens: 10 } }
  if (!body.stream) return res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(message))
  res.writeHead(200, { 'content-type': 'text/event-stream' })
  const event = (type, data) => res.write(`event: ${type}\ndata: ${JSON.stringify({ type, ...data })}\n\n`)
  event('message_start', { message: { ...message, content: [], stop_reason: null } })
  content.forEach((c, index) => {
    if (c.type === 'text') {
      event('content_block_start', { index, content_block: { type: 'text', text: '' } })
      event('content_block_delta', { index, delta: { type: 'text_delta', text: c.text } })
    } else {
      event('content_block_start', { index, content_block: { ...c, input: {} } })
      event('content_block_delta', { index, delta: { type: 'input_json_delta', partial_json: JSON.stringify(c.input) } })
    }
    event('content_block_stop', { index })
  })
  event('message_delta', { delta: { stop_reason, stop_sequence: null }, usage: { output_tokens: 10 } })
  event('message_stop', {})
  res.end()
}

createServer((req, res) => {
  let raw = ''
  req.on('data', d => (raw += d))
  req.on('end', () => {
    const path = req.url.split('?')[0]
    if (req.method === 'POST' && path === '/v1/messages') return send(res, JSON.parse(raw))
    if (path === '/v1/messages/count_tokens') return res.writeHead(200, { 'content-type': 'application/json' }).end('{"input_tokens":10}')
    res.writeHead(200, { 'content-type': 'application/json' }).end('{}')
  })
}).listen(Number(process.argv[2] ?? 8787), '127.0.0.1')
