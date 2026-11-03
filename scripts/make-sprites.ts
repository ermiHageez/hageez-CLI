import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

/**
 * Build-time script to convert assets/agents/agent-sprites.png into 8x3 half-block ANSI character grids
 * and write to src/ui/sprites/map.json.
 */

const ASSET_PATH = path.join(__dirname, '..', 'assets', 'agents', 'agent-sprites.png');
const OUTPUT_PATH = path.join(__dirname, '..', 'src', 'ui', 'sprites', 'map.json');

const pythonScript = `
import json, os
from PIL import Image

im = Image.open("${ASSET_PATH}")
w, h = im.size
row_h = h / 13

agents = [
    ('logo', 'HAG', '#3ddc84'),
    ('analyst', 'ANA', '#3ddc84'),
    ('product-brief', 'BRI', '#6cb6ff'),
    ('pm', 'PM ', '#3ddc84'),
    ('ux-designer', 'UX ', '#f0b429'),
    ('architect', 'ARC', '#6cb6ff'),
    ('project-context', 'CTX', '#6cb6ff'),
    ('build', 'BLD', '#3ddc84'),
    ('code-review', 'REV', '#6cb6ff'),
    ('qa-tests', 'QA ', '#3ddc84'),
    ('retrospective', 'RET', '#f0b429'),
    ('reserved_goggles', 'GOG', '#8b96a5'),
    ('reserved_unlabeled', 'RES', '#8b96a5')
]

def make_frame_grid(img_crop):
    small = img_crop.resize((8, 6), Image.Resampling.BILINEAR)
    lines = []
    for line_idx in range(3):
        row = []
        for col_idx in range(8):
            top_px = small.getpixel((col_idx, line_idx * 2))
            bot_px = small.getpixel((col_idx, line_idx * 2 + 1))
            row.append({
                'top': [top_px[0], top_px[1], top_px[2]],
                'bottom': [bot_px[0], bot_px[1], bot_px[2]]
            })
        lines.append(row)
    return lines

sprites_map = {}
for i, (name, badge, color) in enumerate(agents):
    y1 = int(i * row_h)
    y2 = int((i + 1) * row_h)
    f1_crop = im.crop((10, y1 + 4, 70, y2 - 2))
    f2_crop = im.crop((90, y1 + 4, 150, y2 - 2))
    sprites_map[name] = {
        'badge': badge,
        'color': color,
        'frame1': make_frame_grid(f1_crop),
        'frame2': make_frame_grid(f2_crop)
    }

os.makedirs(os.path.dirname("${OUTPUT_PATH}"), exist_ok=True)
with open("${OUTPUT_PATH}", "w") as out:
    json.dump(sprites_map, out, indent=2)
print("Updated ${OUTPUT_PATH}")
`;

try {
  execSync(`python3 -c '${pythonScript}'`, { stdio: 'inherit' });
} catch (err) {
  console.error('Failed to generate sprites via python3 helper:', err);
  process.exit(1);
}
