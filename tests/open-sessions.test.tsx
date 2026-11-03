import { expect, test } from 'claude-code/testing'

const PANE = {
  plugin: 'open-sessions',
  component: 'Pane',
  requestId: 'open-sessions',
  props: {
    title: 'Open sessions',
    isFocused: false,
    bodyColumns: 56,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 40 },
    view: {},
  },
} as const

const SESSIONS = [
  {
    sessionId: 'local_idle',
    title: 'Canva PPTX upload error',
    cwd: 'C:\\Users\\me\\projects\\trip-album\\.claude\\worktrees\\canva-02b206',
    isArchived: false,
    isRunning: false,
    lastActivityAt: '2026-11-03T12:08:30.632Z',
    link: 'claude://claude.ai/epitaxy/local_idle',
  },
  {
    sessionId: 'local_busy',
    title: 'Absences and seniority',
    cwd: 'C:\\Users\\me\\timeset-ui\\.claude\\worktrees\\absences-c408a8',
    isArchived: false,
    isRunning: true,
    prNumber: 845,
    prState: 'OPEN',
    lastActivityAt: '2026-11-03T12:15:22.279Z',
    link: 'claude://claude.ai/epitaxy/local_busy',
  },
]

const USAGE = {
  input_tokens: 1,
  output_tokens: 1,
  cache_creation_input_tokens: 0,
  cache_read_input_tokens: 0,
}

