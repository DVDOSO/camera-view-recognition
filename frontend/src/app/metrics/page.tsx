'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { AlertTriangle, CheckCircle2, Sparkles } from 'lucide-react'
import {
  getMetrics,
  getThresholds,
  getActiveThreshold,
  tuneThresholds,
  generateSynthetic,
  clearSynthetic,
  getCameras,
} from '@/lib/api'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Separator } from '@/components/ui/separator'
import { Alert, AlertDescription } from '@/components/ui/alert'

function pct(v: number | null) {
  return v == null ? '—' : `${(v * 100).toFixed(1)}%`
}

function StatCard({
  label,
  value,
  description,
}: {
  label: string
  value: string | number
  description?: string
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{label}</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="tabular-nums text-2xl font-semibold">{value}</p>
        {description && <p className="mt-1 text-xs text-gray-400">{description}</p>}
      </CardContent>
    </Card>
  )
}

export default function MetricsPage() {
  const [genCamera, setGenCamera] = useState('')
  const [genN, setGenN] = useState('100')
  const [genSeed, setGenSeed] = useState('0')
  const qc = useQueryClient()

  const { data: metrics, isLoading: loadingMetrics } = useQuery({
    queryKey: ['metrics'],
    queryFn: getMetrics,
  })
  const { data: thresholds = [], isLoading: loadingThresholds } = useQuery({
    queryKey: ['thresholds'],
    queryFn: getThresholds,
  })
  const { data: active, isLoading: loadingActive } = useQuery({
    queryKey: ['active-threshold'],
    queryFn: getActiveThreshold,
  })
  const { data: cameras = [] } = useQuery({ queryKey: ['cameras'], queryFn: getCameras })

  const tuneMutation = useMutation({
    mutationFn: tuneThresholds,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['thresholds'] })
      qc.invalidateQueries({ queryKey: ['active-threshold'] })
      toast.success('Thresholds tuned successfully')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const generateMutation = useMutation({
    mutationFn: () =>
      generateSynthetic({ camera_id: genCamera, n: Number(genN), seed: Number(genSeed) }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['images'] })
      qc.invalidateQueries({ queryKey: ['metrics'] })
      toast.success(`Generated ${data.generated} synthetic images`)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const clearMutation = useMutation({
    mutationFn: clearSynthetic,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['images'] })
      qc.invalidateQueries({ queryKey: ['metrics'] })
      toast.success('Synthetic images cleared')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <div className="mx-auto max-w-5xl space-y-8 p-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Metrics</h1>
        <p className="mt-0.5 text-sm text-gray-500">Model performance and threshold management</p>
      </div>

      {/* Stats overview */}
      {loadingMetrics ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      ) : metrics ? (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label="F1 Score" value={pct(metrics.f1)} description="Harmonic mean of P/R" />
            <StatCard label="Precision" value={pct(metrics.precision)} />
            <StatCard label="Recall" value={pct(metrics.recall)} />
            <StatCard label="Labeled Images" value={metrics.total_labeled} />
          </div>

          {/* Confusion matrix */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Confusion Matrix</CardTitle>
              <CardDescription>Positive class: OBSTRUCTED or MOVED</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid max-w-xs grid-cols-2 gap-3">
                {[
                  {
                    label: 'True Positives',
                    value: metrics.true_positives,
                    cls: 'bg-green-50 border-green-200 text-green-700',
                    num: 'text-green-700',
                  },
                  {
                    label: 'False Positives',
                    value: metrics.false_positives,
                    cls: 'bg-red-50 border-red-200',
                    num: 'text-red-700',
                  },
                  {
                    label: 'False Negatives',
                    value: metrics.false_negatives,
                    cls: 'bg-orange-50 border-orange-200',
                    num: 'text-orange-700',
                  },
                  {
                    label: 'True Negatives',
                    value: metrics.true_negatives,
                    cls: 'bg-blue-50 border-blue-200',
                    num: 'text-blue-700',
                  },
                ].map(({ label, value, cls, num }) => (
                  <div key={label} className={`rounded-lg border p-3 text-center ${cls}`}>
                    <p className="text-xs font-medium opacity-80">{label}</p>
                    <p className={`tabular-nums text-2xl font-bold ${num}`}>{value}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      ) : null}

      <Separator />

      {/* Threshold section */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Active Threshold</CardTitle>
            <CardDescription>Values currently used for detection decisions</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingActive ? (
              <div className="space-y-2">
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-5 w-full" />
                ))}
              </div>
            ) : active ? (
              <dl className="space-y-2 text-sm">
                {(
                  [
                    ['SSIM min', active.ssim_min.toFixed(3)],
                    ['Match ratio min', active.match_ratio_min.toFixed(3)],
                    ['Inliers min', String(active.inliers_min)],
                  ] as [string, string][]
                ).map(([label, value]) => (
                  <div key={label} className="flex justify-between">
                    <dt className="text-gray-500">{label}</dt>
                    <dd className="font-medium tabular-nums">{value}</dd>
                  </div>
                ))}
                {active.f1 != null && (
                  <div className="flex justify-between border-t pt-2">
                    <dt className="text-gray-500">F1 when tuned</dt>
                    <dd className="font-medium tabular-nums">{pct(active.f1)}</dd>
                  </div>
                )}
              </dl>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Auto-Tune</CardTitle>
            <CardDescription>
              Grid search for the best threshold combination (requires ≥ 30 labeled samples)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {metrics && metrics.total_labeled < 30 && (
              <Alert className="border-amber-200 bg-amber-50">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                <AlertDescription className="text-xs text-amber-700">
                  Need {30 - metrics.total_labeled} more labeled image
                  {30 - metrics.total_labeled !== 1 ? 's' : ''} before tuning
                </AlertDescription>
              </Alert>
            )}
            <Button
              onClick={() => tuneMutation.mutate()}
              disabled={tuneMutation.isPending || (metrics?.total_labeled ?? 0) < 30}
              className="w-full"
            >
              {tuneMutation.isPending ? 'Tuning…' : 'Run Auto-Tune'}
            </Button>
            {tuneMutation.data && (
              <div className="flex items-center gap-2 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-700">
                <CheckCircle2 className="h-3.5 w-3.5" />
                New threshold activated — F1: {pct(tuneMutation.data.f1)}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Separator />

      {/* Synthetic data */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-purple-500" />
            <CardTitle className="text-base">Synthetic Training Data</CardTitle>
          </div>
          <CardDescription>
            Generate labeled images from a reference using 16 transform functions
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Camera</Label>
              <Select value={genCamera} onValueChange={(v) => v && setGenCamera(v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select camera…" />
                </SelectTrigger>
                <SelectContent>
                  {cameras.map((c) => (
                    <SelectItem key={c.camera_id} value={c.camera_id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Count (1–1000)</Label>
              <Input
                type="number"
                min={1}
                max={1000}
                value={genN}
                onChange={(e) => setGenN(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Random seed</Label>
              <Input
                type="number"
                value={genSeed}
                onChange={(e) => setGenSeed(e.target.value)}
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => generateMutation.mutate()}
              disabled={!genCamera || generateMutation.isPending}
            >
              {generateMutation.isPending ? 'Generating…' : 'Generate'}
            </Button>
            <Button
              variant="outline"
              onClick={() => clearMutation.mutate()}
              disabled={clearMutation.isPending}
              className="border-red-200 text-red-600 hover:bg-red-50"
            >
              {clearMutation.isPending ? 'Clearing…' : 'Clear Synthetic'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* Threshold history */}
      <div>
        <h2 className="mb-4 text-base font-medium text-gray-900">Threshold History</h2>
        {loadingThresholds ? (
          <Skeleton className="h-40 w-full" />
        ) : thresholds.length === 0 ? (
          <p className="text-sm text-gray-400">No thresholds yet</p>
        ) : (
          <div className="overflow-hidden rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">SSIM min</TableHead>
                  <TableHead className="text-right">Match ratio</TableHead>
                  <TableHead className="text-right">Inliers</TableHead>
                  <TableHead className="text-right">F1</TableHead>
                  <TableHead className="text-right">Precision</TableHead>
                  <TableHead className="text-right">Recall</TableHead>
                  <TableHead className="text-right">Samples</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {thresholds.map((t) => (
                  <TableRow key={t.threshold_id} className={t.is_active ? 'bg-blue-50' : ''}>
                    <TableCell>
                      {t.is_active ? (
                        <Badge className="bg-blue-600 hover:bg-blue-600">Active</Badge>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {t.ssim_min.toFixed(3)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {t.match_ratio_min.toFixed(3)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{t.inliers_min}</TableCell>
                    <TableCell className="text-right tabular-nums">{pct(t.f1)}</TableCell>
                    <TableCell className="text-right tabular-nums">{pct(t.precision)}</TableCell>
                    <TableCell className="text-right tabular-nums">{pct(t.recall)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {t.eval_sample_count ?? '—'}
                    </TableCell>
                    <TableCell className="tabular-nums text-xs text-gray-500">
                      {new Date(t.created_at).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  )
}
