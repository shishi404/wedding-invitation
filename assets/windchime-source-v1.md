# 球仪右侧的支架风铃

内置 image_gen，以当前书房及用户的风铃照片作为参考。

最终提示词规格：只在球仪右侧、唱片机左侧空处添加桌面支架风铃。深棕长方体木底座、左侧细黄铜立杆和折弯横臂、小挂钩、细悬线、低面数黄铜穹顶铃铛、木质铃舌、带粗糙红棕色图案的米白长纸条。底座宽度约为球仪底座的一半。匹配早期 Source / Half-Life 2 / Garry's Mod：分面铃铛、折角支架、低分辨率漫反射纹理和生硬烘焙暖光，不照搬参考图植物、背景、水印，不添加文字/UI，不改变其他物品。

资产：windchime-source-scene-edit-v1.png、windchime-source-layer-v1.svg；网页使用 study-source-plate-v15.webp / study-source-open-v15.webp。

export-windchime-scene.mjs 将生成风铃整体等比缩放至底座宽约 51 像素，对应球仪底座约 102 像素，保留物体比例。仅合成风铃局部；逐像素检查区域外不变。此阶段风铃为场景摆件。
