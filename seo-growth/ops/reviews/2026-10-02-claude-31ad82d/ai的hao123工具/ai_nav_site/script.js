document.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('main-content');
    const searchInput = document.getElementById('search-input');
    const categoryNav = document.getElementById('category-nav');
    
    let allData = null;
    let activeCategory = 'all';

    // Fetch data
    fetch('data.json')
        .then(response => response.json())
        .then(data => {
            allData = data;
            renderCategories(data.categories);
            filterTools();
        })
        .catch(error => console.error('Error loading data:', error));

    // Render Category Buttons
    function renderCategories(categories) {
        const allBtn = document.createElement('button');
        allBtn.className = 'category-btn active';
        allBtn.textContent = '全部 (All)';
        allBtn.dataset.id = 'all';
        allBtn.onclick = () => filterByCategory('all');
        categoryNav.appendChild(allBtn);

        categories.forEach(cat => {
            const btn = document.createElement('button');
            btn.className = 'category-btn';
            btn.textContent = cat.name.split(' ')[0]; // Simplify name for button
            btn.dataset.id = cat.id;
            btn.onclick = () => filterByCategory(cat.id);
            categoryNav.appendChild(btn);
        });
    }

    // Filter Logic
    function filterByCategory(id) {
        activeCategory = id;
        
        // Update active button
        document.querySelectorAll('.category-btn').forEach(btn => {
            if (btn.dataset.id === id) btn.classList.add('active');
            else btn.classList.remove('active');
        });

        filterTools();
    }

    // Search & Render Logic
    function filterTools() {
        const query = searchInput.value.toLowerCase();
        container.innerHTML = '';

        if (!allData) return;

        allData.categories.forEach(cat => {
            // If specific category selected, skip others
            if (activeCategory !== 'all' && activeCategory !== cat.id) return;

            // Filter tools in this category
            const categoryTools = allData.tools.filter(tool => {
                const matchesCategory = tool.category === cat.id;
                const matchesSearch = tool.name.toLowerCase().includes(query) || 
                                    tool.description.toLowerCase().includes(query) ||
                                    tool.tags.some(tag => tag.toLowerCase().includes(query));
                return matchesCategory && matchesSearch;
            });

            if (categoryTools.length > 0) {
                const section = document.createElement('section');
                
                const title = document.createElement('h2');
                title.className = 'section-title';
                title.innerHTML = `${cat.icon} ${cat.name}`;
                section.appendChild(title);

                const grid = document.createElement('div');
                grid.className = 'tools-grid';

                categoryTools.forEach(tool => {
                    const card = createToolCard(tool);
                    grid.appendChild(card);
                });

                section.appendChild(grid);
                container.appendChild(section);
            }
        });
    }

    function createToolCard(tool) {
        const a = document.createElement('a');
        a.href = tool.url;
        a.className = 'tool-card';
        a.target = '_blank';
        a.rel = 'noopener noreferrer';

        // Tags HTML
        const tagsHtml = tool.tags.map(tag => {
            let className = 'tag';
            if (tag === 'Domestic') className += ' domestic';
            if (tag === 'Global') className += ' global';
            return `<span class="${className}">${tag}</span>`;
        }).join('');

        // Fallback icon if needed (using a generic placeholder or the provided one)
        // Note: Favicon fetching can be tricky due to CORS or 404s, but browser handles img errors gracefully usually
        
        a.innerHTML = `
            <div class="card-header">
                <img src="${tool.icon}" alt="${tool.name}" class="card-icon" onerror="this.src='data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjNjQ3NDhiIiBzdHJva2Utd2lkdGg9IjIiPjxjaXJjbGUgY3g9IjEyIiBjeT0iMTIiIHI9IjEwIi8+PHBhdGggZD0iTTEyIDE2djRsMi0yIi8+PC9zdmc+'">
                <div class="card-title">${tool.name}</div>
            </div>
            <div class="card-desc">${tool.description}</div>
            <div class="card-tags">${tagsHtml}</div>
        `;

        return a;
    }

    // Search listener
    searchInput.addEventListener('input', filterTools);
});
