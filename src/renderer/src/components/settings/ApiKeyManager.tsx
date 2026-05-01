import { type JSX, useMemo, useState } from 'react'
import {
  Check,
  Eye,
  EyeOff,
  Image as ImageIcon,
  Loader2,
  Music,
  Settings2,
  Video
} from 'lucide-react'
import { useAppStore } from '../../stores/app-store'
import { useModelStore } from '../../stores/model-store'
import { useProviderStore } from '../../stores/provider-store'
import { getKeyGroups, MODEL_REGISTRY, type ContentType } from '../../lib/model-capabilities'
import { cn } from '../../lib/utils'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog'
import { Input } from '../ui/input'
import { Button } from '../ui/button'

type SettingsTab = 'models' | 'keys'

const contentTypeMeta: Record<ContentType, { label: string; icon: typeof ImageIcon }> = {
  image: { label: 'Image Models', icon: ImageIcon },
  video: { label: 'Video Models', icon: Video },
  audio: { label: 'Audio Models', icon: Music }
}

export function ApiKeyManager(): JSX.Element {
  const { closeModal } = useAppStore()
  const { enabledModelIds, toggleModel } = useModelStore()
  const { providers, updateProviderStatus, fetchProviders } = useProviderStore()
  const [activeTab, setActiveTab] = useState<SettingsTab>('models')
  const [groupValues, setGroupValues] = useState<Record<string, string>>({})
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({})
  const [testingGroups, setTestingGroups] = useState<Record<string, boolean>>({})
  const [savingGroups, setSavingGroups] = useState<Record<string, boolean>>({})

  const modelsByType = useMemo(
    () =>
      (['video', 'image', 'audio'] as ContentType[]).map((type) => ({
        type,
        models: MODEL_REGISTRY.filter((model) => model.contentType === type)
      })),
    []
  )
  const keyGroups = useMemo(() => getKeyGroups(), [])

  const setGroupValue = (groupId: string, value: string): void => {
    setGroupValues((state) => ({ ...state, [groupId]: value }))
  }

  const setGroupTesting = (groupId: string, value: boolean): void => {
    setTestingGroups((state) => ({ ...state, [groupId]: value }))
  }

  const setGroupSaving = (groupId: string, value: boolean): void => {
    setSavingGroups((state) => ({ ...state, [groupId]: value }))
  }

  const toggleShowKey = (groupId: string): void => {
    setShowKeys((state) => ({ ...state, [groupId]: !state[groupId] }))
  }

  const syncProviderStatuses = (
    providerIds: string[],
    status: 'connected' | 'failed' | 'testing',
    message?: string
  ): void => {
    providerIds.forEach((providerId) => updateProviderStatus(providerId, status, message))
  }

  return (
    <Dialog
      open={true}
      onOpenChange={(open) => {
        if (!open) closeModal()
      }}
    >
      <DialogContent className="glass-strong w-[92vw] max-w-4xl gap-0 border-border-subtle bg-bg-secondary p-0 shadow-float sm:rounded-2xl">
        <DialogHeader className="border-b border-border-subtle px-6 py-4">
          <DialogTitle className="text-sm font-semibold text-text-primary">Settings</DialogTitle>
          <DialogDescription className="mt-0.5 text-xs text-text-muted">
            Control which models appear in the prompt bar and manage shared provider keys.
          </DialogDescription>
        </DialogHeader>

        <div className="border-b border-border-subtle px-4 py-3">
          <div className="inline-flex rounded-full bg-bg-elevated/60 p-1">
            {(
              [
                { id: 'models', label: 'Models', icon: Settings2 },
                { id: 'keys', label: 'Keys', icon: Check }
              ] as const
            ).map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setActiveTab(id)}
                className={cn(
                  'flex h-10 items-center gap-2 rounded-full px-4 text-sm font-medium transition-all',
                  activeTab === id
                    ? 'bg-white text-black'
                    : 'text-text-secondary hover:text-text-primary'
                )}
              >
                <Icon className="h-4 w-4" />
                <span>{label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="max-h-[65vh] overflow-y-auto p-4">
          {activeTab === 'models' ? (
            <div className="space-y-6">
              {modelsByType.map(({ type, models }) => {
                const Icon = contentTypeMeta[type].icon

                return (
                  <section key={type} className="space-y-3">
                    <div className="flex items-center gap-2 text-sm font-semibold text-text-primary">
                      <Icon className="h-4 w-4 text-text-muted" />
                      <span>{contentTypeMeta[type].label}</span>
                    </div>
                    <div className="space-y-2">
                      {models.map((model) => {
                        const enabled = enabledModelIds.has(model.id)

                        return (
                          <button
                            key={model.id}
                            type="button"
                            onClick={() => void toggleModel(model.id)}
                            className={cn(
                              'w-full rounded-2xl border p-4 text-left transition-all',
                              enabled
                                ? 'border-accent/30 bg-accent-soft'
                                : 'border-border-subtle bg-bg-elevated/30 hover:bg-bg-hover'
                            )}
                          >
                            <div className="flex items-start gap-3">
                              <div
                                className={cn(
                                  'mt-0.5 flex h-5 w-5 items-center justify-center rounded-md border text-[10px]',
                                  enabled
                                    ? 'border-transparent bg-white text-black'
                                    : 'border-border-subtle text-transparent'
                                )}
                              >
                                ✓
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="text-sm font-semibold text-text-primary">
                                    {model.name}
                                  </span>
                                  <span className="rounded-full bg-bg-secondary/70 px-2 py-0.5 text-[10px] text-text-muted">
                                    {model.provider}
                                  </span>
                                </div>
                                <p className="mt-1 text-xs leading-5 text-text-muted">
                                  {model.description}
                                </p>
                              </div>
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  </section>
                )
              })}
            </div>
          ) : (
            <div className="space-y-4">
              {keyGroups.map((group) => {
                const groupModels = MODEL_REGISTRY.filter((model) =>
                  group.modelIds.includes(model.id)
                )
                const groupProviders = providers.filter((provider) =>
                  group.providerIds.includes(provider.id)
                )
                const groupStatus = groupProviders.some(
                  (provider) => provider.connectionStatus === 'testing'
                )
                  ? 'testing'
                  : groupProviders.every(
                        (provider) =>
                          provider.connectionStatus === 'connected' || provider.initialized
                      )
                    ? 'connected'
                    : groupProviders.some((provider) => provider.connectionStatus === 'failed')
                      ? 'failed'
                      : 'unknown'
                const groupMessage =
                  groupProviders.find((provider) => provider.message)?.message ??
                  (groupStatus === 'connected' ? 'Ready' : 'Shared key required')
                const value = groupValues[group.id] ?? ''
                const testing = Boolean(testingGroups[group.id])
                const saving = Boolean(savingGroups[group.id])

                return (
                  <div
                    key={group.id}
                    className="rounded-2xl border border-border-subtle bg-bg-elevated/30 p-4"
                  >
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-text-primary">
                            {group.label}
                          </span>
                          <div
                            className={cn(
                              'status-dot',
                              groupStatus === 'connected'
                                ? 'status-dot--connected'
                                : groupStatus === 'testing'
                                  ? 'status-dot--generating'
                                  : 'status-dot--error'
                            )}
                          />
                        </div>
                        <p className="mt-1 text-[11px] text-text-muted">
                          Used by: {groupModels.map((model) => model.name).join(', ')}
                        </p>
                        <p className="mt-1 text-[11px] text-text-muted">{groupMessage}</p>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Input
                          type={showKeys[group.id] ? 'text' : 'password'}
                          value={value}
                          onChange={(event) => setGroupValue(group.id, event.target.value)}
                          placeholder={
                            groupProviders.every((provider) => provider.initialized)
                              ? '••••••••••••••••'
                              : 'Enter shared API key...'
                          }
                          className="h-10 rounded-xl border border-border-subtle bg-bg-input pr-10 text-xs text-text-primary placeholder:text-text-muted"
                        />
                        <button
                          type="button"
                          onClick={() => toggleShowKey(group.id)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted transition-colors hover:text-text-secondary"
                        >
                          {showKeys[group.id] ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </button>
                      </div>

                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={!value.trim() || testing}
                        className="h-10 rounded-xl px-4 text-xs"
                        onClick={async () => {
                          if (!value.trim()) return
                          setGroupTesting(group.id, true)
                          syncProviderStatuses(
                            group.providerIds,
                            'testing',
                            'Testing shared key...'
                          )

                          try {
                            const result = await window.manthan.testGroupKey(group.id, value.trim())
                            syncProviderStatuses(
                              group.providerIds,
                              result.connected ? 'connected' : 'failed',
                              result.message
                            )
                          } catch {
                            syncProviderStatuses(group.providerIds, 'failed', 'Test failed')
                          } finally {
                            setGroupTesting(group.id, false)
                          }
                        }}
                      >
                        {testing ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}
                        Test
                      </Button>

                      <Button
                        variant="default"
                        size="sm"
                        disabled={!value.trim() || saving}
                        className="h-10 rounded-xl px-4 text-xs"
                        onClick={async () => {
                          if (!value.trim()) return
                          setGroupSaving(group.id, true)

                          try {
                            const result = await window.manthan.saveGroupKey(group.id, value.trim())
                            if (result.success) {
                              syncProviderStatuses(
                                group.providerIds,
                                'connected',
                                'Shared key saved successfully'
                              )
                              await fetchProviders()
                              setGroupValue(group.id, '')
                            } else {
                              syncProviderStatuses(
                                group.providerIds,
                                'failed',
                                result.error || 'Save failed'
                              )
                            }
                          } catch {
                            syncProviderStatuses(group.providerIds, 'failed', 'Save failed')
                          } finally {
                            setGroupSaving(group.id, false)
                          }
                        }}
                      >
                        {saving ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}
                        Save
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="border-t border-border-subtle px-6 py-3">
          <p className="text-[10px] leading-relaxed text-text-muted">
            Keys are encrypted locally and only used to talk directly to the selected provider APIs.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
