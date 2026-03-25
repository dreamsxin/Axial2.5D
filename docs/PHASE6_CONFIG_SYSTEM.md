# Phase 6 P2 - 配置系统统一管理

## ✅ 完成状态

**Phase 6 第 5 个功能**: 配置系统统一管理

**完成时间**: 2026-03-25  
**状态**: ✅ 已完成

---

## 📦 实现功能

### ConfigManager 类

**新增文件**: `src/core/ConfigManager.ts`

**核心功能**:
- ✅ 集中化配置存储
- ✅ 响应式更新（事件监听）
- ✅ 类型安全的 get/set 操作
- ✅ 支持嵌套键（如 'render.showGrid'）
- ✅ toggle 布尔值
- ✅ 支持通配符监听

**API**:
```typescript
class ConfigManager {
  get<T>(key: string): T
  set<T>(key: string, value: T, notify?: boolean): void
  toggle(key: string): boolean
  has(key: string): boolean
  on(key: string, listener: Callback): () => void
  onAny(listener: Callback): () => void
  toObject(): ConfigObject
  merge(config: ConfigObject): void
}
```

---

### UIManager 增强

**新增方法**:
```typescript
// 绑定滑块到配置
uiManager.bindSliderToConfig(
  sliderId: string,
  configKey: string,
  displayId?: string
): void

// 绑定开关按钮到配置
uiManager.toggleButtonForConfig(
  buttonId: string,
  configKey: string,
  options?: {
    getText?: (state: boolean) => string;
    activeClass?: string;
  }
): void
```

---

## 📊 代码对比

### 修改前（分散管理）

```javascript
// 状态变量分散
const state = {
  showGrid: true,
  showDebug: false
};

// 手动维护渲染选项
game.setRenderOptions({ showGrid: true });
const options = game.getRenderOptions();

// 滑块绑定复杂
uiManager.bindSlider('fgAlphaSlider', (v) => {
  document.getElementById('fgAlphaVal').textContent = v.toFixed(1);
  layerManager.updateLayerProperties({ foregroundAlpha: v });
  game.setRenderOptions({ foregroundAlpha: v });
}, 'fgAlphaVal');

// 按钮绑定复杂
uiManager.toggleButton('btnGrid', {
  getState: () => game.renderOptions.showGrid,
  onToggle: (state) => {
    game.setRenderOptions({ showGrid: state });
    game.log?.info(`Grid ${state ? 'enabled' : 'disabled'}`);
  },
  getText: (state) => `📐 Grid: ${state ? 'ON' : 'OFF'}`,
  activeClass: 'active'
});
```

**代码行数**: ~25 行

### 修改后（统一管理）

```javascript
// 配置集中管理
const game = new Game({
  config: {
    'render.showGrid': true,
    'render.foregroundAlpha': 0.6,
    'render.zIndexStep': 30,
    'render.parallaxRange': 0.7,
    'debug.enabled': false
  }
});

// 滑块绑定简单
uiManager.bindSliderToConfig('fgAlphaSlider', 'render.foregroundAlpha', 'fgAlphaVal');
uiManager.bindSliderToConfig('zStepSlider', 'render.zIndexStep', 'zStepVal');
uiManager.bindSliderToConfig('parallaxRangeSlider', 'render.parallaxRange', 'parallaxRangeVal');

// 按钮绑定简单
uiManager.toggleButtonForConfig('btnGrid', 'render.showGrid', {
  getText: (state) => `📐 Grid: ${state ? 'ON' : 'OFF'}`,
  activeClass: 'active'
});
uiManager.toggleButtonForConfig('btnDebug', 'debug.enabled', {
  getText: (state) => `🐛 Debug: ${state ? 'ON' : 'OFF'}`
});
```

**代码行数**: ~15 行

**代码减少**: **-10 行** (40% 减少)

---

## 🎯 核心改进

### 1. 配置集中化

**修改前**:
- 配置分散在 `state`、`game.renderOptions`、`layerManager` 中
- 需要同步多个数据源

**修改后**:
- 所有配置集中在 `game.config`
- 单一数据源，自动同步

### 2. 响应式更新

**修改前**:
```javascript
// 手动更新 UI
slider.addEventListener('input', () => {
  updateDisplay(value);
  updateLayerManager(value);
  updateGameOptions(value);
});
```

**修改后**:
```javascript
// 自动响应配置变化
game.config.on('render.foregroundAlpha', (value) => {
  // 自动触发
  layerManager.updateLayerProperties({ foregroundAlpha: value });
});

// UI 绑定自动更新
uiManager.bindSliderToConfig('fgAlphaSlider', 'render.foregroundAlpha');
```

### 3. 类型安全

