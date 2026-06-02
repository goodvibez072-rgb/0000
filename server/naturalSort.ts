/**
 * Natural sorting algorithm for chapter page ordering with confidence scoring
 * Handles various filename formats and provides confidence metrics for manual reorder detection
 */

interface FileItem {
  path: string;
  originalName: string;
  size: number;
}

interface SortResult {
  sortedFiles: FileItem[];
  confidence: number;
  requiresManualReorder: boolean;
  metadata: {
    hasNumericSequences: boolean;
    consistentPadding: boolean;
    sequentialNumbers: boolean;
    gapCount: number;
    duplicateNumbers: number;
    totalFiles: number;
  };
}

/**
 * Extract numeric sequences from filename
 * Handles: "page_1.jpg", "01 - title.png", "001 (scan).jpg", "chapter01page05.png"
 */
function extractNumericSequences(filename: string): number[] {
  // Remove file extension and convert to lowercase for consistent processing
  const nameWithoutExt = filename.replace(/\.[^/.]+$/, '').toLowerCase();
  
  // Find all numeric sequences (handles zero-padding)
  const numericMatches = nameWithoutExt.match(/\d+/g);
  
  if (!numericMatches) return [];
  
  // Convert to numbers and remove leading zeros by parsing as integers
  return numericMatches.map(match => parseInt(match, 10));
}

/**
 * Determine the primary sorting number from a filename
 * Uses heuristics to identify the most likely page number
 */
function getPrimaryNumber(filename: string): number {
  const numbers = extractNumericSequences(filename);
  
  if (numbers.length === 0) {
    // Fall back to character code sorting for non-numeric files
    return filename.charCodeAt(0) || 0;
  }
  
  if (numbers.length === 1) {
    return numbers[0];
  }
  
  // For multiple numbers, use heuristics to find the page number
  // Prefer the largest number (often the page number in "chapter01page05" format)
  // Or the last number (common in "01 - title 05" format)
  const lastNumber = numbers[numbers.length - 1];
  const maxNumber = Math.max(...numbers);
  
  // If the last number is reasonably large, use it (likely page number)
  // Otherwise use the max number
  return lastNumber >= 1 ? lastNumber : maxNumber;
}

/**
 * Check if numbers form a reasonable sequence (for confidence scoring)
 * Relaxed heuristic to allow sequences starting at 0 or other numbers
 */
function analyzeSequence(numbers: number[]): {
  isSequential: boolean;
  gapCount: number;
  duplicateCount: number;
  hasConsistentPadding: boolean;
} {
  if (numbers.length <= 1) {
    return {
      isSequential: true,
      gapCount: 0,
      duplicateCount: 0,
      hasConsistentPadding: true
    };
  }
  
  const sorted = [...numbers].sort((a, b) => a - b);
  let gapCount = 0;
  let duplicateCount = 0;
  
  // Check for gaps and duplicates
  for (let i = 1; i < sorted.length; i++) {
    const diff = sorted[i] - sorted[i - 1];
    if (diff === 0) {
      duplicateCount++;
    } else if (diff > 1) {
      gapCount++;
    }
  }
  
  // Relaxed sequential check: allow sequences starting at 0, 1, or other reasonable starting points
  // Tolerate small leading gaps (e.g., 3,4,5,6 or 0,1,2,3)
  const minValue = sorted[0];
  const maxValue = sorted[sorted.length - 1];
  const range = maxValue - minValue + 1;
  const actualCount = sorted.length;
  const missingCount = range - actualCount;
  
  // Consider sequential if:
  // 1. Starts from 0 or 1, OR
  // 2. Has reasonable starting point (not too high) and good coverage
  // 3. Tolerates some gaps but not too many
  const reasonableStart = minValue <= 3; // Allow starting from 0, 1, 2, or 3
  const goodCoverage = missingCount <= Math.ceil(actualCount * 0.3); // Allow 30% missing values
  const lowGapRatio = gapCount <= Math.ceil(sorted.length * 0.25); // Allow 25% gaps
  
  const isSequential = reasonableStart && goodCoverage && lowGapRatio;
  
  return {
    isSequential,
    gapCount,
    duplicateCount,
    hasConsistentPadding: true // We'll check this separately with original strings
  };
}

/**
 * Check padding consistency in original filenames
 * Now properly detects padding consistency across all primary numeric tokens
 */
function checkPaddingConsistency(filenames: string[]): boolean {
  if (filenames.length === 0) return true;
  
  // Extract primary numeric tokens from each filename
  const primaryNumericTokens = filenames.map(filename => {
    const nameWithoutExt = filename.replace(/\.[^/.]+$/, '');
    const matches = nameWithoutExt.match(/\d+/g);
    if (!matches || matches.length === 0) return null;
    
    // Get the primary numeric token (using same logic as getPrimaryNumber)
    const numbers = matches.map(match => parseInt(match, 10));
    let primaryValue: number;
    
    if (numbers.length === 1) {
      primaryValue = numbers[0];
    } else {
      const lastNumber = numbers[numbers.length - 1];
      const maxNumber = Math.max(...numbers);
      primaryValue = lastNumber >= 1 ? lastNumber : maxNumber;
    }
    
    // Find the corresponding string token for this primary value
    const primaryToken = matches.find(match => parseInt(match, 10) === primaryValue);
    return primaryToken || null;
  }).filter(token => token !== null) as string[];
  
  if (primaryNumericTokens.length <= 1) return true;
  
  // Check if all primary tokens have consistent padding width
  const firstTokenLength = primaryNumericTokens[0].length;
  const allSameLength = primaryNumericTokens.every(token => token.length === firstTokenLength);
  
  if (!allSameLength) return false;
  
  // Additional check: ensure tokens that represent the same value have same padding
  const valueGroups = new Map<number, string[]>();
  primaryNumericTokens.forEach(token => {
    const value = parseInt(token, 10);
    if (!valueGroups.has(value)) {
      valueGroups.set(value, []);
    }
    valueGroups.get(value)!.push(token);
  });
  
  // Check if same values have same padding
  for (const [value, tokens] of Array.from(valueGroups)) {
    if (tokens.length > 1) {
      const firstLength = tokens[0].length;
      if (!tokens.every((token: string) => token.length === firstLength)) {
        return false;
      }
    }
  }
  
  return true;
}

