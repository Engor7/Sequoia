import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const localTemplatePath = fileURLToPath(
  new URL('../assets/SequoiaColorControls01.ffx', import.meta.url),
)
const sourcePath = process.argv[2] || localTemplatePath
const source = Buffer.from(readFileSync(sourcePath))
const sourceRiffEnd = source.readUInt32BE(4) + 8

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

function chunkPayload(chunk) {
  return source.subarray(chunk.dataStart, chunk.dataEnd)
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

  throw new Error('The Color pseudo-effect LIST was not found.')
}

function decodeStringPayload(payload) {
  let start = 0
  let size = payload.length

  if (payload.length >= 8 && payload.toString('ascii', 0, 4) === 'Utf8') {
    start = 8
    size = Math.min(payload.readUInt32BE(4), payload.length - start)
  }

  const terminator = payload.indexOf(0, start)
  const end = terminator === -1
    ? start + size
    : Math.min(terminator, start + size)

  return payload.toString('utf8', start, end)
}

function makeStringPayload(value, templatePayload) {
  const encoded = Buffer.from(value)

  if (
    templatePayload.length >= 8 &&
    templatePayload.toString('ascii', 0, 4) === 'Utf8'
  ) {
    return Buffer.concat([
      Buffer.from('Utf8', 'ascii'),
      Buffer.from([
        (encoded.length >>> 24) & 0xff,
        (encoded.length >>> 16) & 0xff,
        (encoded.length >>> 8) & 0xff,
        encoded.length & 0xff,
      ]),
      encoded,
      Buffer.from([0]),
    ])
  }

  return Buffer.concat([encoded, Buffer.from([0])])
}

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

const mainList = findMainList()
const mainChildren = readChunks(
  source,
  mainList.offset + 12,
  mainList.offset + 8 + mainList.size,
)
const parameterListIndex = mainChildren.findIndex((chunk) => chunk.type === 'parT')
const effectGroupIndex = mainChildren.findIndex((chunk) => chunk.type === 'tdgp')

if (parameterListIndex === -1 || effectGroupIndex === -1) {
  throw new Error('The Color pseudo-effect structure is incomplete.')
}

const parameterList = mainChildren[parameterListIndex]
const effectGroupList = mainChildren[effectGroupIndex]
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

if (
  parameterChunks.length < 5 ||
  parameterChunks[0].id !== 'parn' ||
  parameterChunks[1].id !== 'tdmn' ||
  parameterChunks[2].id !== 'pard' ||
  parameterChunks[3].id !== 'tdmn' ||
  parameterChunks[4].id !== 'pard' ||
  effectGroupChunks.length < 6 ||
  effectGroupChunks[0].id !== 'tdsb' ||
  effectGroupChunks[1].id !== 'tdsn' ||
  effectGroupChunks[2].id !== 'tdmn' ||
  effectGroupChunks[3].type !== 'tdbs' ||
  effectGroupChunks[4].id !== 'tdmn' ||
  effectGroupChunks[5].type !== 'tdbs'
) {
  throw new Error('Unexpected Color pseudo-effect control layout.')
}

const sourceRootName = decodeStringPayload(chunkPayload(parameterChunks[1]))
const sourceMatchName = sourceRootName.replace(/-0000$/, '')
const colorParameterTemplate = Buffer.from(chunkPayload(parameterChunks[4]))
const colorValueList = effectGroupChunks[5]
const colorValueChunks = readChunks(
  source,
  colorValueList.dataStart + 4,
  colorValueList.dataEnd,
)
const rootValueList = effectGroupChunks[3]

function makeColorParameterData(name) {
  const payload = Buffer.from(colorParameterTemplate)
  const encoded = Buffer.from(name)

  if (encoded.length >= 40) {
    throw new Error(`The Color control name "${name}" is too long.`)
  }

  payload.fill(0, 0x10, 0x38)
  encoded.copy(payload, 0x10)
  return makeChunk('pard', payload)
}

