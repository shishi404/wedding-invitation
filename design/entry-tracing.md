# 首页纹饰描摹记录

来源：James Bousema，Cthulhu Awakens。
https://www.jamesbousema.com/cthulhu

本次从公开原图实际可见的刻线描摹，取代此前自行设计的几何符号。

原始参考：reference-cthulhu-awakens.jpg，2500 × 3333。
- 左上回旋纹：原图坐标 (415,108)–(958,340)。避开斜向椭圆框和左下方触手，描出暗色刻线轮廓。
- 右侧细密边饰：原图坐标 (2320,1100)–(2385,2500)。排除有色怪兽，保留纸面刻线。
- 清理小颗粒并轻微平滑轮廓；未添加自行编造的符号。

脚本 trace-entry-border.py 生成 SVG 路径；依赖 Pillow 与 numpy。
输出 entry-traced-top.svg、entry-traced-side.svg 和排版用 entry-traced-corner.svg。
四角排版使用等比例缩放、旋转与镜像；两侧使用原比例边饰。CSS 遮罩将纹饰限定在椭圆以外，长椭圆边框仍由 CSS 单独绘制。

对照：entry-tracing-comparison.html，左侧为实际参考局部，右侧为描摹后的矢量。

## 连续边饰修订

原先分开的四角与侧边片段已从页面撤下，改为一个连续的纹饰层。
新增完整矩形参考区域 (470,115)–(780,245)，避开原图椭圆边和怪兽。从该区域描出的刻线保存为 entry-traced-repeat-source.svg。
将其在对应边缘镜像拼合为 entry-traced-continuous.svg，以相同边缘相接，避免缺角和硬截断；背景以原比例连续重复，再遮去中央椭圆。降低亮度，统一全页刻线尺度，外缘收在双细线边框内。
这是一组实际描摹纹样的连续重排，并非原画整页边框的逐线复刻。
