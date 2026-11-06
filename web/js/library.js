const Library = {
    books: {},
    
    load: async function() {
        try {
            const response = await fetch('./data/library.json');
            if (!response.ok) throw new Error("Failed to load JSON");
            const data = await response.json();
            this.books = data.books;
            return Object.values(this.books);
        } catch (error) {
            console.error("Error loading library:", error);
            return [];
        }
    }
};