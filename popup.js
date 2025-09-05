/**

- Secure Bookmark Manager - Chrome Extension
- 
- This extension provides a secure, PIN-protected interface for managing Chrome bookmarks.
- Features include real-time search, bookmark editing, folder organization, suggestions, and secure PIN-based authentication.
  */

class SecureBookmarkManager {
constructor() {
// Initialize application state
this.isUnlocked = false;
this.currentBookmarks = [];
this.filteredBookmarks = [];
this.recentBookmarks = [];
this.bookmarkFolders = new Map();
this.collapsedFolders = new Set();
this.currentEditingBookmark = null;
this.currentDeletingBookmark = null;

```
    // Suggestions state
    this.suggestionsEnabled = false;
    this.currentSuggestions = [];
    this.suggestionCache = new Map();
    
    // Initialize the application
    this.init();
}

/**
 * Initialize the application
 * Check for existing PIN and setup event listeners
 */
async init() {
    try {
        // Check if PIN exists and setup UI accordingly
        await this.checkPinStatus();
        
        // Load suggestions settings
        await this.loadSuggestionsSettings();
        
        // Setup event listeners
        this.setupEventListeners();
        
        // Setup PIN input behavior
        this.setupPinInputs();
        
    } catch (error) {
        console.error('Failed to initialize app:', error);
        this.showError('Failed to initialize application');
    }
}

/**
 * Check if a PIN has been set and update UI accordingly
 */
async checkPinStatus() {
    try {
        const result = await chrome.storage.local.get(['userPin']);
        const pinPrompt = document.getElementById('pinPrompt');
        const resetButton = document.getElementById('resetPin');
        
        if (result.userPin) {
            // PIN exists, show unlock interface
            pinPrompt.textContent = 'Enter your 4-digit PIN';
            resetButton.classList.remove('hidden');
        } else {
            // No PIN set, show setup interface
            pinPrompt.textContent = 'Set a new 4-digit PIN';
            resetButton.classList.add('hidden');
        }
    } catch (error) {
        console.error('Error checking PIN status:', error);
    }
}

/**
 * Load suggestions settings from storage
 */
async loadSuggestionsSettings() {
    try {
        const result = await chrome.storage.local.get(['suggestionsEnabled']);
        this.suggestionsEnabled = result.suggestionsEnabled || false;
        this.updateSuggestionsUI();
    } catch (error) {
        console.error('Failed to load suggestions settings:', error);
    }
}

/**
 * Setup all event listeners for the application
 */
setupEventListeners() {
    // PIN submission
    document.getElementById('submitPin').addEventListener('click', () => this.handlePinSubmission());
    
    // PIN reset
    document.getElementById('resetPin').addEventListener('click', () => this.resetPin());
    
    // Lock application
    document.getElementById('lockApp').addEventListener('click', () => this.lockApplication());
    
    // Quick add current tab
    document.getElementById('addCurrentTab').addEventListener('click', () => this.addCurrentTab());
    
    // Export bookmarks
    document.getElementById('exportBookmarks').addEventListener('click', () => this.exportBookmarks());
    
    // Toggle suggestions
    document.getElementById('toggleSuggestions').addEventListener('click', () => this.toggleSuggestions());
    
    // Search functionality
    document.getElementById('searchInput').addEventListener('input', (e) => this.filterBookmarks(e.target.value));
    
    // Modal event listeners
    this.setupModalEventListeners();
    
    // Enter key submission for PIN
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !this.isUnlocked) {
            this.handlePinSubmission();
        }
    });
}

/**
 * Setup PIN input fields with auto-focus behavior
 */
setupPinInputs() {
    const pinDigits = document.querySelectorAll('.pin-digit');
    
    pinDigits.forEach((input, index) => {
        // Auto-focus next input on digit entry
        input.addEventListener('input', (e) => {
            if (e.target.value && index < pinDigits.length - 1) {
                pinDigits[index + 1].focus();
            }
            
            // Auto-submit when all digits are filled
            if (index === pinDigits.length - 1 && e.target.value) {
                setTimeout(() => this.handlePinSubmission(), 100);
            }
            
            // Clear error on new input
            this.clearPinError();
        });
        
        // Handle backspace to focus previous input
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Backspace' && !e.target.value && index > 0) {
                pinDigits[index - 1].focus();
            }
        });
        
        // Only allow numeric input
        input.addEventListener('keypress', (e) => {
            if (!/\d/.test(e.key) && !['Backspace', 'Delete', 'Tab', 'Enter'].includes(e.key)) {
                e.preventDefault();
            }
        });
    });
    
    // Focus first input on load
    if (pinDigits[0]) {
        pinDigits[0].focus();
    }
}

/**
 * Setup event listeners for modals
 */
setupModalEventListeners() {
    // Confirmation modal
    document.getElementById('confirmCancel').addEventListener('click', () => this.hideConfirmModal());
    document.getElementById('confirmDelete').addEventListener('click', () => this.confirmDeleteBookmark());
    
    // Edit modal
    document.getElementById('editCancel').addEventListener('click', () => this.hideEditModal());
    document.getElementById('editSave').addEventListener('click', () => this.saveBookmarkEdit());
    
    // Close modals on outside click
    document.getElementById('confirmModal').addEventListener('click', (e) => {
        if (e.target === e.currentTarget) this.hideConfirmModal();
    });
    
    document.getElementById('editModal').addEventListener('click', (e) => {
        if (e.target === e.currentTarget) this.hideEditModal();
    });
}

/**
 * Handle PIN submission (both setting new PIN and verifying existing PIN)
 */
async handlePinSubmission() {
    const pin = this.getPinFromInputs();
    
    if (pin.length !== 4) {
        this.showPinError('Please enter a 4-digit PIN');
        return;
    }
    
    try {
        const result = await chrome.storage.local.get(['userPin']);
        
        if (result.userPin) {
            // Verify existing PIN
            await this.verifyPin(pin);
        } else {
            // Set new PIN
            await this.setNewPin(pin);
        }
    } catch (error) {
        console.error('PIN submission error:', error);
        this.showPinError('An error occurred. Please try again.');
    }
}

/**
 * Get PIN value from input fields
 */
getPinFromInputs() {
    const pinDigits = document.querySelectorAll('.pin-digit');
    return Array.from(pinDigits).map(input => input.value).join('');
}

/**
 * Verify entered PIN against stored PIN
 */
async verifyPin(enteredPin) {
    try {
        const result = await chrome.storage.local.get(['userPin']);
        
        if (result.userPin === enteredPin) {
            // PIN is correct, unlock the application
            await this.unlockApplication();
        } else {
            // PIN is incorrect
            this.showPinError('Incorrect PIN. Please try again.');
            this.shakePinInputs();
            this.clearPinInputs();
        }
    } catch (error) {
        console.error('PIN verification error:', error);
        this.showPinError('Verification failed. Please try again.');
    }
}

/**
 * Set a new PIN for first-time users
 */
async setNewPin(pin) {
    try {
        await chrome.storage.local.set({ userPin: pin });
        await this.unlockApplication();
    } catch (error) {
        console.error('PIN setting error:', error);
        this.showPinError('Failed to set PIN. Please try again.');
    }
}

/**
 * Reset the PIN (clear from storage)
 */
async resetPin() {
    try {
        await chrome.storage.local.remove(['userPin']);
        await this.checkPinStatus();
        this.clearPinInputs();
        this.clearPinError();
        
        // Focus first input
        const firstInput = document.querySelector('.pin-digit');
        if (firstInput) firstInput.focus();
    } catch (error) {
        console.error('PIN reset error:', error);
        this.showPinError('Failed to reset PIN. Please try again.');
    }
}

/**
 * Unlock the application and show main interface
 */
async unlockApplication() {
    this.isUnlocked = true;
    
    // Hide PIN screen and show main screen
    document.getElementById('pinScreen').classList.add('hidden');
    document.getElementById('mainScreen').classList.remove('hidden');
    
    // Load bookmarks
    await this.loadBookmarks();
    
    // Generate suggestions if enabled
    if (this.suggestionsEnabled) {
        await this.generateSuggestions();
    }
    
    // Focus search input
    document.getElementById('searchInput').focus();
}

/**
 * Lock the application and return to PIN screen
 */
lockApplication() {
    this.isUnlocked = false;
    this.currentBookmarks = [];
    this.filteredBookmarks = [];
    this.currentSuggestions = [];
    
    // Show PIN screen and hide main screen
    document.getElementById('mainScreen').classList.add('hidden');
    document.getElementById('pinScreen').classList.remove('hidden');
    
    // Clear PIN inputs and focus first one
    this.clearPinInputs();
    this.clearPinError();
    const firstInput = document.querySelector('.pin-digit');
    if (firstInput) firstInput.focus();
    
    // Clear search
    document.getElementById('searchInput').value = '';
}

/**
 * Load all Chrome bookmarks
 */
async loadBookmarks() {
    try {
        // Show loading state
        document.getElementById('loadingBookmarks').classList.remove('hidden');
        document.getElementById('noBookmarks').classList.add('hidden');
        
        // Get all bookmarks from Chrome
        const bookmarkTree = await chrome.bookmarks.getTree();
        const { bookmarks, folders } = this.flattenBookmarksWithFolders(bookmarkTree);
        
        this.currentBookmarks = bookmarks;
        this.bookmarkFolders = folders;
        this.filteredBookmarks = [...this.currentBookmarks];
        
        // Get recent bookmarks (last 7 days)
        this.recentBookmarks = this.getRecentBookmarks(bookmarks);
        
        // Hide loading and render bookmarks
        document.getElementById('loadingBookmarks').classList.add('hidden');
        this.renderBookmarks();
        
    } catch (error) {
        console.error('Failed to load bookmarks:', error);
        document.getElementById('loadingBookmarks').classList.add('hidden');
        this.showError('Failed to load bookmarks');
    }
}

/**
 * Flatten the bookmark tree structure and organize by folders
 */
flattenBookmarksWithFolders(bookmarkTree) {
    const bookmarks = [];
    const folders = new Map();
    
    function traverse(nodes, parentPath = '') {
        for (const node of nodes) {
            if (node.url) {
                // This is a bookmark (not a folder)
                const bookmark = {
                    id: node.id,
                    title: node.title,
                    url: node.url,
                    parentId: node.parentId,
                    dateAdded: node.dateAdded || Date.now(),
                    folderPath: parentPath || 'Other Bookmarks'
                };
                bookmarks.push(bookmark);
            } else if (node.children) {
                // This is a folder
                let folderPath;
                
                // Skip system folders for path building
                if (['Bookmarks Bar', 'Other Bookmarks', 'Mobile Bookmarks'].includes(node.title)) {
                    folderPath = node.title;
                } else {
                    folderPath = parentPath ? `${parentPath} > ${node.title}` : node.title;
                    folders.set(node.id, {
                        id: node.id,
                        title: node.title,
                        path: folderPath,
                        parentId: node.parentId
                    });
                }
                
                traverse(node.children, folderPath);
            }
        }
    }
    
    traverse(bookmarkTree);
    return { bookmarks, folders };
}

/**
 * Get recently added bookmarks (last 7 days)
 */
getRecentBookmarks(bookmarks) {
    const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    return bookmarks
        .filter(bookmark => bookmark.dateAdded > sevenDaysAgo)
        .sort((a, b) => b.dateAdded - a.dateAdded)
        .slice(0, 10); // Show max 10 recent bookmarks
}

/**
 * Add current active tab as bookmark
 */
async addCurrentTab() {
    try {
        // Get current active tab
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
        if (!tab) {
            this.showError('Could not get current tab information');
            return;
        }
        
        // Check if bookmark already exists
        const existingBookmark = this.currentBookmarks.find(b => b.url === tab.url);
        if (existingBookmark) {
            this.showError('This page is already bookmarked');
            return;
        }
        
        // Create bookmark in Chrome
        const newBookmark = await chrome.bookmarks.create({
            title: tab.title,
            url: tab.url
        });
        
        // Add to local data
        const bookmark = {
            id: newBookmark.id,
            title: newBookmark.title,
            url: newBookmark.url,
            parentId: newBookmark.parentId,
            dateAdded: newBookmark.dateAdded || Date.now(),
            folderPath: 'Other Bookmarks'
        };
        
        this.currentBookmarks.unshift(bookmark);
        this.recentBookmarks.unshift(bookmark);
        
        // Keep recent bookmarks list to max 10
        if (this.recentBookmarks.length > 10) {
            this.recentBookmarks.pop();
        }
        
        // Refresh view
        const searchQuery = document.getElementById('searchInput').value;
        this.filterBookmarks(searchQuery);
        
        // Regenerate suggestions if enabled (new bookmark might change interests)
        if (this.suggestionsEnabled) {
            setTimeout(() => this.generateSuggestions(), 1000);
        }
        
        // Show success feedback
        this.showSuccessMessage('Bookmark added successfully!');
        
    } catch (error) {
        console.error('Failed to add current tab:', error);
        this.showError('Failed to add bookmark');
    }
}

/**
 * Export all bookmarks as JSON file
 */
async exportBookmarks() {
    try {
        const exportData = {
            exportDate: new Date().toISOString(),
            totalBookmarks: this.currentBookmarks.length,
            bookmarks: this.currentBookmarks,
            folders: Array.from(this.bookmarkFolders.values())
        };
        
        // Create downloadable file
        const dataStr = JSON.stringify(exportData, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        
        // Create download link
        const downloadUrl = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = `bookmarks-export-${new Date().toISOString().split('T')[0]}.json`;
        
        // Trigger download
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // Clean up
        URL.revokeObjectURL(downloadUrl);
        
        this.showSuccessMessage('Bookmarks exported successfully!');
        
    } catch (error) {
        console.error('Failed to export bookmarks:', error);
        this.showError('Failed to export bookmarks');
    }
}

/**
 * Toggle suggestions on/off
 */
async toggleSuggestions() {
    try {
        this.suggestionsEnabled = !this.suggestionsEnabled;
        await chrome.storage.local.set({ suggestionsEnabled: this.suggestionsEnabled });
        
        this.updateSuggestionsUI();
        
        if (this.suggestionsEnabled) {
            await this.generateSuggestions();
        } else {
            this.currentSuggestions = [];
            this.renderBookmarks();
        }
    } catch (error) {
        console.error('Failed to toggle suggestions:', error);
        this.showError('Failed to toggle suggestions');
    }
}

/**
 * Update suggestions UI based on current state
 */
updateSuggestionsUI() {
    const toggleBtn = document.getElementById('toggleSuggestions');
    const statusDiv = document.getElementById('suggestionsStatus');
    
    if (this.suggestionsEnabled) {
        toggleBtn.classList.add('bg-blue-100', 'text-blue-600');
        toggleBtn.classList.remove('text-gray-500');
        toggleBtn.title = 'Suggestions enabled (click to disable)';
        statusDiv.classList.remove('hidden');
    } else {
        toggleBtn.classList.remove('bg-blue-100', 'text-blue-600');
        toggleBtn.classList.add('text-gray-500');
        toggleBtn.title = 'Suggestions disabled (click to enable)';
        statusDiv.classList.add('hidden');
    }
}

/**
 * Generate smart suggestions based on current bookmarks and browsing patterns
 */
async generateSuggestions() {
    if (!this.suggestionsEnabled) return;
    
    try {
        // Analyze current bookmarks to find categories and domains
        const categories = this.analyzeBookmarkCategories();
        const suggestions = [];
        
        // Get suggestions for each category
        for (const category of categories.slice(0, 3)) { // Limit to top 3 categories
            const categorySuggestions = await this.getSuggestionsForCategory(category);
            suggestions.push(...categorySuggestions);
        }
        
        // Filter out already bookmarked sites
        this.currentSuggestions = suggestions.filter(suggestion => 
            !this.currentBookmarks.some(bookmark => 
                this.getDomain(bookmark.url) === this.getDomain(suggestion.url)
            )
        ).slice(0, 6); // Limit to 6 suggestions
        
        // Update suggestions count
        document.getElementById('suggestionsCount').textContent = 
            `${this.currentSuggestions.length} found`;
        
        // Re-render bookmarks to include suggestions
        this.renderBookmarks();
        
    } catch (error) {
        console.error('Failed to generate suggestions:', error);
    }
}

/**
 * Analyze bookmark categories based on domains and titles
 */
analyzeBookmarkCategories() {
    const domainCategories = new Map();
    const categories = [
        {
            name: 'Development',
            keywords: ['github', 'stackoverflow', 'dev', 'coding', 'programming', 'tech'],
            domains: ['github.com', 'stackoverflow.com', 'dev.to', 'medium.com']
        },
        {
            name: 'News',
            keywords: ['news', 'article', 'blog', 'report'],
            domains: ['bbc.com', 'reuters.com', 'techcrunch.com', 'theverge.com']
        },
        {
            name: 'Learning',
            keywords: ['course', 'tutorial', 'learn', 'education', 'guide'],
            domains: ['coursera.org', 'udemy.com', 'khanacademy.org', 'edx.org']
        },
        {
            name: 'Productivity',
            keywords: ['tool', 'productivity', 'work', 'organize'],
            domains: ['notion.so', 'trello.com', 'slack.com', 'asana.com']
        },
        {
            name: 'Design',
            keywords: ['design', 'ui', 'ux', 'creative', 'inspiration'],
            domains: ['dribbble.com', 'behance.net', 'figma.com', 'adobe.com']
        }
    ];
    
    // Count bookmarks per category
    categories.forEach(category => {
        let count = 0;
        this.currentBookmarks.forEach(bookmark => {
            const domain = this.getDomain(bookmark.url);
            const title = bookmark.title.toLowerCase();
            
            // Check domain match
            if (category.domains.some(d => domain.includes(d.replace('www.', '')))) {
                count += 2; // Higher weight for domain match
            }
            
            // Check keyword match in title
            if (category.keywords.some(keyword => title.includes(keyword))) {
                count += 1;
            }
        });
        
        if (count > 0) {
            domainCategories.set(category.name, count);
        }
    });
    
    // Return categories sorted by relevance
    return Array.from(domainCategories.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([name]) => name);
}

/**
 * Get suggestions for a specific category using curated high-quality sites
 */
async getSuggestionsForCategory(category) {
    // Check cache first
    if (this.suggestionCache.has(category)) {
        return this.suggestionCache.get(category);
    }
    
    const suggestions = this.getCuratedSuggestions(category);
    
    // Cache the results
    this.suggestionCache.set(category, suggestions);
    
    return suggestions;
}

/**
 * Get curated high-quality site suggestions by category
 */
getCuratedSuggestions(category) {
    const suggestions = {
        'Development': [
            {
                title: 'MDN Web Docs - Web development resources',
                url: 'https://developer.mozilla.org',
                description: 'Comprehensive web development documentation',
                rating: 9.5,
                category: 'Development'
            },
            {
                title: 'Hacker News - Tech news and discussions',
                url: 'https://news.ycombinator.com',
                description: 'Quality tech news and startup discussions',
                rating: 9.0,
                category: 'Development'
            }
        ],
        'News': [
            {
                title: 'Reuters - Global news coverage',
                url: 'https://reuters.com',
                description: 'Reliable international news source',
                rating: 9.2,
                category: 'News'
            },
            {
                title: 'Associated Press News',
                url: 'https://apnews.com',
                description: 'Unbiased news reporting',
                rating: 9.0,
                category: 'News'
            }
        ],
        'Learning': [
            {
                title: 'Khan Academy - Free education',
                url: 'https://khanacademy.org',
                description: 'Free world-class education for anyone',
                rating: 9.4,
                category: 'Learning'
            },
            {
                title: 'Coursera - Online courses',
                url: 'https://coursera.org',
                description: 'University-level courses online',
                rating: 8.8,
                category: 'Learning'
            }
        ],
        'Productivity': [
            {
                title: 'Notion - All-in-one workspace',
                url: 'https://notion.so',
                description: 'Notes, docs, and project management',
                rating: 9.1,
                category: 'Productivity'
            },
            {
                title: 'Todoist - Task management',
                url: 'https://todoist.com',
                description: 'Simple and powerful task manager',
                rating: 8.7,
                category: 'Productivity'
            }
        ],
        'Design': [
            {
                title: 'Dribbble - Design inspiration',
                url: 'https://dribbble.com',
                description: 'Creative design showcase',
                rating: 8.9,
                category: 'Design'
            },
            {
                title: 'Unsplash - Free photos',
                url: 'https://unsplash.com',
                description: 'High-quality free photographs',
                rating: 9.0,
                category: 'Design'
            }
        ]
    };
    
    return suggestions[category] || [];
}

/**
 * Extract domain from URL
 */
getDomain(url) {
    try {
        return new URL(url).hostname.replace('www.', '');
    } catch (e) {
        return url;
    }
}

/**
 * Render bookmarks in the UI with folder organization
 */
renderBookmarks() {
    const bookmarksList = document.getElementById('bookmarksList');
    const noBookmarks = document.getElementById('noBookmarks');
    
    // Clear existing bookmarks
    const existingBookmarks = bookmarksList.querySelectorAll('.bookmark-section');
    existingBookmarks.forEach(item => item.remove());
    
    if (this.filteredBookmarks.length === 0 && this.currentSuggestions.length === 0) {
        noBookmarks.classList.remove('hidden');
        return;
    }
    
    noBookmarks.classList.add('hidden');
    
    // Render Suggestions section (if enabled and available)
    const searchQuery = document.getElementById('searchInput').value;
    if (!searchQuery && this.suggestionsEnabled && this.currentSuggestions.length > 0) {
        this.renderSuggestionsSection(bookmarksList);
    }
    
    // Render Recently Added section (if search is empty and recent bookmarks exist)
    if (!searchQuery && this.recentBookmarks.length > 0) {
        this.renderRecentSection(bookmarksList);
    }
    
    // Group bookmarks by folder
    const bookmarksByFolder = this.groupBookmarksByFolder(this.filteredBookmarks);
    
    // Render each folder section
    for (const [folderPath, bookmarks] of bookmarksByFolder) {
        this.renderFolderSection(bookmarksList, folderPath, bookmarks);
    }
}

/**
 * Render the suggestions section
 */
renderSuggestionsSection(container) {
    const suggestionsSection = document.createElement('div');
    suggestionsSection.className = 'bookmark-section mb-6';
    
    suggestionsSection.innerHTML = `
        <div class="flex items-center justify-between mb-3">
            <h3 class="text-sm font-semibold text-gray-700 flex items-center">
                <svg class="w-4 h-4 mr-2 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path>
                </svg>
                Suggested for You
            </h3>
            <span class="text-xs text-gray-500">${this.currentSuggestions.length}</span>
        </div>
        <div class="space-y-2"></div>
    `;
    
    const suggestionsContainer = suggestionsSection.querySelector('.space-y-2');
    
    // Render suggested sites
    this.currentSuggestions.forEach(suggestion => {
        const suggestionElement = this.createSuggestionElement(suggestion);
        suggestionsContainer.appendChild(suggestionElement);
    });
    
    container.appendChild(suggestionsSection);
}

/**
 * Create a suggestion element for the UI
 */
createSuggestionElement(suggestion) {
    const div = document.createElement('div');
    div.className = 'bookmark-item bg-gradient-to-r from-purple-50 to-blue-50 rounded-xl p-4 border border-purple-200 hover:border-purple-300 transition-all';
    
    // Extract domain for display
    const domain = this.getDomain(suggestion.url);
    
    div.innerHTML = `
        <div class="flex items-start justify-between">
            <div class="flex-1 min-w-0">
                <div class="flex items-center mb-1">
                    <h3 class="text-sm font-medium text-gray-900 truncate">${this.escapeHtml(suggestion.title)}</h3>
                    <div class="flex items-center ml-2">
                        <svg class="w-3 h-3 text-yellow-500 mr-1" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"></path>
                        </svg>
                        <span class="text-xs text-yellow-600 font-medium">${suggestion.rating}</span>
                    </div>
                </div>
                <p class="text-xs text-gray-500 truncate">${this.escapeHtml(domain)}</p>
                <p class="text-xs text-gray-600 mt-1">${this.escapeHtml(suggestion.description)}</p>
                <span class="inline-block text-xs text-purple-600 bg-purple-100 px-2 py-1 rounded-full mt-2">${suggestion.category}</span>
            </div>
            <div class="flex items-center space-x-2 ml-3">
                <button class="preview-btn p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all" 
                        onclick="window.open('${suggestion.url}', '_blank')" title="Visit site">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path>
                    </svg>
                </button>
                <button class="add-suggestion-btn p-1 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-all" 
                        title="Add to bookmarks">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"></path>
                    </svg>
                </button>
                <button class="dismiss-suggestion-btn p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all" 
                        title="Dismiss suggestion">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                    </svg>
                </button>
            </div>
        </div>
    `;
    
    // Add event listeners for suggestion actions
    const addBtn = div.querySelector('.add-suggestion-btn');
    const dismissBtn = div.querySelector('.dismiss-suggestion-btn');
    
    addBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.addSuggestionToBookmarks(suggestion);
    });
    
    dismissBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.dismissSuggestion(suggestion.url);
    });
    
    return div;
}

/**
 * Add a suggestion to bookmarks
 */
async addSuggestionToBookmarks(suggestion) {
    try {
        // Create bookmark in Chrome
        const newBookmark = await chrome.bookmarks.create({
            title: suggestion.title,
            url: suggestion.url
        });
        
        // Add to local data
        const bookmark = {
            id: newBookmark.id,
            title: newBookmark.title,
            url: newBookmark.url,
            parentId: newBookmark.parentId,
            dateAdded: newBookmark.dateAdded || Date.now(),
            folderPath: 'Other Bookmarks'
        };
        
        this.currentBookmarks.unshift(bookmark);
        this.recentBookmarks.unshift(bookmark);
        
        // Remove from suggestions
        this.currentSuggestions = this.currentSuggestions.filter(s => s.url !== suggestion.url);
        
        // Update suggestions count
        document.getElementById('suggestionsCount').textContent = 
            `${this.currentSuggestions.length} found`;
        
        // Refresh view
        const searchQuery = document.getElementById('searchInput').value;
        this.filterBookmarks(searchQuery);
        
        this.showSuccessMessage('Suggestion added to bookmarks!');
        
    } catch (error) {
        console.error('Failed to add suggestion:', error);
        this.showError('Failed to add suggestion');
    }
}

/**
 * Dismiss a suggestion
 */
dismissSuggestion(suggestionUrl) {
    this.currentSuggestions = this.currentSuggestions.filter(s => s.url !== suggestionUrl);
    
    // Update suggestions count
    document.getElementById('suggestionsCount').textContent = 
        `${this.currentSuggestions.length} found`;
    
    // Re-render bookmarks
    this.renderBookmarks();
}

/**
 * Render the recently added bookmarks section
 */
renderRecentSection(container) {
    const recentSection = document.createElement('div');
    recentSection.className = 'bookmark-section mb-6';
    
    recentSection.innerHTML = `
        <div class="flex items-center justify-between mb-3">
            <h3 class="text-sm font-semibold text-gray-700 flex items-center">
                <svg class="w-4 h-4 mr-2 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
                Recently Added
            </h3>
            <span class="text-xs text-gray-500">${this.recentBookmarks.length}</span>
        </div>
        <div class="space-y-2"></div>
    `;
    
    const bookmarksContainer = recentSection.querySelector('.space-y-2');
    
    // Render recent bookmarks
    this.recentBookmarks.slice(0, 5).forEach(bookmark => {
        const bookmarkElement = this.createBookmarkElement(bookmark, true);
        bookmarksContainer.appendChild(bookmarkElement);
    });
    
    container.appendChild(recentSection);
}

/**
 * Group bookmarks by their folder path
 */
groupBookmarksByFolder(bookmarks) {
    const groups = new Map();
    
    bookmarks.forEach(bookmark => {
        const folderPath = bookmark.folderPath || 'Other Bookmarks';
        
        if (!groups.has(folderPath)) {
            groups.set(folderPath, []);
        }
        groups.get(folderPath).push(bookmark);
    });
    
    // Sort folders alphabetically, but keep "Other Bookmarks" at the end
    const sortedGroups = new Map();
    const otherBookmarks = groups.get('Other Bookmarks');
    
    // Add all folders except "Other Bookmarks"
    const sortedFolders = Array.from(groups.keys())
        .filter(folder => folder !== 'Other Bookmarks')
        .sort();
        
    sortedFolders.forEach(folder => {
        sortedGroups.set(folder, groups.get(folder));
    });
    
    // Add "Other Bookmarks" at the end if it exists
    if (otherBookmarks) {
        sortedGroups.set('Other Bookmarks', otherBookmarks);
    }
    
    return sortedGroups;
}

/**
 * Render a folder section with its bookmarks
 */
renderFolderSection(container, folderPath, bookmarks) {
    const isCollapsed = this.collapsedFolders.has(folderPath);
    const folderId = `folder-${folderPath.replace(/[^a-zA-Z0-9]/g, '-')}`;
    
    const folderSection = document.createElement('div');
    folderSection.className = 'bookmark-section mb-4';
    
    folderSection.innerHTML = `
        <div class="flex items-center justify-between mb-3 cursor-pointer hover:bg-gray-50 p-2 rounded-lg transition-all" 
             onclick="window.bookmarkManager.toggleFolder('${folderPath}')">
            <h3 class="text-sm font-semibold text-gray-700 flex items-center">
                <svg class="w-4 h-4 mr-2 transition-transform ${isCollapsed ? '' : 'rotate-90'}" 
                     fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
                </svg>
                <svg class="w-4 h-4 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"></path>
                </svg>
                ${this.escapeHtml(folderPath)}
            </h3>
            <span class="text-xs text-gray-500">${bookmarks.length}</span>
        </div>
        <div id="${folderId}" class="space-y-2 ${isCollapsed ? 'hidden' : ''}"></div>
    `;
    
    const bookmarksContainer = folderSection.querySelector(`#${folderId}`);
    
    // Render bookmarks in this folder
    bookmarks.forEach(bookmark => {
        const bookmarkElement = this.createBookmarkElement(bookmark);
        bookmarksContainer.appendChild(bookmarkElement);
    });
    
    container.appendChild(folderSection);
}

/**
 * Toggle folder collapse/expand state
 */
toggleFolder(folderPath) {
    const folderId = `folder-${folderPath.replace(/[^a-zA-Z0-9]/g, '-')}`;
    const folderContent = document.getElementById(folderId);
    const folderIcon = folderContent.parentElement.querySelector('svg');
    
    if (this.collapsedFolders.has(folderPath)) {
        this.collapsedFolders.delete(folderPath);
        folderContent.classList.remove('hidden');
        folderIcon.classList.add('rotate-90');
    } else {
        this.collapsedFolders.add(folderPath);
        folderContent.classList.add('hidden');
        folderIcon.classList.remove('rotate-90');
    }
}

/**
 * Create a bookmark element for the UI
 */
createBookmarkElement(bookmark, isRecent = false) {
    const div = document.createElement('div');
    div.className = `bookmark-item bg-white rounded-xl p-4 border border-gray-200 hover:border-gray-300 transition-all ${isRecent ? 'border-l-4 border-l-green-500' : ''}`;
    
    // Extract domain for display
    let domain = '';
    try {
        domain = new URL(bookmark.url).hostname;
    } catch (e) {
        domain = bookmark.url;
    }
    
    // Format date for recent bookmarks
    let dateInfo = '';
    if (isRecent && bookmark.dateAdded) {
        const date = new Date(bookmark.dateAdded);
        const now = new Date();
        const diffTime = Math.abs(now - date);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays === 1) {
            dateInfo = '<span class="text-xs text-green-600 font-medium">Today</span>';
        } else if (diffDays <= 7) {
            dateInfo = `<span class="text-xs text-green-600 font-medium">${diffDays} days ago</span>`;
        }
    }
    
