import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const sourcePath = fileURLToPath(
  new URL('../assets/SequoiaBounce.ffx', import.meta.url),
)
const source = Buffer.from(readFileSync(sourcePath))
const sourceMatchName = 'Pseudo/Sequoia Bounce'
const sourceDisplayName = 'Sequoia Bounce'
const sourceRiffEnd = source.readUInt32BE(4) + 8

const presets = [
  {
    controls: [
      checkbox('Enable', 1),
      slider('Frequency', 2, 0, 1000, 0, 30, 2),
      slider('Amount', 50, -30000, 30000, 0, 500, 2),
      checkbox('Individual Axis', 0),
      slider('X', 50, -30000, 30000, 0, 500, 2),
      slider('Y', 50, -30000, 30000, 0, 500, 2),
      slider('Z', 50, -30000, 30000, 0, 500, 2),
      checkbox('Lock Dimensions', 0),
      slider('Random Seed', 1, -1000000, 1000000, 0, 1000, 0),
      slider('Frame Rate', 0, 0, 240, 0, 60, 2),
    ],
    definitionName: 'Sequoia Wiggle',
    displayName: 'Wiggle',
    fileName: 'SequoiaWiggle.ffx',
    matchName: 'Pseudo/Sequoia Wiggle v1',
  },
  {
    controls: [
      checkbox('Enable', 1),
      checkbox('Reverse', 0),
      slider('Speed', 90, -1000000, 1000000, -720, 720, 2),
      slider('Frame Rate', 0, 0, 240, 0, 60, 2),
      slider('Offset', 0, -1000000, 1000000, -360, 360, 2),
    ],
    definitionName: 'Sequoia Spin',
    displayName: 'Spin',
    fileName: 'SequoiaSpin.ffx',
    matchName: 'Pseudo/Sequoia Spin v1',
  },
  {
    controls: [
      checkbox('Enable', 1),
      slider('Speed', 8, 0, 1000, 0, 30, 2),
      checkbox('Enable Fixed', 1),
      slider('Random Timing', 35, 0, 100, 0, 100, 1, true),
      slider('Max Opacity', 100, 0, 100, 0, 100, 1, true),
      slider('Min Opacity', 0, 0, 100, 0, 100, 1, true),
    ],
    definitionName: 'Sequoia Blinker',
    displayName: 'Blinker',
    fileName: 'SequoiaBlinker.ffx',
    matchName: 'Pseudo/Sequoia Blinker v1',
  },
  {
    controls: [
      checkbox('Enable', 1),
      slider('Animation', 12, 0, 10000, 0, 120, 1),
      checkbox('Linear', 0),
    ],
    definitionName: 'Sequoia Fader',
    displayName: 'Fader',
    fileName: 'SequoiaFader.ffx',
    matchName: 'Pseudo/Sequoia Fader v1',
  },
]

function checkbox(name, value) {
  return {
    hold: false,
    id: name,
    keys: true,
    name,
    per: false,
    pix: false,
    pre: '0',
    sMax: 1,
    sMin: 0,
    type: 'checkbox',
    vMax: 1,
    vMin: 0,
    value,
  }
}

function slider(
  name,
  value,
  vMin,
  vMax,
  sMin,
  sMax,
  precision,
  percent = false,
) {
  return {
    hold: false,
    id: name,
    keys: true,
    name,
    per: percent,
    pix: false,
    pre: String(precision),
    sMax,
    sMin,
    type: 'slider',
    vMax,
    vMin,
    value,
  }
}

function makeChunk(id, payload) {
  const padding = payload.length % 2
  const result = Buffer.alloc(8 + payload.length + padding)

  result.write(id, 0, 4, 'ascii')
  result.writeUInt32BE(payload.length, 4)
  payload.copy(result, 8)

  return result
}

function makeList(type, children) {
  return makeChunk(
    'LIST',
    Buffer.concat([Buffer.from(type, 'ascii'), ...children]),
  )
}

function readChunks(buffer, start, end) {
  const chunks = []

  for (let offset = start; offset + 8 <= end; ) {
    const id = buffer.toString('ascii', offset, offset + 4)
    const size = buffer.readUInt32BE(offset + 4)
    const totalSize = 8 + size + (size % 2)

    if (offset + totalSize > end) {
      throw new Error(`Invalid ${id} chunk at 0x${offset.toString(16)}.`)
    }

    chunks.push({
      buffer: buffer.subarray(offset, offset + totalSize),
      dataEnd: offset + 8 + size,
      dataStart: offset + 8,
      id,
      offset,
      size,
      type: id === 'LIST'
        ? buffer.toString('ascii', offset + 8, offset + 12)
        : null,
    })
    offset += totalSize
  }

  return chunks
}