```typescript
// 类型安全的配置访问
const showGrid = game.config.get<boolean>('render.showGrid');
const alpha = game.config.get<number>('render.foregroundAlpha');

// TypeScript 支持
interface ConfigMap {
  'render.showGrid': boolean;
  'render.foregroundAlpha': number;
  'debug.enabled': boolean;
}
```

### 4. 配置监听

```typescript
// 监听特定配置变化
game.config.on('render.showGrid', (value, oldValue, key) => {
  console.log(`${key} changed from ${oldValue} to ${value}`);
});

// 监听所有配置变化
game.config.onAny((value, oldValue, key) => {
  console.log(`Config changed: ${key} = ${value}`);
});
```

---

## 📁 修改文件

### 新增文件
- `src/core/ConfigManager.ts` - 配置管理器
- `docs/PHASE6_CONFIG_SYSTEM.md` - 本文档

### 修改文件
- `src/core/Game.ts` - 集成 ConfigManager
- `src/core/ModuleManager.ts` - 使用配置系统
- `src/ui/UIManager.ts` - 添加配置绑定方法
- `src/index.ts` - 导出 ConfigManager
- `examples/html/phase5-demo.html` - 使用新 API

---

## 🚀 使用示例

### 基础使用

```typescript
// 创建时初始化配置
const game = new Game({
  config: {
    'render.showGrid': true,
    'render.foregroundAlpha': 0.6,
    'debug.enabled': false
  }
});

// 获取配置
const showGrid = game.config.get('render.showGrid');

// 设置配置（自动触发监听器）
game.config.set('render.showGrid', false);

// 切换布尔值
const newState = game.config.toggle('debug.enabled');
```

### UI 绑定

```typescript
// 滑块绑定
uiManager.bindSliderToConfig('volumeSlider', 'audio.volume', 'volumeDisplay');

// 开关按钮
uiManager.toggleButtonForConfig('btnSound', 'audio.enabled', {
  getText: (state) => state ? '🔊 ON' : '🔇 OFF'
});
```

### 配置监听

```typescript
// 监听特定配置
game.config.on('render.showGrid', (value) => {
  console.log('Grid visibility:', value);
});

// 监听所有配置（用于调试）
game.config.onAny((value, oldValue, key) => {
  console.log(`Config: ${key} = ${value}`);
});

// 取消监听
const unsubscribe = game.config.on('render.showGrid', callback);
unsubscribe(); // 停止监听
```

### 配置持久化

```typescript
// 保存配置到 localStorage
function saveConfig() {
  localStorage.setItem('gameConfig', JSON.stringify(game.config.toObject()));
}

// 加载配置
function loadConfig() {
  const saved = localStorage.getItem('gameConfig');
  if (saved) {
    game.config.merge(JSON.parse(saved));
  }
}
```

---

## 📊 Phase 6 进度

**完成**: 5/8 (62.5%) 🎉
- ✅ UI 组件化 - LayerList
- ✅ 鼠标坐标自动注入
- ✅ 移动控制器集成
- ✅ UI 按钮状态自动管理
- ✅ **配置系统统一管理** ⭐ **新增**
- ✅ 层统计自动维护
- ✅ 效果系统自动注册
- ⏳ 调试渲染器集成

**代码减少统计**:
| 功能 | 减少行数 |
|------|---------|
| LayerList | -59 行 |
| 鼠标跟踪 | -10 行 |
| 移动控制 | -23 行 |
| 按钮状态 | -3 行 |
| **配置系统** | **-10 行** |
| **总计** | **-105 行** |

**应用层代码**: 150 行 → **45 行** (**-70%**)

---

## 🎯 下一步

继续实施 **P3 - 调试渲染器集成**

**预期收益**:
- DebugRenderer 自动注册到渲染管线
- 应用层只需添加调试项
- 再减少 ~5 行代码

**最终目标**: 应用层代码 **~40 行**

---

## 💡 最佳实践

### 1. 配置命名规范

```typescript
// 使用点分隔的层次结构
'render.showGrid'      // 渲染相关
'render.alpha'         // 渲染相关
'audio.volume'         // 音频相关
'audio.enabled'        // 音频相关
'game.difficulty'      // 游戏相关
```

### 2. 配置分组

```typescript
const game = new Game({
  config: {
    // 渲染配置
    'render.showGrid': true,
    'render.alpha': 0.6,
    
    // 音频配置
    'audio.enabled': true,
    'audio.volume': 0.8,
    
    // 游戏配置
    'game.difficulty': 'normal',
    'game.autoSave': true
  }
});
```

### 3. 配置验证

```typescript
// 设置前验证
game.config.set('render.alpha', value);
if (value < 0 || value > 1) {
  console.warn('Alpha must be between 0 and 1');
  game.config.set('render.alpha', 0.6); // 恢复默认值
}
```

---

🎉 **恭喜！Phase 6 已完成 62.5%，应用层代码减少 70%！**
