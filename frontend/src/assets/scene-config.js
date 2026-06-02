/**
 * 场景配置文件
 * 场景：台车
 * 生成时间：2026/5/26 14:17:21
 *
 * 使用方式：
 *   const config = (await import('./scene-config.js')).default
 *   iframe.contentWindow.postMessage({ type: 'scene-config', ...config }, '*')
 *
 * 所有字段均为可选，未传入的字段保持场景原有配置不变
 */

const sceneConfig = {

  // ========== 场景背景 ==========
  // type: 'color' | 'image' | 'skybox'
  // color 类型：{ type: 'color', color: '#1a1a2e' }
  // image 类型：{ type: 'image', url: 'https://...' }
  // skybox 预设类型：{ type: 'skybox', preset: 'day-1' }
  //   可选 preset: day-1, day-2, dusk-1, dusk-2, night-1, night-2
  // skybox 自定义类型：{ type: 'skybox', preset: 'day-1', customUrl: 'https://...' }
  background: {
  "type": "color",
  "color": "#000"
},

  // ========== 灯光 ==========
  ambientIntensity: 0.8,  // 环境光强度 0~3
  lightIntensity: 1,    // 方向光强度 0~3
  lightColor: '#ffffff',           // 颜色

  // ========== 自动旋转 ==========
  autoRotate: false,
  autoRotateAxis: 'y',  // 旋转轴 'x' | 'y' | 'z'，默认 'y'
  autoRotateSpeed: 2,  // 旋转速度，默认 2
  gridVisible: false,          // 显示网格，默认 true

  // ========== 标点配置 ==========
  // 每个标点字段说明：
  //   id         - 唯一标识（新增标点时自定义，更新已有标点时使用原 id）
  //   name       - 标点名称
  //   position   - 3D 坐标 [x, y, z]
  //   imageUrl   - 标点图标 URL
  //   width      - 图标宽度
  //   height     - 图标高度
  //   action     - 点击行为 'none' | 'popup' | 'link'
  //   state      - 当前状态（匹配 images 中的 state 切换图标）
  //   popup      - 弹窗配置（action='popup' 时生效）
  //     title      弹窗标题
  //     content    弹窗文本内容
  //     contentUrl 嵌入链接（可选，会替代文本内容）
  //     style      自定义样式 { width, background, textColor, borderRadius, fontSize }
  //   linkUrl    - 跳转链接（action='link' 时生效）
  //   linkTarget - '_blank' | '_self'
  //   images     - 多图片数组，每项可带 state 标签用于状态切换
  markers: [
    {
        "id": "marker-1779775617199-1",
        "name": "标点 1",
        "position": [
            1.6994805285573453,
            0.880617181520407,
            0
        ],
        "imageUrl": "data:image/png;base64,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",
        "width": 1,
        "height": 1,
        "action": "popup",
        "popup": {
            "title": "",
            "content": "",
            "contentUrl": "http://spm3.1357.cn/#/aiot/pageContentConfig/addPlanMarker?setType=add",
            "style": {
                "width": 260,
                "background": "#1a1a2ecc",
                "textColor": "#eeeeee",
                "borderRadius": 8,
                "fontSize": 13,
                "padding": 12,
                "shadow": true,
                "titleAlign": "left",
                "contentAlign": "left"
            }
        }
    }
],

  // ========== 场景媒体 ==========
  // 支持三种类型：image(图片)/video(视频)/text(文字标注)
  // type       - 媒体类型 'image' | 'video' | 'text'
  // url        - 资源 URL（图片/视频）
  // position   - 3D 坐标 [x, y, z]
  // scale      - 缩放 [x, y]，平面无厚度
  // rotation   - 旋转 [x, y, z] 欧拉角
  // billboard  - true = 始终面向相机，false = 嵌入场景
  // 视频专用：autoplay/muted/loop
  // 文字专用：text/fontSize/fontColor
  sceneImages: [
    {
        "id": "6673ba37-7f9f-4b74-9274-839fc367e51e",
        "type": "image",
        "url": "https://oss.1357.cn/huazhu/labs/images/20260521/1776923671100-honaf5oeu4.jpeg",
        "name": "1776923671100.jpeg",
        "width": 1920,
        "height": 1080,
        "position": [
            0,
            1.8,
            -2.2
        ],
        "scale": [
            5,
            5,
            5
        ],
        "rotation": [
            0,
            0,
            0
        ],
        "visible": false,
        "billboard": false,
        "autoplay": null,
        "muted": null,
        "loop": null,
        "text": null,
        "fontSize": null,
        "fontColor": null
    },
    {
        "id": "dc3ceacd-72fa-4962-ba1e-f5bcb257712b",
        "type": "image",
        "url": "http://tapp.huazhukeji.cn:32000/huazhu/labs/images/20260521/æ å»å®¤_alarm-43if1j36c7.png",
        "name": "标养室_alarm.png",
        "width": 144,
        "height": 152,
        "position": [
            -1.7558556228168072,
            0.4906051242966016,
            -0.45649302043277806
        ],
        "scale": [
            1,
            1
        ],
        "rotation": [
            0,
            0,
            0
        ],
        "visible": true,
        "billboard": true,
        "autoplay": null,
        "muted": null,
        "loop": null,
        "text": null,
        "fontSize": null,
        "fontColor": null
    }
],

  // ========== 模型组件编辑 ==========
  // key 为模型内部构件的 UUID，value 为该构件的变换和材质覆盖
  // position/rotation/scale 格式: [x, y, z]
  components: {
    "58bcc9ee-355c-4362-a98a-fc7d7a2d5f66": {
        "position": [
            0,
            0,
            0
        ],
        "rotation": [
            0,
            0,
            0
        ],
        "scale": [
            1,
            1,
            1
        ],
        "color": "rgb(0,137,203)",
        "opacity": 1,
        "mapUrl": "",
        "normalMapUrl": "",
        "roughnessMapUrl": "",
        "metalnessMapUrl": null,
        "emissiveMapUrl": "",
        "visible": true,
        "name": "Mesh",
        "description": null
    },
    "caba769e-b9ec-4b5f-aa45-2a8ab48f374d": {
        "position": [
            0,
            0,
            0
        ],
        "rotation": [
            0,
            0,
            0
        ],
        "scale": [
            1,
            1,
            1
        ],
        "color": "rgb(255,0,0)",
        "opacity": 1,
        "mapUrl": null,
        "normalMapUrl": null,
        "roughnessMapUrl": null,
        "metalnessMapUrl": null,
        "emissiveMapUrl": null,
        "visible": true,
        "name": "Mesh_2",
        "description": null
    }
},

  // ========== 场景模型列表 ==========
  // 每个模型的 transform 和可见性配置
  models: [
    {
        "id": "9bc269c8-38ea-4d2a-be9b-378528b5e4ab",
        "modelId": "1a90789b-0b6a-4cbd-b42b-dacb2575e6d6",
        "displayName": null,
        "transform": {
            "scale": [
                1,
                1,
                1
            ],
            "position": [
                0,
                0,
                0
            ],
            "rotation": [
                0,
                0,
                0
            ]
        },
        "visible": true
    }
],

  // ========== UI 可见性 ==========
  toolbarVisible: false,     // 是否显示工具栏
  treeVisible: false,        // 是否显示模型树
  hiddenTools: [],           // 隐藏的工具列表，如 ['section', 'measurement']

  // ========== 相机位置 ==========
  // 可选，设置后预览页会跳转到指定视角
  camera: undefined,
  viewCubeVisible:false
}

export default sceneConfig
