import { useState, useCallback, useMemo } from 'react';

export type NavigationMode = 'guided' | 'open';

export interface UseSectionNavigationOptions {
  sections: readonly string[];
  mode?: NavigationMode;
  initialSection?: string;
  requireLocation?: boolean;
}

/**
 * Hook for managing section navigation
 * Supports both guided flow (create) and open flow (edit)
 */
export function useSectionNavigation(options: UseSectionNavigationOptions) {
  const {
    sections,
    mode = 'open',
    initialSection = 'welcome',
    requireLocation = false,
  } = options;

  const [currentSection, setCurrentSection] = useState(initialSection);
  const [visitedSections, setVisitedSections] = useState<string[]>([initialSection]);

  // In guided mode, only allow visiting sections that have been reached
  const allowedSections = useMemo(() => {
    if (mode === 'open') {
      return [...sections];
    }

    // Guided mode: include all visited sections plus the next unvisited one
    const visitedSet = new Set(visitedSections);
    const allowed = sections.filter(s => visitedSet.has(s));

    // Add the next section if exists
    const lastVisitedIndex = sections.findIndex(s => s === visitedSections[visitedSections.length - 1]);
    if (lastVisitedIndex >= 0 && lastVisitedIndex < sections.length - 1) {
      allowed.push(sections[lastVisitedIndex + 1]);
    }

    return allowed;
  }, [sections, visitedSections, mode]);

  /**
   * Navigate to a specific section
   */
  const goToSection = useCallback((section: string) => {
    if (mode === 'open') {
      setCurrentSection(section);
      return;
    }

    // Guided mode: check if section is allowed
    if (allowedSections.includes(section)) {
      setCurrentSection(section);
      if (!visitedSections.includes(section)) {
        setVisitedSections(prev => [...prev, section]);
      }
    }
  }, [mode, allowedSections, visitedSections]);

  /**
   * Navigate to the next section
   */
  const goNext = useCallback(() => {
    const currentIndex = sections.indexOf(currentSection);
    if (currentIndex >= 0 && currentIndex < sections.length - 1) {
      const nextSection = sections[currentIndex + 1];
      goToSection(nextSection);
    }
  }, [sections, currentSection, goToSection]);

  /**
   * Navigate to the previous section
   */
  const goPrevious = useCallback(() => {
    const currentIndex = sections.indexOf(currentSection);
    if (currentIndex > 0) {
      const prevSection = sections[currentIndex - 1];
      goToSection(prevSection);
    }
  }, [sections, currentSection, goToSection]);

  /**
   * Check if we can advance from current section
   */
  const canAdvance = useCallback((location?: string) => {
    // If location is required and we're on welcome, check location
    if (requireLocation && currentSection === 'welcome') {
      return Boolean(location && location.trim());
    }
    return true;
  }, [currentSection, requireLocation]);

  /**
   * Check if we've reached the end
   */
  const hasReachedEnd = useMemo(() => {
    return currentSection === sections[sections.length - 1];
  }, [currentSection, sections]);

  /**
   * Check if a section is accessible
   */
  const isSectionAccessible = useCallback((section: string) => {
    return allowedSections.includes(section);
  }, [allowedSections]);

  return {
    currentSection,
    setCurrentSection,
    visitedSections,
    allowedSections,
    goToSection,
    goNext,
    goPrevious,
    canAdvance,
    hasReachedEnd,
    isSectionAccessible,
  };
}
