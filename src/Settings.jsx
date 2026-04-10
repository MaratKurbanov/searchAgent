export default function Settings({
  matchThreshold,
  setMatchThreshold,
  maxResults,
  setMaxResults,
  contextExpansion,
  setContextExpansion,
  rewriteQuery,
  setRewriteQuery,
  reRankResults,
  setReRankResults,
  isOpen,
}) {
  return (
    <aside className={`side-panel ${isOpen ? 'open' : 'closed'}`}>
      <div className="panel-header">
        <h2>Settings</h2>
      </div>

      {/* Slider Settings */}
      <div className="settings-group">
        <label htmlFor="match-threshold" className="setting-label">
          Match Threshold
        </label>
        <div className="setting-input-group">
          <input
            id="match-threshold"
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={matchThreshold}
            onChange={(e) => setMatchThreshold(parseFloat(e.target.value))}
            className="slider"
          />
          <span className="value-display">{matchThreshold.toFixed(1)}</span>
        </div>
        <p className="setting-description">Controls how strictly results match the query (0.0 to 1.0)</p>
      </div>

      <div className="settings-group">
        <label htmlFor="max-results" className="setting-label">
          Maximum Results
        </label>
        <div className="setting-input-group">
          <input
            id="max-results"
            type="range"
            min="1"
            max="50"
            step="1"
            value={maxResults}
            onChange={(e) => setMaxResults(parseInt(e.target.value))}
            className="slider"
          />
          <span className="value-display">{maxResults}</span>
        </div>
        <p className="setting-description">Number of search results to return</p>
      </div>

      <div className="settings-group">
        <label htmlFor="context-expansion" className="setting-label">
          Context Expansion
        </label>
        <div className="setting-input-group">
          <input
            id="context-expansion"
            type="range"
            min="0"
            max="5"
            step="0.5"
            value={contextExpansion}
            onChange={(e) => setContextExpansion(parseFloat(e.target.value))}
            className="slider"
          />
          <span className="value-display">{contextExpansion.toFixed(1)}</span>
        </div>
        <p className="setting-description">Amount of context to include in responses</p>
      </div>

      {/* Checkbox Settings */}
      <div className="settings-divider"></div>

      <div className="settings-group">
        <label htmlFor="rewrite-query" className="checkbox-label">
          <input
            id="rewrite-query"
            type="checkbox"
            checked={rewriteQuery}
            onChange={(e) => setRewriteQuery(e.target.checked)}
            className="checkbox"
          />
          <span>Rewrite Query</span>
        </label>
        <p className="setting-description">Automatically rewrite queries for better results</p>
      </div>

      <div className="settings-group">
        <label htmlFor="re-rank-results" className="checkbox-label">
          <input
            id="re-rank-results"
            type="checkbox"
            checked={reRankResults}
            onChange={(e) => setReRankResults(e.target.checked)}
            className="checkbox"
          />
          <span>Re-rank Results</span>
        </label>
        <p className="setting-description">Re-rank results based on relevance scoring</p>
      </div>
    </aside>
  )
}
