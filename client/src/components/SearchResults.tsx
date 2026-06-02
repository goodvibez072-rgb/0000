import { useState, useEffect, useRef, memo, useCallback } from 'react';
import { Link } from 'wouter';
import { Search, Loader2, X, BookOpen, Star, Clock } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useSearch } from '@/hooks/useSearch';

interface SearchResult {
  id: string;
  title: string;
  description?: string;
  author?: string;
  artist?: string;
  status: string;
  type: string;
  genres: string[];
  coverImageUrl?: string;
  rating?: string;
  totalChapters?: number;
  publishedYear?: number;
}

interface SearchResultsProps {
  query: string;
  filters?: { genre?: string; status?: string; type?: string };
  isOpen: boolean;
  onClose: () => void;
  onResultClick: () => void;
  browseMode?: boolean;
}

export default function SearchResults({ query, filters, isOpen, onClose, onResultClick, browseMode = false }: SearchResultsProps) {
  const hasFilters = !!(filters?.genre || filters?.status || filters?.type);
  const shouldSearch = !!query?.trim() || hasFilters || browseMode;
  const { results, total, isLoading, error, isEmpty } = useSearch(query, filters, isOpen && shouldSearch, browseMode);
  const resultsRef = useRef<HTMLDivElement>(null);

  // Close search results when clicking outside
  const handleClickOutside = useCallback((event: MouseEvent) => {
    if (resultsRef.current && !resultsRef.current.contains(event.target as Node)) {
      onClose();
    }
  }, [onClose]);

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen, handleClickOutside]);

  // Don't render if not open or no query/filters
  if (!isOpen || !shouldSearch) {
    return null;
  }

  return (
    <div className="absolute top-full left-0 right-0 mt-2 z-50">
      {/* Aria-live region for search results - Accessibility Enhancement */}
      <div aria-live="polite" aria-atomic="false" className="sr-only">
        {isLoading && <span>Searching for {query}...</span>}
        {!isLoading && results.length > 0 && <span>Found {total} results for {query}</span>}
        {!isLoading && isEmpty && <span>No results found for {query}</span>}
      </div>
      
      <Card 
        ref={resultsRef}
        className="bg-card/95 backdrop-blur-md border-card-border/50 shadow-xl overflow-hidden flex flex-col"
        role="region"
        aria-label="Search results"
      >
        <CardContent className="p-0 flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-card-border/30">
            <div className="flex items-center space-x-2">
              <Search className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">
                {isLoading ? 'Searching...' : query?.trim() ? `${total} results for "${query}"` : `${total} results`}
              </span>
            </div>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={onClose}
              className="h-6 w-6 hover:bg-muted/50"
              aria-label="Close search results"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>

          {/* Loading state */}
          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
              <span className="ml-2 text-sm text-muted-foreground">Searching...</span>
            </div>
          )}

          {/* Error state */}
          {error && (
            <div className="p-4 text-center text-destructive">
              <p>Search failed. Please try again.</p>
            </div>
          )}

          {/* Empty state */}
          {isEmpty && !isLoading && (
            <div className="p-4 text-center text-muted-foreground">
              <BookOpen className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>{query?.trim() ? `No manga found for "${query}"` : 'No manga found with selected filters'}</p>
              <p className="text-xs mt-1">Try different {query?.trim() ? 'keywords' : 'filters'} or check spelling</p>
            </div>
          )}

          {/* Results */}
          {results.length > 0 && !isLoading && (
            <>
              <div className="max-h-80 overflow-y-auto flex-1">
                {results.map((result) => (
                  <SearchResultItem 
                    key={result.id} 
                    result={result} 
                    onResultClick={onResultClick}
                    onClose={onClose}
                  />
                ))}
              </div>

              {/* View all results footer */}
              <div className="border-t border-card-border/30 p-3 flex-shrink-0">
                <Link href={`/browse${query?.trim() ? `?q=${encodeURIComponent(query)}` : ''}${filters?.genre ? `${query?.trim() ? '&' : '?'}genre=${encodeURIComponent(filters.genre)}` : ''}${filters?.status ? `${query?.trim() || filters?.genre ? '&' : '?'}status=${encodeURIComponent(filters.status)}` : ''}`}>
                  <Button 
                    variant="ghost" 
                    className="w-full text-sm hover:bg-primary/10"
                    onClick={() => {
                      onResultClick();
                      onClose();
                    }}
                  >
                    View all {total} results
                  </Button>
                </Link>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

interface SearchResultItemProps {
  result: SearchResult;
  onResultClick: () => void;
  onClose: () => void;
}

const SearchResultItem = memo(function SearchResultItem({ result, onResultClick, onClose }: SearchResultItemProps) {
  const handleClick = useCallback(() => {
    onResultClick();
    onClose();
  }, [onResultClick, onClose]);

  return (
    <Link href={`/manga/${result.id}`}>
      <div 
        className="p-3 hover:bg-muted/30 cursor-pointer transition-colors border-b border-card-border/20 last:border-b-0"
        onClick={handleClick}
      >
        <div className="flex space-x-3">
          {/* Cover Image */}
          <div className="flex-shrink-0">
            <div className="w-12 h-16 bg-muted rounded overflow-hidden">
              {result.coverImageUrl ? (
                <img 
                  src={result.coverImageUrl} 
                  alt={result.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <BookOpen className="w-6 h-6 text-muted-foreground/50" />
                </div>
              )}
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-sm truncate">{result.title}</h3>
            
            {result.author && (
              <p className="text-xs text-muted-foreground truncate">
                by {result.author}
              </p>
            )}

            <div className="flex items-center space-x-2 mt-2">
              <Badge variant="secondary" className="text-xs">
                {result.type}
              </Badge>
              
              {result.status && (
                <Badge 
                  variant={result.status === 'completed' ? 'default' : 'outline'} 
                  className="text-xs"
                >
                  {result.status}
                </Badge>
              )}

              {result.rating && (
                <div className="flex items-center space-x-1">
                  <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                  <span className="text-xs text-muted-foreground">{result.rating}</span>
                </div>
              )}

              {result.totalChapters && (
                <div className="flex items-center space-x-1">
                  <Clock className="w-3 h-3 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">{result.totalChapters} ch</span>
                </div>
              )}
            </div>

            {result.genres.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {result.genres.slice(0, 3).map((genre) => (
                  <Badge key={genre} variant="outline" className="text-xs">
                    {genre}
                  </Badge>
                ))}
                {result.genres.length > 3 && (
                  <span className="text-xs text-muted-foreground">+{result.genres.length - 3}</span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
});