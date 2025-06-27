// Global variables
let sessionId = null;
let dataColumns = [];
let numericColumns = [];

// Theme handling
function initTheme() {
    // Check for saved theme preference or use system preference
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
        document.body.classList.toggle('light-theme', savedTheme === 'light');
        updateThemeIcon(savedTheme === 'light');
    } else {
        // Check system preference
        const prefersDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
        document.body.classList.toggle('light-theme', !prefersDarkMode);
        updateThemeIcon(!prefersDarkMode);
    }
}

function toggleTheme() {
    const isLightTheme = document.body.classList.toggle('light-theme');
    localStorage.setItem('theme', isLightTheme ? 'light' : 'dark');
    updateThemeIcon(isLightTheme);
}

function updateThemeIcon(isLightTheme) {
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
        // Sun icon for dark mode (to switch to light), moon icon for light mode (to switch to dark)
        themeToggle.innerHTML = isLightTheme ? 
            `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
            </svg>` : 
            `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="5"></circle>
                <line x1="12" y1="1" x2="12" y2="3"></line>
                <line x1="12" y1="21" x2="12" y2="23"></line>
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
                <line x1="1" y1="12" x2="3" y2="12"></line>
                <line x1="21" y1="12" x2="23" y2="12"></line>
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
            </svg>`;
    }
}

// DOM Elements
const uploadForm = document.getElementById('upload-form');
const fileInput = document.getElementById('file-input');
const dataPreviewSection = document.getElementById('data-preview-section');
const analysisSection = document.getElementById('analysis-section');
const resultsSection = document.getElementById('results-section');

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM content loaded');
    initTheme();
    
    // Set up event listeners after a short delay to ensure all elements are loaded
    setTimeout(() => {
        console.log('Setting up event listeners');
        setupEventListeners();
        
        // Log all analysis buttons found
        const buttons = document.querySelectorAll('.analysis-btn');
        console.log(`Found ${buttons.length} analysis buttons:`);
        buttons.forEach(btn => {
            console.log(`- Button type: ${btn.dataset.type}`);
        });
    }, 100);
    
    // Check if we should show the upload section (from other pages)
    if (localStorage.getItem('showUpload') === 'true') {
        localStorage.removeItem('showUpload');
        const uploadSection = document.getElementById('upload-section');
        if (uploadSection) {
            uploadSection.style.display = 'block';
            uploadSection.scrollIntoView({ behavior: 'smooth' });
        }
    }
});

// Set up event listeners
function setupEventListeners() {
    // Theme toggle
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
        themeToggle.addEventListener('click', toggleTheme);
    }
    
    // File upload form submission
    if (uploadForm) {
        uploadForm.addEventListener('submit', handleFileUpload);
    }
    
    // File input change (for updating the label)
    if (fileInput) {
        fileInput.addEventListener('change', updateFileLabel);
    }
    
    // Analysis buttons - remove and reattach event listeners to avoid duplicates
    document.querySelectorAll('.analysis-btn').forEach(button => {
        // Clone and replace to remove any existing event listeners
        const newBtn = button.cloneNode(true);
        button.parentNode.replaceChild(newBtn, button);
        
        // Add event listener to the new button
        newBtn.addEventListener('click', handleAnalysisRequest);
        console.log('Attached event handler to button:', newBtn.dataset.type);
    });
    
    // Download buttons
    document.querySelectorAll('.download-btn').forEach(button => {
        button.addEventListener('click', handleDownload);
    });
    
    // Don't set a default value for chart type - we want to show "Select Chart Options"
    const chartTypeSelect = document.getElementById('chart-type');
    if (chartTypeSelect) {
        // Let the HTML default option be shown
        console.log('Chart type dropdown initialized with value:', chartTypeSelect.value);
    }
}

// Update file input label when a file is selected
function updateFileLabel(e) {
    const fileName = e.target.files[0]?.name || 'Choose a file or drag it here';
    const fileText = document.querySelector('.file-text');
    fileText.textContent = fileName;
}

