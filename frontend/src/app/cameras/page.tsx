'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { getCameras, createCamera, updateCamera, deleteCamera } from '@/lib/api'
import type { Camera } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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
import { Camera as CameraIcon, Pencil, Plus, Trash2 } from 'lucide-react'

type Mode = { type: 'create' } | { type: 'edit'; camera: Camera } | null

export default function CamerasPage() {
  const [mode, setMode] = useState<Mode>(null)
  const [deleteTarget, setDeleteTarget] = useState<Camera | null>(null)
  const [name, setName] = useState('')
  const [paths, setPaths] = useState('')
  const qc = useQueryClient()

  const { data: cameras = [], isLoading } = useQuery({
    queryKey: ['cameras'],
    queryFn: getCameras,
  })

  const openCreate = () => {
    setMode({ type: 'create' })
    setName('')
    setPaths('')
  }
  const openEdit = (c: Camera) => {
    setMode({ type: 'edit', camera: c })
    setName(c.name)
    setPaths(c.base_image_paths.join('\n'))
  }

  const saveMutation = useMutation({
    mutationFn: () => {
      const pathsList = paths
        .split('\n')
        .map((p) => p.trim())
        .filter(Boolean)
      if (mode?.type === 'create') return createCamera({ name, base_image_paths: pathsList })
      return updateCamera((mode as { type: 'edit'; camera: Camera }).camera.camera_id, {
        name,
        base_image_paths: pathsList,
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cameras'] })
      toast.success(mode?.type === 'create' ? 'Camera created' : 'Camera updated')
      setMode(null)
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
          {cameras.map((c) => (
            <Card key={c.camera_id}>
              <CardContent className="pb-4 pt-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                      <CameraIcon className="h-4 w-4 shrink-0 text-gray-400" />
                      <span className="text-sm font-medium">{c.name}</span>
                      <Badge variant="outline" className="text-xs">
                        {c.base_image_paths.length} base image
                        {c.base_image_paths.length !== 1 ? 's' : ''}
                      </Badge>
                    </div>
                    {c.base_image_paths.length > 0 && (
                      <p className="truncate pl-6 font-mono text-xs text-gray-400">
                        {c.base_image_paths[0]}
                        {c.base_image_paths.length > 1 &&
                          ` +${c.base_image_paths.length - 1} more`}
                      </p>
                    )}
                    <p className="pl-6 text-xs text-gray-400">
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
          ))}
        </div>
      )}

      {/* Create / Edit dialog */}
      <Dialog open={mode !== null} onOpenChange={(open) => !open && setMode(null)}>
        <DialogContent>
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
              <Label>Base image paths</Label>
              <Textarea
                value={paths}
                onChange={(e) => setPaths(e.target.value)}
                placeholder="/app/storage/base/reference.png"
                rows={4}
                className="font-mono text-xs"
              />
              <p className="text-xs text-gray-400">
                One server-side file path per line. These must be accessible on the backend
                filesystem.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMode(null)}>
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
