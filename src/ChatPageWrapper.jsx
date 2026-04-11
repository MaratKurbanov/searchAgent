import { useRef, useEffect } from 'react'

export default function ChatPageWrapper({
  apiUrl,
  matchThreshold,
  maxResults,
  contextExpansion,
  rewriteQuery,
  reRankResults,
  theme = 'auto',
}) {
  const chatPageRef = useRef(null)

  useEffect(() => {
    if (!chatPageRef.current) return

    // Wait for the chat-page-snippet to be fully loaded
    const checkAndCollapse = () => {
      if (chatPageRef.current && typeof chatPageRef.current.toggleSidebar === 'function') {
        // Collapse the sidebar by calling toggleSidebar
        chatPageRef.current.toggleSidebar()
      } else {
        // Retry after a short delay if method isn't available yet
        setTimeout(checkAndCollapse, 100)
      }
    }

    // Start checking after a small delay to ensure component is mounted
    const timeoutId = setTimeout(checkAndCollapse, 200)

    return () => clearTimeout(timeoutId)
  }, [])

  return (
    <>
      {/* @ts-ignore */}
      <chat-page-snippet
        ref={chatPageRef}
        api-url={apiUrl}
        theme={theme}
        data-match-threshold={matchThreshold}
        data-max-results={maxResults}
        data-context-expansion={contextExpansion}
        data-rewrite-query={rewriteQuery}
        data-re-rank-results={reRankResults}
      />
    </>
  )
}
