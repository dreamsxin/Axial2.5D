# 快速入门 Getting Started

## 安装 Installation

```bash
npm install axial-2-5d
```

## 第一个游戏 Your First Game

### 1. 创建 HTML 文件

```html
<!DOCTYPE html>
<html>
<head>
  <title>My Axial2.5D Game</title>
  <style>
    body { margin: 0; overflow: hidden; }
    canvas { display: block; }
  </style>
</head>
<body>
  <canvas id="gameCanvas" width="800" height="600"></canvas>
  <script type="module">
    import { Game } from 'axial-2-5d';
    
    const game = new Game({
      width: 800,
      height: 600,
      projection: { type: 'isometric', viewAngle: 45 }
    });
    
    game.start();
  </script>
</body>
</html>
```

### 2. 添加地图

```typescript
const mapData = {
  width: 12,
  height: 12,
  tileW: 50,
  tileH: 50,
  tiles: []
};

// 初始化地图数据
for (let c = 0; c < 12; c++) {
  mapData.tiles[c] = [];
  for (let r = 0; r < 12; r++) {
    mapData.tiles[c][r] = {
      type: 'grass',
      height: 0,
      walkable: true,
      entity: null
    };
  }
}

game.init(mapData);
```

### 3. 添加实体

```typescript
import { IsoBox, IsoCharacter } from 'axial-2-5d';

// 添加建筑
const house = new IsoBox('house1', 5, 5, 80, 80, 60);
game.entityManager.addEntity(house);

// 添加玩家
const player = new IsoCharacter('player', 6, 6, 'hero', {
  width: 32,
  height: 48
});
game.entityManager.addEntity(player);
```

### 4. 添加输入控制

```typescript
// 键盘控制
document.addEventListener('keydown', (e) => {
  let { col, row } = player;
  
  if (e.key === 'w') row--;
  if (e.key === 's') row++;
  if (e.key === 'a') col--;
  if (e.key === 'd') col++;
  
  if (game.gridSystem.isWalkable(col, row)) {
    game.entityManager.moveEntity(player, col, row);
    game.centerCameraOnEntity('player');
  }
});
```

## 下一步 Next Steps

- 查看 `examples/web-example.html` 了解完整示例
- 阅读 API 文档学习更多功能
- 尝试修改参数创建自己的游戏
