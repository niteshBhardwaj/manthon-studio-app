// ============================================================
// Manthan Studio — Template Selector
// Pre-built prompt templates for quick starts
// ============================================================

import { motion } from 'framer-motion'
import { Film, Camera, Sparkles, ShoppingBag, BookOpen, Palette, Zap } from 'lucide-react'
import { useGenerationStore } from '../../stores/generation-store'
import { cn } from '../../lib/utils'

interface Template {
  id: string
  name: string
  prompt: string
  category: string
  icon: React.ReactNode
  gradient: string
}

const defaultTemplates: Template[] = [
  {
    id: 'cinematic',
    name: 'Cinematic Shot',
    prompt: 'A cinematic shot with dramatic lighting, shallow depth of field, anamorphic lens flare, film grain, professional color grading.',
    category: 'style',
    icon: <Film className="w-5 h-5" />,
    gradient: 'from-blue-600/20 to-indigo-600/20'
  },
  {
    id: 'dialogue',
    name: 'Dialogue Scene',
    prompt: 'A close-up conversation scene between two people. Natural lighting, intimate framing, clear dialogue with subtle ambient sound.',
    category: 'scene',
    icon: <Camera className="w-5 h-5" />,
    gradient: 'from-emerald-600/20 to-teal-600/20'
  },
  {
    id: 'realism',
    name: 'Photorealism',
    prompt: 'Ultra-realistic, photorealistic quality, natural lighting, no artifacts, no distortion, professional photography style.',
    category: 'style',
    icon: <Sparkles className="w-5 h-5" />,
    gradient: 'from-amber-600/20 to-yellow-600/20'
  },
  {
    id: 'product-ad',
    name: 'Product Ad',
    prompt: 'Professional product advertisement. Clean white background, studio lighting, smooth camera movement, premium feel.',
    category: 'commercial',
    icon: <ShoppingBag className="w-5 h-5" />,
    gradient: 'from-rose-600/20 to-pink-600/20'
  },
  {
    id: 'storytelling',
    name: 'Storytelling',
    prompt: 'A narrative sequence with emotional depth, character-driven action, atmospheric soundtrack, cinematic pacing.',
    category: 'narrative',
    icon: <BookOpen className="w-5 h-5" />,
    gradient: 'from-violet-600/20 to-purple-600/20'
  },
  {
    id: 'abstract-art',
    name: 'Abstract Art',
    prompt: 'Abstract fluid motion, vivid colors morphing and flowing, dreamlike atmosphere, slow ethereal movement.',
    category: 'creative',
    icon: <Palette className="w-5 h-5" />,
    gradient: 'from-cyan-600/20 to-sky-600/20'
  },
  {
    id: 'action',
    name: 'Action Sequence',
    prompt: 'High-energy action sequence, dynamic camera movements, fast cuts, intense atmosphere, dramatic sound design.',
    category: 'scene',
    icon: <Zap className="w-5 h-5" />,
    gradient: 'from-orange-600/20 to-red-600/20'
  }
]

export function TemplateSelector() {
  const { setPrompt, setPanelExpanded } = useGenerationStore()

  const handleSelectTemplate = (template: Template) => {
    setPrompt(template.prompt)
    setPanelExpanded(true)
  }

  return (
    <div className="p-6 overflow-y-auto h-full">
      <div className="mb-6">
        <h2 className="text-base font-semibold text-text-primary mb-1">Templates</h2>
        <p className="text-xs text-text-muted">Quick-start with professional prompt templates</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {defaultTemplates.map((template, i) => (
          <motion.button
            key={template.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            onClick={() => handleSelectTemplate(template)}
            className={cn(
              'group text-left p-4 rounded-xl border border-border-subtle',
              'bg-gradient-to-br', template.gradient,
              'hover:border-border hover:shadow-md',
              'transition-all duration-200 cursor-pointer'
            )}
          >
            <div className="flex items-center gap-2.5 mb-2.5">
              <div className="text-text-muted group-hover:text-accent transition-colors">
                {template.icon}
              </div>
              <span className="text-sm font-medium text-text-primary">{template.name}</span>
            </div>
            <p className="text-xs text-text-muted leading-relaxed line-clamp-3">
              {template.prompt}
            </p>
            <div className="mt-2.5">
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-bg-primary/50 text-text-muted uppercase tracking-wider">
                {template.category}
              </span>
            </div>
          </motion.button>
        ))}
      </div>
    </div>
  )
}
