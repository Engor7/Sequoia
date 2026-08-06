import { createIcon } from '../createIcon'
import { keyframeDiamondPath } from '../keyframeShapes'

export const StaggerAscendingIcon = createIcon(
  'StaggerAscendingIcon',
  '0 0 56 56',
  <>
    <path d={keyframeDiamondPath} transform="translate(46 10)" />
    <path d={keyframeDiamondPath} transform="translate(28 28)" />
    <path d={keyframeDiamondPath} transform="translate(10 46)" />
  </>,
)
