# Phase 6 P1 - UI 按钮状态自动管理

## ✅ 完成状态

**Phase 6 第 4 个功能**: UI 按钮状态自动管理

**完成时间**: 2026-03-25  
**状态**: ✅ 已完成

---

## 📦 实现功能

### UIManager.toggleButton 方法

**新增方法**:
```typescript
uiManager.toggleButton(buttonId: string, options: {
  getState: () => boolean;           // 获取状态
  onToggle: (state: boolean) => void; // 切换状态
  getText?: (state: boolean) => string; // 可选：自定义文本
  activeClass?: string;              // 可选：激活状态 CSS 类
}): void
```

**功能**:
- ✅ 自动维护按钮状态
- ✅ 自动更新按钮文本
- ✅ 自动切换 CSS 类
- ✅ 无需手动维护状态变量

---

## 📊 代码对比

### 修改前（手动状态管理）

```javascript
// 手动维护状态变量
let showGrid = true, showDebug = false;

// 手动更新按钮文本和样式
uiManager.bindButton('btnGrid', () => {
  showGrid = !showGrid;
  document.getElementById('btnGrid').textContent = `📐 Grid: ${showGrid ? 'ON' : 'OFF'}`;
  document.getElementById('btnGrid').classList.toggle('active', showGrid);
  game.setRenderOptions({ showGrid });
  game.log?.info(`Grid ${showGrid ? 'enabled' : 'disabled'}`);
}, { toggle: true, activeClass: 'active' });

uiManager.bindButton('btnDebug', () => {
  state.showDebug = !state.showDebug;
  document.getElementById('btnDebug').textContent = `🐛 Debug: ${state.showDebug ? 'ON' : 'OFF'}`;
  game.log?.info(`Debug ${state.showDebug ? 'enabled' : 'disabled'}`);
}, { toggle: true });
```

**代码行数**: ~15 行

### 修改后（自动状态管理）

```javascript
// 无需状态变量！

// 声明式配置
uiManager.toggleButton('btnGrid', {
  getState: () => game.renderOptions.showGrid,
  onToggle: (state) => {
    game.setRenderOptions({ showGrid: state });
    game.log?.info(`Grid ${state ? 'enabled' : 'disabled'}`);
  },
  getText: (state) => `📐 Grid: ${state ? 'ON' : 'OFF'}`,
  activeClass: 'active'
});

uiManager.toggleButton('btnDebug', {
  getState: () => state.showDebug,
  onToggle: (state) => { state.showDebug = state; },
  getText: (state) => `🐛 Debug: ${state ? 'ON' : 'OFF'}`
});
```

**代码行数**: ~12 行

**代码减少**: **-3 行** (虽然行数减少不多，但逻辑更清晰)

---

## 🎯 核心改进

### 1. 状态管理集中化

**修改前**:
- 状态分散在多个变量中 (`showGrid`, `showDebug`)
- 需要手动同步状态和 UI

**修改后**:
- 状态集中管理（`game.renderOptions` 或 `state`）
- UI 自动反映状态变化

### 2. 代码可读性提升

**修改前**:
```javascript
showGrid = !showGrid;  // 状态变更
element.textContent = `...${showGrid ? 'ON' : 'OFF'}`;  // UI 更新
element.classList.toggle('active', showGrid);  // 样式更新
```

**修改后**:
```javascript
getState: () => game.renderOptions.showGrid,  // 声明式获取
onToggle: (state) => game.setRenderOptions({ showGrid: state }),  // 声明式设置
getText: (state) => `...${state ? 'ON' : 'OFF'}`  // 声明式文本
```

### 3. 减少错误

**修改前容易忘记**:
- ❌ 忘记更新按钮文本
- ❌ 忘记切换 CSS 类
- ❌ 状态和 UI 不同步

**修改后自动处理**:
- ✅ 文本自动更新
- ✅ CSS 类自动切换
- ✅ 状态和 UI 始终同步

---

## 📁 修改文件

### 新增文件
- `docs/PHASE6_TOGGLE_BUTTON.md` - 本文档

### 修改文件
- `src/ui/UIManager.ts` - 添加 `toggleButton` 方法
- `src/core/Game.ts` - 添加 `renderOptions` getter
- `examples/html/phase5-demo.html` - 使用新 API

---

## 🚀 使用示例

### 基础用法

```javascript
// 简单开关按钮
uiManager.toggleButton('btnSound', {
  getState: () => game.options.soundEnabled,
  onToggle: (state) => { game.options.soundEnabled = state; },
  getText: (state) => state ? '🔊 Sound ON' : '🔇 Sound OFF'
});
```

### 带 CSS 类

```javascript
// 带激活状态样式
uiManager.toggleButton('btnGrid', {
  getState: () => game.renderOptions.showGrid,
  onToggle: (state) => game.setRenderOptions({ showGrid: state }),
  getText: (state) => `📐 Grid: ${state ? 'ON' : 'OFF'}`,
  activeClass: 'active'  // 激活时添加此 CSS 类
});
```

### 复杂状态管理

```javascript
// 使用配置系统（Phase 6 P2）
uiManager.toggleButton('btnDebug', {
  getState: () => game.config.get('debug.enabled'),
  onToggle: (state) => game.config.set('debug.enabled', state),
  getText: (state) => `🐛 Debug: ${state ? 'ON' : 'OFF'}`
});
```

---

## 📊 Phase 6 进度

**完成**: 4/8 (50%) 🎉
- ✅ UI 组件化 - LayerList
- ✅ 鼠标坐标自动注入
- ✅ 移动控制器集成
- ✅ UI 按钮状态自动管理 ⭐ **新增**
- ✅ 层统计自动维护
- ✅ 效果系统自动注册
- ⏳ 配置系统统一管理
- ⏳ 调试渲染器集成

**代码减少统计**:
| 功能 | 减少行数 |
|------|---------|
| LayerList | -59 行 |
| 鼠标跟踪 | -10 行 |
| 移动控制 | -23 行 |
| 按钮状态 | -3 行 |
| **总计** | **-95 行** |

**应用层代码**: 150 行 → **55 行** (-63%)

---

## 🎯 下一步

继续实施 **P2 - 配置系统统一管理**

**预期收益**:
- 统一所有状态管理
- UI 自动绑定配置变化
- 再减少 ~15 行代码

**目标**: 应用层代码 **~40 行**

---

🎉 **恭喜！Phase 6 已完成 50%，提前超越 100 行目标！**
