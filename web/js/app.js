const App = {
    allBooks: [],
    selectedBook: null,
    progressData: {},
    queue: [], // NEW: Array of book UUIDs

    init: async function() {
        this.loadSettings();
        this.loadProgress();
        this.loadQueue(); // NEW
        this.allBooks = await Library.load();
        
        this.filterAndRender();
        this.renderQueue(); // NEW
        this.calculateGlobalStats(); // NEW
        this.setupListeners();
    },

    switchMainTab: function(tab) {
        document.getElementById('tab-calc').classList.remove('active');
        document.getElementById('tab-schedule').classList.remove('active');
        document.getElementById('view-calc').classList.add('hidden');
        document.getElementById('view-schedule').classList.add('hidden');

        if (tab === 'calc') {
            document.getElementById('tab-calc').classList.add('active');
            document.getElementById('view-calc').classList.remove('hidden');
        } else {
            document.getElementById('tab-schedule').classList.add('active');
            document.getElementById('view-schedule').classList.remove('hidden');
        }
    },

    renderCalendar: function() {
        const grid = document.getElementById('calendar-grid');
        grid.innerHTML = '';

        // 1. Add Day Headers (Sun - Sat)
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        days.forEach(day => {
            const header = document.createElement('div');
            header.className = 'calendar-header-cell';
            header.innerText = day;
            grid.appendChild(header);
        });

        // 2. Get queue books with remaining words
        const queueBooks = this.queue.map(uuid => {
            const book = this.allBooks.find(b => b.uuid === uuid);
            if (!book) return null;
            const p = this.progressData[uuid] || { wordsRead: 0 };
            const remainingWords = Math.max(0, book.total_words - p.wordsRead);
            return { ...book, remainingWords };
        }).filter(b => b && b.remainingWords > 0);

        if (queueBooks.length === 0) {
            grid.innerHTML += `<div class="empty-state" style="grid-column: 1 / -1; margin-top: 1rem;">
                Your queue is empty or all books are finished! Add books to the Queue tab to see your schedule.
            </div>`;
            return;
        }

        const wpm = this.getCurrentWpm();
        const pomoMins = parseFloat(document.getElementById('pomo-time').value) || 25;
        const weekdaySessions = parseInt(document.getElementById('weekday-sessions').value) || 0;
        const weekendSessions = parseInt(document.getElementById('weekend-sessions').value) || 0;

        const schedule = Calc.generateSchedule(queueBooks, wpm, pomoMins, weekdaySessions, weekendSessions);
        const todayStr = new Date().toISOString().split('T')[0];

        let checkDate = new Date();
        
        // 3. Add empty cells for the days BEFORE today in this week
        // (e.g., if today is Wednesday (3), add 3 empty cells for Sun, Mon, Tue)
        for (let i = 0; i < checkDate.getDay(); i++) {
            const emptyEl = document.createElement('div');
            emptyEl.className = 'calendar-day empty';
            grid.appendChild(emptyEl);
        }

        // 4. Render 30 days
        for (let i = 0; i < 30; i++) {
            const dateStr = checkDate.toISOString().split('T')[0];
            const dayData = schedule[dateStr];
            
            const dayEl = document.createElement('div');
            dayEl.className = 'calendar-day';
            if (dateStr === todayStr) dayEl.classList.add('today');
            if (checkDate.getDay() === 0 || checkDate.getDay() === 6) dayEl.classList.add('weekend');

            const options = { month: 'short', day: 'numeric' };
            const displayDate = checkDate.toLocaleDateString('en-US', options);

            let tasksHtml = '';
            if (dayData && dayData.tasks.length > 0) {
                dayData.tasks.forEach(t => {
                    // Calculate pomodoros for this specific task
                    const pomos = Math.ceil(t.words / (pomoMins * wpm));
                    
                    tasksHtml += `
                        <div class="task-item ${t.isFinished ? 'finished' : ''}">
                            <span class="task-title" title="${t.title}">${t.title}</span>
                            <span class="task-words">${t.words.toLocaleString()} words (${pomos} Pomo${pomos > 1 ? 's' : ''})</span>
                        </div>
                    `;
                });
            } else if (!dayData) {
                 tasksHtml = `<div style="color:#555; font-size:0.75rem; text-align:center; margin-top:1rem;">Rest Day</div>`;
            }

            dayEl.innerHTML = `
                <div class="day-header">
                    <span>${displayDate}</span>
                </div>
                <div class="day-tasks">
                    ${tasksHtml}
                </div>
            `;

            grid.appendChild(dayEl);
            checkDate.setDate(checkDate.getDate() + 1);
        }
    },

    setupListeners: function() {
        // Tabs
        document.getElementById('tab-library').addEventListener('click', () => this.switchTab('library'));
        document.getElementById('tab-queue').addEventListener('click', () => this.switchTab('queue'));

        // Search & Sort
        document.getElementById('search-books').addEventListener('input', () => this.filterAndRender());
        document.getElementById('sort-books').addEventListener('change', () => this.filterAndRender());

        // Main Tabs
        document.getElementById('tab-calc').addEventListener('click', () => this.switchMainTab('calc'));
        document.getElementById('tab-schedule').addEventListener('click', () => {
            this.switchMainTab('schedule');
            this.renderCalendar(); // Generate calendar when tab is clicked
        });

        // Settings
        const inputs = ['wpm', 'pomo-time', 'weekday-sessions', 'weekend-sessions'];
        inputs.forEach(id => {
            document.getElementById(id).addEventListener('input', () => {
                this.saveSettings();
                if (this.selectedBook) this.calculatePlan(this.selectedBook);
                this.calculateGlobalStats(); // Update global stats when settings change
            });
        });

        // Toggle
        document.querySelectorAll('input[name="book-type"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                const wpmInput = document.getElementById('wpm');
                const helperText = document.getElementById('wpm-helper');
                if (e.target.value === 'fiction') {
                    wpmInput.value = 260;
                    helperText.innerText = "Fiction avg: ~260 wpm";
                } else {
                    wpmInput.value = 238;
                    helperText.innerText = "Non-Fiction avg: ~238 wpm";
                }
                this.saveSettings();
                if (this.selectedBook) this.calculatePlan(this.selectedBook);
                this.calculateGlobalStats();
            });
        });

        // Override
        const overrideCheck = document.getElementById('override-wpm-check');
        const overrideVal = document.getElementById('override-wpm-value');
        overrideCheck.addEventListener('change', (e) => {
            overrideVal.disabled = !e.target.checked;
            if (this.selectedBook) this.calculatePlan(this.selectedBook);
        });
        overrideVal.addEventListener('input', () => {
            if (this.selectedBook && overrideCheck.checked) this.calculatePlan(this.selectedBook);
        });

        // Log Session & Status
        document.getElementById('log-session-btn').addEventListener('click', () => this.logSession());
        document.getElementById('book-status').addEventListener('change', (e) => {
            if (!this.selectedBook) return;
            const uuid = this.selectedBook.uuid;
            if (!this.progressData[uuid]) this.progressData[uuid] = { wordsRead: 0, status: 'unread' };
            this.progressData[uuid].status = e.target.value;
            if (e.target.value === 'finished') this.progressData[uuid].wordsRead = this.selectedBook.total_words;
            
            this.saveProgress();
            this.calculatePlan(this.selectedBook);
            this.filterAndRender();
            this.renderQueue();
            this.calculateGlobalStats();
        });

        // Add to Queue
        document.getElementById('add-to-queue-btn').addEventListener('click', () => this.addToQueue());
    },

    switchTab: function(tab) {
        document.getElementById('tab-library').classList.remove('active');
        document.getElementById('tab-queue').classList.remove('active');
        document.getElementById('library-view').classList.add('hidden');
        document.getElementById('queue-view').classList.add('hidden');

        if (tab === 'library') {
            document.getElementById('tab-library').classList.add('active');
            document.getElementById('library-view').classList.remove('hidden');
        } else {
            document.getElementById('tab-queue').classList.add('active');
            document.getElementById('queue-view').classList.remove('hidden');
        }
    },

    addToQueue: function() {
        if (!this.selectedBook) return;
        if (!this.queue.includes(this.selectedBook.uuid)) {
            this.queue.push(this.selectedBook.uuid);
            this.saveQueue();
            this.renderQueue();
            this.calculateGlobalStats();
            document.getElementById('add-to-queue-btn').innerText = "Added! ✅";
            setTimeout(() => {
                document.getElementById('add-to-queue-btn').innerText = "+ Add to Queue";
            }, 2000);
        }
    },

    renderQueue: function() {
        const list = document.getElementById('queue-list');
        list.innerHTML = '';
        
        // Filter out finished books from queue display
        this.queue.forEach(uuid => {
            const book = this.allBooks.find(b => b.uuid === uuid);
            if (!book) return;

            const li = document.createElement('li');
            li.innerHTML = `
                <span>${book.title}</span>
                <button class="remove-queue-btn" title="Remove">×</button>
            `;
            
            li.querySelector('.remove-queue-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                this.queue = this.queue.filter(id => id !== uuid);
                this.saveQueue();
                this.renderQueue();
                this.calculateGlobalStats();
            });

            li.addEventListener('click', () => {
                this.switchTab('library');
                this.selectBook(book);
            });

            list.appendChild(li);
        });
    },

    calculateGlobalStats: function() {
        const wpm = this.getCurrentWpm();
        const pomoMins = parseFloat(document.getElementById('pomo-time').value) || 25;
        const weekdaySessions = parseInt(document.getElementById('weekday-sessions').value) || 0;
        const weekendSessions = parseInt(document.getElementById('weekend-sessions').value) || 0;

        // 1. Calculate your total reading capacity per year (in words)
        const weeklyMinutes = ((weekdaySessions * 5) + (weekendSessions * 2)) * pomoMins;
        const yearlyMinutes = weeklyMinutes * 52;
        const yearlyWords = yearlyMinutes * wpm;

        // 2. Calculate total words in your entire library
        let totalWords = 0;
        this.allBooks.forEach(b => totalWords += b.total_words);
        
        document.getElementById('global-books').innerText = `${this.allBooks.length} Books`;
        const totalHours = Math.round((totalWords / wpm) / 60);
        document.getElementById('global-hours').innerText = `${totalHours.toLocaleString()} Hours`;

        // 3. Calculate the average length of a book in your library
        let avgBookWords = 50000; // Fallback if library is empty
        if (this.allBooks.length > 0 && totalWords > 0) {
            avgBookWords = totalWords / this.allBooks.length;
        }

        // 4. Books Per Year = (Words you can read in a year) / (Average book length)
        const booksPerYear = Math.floor(yearlyWords / avgBookWords);
        document.getElementById('global-books-year').innerText = `~${booksPerYear}`;
    },

    filterAndRender: function() {
        const term = document.getElementById('search-books').value.toLowerCase();
        const sortMode = document.getElementById('sort-books').value;
        
        let filtered = this.allBooks.filter(b => 
            b.title.toLowerCase().includes(term) || b.authors.join(', ').toLowerCase().includes(term)
        );

        filtered.sort((a, b) => {
            if (sortMode === 'title') return a.title.localeCompare(b.title);
            if (sortMode === 'author') return a.authors[0].localeCompare(b.authors[0]);
            if (sortMode === 'words-asc') return a.total_words - b.total_words;
            if (sortMode === 'words-desc') return b.total_words - a.total_words;
            return 0;
        });

        this.renderBookList(filtered);
    },

    renderBookList: function(books) {
        const list = document.getElementById('book-list');
        list.innerHTML = '';
        
        books.forEach(book => {
            const li = document.createElement('li');
            li.innerText = book.title;
            li.title = book.authors.join(', ');
            
            const p = this.progressData[book.uuid];
            if (p) {
                if (p.status === 'reading') li.classList.add('reading');
                if (p.status === 'finished') li.classList.add('finished');
            }
            
            // Highlight if in queue
            if (this.queue.includes(book.uuid)) {
                li.style.borderLeft = "3px solid #2196f3";
            }
            
            li.addEventListener('click', () => {
                document.querySelectorAll('#book-list li').forEach(el => el.classList.remove('active'));
                li.classList.add('active');
                this.selectBook(book);
            });
            
            list.appendChild(li);
        });
    },

    selectBook: function(book) {
        this.selectedBook = book;
        document.getElementById('plan-panel').classList.remove('hidden');
        document.getElementById('selected-book-title').innerText = book.title;
        document.getElementById('selected-book-author').innerText = `by ${book.authors.join(', ')}`;
        
        const coverImg = document.getElementById('book-cover');
        if (book.cover_path) {
            coverImg.src = book.cover_path;
            coverImg.style.display = 'block';
        } else {
            coverImg.style.display = 'none';
        }

        const p = this.progressData[book.uuid] || { wordsRead: 0, status: 'unread' };
        document.getElementById('book-status').value = p.status;

        document.getElementById('override-wpm-check').checked = false;
        document.getElementById('override-wpm-value').disabled = true;
        
        this.calculatePlan(book);
    },

    getCurrentWpm: function() {
        const useOverride = document.getElementById('override-wpm-check').checked;
        let wpm = parseFloat(document.getElementById('wpm').value) || 250;
        if (useOverride) wpm = parseFloat(document.getElementById('override-wpm-value').value) || wpm;
        return wpm;
    },

    calculatePlan: function(book) {
        const wpm = this.getCurrentWpm();
        const pomoMins = parseFloat(document.getElementById('pomo-time').value) || 25;
        const weekdaySessions = parseInt(document.getElementById('weekday-sessions').value) || 0;
        const weekendSessions = parseInt(document.getElementById('weekend-sessions').value) || 0;

        const p = this.progressData[book.uuid] || { wordsRead: 0 };
        const remainingWords = Math.max(0, book.total_words - p.wordsRead);
        const percentComplete = Math.min(100, Math.round((p.wordsRead / book.total_words) * 100));

        document.getElementById('progress-bar-fill').style.width = `${percentComplete}%`;
        document.getElementById('progress-text').innerText = `${p.wordsRead.toLocaleString()} / ${book.total_words.toLocaleString()} words read (${percentComplete}%)`;

        const totalMinutes = Calc.getTotalMinutes(remainingWords, wpm);
        const totalSessions = Calc.getTotalSessions(totalMinutes, pomoMins);
        const finishDate = Calc.getFinishDate(remainingWords, wpm, pomoMins, weekdaySessions, weekendSessions);

        const hrs = Math.floor(totalMinutes / 60);
        const mins = Math.round(totalMinutes % 60);
        const options = { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' };

        document.getElementById('res-words').innerText = remainingWords.toLocaleString();
        document.getElementById('res-hours').innerText = remainingWords > 0 ? `${hrs}h ${mins}m` : "Done!";
        document.getElementById('res-sessions').innerText = totalSessions;
        document.getElementById('res-date').innerText = remainingWords > 0 ? finishDate.toLocaleDateString('en-US', options) : "Finished! 🎉";
        
        const weekdayWords = weekdaySessions * pomoMins * wpm;
        const weekendWords = weekendSessions * pomoMins * wpm;
        document.getElementById('daily-target').innerHTML = `
            <strong>Weekdays:</strong> ${weekdaySessions} sessions (~${weekdayWords.toLocaleString()} words)<br>
            <strong>Weekends:</strong> ${weekendSessions} sessions (~${weekendWords.toLocaleString()} words)
        `;
    },

    logSession: function() {
        if (!this.selectedBook) return;
        const uuid = this.selectedBook.uuid;
        const wpm = this.getCurrentWpm();
        const pomoMins = parseFloat(document.getElementById('pomo-time').value) || 25;
        const wordsToAdd = wpm * pomoMins;

        if (!this.progressData[uuid]) this.progressData[uuid] = { wordsRead: 0, status: 'reading' };
        
        this.progressData[uuid].wordsRead += wordsToAdd;
        if (this.progressData[uuid].wordsRead > this.selectedBook.total_words) this.progressData[uuid].wordsRead = this.selectedBook.total_words;
        
        if (this.progressData[uuid].wordsRead === this.selectedBook.total_words) {
            this.progressData[uuid].status = 'finished';
        } else if (this.progressData[uuid].status === 'unread') {
            this.progressData[uuid].status = 'reading';
        }

        this.saveProgress();
        this.calculatePlan(this.selectedBook);
        this.filterAndRender();
        this.renderQueue();
        this.calculateGlobalStats();
    },

    saveSettings: function() {
        const settings = {
            bookType: document.querySelector('input[name="book-type"]:checked').value,
            wpm: document.getElementById('wpm').value,
            pomoTime: document.getElementById('pomo-time').value,
            weekdaySessions: document.getElementById('weekday-sessions').value,
            weekendSessions: document.getElementById('weekend-sessions').value
        };
        localStorage.setItem('readingPlannerSettings', JSON.stringify(settings));
    },

    loadSettings: function() {
        const saved = localStorage.getItem('readingPlannerSettings');
        if (!saved) return;
        try {
            const s = JSON.parse(saved);
            document.querySelector(`input[name="book-type"][value="${s.bookType}"]`).checked = true;
            document.getElementById('wpm').value = s.wpm;
            document.getElementById('pomo-time').value = s.pomoTime;
            document.getElementById('weekday-sessions').value = s.weekdaySessions;
            document.getElementById('weekend-sessions').value = s.weekendSessions;
            document.getElementById('wpm-helper').innerText = s.bookType === 'fiction' ? "Fiction avg: ~260 wpm" : "Non-Fiction avg: ~238 wpm";
        } catch (e) {}
    },

    saveProgress: function() {
        localStorage.setItem('readingPlannerProgress', JSON.stringify(this.progressData));
    },

    loadProgress: function() {
        const saved = localStorage.getItem('readingPlannerProgress');
        if (saved) {
            try { this.progressData = JSON.parse(saved); } catch (e) { this.progressData = {}; }
        }
    },

    // ✅ Queue Storage
    saveQueue: function() {
        localStorage.setItem('readingPlannerQueue', JSON.stringify(this.queue));
    },

    loadQueue: function() {
        const saved = localStorage.getItem('readingPlannerQueue');
        if (saved) {
            try { this.queue = JSON.parse(saved); } catch (e) { this.queue = []; }
        }
    }
};

document.addEventListener('DOMContentLoaded', () => App.init());