function findMainList() {
  for (let offset = 8; offset + 12 <= sourceRiffEnd; offset += 1) {
    if (
      source.toString('ascii', offset, offset + 4) === 'LIST' &&
      source.toString('ascii', offset + 8, offset + 12) === 'sspc'
    ) {
      return {
        offset,
        size: source.readUInt32BE(offset + 4),
      }
    }
  }

  throw new Error('The source pseudo-effect LIST was not found.')
}

function chunkPayload(chunk) {
  return source.subarray(chunk.dataStart, chunk.dataEnd)
}

const mainList = findMainList()
const mainChildren = readChunks(
  source,
  mainList.offset + 12,
  mainList.offset + 8 + mainList.size,
)
const fileNameChunk = mainChildren.find((chunk) => chunk.id === 'fnam')
const parameterList = mainChildren.find((chunk) => chunk.type === 'parT')
const effectGroupList = mainChildren.find((chunk) => chunk.type === 'tdgp')

if (!fileNameChunk || !parameterList || !effectGroupList) {
  throw new Error('The source pseudo-effect structure is incomplete.')
}

const parameterChunks = readChunks(
  source,
  parameterList.dataStart + 4,
  parameterList.dataEnd,
)
const effectGroupChunks = readChunks(
  source,
  effectGroupList.dataStart + 4,
  effectGroupList.dataEnd,
)
const rootParameterName = parameterChunks[1]
const rootParameterData = parameterChunks[2]
const sliderParameterData = parameterChunks[4]
const rootValueList = effectGroupChunks[3]
const sliderValueList = effectGroupChunks[5]
const groupEndName = effectGroupChunks[effectGroupChunks.length - 1]

if (
  !rootParameterName ||
  rootParameterName.id !== 'tdmn' ||
  !rootParameterData ||
  rootParameterData.id !== 'pard' ||
  !sliderParameterData ||
  sliderParameterData.id !== 'pard' ||
  !rootValueList ||
  rootValueList.type !== 'tdbs' ||
  !sliderValueList ||
  sliderValueList.type !== 'tdbs' ||
  !groupEndName ||
  groupEndName.id !== 'tdmn'
) {
  throw new Error('Unexpected source pseudo-effect control layout.')
}

const sliderValueChunks = readChunks(
  source,
  sliderValueList.dataStart + 4,
  sliderValueList.dataEnd,
)

function makeFixedStringPayload(value, size = 40) {
  const encoded = Buffer.from(value)

  if (encoded.length >= size) {
    throw new Error(`The value "${value}" does not fit in ${size} bytes.`)
  }

  const payload = Buffer.alloc(size)
  encoded.copy(payload)

  return payload
}

function makeParameterName(matchName, index) {
  return makeChunk(
    'tdmn',
    makeFixedStringPayload(`${matchName}-${String(index).padStart(4, '0')}`),
  )
}

function makeParameterData(control) {
  const payload = Buffer.from(chunkPayload(sliderParameterData))
  const name = Buffer.from(control.name)

  if (name.length > 80) {
    throw new Error(`The control name "${control.name}" is too long.`)
  }

  payload.fill(0, 0x10, 0x68)
  name.copy(payload, 0x10)

  if (control.type === 'checkbox') {
    payload.writeUInt8(0x04, 0x0f)
    payload.writeUInt8(0x01, 0x3b)
    payload.writeUInt8(0x01, 0x3c)
    payload.fill(0, 0x68, 0x7e)
  } else {
    payload.writeFloatBE(control.vMin, 0x68)
    payload.writeFloatBE(control.vMax, 0x6c)
    payload.writeFloatBE(control.sMin, 0x70)
    payload.writeFloatBE(control.sMax, 0x74)
    payload.writeFloatBE(control.value, 0x78)
  }

  return makeChunk('pard', payload)
}

