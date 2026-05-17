'use client'

import { useState, useRef, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Upload, CheckCircle2, AlertTriangle } from 'lucide-react'
import { getCameras, getImagesForCamera, compareImage, storageUrl } from '@/lib/api'
import type { CameraImage } from '@/lib/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'

function DecisionBadge({ decision }: { decision: boolean }) {
  if (decision) {
    return (
      <Badge className="gap-1 bg-red-500 hover:bg-red-500">
        <AlertTriangle className="h-3 w-3" /> ALERT
      </Badge>
    )
  }
  return (
    <Badge className="gap-1 bg-green-600 hover:bg-green-600">
      <CheckCircle2 className="h-3 w-3" /> NORMAL
    </Badge>
  )
}

function MetricRow({
  label,
  value,
  max = 1,
  format,
}: {
  label: string
  value: number
  max?: number
  format?: (v: number) => string
}) {
  const pct = Math.min((value / max) * 100, 100)
  const display = format ? format(value) : value.toFixed(3)
  const color = pct > 70 ? 'bg-green-500' : pct > 40 ? 'bg-yellow-500' : 'bg-red-400'
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-gray-600">
        <span>{label}</span>
        <span className="font-medium tabular-nums">{display}</span>
      </div>
      <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function ImagePreview({ path, label }: { path: string; label: string }) {
  const url = storageUrl(path)
  return (
    <div>
      <p className="mb-1 text-xs text-gray-500">{label}</p>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={label}
          className="w-full rounded-md border object-cover aspect-video bg-gray-50"
        />
      ) : (
        <div className="flex aspect-video w-full items-center justify-center rounded-md border bg-gray-100 text-xs text-gray-400">
          Not available
        </div>
      )}
    </div>
  )
}

export default function ComparePage() {
  const [cameraId, setCameraId] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [result, setResult] = useState<CameraImage | null>(null)
  const [dragging, setDragging] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const qc = useQueryClient()

  const { data: cameras = [], isLoading: loadingCameras } = useQuery({
    queryKey: ['cameras'],
    queryFn: getCameras,
  })

  const { data: history = [], isLoading: loadingHistory } = useQuery({
    queryKey: ['camera-images', cameraId],
    queryFn: () => getImagesForCamera(cameraId, 10),
    enabled: !!cameraId,
  })

  const mutation = useMutation({
    mutationFn: () => compareImage(cameraId, file!),
    onSuccess: (data) => {
      setResult(data)
      qc.invalidateQueries({ queryKey: ['camera-images', cameraId] })
      toast.success('Comparison complete')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const handleFile = (f: File) => {
    setFile(f)
    setResult(null)
    const reader = new FileReader()
    reader.onload = (e) => setPreview(e.target?.result as string)
    reader.readAsDataURL(f)
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) handleFile(f)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Compare</h1>
        <p className="mt-0.5 text-sm text-gray-500">
          Upload a camera frame to detect obstructions or view changes
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left: upload */}
        <div className="space-y-4 lg:col-span-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Camera</label>
            {loadingCameras ? (
              <Skeleton className="h-9 w-full" />
            ) : cameras.length === 0 ? (
              <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-600">
                No cameras configured.{' '}
                <a href="/cameras" className="font-medium underline">
                  Add one
                </a>{' '}
                to get started.
              </p>
            ) : (
              <Select value={cameraId} onValueChange={(v) => v && setCameraId(v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a camera…" />
                </SelectTrigger>
                <SelectContent>
                  {cameras.map((c) => (
                    <SelectItem key={c.camera_id} value={c.camera_id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Image</label>
            <div
              onClick={() => fileRef.current?.click()}
              onDrop={onDrop}
              onDragOver={(e) => {
                e.preventDefault()
                setDragging(true)
              }}
              onDragLeave={() => setDragging(false)}
              className={`cursor-pointer rounded-lg border-2 border-dashed transition-colors ${
                dragging
                  ? 'border-blue-400 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              {preview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={preview}
                  alt="Preview"
                  className="max-h-72 w-full rounded-lg object-contain"
                />
              ) : (
                <div className="flex flex-col items-center gap-2 py-12 text-gray-400">
                  <Upload className="h-8 w-8" />
                  <span className="text-sm">Drop image here or click to browse</span>
                </div>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) handleFile(f)
              }}
            />
          </div>

          <Button
            onClick={() => mutation.mutate()}
            disabled={!cameraId || !file || mutation.isPending}
            className="w-full"
          >
            {mutation.isPending ? 'Comparing…' : 'Compare'}
          </Button>
        </div>

        {/* Right: result */}
        <div className="space-y-4">
          {result ? (
            <>
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Decision</CardTitle>
                    <DecisionBadge decision={result.script_decision} />
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <MetricRow label="SSIM Score" value={result.ssim_score} />
                  <MetricRow label="Match Ratio" value={result.match_ratio} />
                  <MetricRow
                    label="Inliers"
                    value={result.inliers}
                    max={100}
                    format={(v) => String(Math.round(v))}
                  />
                </CardContent>
              </Card>
              <div className="space-y-3">
                <ImagePreview path={result.image_path} label="Captured" />
                <ImagePreview path={result.base_image_path} label="Reference" />
              </div>
            </>
          ) : (
            <div className="flex h-full min-h-40 items-center justify-center rounded-lg border border-dashed border-gray-200 p-8 text-center text-sm text-gray-400">
              Result will appear here
            </div>
          )}
        </div>
      </div>

      {/* Recent history */}
      {cameraId && (
        <>
          <Separator />
          <div>
            <h2 className="mb-3 text-sm font-medium text-gray-700">Recent comparisons</h2>
            {loadingHistory ? (
              <div className="space-y-2">
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : history.length === 0 ? (
              <p className="text-sm text-gray-400">No comparisons yet for this camera</p>
            ) : (
              <div className="overflow-hidden rounded-md border">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                    <tr>
                      <th className="px-4 py-2 text-left">Time</th>
                      <th className="px-4 py-2 text-left">Decision</th>
                      <th className="px-4 py-2 text-right">SSIM</th>
                      <th className="px-4 py-2 text-right">Match ratio</th>
                      <th className="px-4 py-2 text-left">Label</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {history.map((img) => (
                      <tr key={img.image_id} className="hover:bg-gray-50">
                        <td className="px-4 py-2 tabular-nums text-gray-500">
                          {new Date(img.timestamp).toLocaleTimeString()}
                        </td>
                        <td className="px-4 py-2">
                          <DecisionBadge decision={img.script_decision} />
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums">
                          {img.ssim_score.toFixed(3)}
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums">
                          {img.match_ratio.toFixed(3)}
                        </td>
                        <td className="px-4 py-2">
                          {img.human_label ? (
                            <span className="text-xs font-medium text-gray-600">
                              {img.human_label}
                            </span>
                          ) : (
                            <span className="text-xs text-gray-300">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
