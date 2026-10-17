# 陈萌与叶倩芸的婚礼请柬


手机优先的静态网页，无需安装依赖。婚礼日期：2026年11月21日（星期六）。场地：深圳ÉPICE泷涎·高尔夫花园餐厅（南山沙河店）。到场时间、地址和流程仍需确认。


## 蒲公英开场


左侧蒲公英花冠由纯白色汉字组成，待机时轻轻摇动、少量部首向右飘散。轻触屏幕后，文字在三维空间向右飘散并旋转，其中五个字聚成“我们结婚了”，再显示双方姓名与日期。花冠种子散尽后留下花柄，最后淡入请柬正文。点击后约12.5秒进入正文；可跳过及重播。


使用原生 WebGL 渲染三维汉字粒子，没有 Unity、UE、Three.js 或在线 CDN 依赖。WebGL 不可用时使用 Canvas 透视投影回退；设备偏好减少动态效果时展示简化祝福画面。离开浏览器标签时暂停动画。


## 使用


解压完整 ZIP，双击 index.html 可本地预览。修改 data.js 填写内容。部署到 NAS 时，将以下文件放在同一个网页目录：


- index.html
- style.css
- launch.css
- launch.js
- data.js
- botanical.svg
- garden-dusk.png


可选照片需要同时复制，photo 字段使用相对路径。请在正式分享前确认或移除待填写内容。照片故事、流程、宾客提示默认折叠。


GitHub 仓库保持私有，蒲公英方案已同步到 main 分支；网站尚未公开部署。公开托管网站后，拿到链接的人仍可访问。微信分享卡片及不同手机性能需实机验证。

## 双 d10 检定原型

打开 `dice.html` 可以体验独立的 d100 掷骰页面。十位使用透明冰晶与金纹 d10（00、10、…、90），个位使用带微弱星光的黑金 d10（0–9）；两个零面采用 `dice-old-seal-reference.png` 的正面旧印代替数字，数值仍分别为 00 和 0；`00 + 0` 计为 100。骰子模型由 Three.js 在浏览器中生成，数字字形取自 `dice-number-reference.png`，并与纹章、旧印统一处理为金色烫印；纹章取自用户提供的 `dice-engraving-reference.png`，并去除背景和说明文字后贴到每个面上。页面使用项目内 `vendor/` 的 Three.js 0.186.1 文件，离线部署时需一并复制 `dice.html`、`dice.css`、`dice.js`、`dice-engraving-reference.png`、`dice-old-seal-reference.png`、`dice-number-reference.png` 和整个 `vendor/` 文件夹。请通过本地 HTTP 服务预览 `dice.html`，以便浏览器加载 JavaScript 模块。

