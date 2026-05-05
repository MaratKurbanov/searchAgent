export default function SearchBarWrapper({ apiUrl }) {
  return (
    <>
      {/* @ts-ignore */}
      <search-bar-snippet
        api-url={apiUrl}
        theme="auto"
        placeholder="Search..."
        show-url="true"
        show-date="true"
      />
    </>
  )
}
