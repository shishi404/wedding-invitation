# 吊坠的低多边形版本

使用内置 image_gen 对 books-pendant-source-redraw-v2.png 作局部风格编辑，原版保留。

最终提示词规格：保留书房相机和书本的刚性透视，只重绘书上的项链。链条整体约 12 个直线段，书面上的环为明显多边形，前侧垂落使用约 5 段折线形成重力下垂轮廓，避免平滑圆弧；以粗糙明暗像素暗示链节，避免写实小圆环。圆牌为低面数扁平八边形，保留模糊的小王子头像，低分辨率 16×16 或 32×32 漫反射视觉、暗淡银灰、平面分面、粗糙硬烘焙灯光和阴影。不使用平滑倒角、精细刻字或现代金属反射，不改变笔直书沿或书脊。对齐台灯的低多边形轮廓和早期 Source / Half-Life 2 / Garry's Mod 视觉。

资产：books-pendant-source-lowpoly-v1.png。已接入 study-source-plate-v12.webp / study-source-open-v12.webp。

export-books-pendant-lowpoly.mjs 合成整个书本与项链区域，检查区域外像素与原始房间相同；没有对链条或书本内部做二次局部缩放。