/**
 * Calculate confidence score based on various factors
 * Re-tuned for improved accuracy with relaxed heuristics
 */
function calculateConfidence(files: FileItem[], metadata: SortResult['metadata']): number {
  let confidence = 1.0;
  const totalFiles = files.length;
  
  // Base confidence reduction for small sets (more lenient)
  if (totalFiles < 2) {
    confidence *= 0.95; // Single file is usually fine
  } else if (totalFiles < 4) {
    confidence *= 0.92; // Small sets get minor penalty
  }
  
  // Reduce confidence if no numeric sequences found
  if (!metadata.hasNumericSequences) {
    confidence *= 0.2; // Heavy penalty for non-numeric files
  }
  
  // Reduce confidence for gaps in sequence (more lenient with improved heuristics)
  if (metadata.gapCount > 0) {
    const gapRatio = metadata.gapCount / totalFiles;
    if (gapRatio > 0.4) {
      // High gap ratio is problematic
      confidence *= 0.4;
    } else if (gapRatio > 0.2) {
      // Moderate gaps are acceptable with warning
      confidence *= 0.7;
    } else {
      // Small gaps are fine with minor penalty
      confidence *= 0.85;
    }
  }
  
  // Reduce confidence for duplicate numbers
  if (metadata.duplicateNumbers > 0) {
    const dupRatio = metadata.duplicateNumbers / totalFiles;
    if (dupRatio > 0.3) {
      // High duplicate ratio is very problematic
      confidence *= 0.3;
    } else if (dupRatio > 0.1) {
      // Some duplicates need attention
      confidence *= 0.6;
    } else {
      // Few duplicates get minor penalty
      confidence *= 0.8;
    }
  }
  
  // Reduce confidence for inconsistent padding (more lenient)
  if (!metadata.consistentPadding) {
    confidence *= 0.75; // Slightly less penalty since we improved detection
  }
  
  // Reduce confidence if not sequential (more lenient with improved heuristics)
  if (!metadata.sequentialNumbers) {
    confidence *= 0.8; // Less penalty since we now allow sequences starting from 0 and small gaps
  }
  
  return Math.max(0.0, Math.min(1.0, confidence));
}

/**
 * Natural sort with confidence scoring for chapter pages
 */
export function naturalSortWithConfidence(files: FileItem[]): SortResult {
  if (files.length === 0) {
    return {
      sortedFiles: [],
      confidence: 1.0,
      requiresManualReorder: false,
      metadata: {
        hasNumericSequences: false,
        consistentPadding: true,
        sequentialNumbers: true,
        gapCount: 0,
        duplicateNumbers: 0,
        totalFiles: 0
      }
    };
  }
  
  // Flatten nested folder structures - extract just the filename
  const processedFiles = files.map(file => ({
    ...file,
    // Extract filename from path, handling nested folders
    sortingName: file.originalName.split('/').pop() || file.originalName
  }));
  
  // Extract primary numbers for each file
  const filesWithNumbers = processedFiles.map(file => ({
    ...file,
    primaryNumber: getPrimaryNumber(file.sortingName),
    hasNumeric: extractNumericSequences(file.sortingName).length > 0
  }));
  
  // Check if any files have numeric sequences
  const hasNumericSequences = filesWithNumbers.some(f => f.hasNumeric);
  
  // Sort files using natural order
  const sortedFiles = filesWithNumbers.sort((a, b) => {
    // Primary sort by number
    if (a.primaryNumber !== b.primaryNumber) {
      return a.primaryNumber - b.primaryNumber;
    }
    
    // Secondary sort by full filename (natural comparison)
    return a.sortingName.localeCompare(b.sortingName, undefined, { 
      numeric: true, 
      sensitivity: 'base' 
    });
  });
  
  // Analyze the sequence for confidence scoring
  const primaryNumbers = filesWithNumbers.map(f => f.primaryNumber);
  const sequenceAnalysis = analyzeSequence(primaryNumbers);
  
  // Check padding consistency
  const filenames = processedFiles.map(f => f.sortingName);
  const consistentPadding = checkPaddingConsistency(filenames);
  
  const metadata = {
    hasNumericSequences,
    consistentPadding,
    sequentialNumbers: sequenceAnalysis.isSequential,
    gapCount: sequenceAnalysis.gapCount,
    duplicateNumbers: sequenceAnalysis.duplicateCount,
    totalFiles: files.length
  };
  
  // Calculate confidence score
  const confidence = calculateConfidence(files, metadata);
  
  // Determine if manual reorder is recommended
  // Tuned threshold based on improved scoring accuracy
  const CONFIDENCE_THRESHOLD = 0.7;
  const requiresManualReorder = confidence < CONFIDENCE_THRESHOLD;
  
  return {
    sortedFiles: sortedFiles.map(f => ({
      path: f.path,
      originalName: f.originalName,
      size: f.size,
      buffer: (f as any).buffer
    })),
    confidence,
    requiresManualReorder,
    metadata
  };
}

/**
 * Simple natural sort fallback (for backwards compatibility)
 */
export function simpleNaturalSort(files: FileItem[]): FileItem[] {
  const result = naturalSortWithConfidence(files);
  return result.sortedFiles;
}