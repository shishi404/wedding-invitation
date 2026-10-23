# 首页中文标题字

`entry-cn-black.ttf` 是 Noto Serif SC 的 900 字重子集，来自 Google Fonts，按 SIL Open Font License 1.1 使用，许可证见 `OFL-NotoSerifSC.txt`。

仅覆盖首页的“开始探索”“跳过探索，直接接收请柬”，以便文件足够小，网页无需访问在线字体服务。实际字形为厚重、尖角的中文宋体，用来接近哥特氛围，并非不含中文的西文 Blackletter。未改写或翻译原有中文文案。房间、物品对话和正式请柬不使用这个字体。

字体来源：https://fonts.google.com/specimen/Noto+Serif+SC
许可来源：https://github.com/google/fonts/blob/main/ofl/notoserifsc/OFL.txt

修改首页文案时需要重新生成包含新增汉字的子集。

当前首页已扩展为婚礼欢迎文案。为统一新增字符的显示，首页现使用本机中文宋体；原字体子集保留，但不再用于首页正文。


## 书房统一字形

study-gothic.css 用于书房及所有探索弹窗。英文使用 UnifrakturCook（真实 Blackletter 字形），中文使用 Noto Serif SC 900 的本地子集，延续厚重尖角的装帧气氛；中文并非西文 Blackletter。两款字体均按 SIL OFL 授权，本地 WOFF2 无需在线字体服务。

中文子集在本机从 index.html、study.js、study-rules.js、data.js、music.js、dice.js 的字符生成，增加文案后需重建。字库下载请求仅包含公共字体名，网页文字未提交给外部字体服务。