// Handle file upload
async function handleFileUpload(e) {
    e.preventDefault();
    
    const fileInput = document.getElementById('file-input');
    const file = fileInput.files[0];
    
    if (!file) {
        showError('Please select a file to upload');
        return;
    }
    
    // Check file extension
    const validExtensions = ['.csv', '.xlsx', '.xls'];
    const fileExtension = '.' + file.name.split('.').pop().toLowerCase();
    
    if (!validExtensions.includes(fileExtension)) {
        showError('Please upload a CSV or Excel file');
        return;
    }
    
    // Create form data and send request
    const formData = new FormData();
    formData.append('file', file);
    
    try {
        const response = await fetch('/upload', {
            method: 'POST',
            body: formData
        });
        
        const data = await response.json();
        
        if (data.error) {
            // Check if we need to redirect to login
            if (data.redirect) {
                window.location.href = data.redirect;
                return;
            }
            showError(data.error);
            return;
        }
        
        // Store session ID and data columns
        sessionId = data.session_id;
        dataColumns = data.columns;
        
        // Identify numeric columns for visualizations
        numericColumns = [];
        for (const [col, type] of Object.entries(data.dtypes)) {
            if (type.includes('int') || type.includes('float')) {
                numericColumns.push(col);
            }
        }
        
        // Update UI with data preview
        updateDataPreview(data);
        
        // Scroll to data preview
        dataPreviewSection.scrollIntoView({ behavior: 'smooth' });
        
    } catch (error) {
        showError('An error occurred while uploading the file');
        console.error(error);
    }
}

// Update data preview section with uploaded data
function updateDataPreview(data) {
    // Set default values if data is missing
    const defaultData = {
        filename: 'sample_data.csv',
        stats: {
            rows: 100000,
            columns: 8
        },
        columns: ['Cash_Reserves', 'Debt_Ratio', 'Equity', 'Net_Profit', 'Return_on_Equity', 'Revenue', 'Total_Assets', 'Total_Liabilities']
    };
    
    // Use provided data or default data
    const displayData = data || defaultData;
    
    // Update file info
    document.getElementById('filename').textContent = displayData.filename || 'sample_data.csv';
    document.getElementById('row-count').textContent = displayData.stats?.rows || 100000;
    document.getElementById('column-count').textContent = displayData.stats?.columns || 8;
    
    // Create table header
    const thead = document.getElementById('preview-thead');
    thead.innerHTML = '';
    const headerRow = document.createElement('tr');
    
    (displayData.columns || defaultData.columns).forEach(column => {
        const th = document.createElement('th');
        th.textContent = column;
        headerRow.appendChild(th);
    });
    
    thead.appendChild(headerRow);
    
    // Create table body
    const tbody = document.getElementById('preview-tbody');
    tbody.innerHTML = '';
    
    // Create sample preview data if none exists
    if (!displayData.preview) {
        displayData.preview = [];
        // Generate 5 rows of sample data
        for (let i = 0; i < 5; i++) {
            const row = {};
            displayData.columns.forEach(column => {
                if (column === 'Cash_Reserves') row[column] = (Math.random() * 100000 + 10000).toFixed(2);
                else if (column === 'Debt_Ratio') row[column] = (Math.random() * 0.8 + 0.1).toFixed(2);
                else if (column === 'Equity') row[column] = (Math.random() * 500000 + 100000).toFixed(2);
                else if (column === 'Net_Profit') row[column] = (Math.random() * 80000 - 20000).toFixed(2);
                else if (column === 'Return_on_Equity') row[column] = (Math.random() * 0.3 - 0.05).toFixed(2);
                else if (column === 'Revenue') row[column] = (Math.random() * 300000 + 50000).toFixed(2);
                else if (column === 'Total_Assets') row[column] = (Math.random() * 800000 + 200000).toFixed(2);
                else if (column === 'Total_Liabilities') row[column] = (Math.random() * 400000 + 100000).toFixed(2);
                else row[column] = (Math.random() * 100).toFixed(2);
            });
            displayData.preview.push(row);
        }
    }
    
    displayData.preview.forEach(row => {
        const tr = document.createElement('tr');
        
        (displayData.columns || defaultData.columns).forEach(column => {
            const td = document.createElement('td');
            td.textContent = row[column] !== null && row[column] !== undefined ? row[column] : 'N/A';
            tr.appendChild(td);
        });
        
        tbody.appendChild(tr);
    });
    
    // Only show the data preview section if this is real data (not default data)
    // This ensures the data preview is only shown after a file is uploaded
    if (data) {
        // Show the data preview section
        document.getElementById('data-preview-section').style.display = 'block';
        
        // Populate column selects for analysis
        populateColumnSelects(displayData.columns);
        
        // Show the analysis section
        document.getElementById('analysis-section').style.display = 'block';
    }
}