    div.innerHTML = `
        <div class="flex items-start justify-between">
            <div class="flex-1 min-w-0 cursor-pointer" onclick="window.open('${bookmark.url}', '_blank')">
                <h3 class="text-sm font-medium text-gray-900 truncate">${this.escapeHtml(bookmark.title)}</h3>
                <div class="flex items-center justify-between mt-1">
                    <p class="text-xs text-gray-500 truncate">${this.escapeHtml(domain)}</p>
                    ${dateInfo}
                </div>
            </div>
            <div class="flex items-center space-x-2 ml-3">
                <button class="edit-btn p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all" 
                        data-bookmark-id="${bookmark.id}" title="Edit bookmark">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
                    </svg>
                </button>
                <button class="delete-btn p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all" 
                        data-bookmark-id="${bookmark.id}" title="Delete bookmark">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                    </svg>
                </button>
            </div>
        </div>
    `;
    
    // Add event listeners for edit and delete buttons
    const editBtn = div.querySelector('.edit-btn');
    const deleteBtn = div.querySelector('.delete-btn');
    
    editBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.editBookmark(bookmark.id);
    });
    
    deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.showDeleteConfirmation(bookmark.id);
    });
    
    return div;
}

/**
 * Filter bookmarks based on search query
 */
filterBookmarks(query) {
    if (!query.trim()) {
        this.filteredBookmarks = [...this.currentBookmarks];
    } else {
        const lowercaseQuery = query.toLowerCase();
        this.filteredBookmarks = this.currentBookmarks.filter(bookmark =>
            bookmark.title.toLowerCase().includes(lowercaseQuery) ||
            bookmark.url.toLowerCase().includes(lowercaseQuery)
        );
    }
    
    this.renderBookmarks();
}

