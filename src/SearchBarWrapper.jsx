import SearchResults from './SearchResults'

export default function SearchBarWrapper({ apiUrl, user, bookmarkMap, onBookmark }) {
  return <SearchResults apiUrl={apiUrl} user={user} bookmarkMap={bookmarkMap} onBookmark={onBookmark} />
}