// Populate column select dropdowns for visualizations
function populateColumnSelects() {
    const histogramSelect = document.getElementById('histogram-column');
    const barCategorySelect = document.getElementById('bar-category-column');
    const barValueSelect = document.getElementById('bar-value-column');
    const scatterXSelect = document.getElementById('scatter-x-column');
    const scatterYSelect = document.getElementById('scatter-y-column');
    
    // Clear existing options
    histogramSelect.innerHTML = '<option value="">Select a column</option>';
    barCategorySelect.innerHTML = '<option value="">Select category column</option>';
    barValueSelect.innerHTML = '<option value="">Select value column</option>';
    scatterXSelect.innerHTML = '<option value="">Select X column</option>';
    scatterYSelect.innerHTML = '<option value="">Select Y column</option>';
    
    // Add columns to selects
    dataColumns.forEach(column => {
        // For bar chart category column (all columns can be categories)
        const catOption = document.createElement('option');
        catOption.value = column;
        catOption.textContent = column;
        barCategorySelect.appendChild(catOption);
    });
    
    // Add numeric columns to selects that require numeric data
    numericColumns.forEach(column => {
        const histOption = document.createElement('option');
        histOption.value = column;
        histOption.textContent = column;
        histogramSelect.appendChild(histOption);
        
        const valOption = document.createElement('option');
        valOption.value = column;
        valOption.textContent = column;
        barValueSelect.appendChild(valOption);
        
        const xOption = document.createElement('option');
        xOption.value = column;
        xOption.textContent = column;
        scatterXSelect.appendChild(xOption);
        
        const yOption = document.createElement('option');
        yOption.value = column;
        yOption.textContent = column;
        scatterYSelect.appendChild(yOption);
    });
}

// Handle analysis button clicks
async function handleAnalysisRequest(e) {
    const analysisType = e.target.dataset.type;
    
    if (!sessionId) {
        showError('No data uploaded. Please upload a file first.');
        return;
    }
    
    // Prepare request data
    const requestData = {
        session_id: sessionId,
        analysis_type: analysisType
    };
    
    // Add additional parameters based on analysis type
    if (analysisType === 'histogram') {
        const column = document.getElementById('histogram-column').value;
        if (!column) {
            showError('Please select a column for the histogram');
            return;
        }
        requestData.column = column;
    } else if (analysisType === 'chart') {
        const chartTypeSelect = document.getElementById('chart-type');
        const chartType = chartTypeSelect ? chartTypeSelect.value : '';
        const categoryColumn = document.getElementById('bar-category-column').value;
        const valueColumn = document.getElementById('bar-value-column').value;
        
        if (!chartType) {
            showError('Please select a chart type');
            return;
        }
        
        if (!categoryColumn || !valueColumn) {
            showError('Please select both category and value columns for the chart');
            return;
        }
        
        console.log('Chart generation requested:', { chartType, categoryColumn, valueColumn });
        
        // Explicitly set chart type parameter
        requestData.chart_type = chartType;
        requestData.category_column = categoryColumn;
        requestData.value_column = valueColumn;
        
        // Use the bar endpoint for now, we'll handle different chart types on the backend
        requestData.analysis_type = 'bar';
        
        // Add a direct console log of the final request data
        console.log('Final request data:', requestData);
    } else if (analysisType === 'scatter') {
        const xColumn = document.getElementById('scatter-x-column').value;
        const yColumn = document.getElementById('scatter-y-column').value;
        
        if (!xColumn || !yColumn) {
            showError('Please select both X and Y columns for the scatter plot');
            return;
        }
        
        requestData.x_column = xColumn;
        requestData.y_column = yColumn;
    }
    
    try {
        // Show loading indicator
        const button = e.target;
        const originalText = button.innerHTML;
        button.disabled = true;
        
        // Add loading overlay for correlation analysis
        let loadingOverlay = null;
        if (analysisType === 'correlation') {
            const optionCard = button.closest('.option-card');
            loadingOverlay = document.createElement('div');
            loadingOverlay.className = 'loading-overlay';
            loadingOverlay.innerHTML = `
                <div class="spinner"></div>
                <div class="loading-text">Calculating correlation matrix...</div>
            `;
            optionCard.appendChild(loadingOverlay);
            button.innerHTML = 'Processing...';
        } else {
            button.innerHTML = 'Loading...';
        }
        
        const response = await fetch('/analyze', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestData)
        });
        
        const data = await response.json();
        
        // Restore button state and remove loading overlay
        button.innerHTML = originalText;
        button.disabled = false;
        if (loadingOverlay) {
            loadingOverlay.remove();
        }
        
        if (data.error) {
            // Check if we need to redirect to login
            if (data.redirect) {
                window.location.href = data.redirect;
                return;
            }
            showError(data.error);
            return;
        }
        
        // Display results based on analysis type
        displayResults(analysisType, data);
        
        // Show results section and scroll to it
        resultsSection.style.display = 'block';
        resultsSection.scrollIntoView({ behavior: 'smooth' });
        
    } catch (error) {
        showError('An error occurred during analysis');
        console.error(error);
    }
}

