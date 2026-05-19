'use client'

import { useState, useCallback, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { getCameras, createCamera, updateCamera, deleteCamera, uploadBaseImage, storageUrl } from '@/lib/api'
import type { Camera } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Camera as CameraIcon, ImagePlus, Pencil, Plus, Trash2, X } from 'lucide-react'

type PendingFile = { file: File; previewUrl: string }
type Mode = { type: 'create' } | { type: 'edit'; camera: Camera } | null

export default function CamerasPage() {
  const [mode, setMode] = useState<Mode>(null)
  const [deleteTarget, setDeleteTarget] = useState<Camera | null>(null)
  const [name, setName] = useState('')
  const [existingPaths, setExistingPaths] = useState<string[]>([])
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([])
  const [dragging, setDragging] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const qc = useQueryClient()

  const { data: cameras = [], isLoading } = useQuery({
    queryKey: ['cameras'],
    queryFn: getCameras,
  })

  const openCreate = () => {
    setMode({ type: 'create' })
    setName('')
    setExistingPaths([])
    setPendingFiles([])
  }

  const openEdit = (c: Camera) => {
    setMode({ type: 'edit', camera: c })
    setName(c.name)
    setExistingPaths(c.base_image_paths)
    setPendingFiles([])
  }

  const closeDialog = () => {
    pendingFiles.forEach((pf) => URL.revokeObjectURL(pf.previewUrl))
    setMode(null)
  }

  const addFiles = (files: FileList | File[]) => {
    const newItems: PendingFile[] = Array.from(files)
      .filter((f) => f.type.startsWith('image/'))
      .map((f) => ({ file: f, previewUrl: URL.createObjectURL(f) }))
    setPendingFiles((prev) => [...prev, ...newItems])
  }

  const removeExisting = (path: string) =>
    setExistingPaths((prev) => prev.filter((p) => p !== path))

  const removePending = (previewUrl: string) => {
    setPendingFiles((prev) => {
      const item = prev.find((p) => p.previewUrl === previewUrl)
      if (item) URL.revokeObjectURL(item.previewUrl)
      return prev.filter((p) => p.previewUrl !== previewUrl)
    })
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    addFiles(e.dataTransfer.files)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const saveMutation = useMutation({
    mutationFn: async () => {
      const uploadedPaths = await Promise.all(pendingFiles.map((pf) => uploadBaseImage(pf.file)))
      const allPaths = [...existingPaths, ...uploadedPaths]
      if (mode?.type === 'create') return createCamera({ name, base_image_paths: allPaths })
      return updateCamera((mode as { type: 'edit'; camera: Camera }).camera.camera_id, {
        name,
        base_image_paths: allPaths,
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cameras'] })
      toast.success(mode?.type === 'create' ? 'Camera created' : 'Camera updated')
      closeDialog()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteCamera(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cameras'] })
      toast.success('Camera deleted')
      setDeleteTarget(null)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const totalImages = existingPaths.length + pendingFiles.length

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Cameras</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            Manage camera configurations and reference images
          </p>
        </div>
        <Button onClick={openCreate} size="sm">
          <Plus className="mr-1.5 h-4 w-4" /> Add Camera
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      ) : cameras.length === 0 ? (
        <div className="space-y-3 py-20 text-center">
          <CameraIcon className="mx-auto h-10 w-10 text-gray-200" />
          <p className="text-sm text-gray-400">No cameras yet. Add one to get started.</p>
          <Button onClick={openCreate} size="sm" variant="outline">
            Add first camera
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {cameras.map((c) => {
            const thumbUrl = c.base_image_paths[0] ? storageUrl(c.base_image_paths[0]) : null
            return (
              <Card key={c.camera_id}>
                <CardContent className="pb-4 pt-4">
                  <div className="flex items-center gap-4">
                    {thumbUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={thumbUrl}
                        alt="Base image"
                        className="h-14 w-20 shrink-0 rounded-md border object-cover bg-gray-50"
                      />
                    ) : (
                      <div className="flex h-14 w-20 shrink-0 items-center justify-center rounded-md border bg-gray-50">
                        <CameraIcon className="h-5 w-5 text-gray-300" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{c.name}</span>
                        <Badge variant="outline" className="text-xs">
                          {c.base_image_paths.length} base image
                          {c.base_image_paths.length !== 1 ? 's' : ''}
                        </Badge>
                      </div>
                      <p className="text-xs text-gray-400">
                        Added {new Date(c.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => openEdit(c)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-red-500 hover:bg-red-50 hover:text-red-600"
                        onClick={() => setDeleteTarget(c)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Create / Edit dialog */}
      <Dialog open={mode !== null} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{mode?.type === 'create' ? 'Add Camera' : 'Edit Camera'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Entrance Cam"
              />
            </div>

            <div className="space-y-1.5">
              <Label>
                Base images
                {totalImages > 0 && (
                  <span className="ml-1.5 text-xs font-normal text-gray-400">
                    ({totalImages})
                  </span>
                )}
              </Label>

              {/* Thumbnail grid */}
              {totalImages > 0 && (
                <div className="flex flex-wrap gap-2">
                  {existingPaths.map((path) => (
                    <div key={path} className="group relative">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={storageUrl(path)}
                        alt="Base image"
                        className="h-16 w-24 rounded-md border object-cover bg-gray-50"
                      />
                      <button
                        type="button"
                        onClick={() => removeExisting(path)}
                        className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-white opacity-0 transition-opacity group-hover:opacity-100"
                      >
                        <X className="h-2.5 w-2.5" />
                      </button>
                    </div>
                  ))}
                  {pendingFiles.map((pf) => (
                    <div key={pf.previewUrl} className="group relative">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={pf.previewUrl}
                        alt="New base image"
                        className="h-16 w-24 rounded-md border object-cover bg-gray-50"
                      />
                      <div className="absolute bottom-0 left-0 right-0 rounded-b-md bg-blue-500/70 py-0.5 text-center text-[10px] text-white">
                        new
                      </div>
                      <button
                        type="button"
                        onClick={() => removePending(pf.previewUrl)}
                        className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-white opacity-0 transition-opacity group-hover:opacity-100"
                      >
                        <X className="h-2.5 w-2.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Drop zone */}
              <div
                onClick={() => fileRef.current?.click()}
                onDrop={onDrop}
                onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
                onDragLeave={() => setDragging(false)}
                className={`flex cursor-pointer flex-col items-center gap-1.5 rounded-lg border-2 border-dashed py-5 text-sm transition-colors ${
                  dragging
                    ? 'border-blue-400 bg-blue-50'
                    : 'border-gray-200 text-gray-400 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                <ImagePlus className="h-5 w-5" />
                <span>Drop images here or click to browse</span>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => e.target.files && addFiles(e.target.files)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>
              Cancel
            </Button>
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={!name.trim() || saveMutation.isPending}
            >
              {saveMutation.isPending ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete camera?</DialogTitle>
          </DialogHeader>
          <p className="py-2 text-sm text-gray-500">
            This will permanently delete{' '}
            <span className="font-medium text-gray-900">{deleteTarget?.name}</span> and all its
            associated images.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.camera_id)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
