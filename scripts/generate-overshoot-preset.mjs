import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const sourcePath = fileURLToPath(
  new URL('../assets/SequoiaBounce.ffx', import.meta.url),
)
const destinationPath = fileURLToPath(
  new URL('../assets/SequoiaOvershoot.ffx', import.meta.url),
)
const sourceMatchName = 'Pseudo/Sequoia Bounce'
const destinationMatchName = 'Pseudo/Sequoia Overshoot'
const preset = Buffer.from(readFileSync(sourcePath))
const riffEnd = preset.readUInt32BE(4) + 8
let replacedMatchNames = 0
let replacedDisplayNames = 0

function readChunkString(offset, size) {
  const payload = preset.subarray(offset, offset + size)
  const terminator = payload.indexOf(0)

  return payload.subarray(0, terminator === -1 ? size : terminator).toString()
}

function writeChunkString(offset, size, value) {
  const encoded = Buffer.from(value)

  if (encoded.length >= size) {
    throw new Error(`The value "${value}" does not fit in a ${size}-byte chunk.`)
  }

  preset.fill(0, offset, offset + size)
  encoded.copy(preset, offset)
}

for (let offset = 8; offset + 8 <= riffEnd; offset += 1) {
  const chunkName = preset.toString('ascii', offset, offset + 4)

  if (chunkName !== 'tdmn' && chunkName !== 'tdsn') {
    continue
  }

  const chunkSize = preset.readUInt32BE(offset + 4)
  const payloadOffset = offset + 8

  if (payloadOffset + chunkSize > riffEnd) {
    continue
  }

  const value = readChunkString(payloadOffset, chunkSize)

  if (chunkName === 'tdmn' && value.indexOf(sourceMatchName) === 0) {
    writeChunkString(
      payloadOffset,
      chunkSize,
      destinationMatchName + value.substring(sourceMatchName.length),
    )
    replacedMatchNames += 1
  } else if (chunkName === 'tdsn' && value === 'Sequoia Bounce') {
    writeChunkString(payloadOffset, chunkSize, 'Overshoot')
    replacedDisplayNames += 1
  }
}

if (replacedMatchNames !== 9 || replacedDisplayNames !== 2) {
  throw new Error(
    `Unexpected Bounce preset structure: ${replacedMatchNames} match names and ${replacedDisplayNames} display names were replaced.`,
  )
}

const xml = preset.subarray(riffEnd).toString()
const overshootXml = xml.replace(
  '<control name="Sequoia Bounce">',
  '<control name="Sequoia Overshoot">',
)

if (overshootXml === xml) {
  throw new Error('The embedded pseudo-effect definition was not found.')
}

writeFileSync(
  destinationPath,
  Buffer.concat([preset.subarray(0, riffEnd), Buffer.from(overshootXml)]),
)