/**
 * Show edit modal for a bookmark
 */
editBookmark(bookmarkId) {
    const bookmark = this.currentBookmarks.find(b => b.id === bookmarkId);
    if (!bookmark) return;
    
    this.currentEditingBookmark = bookmark;
    
    // Populate modal fields
    document.getElementById('editTitle').value = bookmark.title;
    document.getElementById('editUrl').value = bookmark.url;
    
    // Show modal
    document.getElementById('editModal').classList.remove('hidden');
    document.getElementById('editTitle').focus();
}

/**
 * Save bookmark edits
 */
async saveBookmarkEdit() {
    if (!this.currentEditingBookmark) return;
    
    const newTitle = document.getElementById('editTitle').value.trim();
    const newUrl = document.getElementById('editUrl').value.trim();
    
    if (!newTitle || !newUrl) {
        this.showError('Title and URL are required');
        return;
    }
    
    try {
        // Update bookmark in Chrome
        await chrome.bookmarks.update(this.currentEditingBookmark.id, {
            title: newTitle,
            url: newUrl
        });
        
        // Update local data
        const bookmarkIndex = this.currentBookmarks.findIndex(b => b.id === this.currentEditingBookmark.id);
        if (bookmarkIndex !== -1) {
            this.currentBookmarks[bookmarkIndex].title = newTitle;
            this.currentBookmarks[bookmarkIndex].url = newUrl;
        }
        
        // Refresh filtered bookmarks and re-render
        const searchQuery = document.getElementById('searchInput').value;
        this.filterBookmarks(searchQuery);
        
        // Hide modal
        this.hideEditModal();
        
    } catch (error) {
        console.error('Failed to update bookmark:', error);
        this.showError('Failed to update bookmark');
    }
}