// Display analysis results
function displayResults(analysisType, data) {
    // Hide all result cards first
    document.querySelectorAll('.result-card').forEach(card => {
        card.style.display = 'none';
    });
    
    if (analysisType === 'summary') {
        const summaryCard = document.getElementById('summary-results');
        const summaryContent = document.getElementById('summary-content');
        
        // Create a table for each column's summary statistics
        let summaryHTML = '';
        
        for (const [column, stats] of Object.entries(data.summary)) {
            summaryHTML += `
                <div class="summary-table-container">
                    <h4>${column}</h4>
                    <table class="summary-table">
                        <thead>
                            <tr>
                                <th>Statistic</th>
                                <th>Value</th>
                            </tr>
                        </thead>
                        <tbody>
            `;
            
            for (const [stat, value] of Object.entries(stats)) {
                summaryHTML += `
                    <tr>
                        <td>${stat}</td>
                        <td>${typeof value === 'number' ? value.toFixed(4) : value}</td>
                    </tr>
                `;
            }
            
            summaryHTML += `
                        </tbody>
                    </table>
                </div>
            `;
        }
        
        summaryContent.innerHTML = summaryHTML;
        summaryCard.style.display = 'block';
        
    } else if (analysisType === 'correlation') {
        const correlationCard = document.getElementById('correlation-results');
        const correlationContent = document.getElementById('correlation-content');
        const correlationPlot = document.getElementById('correlation-plot');
        
        // Create correlation matrix table
        let correlationHTML = '';
        
        // Display message if columns were limited
        if (data.limited_columns && data.message) {
            correlationHTML += `<div class="info-message">${data.message}</div>`;
        }
        
        correlationHTML += '<div class="table-container"><table class="correlation-table"><thead><tr><th></th>';
        
        const columns = Object.keys(data.correlation);
        
        // Add column headers
        columns.forEach(column => {
            correlationHTML += `<th>${column}</th>`;
        });
        
        correlationHTML += '</tr></thead><tbody>';
        
        // Add rows
        columns.forEach(rowColumn => {
            correlationHTML += `<tr><td><strong>${rowColumn}</strong></td>`;
            
            columns.forEach(colColumn => {
                const value = data.correlation[rowColumn][colColumn];
                const colorIntensity = Math.abs(value) * 100;
                const color = value > 0 ? 
                    `rgba(76, 175, 80, ${Math.abs(value)})` : 
                    `rgba(244, 67, 54, ${Math.abs(value)})`;
                
                correlationHTML += `<td style="background-color: ${color}">${value.toFixed(2)}</td>`;
            });
            
            correlationHTML += '</tr>';
        });
        
        correlationHTML += '</tbody></table></div>';
        
        correlationContent.innerHTML = correlationHTML;
        
        // Add cache-busting parameter to ensure the latest image is loaded
        const cacheBuster = new Date().getTime();
        
        // Display the correlation plot
        correlationPlot.innerHTML = `<img src="${data.plot_url}?t=${cacheBuster}" alt="Correlation Matrix" class="plot-image">`;
        correlationCard.style.display = 'block';
        
    } else if (analysisType === 'histogram') {
        const histogramCard = document.getElementById('histogram-results');
        const histogramPlot = document.getElementById('histogram-plot');
        
        // Add cache-busting parameter to ensure the latest image is loaded
        const cacheBuster = new Date().getTime();
        
        // Display the histogram plot
        histogramPlot.innerHTML = `<img src="${data.plot_url}?t=${cacheBuster}" alt="Histogram" class="plot-image">`;
        histogramCard.style.display = 'block';
        
    } else if (analysisType === 'bar' || analysisType === 'chart') {
        const barCard = document.getElementById('bar-results');
        const barPlot = document.getElementById('bar-plot');
        
        // Get the chart type for the title
        let chartTypeTitle = 'Bar Graph';
        // Use chart type from server response if available, otherwise use the select value
        if (data.chart_type) {
            if (data.chart_type === 'pie') {
                chartTypeTitle = 'Pie Chart';
            } else if (data.chart_type === 'line') {
                chartTypeTitle = 'Line Chart';
            }
        } else {
            const chartTypeSelect = document.getElementById('chart-type');
            if (chartTypeSelect) {
                const chartType = chartTypeSelect.value;
                if (chartType === 'pie') {
                    chartTypeTitle = 'Pie Chart';
                } else if (chartType === 'line') {
                    chartTypeTitle = 'Line Chart';
                }
            }
        }
        
        // Update the title in the result header
        const resultHeader = barCard.querySelector('.result-header h3');
        if (resultHeader) {
            resultHeader.textContent = chartTypeTitle;
        }
        
        // Add cache-busting parameter to ensure the latest image is loaded
        const cacheBuster = new Date().getTime();
        
        // Display the bar/chart plot
        barPlot.innerHTML = `<img src="${data.plot_url}?t=${cacheBuster}" alt="${chartTypeTitle}" class="plot-image">`;
        barCard.style.display = 'block';
        
    } else if (analysisType === 'scatter') {
        const scatterCard = document.getElementById('scatter-results');
        const scatterPlot = document.getElementById('scatter-plot');
        
        // Add cache-busting parameter to ensure the latest image is loaded
        const cacheBuster = new Date().getTime();
        
        // Display the scatter plot
        scatterPlot.innerHTML = `<img src="${data.plot_url}?t=${cacheBuster}" alt="Scatter Plot" class="plot-image">`;
        scatterCard.style.display = 'block';
    }
}