for (const surface of ['desktop', 'terminal'] as const) {
  test(`lists sessions with a summary and opens one (${surface})`, async ($, on) => {
    const opened: string[][] = []
    on('clock.now', () => ({ value: Date.parse('2026-11-03T12:20:00.000Z') }))
    on('ui.status', () => ({ value: undefined }))
    on('store.set', () => ({ value: undefined }))
    on('mcp.call', (_, e) => {
      if (e.tool === 'list_sessions') {
        return { value: { content: [{ type: 'text', text: JSON.stringify(SESSIONS) }], isError: false } }
      }
      return { value: { content: [{ type: 'text', text: `[assistant] work on ${String(e.args.session_id)}` }], isError: false } }
    })
    on('model.complete', (_, e) => ({
      value: {
        isAnswered: true,
        text: e.prompt.includes('local_busy') ? 'Adding seniority tests.' : 'Waiting for your reply.',
        usage: USAGE,
      },
    }))
    on('process.run', (_, e) => {
      opened.push([...e.argv])
      return {
        value: { exitCode: 0, stdout: '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false },
      }
    })

    const ui = await $.ui.mount({ ...PANE, surface })
    await ui.press({ key: 'refresh' })

    const missing: string[] = []
    for (const text of [/^● 1 running$/, /^2 open$/, /^Absences and seniority$/, /^Adding seniority tests\.$/, /^Waiting for your reply\.$/, /^ ● RUNNING $/, /^ ○ IDLE $/, /^ timeset-ui $/, /^ trip-album $/, /^ PR #845 open $/, /^working now$/, /^11m ago$/]) {
      if (!(await ui.find({ type: 'Text', text }))) missing.push(String(text))
    }
    expect(missing).toEqual([])

    await ui.press({ key: 'open-local_idle' })
    expect(opened).toEqual([
      ['rundll32.exe', 'url.dll,FileProtocolHandler', 'claude://claude.ai/epitaxy/local_idle'],
    ])
    await ui.unmount()
  })
}

// Three sessions whose four sort orders all differ, so a sort that is ignored
// or swapped for another cannot pass.
//   active  (running first, then latest): y, x, z
//   recent  (latest first):               x, z, y
//   project (a-proj, b-proj, c-proj):     z, y, x
//   name    (Alpha, Bravo, Charlie):      x, y, z
// Alpha's title carries a bell and an escape: the surface refuses a whole tree
// over one control character, so the mod must strip them or draw nothing.
const SORTABLE = [
  { sessionId: 'x', title: 'Al\u0007pha\u001b', cwd: 'C:/w/c-proj', isRunning: false, lastActivityAt: '2026-11-03T12:18:00.000Z' },
  { sessionId: 'y', title: 'Bravo', cwd: 'C:/w/b-proj', isRunning: true, lastActivityAt: '2026-11-03T12:00:00.000Z' },
  { sessionId: 'z', title: 'Charlie', cwd: 'C:/w/a-proj', isRunning: false, lastActivityAt: '2026-11-03T12:10:00.000Z' },
]

test('each sort button reorders the cards and is remembered', async ($, on) => {
  const stored: Record<string, unknown> = {}
  on('clock.now', () => ({ value: Date.parse('2026-11-03T12:20:00.000Z') }))
  on('ui.status', () => ({ value: undefined }))
  on('store.set', (_, e) => {
    stored[e.key] = e.value
    return { value: undefined }
  })
  on('mcp.call', (_, e) => ({
    value: {
      content: [{ type: 'text', text: e.tool === 'list_sessions' ? JSON.stringify(SORTABLE) : '' }],
      isError: false,
    },
  }))
  on('model.complete', () => ({ value: { isAnswered: true, text: 'Busy.', usage: USAGE } }))

  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await ui.press({ key: 'refresh' })
  const order = async () =>
    (await ui.findAll({ type: 'Button' }))
      .map(b => b.key ?? '')
      .filter(key => key.startsWith('open-'))
      .map(key => key.slice('open-'.length))
      .join(',')

  expect(await order()).toBe('y,x,z')
  expect(await ui.find({ type: 'Text', text: /^Alpha$/ })).toBeDefined()
  for (const [mode, expected] of [
    ['recent', 'x,z,y'],
    ['project', 'z,y,x'],
    ['name', 'x,y,z'],
    ['active', 'y,x,z'],
  ] as const) {
    await ui.press({ key: `sort-${mode}` })
    expect(await order()).toBe(expected)
    expect(stored.sort).toBe(mode)
  }
  await ui.unmount()
})

// Four sessions, one per way the live-pass flag can go:
//   lp    idle, hands over a live pass, model says yes  -> flagged, pinned on top
//   talk  idle, mentions live pass, model says no        -> not flagged
//   quiet idle, never mentions one, model says yes       -> not flagged (no mention)
//   run   running, mentions live pass, model says yes    -> not flagged until idle
// lp is the oldest idle row, so only the pin can put it first.
const LIVE_PASS_SESSIONS = [
  { sessionId: 'run', title: 'Run', cwd: 'C:/w/p', isRunning: true, lastActivityAt: '2026-11-03T12:19:00.000Z' },
  { sessionId: 'talk', title: 'Talk', cwd: 'C:/w/p', isRunning: false, lastActivityAt: '2026-11-03T12:15:00.000Z' },
  { sessionId: 'quiet', title: 'Quiet', cwd: 'C:/w/p', isRunning: false, lastActivityAt: '2026-11-03T12:10:00.000Z' },
  { sessionId: 'lp', title: 'Hand-off', cwd: 'C:/w/p', isRunning: false, lastActivityAt: '2026-11-03T12:05:00.000Z' },
]

test('a session waiting for a live pass is flagged, pinned on top and announced', async ($, on) => {
  let sessions = LIVE_PASS_SESSIONS
  let now = Date.parse('2026-11-03T12:20:00.000Z')
  const toasts: string[] = []
  const statuses: string[] = []
  on('clock.now', () => ({ value: now }))
  on('ui.status', (_, e) => {
    statuses.push(e.text ?? '')
    return { value: undefined }
  })
  on('ui.toast', (_, e) => {
    toasts.push(e.text)
    return { value: undefined }
  })
  on('store.set', () => ({ value: undefined }))
  // An earlier version stored a summary with no live-pass verdict for lp; it
  // must be judged again, not trusted as "not waiting". The store is read in
  // session.start, so the session has to start for that to happen.
  on('store.get', (_, e) => ({
    value: e.key === 'summaries'
      ? { lp: { text: 'Old note.', forActivity: '2026-11-03T12:05:00.000Z', at: now } }
      : undefined,
  }))
  on('command.register', () => ({ value: { command: 'sessions' } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('clock.every', () => ({ value: undefined }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('mcp.call', (_, e) => {
    if (e.tool === 'list_sessions') {
      return { value: { content: [{ type: 'text', text: JSON.stringify(sessions) }], isError: false } }
    }
    const id = String(e.args.session_id)
    const said = id === 'quiet' ? 'All tests pass.' : 'Stack is up on :8080, here is the live pass.'
    return { value: { content: [{ type: 'text', text: `[assistant] (${id}) ${said}` }], isError: false } }
  })
  on('model.complete', (_, e) => ({
    value: {
      isAnswered: true,
      text: e.prompt.includes('(talk)') ? 'LIVE PASS: no\nDiscussing the plan.' : 'LIVE PASS: yes\nWaiting for your live pass.',
      usage: USAGE,
    },
  }))

  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await ui.press({ key: 'refresh' })
  const order = async () =>
    (await ui.findAll({ type: 'Button' }))
      .map(b => b.key ?? '')
      .filter(key => key.startsWith('open-'))
      .map(key => key.slice('open-'.length))
      .join(',')

  expect(await order()).toBe('lp,run,talk,quiet')
  expect(await ui.find({ type: 'Text', text: /^Old note\.$/ })).toBeUndefined()
  expect((await ui.findAll({ type: 'Text', text: /^ 🧪 LIVE PASS $/ })).length).toBe(1)
  expect(await ui.find({ type: 'Text', text: /^🧪 1 live pass$/ })).toBeDefined()
  expect(toasts).toEqual(['🧪 "Hand-off" is waiting for your live pass'])
  expect(statuses.at(-1)).toBe('● 1 running · 4 open sessions · 🧪 1 waiting for live pass')

  // run finishes its turn 20 s later: well inside the re-summary gap, but a
  // session that just went idle is judged again at once.
  now += 20_000
  sessions = sessions.map(s =>
    s.sessionId === 'run' ? { ...s, isRunning: false, lastActivityAt: '2026-11-03T12:20:10.000Z' } : s,
  )
  await ui.press({ key: 'refresh' })
  expect(await order()).toBe('run,lp,talk,quiet')
  expect((await ui.findAll({ type: 'Text', text: /^ 🧪 LIVE PASS $/ })).length).toBe(2)
  expect(toasts.at(-1)).toBe('🧪 "Run" is waiting for your live pass')
  await ui.unmount()
})

// Off Windows there is no rundll32: the button falls back to macOS's `open`,
// then Linux's `xdg-open`, and says so when nothing could open the link.
for (const [platform, available, expected, toast] of [
  ['macOS', ['open'], ['rundll32.exe', 'open'], undefined],
  ['Linux', ['xdg-open'], ['rundll32.exe', 'open', 'xdg-open'], undefined],
  ['nowhere', [], ['rundll32.exe', 'open', 'xdg-open'], 'Could not open "Canva PPTX upload error": open it from the sidebar.'],
] as const) {
  test(`the open button finds this platform's opener (${platform})`, async ($, on) => {
    const tried: string[] = []
    const toasts: string[] = []
    on('clock.now', () => ({ value: Date.parse('2026-11-03T12:20:00.000Z') }))
    on('ui.status', () => ({ value: undefined }))
    on('ui.toast', (_, e) => {
      toasts.push(e.text)
      return { value: undefined }
    })
    on('store.set', () => ({ value: undefined }))
    on('mcp.call', (_, e) => ({
      value: {
        content: [{ type: 'text', text: e.tool === 'list_sessions' ? JSON.stringify(SESSIONS) : '' }],
        isError: false,
      },
    }))
    on('model.complete', () => ({ value: { isAnswered: true, text: 'Busy.', usage: USAGE } }))
    on('process.run', (_, e) => {
      const [program = '', ...args] = e.argv
      tried.push(program)
      if (!(available as readonly string[]).includes(program)) throw new Error(`spawn ${program} ENOENT`)
      expect(args.at(-1)).toBe('claude://claude.ai/epitaxy/local_idle')
      return {
        value: { exitCode: 0, stdout: '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false },
      }
    })

    const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
    await ui.press({ key: 'refresh' })
    await ui.press({ key: 'open-local_idle' })
    expect(tried).toEqual([...expected])
    expect(toasts.at(-1)).toBe(toast)
    await ui.unmount()
  })
}
