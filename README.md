# F450 AI 地面站 (Python/PySide6 版本)

本项目已从 Web 架构迁移至纯 Python 桌面应用架构，以支持在本地环境（如 PyCharm）中高性能运行。

## 如何运行

1. **环境准备**:
   确保你安装了 Python 3.9 或更高版本。

2. **安装依赖**:
   在 PyCharm 的终端中运行：
   ```bash
   pip install -r requirements.txt
   ```

3. **运行应用**:
   直接运行 `main.py`：
   ```bash
   python main.py
   ```

## 快捷键说明

- **空格 (Space)**: 紧急停机 (Disarm)
- **C 键**: 开始手势行程校准
- **S 键**: 采样当前手部距离（用于校准）

## 文件结构

- `main.py`: 包含主程序入口、UI 界面代码、OpenCV 视觉线程以及模拟 MAVLink 逻辑。
- `requirements.txt`: 依赖列表。
