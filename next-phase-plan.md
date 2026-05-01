# Manthan Studio — Next Phase Plan (Phases 4–5)

## Phase 4: Advanced Generation & Workflow Features

### Timeline Editor

- Visual timeline for chaining video segments
- Drag-and-drop reordering of generated clips
- Preview storyboard with thumbnails
- Export combined timeline as single video

### Video Extension Workflow

- "Continue" button on completed videos
- Chain up to 20 extensions (141 seconds max)
- Prompt continuation suggestions
- Visual timeline showing extended segments

### Version History

- Per-generation version tracking
- Side-by-side comparison view
- Prompt diff viewer (see what changed between versions)
- Rollback to previous generation params

### Advanced Style Controls

- Camera movement presets (pan, tilt, dolly, crane, steadicam, orbit)
- Lighting presets (golden hour, dramatic noir, studio, neon cyberpunk, moonlit)
- Lens type selector (wide 24mm, normal 50mm, telephoto 85mm, macro, anamorphic)
- Cinematic style presets with visual previews
- Motion strength slider
- Temporal consistency controls

### Prompt Enhancement System

- AI-powered prompt enhancement using Gemini
- Structured prompt builder with fields: Subject, Action, Environment, Camera, Audio
- Prompt versioning — save and compare prompt iterations
- Negative prompt library with common exclusions

### Collections & Organization

- Create named collections for related generations
- Star/favorite system
- Bulk operations (download, delete, move)
- Smart collections based on filters

---

## Phase 5: Multi-Provider & Plugin System

### Multi-Provider Orchestration

- Run same prompt across multiple providers simultaneously
- Compare outputs from different providers side-by-side
- Provider-specific quality scoring and cost tracking
- Automatic fallback to secondary provider on failure

### Plugin System Architecture

```typescript
interface ManthanPlugin {
  id: string
  name: string
  version: string

  // Provider plugins
  providers?: MediaProvider[]

  // UI plugins
  panels?: PanelPlugin[]

  // Processing plugins
  processors?: MediaProcessor[]
}
```

- Plugin manifest (JSON)
- Hot-loadable plugin directory
- Plugin marketplace (future cloud feature)

### New Provider Integrations

- **OpenAI Sora** (when API available)
- **Runway Gen-3**
- **Pika Labs**
- **ByteDance** (when accessible)
- **Stability AI** (image/video)

### Cloud Sync (Optional)

- Sync generation history across devices
- Cloud-stored API keys (with user consent)
- Shared collections for team collaboration
- Generation queue sync

### Collaboration Features

- Shared workspace concept
- Real-time generation status for team members
- Comment/annotate on generated media
- Approval workflow for commercial content

### Export & Integration

- Export to popular editing tools (DaVinci Resolve, Premiere Pro)
- Direct social media posting
- Batch export with naming conventions
- Metadata tagging for DAM systems

---

## Technical Debt for Future Phases

- [ ] Add comprehensive error handling and retry logic
- [ ] Implement proper WebSocket for real-time generation progress
- [ ] Add SQLite for more robust local storage (large history)
- [ ] Performance optimization for large media grids
- [ ] Implement proper media transcoding pipeline
- [ ] Add E2E testing with Playwright
- [ ] Set up CI/CD with GitHub Actions
- [ ] Code signing for distribution
