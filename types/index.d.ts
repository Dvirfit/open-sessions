// One session as the panel shows it, trimmed from the app's list_sessions row.
export type SessionRow = {
  id: string
  title: string
  project: string
  branch: string | null
  isRunning: boolean
  prNumber: number | null
  prState: string | null
  lastActivityAt: string
  link: string | null
}

export type Feed = {
  rows: SessionRow[]
  fetchedAt: number | null
  error: string | null
}

// A one-sentence summary, tied to the activity stamp it was written for.
export type Summary = {
  text: string
  // The session's last message hands the user a live pass, still unanswered.
  isLivePass: boolean
  forActivity: string
  // Written while the session was working, so its going idle calls for a new one.
  forRunning: boolean
  at: number
}

// How the panel orders its cards.
export type SortMode = 'active' | 'recent' | 'project' | 'name'

declare module 'claude-code' {
  interface PluginState {
    'open-sessions': {
      feed: Shaped<Feed>
      summaries: Shaped<Record<string, Summary>>
      sort: Shaped<SortMode>
      // The live pass counter is pressed: the waiting sessions are left out.
      hideLivePass: Shaped<boolean>
    }
  }
}
