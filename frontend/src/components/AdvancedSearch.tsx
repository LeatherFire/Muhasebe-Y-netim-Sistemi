'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Search, Filter, X, Calendar, DollarSign, User, Building, Tag, SortAsc, SortDesc } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/ui/loading';

interface SearchFilter {
  key: string;
  value: string;
  label: string;
  type: 'text' | 'amount' | 'date' | 'select' | 'person' | 'category';
}

interface AdvancedSearchProps {
  placeholder?: string;
  onSearch: (query: string, filters: SearchFilter[]) => void;
  onClear?: () => void;
  filterOptions?: {
    categories?: string[];
    people?: { id: string; name: string }[];
    statuses?: string[];
    paymentMethods?: string[];
    dateRanges?: { key: string; label: string }[];
  };
  quickFilters?: { key: string; label: string; value: string }[];
  className?: string;
  loading?: boolean;
}

export default function AdvancedSearch({
  placeholder = "Ara...",
  onSearch,
  onClear,
  filterOptions = {},
  quickFilters = [],
  className = "",
  loading = false
}: AdvancedSearchProps) {
  const [query, setQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [activeFilters, setActiveFilters] = useState<SearchFilter[]>([]);
  const [sortBy, setSortBy] = useState<string>('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      handleSearch();
    }, 300);

    return () => clearTimeout(timer);
  }, [query, activeFilters, sortBy, sortOrder]);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearch = () => {
    onSearch(query, activeFilters);
  };

  const handleClear = () => {
    setQuery('');
    setActiveFilters([]);
    setSortBy('');
    setSortOrder('desc');
    setSuggestions([]);
    setShowSuggestions(false);
    if (onClear) onClear();
  };

  const addFilter = (filter: SearchFilter) => {
    const exists = activeFilters.find(f => f.key === filter.key && f.value === filter.value);
    if (!exists) {
      setActiveFilters([...activeFilters, filter]);
    }
  };

  const removeFilter = (index: number) => {
    setActiveFilters(activeFilters.filter((_, i) => i !== index));
  };

  const addQuickFilter = (quickFilter: { key: string; label: string; value: string }) => {
    const filter: SearchFilter = {
      key: quickFilter.key,
      value: quickFilter.value,
      label: quickFilter.label,
      type: 'select'
    };
    addFilter(filter);
  };

  const handleQueryChange = (value: string) => {
    setQuery(value);
    
    // Simple suggestion generation based on query
    if (value.length > 2) {
      const mockSuggestions = [
        value + " ödeme",
        value + " fatura", 
        value + " transfer",
        value + " nakit"
      ];
      setSuggestions(mockSuggestions);
      setShowSuggestions(true);
    } else {
      setShowSuggestions(false);
    }
  };

  const selectSuggestion = (suggestion: string) => {
    setQuery(suggestion);
    setShowSuggestions(false);
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Main Search Bar */}
      <div className="relative" ref={searchRef}>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            type="text"
            placeholder={placeholder}
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            className="pl-10 pr-20"
            onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
          />
          <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex items-center space-x-1">
            {loading && <LoadingSpinner size="sm" />}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
              className="p-1"
            >
              <Filter className="h-4 w-4" />
            </Button>
            {(query || activeFilters.length > 0) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClear}
                className="p-1 text-gray-500 hover:text-gray-700"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Search Suggestions */}
        {showSuggestions && suggestions.length > 0 && (
          <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-md shadow-lg z-50 mt-1">
            {suggestions.map((suggestion, index) => (
              <button
                key={index}
                onClick={() => selectSuggestion(suggestion)}
                className="w-full text-left px-4 py-2 hover:bg-gray-50 text-sm"
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Quick Filters */}
      {quickFilters.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <span className="text-sm text-gray-500 mr-2">Hızlı filtreler:</span>
          {quickFilters.map((filter, index) => (
            <Badge
              key={index}
              variant="outline"
              className="cursor-pointer hover:bg-gray-50"
              onClick={() => addQuickFilter(filter)}
            >
              {filter.label}
            </Badge>
          ))}
        </div>
      )}

      {/* Active Filters */}
      {activeFilters.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <span className="text-sm text-gray-500 mr-2">Aktif filtreler:</span>
          {activeFilters.map((filter, index) => (
            <Badge key={index} className="flex items-center gap-1">
              {filter.label}: {filter.value}
              <X
                className="h-3 w-3 cursor-pointer hover:text-red-500"
                onClick={() => removeFilter(index)}
              />
            </Badge>
          ))}
        </div>
      )}

      {/* Advanced Filters Panel */}
      {showFilters && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Gelişmiş Filtreler</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Amount Range */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Tutar Aralığı</label>
                <div className="flex space-x-2">
                  <Input
                    type="number"
                    placeholder="Min"
                    onChange={(e) => {
                      if (e.target.value) {
                        addFilter({
                          key: 'amount_min',
                          value: e.target.value,
                          label: 'Min Tutar',
                          type: 'amount'
                        });
                      }
                    }}
                  />
                  <Input
                    type="number"
                    placeholder="Max"
                    onChange={(e) => {
                      if (e.target.value) {
                        addFilter({
                          key: 'amount_max',
                          value: e.target.value,
                          label: 'Max Tutar',
                          type: 'amount'
                        });
                      }
                    }}
                  />
                </div>
              </div>

              {/* Date Range */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Tarih Aralığı</label>
                <div className="flex space-x-2">
                  <Input
                    type="date"
                    onChange={(e) => {
                      if (e.target.value) {
                        addFilter({
                          key: 'start_date',
                          value: e.target.value,
                          label: 'Başlangıç',
                          type: 'date'
                        });
                      }
                    }}
                  />
                  <Input
                    type="date"
                    onChange={(e) => {
                      if (e.target.value) {
                        addFilter({
                          key: 'end_date',
                          value: e.target.value,
                          label: 'Bitiş',
                          type: 'date'
                        });
                      }
                    }}
                  />
                </div>
              </div>

              {/* Category Filter */}
              {filterOptions.categories && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Kategori</label>
                  <Select onValueChange={(value) => {
                    const category = filterOptions.categories?.find(cat => cat === value);
                    if (category) {
                      addFilter({
                        key: 'category',
                        value: category,
                        label: 'Kategori',
                        type: 'category'
                      });
                    }
                  }}>
                    <SelectTrigger>
                      <SelectValue placeholder="Kategori seçin" />
                    </SelectTrigger>
                    <SelectContent>
                      {filterOptions.categories.map((category) => (
                        <SelectItem key={category} value={category}>
                          {category}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Person Filter */}
              {filterOptions.people && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Kişi/Kurum</label>
                  <Select onValueChange={(value) => {
                    const person = filterOptions.people?.find(p => p.id === value);
                    if (person) {
                      addFilter({
                        key: 'person_id',
                        value: person.id,
                        label: person.name,
                        type: 'person'
                      });
                    }
                  }}>
                    <SelectTrigger>
                      <SelectValue placeholder="Kişi seçin" />
                    </SelectTrigger>
                    <SelectContent>
                      {filterOptions.people.map((person) => (
                        <SelectItem key={person.id} value={person.id}>
                          {person.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Status Filter */}
              {filterOptions.statuses && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Durum</label>
                  <Select onValueChange={(value) => {
                    addFilter({
                      key: 'status',
                      value: value,
                      label: `Durum: ${value}`,
                      type: 'select'
                    });
                  }}>
                    <SelectTrigger>
                      <SelectValue placeholder="Durum seçin" />
                    </SelectTrigger>
                    <SelectContent>
                      {filterOptions.statuses.map((status) => (
                        <SelectItem key={status} value={status}>
                          {status}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Sort Options */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Sıralama</label>
                <div className="flex space-x-2">
                  <Select value={sortBy} onValueChange={setSortBy}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sırala" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="date">Tarih</SelectItem>
                      <SelectItem value="amount">Tutar</SelectItem>
                      <SelectItem value="name">İsim</SelectItem>
                      <SelectItem value="status">Durum</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                    className="p-2"
                  >
                    {sortOrder === 'asc' ? <SortAsc className="h-4 w-4" /> : <SortDesc className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}