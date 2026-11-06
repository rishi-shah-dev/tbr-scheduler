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
    }
};