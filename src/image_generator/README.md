# Dataset Labels

## Usage

### Generate a batch

```python
import cv2
from pathlib import Path
from image_generator.synthetic_generator import generate_batch

base = cv2.imread("images/baseimage1.jpg")
batch = generate_batch(base, n=20, seed=42)

for i, sample in enumerate(batch):
    cv2.imwrite(f"generated/{i:04d}.png", sample.image)
    print(sample.to_metadata())
    # {'label': 'OBSTRUCTED', 'transform': 'large_cover', 'params': {...}}
```

### Apply a specific transform

```python
from image_generator.synthetic_generator import apply_transform, Label
import random

sample = apply_transform(base, Label.MOVED, "large_rotation", rng=random.Random(0))
```

### Custom label mix

`mix` values must sum to 1.0. Default is `{OBSTRUCTED: 0.45, MOVED: 0.35, NORMAL: 0.20}`.

```python
from image_generator.synthetic_generator import Label

batch = generate_batch(base, n=100, mix={
    Label.OBSTRUCTED: 0.33,
    Label.MOVED: 0.33,
    Label.NORMAL: 0.34,
}, seed=7)
```

### Output format

Each `GeneratedSample` has:
- `sample.image` — NumPy BGR array (same shape as input)
- `sample.label` — `Label.NORMAL`, `Label.OBSTRUCTED`, or `Label.MOVED`
- `sample.transform` — name of the transform applied (e.g. `"large_cover"`)
- `sample.params` — dict of the parameters used (varies per transform)
- `sample.to_metadata()` — serialisable dict of label, transform, and params

---

## OBSTRUCTED
Detector **should alert**. Something is physically blocking the lens in a way that significantly degrades the camera's view.

| Transform | Description |
|---|---|
| `large_cover` | Solid rectangle covering 60–90% of the frame (tape, cardboard) |
| `multi_block` | 4–8 overlapping solid rectangles blanketing most of the frame |
| `full_blackout` | Nearly black frame with mild noise — lens fully covered |
| `full_whiteout` | Nearly white frame — lens aimed at bright light or covered with white material |

---

## MOVED
Detector **should alert**. The camera's field of view has shifted significantly from its original position.

| Transform | Description |
|---|---|
| `large_translation` | Frame shifted 30–60% in a random direction (camera knocked hard) |
| `large_rotation` | Frame rotated 25–75° (camera severely tilted) |
| `extreme_zoom` | Zoomed in 1.6–2.5× or out 0.2–0.5× (camera moved far closer/further) |
| `large_perspective` | Heavy perspective warp with 40% corner jitter (camera repositioned at new angle) |

---

## NORMAL
Detector **should not alert**. Benign environmental changes or minor physical variations that a camera may naturally experience.

| Transform | Description |
|---|---|
| `brightness_contrast` | Contrast multiplier 0.65–1.35×, brightness offset ±40 (time-of-day lighting) |
| `sensor_noise` | Additive Gaussian noise σ = 5–20 (low-light sensor noise) |
| `focus_drift` | Mild Gaussian blur, kernel 3/5/7 (slight autofocus drift) |
| `identity` | No change — base image returned as-is |
| `translucent_smudge` | Soft blurred ellipse blended at 40–70% opacity (grease or smudge on lens) |
| `subtle_tape` | Tiny solid rectangle covering 3–8% of the frame (small piece of tape) |
| `minor_shift` | Frame shifted 2–5% (gentle camera nudge) |
| `minor_tilt` | Frame rotated 0.5–3° (very slight tilt) |
| `minor_zoom` | Scale factor 0.97–1.03× (negligible camera movement) |
