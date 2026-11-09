const Calc = {
    // Simulates reading day by day to find the exact finish date
    getFinishDate: function(totalWords, wpm, pomoMins, weekdaySessions, weekendSessions) {
        const wordsPerMin = wpm;
        let wordsRemaining = totalWords;
        let currentDate = new Date();
        
        // If it's a tiny book, return today
        if (wordsRemaining <= 0) return currentDate;

        while (wordsRemaining > 0) {
            const dayOfWeek = currentDate.getDay(); // 0 = Sunday, 6 = Saturday
            const isWeekend = (dayOfWeek === 0 || dayOfWeek === 6);
            
            const sessionsToday = isWeekend ? weekendSessions : weekdaySessions;
            const minsToday = sessionsToday * pomoMins;
            const wordsToday = minsToday * wordsPerMin;
            
            wordsRemaining -= wordsToday;
            
            if (wordsRemaining > 0) {
                currentDate.setDate(currentDate.getDate() + 1); // Move to next day
            }
        }
        
        return currentDate;
    },

    getTotalMinutes: function(totalWords, wpm) {
        return totalWords / wpm;
    },

    getTotalSessions: function(totalMinutes, pomoMins) {
        return Math.ceil(totalMinutes / pomoMins);
    },
    
    generateSchedule: function(queueBooks, wpm, pomoMins, weekdaySessions, weekendSessions) {
        let schedule = {};
        let currentDate = new Date();
        let bookQueue = [...queueBooks]; // Copy
        let currentBookIndex = 0;
        
        if (bookQueue.length === 0) return schedule;

        let currentBookWordsLeft = bookQueue[0].remainingWords;

        // Generate for the next 30 days
        for (let i = 0; i < 30; i++) {
            if (currentBookIndex >= bookQueue.length) break; // Queue finished

            let dayOfWeek = currentDate.getDay();
            let isWeekend = (dayOfWeek === 0 || dayOfWeek === 6);
            let sessionsToday = isWeekend ? weekendSessions : weekdaySessions;
            let capacityToday = sessionsToday * pomoMins * wpm;
            
            let dateStr = currentDate.toISOString().split('T')[0];
            
            // If 0 sessions today, skip adding tasks, but still advance the date
            if (capacityToday > 0) {
                schedule[dateStr] = {
                    dateObj: new Date(currentDate),
                    isWeekend: isWeekend,
                    tasks: []
                };

                let wordsToReadToday = capacityToday;

                while (wordsToReadToday > 0 && currentBookIndex < bookQueue.length) {
                    let book = bookQueue[currentBookIndex];
                    let wordsFromThisBook = Math.min(wordsToReadToday, currentBookWordsLeft);

                    schedule[dateStr].tasks.push({
                        title: book.title,
                        words: wordsFromThisBook,
                        isFinished: wordsFromThisBook === currentBookWordsLeft
                    });

                    wordsToReadToday -= wordsFromThisBook;
                    currentBookWordsLeft -= wordsFromThisBook;

                    if (currentBookWordsLeft === 0) {
                        currentBookIndex++;
                        if (currentBookIndex < bookQueue.length) {
                            currentBookWordsLeft = bookQueue[currentBookIndex].remainingWords;
                        }
                    }
                }
            }
            currentDate.setDate(currentDate.getDate() + 1);
        }
        
        return schedule;
    }
};