/**
 * Show delete confirmation modal
 */
showDeleteConfirmation(bookmarkId) {
    const bookmark = this.currentBookmarks.find(b => b.id === bookmarkId);
    if (!bookmark) return;
    
    this.currentDeletingBookmark = bookmark;
    
    // Update confirmation message
    document.getElementById('confirmMessage').textContent = 
        `Are you sure you want to delete "${bookmark.title}"? This action cannot be undone.`;
    
    // Show modal
    document.getElementById('confirmModal').classList.remove('hidden');
}

/**
 * Confirm and execute bookmark deletion
 */
async confirmDeleteBookmark() {
    if (!this.currentDeletingBookmark) return;
    
    try {
        // Delete bookmark from Chrome
        await chrome.bookmarks.remove(this.currentDeletingBookmark.id);
        
        // Remove from local data
        this.currentBookmarks = this.currentBookmarks.filter(b => b.id !== this.currentDeletingBookmark.id);
        this.recentBookmarks = this.recentBookmarks.filter(b => b.id !== this.currentDeletingBookmark.id);
        
        // Refresh filtered bookmarks and re-render
        const searchQuery = document.getElementById('searchInput').value;
        this.filterBookmarks(searchQuery);
        
        // Hide modal
        this.hideConfirmModal();
        
    } catch (error) {
        console.error('Failed to delete bookmark:', error);
        this.showError('Failed to delete bookmark');
    }
}

