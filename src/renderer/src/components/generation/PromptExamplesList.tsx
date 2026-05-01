import { type JSX } from 'react'
import { Plus, Music } from 'lucide-react'
import { type PromptExample } from '../../../../shared/model-registry'

import {
  MorphingDialog,
  MorphingDialogTrigger,
  MorphingDialogContent,
  MorphingDialogTitle,
  MorphingDialogImage,
  MorphingDialogClose,
  MorphingDialogDescription,
  MorphingDialogContainer
} from '../motion-primitives/morphing-dialog'

import redPandaSticker from '../../assets/examples/red_panda_sticker.png'
import photorealisticExample from '../../assets/examples/photorealistic_example.png'
import cityStyleTransfer from '../../assets/examples/city_style_transfer.png'
import logoExample from '../../assets/examples/logo_example.jpg'
import fashionEcommerceShot from '../../assets/examples/fashion_ecommerce_shot.png'
import glossyMagazineCover from '../../assets/examples/glossy_magazine_cover.png'
import londonWeatherIsometric from '../../assets/examples/london_weather_isometric.png'
import quetzalBirdWallpaper from '../../assets/examples/quetzal_bird_wallpaper.png'
import cafeMixedStyles from '../../assets/examples/cafe_mixed_styles.png'
import geminiFlashArticle from '../../assets/examples/gemini_flash_article.png'
import isometricGarden from '../../assets/examples/isometric_garden.png'

const exampleImageMap: Record<string, string> = {
  red_panda_sticker: redPandaSticker,
  photorealistic_example: photorealisticExample,
  city_style_transfer: cityStyleTransfer,
  logo_example: logoExample,
  fashion_ecommerce_shot: fashionEcommerceShot,
  glossy_magazine_cover: glossyMagazineCover,
  london_weather_isometric: londonWeatherIsometric,
  quetzal_bird_wallpaper: quetzalBirdWallpaper,
  cafe_mixed_styles: cafeMixedStyles,
  gemini_flash_article: geminiFlashArticle,
  isometric_garden: isometricGarden
}

function getYouTubeThumbnail(url?: string): string {
  if (!url) return ''
  const match = url.match(/embed\/([^?]+)/)
  // Use hqdefault instead of maxresdefault as it's more widely available
  return match ? `https://img.youtube.com/vi/${match[1]}/hqdefault.jpg` : ''
}

