/**
 * AI Parser Module
 * 调用 DeepSeek API 分析 SQL，直接返回 ParseResult，跳过本地解析器。
 */
import type { ParseResult } from "../types";

const DEEPSEEK_API_URL = "https://api.deepseek.com/chat/completions";

const SYSTEM_PROMPT = `你是一个数据库建模专家。用户会给你一段 SQL CREATE TABLE 语句，你需要：
1. 分析所有表及其字段
2. 推断实体间的关系和基数（1:1、1:N、M:N）
3. 把所有表名、字段名、关系名翻译成中文（专业、简洁）
4. 以 JSON 格式输出结果，格式严格如下：

{
  "tables": [
    {
      "name": "中文表名",
      "columns": [
        {
          "name": "中文字段名",
          "type": "原始字段类型",
          "isPrimaryKey": true或false,
          "isUnique": true或false（可选）
        }
      ],
      "primaryKeys": ["中文主键字段名"],
      "foreignKeys": [
        {
          "column": "本表中文字段名",
          "referencedTable": "被引用的中文表名",
          "referencedColumn": "被引用的中文字段名"
        }
      ]
    }
  ],
  "relationships": [
    {
      "from": "来源中文表名",
      "to": "目标中文表名",
      "label": "语义化中文关系动词（如：属于、包含、撰写、管理）",
      "fromCardinality": "1"或"N",
      "toCardinality": "1"或"N"
    }
  ]
}

关于基数规则：
- 普通外键（多对一）：fromCardinality="N", toCardinality="1"
- 外键字段有 UNIQUE 约束（一对一）：fromCardinality="1", toCardinality="1"
- 多对多（通过中间表）：fromCardinality="N", toCardinality="N"
- M:N 的中间表本身也保留在 tables 中

重要：
- 所有名称（表名、字段名、关系中的 from/to/label）必须统一使用中文翻译后的名称
- foreignKeys 中的 referencedTable 和 referencedColumn 必须与 tables 中对应中文名完全一致
- relationships 中的 from/to 必须与 tables 中的 name 完全一致
- 只输出 JSON，不要有任何其他文字、代码块标记或解释`;

export async function parseWithAI(
  sql: string,
  apiKey: string,
): Promise<ParseResult> {
  const response = await fetch(DEEPSEEK_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: sql },
      ],
      temperature: 0.1,
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    const err = await response.text().catch(() => "");
    if (response.status === 401) throw new Error("API Key 无效，请检查后重试");
    if (response.status === 429) throw new Error("请求过于频繁，请稍后再试");
    throw new Error(`DeepSeek API 错误 (${response.status}): ${err}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error("AI 返回内容为空");

  let parsed: ParseResult;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error("AI 返回格式错误，无法解析 JSON");
  }

  // 基础校验 + 补全缺省字段
  if (!Array.isArray(parsed.tables)) throw new Error("AI 返回数据缺少 tables 字段");
  parsed.tables = parsed.tables.map((t) => ({
    name: t.name ?? "",
    columns: (t.columns ?? []).map((c: {
      name?: string;
      type?: string;
      isPrimaryKey?: boolean;
      isUnique?: boolean;
      comment?: string;
    }) => ({
      name: c.name ?? "",
      type: c.type ?? "",
      isPrimaryKey: !!c.isPrimaryKey,
      isUnique: c.isUnique,
      comment: c.comment,
    })),
    primaryKeys: t.primaryKeys ?? [],
    foreignKeys: t.foreignKeys ?? [],
  }));
  parsed.relationships = (parsed.relationships ?? []).map((r: {
    from?: string;
    to?: string;
    label?: string;
    fromCardinality?: "1" | "N";
    toCardinality?: "1" | "N";
  }) => ({
    from: r.from ?? "",
    to: r.to ?? "",
    label: r.label ?? "",
    fromCardinality: r.fromCardinality ?? "N",
    toCardinality: r.toCardinality ?? "1",
  }));

  return parsed;
}
