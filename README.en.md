<div align="center">

# AI ER Diagram Generator

**SQL / DBML → Chen-model ER Diagram Tool powered by DeepSeek AI**

[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)](#)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black)](#)
[![Vite](https://img.shields.io/badge/Vite-8-646CFF?style=flat-square&logo=vite&logoColor=white)](#)
[![DeepSeek](https://img.shields.io/badge/DeepSeek-AI-4F46E5?style=flat-square)](#)
[![pnpm](https://img.shields.io/badge/pnpm-F69220?style=flat-square&logo=pnpm&logoColor=white)](#)

</div>

---

## ✨ Overview

A **pure front-end** web tool that converts SQL `CREATE TABLE` statements or DBML code into **Chen-model ER diagrams**.

Two generation modes:
- **Local parsing** — parse SQL/DBML directly in the browser, instant output, no API Key required
- **AI analysis** — send SQL to DeepSeek to automatically infer relationship cardinality (1:1 / 1:N / M:N) and translate all labels to Chinese

---

## 🚀 Local Development

This project uses [pnpm](https://pnpm.io/).

```bash
pnpm install
pnpm dev
```

Then open `http://localhost:5173/sql2er.html` in your browser.

> Production build: run `pnpm build`, then serve the `dist/` directory.

---

## 📖 Usage

1. Paste **SQL `CREATE TABLE`** statements or **DBML** code into the editor, or click **"Import SQL File"** to upload a `.sql` file directly
2. **Normal generation**: click **"⚡ Generate"** to parse locally and produce the diagram instantly
3. **AI generation**: expand the **"AI Analysis"** panel, enter your DeepSeek API Key, then click **"AI Analyze"** — it will translate labels to Chinese and accurately infer cardinality
4. **Drag nodes** to adjust layout; **double-click** a node to edit its label
5. **Scroll** to zoom; **Ctrl + Scroll** to rotate the canvas
6. For complex diagrams, use **"Smart Layout"** or **"Force Align"** to auto-arrange

---

## 🤖 AI Analysis

Expand the "AI Analysis" panel on the left:

1. Enter your [DeepSeek API Key](https://platform.deepseek.com/) and click "Save" (stored locally in your browser only — never uploaded)
2. Paste SQL into the editor and click "AI Analyze"
3. DeepSeek will automatically:
   - Infer the cardinality of each foreign key (1:1 / 1:N / M:N)
   - Translate all table names, column names, and relationship labels to Chinese
   - Generate a high-quality ER diagram directly

---

## 🧩 Supported Formats

<details open>
<summary><b>SQL Example</b></summary>

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
<summary><b>DBML Example</b></summary>

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

## 🎨 Chen Model Elements

|      Shape       | Meaning            | Database Concept      |
| :--------------: | :----------------- | :-------------------- |
| 🟦 **Rectangle** | Entity             | Table                 |
|  🔶 **Diamond**  | Relationship       | Foreign Key           |
|  ⚪ **Ellipse**  | Attribute          | Column                |
| <u>Underline</u> | Primary Key marker | Primary Key attribute |

---

## 🕘 Generation History

A **snapshot** (thumbnail + node positions + display settings) is auto-saved every time you generate a diagram — your layout is never lost when you regenerate.

- **Open**: click the clock icon in the top-left of the canvas
- **Restore**: drag a card to the center, then click "Restore"
- **Undo / Redo**: `Ctrl+Z` / `Ctrl+Y`
- **Persistence**: all data is stored in the browser's local IndexedDB — nothing is uploaded

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React 19 + TypeScript |
| Build | Vite 8 |
| Graph rendering | AntV G6 4.8 |
| Code editor | CodeMirror 6 |
| AI | DeepSeek API |
| Package manager | pnpm |