// Show error message
function showError(message) {
    // Create error message element
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.textContent = message;
    
    // Add to the top of the upload section
    const uploadSection = document.querySelector('.upload-section');
    uploadSection.insertBefore(errorDiv, uploadSection.firstChild);
    
    // Also show as alert for important errors
    if (message.includes('Too many columns for visual matrix')) {
        alert(message);
    }
    
    // Remove after 5 seconds
    setTimeout(() => {
        errorDiv.remove();
    }, 5000);
}

// Handle download button clicks
function handleDownload(e) {
    const downloadType = e.currentTarget.dataset.type;
    
    if (!sessionId) {
        showError('No data available to download');
        return;
    }
    
    // Show loading state
    const button = e.currentTarget;
    const originalText = button.innerHTML;
    button.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="spin">
            <circle cx="12" cy="12" r="10"></circle>
            <path d="M12 6v6l4 2"></path>
        </svg>
        Downloading...
    `;
    button.disabled = true;
    
    // Determine what to download based on type
    if (downloadType === 'histogram' || downloadType === 'scatter' || downloadType === 'correlation' || downloadType === 'bar' || downloadType === 'chart') {
        // For plots, download the image
        downloadPlotImage(downloadType, button, originalText);
    } else if (downloadType === 'summary') {
        // For summary statistics, download as CSV
        downloadSummaryCSV(button, originalText);
    }
}

// Download plot image
function downloadPlotImage(plotType, button, originalText) {
    let imgElement;
    let filename;
    
    if (plotType === 'histogram') {
        imgElement = document.querySelector('#histogram-plot img');
        const columnName = document.getElementById('histogram-column').value;
        filename = `histogram_${columnName}_${formatDate()}.png`;
    } else if (plotType === 'bar' || plotType === 'chart') {
        imgElement = document.querySelector('#bar-plot img');
        const categoryColumn = document.getElementById('bar-category-column').value;
        const valueColumn = document.getElementById('bar-value-column').value;
        
        // Get the chart type if available
        let chartType = 'bar';
        const chartTypeSelect = document.getElementById('chart-type');
        if (chartTypeSelect) {
            chartType = chartTypeSelect.value;
        }
        
        // Create appropriate filename based on chart type
        if (chartType === 'pie') {
            filename = `pie_chart_${valueColumn}_by_${categoryColumn}_${formatDate()}.png`;
        } else if (chartType === 'line') {
            filename = `line_chart_${valueColumn}_by_${categoryColumn}_${formatDate()}.png`;
        } else {
            filename = `bar_graph_${valueColumn}_by_${categoryColumn}_${formatDate()}.png`;
        }
    } else if (plotType === 'scatter') {
        imgElement = document.querySelector('#scatter-plot img');
        const xColumn = document.getElementById('scatter-x-column').value;
        const yColumn = document.getElementById('scatter-y-column').value;
        filename = `scatter_${xColumn}_vs_${yColumn}_${formatDate()}.png`;
    } else if (plotType === 'correlation') {
        imgElement = document.querySelector('#correlation-plot img');
        filename = `correlation_matrix_${formatDate()}.png`;
    }
    
    if (!imgElement) {
        button.innerHTML = originalText;
        button.disabled = false;
        showError('No image found to download');
        return;
    }
    
    // Create a temporary link to download the image
    fetch(imgElement.src)
        .then(response => response.blob())
        .then(blob => {
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            
            // Restore button state
            button.innerHTML = originalText;
            button.disabled = false;
        })
        .catch(error => {
            console.error('Error downloading image:', error);
            button.innerHTML = originalText;
            button.disabled = false;
            showError('Failed to download image');
        });
}

// Download summary statistics as Excel-compatible CSV
function downloadSummaryCSV(button, originalText) {
    const summaryContent = document.getElementById('summary-content');
    if (!summaryContent) {
        button.innerHTML = originalText;
        button.disabled = false;
        showError('No summary data found to download');
        return;
    }
    
    // Get all column names to determine the structure
    const tables = summaryContent.querySelectorAll('.summary-table');
    const columns = [];
    tables.forEach(table => {
        columns.push(table.previousElementSibling.textContent);
    });
    
    // Get all unique statistics to create headers
    const allStats = new Set();
    tables.forEach(table => {
        const rows = table.querySelectorAll('tbody tr');
        rows.forEach(row => {
            const cells = row.querySelectorAll('td');
            if (cells.length >= 2) {
                allStats.add(cells[0].textContent);
            }
        });
    });
    
    const statistics = Array.from(allStats);
    
    // Create a better formatted CSV with columns as headers and statistics as rows
    let csvContent = '\uFEFF'; // BOM for Excel to properly detect UTF-8
    
    // Header row with column names
    csvContent += 'Statistic,' + columns.map(col => `"${col}"`).join(',') + '\n';
    
    // Add rows for each statistic
    statistics.forEach(stat => {
        csvContent += `"${stat}",`;
        
        // Add values for each column
        columns.forEach((column, colIndex) => {
            let value = '';
            
            // Find the value for this statistic in this column
            const table = tables[colIndex];
            const rows = table.querySelectorAll('tbody tr');
            rows.forEach(row => {
                const cells = row.querySelectorAll('td');
                if (cells.length >= 2 && cells[0].textContent === stat) {
                    value = cells[1].textContent;
                }
            });
            
            csvContent += `"${value}"`;
            if (colIndex < columns.length - 1) {
                csvContent += ',';
            }
        });
        
        csvContent += '\n';
    });
    
    // Create a temporary link to download the CSV
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = `summary_statistics_${formatDate()}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    
    // Restore button state
    button.innerHTML = originalText;
    button.disabled = false;
}

// Helper function to format date for filenames
function formatDate() {
    const now = new Date();
    return `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`;
}

// Add CSS for spinner
const style = document.createElement('style');
style.textContent = `
    .spin {
        animation: spin 1.5s linear infinite;
    }
    @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }
`;
document.head.appendChild(style);