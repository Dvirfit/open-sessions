# open-sessions

A live side panel for the Claude desktop app's **Code** tab. It lists your other open
Claude Code sessions, says in one sentence where each one stands, flags the ones waiting
for your live pass, and opens any of them with a click.

## Install

At the prompt of a Claude Code session:

```
/plugin install open-sessions --marketplace Dvirfit/open-sessions
```

Answer `y` to add the marketplace, then pick a scope. From a shell instead:

```
claude plugin install open-sessions --marketplace Dvirfit/open-sessions
```

The panel opens by itself when a session starts. If you close it, `/sessions` brings it back.

## What it shows

- **One card per open session**, refreshed every 20 seconds, with:
  - a RUNNING or IDLE badge;
  - the title, in a color kept per project;
  - a project chip, the PR and its state, and how long ago the session was last active.
- **A one-sentence summary** of what the session is doing or waiting for.
- **🧪 LIVE PASS.** A session whose last message hands you a live pass that you haven't
  answered yet:
  - gets a fuchsia badge and border;
  - stays at the top of the list;
  - is counted in the header and the status line;
  - is announced once with a pop-up.
- **Sort.** Running first, Recent, Project or Name. Your choice is remembered.
- **↗ open.** Click a card to switch to that session.

## Worth knowing

- **It needs the desktop app.** It reads your sessions through the app's own session tools.
  In a plain terminal `claude` the panel says it cannot read them.
- **Summaries use your account.** Each summary is one small Haiku call. A busy session is
  summarized again at most every 3 minutes, and only after new activity.
- **Transcripts go to the model.** The last part of each session's transcript is sent with
  that call, as quoted text to describe, never as instructions to follow.
- **How "waiting for a live pass" is decided.** Three things must all hold:
  - the session is idle;
  - its recent transcript mentions a live pass;
  - Haiku judges that the last message hands one to you.
- **Opening a session** hands its `claude://` link to the operating system: `rundll32` on
  Windows, `open` on macOS, `xdg-open` on Linux.
- **Tested on** Claude Code 2.1.309.

## Tests

```
claude plugin test .
```