/**
 * Hide confirmation modal
 */
hideConfirmModal() {
    document.getElementById('confirmModal').classList.add('hidden');
    this.currentDeletingBookmark = null;
}

/**
 * Hide edit modal
 */
hideEditModal() {
    document.getElementById('editModal').classList.add('hidden');
    this.currentEditingBookmark = null;
}

/**
 * Show PIN error message
 */
showPinError(message) {
    const errorElement = document.getElementById('pinError');
    errorElement.textContent = message;
    errorElement.classList.remove('hidden');
}

/**
 * Clear PIN error message
 */
clearPinError() {
    const errorElement = document.getElementById('pinError');
    errorElement.classList.add('hidden');
}

/**
 * Clear all PIN input fields
 */
clearPinInputs() {
    const pinDigits = document.querySelectorAll('.pin-digit');
    pinDigits.forEach(input => {
        input.value = '';
    });
    if (pinDigits[0]) {
        pinDigits[0].focus();
    }
}

/**
 * Add shake animation to PIN inputs for incorrect PIN
 */
shakePinInputs() {
    const pinContainer = document.querySelector('.pin-digit').parentElement;
    pinContainer.classList.add('animate-shake');
    setTimeout(() => {
        pinContainer.classList.remove('animate-shake');
    }, 500);
}

/**
 * Show error message (simple toast-like notification)
 */
showError(message) {
    console.error(message);
    // In a production app, you might want to show a proper toast notification
    // For now, we'll just log the error
}

/**
 * Show success message
 */
showSuccessMessage(message) {
    console.log(message);
    // You could implement a toast notification here
    // For now, we'll provide visual feedback through the UI state
}

/**
 * Escape HTML to prevent XSS attacks
 */
escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}
```

}

// Initialize the application when the DOM is loaded
document.addEventListener(‘DOMContentLoaded’, () => {
// Make the instance globally available for folder toggle functionality
window.bookmarkManager = new SecureBookmarkManager();
});
