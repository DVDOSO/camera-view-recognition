import type { Camera, CameraImage, GenerateResponse, HumanLabel, Metrics, Threshold } from './types'

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

export function storageUrl(filePath: string): string {
  if (!filePath) return ''
  const normalized = filePath.replace(/\\/g, '/')
  const idx = normalized.lastIndexOf('storage/')
  if (idx === -1) return ''
  return `${API_BASE}/${normalized.slice(idx)}`
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error((body as { detail?: string })?.detail ?? `Request failed: ${res.status}`)
  }
  return res.json() as Promise<T>
}

export async function getCameras(): Promise<Camera[]> {
  return handleResponse(await fetch(`${API_BASE}/cameras`))
}

export async function createCamera(data: { name: string; base_image_paths: string[] }): Promise<Camera> {
  return handleResponse(
    await fetch(`${API_BASE}/cameras`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
  )
}

export async function updateCamera(
  id: string,
  data: { name?: string; base_image_paths?: string[] },
): Promise<Camera> {
  return handleResponse(
    await fetch(`${API_BASE}/cameras/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
  )
}

export async function uploadBaseImage(file: File): Promise<string> {
  const fd = new FormData()
  fd.append('file', file)
  const data = await handleResponse<{ path: string }>(
    await fetch(`${API_BASE}/cameras/upload-base`, { method: 'POST', body: fd }),
  )
  return data.path
}

export async function deleteCamera(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/cameras/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Failed to delete camera')
}

export async function getAllImages(limit = 200, offset = 0): Promise<CameraImage[]> {
  return handleResponse(await fetch(`${API_BASE}/images?limit=${limit}&offset=${offset}`))
}

export async function getImagesForCamera(cameraId: string, limit = 200, offset = 0): Promise<CameraImage[]> {
  return handleResponse(await fetch(`${API_BASE}/images/${cameraId}?limit=${limit}&offset=${offset}`))
}

export async function compareImage(cameraId: string, file: File): Promise<CameraImage> {
  const fd = new FormData()
  fd.append('camera_id', cameraId)
  fd.append('file', file)
  return handleResponse(await fetch(`${API_BASE}/images/compare`, { method: 'POST', body: fd }))
}

export async function labelImage(imageId: string, human_label: HumanLabel): Promise<CameraImage> {
  return handleResponse(
    await fetch(`${API_BASE}/images/${imageId}/label`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ human_label }),
    }),
  )
}

export async function deleteImage(imageId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/images/${imageId}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Failed to delete image')
}

export async function getMetrics(): Promise<Metrics> {
  return handleResponse(await fetch(`${API_BASE}/metrics`))
}

export async function getThresholds(): Promise<Threshold[]> {
  return handleResponse(await fetch(`${API_BASE}/thresholds`))
}

export async function getActiveThreshold(): Promise<Threshold> {
  return handleResponse(await fetch(`${API_BASE}/thresholds/active`))
}

export async function tuneThresholds(): Promise<Threshold> {
  return handleResponse(await fetch(`${API_BASE}/thresholds/tune`, { method: 'POST' }))
}

export async function generateSynthetic(data: {
  camera_id: string
  n: number
  seed: number
}): Promise<GenerateResponse> {
  return handleResponse(
    await fetch(`${API_BASE}/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
  )
}

export async function clearSynthetic(): Promise<void> {
  const res = await fetch(`${API_BASE}/generate`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Failed to clear synthetic images')
}
