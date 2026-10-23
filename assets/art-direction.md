# 书房素材与生成提示词

使用内置 imagegen 生成，未使用收费第三方建模服务或 API CLI。参考为用户确认的 `study-reference.png`。生成的 PNG 原图与网页用 WebP 均保留；网页只加载 WebP。九张 WebP 合计约 2.3 MB，首次进入只加载约 188 KB 的场景底图，特写按交互加载。

## 统一提示词

Grounded eerie investigative point-and-click game. Same scratched dark walnut, tattered black-brown leather and tarnished brass as the approved study reference. Rich realistic material detail, dim warm tungsten light from upper left, cold deep background shadows. Landscape 3:2. No people, hands, text, labels, UI, wedding imagery, magical glow or fantasy ornaments. Keep the whole inspected object in frame. All seal surfaces are blank: the exact user-provided Elder Sign is overlaid in the webpage, not redrawn by image generation.

## 各素材提示词

| 文件 | 提示词中的具体要求 |
| --- | --- |
| `study-plate.webp` | Edit the approved full scene. Keep exact camera, layout, furniture and orange bull collectible. Remove all interaction outlines and the incorrect cover symbol. Keep central drawer closed. Final fixed-camera background plate. |
| `study-open-plate.webp` | Edit only the central drawer: pull it open about 20 cm, empty dark interior, same brass handle and keyhole. Preserve camera and all other props. Used only through a clipped local drawer layer to avoid full-scene drift. |
| `notebook-detail.webp` | Dedicated close-up of the same tattered notebook. Plain blank dark leather cover, no mark or diagram. Exposed board, unraveling stitches, yellowed irregular pages, annotated scraps. Near overhead 3/4 angle with spine left. |
| `record-detail.webp` | Dedicated close-up of the same wooden turntable. Black grooved vinyl, brown-red label, aged brass tonearm, screws, control knobs and concealed front compartment seam. Elevated 3/4 camera, no lid. |
| `drawer-closed-detail.webp` | Front close-up of the same locked closed drawer. Worn walnut, tarnished brass keyhole and curved drop handle. No visible interior, envelope or key. |
| `drawer-open-detail.webp` | First-person close-up looking down into the pulled-open drawer. One aged cream envelope inside, triangular flap and plain oxblood wax seal. No other items. |
| `envelope-detail.webp` | Near-overhead close-up of one aged fibrous cream envelope on walnut, flap side up, centered plain oxblood seal. No address, names or readable writing. |
| `knife-detail.webp` | Single late-19th-century knuckle dagger: short weathered steel blade, leather grip, integrated brass guard with four finger holes. Diagonal on walnut, blade pointing upper right. No blood or use on people. |
| `key-detail.webp` | Single small old brass skeleton desk key, worn oval bow, shaft and stepped rectangular teeth. Diagonal on walnut, no symbols or other props. |

## 原始符号

`elder-sign.png` 是用户给出的透明 PNG。网页用它的原始 alpha 轮廓添加旧印，不通过生成模型重新描画。笔记上的磨损由 CSS/SVG 遮罩完成。场景中的旧图案区域用笔记皮革纹理覆盖，再贴正确符号。火漆中心直接叠加同一符号。

## 场景适配

图片坐标固定为 1536 × 1024，热点、轮廓和旧印属于独立图层。手机使用同一镜头，保持全部互动点可见；点击后打开屏幕中央的高清特写。`study-art.js` 只负责画面，规则仍在 `study-rules.js`，未来可用真实 3D 适配器替换。
