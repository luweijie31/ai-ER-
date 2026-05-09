<div align="center">

# AI ER 图生成器

**基于 DeepSeek AI 的 SQL / DBML → Chen 模型 ER 图工具**

[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)](#)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black)](#)
[![Vite](https://img.shields.io/badge/Vite-8-646CFF?style=flat-square&logo=vite&logoColor=white)](#)
[![DeepSeek](https://img.shields.io/badge/DeepSeek-AI-4F46E5?style=flat-square)](#)
[![pnpm](https://img.shields.io/badge/pnpm-F69220?style=flat-square&logo=pnpm&logoColor=white)](#)

</div>

---

## ✨ 项目简介

一个基于网页的**纯前端**工具，将 SQL `CREATE TABLE` 语句或 DBML 代码生成 **Chen 模型 ER 图**。

支持两种生成模式：
- **本地解析**：直接解析 SQL/DBML，快速生成，无需 API Key
- **AI 分析**：将 SQL 发送给 DeepSeek，自动推断关系基数（1:1 / 1:N / M:N）并翻译为中文标签

---

## 🚀 本地运行

本项目使用 [pnpm](https://pnpm.io/) 作为包管理器。

```bash
pnpm install
pnpm dev
```

然后在浏览器访问 `http://localhost:5173/sql2er.html`。

> 生产构建：`pnpm build`，再服务 `dist/` 目录。

---

## 📖 使用步骤

1. 在输入区粘贴 **SQL `CREATE TABLE`** 语句 / **DBML** 代码，或点击 **「导入 SQL 文件」** 直接上传 `.sql` 文件
2. **普通生成**：点击 **「⚡ 生成 ER 图」**，使用本地解析器快速出图
3. **AI 生成**：展开 **「AI 智能分析」** 面板，填入 DeepSeek API Key 后点击 **「AI 分析生成」**，自动翻译中文并精准推断关系基数
4. 若对节点位置不满意，可**拖拽节点**调整布局；**双击节点**修改标签
5. 使用**滚轮**缩放，**Ctrl + 滚轮**旋转画布
6. 图形复杂时，点击 **「智能布局」** 或 **「强制对齐」** 自动整理

---

## 🤖 AI 分析功能

展开左侧「AI 智能分析」面板：

1. 填入你的 [DeepSeek API Key](https://platform.deepseek.com/)，点击「保存」（仅存储在本地浏览器，不会上传）
2. 在编辑器中粘贴 SQL，点击「AI 分析生成」
3. DeepSeek 会自动完成：
   - 推断每条外键的基数（1:1 / 1:N / M:N）
   - 将所有表名、字段名、关系名翻译为中文
   - 直接生成高质量 ER 图

---

## 🧩 支持格式

<details open>
<summary><b>SQL 示例</b></summary>

```sql
CREATE TABLE users (
    id INT PRIMARY KEY,
    username VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE
);

CREATE TABLE posts (
    id INT PRIMARY KEY,
    author_id INT,
    title VARCHAR(255),
    FOREIGN KEY (author_id) REFERENCES users(id)
);
```

</details>

<details open>
<summary><b>DBML 示例</b></summary>

```dbml
Table users {
  id INT [pk]
  username VARCHAR(255) [not null]
  email VARCHAR(255) [unique]
}

Table posts {
  id INT [pk]
  author_id INT
  title VARCHAR(255)
}

Ref: posts.author_id > users.id
```

</details>

---

## 🎨 Chen 模型元素

|     图形      | 含义     | 对应数据库概念 |
| :-----------: | :------- | :------------- |
|  🟦 **矩形**  | 实体     | 表             |
|  🔶 **菱形**  | 关系     | 外键           |
|  ⚪ **椭圆**  | 属性     | 列             |
| <u>下划线</u> | 主键标识 | 主键属性       |

---

## 🕘 生成历史

每次生成 ER 图后自动保存**快照**（含缩略图、节点位置、显示设置），布局不会因重新生成而丢失。

- **打开**：点击画布左上角的时钟图标
- **恢复**：将卡片拖到中央后点击「恢复」
- **撤销/重做**：`Ctrl+Z` / `Ctrl+Y`
- **持久化**：数据存储在浏览器本地 IndexedDB，不上传

---

## 🛠️ 技术栈

| 层面 | 技术 |
|------|------|
| 框架 | React 19 + TypeScript |
| 构建 | Vite 8 |
| 图形渲染 | AntV G6 4.8 |
| 代码编辑器 | CodeMirror 6 |
| AI | DeepSeek API |
| 包管理 | pnpm |
