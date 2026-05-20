'use client'

import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { getCameras, getAllImages, getImagesForCamera, labelImage, storageUrl, annotatedImageUrl } from '@/lib/api'
import type { Camera, CameraImage, HumanLabel } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { AlertTriangle, CheckCircle2, Expand } from 'lucide-react'

const LABELS: HumanLabel[] = ['NORMAL', 'OBSTRUCTED', 'MOVED', 'OTHER']

const LABEL_COLORS: Record<HumanLabel, string> = {
  NORMAL: 'bg-green-100 text-green-800 border-green-300',
  OBSTRUCTED: 'bg-red-100 text-red-800 border-red-300',
  MOVED: 'bg-orange-100 text-orange-800 border-orange-300',
  OTHER: 'bg-gray-100 text-gray-600 border-gray-300',
}

const PAGE_SIZE = 20

type LabelFilter = 'ALL' | 'UNLABELED' | HumanLabel

function LabelChip({
  label,
  active,
  onClick,
}: {
  label: HumanLabel
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      className={`rounded border px-2 py-0.5 text-xs transition-all ${
        active
          ? LABEL_COLORS[label]
          : 'border-gray-200 bg-white text-gray-400 hover:border-gray-400 hover:text-gray-600'
      }`}
    >
      {label}
    </button>
  )
}


