import { expect, mock, test } from 'claude-code/testing'

import { dancePose, frameCells, pixel, spritePixel, taskProgress } from '../hooks/register'

const band = (isWorking: boolean) => ({
  plugin: 'explorai-loading',
  surface: 'terminal' as const,
  component: 'AbovePrompt' as const,
  props: {
    hasSurvey: false,
    isWorking,
    maxRows: 20,
    bodyColumns: 120,
    scroll: { offset: 0, bodyRows: 20 },
    view: {},
  },
})

test('draws the logo while a turn is running', async ($, on) => {
  mock.clock(on)
  const ui = await $.ui.mount(band(true))
  const logo = await ui.find({ key: 'explorai-logo' })

  expect(logo?.type).toBe('Raster')
  // 72 logo columns, a 3-column gap, the 16-pixel dancer and 2 columns to sway in
  expect(logo?.props.columns).toBe(93)
  expect(logo?.props.rows).toBe(9)
  await ui.unmount()
})

test('draws nothing of its own when idle', async ($, on) => {
  mock.clock(on)
  // Stands for the engine's own band
  on('ui.render', (e$, e) => {
    const { Text } = e$.ui.resolve(e)

    return <Text>engine band</Text>
  })
  const ui = await $.ui.mount(band(false))

  expect(await ui.find({ key: 'explorai-logo' })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: 'engine band' })).toBeDefined()
  await ui.unmount()
})

test('letters are grey before the fill reaches them and colored after', () => {
  // (34, 4) is on the 'l' stroke of the logo
  expect(pixel(34, 4, 0, 0)).toBe(0x3a3a3a)
  expect(pixel(34, 4, 1, 0)).not.toBe(0x3a3a3a)
  expect(pixel(0, 0, 1, 0)).toBeNull()
})

test('progress is the share of completed tasks', () => {
  expect(taskProgress([])).toBeNull()
  expect(taskProgress(['completed', 'in_progress', 'pending', 'completed'])).toEqual({ done: 2, total: 4 })
})

test('the band follows Claude task list', async ($, on) => {
  mock.clock(on)
  let next = 0
  // Stand for the engine's task tools
  on('tool.call', { tool: 'TaskCreate' }, e$ => ({ result: { task: { id: String(++next), subject: 's' } } }))
  on('tool.call', { tool: 'TaskUpdate' }, (e$, e) => ({
    result: { success: true, taskId: e.taskId, updatedFields: ['status'] },
  }))

  for (const subject of ['a', 'b', 'c', 'd']) {
    await $.tool.call({ tool: 'TaskCreate', subject, description: subject })
  }
  await $.tool.call({ tool: 'TaskUpdate', taskId: '1', status: 'completed' })
  await $.tool.call({ tool: 'TaskUpdate', taskId: '2', status: 'in_progress' })
  await $.tool.call({ tool: 'TaskUpdate', taskId: '4', status: 'deleted' })

  const ui = await $.ui.mount(band(true))

  expect(await ui.find({ type: 'Text', text: '1/3 tasks · 33%' })).toBeDefined()
  await ui.unmount()
})

test('a frame encodes every cell', () => {
  expect(atob(frameCells(0.5, 3)).length).toBe(93 * 9 * 3 * 4)
})

test('the dancer hops, sways and turns around', () => {
  const poses = Array.from({ length: 24 }, (_, beat) => dancePose(beat * 3))

  expect(new Set(poses.map(pose => pose.top)).size).toBeGreaterThan(1)
  expect(new Set(poses.map(pose => pose.left)).size).toBeGreaterThan(1)
  expect(poses.some(pose => pose.isMirrored)).toBe(true)
  expect(poses.some(pose => !pose.isMirrored)).toBe(true)
})

test('the dancer keeps the picture colors and moves between beats', () => {
  const frames = [0, 3, 6, 9].map(frame =>
    Array.from({ length: 18 * 18 }, (_, i) => spritePixel(i % 18, Math.floor(i / 18), frame)),
  )

  expect(frames[0]?.some(color => color !== null)).toBe(true)
  expect(new Set(frames.map(colors => colors.join())).size).toBeGreaterThan(1)
})
