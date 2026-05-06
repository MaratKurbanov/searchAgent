import ChatView from './ChatView'

export default function ChatPageWrapper({ apiUrl, matchThreshold, maxResults, contextExpansion, rewriteQuery, reRankResults }) {
  return (
    <ChatView
      apiUrl={apiUrl}
      matchThreshold={matchThreshold}
      maxResults={maxResults}
      contextExpansion={contextExpansion}
      rewriteQuery={rewriteQuery}
      reRankResults={reRankResults}
    />
  )
}
