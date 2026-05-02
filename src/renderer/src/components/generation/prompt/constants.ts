import { Image as ImageIcon, Video, Music } from 'lucide-react'
import type { ContentType } from '../../../lib/model-capabilities'

export const contentTypeMeta: Record<ContentType, { label: string; icon: typeof ImageIcon }> = {
  image: { label: 'Image', icon: ImageIcon },
  video: { label: 'Video', icon: Video },
  audio: { label: 'Audio', icon: Music }
}
