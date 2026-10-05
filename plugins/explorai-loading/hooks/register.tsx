import type { Register } from 'claude-code'

import { LOGO } from './logo'
import { SPRITE } from './sprite'

const FRAME_MS = 80
// Without a task list: seconds for the fill to reach ~63%, creeping toward 100% until the turn ends
const FILL_SECONDS = 20
const DEFAULT = 0x01000000
const UNFILLED = 0x3a3a3a
const PALETTE = [0xacf127, 0x2ddcf9, 0xf127ac]
const TOP_HALF = 0x2580

// Frames per dance beat (~240 ms)
const BEAT_FRAMES = 3
// Pixels of room the sprite bounces up and sways sideways in
const BOUNCE = 2
const SWAY = 2
const GAP = 3

const logoWidth = LOGO[0]?.length ?? 0
const spriteSize = SPRITE.length
const spriteLeft = logoWidth + GAP
const height = spriteSize + BOUNCE
// The logo sits vertically centered beside the sprite
const logoTop = Math.floor((height - LOGO.length) / 2)
const width = spriteLeft + spriteSize + SWAY
const rows = Math.ceil(height / 2)

const mix = (a: number, b: number, t: number) => {
  const ch = (shift: number) =>
    Math.round(((a >> shift) & 0xff) * (1 - t) + ((b >> shift) & 0xff) * t)

  return (ch(16) << 16) | (ch(8) << 8) | ch(0)
}

// Brand colors flowing along x, shifted every frame
const flow = (x: number, frame: number) => {
  const pos = (((x + frame * 1.5) / 14) % PALETTE.length + PALETTE.length) % PALETTE.length
  const i = Math.floor(pos)

  return mix(PALETTE[i] ?? 0, PALETTE[(i + 1) % PALETTE.length] ?? 0, pos - i)
}

export const pixel = (x: number, y: number, fill: number, frame: number) => {
  const mark = LOGO[y]?.[x]

  if (mark === undefined || mark === '.') {
    return null
  }

  return x / logoWidth <= fill ? flow(x, frame) : UNFILLED
}

// Where the dancer stands on this frame: hops, sways, and turns around every four beats
export const dancePose = (frame: number) => {
  const beat = Math.floor(frame / BEAT_FRAMES)
  const swing = [0, 1, 2, 1] as const

  return {
    top: BOUNCE - (swing[beat % 4] ?? 0),
    left: swing[(beat + 1) % 4] ?? 0,
    isMirrored: Math.floor(beat / 4) % 2 === 1,
  }
}

export const spritePixel = (x: number, y: number, frame: number) => {
  const pose = dancePose(frame)
  const sx = x - pose.left
  const sy = y - pose.top

  if (sx < 0 || sx >= spriteSize || sy < 0 || sy >= spriteSize) {
    return null
  }

  const column = pose.isMirrored ? spriteSize - 1 - sx : sx
  const hex = SPRITE[sy]?.slice(column * 6, column * 6 + 6) ?? '......'

  return hex === '......' ? null : parseInt(hex, 16)
}

// Composes the logo and the dancer into one picture, in band pixels
const bandPixel = (x: number, y: number, fill: number, frame: number) =>
  x < spriteLeft ? pixel(x, y - logoTop, fill, frame) : spritePixel(x - spriteLeft, y, frame)

export const frameCells = (fill: number, frame: number) => {
  const words = new Uint32Array(width * rows * 3)

  for (let row = 0; row < rows; row++) {
    for (let x = 0; x < width; x++) {
      const top = bandPixel(x, row * 2, fill, frame)
      const bottom = bandPixel(x, row * 2 + 1, fill, frame)
      const i = (row * width + x) * 3
      const isEmpty = top === null && bottom === null

      words[i] = isEmpty ? 0x20 : TOP_HALF
      words[i + 1] = top ?? DEFAULT
      words[i + 2] = bottom ?? DEFAULT
    }
  }

  // The runtime has Uint8Array.prototype.toBase64; TypeScript's lib doesn't declare it yet
  return (new Uint8Array(words.buffer) as Uint8Array & { toBase64: () => string }).toBase64()
}

type Status = 'pending' | 'in_progress' | 'completed'

// Share of Claude's task list that is completed, or null when there is no list
export const taskProgress = (statuses: Iterable<Status>) => {
  let total = 0
  let done = 0

  for (const status of statuses) {
    total += 1
    done += status === 'completed' ? 1 : 0
  }

  return total === 0 ? null : { done, total }
}

export const register: Register = on => {
  let startedAt = 0
  let frame = 0
  let shown = 0
  let ticker: { cancel: () => void } | null = null
  // Claude's task list this session, by task id (TaskCreate/TaskUpdate) or index (TodoWrite)
  const tasks = new Map<string, Status>()

  const stop = () => {
    ticker?.cancel()
    ticker = null
  }

  on('prompt.submit', async ($, e, next) => {
    stop()
    startedAt = await $.clock.now()
    frame = 0
    shown = 0
    // A finished list belongs to the last task; an open one carries over to this prompt
    if ([...tasks.values()].every(status => status === 'completed')) {
      tasks.clear()
    }
    ticker = $.clock.every(FRAME_MS, () => {
      frame += 1
      $.ui.invalidate('ui.render')
    })

    return next(e)
  })

  on('tool.call', { tool: 'TaskCreate' }, async ($, e, next) => {
    const ran = await next(e)

    if (ran.deny === undefined && ran.isError !== true) {
      tasks.set(ran.result.task.id, 'pending')
    }

    return ran
  })

  on('tool.call', { tool: 'TaskUpdate' }, async ($, e, next) => {
    const ran = await next(e)

    if (ran.deny === undefined && ran.isError !== true && e.status !== undefined) {
      if (e.status === 'deleted') {
        tasks.delete(e.taskId)
      } else {
        tasks.set(e.taskId, e.status)
      }
    }

    return ran
  })

  on('tool.call', { tool: 'TodoWrite' }, async ($, e, next) => {
    const ran = await next(e)

    if (ran.deny === undefined && ran.isError !== true) {
      tasks.clear()
      e.todos.forEach((todo, i) => tasks.set(`todo:${i}`, todo.status))
    }

    return ran
  })

  on('turn.complete', ($, e, next) => {
    stop()
    $.ui.invalidate('ui.render')

    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.surface !== 'terminal' || e.props.hasSurvey) {
      return next(e)
    }

    if (!e.props.isWorking) {
      stop()

      return next(e)
    }

    const progress = taskProgress(tasks.values())
    const seconds = ((await $.clock.now()) - startedAt) / 1000
    const target = progress
      ? progress.done / progress.total
      : 1 - Math.exp(-seconds / FILL_SECONDS)
    // Glide toward the target so a completed task sweeps in instead of jumping
    shown += (target - shown) * 0.2
    const { Box, Raster, Text } = $.ui.resolve(e)

    return (
      <Box flexDirection="column">
        <Raster key="explorai-logo" columns={width} rows={rows} cells={frameCells(shown, frame)} />
        {progress && (
          <Text dimColor>
            {progress.done}/{progress.total} tasks · {Math.round((100 * progress.done) / progress.total)}%
          </Text>
        )}
      </Box>
    )
  })
}