function ImageCard({
  img,
  onLabel,
  isLabeling,
  onOpen,
}: {
  img: CameraImage
  onLabel: (label: HumanLabel) => void
  isLabeling: boolean
  onOpen: () => void
}) {
  const url = storageUrl(img.image_path)
  const effectiveLabel = img.human_label ?? img.synthetic_label

  return (
    <div
      className={`overflow-hidden rounded-lg border bg-white transition-opacity ${isLabeling ? 'opacity-60' : ''}`}
    >
      <div
        className="group relative aspect-video cursor-pointer overflow-hidden bg-gray-100"
        onClick={onOpen}
      >
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="Camera frame" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-gray-400">
            No image
          </div>
        )}
        <div className="absolute right-2 top-2">
          {img.script_decision ? (
            <span className="rounded bg-red-500 px-1.5 py-0.5 text-xs text-white">ALERT</span>
          ) : (
            <span className="rounded bg-green-500 px-1.5 py-0.5 text-xs text-white">OK</span>
          )}
        </div>
        {img.synthetic_transform && (
          <div className="absolute bottom-2 left-2">
            <span className="rounded bg-black/60 px-1.5 py-0.5 text-xs text-white">
              {img.synthetic_transform}
            </span>
          </div>
        )}
        <div className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all group-hover:bg-black/20 group-hover:opacity-100">
          <Expand className="h-5 w-5 text-white drop-shadow" />
        </div>
      </div>
      <div className="space-y-2 p-2.5">
        <div className="flex items-center justify-between">
          <span className="tabular-nums text-xs text-gray-400">
            {new Date(img.timestamp).toLocaleDateString()}{' '}
            {new Date(img.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
          <span className="tabular-nums text-xs text-gray-500">{img.ssim_score.toFixed(2)}</span>
        </div>
        <div className="flex flex-wrap gap-1">
          {LABELS.map((l) => (
            <LabelChip
              key={l}
              label={l}
              active={effectiveLabel === l}
              onClick={() => onLabel(l)}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

function ImageDetailModal({
  img,
  cameras,
  onClose,
  onLabel,
  isLabeling,
}: {
  img: CameraImage
  cameras: Camera[]
  onClose: () => void
  onLabel: (label: HumanLabel) => void
  isLabeling: boolean
}) {
  const [annotatedLoaded, setAnnotatedLoaded] = useState(false)
  const effectiveLabel = img.human_label ?? img.synthetic_label
  const cameraName = cameras.find((c) => c.camera_id === img.camera_id)?.name ?? 'Unknown camera'

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-h-[95vh] w-[92vw] sm:max-w-[92vw] flex-col overflow-hidden p-0">
        {/* Header */}
        <DialogHeader className="flex-row items-center gap-3 border-b px-5 py-3">
          {img.script_decision ? (
            <Badge className="gap-1 bg-red-500 hover:bg-red-500">
              <AlertTriangle className="h-3 w-3" /> ALERT
            </Badge>
          ) : (
            <Badge className="gap-1 bg-green-600 hover:bg-green-600">
              <CheckCircle2 className="h-3 w-3" /> NORMAL
            </Badge>
          )}
          <DialogTitle className="text-sm font-medium text-gray-700">
            {cameraName} ·{' '}
            {new Date(img.timestamp).toLocaleDateString()}{' '}
            {new Date(img.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </DialogTitle>
        </DialogHeader>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto">
          {/* Captured + Reference side by side */}
          <div className="grid grid-cols-2 gap-3 p-4">
            <div className="space-y-1">
              <p className="text-xs font-medium text-gray-500">Captured</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={storageUrl(img.image_path)}
                alt="Captured"
                className="w-full rounded-md border bg-gray-50 object-contain"
              />
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium text-gray-500">Reference</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={storageUrl(img.base_image_path)}
                alt="Reference"
                className="w-full rounded-md border bg-gray-50 object-contain"
              />
            </div>
          </div>

          {/* Metrics row */}
          <div className="grid grid-cols-4 gap-3 border-t px-4 py-3">
            {[
              { label: 'SSIM', value: img.ssim_score, max: 1 },
              { label: 'Match Ratio', value: img.match_ratio, max: 1 },
              { label: 'Inliers', value: img.inliers, max: 100, integer: true },
              { label: 'Homo. Inlier Ratio', value: img.homography_inlier_ratio, max: 1 },
            ].map(({ label, value, max, integer }) => {
              const pct = Math.min((value / max) * 100, 100)
              const color = pct > 70 ? 'bg-green-500' : pct > 40 ? 'bg-yellow-500' : 'bg-red-400'
              return (
                <div key={label} className="space-y-1">
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>{label}</span>
                    <span className="tabular-nums font-medium text-gray-700">
                      {integer ? Math.round(value) : value.toFixed(3)}
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-gray-100">
                    <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </div>

          {/* Annotated matches */}
          <div className="border-t px-4 pb-4 pt-3">
            <p className="mb-2 text-xs font-medium text-gray-500">
              ORB Keypoint Matches
              <span className="ml-1.5 font-normal text-gray-400">(green = homography inliers)</span>
            </p>
            {!annotatedLoaded && <Skeleton className="h-56 w-full rounded-md" />}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={annotatedImageUrl(img.image_id)}
              alt="ORB matches"
              className={`w-full rounded-md border ${annotatedLoaded ? 'block' : 'hidden'}`}
              onLoad={() => setAnnotatedLoaded(true)}
            />
          </div>
        </div>

        {/* Label footer */}
        <div className={`flex items-center gap-2 border-t bg-gray-50 px-5 py-3 ${isLabeling ? 'opacity-60' : ''}`}>
          <span className="text-xs text-gray-500">Label:</span>
          {LABELS.map((l) => (
            <LabelChip
              key={l}
              label={l}
              active={effectiveLabel === l}
              onClick={() => onLabel(l)}
            />
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default function LabelPage() {
  const [cameraId, setCameraId] = useState('ALL')
  const [labelFilter, setLabelFilter] = useState<LabelFilter>('ALL')
  const [page, setPage] = useState(0)
  const [labelingId, setLabelingId] = useState<string | null>(null)
  const [selectedImg, setSelectedImg] = useState<CameraImage | null>(null)
  const qc = useQueryClient()

  const { data: cameras = [] } = useQuery({ queryKey: ['cameras'], queryFn: getCameras })

  const { data: images = [], isLoading } = useQuery({
    queryKey: ['images', cameraId],
    queryFn: () => (cameraId === 'ALL' ? getAllImages(200) : getImagesForCamera(cameraId, 200)),
  })

  const filtered = useMemo(() => {
    if (labelFilter === 'ALL') return images
    if (labelFilter === 'UNLABELED') return images.filter((i) => !i.human_label)
    return images.filter(
      (i) =>
        i.human_label === labelFilter ||
        (!i.human_label && i.synthetic_label === labelFilter),
    )
  }, [images, labelFilter])

  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)

  const mutation = useMutation({
    mutationFn: ({ id, label }: { id: string; label: HumanLabel }) => labelImage(id, label),
    onMutate: ({ id }) => setLabelingId(id),
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: ['images', cameraId] })
      qc.invalidateQueries({ queryKey: ['metrics'] })
      // keep modal open with updated data
      if (selectedImg && selectedImg.image_id === updated.image_id) {
        setSelectedImg(updated)
      }
      toast.success('Label saved')
    },
    onError: (err: Error) => toast.error(err.message),
    onSettled: () => setLabelingId(null),
  })

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Label</h1>
        <p className="mt-0.5 text-sm text-gray-500">Annotate images with ground-truth labels</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">Camera:</span>
          <Select
            value={cameraId}
            onValueChange={(v) => {
              if (v) { setCameraId(v); setPage(0) }
            }}
          >
            <SelectTrigger className="w-40">
              <SelectValue>
                {cameraId === 'ALL'
                  ? 'All cameras'
                  : (cameras.find((c) => c.camera_id === cameraId)?.name ?? cameraId)}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All cameras</SelectItem>
              {cameras.map((c) => (
                <SelectItem key={c.camera_id} value={c.camera_id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">Filter:</span>
          <Select
            value={labelFilter}
            onValueChange={(v) => {
              if (v) { setLabelFilter(v as LabelFilter); setPage(0) }
            }}
          >
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All</SelectItem>
              <SelectItem value="UNLABELED">Unlabeled</SelectItem>
              {LABELS.map((l) => (
                <SelectItem key={l} value={l}>
                  {l}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <span className="ml-auto text-sm text-gray-400">
          {filtered.length} image{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {[...Array(8)].map((_, i) => (
            <Skeleton key={i} className="aspect-video rounded-lg" />
          ))}
        </div>
      ) : paginated.length === 0 ? (
        <div className="py-20 text-center text-sm text-gray-400">
          No images match the current filters
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {paginated.map((img) => (
            <ImageCard
              key={img.image_id}
              img={img}
              isLabeling={labelingId === img.image_id}
              onLabel={(label) => mutation.mutate({ id: img.image_id, label })}
              onOpen={() => setSelectedImg(img)}
            />
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => p - 1)}
            disabled={page === 0}
          >
            Previous
          </Button>
          <span className="text-sm text-gray-500">
            Page {page + 1} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => p + 1)}
            disabled={page >= totalPages - 1}
          >
            Next
          </Button>
        </div>
      )}

      {selectedImg && (
        <ImageDetailModal
          img={selectedImg}
          cameras={cameras}
          onClose={() => setSelectedImg(null)}
          onLabel={(label) => mutation.mutate({ id: selectedImg.image_id, label })}
          isLabeling={labelingId === selectedImg.image_id}
        />
      )}
    </div>
  )
}
