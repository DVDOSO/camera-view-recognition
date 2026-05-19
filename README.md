# CamWatch — Camera View Recognition

A full-stack dashboard for detecting camera obstructions and view changes using computer vision.

Upload a camera frame and CamWatch compares it against a known-good reference image, flagging it as **ALERT** (obstructed or moved) or **NORMAL** using three complementary similarity metrics.

---

## Stack

| Layer | Technology |
|---|---|
| Backend | FastAPI (async), Python 3.11 |
| Frontend | Next.js 16 (App Router), React Query, shadcn/ui + Tailwind |
| Database | PostgreSQL 16 |
| CV | OpenCV, scikit-image |
| Infra | Docker Compose |

---

## Features

### Cameras
- Create named cameras and upload one or more **base (reference) images** directly from the browser
- Base images are stored in `storage/base/` and persisted across restarts via Docker volumes
- Edit or delete cameras at any time; the camera list shows a thumbnail of the first base image

### Compare
Upload a new frame for a camera and the backend runs three similarity checks against every base image, taking the best match:

| Metric | Description |
|---|---|
| **SSIM Score** | Structural Similarity Index — pixel-level brightness and contrast similarity (0–1) |
| **Match Ratio** | Fraction of ORB keypoints in the new frame that match the reference (0–1) |
| **Inliers** | Keypoint pairs that survive homography verification — sensitive to camera rotation/translation |

The frame is marked **ALERT** if any metric falls below its configured threshold. Every comparison is saved to `storage/captures/` and immediately visible in the Label page.

### Label
- Browse all captured and synthetic images in a paginated grid
- Filter by camera and by label status (All / Unlabeled / NORMAL / OBSTRUCTED / MOVED / OTHER)
- Click a label chip on any image to assign the ground-truth label; the confusion matrix updates in real time

| Label | Meaning |
|---|---|
| **NORMAL** | View is unchanged — model should not alert |
| **OBSTRUCTED** | Lens is physically blocked (tape, cloth, hand, etc.) |
| **MOVED** | Camera has been redirected from its original position |
| **OTHER** | Ambiguous frame — excluded from precision/recall calculations |

### Metrics
- Live **F1, Precision, Recall** scores computed over all labeled images
- **Confusion matrix** (TP / FP / FN / TN) with positive class = OBSTRUCTED or MOVED
- **Threshold history table** showing every tuning run with its scores and sample counts
- **Active Threshold** panel showing the currently applied SSIM min, Match ratio min, and Inliers min

### Auto-Tune
Grid-searches over SSIM min, Match ratio min, and Inliers min to find the combination that maximises F1 on your labeled data. Requires ≥ 30 labeled samples. The winning threshold is activated immediately.

### Synthetic Training Data
Generates labeled images automatically by applying 16 transforms to a camera's base image — useful when you don't have enough real captures to reach the 30-sample threshold for auto-tune.

**OBSTRUCTED transforms:** `large_cover`, `multi_block`, `full_blackout`, `full_whiteout`  
**MOVED transforms:** `large_translation`, `large_rotation`, `extreme_zoom`, `large_perspective`  
**NORMAL transforms:** `brightness_contrast`, `sensor_noise`, `focus_drift`, `identity`, `translucent_smudge`, `subtle_tape`, `minor_shift`, `minor_tilt`, `minor_zoom`

Set a seed for reproducible results or randomise it with the wand button. Synthetic images are tagged with their transform name and can be cleared in bulk.

---

## Getting started

### Prerequisites
- [Docker Desktop](https://www.docker.com/products/docker-desktop/)

### Run

```bash
git clone https://github.com/DVDOSO/camera-view-recognition.git
cd camera-view-recognition
docker-compose up --build
```

| Service | URL |
|---|---|
| Frontend | http://localhost:3000 |
| API | http://localhost:8000 |
| API docs (Swagger) | http://localhost:8000/docs |
| pgAdmin | http://localhost:5050 |

pgAdmin credentials: `admin@admin.com` / `admin`

### First use

1. Open **Cameras** → **Add Camera**, give it a name, and upload one or more reference images of the camera's normal view
2. Open **Compare**, select the camera, and upload a test frame
3. Open **Label** and assign ground-truth labels to the captured images
4. Once you have ≥ 30 labeled images, open **Metrics** → **Run Auto-Tune** to optimise the thresholds

### Hot reload

Source files are bind-mounted into the containers, so edits to `app/` and `frontend/src/` reload automatically without a rebuild.

### Rebuilding

Required after changes to `docker-compose.yml`, `Dockerfile`, `requirements.txt`, or `package.json`:

```bash
docker-compose down && docker-compose up --build
```

---

## Storage layout

```
storage/
  base/        ← reference images uploaded via Cameras
  captures/    ← frames uploaded via Compare
  annotated/   ← synthetic images generated via Metrics
```

The `storage/` directory is bind-mounted (`./storage:/app/storage`) so files persist on the host and survive container restarts.

---

## Project structure

```
.
├── app/                    # FastAPI backend
│   ├── routers/            # cameras, images, metrics, generate
│   ├── services/           # comparison, storage, thresholds, synthetic
│   ├── models.py           # SQLAlchemy ORM models
│   ├── schemas.py          # Pydantic request/response schemas
│   └── main.py             # app entry point
├── frontend/               # Next.js frontend
│   └── src/
│       ├── app/            # App Router pages (cameras, compare, label, metrics, guide)
│       ├── components/     # Sidebar, shared UI
│       └── lib/            # API client, types
├── alembic/                # Database migrations
├── storage/                # Persisted image files (gitignored)
└── docker-compose.yml
```