function rebuildValueList(templateList, templateChunks, name, isColor) {
  const children = []

  for (const chunk of templateChunks) {
    if (chunk.id === 'tdsn') {
      children.push(
        makeChunk('tdsn', makeStringPayload(name, chunkPayload(chunk))),
      )
      continue
    }

    if (isColor && chunk.id === 'cdat') {
      const payload = Buffer.from(chunkPayload(chunk))
      payload.writeDoubleBE(255, 0)
      payload.writeDoubleBE(255, 8)
      payload.writeDoubleBE(255, 16)
      payload.writeDoubleBE(255, 24)
      children.push(makeChunk('cdat', payload))
      continue
    }

    children.push(Buffer.from(chunk.buffer))
  }

  return makeList(templateList.type, children)
}

function patchPrefix(prefix, matchName) {
  const result = Buffer.from(prefix)
  let matchNames = 0

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

    const payload = result.subarray(payloadOffset, payloadOffset + size)
    const value = decodeStringPayload(payload)
    if (id === 'tdmn' && value === sourceMatchName) {
      makeFixedStringPayload(matchName, size).copy(result, payloadOffset)
      matchNames += 1
    }
  }

  if (matchNames !== 1) {
    throw new Error(`Unexpected Color prefix: patched ${matchNames} match names.`)
  }

  return result
}

function buildPreset(count) {
  const countLabel = String(count).padStart(2, '0')
  const matchName = `Pseudo/SQ Color Controls ${countLabel}`
  const parameterCount = Buffer.alloc(4)
  // The source Color pseudo effect includes AE's built-in effect-parameter
  // group in addition to the root and visible Color controls.
  parameterCount.writeUInt32BE(count + 2)

  const parameterChildren = [
    makeChunk('parn', parameterCount),
    makeParameterName(matchName, 0),
    Buffer.from(parameterChunks[2].buffer),
  ]

  for (let index = 1; index <= count; index += 1) {
    const name = `Color ${String(index).padStart(2, '0')}`
    parameterChildren.push(makeParameterName(matchName, index))
    parameterChildren.push(
      index === 1
        ? Buffer.from(parameterChunks[4].buffer)
        : makeColorParameterData(name),
    )
  }

  for (let index = 5; index < parameterChunks.length; index += 1) {
    parameterChildren.push(Buffer.from(parameterChunks[index].buffer))
  }

  const effectChildren = [
    Buffer.from(effectGroupChunks[0].buffer),
    Buffer.from(effectGroupChunks[1].buffer),
    makeParameterName(matchName, 0),
    Buffer.from(rootValueList.buffer),
  ]

  for (let index = 1; index <= count; index += 1) {
    const name = `Color ${String(index).padStart(2, '0')}`
    effectChildren.push(makeParameterName(matchName, index))
    effectChildren.push(
      index === 1
        ? Buffer.from(colorValueList.buffer)
        : rebuildValueList(colorValueList, colorValueChunks, name, true),
    )
  }

  for (let index = 6; index < effectGroupChunks.length; index += 1) {
    effectChildren.push(Buffer.from(effectGroupChunks[index].buffer))
  }

  const nextMainChildren = mainChildren.map((chunk, index) => {
    if (index === parameterListIndex) {
      return makeList('parT', parameterChildren)
    }

    if (index === effectGroupIndex) {
      return makeList('tdgp', effectChildren)
    }

    return Buffer.from(chunk.buffer)
  })
  const nextMainList = makeList('sspc', nextMainChildren)
  const prefix = patchPrefix(source.subarray(0, mainList.offset), matchName)
  const riff = Buffer.concat([prefix, nextMainList])
  riff.writeUInt32BE(riff.length - 8, 4)

  const controls = Array.from({ length: count }, (_, index) => ({
    hold: false,
    id: `Color ${String(index + 1).padStart(2, '0')}`,
    keys: true,
    name: `Color ${String(index + 1).padStart(2, '0')}`,
    type: 'color',
    value: [1, 1, 1, 1],
  }))
  const definition = `<control name="Sequoia Color Controls ${countLabel}">${JSON.stringify(controls)}</control>`

  return Buffer.concat([riff, Buffer.from(definition)])
}

for (let count = 1; count <= 16; count += 1) {
  const countLabel = String(count).padStart(2, '0')
  const destinationPath = fileURLToPath(
    new URL(`../assets/SequoiaColorControls${countLabel}.ffx`, import.meta.url),
  )

  writeFileSync(destinationPath, buildPreset(count))
}
