# 桌面风铃视角调整

使用内置 imagegen 重绘透明风铃，以风铃原特写为造型参考，以当前书房为机位和光影参考。保留低多边形、硬边、低分辨率材质。新版露出更多底座与铃罩顶面，纸签有轻微侧转，仍然竖直悬挂。

- 原始生成图：windchime-source-perspective-v3.png。
- 桌面透明精灵：windchime-source-desktop-v3.png，54×150，位置 (934,306)。
- 房间：study-source-plate-v21.webp；抽屉打开版本：study-source-open-v21.webp。
- 使用 export-windchime-perspective-v3.mjs 导出。PNG 与旧版比较，改动限定在 (925,298,85,165) 的原风铃区域。
- SVG 高亮使用新精灵 Alpha 轮廓，不再使用旧风铃手工描线。原有点击区和取走后的背景补片继续覆盖整个风铃。
- 物品特写维持独立特写机位，未修改。

## 提示词

Use case: precise-object-edit / style-transfer. Asset type: transparent isolated game prop sprite for compositing into the existing room. Reference image 1 is the wind chime DESIGN to preserve exactly (a very simple faceted brass inverted-L stand, faceted truncated-bell brass cover, little brown wooden clapper, long cream vertical hanging paper with pixelated red circular flowers, rectangular thick dark wooden plinth). Reference image 2 is the authoritative CAMERA/PERSPECTIVE and old Source-engine rendering style of the desk; the chime sits to the RIGHT of the globe and therefore should be seen a little FROM ITS LEFT, with the camera looking DOWNWARD about 20 degrees, not a straight-on front-view cutout. Re-render ONLY the complete wind chime isolated on true transparent background, portrait about 1:2. Preserve its identity and upright posture. Correct the perspective: visible TOP face of the rectangular wooden base and the brass bell cap, subtly visible LEFT short face and long FRONT face of the base, NOT the right short face. The base is planted flat on a horizontal table, with coherent straight edges and parallel vertical stand. The brass arm and hanging paper follow this same three-quarter orientation, paper hangs vertical under gravity, its long face still mostly readable, slightly turned to the viewer's left; no skewed/bent base or crooked support. Keep roughly the same proportions as reference 1, wood plinth width about 40% of overall chime height, support slender, the bell small, hanging paper below it. Early Source / early Garry's Mod visual: extremely hard low-poly faceted geometry, sharp angular bell rather than round bell, stiff polygonal joints, very low-res mottled brass/wood textures, blocky blurry red flower texture on paper, flat baked directional yellow illumination from upper left, dark right-facing facets. No soft photorealism, ray tracing, bloom, smooth curved surfaces, high-resolution scratches, text or logos. Full object inside frame, no clipped corners or stand, generous transparent margins. NO room, floor or background, just prop and a very small faint hard contact shadow immediately below base.
