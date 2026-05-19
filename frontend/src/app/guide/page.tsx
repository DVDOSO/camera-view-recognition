'use client'

import {
  Camera,
  ImageIcon,
  Tag,
  BarChart2,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Upload,
  Sparkles,
  Wand2,
  SlidersHorizontal,
  Grid2x2,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'

function StepBadge({ n }: { n: number }) {
  return (
    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
      {n}
    </span>
  )
}

function SectionHeader({
  icon: Icon,
  title,
  color = 'text-gray-700',
}: {
  icon: React.ElementType
  title: string
  color?: string
}) {
  return (
    <div className="flex items-center gap-2">
      <Icon className={`h-5 w-5 ${color}`} />
      <h2 className="text-base font-semibold text-gray-900">{title}</h2>
    </div>
  )
}

function FeatureRow({ icon: Icon, title, description, iconColor = 'text-gray-500' }: {
  icon: React.ElementType
  title: string
  description: string
  iconColor?: string
}) {
  return (
    <div className="flex gap-3">
      <div className={`mt-0.5 shrink-0 ${iconColor}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <p className="text-sm font-medium text-gray-800">{title}</p>
        <p className="mt-0.5 text-sm text-gray-500">{description}</p>
      </div>
    </div>
  )
}

export default function GuidePage() {
  return (
    <div className="mx-auto max-w-3xl space-y-10 px-3 py-6 pb-16">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Guide</h1>
        <p className="mt-0.5 text-sm text-gray-500">
          How to set up cameras, compare images, and tune the detection model
        </p>
      </div>

      {/* ── Workflow overview ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold uppercase tracking-wide text-gray-400">
            Quick-start workflow
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-2">
            {[
              { icon: Camera, label: 'Add camera', sub: 'Cameras' },
              { icon: Upload, label: 'Upload base images', sub: 'Cameras' },
              { icon: ImageIcon, label: 'Compare frames', sub: 'Compare' },
              { icon: Tag, label: 'Label images', sub: 'Label' },
              { icon: Wand2, label: 'Auto-tune', sub: 'Metrics' },
            ].map(({ icon: Icon, label, sub }, i) => (
              <div key={label} className="flex items-center gap-2">
                <div className="flex flex-col items-center gap-1.5 rounded-xl border bg-gray-50 px-4 py-3 text-center">
                  <div className="flex items-center gap-1.5">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-[10px] font-bold text-white">
                      {i + 1}
                    </span>
                    <Icon className="h-4 w-4 text-gray-500" />
                  </div>
                  <p className="text-xs font-medium text-gray-700">{label}</p>
                  <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] text-blue-600">
                    {sub}
                  </span>
                </div>
                {i < 4 && <ArrowRight className="h-3.5 w-3.5 shrink-0 text-gray-300" />}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ── Cameras ── */}
      <section className="space-y-4">
        <SectionHeader icon={Camera} title="Cameras" color="text-gray-500" />
        <p className="text-sm text-gray-600">
          Each camera needs at least one <strong>base (reference) image</strong> — a known-good
          frame that the model compares every new capture against.
        </p>
        <div className="space-y-3">
          <div className="flex gap-3 rounded-lg border p-4">
            <StepBadge n={1} />
            <div className="space-y-1">
              <p className="text-sm font-medium text-gray-800">Click <em>Add Camera</em></p>
              <p className="text-sm text-gray-500">Give the camera a descriptive name (e.g. "Entrance Cam").</p>
            </div>
          </div>
          <div className="flex gap-3 rounded-lg border p-4">
            <StepBadge n={2} />
            <div className="space-y-1">
              <p className="text-sm font-medium text-gray-800">Upload base images</p>
              <p className="text-sm text-gray-500">
                Drag and drop one or more clear reference photos of the camera's normal view.
                More reference images improve robustness to lighting changes. Images are stored
                in <code className="rounded bg-gray-100 px-1 text-xs">storage/base/</code>.
              </p>
            </div>
          </div>
          <div className="flex gap-3 rounded-lg border p-4">
            <StepBadge n={3} />
            <div className="space-y-1">
              <p className="text-sm font-medium text-gray-800">Edit or delete anytime</p>
              <p className="text-sm text-gray-500">
                Use the pencil icon to add or remove base images. Removing all images disables
                comparison for that camera.
              </p>
            </div>
          </div>
        </div>
      </section>

      <Separator />

      {/* ── Compare ── */}
      <section className="space-y-4">
        <SectionHeader icon={ImageIcon} title="Compare" color="text-blue-500" />
        <p className="text-sm text-gray-600">
          Upload a new camera frame to check whether the view has been obstructed or moved.
          The result is saved and appears in the Label and Metrics pages.
        </p>

        {/* Decision badges */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5 rounded-lg border border-green-200 bg-green-50 p-3">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <span className="text-sm font-medium text-green-700">NORMAL</span>
            </div>
            <p className="text-xs text-green-700">
              All three metrics are above their thresholds — the camera view is unchanged.
            </p>
          </div>
          <div className="space-y-1.5 rounded-lg border border-red-200 bg-red-50 p-3">
            <div className="flex items-center gap-1.5">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              <span className="text-sm font-medium text-red-700">ALERT</span>
            </div>
            <p className="text-xs text-red-700">
              At least one metric fell below its threshold — obstruction or camera movement
              likely detected.
            </p>
          </div>
        </div>

        {/* Metrics explanation */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-600">The three similarity metrics</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <FeatureRow
              icon={Grid2x2}
              iconColor="text-purple-500"
              title="SSIM Score  (0 → 1)"
              description="Structural Similarity Index — measures pixel-level brightness and contrast changes. A score close to 1 means the images look nearly identical."
            />
            <FeatureRow
              icon={SlidersHorizontal}
              iconColor="text-blue-500"
              title="Match Ratio  (0 → 1)"
              description="Fraction of ORB keypoints in the new frame that have strong counterparts in the reference. Low values mean the textures no longer align."
            />
            <FeatureRow
              icon={CheckCircle2}
              iconColor="text-green-500"
              title="Inliers  (count)"
              description="Number of keypoint pairs that survive geometric verification (homography). Very few inliers usually indicate the camera moved."
            />
          </CardContent>
        </Card>

        <p className="text-xs text-gray-400">
          Captured frames are saved to{' '}
          <code className="rounded bg-gray-100 px-1">storage/captures/</code> and are
          immediately visible in the Label page.
        </p>
      </section>

      <Separator />

      {/* ── Label ── */}
      <section className="space-y-4">
        <SectionHeader icon={Tag} title="Label" color="text-orange-500" />
        <p className="text-sm text-gray-600">
          Labeling images tells the model what the ground truth is, enabling it to measure and
          improve its accuracy.
        </p>

        {/* Label chips demo */}
        <div className="flex flex-wrap gap-2 rounded-lg border bg-gray-50 p-4">
          {[
            { label: 'NORMAL', cls: 'bg-green-100 text-green-800 border-green-300' },
            { label: 'OBSTRUCTED', cls: 'bg-red-100 text-red-800 border-red-300' },
            { label: 'MOVED', cls: 'bg-orange-100 text-orange-800 border-orange-300' },
            { label: 'OTHER', cls: 'bg-gray-100 text-gray-600 border-gray-300' },
          ].map(({ label, cls }) => (
            <button
              key={label}
              className={`rounded border px-2 py-0.5 text-xs ${cls}`}
              onClick={(e) => e.preventDefault()}
            >
              {label}
            </button>
          ))}
          <span className="self-center text-xs text-gray-400">← click a chip on any image to assign its label</span>
        </div>

        <div className="space-y-3">
          <FeatureRow
            icon={Tag}
            iconColor="text-green-500"
            title="NORMAL"
            description="Camera view looks as expected — the model should output no alert."
          />
          <FeatureRow
            icon={Tag}
            iconColor="text-red-500"
            title="OBSTRUCTED"
            description="Something is blocking the lens (tape, cloth, hand, etc.)."
          />
          <FeatureRow
            icon={Tag}
            iconColor="text-orange-500"
            title="MOVED"
            description="The camera has been physically redirected from its original position."
          />
          <FeatureRow
            icon={Tag}
            iconColor="text-gray-400"
            title="OTHER"
            description="Ambiguous or edge-case frame — excluded from precision/recall calculations."
          />
        </div>

        <Card className="border-blue-100 bg-blue-50">
          <CardContent className="pt-4">
            <p className="text-sm text-blue-800">
              <strong>Tip:</strong> Use the <em>Filter</em> dropdown to show only{' '}
              <Badge variant="outline" className="mx-0.5 text-xs">Unlabeled</Badge> images so
              you can work through them efficiently. Auto-tune requires at least 30 labeled samples.
            </p>
          </CardContent>
        </Card>
      </section>

      <Separator />

      {/* ── Metrics ── */}
      <section className="space-y-4">
        <SectionHeader icon={BarChart2} title="Metrics" color="text-indigo-500" />
        <p className="text-sm text-gray-600">
          Once you have labeled images you can measure model performance and automatically find
          better detection thresholds.
        </p>

        {/* Confusion matrix explainer */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-600">Confusion matrix</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid max-w-xs grid-cols-2 gap-3">
              {[
                { label: 'True Positives', sub: 'Model said ALERT, actually bad', cls: 'bg-green-50 border-green-200 text-green-700' },
                { label: 'False Positives', sub: 'Model said ALERT, actually fine', cls: 'bg-red-50 border-red-200 text-red-700' },
                { label: 'False Negatives', sub: 'Model said OK, actually bad', cls: 'bg-orange-50 border-orange-200 text-orange-700' },
                { label: 'True Negatives', sub: 'Model said OK, actually fine', cls: 'bg-blue-50 border-blue-200 text-blue-700' },
              ].map(({ label, sub, cls }) => (
                <div key={label} className={`rounded-lg border p-2.5 text-center text-xs ${cls}`}>
                  <p className="font-semibold">{label}</p>
                  <p className="mt-0.5 opacity-75">{sub}</p>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-gray-400">
              Positive class = OBSTRUCTED or MOVED. Negative class = NORMAL.
            </p>
          </CardContent>
        </Card>

        {/* Auto-tune */}
        <div className="space-y-3">
          <div className="flex gap-3 rounded-lg border p-4">
            <div className="mt-0.5 shrink-0">
              <Wand2 className="h-4 w-4 text-blue-500" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-gray-800">Auto-Tune thresholds</p>
              <p className="text-sm text-gray-500">
                Runs a grid search over SSIM min, Match ratio min, and Inliers min to find the
                combination that maximises F1 score on your labeled data. Requires ≥ 30 labeled
                images. The winning threshold is activated immediately.
              </p>
            </div>
          </div>

          <div className="flex gap-3 rounded-lg border p-4">
            <div className="mt-0.5 shrink-0">
              <Sparkles className="h-4 w-4 text-purple-500" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-gray-800">Synthetic training data</p>
              <p className="text-sm text-gray-500">
                Generates labeled images automatically by applying 16 image transforms
                (blur, brightness shift, rotation, occlusion patches, etc.) to a camera's
                base image. Use this when you don't have enough real labeled samples to
                reach the 30-image threshold for auto-tune.
              </p>
              <p className="text-sm text-gray-500">
                Set a <strong>seed</strong> for reproducible results, or randomise it with
                the wand button. Synthetic images are marked with a transform badge and can
                be cleared in bulk.
              </p>
            </div>
          </div>
        </div>
      </section>

      <Separator />

      {/* ── Storage layout ── */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold text-gray-900">Storage layout</h2>
        <div className="rounded-lg border bg-gray-50 p-4 font-mono text-xs text-gray-600 leading-relaxed">
          <p>storage/</p>
          <p className="pl-4">base/          <span className="font-sans text-gray-400">← reference images uploaded via Cameras</span></p>
          <p className="pl-4">captures/      <span className="font-sans text-gray-400">← frames uploaded via Compare</span></p>
          <p className="pl-4">annotated/     <span className="font-sans text-gray-400">← synthetic generated images</span></p>
        </div>
        <p className="text-xs text-gray-400">
          The <code className="rounded bg-gray-100 px-1">storage/</code> directory is mounted
          as a Docker volume so files persist across container restarts.
        </p>
      </section>
    </div>
  )
}