function makeControlValueList(control) {
  const children = []

  for (const chunk of sliderValueChunks) {
    if (chunk.id === 'tdsn') {
      children.push(makeChunk('tdsn', Buffer.from(`${control.name}\0`)))
      continue
    }

    if (chunk.id === 'cdat') {
      const payload = Buffer.from(chunkPayload(chunk))
      payload.writeDoubleBE(control.value, 0)
      children.push(makeChunk('cdat', payload))
      continue
    }

    if (chunk.id === 'tdb4' && control.type === 'checkbox') {
      const payload = Buffer.from(chunkPayload(chunk))
      payload.writeUInt8(0xdb, 0)
      payload.writeUInt8(0x04, 0x0b)
      payload.writeUInt8(0x04, 0x3b)
      payload.writeUInt8(0x04, 0x3c)
      children.push(makeChunk('tdb4', payload))
      continue
    }

    if (
      control.type === 'checkbox' &&
      (chunk.id === 'tdum' || chunk.id === 'tduM')
    ) {
      continue
    }

    children.push(Buffer.from(chunk.buffer))
  }

  return makeList('tdbs', children)
}

function patchPrefix(prefix, matchName, displayName) {
  const result = Buffer.from(prefix)
  let matchNames = 0
  let displayNames = 0

  for (let offset = 8; offset + 8 <= result.length; offset += 1) {
    const id = result.toString('ascii', offset, offset + 4)

    if (id !== 'tdmn' && id !== 'tdsn') {
      continue
    }

    const size = result.readUInt32BE(offset + 4)
    const payloadOffset = offset + 8

    if (payloadOffset + size > result.length) {
      continue
    }

    const terminator = result.indexOf(0, payloadOffset)
    const valueEnd = terminator === -1 || terminator > payloadOffset + size
      ? payloadOffset + size
      : terminator
    const value = result.toString('utf8', payloadOffset, valueEnd)

    if (id === 'tdmn' && value === sourceMatchName) {
      const encoded = Buffer.from(matchName)

      if (encoded.length >= size) {
        throw new Error(`The match name "${matchName}" does not fit.`)
      }

      result.fill(0, payloadOffset, payloadOffset + size)
      encoded.copy(result, payloadOffset)
      matchNames += 1
    } else if (id === 'tdsn' && value === sourceDisplayName) {
      const encoded = Buffer.from(displayName)

      if (encoded.length >= size) {
        throw new Error(`The display name "${displayName}" does not fit.`)
      }

      result.fill(0, payloadOffset, payloadOffset + size)
      encoded.copy(result, payloadOffset)
      displayNames += 1
    }
  }

  if (matchNames !== 1 || displayNames !== 1) {
    throw new Error(
      `Unexpected source prefix: patched ${matchNames} match names and ${displayNames} display names.`,
    )
  }

  return result
}

function buildPreset(preset) {
  const parameterCount = Buffer.alloc(4)
  parameterCount.writeUInt32BE(preset.controls.length + 1)
  const parameterChildren = [
    makeChunk('parn', parameterCount),
    makeParameterName(preset.matchName, 0),
    Buffer.from(rootParameterData.buffer),
  ]

  for (let index = 0; index < preset.controls.length; index += 1) {
    parameterChildren.push(makeParameterName(preset.matchName, index + 1))
    parameterChildren.push(makeParameterData(preset.controls[index]))

    if (preset.controls[index].type === 'checkbox') {
      parameterChildren.push(makeChunk('pdnm', Buffer.from([0])))
    }
  }

  const effectChildren = [
    Buffer.from(effectGroupChunks[0].buffer),
    makeChunk('tdsn', Buffer.from(`${preset.displayName}\0`)),
    makeParameterName(preset.matchName, 0),
    Buffer.from(rootValueList.buffer),
  ]

  for (let index = 0; index < preset.controls.length; index += 1) {
    effectChildren.push(makeParameterName(preset.matchName, index + 1))
    effectChildren.push(makeControlValueList(preset.controls[index]))
  }

  effectChildren.push(Buffer.from(groupEndName.buffer))

  const newMainList = makeList('sspc', [
    Buffer.from(fileNameChunk.buffer),
    makeList('parT', parameterChildren),
    makeList('tdgp', effectChildren),
  ])
  const prefix = patchPrefix(
    source.subarray(0, mainList.offset),
    preset.matchName,
    preset.displayName,
  )
  const riff = Buffer.concat([prefix, newMainList])

  riff.writeUInt32BE(riff.length - 8, 4)

  const definition = `<control name="${preset.definitionName}">${JSON.stringify(preset.controls)}</control>`

  return Buffer.concat([riff, Buffer.from(definition)])
}

for (const preset of presets) {
  const destinationPath = fileURLToPath(
    new URL(`../assets/${preset.fileName}`, import.meta.url),
  )

  writeFileSync(destinationPath, buildPreset(preset))
}
