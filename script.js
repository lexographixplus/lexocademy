/**
 * ==========================================================
 * LexoCademy Frontend Logic - Client-Side Filtering/Pagination
 * ==========================================================
 * Fetches all topics on load, handles filtering, search,
 * pagination, and modal display in the browser.
 * Handles newsletter signup via a separate Webhook.
 */
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM fully loaded and parsed.");

    // --- Configuration ---
    // URL for fetching topics (from simplified Code.gs deployment)
    const API_URL = "https://script.google.com/macros/s/AKfycbyYH0rhB-NJKVLU_tbYR6tVVqGmJ8Zv5WJYM0et-Oh6x3-boztsSULzkOmdB2WXSg9Jfw/exec"; // <-- REPLACE THIS

    // !!! IMPORTANT: Replace with your actual Webhook URL for newsletter signups !!!
    const NEWSLETTER_WEBHOOK_URL = "https://hook.eu2.make.com/cc4owgjxviuswyic6a1z3pyiv2gbxbwv"; // <-- REPLACE THIS

    const TOPICS_PER_PAGE = 6;

    // --- Global Variables ---
    let allTopics = [];
    let filteredTopics = [];
    let currentPage = 1;

    // --- DOM Element Selectors ---
    // Navigation & Basic Layout
    const menuToggle = document.getElementById('menuToggle');
    const navLinks = document.getElementById('navLinks');
    const body = document.body;
    const currentYearSpan = document.getElementById('currentYear');
    const darkModeToggle = document.getElementById('darkModeToggle');

    // Topic Display & Filtering/Search/Pagination
    const topicGrid = document.getElementById('topicGrid');
    const loadingSpinner = document.getElementById('loadingSpinner');
    const errorMessageElement = document.getElementById('errorMessage');
    const searchInput = document.getElementById('searchInput');
    const categoryFilter = document.getElementById('categoryFilter');
    const paginationList = document.getElementById('paginationList');
    const progressIndicator = document.getElementById('progressIndicator');

    // Modal Elements
    const modalOverlay = document.getElementById('topicModalOverlay');
    const modalContent = document.getElementById('topicModalContent');
    const modalBody = document.getElementById('modalBody');
    const modalCloseBtn = document.getElementById('modalCloseBtn');

    // Newsletter Elements (Added Back)
    const newsletterForm = document.getElementById('newsletterForm');
    const newsletterNameInput = document.getElementById('newsletterName');
    const newsletterEmailInput = document.getElementById('newsletterEmail');
    const newsletterFeedback = document.getElementById('newsletterFeedback');

    // --- Helper Function ---
    const sanitizeHTML = (str) => { /* ... same as before ... */
        if (!str) return '';
        const temp = document.createElement('div');
        temp.textContent = str;
        return temp.innerHTML;
    };

    // --- UI Update Functions ---
    const showLoading = (show = true) => { /* ... same as before ... */
        if (loadingSpinner) loadingSpinner.style.display = show ? 'block' : 'none';
        if (errorMessageElement) errorMessageElement.style.display = 'none';
        if (!show && progressIndicator) progressIndicator.style.display = 'block';
        if (show && progressIndicator) progressIndicator.style.display = 'none';
        if (show && topicGrid) topicGrid.innerHTML = '';
        if (show && paginationList) paginationList.innerHTML = '';
    };
    const hideLoading = () => { /* ... same as before ... */
        if (loadingSpinner) loadingSpinner.style.display = 'none';
    };
     const showError = (message) => { /* ... same as before ... */
        showLoading(false);
        if (errorMessageElement) {
             errorMessageElement.textContent = `Error: ${message || 'Could not load topics.'}`;
             errorMessageElement.style.display = 'block';
        }
        if (progressIndicator) progressIndicator.style.display = 'none';
        if (topicGrid) topicGrid.innerHTML = '';
        if (paginationList) paginationList.innerHTML = '';
     };
    const updateProgressIndicator = (countOnPage, totalFiltered, page = 1, perPage = TOPICS_PER_PAGE) => { /* ... same as before ... */
        if (!progressIndicator) return;
        if (totalFiltered === 0) {
            progressIndicator.textContent = 'No topics found.';
        } else {
            const start = totalFiltered > 0 ? (page - 1) * perPage + 1 : 0;
            const end = Math.min(start + countOnPage - 1, totalFiltered);
            progressIndicator.textContent = `Showing topics ${start}-${end} of ${totalFiltered}`;
        }
        progressIndicator.style.display = 'block';
    };
    const renderTopics = (topicsToDisplay = []) => { /* ... same as before ... */
        if (!topicGrid) return;
        topicGrid.innerHTML = '';
        if (topicsToDisplay.length === 0) return;

        topicsToDisplay.forEach(topic => {
             if (!topic || !topic.id || !topic.title) return;
             const card = document.createElement('div');
             card.className = 'topic-card';
             card.dataset.topicId = topic.id;
             card.setAttribute('role', 'button');
             card.setAttribute('tabindex', '0');
             card.setAttribute('aria-label', `View details for ${sanitizeHTML(topic.title)}`);
             const safeTitle = sanitizeHTML(topic.title);
             const safeSummary = sanitizeHTML(topic.summary) || 'No summary available.';
             const safeIcon = sanitizeHTML(topic.icon) || 'fas fa-book-open';
             const safeCategory = sanitizeHTML(topic.category) || 'General';
             card.innerHTML = `
                 <div class="card-icon"><i class="${safeIcon}"></i></div>
                 <h3 class="card-title">${safeTitle}</h3>
                 <p class="card-summary">${safeSummary}</p>
                 <span class="card-category">${safeCategory}</span>
             `;
             const openTopicDetailsHandler = () => openModalWithTopic(topic.id);
             card.addEventListener('click', openTopicDetailsHandler);
             card.addEventListener('keypress', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openTopicDetailsHandler(); } });
             topicGrid.appendChild(card);
        });
    };
    const renderPagination = (currentPageNum, totalPages) => { /* ... same as before ... */
        if (!paginationList) return;
        paginationList.innerHTML = '';
        if (totalPages <= 1) return;

        const createPageButton = (pageNumber, text = pageNumber, isDisabled = false, isActive = false, isEllipsis = false) => {
            const li = document.createElement('li');
            li.className = 'page-item';
            if (isEllipsis) { li.innerHTML = `<span class="page-link disabled" aria-hidden="true">...</span>`; li.classList.add('disabled'); }
            else {
                const button = document.createElement('button');
                button.className = 'page-link'; button.textContent = text; button.dataset.page = pageNumber; button.disabled = isDisabled;
                if (isDisabled) button.classList.add('disabled');
                if (isActive) { button.classList.add('active'); button.setAttribute('aria-current', 'page'); li.classList.add('active'); }
                else if (!isDisabled) { button.addEventListener('click', (e) => { currentPage = parseInt(e.target.dataset.page, 10); applyFiltersAndPagination(); }); }
                if (text === 'Previous') button.setAttribute('aria-label', 'Go to previous page');
                else if (text === 'Next') button.setAttribute('aria-label', 'Go to next page');
                else if (!isNaN(parseInt(text, 10))) button.setAttribute('aria-label', `Go to page ${text}`);
                li.appendChild(button);
            } return li;
        };
        paginationList.appendChild(createPageButton(currentPageNum - 1, 'Previous', currentPageNum === 1));
        const maxPagesToShow = 5; const pages = [];
        if (totalPages <= maxPagesToShow + 2) { for (let i = 1; i <= totalPages; i++) pages.push(i); }
        else { pages.push(1); let start = Math.max(2, currentPageNum - 1); let end = Math.min(totalPages - 1, currentPageNum + 1); if (currentPageNum < 4) end = 3; if (currentPageNum > totalPages - 3) start = totalPages - 2; if (start > 2) pages.push('...'); for (let i = start; i <= end; i++) pages.push(i); if (end < totalPages - 1) pages.push('...'); pages.push(totalPages); }
        pages.forEach(page => { if (page === '...') paginationList.appendChild(createPageButton(0, '...', true, false, true)); else paginationList.appendChild(createPageButton(page, page, false, page === currentPageNum)); });
        paginationList.appendChild(createPageButton(currentPageNum + 1, 'Next', currentPageNum === totalPages));
    };
    const populateFilters = () => { /* ... same as before ... */
        if (!categoryFilter) return;
        const categories = new Set();
        allTopics.forEach(topic => { if (topic.category && topic.category.trim()) categories.add(topic.category.trim()); });
        while (categoryFilter.options.length > 1) categoryFilter.remove(1);
        [...categories].sort((a, b) => a.localeCompare(b)).forEach(cat => { const option = document.createElement('option'); option.value = cat; option.textContent = cat; categoryFilter.appendChild(option); });
        console.log("Category filter populated.");
    };
    const applyFiltersAndPagination = () => { /* ... same as before ... */
        const searchTerm = searchInput ? searchInput.value.toLowerCase().trim() : '';
        const selectedCategory = categoryFilter ? categoryFilter.value : 'all';
        filteredTopics = allTopics.filter(topic => {
            const categoryMatch = selectedCategory === 'all' || (topic.category && topic.category === selectedCategory);
            const searchMatch = !searchTerm || (topic.title && topic.title.toLowerCase().includes(searchTerm)) || (topic.summary && topic.summary.toLowerCase().includes(searchTerm)) || (topic.fullContent && topic.fullContent.toLowerCase().includes(searchTerm));
            return categoryMatch && searchMatch;
        });
        const totalFilteredTopics = filteredTopics.length;
        const totalPages = Math.ceil(totalFilteredTopics / TOPICS_PER_PAGE);
        currentPage = Math.max(1, Math.min(currentPage, totalPages || 1));
        const startIndex = (currentPage - 1) * TOPICS_PER_PAGE;
        const endIndex = startIndex + TOPICS_PER_PAGE;
        const topicsToDisplay = filteredTopics.slice(startIndex, endIndex);
        renderTopics(topicsToDisplay);
        renderPagination(currentPage, totalPages);
        updateProgressIndicator(topicsToDisplay.length, totalFilteredTopics, currentPage);
        if (topicGrid && filteredTopics.length === 0) topicGrid.innerHTML = '<p class="no-topics-message">No topics found matching your criteria.</p>';
    };
    const displayModalContent = (topicDetails) => { /* ... same as before ... */
         if (!modalBody) return;
         if (!topicDetails || !topicDetails.id) { modalBody.innerHTML = '<p class="error-message">Could not load topic details.</p>'; return; }
         const safeTitle = sanitizeHTML(topicDetails.title) || 'Topic Details';
         const safeSummary = topicDetails.summary ? `<p class="modal-summary">${sanitizeHTML(topicDetails.summary)}</p><hr>` : '<hr>';
         const safeIcon = sanitizeHTML(topicDetails.icon) || 'fas fa-book-open';
         const safeFullContent = topicDetails.fullContent || '<p>Full details not available.</p>';
         modalBody.innerHTML = `
             <div class="modal-icon"><i class="${safeIcon}"></i></div>
             <h2 id="modalTitle" tabindex="-1">${safeTitle}</h2>
             ${safeSummary}
             <div class="modal-full-content">${safeFullContent}</div>
         `;
         const modalTitleElement = document.getElementById('modalTitle');
         if (modalTitleElement) setTimeout(() => modalTitleElement.focus(), 100);
    };

    // --- Function to Fetch All Topics ---
    const fetchTopics = async () => { /* ... same as before ... */
        console.log("Fetching all topics...");
        showLoading(true);
        if (API_URL === "YOUR_SIMPLIFIED_FETCH_ALL_GAS_URL" || !API_URL) { showError("Application is not configured correctly. API URL missing."); return; }
        try {
            const response = await fetch(API_URL);
            if (!response.ok) { let errorMsg = `HTTP error ${response.status}`; try { const errorData = await response.json(); if (errorData && errorData.message) errorMsg = errorData.message; } catch (e) { } throw new Error(errorMsg); }
            const contentType = response.headers.get("content-type"); if (!contentType || !contentType.includes("application/json")) { throw new Error("Invalid data format received from API."); }
            const data = await response.json(); if (data.error) throw new Error(data.message || "An error occurred on the server."); if (!Array.isArray(data)) throw new Error("Invalid data format received.");
            allTopics = data;
            console.log(`Fetched ${allTopics.length} topics.`);
            populateFilters();
            currentPage = 1;
            applyFiltersAndPagination();
        } catch (error) { console.error("Failed to fetch topics:", error); showError(error.message || "Could not connect to the server."); }
        finally { showLoading(false); }
    };

    // --- Modal Open/Close Logic ---
    const openModal = () => { /* ... same as before ... */
        if (!modalOverlay) return; modalOverlay.classList.add('active'); document.body.style.overflow = 'hidden'; if (modalCloseBtn) setTimeout(() => modalCloseBtn.focus(), 100);
    };
    const closeModal = () => { /* ... same as before ... */
        if (!modalOverlay) return; modalOverlay.classList.remove('active'); document.body.style.overflow = ''; if (modalBody) modalBody.innerHTML = '';
    };
    const openModalWithTopic = (topicId) => { /* ... same as before ... */
        if (!topicId) return; const topicToShow = allTopics.find(topic => topic.id === topicId); if (topicToShow) { displayModalContent(topicToShow); openModal(); } else { alert("Could not find details for the selected topic."); }
    };

    // --- Event Listeners ---
    // Mobile Menu Toggle
    if (menuToggle && navLinks) { /* ... same as before ... */
        menuToggle.addEventListener('click', () => { const isExpanded = menuToggle.getAttribute('aria-expanded') === 'true'; menuToggle.setAttribute('aria-expanded', !isExpanded); navLinks.classList.toggle('active'); const icon = menuToggle.querySelector('i'); if (icon) { icon.classList.toggle('fa-bars', isExpanded); icon.classList.toggle('fa-times', !isExpanded); } });
        navLinks.querySelectorAll('a').forEach(link => { link.addEventListener('click', () => { if (navLinks.classList.contains('active')) menuToggle.click(); }); });
    }
    // Dark Mode Toggle
    const applyTheme = (theme) => { /* ... same as before ... */ body.classList.remove('light-mode', 'dark-mode'); body.classList.add(theme + '-mode'); localStorage.setItem('lexoTheme', theme); if (darkModeToggle) { darkModeToggle.setAttribute('aria-pressed', theme === 'dark'); const moonIcon = darkModeToggle.querySelector('.fa-moon'); const sunIcon = darkModeToggle.querySelector('.fa-sun'); if (moonIcon) moonIcon.style.display = (theme === 'dark') ? 'none' : 'inline-block'; if (sunIcon) sunIcon.style.display = (theme === 'dark') ? 'inline-block' : 'none'; } };
    const initializeTheme = () => { /* ... same as before ... */ const preferredTheme = localStorage.getItem('lexoTheme'); const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches; let initialTheme = 'light'; if (preferredTheme) initialTheme = preferredTheme; else if (systemPrefersDark) initialTheme = 'dark'; applyTheme(initialTheme); };
    if (darkModeToggle) { /* ... same as before ... */ darkModeToggle.addEventListener('click', () => { const currentTheme = body.classList.contains('dark-mode') ? 'dark' : 'light'; applyTheme(currentTheme === 'dark' ? 'light' : 'dark'); }); window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', event => { if (!localStorage.getItem('lexoTheme')) applyTheme(event.matches ? 'dark' : 'light'); }); }
    // Modal Close Listeners
    if (modalCloseBtn) modalCloseBtn.addEventListener('click', closeModal);
    if (modalOverlay) modalOverlay.addEventListener('click', (e) => { if (e.target === modalOverlay) closeModal(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && modalOverlay?.classList.contains('active')) closeModal(); });
    // Filtering/Search Event Listeners
    if (searchInput) searchInput.addEventListener('input', () => { currentPage = 1; applyFiltersAndPagination(); });
    if (categoryFilter) categoryFilter.addEventListener('change', () => { currentPage = 1; applyFiltersAndPagination(); });
    // Pagination listeners are added in renderPagination

    // --- Newsletter Form Submission (Added Back - Using Webhook) ---
    if (newsletterForm && newsletterNameInput && newsletterEmailInput && newsletterFeedback) {
        newsletterForm.addEventListener('submit', async (event) => {
            event.preventDefault(); // Prevent default HTML form submission

            const name = newsletterNameInput.value.trim();
            const email = newsletterEmailInput.value.trim();
            const submitButton = newsletterForm.querySelector('button[type="submit"]');

            // Basic Validation
            if (!name || !email) {
                newsletterFeedback.textContent = 'Please fill out both name and email.';
                newsletterFeedback.className = 'newsletter-feedback error';
                setTimeout(() => { newsletterFeedback.textContent = ''; newsletterFeedback.className = 'newsletter-feedback'; }, 3000);
                return;
            }
            if (!/\S+@\S+\.\S+/.test(email)) {
                 newsletterFeedback.textContent = 'Please enter a valid email address.';
                 newsletterFeedback.className = 'newsletter-feedback error';
                 setTimeout(() => { newsletterFeedback.textContent = ''; newsletterFeedback.className = 'newsletter-feedback'; }, 3000);
                return;
            }

             // Check if Webhook URL is configured
            if (!NEWSLETTER_WEBHOOK_URL || NEWSLETTER_WEBHOOK_URL === "YOUR_NEWSLETTER_WEBHOOK_URL_HERE") {
                console.error("Newsletter Webhook URL is not configured in script.js.");
                newsletterFeedback.textContent = 'Signup configuration error.';
                newsletterFeedback.className = 'newsletter-feedback error';
                return;
            }

            // Show pending state
            newsletterFeedback.textContent = 'Submitting...';
            newsletterFeedback.className = 'newsletter-feedback pending';
            if (submitButton) submitButton.disabled = true;

            try {
                // Send data to the Webhook URL
                const response = await fetch(NEWSLETTER_WEBHOOK_URL, {
                    method: 'POST',
                    // Adjust headers and body based on what your webhook expects
                    // Common example: Sending JSON data
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ name: name, email: email }),
                    // mode: 'cors' // Usually default, might need adjustment depending on webhook
                });

                // Check webhook response
                if (!response.ok) {
                    // Try to get error detail from webhook response if possible
                    let errorDetail = `Webhook returned status ${response.status}`;
                    try {
                        const errorData = await response.json(); // Or response.text()
                        if (errorData && errorData.message) errorDetail = errorData.message;
                        else if (typeof errorData === 'string') errorDetail = errorData;
                    } catch (e) { /* ignore if response wasn't parseable */ }
                    throw new Error(errorDetail);
                }

                // Assuming webhook responds with OK status on success
                newsletterFeedback.textContent = 'Thank you for subscribing!';
                newsletterFeedback.className = 'newsletter-feedback success';
                newsletterForm.reset(); // Clear form
                setTimeout(() => { newsletterFeedback.textContent = ''; newsletterFeedback.className = 'newsletter-feedback'; }, 5000);


            } catch (error) {
                console.error('Webhook submission error:', error);
                newsletterFeedback.textContent = `Submission failed: ${error.message || 'Please try again.'}`;
                newsletterFeedback.className = 'newsletter-feedback error';
                // Optionally hide error after longer period
                 setTimeout(() => { newsletterFeedback.textContent = ''; newsletterFeedback.className = 'newsletter-feedback'; }, 7000);

            } finally {
                 // Re-enable button
                 if (submitButton) submitButton.disabled = false;
            }
        });
    } else {
        console.warn("Newsletter form elements not found. Signup disabled.");
    }


    // --- Initial Page Load ---
    if (currentYearSpan) currentYearSpan.textContent = new Date().getFullYear();
    initializeTheme();
    fetchTopics(); // Fetch topic data and trigger initial render

}); // End DOMContentLoaded