export function PromptExamplesList({
  examples,
  onSelect
}: {
  examples: PromptExample[]
  onSelect: (prompt: string, configOverrides?: Record<string, unknown>) => void
}): JSX.Element | null {
  if (!examples || examples.length === 0) return null

  return (
    <div className="mt-10 flex flex-col gap-3">
      <div className="flex items-center gap-2 text-text-muted">
        <span className="text-xs font-medium uppercase tracking-wider">Prompting Strategies</span>
        <span className="text-[10px] text-text-muted/60 ml-2">(Click to preview)</span>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {examples.map((example, i) => (
          <MorphingDialog
            key={i}
            transition={{
              type: 'spring',
              bounce: 0.05,
              duration: 0.25
            }}
          >
            <MorphingDialogTrigger className="group relative flex h-28 flex-col items-start justify-end overflow-hidden rounded-xl bg-bg-elevated text-left transition-all hover:-translate-y-0.5 hover:ring-2 hover:ring-accent/50 hover:shadow-lg select-none">
              {example.youtubeLink ? (
                <MorphingDialogImage
                  src={getYouTubeThumbnail(example.youtubeLink)}
                  alt={example.title}
                  className="absolute inset-0 h-full w-full object-cover opacity-60 transition-transform duration-500 group-hover:scale-110 group-hover:opacity-80 pointer-events-none"
                />
              ) : example.audioLink ? (
                <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-indigo-500/20 via-purple-500/20 to-pink-500/20 pointer-events-none group-hover:scale-110 transition-transform duration-500">
                  <Music className="h-12 w-12 text-accent/50 drop-shadow-md" />
                </div>
              ) : (
                <MorphingDialogImage
                  src={exampleImageMap[example.imageName]}
                  alt={example.title}
                  className="absolute inset-0 h-full w-full object-cover opacity-60 transition-transform duration-500 group-hover:scale-110 group-hover:opacity-80 pointer-events-none"
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent pointer-events-none" />

              <div
                role="button"
                className="absolute top-2 right-2 z-20 flex h-7 w-7 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-md opacity-0 group-hover:opacity-100 transition-all hover:bg-accent hover:scale-110 cursor-pointer pointer-events-auto"
                title="Quick Use Strategy"
                onClick={(e) => {
                  e.stopPropagation()
                  e.preventDefault()
                  onSelect(example.prompt, example.configOverrides)
                }}
              >
                <Plus className="h-4 w-4" />
              </div>

              <div className="relative z-10 p-3 pointer-events-none w-full">
                <MorphingDialogTitle className="line-clamp-2 text-[11px] font-medium leading-tight text-white/95 shadow-black/50 drop-shadow-md">
                  {example.title}
                </MorphingDialogTitle>
              </div>
            </MorphingDialogTrigger>

            <MorphingDialogContainer>
              <MorphingDialogContent className="pointer-events-auto relative flex h-auto w-full flex-col overflow-hidden rounded-[24px] border border-border-subtle bg-bg-primary shadow-2xl sm:w-[550px]">
                {example.youtubeLink ? (
                  <iframe
                    src={`${example.youtubeLink}?autoplay=1&mute=1&loop=1&playlist=${example.youtubeLink.split('/').pop()}`}
                    className="h-72 w-full object-cover border-0"
                    allow="autoplay; encrypted-media"
                    allowFullScreen
                  />
                ) : example.audioLink ? (
                  <div className="flex h-72 w-full flex-col items-center justify-center bg-gradient-to-br from-indigo-500/10 via-purple-500/10 to-pink-500/10 p-6 relative">
                    <Music className="mb-6 h-16 w-16 text-accent/40" />
                    {example.audioLink.endsWith('.webm') ? (
                      <video
                        controls
                        src={example.audioLink}
                        className="w-full max-w-md rounded-lg shadow-md"
                      />
                    ) : (
                      <audio controls src={example.audioLink} className="w-full max-w-md" />
                    )}
                  </div>
                ) : (
                  <MorphingDialogImage
                    src={exampleImageMap[example.imageName]}
                    alt={example.title}
                    className="h-72 w-full object-cover"
                  />
                )}

                <div className="p-6 flex flex-col gap-4">
                  <div>
                    <MorphingDialogTitle className="text-xl font-semibold text-text-primary mb-1">
                      {example.title}
                    </MorphingDialogTitle>
                    <MorphingDialogDescription className="text-sm text-text-secondary leading-relaxed">
                      {example.prompt}
                    </MorphingDialogDescription>
                  </div>

                  {example.configOverrides && Object.keys(example.configOverrides).length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-1">
                      {Object.entries(example.configOverrides).map(([key, val]) => (
                        <div
                          key={key}
                          className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md bg-accent/10 text-accent border border-accent/20"
                        >
                          <span className="text-accent/70 capitalize">
                            {key.replace(/_/g, ' ')}:
                          </span>
                          <span>{String(val)}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="mt-4 flex justify-end gap-3">
                    <MorphingDialogClose className="px-4 py-2 rounded-lg text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-bg-elevated transition-colors">
                      Cancel
                    </MorphingDialogClose>
                    <MorphingDialogClose
                      onClick={() => onSelect(example.prompt, example.configOverrides)}
                      className="px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent/90 transition-colors"
                    >
                      Use this Strategy
                    </MorphingDialogClose>
                  </div>
                </div>

                {/* Corner close button */}
                <MorphingDialogClose className="absolute top-4 right-4 flex h-8 w-8 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-md transition-colors hover:bg-black/60">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M18 6 6 18" />
                    <path d="m6 6 12 12" />
                  </svg>
                </MorphingDialogClose>
              </MorphingDialogContent>
            </MorphingDialogContainer>
          </MorphingDialog>
        ))}
      </div>
    </div>
  )
}
