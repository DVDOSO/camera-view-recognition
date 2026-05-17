export type HumanLabel = 'NORMAL' | 'OBSTRUCTED' | 'MOVED' | 'OTHER'

export interface Camera {
  camera_id: string
  name: string
  base_image_paths: string[]
  created_at: string
}

export interface CameraImage {
  image_id: string
  camera_id: string
  image_path: string
  base_image_path: string
  annotated_path: string | null
  ssim_score: number
  match_ratio: number
  inliers: number
  script_decision: boolean
  human_label: HumanLabel | null
  synthetic_label: HumanLabel | null
  synthetic_transform: string | null
  timestamp: string
}

export interface Threshold {
  threshold_id: string
  ssim_min: number
  match_ratio_min: number
  inliers_min: number
  f1: number | null
  precision: number | null
  recall: number | null
  eval_sample_count: number | null
  is_active: boolean
  created_at: string
}

export interface Metrics {
  total_labeled: number
  true_positives: number
  false_positives: number
  true_negatives: number
  false_negatives: number
  precision: number | null
  recall: number | null
  f1: number | null
}

export interface GenerateResponse {
  generated: number
  image_ids: string[]
}
