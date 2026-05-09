import { useEffect, useRef, useState } from "react";
import G6 from "@antv/g6";
import { I18N } from "./i18n";
import type { Language } from "./i18n";
import { detectLang } from "./language";
import { patchRelationshipLinkPoints, registerCustomNodes } from "./builder";
import { CodeEditor } from "./editor";
import { SwitchControl } from "./components/SwitchControl";
import { parseWithAI } from "./parser/ai";
import {
  CircleNodesIcon,
  ClockRotateLeftIcon,
  EyeIcon,
  EyeSlashIcon,
  ListUlIcon,
  PaletteIcon,
} from "./components/icons";
import * as Exporter from "./exporter";
import * as Snapshots from "./snapshots";
import type { SnapshotRecord } from "./types";
import { HistoryOverlay } from "./HistoryOverlay";
import { useGraph } from "./hooks/useGraph";
import { useExportButton } from "./hooks/useExportButton";
import type { ExportFormat, ExportDoneCallback } from "./hooks/useExportButton";
import { useUndoRedoShortcuts } from "./hooks/useUndoRedoShortcuts";
import { useWheelZoomRotate } from "./hooks/useWheelZoomRotate";

registerCustomNodes(G6);

const App = () => {
  const initialLang = detectLang() as Language;
  const [lang, setLang] = useState<Language>(initialLang);
  const t = I18N[lang];
  const [showBackground, setShowBackground] = useState(true);
  // 历史快照面板状态
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyItems, setHistoryItems] = useState<SnapshotRecord[]>([]);

  // AI 面板状态
  const [aiPanelOpen, setAIPanelOpen] = useState(false);
  const [aiKey, setAIKey] = useState(() => localStorage.getItem("deepseek_api_key") ?? "");
  const [aiKeyInput, setAIKeyInput] = useState(() => localStorage.getItem("deepseek_api_key") ?? "");
  const [aiKeySaved, setAIKeySaved] = useState(false);
  const [aiLoading, setAILoading] = useState(false);
  const [aiError, setAIError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const {
    containerRef,
    graphRef,
    historyRef,
    lastInputRef,
    inputText,
    isColored,
    showComment,
    hideFields,
    forceOn,
    hasGraph,
    error,
    loading,
    setError,
    setInputText,
    setIsColored,
    setShowComment,
    setHideFields,
    setForceOn,
    handleGenerate,
    handleForceAlign,
    handleArrangeLayout,
    restoreFromSnapshot,
    persistSnapshot,
  } = useGraph({ t, initialLang });

  // 监听语言切换事件（由顶部 vanilla 脚本派发）。
  // 用户尚未修改示例时连同示例一起替换并立即重新生成；
  // 不再走 ref+effect 的间接路径。
  useEffect(() => {
    const onLang = (e: Event) => {
      const detail = (e as CustomEvent<{ lang?: Language }>).detail;
      const nextLang = detail && detail.lang;
      if (!nextLang || nextLang === lang) return;
      const usingDefaultSample =
        inputText === I18N.zh.sample || inputText === I18N.en.sample;
      setLang(nextLang);
      if (usingDefaultSample) {
        const nextSample = I18N[nextLang].sample;
        setInputText(nextSample);
        handleGenerate({ inputText: nextSample });
      }
    };
    window.addEventListener("sql2er-lang", onLang);
    return () => window.removeEventListener("sql2er-lang", onLang);
  }, [lang, inputText, setInputText, handleGenerate]);

  // 导出 SVG/PNG/Drawio - 使用 Exporter 模块
  const handleExportSVG = (onDone: ExportDoneCallback) => {
    if (!hasGraph || !graphRef.current) {
      onDone(new Error("no-graph"));
      return;
    }
    Exporter.exportSVG({
      graphRef,
      hasGraph,
      containerRef,
      onError: setError,
      onDone,
      patchRelationshipLinkPoints,
      G6,
    });
  };

  const handleExportPNG = (onDone: ExportDoneCallback) => {
    if (!hasGraph || !graphRef.current) {
      onDone(new Error("no-graph"));
      return;
    }
    Exporter.exportPNG({
      graphRef,
      hasGraph,
      containerRef,
      onError: setError,
      onDone,
      patchRelationshipLinkPoints,
      G6,
    });
  };

  const handleExportDrawio = (onDone: ExportDoneCallback) => {
    if (!hasGraph || !graphRef.current) {
      onDone(new Error("no-graph"));
      return;
    }
    Exporter.exportDrawio({
      graphRef,
      hasGraph,
      onError: setError,
      onDone,
      patchRelationshipLinkPoints,
    });
  };

  const runExport = (fmt: ExportFormat, onDone: ExportDoneCallback) => {
    if (fmt === "PNG") handleExportPNG(onDone);
    else if (fmt === "XML") handleExportDrawio(onDone);
    else handleExportSVG(onDone);
  };

  const {
    exportState,
    exportView,
    exportFmt,
    exportProgress,
    exportBtnRef,
    onExportBtnClick,
    onExportBtnKey,
    toExportIdle,
  } = useExportButton({ hasGraph, runExport, onError: setError });

  useUndoRedoShortcuts({ graphRef, historyRef });
  useWheelZoomRotate({ containerRef, graphRef, historyRef });

  // 切换背景显示
  const handleToggleBackground = () => {
    setShowBackground(!showBackground);
  };

  // 保存 API Key 到 localStorage
  const handleSaveAIKey = () => {
    const k = aiKeyInput.trim();
    localStorage.setItem("deepseek_api_key", k);
    setAIKey(k);
    setAIKeySaved(true);
    setTimeout(() => setAIKeySaved(false), 2000);
  };

  // 导入 SQL 文件
  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      if (text) setInputText(text);
    };
    reader.readAsText(file, "utf-8");
    // 重置 input，允许重复选同一个文件
    e.target.value = "";
  };

  // AI 分析生成
  const handleAIGenerate = async () => {
    const key = aiKey.trim();
    if (!key) {
      setAIError(t.errAINoKey);
      setAIPanelOpen(true);
      return;
    }
    const sql = inputText.trim();
    if (!sql) {
      setError(t.errEmpty);
      return;
    }
    setAIError(null);
    setAILoading(true);
    try {
      const parsedResult = await parseWithAI(sql, key);
      // AI 返回的已是中文，开启 comment 显示无意义；直接用 name 字段
      handleGenerate({ parsedResult });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setAIError(`${t.errAIFailed}${msg}`);
    } finally {
      setAILoading(false);
    }
  };

  // ─── 生成历史 ───────────────────────────────────────────
  // 打开历史面板：
  //  1) 立刻用 IndexedDB 里的现有数据把面板撑起来（点击不卡）；
  //  2) 在后台为当前画面拍一张矢量快照、写库；写完再静默刷新一次列表。
  // 这样用户拖动后点开面板，先看到上次的状态，约 1s 后卡片自动换成
  // 包含最新位置的缩略图 —— 不用关掉再开。
  const sortByUpdated = (xs: SnapshotRecord[]) =>
    xs.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

  const openHistory = async () => {
    try {
      const items = await Snapshots.getAll();
      setHistoryItems(sortByUpdated(items));
    } catch (e) {
      console.warn("snapshots getAll failed", e);
      setHistoryItems([]);
    }
    setHistoryOpen(true);

    if (graphRef.current && lastInputRef.current) {
      persistSnapshot({
        id: Snapshots.hashInput(lastInputRef.current),
        inputText: lastInputRef.current,
        isColored,
        showComment,
        hideFields,
      }).then(async () => {
        try {
          const fresh = await Snapshots.getAll();
          setHistoryItems(sortByUpdated(fresh));
        } catch (_) {}
      });
    }
  };

  const closeHistory = () => setHistoryOpen(false);

  const handleRestore = (snap: SnapshotRecord) => {
    restoreFromSnapshot(snap);
    setHistoryOpen(false);
  };

  const deleteSnapshot = async (id: string) => {
    try {
      await Snapshots.deleteById(id);
      setHistoryItems((prev) => prev.filter((x) => x.id !== id));
    } catch (e) {
      console.warn("snapshot delete failed", e);
    }
  };

  // 关闭历史面板的快捷键：Esc
  useEffect(() => {
    if (!historyOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeHistory();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [historyOpen]);

  // 历史面板开着时给 body 加标记，CSS 据此把右上角的语言胶囊隐去
  // —— 它的 z-index 比覆盖层高，否则会浮在卡片轨道之上。
  useEffect(() => {
    if (historyOpen) {
      document.body.classList.add("history-open");
    } else {
      document.body.classList.remove("history-open");
    }
    return () => document.body.classList.remove("history-open");
  }, [historyOpen]);

  // 时间戳格式化（按当前语言显示本地化的"几秒前 / 时间戳"）
  const formatTimestamp = (ts: number | undefined) => {
    if (!ts) return "";
    try {
      const d = new Date(ts);
      const diff = Date.now() - ts;
      const min = Math.floor(diff / 60000);
      if (min < 1) return lang === "zh" ? "刚刚" : "just now";
      if (min < 60) {
        return lang === "zh" ? `${min} 分钟前` : `${min} min ago`;
      }
      const hr = Math.floor(min / 60);
      if (hr < 24) {
        return lang === "zh" ? `${hr} 小时前` : `${hr} hr ago`;
      }
      return d.toLocaleString(lang === "zh" ? "zh-CN" : "en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch (_) {
      return "";
    }
  };

  return (
    <>
      <div className="main-content">
        <div className="input-section">
          <div className="card">
            <div
              className="card-header"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <h2 className="card-title">
                <span style={{ fontSize: "1.5rem" }}>📄</span>
                {t.cardInputTitle}
              </h2>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                }}
              >
                <SwitchControl
                  label={t.showComment}
                  checked={showComment}
                  onChange={setShowComment}
                />
              </div>
            </div>
            <div className="card-content">
              <div
                style={{
                  height: "480px",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <CodeEditor
                  value={inputText}
                  onChange={setInputText}
                  placeholder={t.editorPlaceholder}
                />
              </div>
              {/* AI 面板 */}
              <div className="ai-panel">
                <button
                  type="button"
                  className={`ai-panel-toggle ${aiPanelOpen ? "open" : ""}`}
                  onClick={() => setAIPanelOpen(!aiPanelOpen)}
                  title={t.aiPanelTitle}
                >
                  <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2a4 4 0 0 1 4 4v1h1a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2h1V6a4 4 0 0 1 4-4z"/>
                    <circle cx="12" cy="13" r="2"/>
                  </svg>
                  <span>{t.aiPanelTitle}</span>
                  <svg className="ai-chevron" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="6 9 12 15 18 9"/>
                  </svg>
                </button>
                {aiPanelOpen && (
                  <div className="ai-panel-body">
                    <p className="ai-tip">{t.aiTip}</p>
                    <div className="ai-key-row">
                      <label className="ai-key-label">{t.aiKeyLabel}</label>
                      <div className="ai-key-input-wrap">
                        <input
                          type="password"
                          className="ai-key-input"
                          placeholder={t.aiKeyPlaceholder}
                          value={aiKeyInput}
                          onChange={(e) => setAIKeyInput(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && handleSaveAIKey()}
                        />
                        <button
                          type="button"
                          className="ai-key-save-btn"
                          onClick={handleSaveAIKey}
                        >
                          {aiKeySaved ? t.aiKeySaved : t.aiKeySave}
                        </button>
                      </div>
                      <span className="ai-key-tip">{t.aiKeyTip}</span>
                    </div>
                    {aiError && <div className="ai-error">{aiError}</div>}
                  </div>
                )}
              </div>

              <div className="button-group">
                {/* 隐藏的文件选择 input */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".sql,.txt"
                  style={{ display: "none" }}
                  onChange={handleImportFile}
                />
                <button
                  className="btn btn-secondary"
                  onClick={() => fileInputRef.current?.click()}
                  title={t.btnImportSQL}
                >
                  <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 4 }}>
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="17 8 12 3 7 8"/>
                    <line x1="12" y1="3" x2="12" y2="15"/>
                  </svg>
                  {t.btnImportSQL}
                </button>
                <button
                  className="btn btn-primary"
                  onClick={() => handleGenerate()}
                  disabled={loading}
                >
                  {loading ? (
                    <div
                      className="spinner"
                      style={{ width: 20, height: 20, borderWidth: 2 }}
                    ></div>
                  ) : (t.btnGenerate as string) === (t.btnGenerateShort as string) ? (
                    // 长短标签一致（如英文）时不需要切换动效，直接渲染文本
                    t.btnGenerate
                  ) : (
                    <span
                      className="btn-primary-label-stack"
                      data-compact={exportState !== "idle"}
                    >
                      <span className="label-long">{t.btnGenerate}</span>
                      <span className="label-short">{t.btnGenerateShort}</span>
                    </span>
                  )}
                </button>
                <button
                  className="btn btn-ai"
                  onClick={handleAIGenerate}
                  disabled={aiLoading || loading}
                  title={t.aiTip}
                >
                  {aiLoading ? (
                    <>
                      <div className="spinner" style={{ width: 14, height: 14, borderWidth: 2, marginRight: 6 }} />
                      {t.btnAIAnalyzing}
                    </>
                  ) : (
                    <>
                      <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 4 }}>
                        <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                        <path d="M2 17l10 5 10-5"/>
                        <path d="M2 12l10 5 10-5"/>
                      </svg>
                      {t.btnAIAnalyze}
                    </>
                  )}
                </button>
                <div className="export-btn-wrap">
                  <button
                    ref={exportBtnRef}
                    type="button"
                    className="export-btn"
                    data-state={exportState}
                    disabled={!hasGraph}
                    onClick={onExportBtnClick}
                    onKeyDown={onExportBtnKey}
                    aria-label={t.btnExportLabel}
                  >
                    <div
                      className="export-progress"
                      style={{
                        width: `${exportProgress}%`,
                        transitionDuration:
                          exportProgress >= 100
                            ? "220ms"
                            : exportProgress > 0
                              ? "2400ms"
                              : "300ms",
                        transitionTimingFunction:
                          exportProgress >= 100
                            ? "cubic-bezier(0.2, 0.7, 0.2, 1)"
                            : exportProgress > 0
                              ? "cubic-bezier(0, 0.6, 0.2, 1)"
                              : "cubic-bezier(0, 0, 0.2, 1)",
                      }}
                    />

                    <div
                      className={`export-view export-view-idle${exportView === "idle" ? " is-on" : ""}`}
                    >
                      <span className="idle-label">{t.btnExportLabel}</span>
                      <svg
                        className="arrow-icon"
                        viewBox="0 0 14 14"
                        width="16"
                        height="16"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M7 2v7.5m0 0l-3-3m3 3l3-3M2.5 12h9" />
                      </svg>
                    </div>

                    <div
                      className={`export-view export-view-open${exportView === "open" ? " is-on" : ""}`}
                    >
                      <div className="export-opt" data-fmt="PNG">
                        <span className="export-opt-label">PNG</span>
                      </div>
                      <div className="export-sep" />
                      <div className="export-opt" data-fmt="XML">
                        <span className="export-opt-label">XML</span>
                      </div>
                      <div className="export-sep" />
                      <div className="export-opt" data-fmt="SVG">
                        <span className="export-opt-label">SVG</span>
                      </div>
                      <div className="export-sep" />
                      <div
                        className="export-cancel"
                        onClick={(e) => {
                          e.stopPropagation();
                          toExportIdle();
                        }}
                        aria-label="Cancel"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <line x1="18" x2="6" y1="6" y2="18" />
                          <line x1="6" x2="18" y1="6" y2="18" />
                        </svg>
                      </div>
                    </div>

                    <div
                      className={`export-view export-view-loading${exportView === "loading" ? " is-on" : ""}`}
                    >
                      <svg
                        className="export-spinner"
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                      </svg>
                      <span className="loading-label">
                        {t.exportGenerating} {exportFmt}...
                      </span>
                    </div>

                    <div
                      className={`export-view export-view-success${exportView === "success" ? " is-on" : ""}`}
                    >
                      <svg
                        className="check-icon"
                        viewBox="0 0 14 14"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M2.5 7.2l3 3 6-6" />
                      </svg>
                      <span className="success-label">{t.exportSaved}</span>
                    </div>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="output-section">
          <div className="card">
            <div
              className="card-header"
              style={{ flexWrap: "wrap", gap: "16px", height: "auto" }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "24px",
                  flex: 1,
                  minWidth: "300px",
                }}
              >
                <h2 className="card-title" style={{ whiteSpace: "nowrap" }}>
                  <span style={{ fontSize: "1.5rem" }}>🎨</span>
                  {t.cardPreviewTitle}
                </h2>

                <div
                  style={{
                    display: "flex",
                    gap: "8px",
                    alignItems: "center",
                    flexWrap: "wrap",
                  }}
                >
                  <div
                    className="legend-item"
                    style={{ padding: "4px 10px", fontSize: "0.8rem" }}
                  >
                    <div
                      style={{
                        width: "10px",
                        height: "10px",
                        borderRadius: "3px",
                        background: isColored ? "#e0f2fe" : "#fff",
                        border: isColored
                          ? "2px solid #0ea5e9"
                          : "2px solid #1e293b",
                      }}
                    ></div>
                    <span>{t.legendEntity}</span>
                  </div>
                  <div
                    className="legend-item"
                    style={{ padding: "4px 10px", fontSize: "0.8rem" }}
                  >
                    <div
                      style={{
                        width: "10px",
                        height: "10px",
                        transform: "rotate(45deg)",
                        background: isColored ? "#f5f3ff" : "#fff",
                        border: isColored
                          ? "2px solid #8b5cf6"
                          : "2px solid #1e293b",
                      }}
                    ></div>
                    <span style={{ marginLeft: "4px" }}>
                      {t.legendRelation}
                    </span>
                  </div>
                  <div
                    className="legend-item"
                    style={{ padding: "4px 10px", fontSize: "0.8rem" }}
                  >
                    <div
                      style={{
                        width: "10px",
                        height: "10px",
                        borderRadius: "50%",
                        background: isColored ? "#fff" : "#fff",
                        border: isColored
                          ? "2px solid #94a3b8"
                          : "1px solid #1e293b",
                      }}
                    ></div>
                    <span>{t.legendAttribute}</span>
                  </div>
                  <div
                    className="legend-item"
                    style={{ padding: "4px 10px", fontSize: "0.8rem" }}
                  >
                    <div
                      style={{
                        width: "10px",
                        height: "10px",
                        borderRadius: "50%",
                        background: isColored ? "#ecfdf5" : "#fff",
                        border: isColored
                          ? "2px solid #10b981"
                          : "2px solid #1e293b",
                      }}
                    ></div>
                    <span style={{ fontWeight: 600 }}>{t.legendPk}</span>
                  </div>
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "16px",
                  marginLeft: "auto",
                }}
              >
                <button
                  className="btn btn-sm btn-accent"
                  onClick={handleArrangeLayout}
                  disabled={!hasGraph || loading}
                >
                  {t.btnSmartLayout}
                </button>
                <button
                  className="btn btn-sm btn-accent"
                  onClick={handleForceAlign}
                  disabled={!hasGraph || loading}
                >
                  {t.btnForceAlign}
                </button>
              </div>
            </div>

            <div
              className="card-content"
              style={{
                position: "relative",
                padding: 0,
                display: "flex",
                flexDirection: "column",
                height: "100%",
              }}
            >
              <div
                className={`diagram-container ${showBackground ? "" : "no-grid"}`}
                style={{ border: "none", borderRadius: 0 }}
              >
                <div
                  className="background-toggle"
                  onClick={handleToggleBackground}
                  title={showBackground ? t.tipHideBg : t.tipShowBg}
                >
                  {showBackground ? <EyeIcon /> : <EyeSlashIcon />}
                </div>
                <div
                  className={`colorize-toggle ${isColored ? "active" : ""}`}
                  onClick={() => setIsColored(!isColored)}
                  title={isColored ? t.tipColorOff : t.tipColorOn}
                >
                  <PaletteIcon />
                </div>
                <div
                  className={`attrs-toggle ${hideFields ? "active" : ""}`}
                  onClick={() => setHideFields(!hideFields)}
                  title={hideFields ? t.tipShowAttrs : t.tipHideAttrs}
                >
                  <ListUlIcon />
                </div>
                <div
                  className="history-toggle"
                  onClick={openHistory}
                  title={t.tipHistory}
                >
                  <ClockRotateLeftIcon />
                </div>
                <div
                  className={`force-toggle ${forceOn ? "active" : ""}`}
                  onClick={() => setForceOn(!forceOn)}
                  title={forceOn ? t.tipForceOff : t.tipForceOn}
                >
                  <CircleNodesIcon />
                </div>
                {loading && (
                  <div className="loading-overlay">
                    <div className="spinner"></div>
                  </div>
                )}
                {error && (
                  <div className="diagram-error-overlay">
                    <div className="error-message">⚠️ {error}</div>
                  </div>
                )}
                <div
                  ref={containerRef}
                  style={{
                    width: "100%",
                    height: "100%",
                    position: "relative",
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
      <HistoryOverlay
        open={historyOpen}
        items={historyItems}
        t={t}
        onClose={closeHistory}
        onRestore={handleRestore}
        onDelete={deleteSnapshot}
        formatTimestamp={formatTimestamp}
      />
    </>
  );
};

export default App;
