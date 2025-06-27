// Function to update the file display
function updateFileDisplay(files) {
    const fileLabel = document.querySelector('.file-label');
    const fileText = document.querySelector('.file-text');
    const fileFormats = document.querySelector('.file-formats');
    const fileIcon = document.querySelector('.file-icon');
    
    if (files && files.length > 0) {
        const fileName = files[0].name;
        fileText.textContent = fileName;
        fileFormats.textContent = 'File selected';
        fileLabel.style.borderStyle = 'solid';
        fileLabel.style.borderColor = 'var(--success-color)';
        fileLabel.style.animation = 'none';
        
        // Add a checkmark icon
        fileIcon.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                <polyline points="22 4 12 14.01 9 11.01"></polyline>
            </svg>
        `;
        fileIcon.style.stroke = 'var(--success-color)';
    } else {
        fileText.textContent = 'Choose a file or drag it here';
        fileFormats.textContent = '.csv, .xlsx, .xls';
        fileLabel.style.borderStyle = 'dashed';
        fileLabel.style.borderColor = 'var(--accent-color)';
        fileLabel.style.animation = 'pulse 2s infinite';
        
        // Restore the original icon
        fileIcon.innerHTML = `
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
            <line x1="12" y1="18" x2="12" y2="12"></line>
            <line x1="9" y1="15" x2="15" y2="15"></line>
        `;
        fileIcon.style.stroke = 'var(--accent-color)';
    }
}

// Initialize the upload functionality
document.addEventListener('DOMContentLoaded', function() {
    // Add visual feedback when a file is selected
    const fileInput = document.getElementById('file-input');
    if (fileInput) {
        fileInput.addEventListener('change', function(e) {
            updateFileDisplay(this.files);
        });
    }

    // Add drag and drop functionality
    const dropArea = document.querySelector('.file-label');
    if (dropArea) {
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            dropArea.addEventListener(eventName, preventDefaults, false);
        });
        
        ['dragenter', 'dragover'].forEach(eventName => {
            dropArea.addEventListener(eventName, highlight, false);
        });
        
        ['dragleave', 'drop'].forEach(eventName => {
            dropArea.addEventListener(eventName, unhighlight, false);
        });
        
        dropArea.addEventListener('drop', handleDrop, false);
    }
});

function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
}

function highlight() {
    const dropArea = document.querySelector('.file-label');
    dropArea.style.borderColor = 'var(--success-color)';
    dropArea.style.backgroundColor = 'rgba(3, 218, 198, 0.1)';
    dropArea.style.transform = 'scale(1.02)';
}

function unhighlight() {
    const dropArea = document.querySelector('.file-label');
    dropArea.style.borderColor = 'var(--accent-color)';
    dropArea.style.backgroundColor = 'rgba(30, 30, 30, 0.6)';
    dropArea.style.transform = 'none';
}

function handleDrop(e) {
    const dt = e.dataTransfer;
    const files = dt.files;
    const fileInput = document.getElementById('file-input');
    
    try {
        // Create a new DataTransfer object
        const newDataTransfer = new DataTransfer();
        
        // Add the dropped files to the new DataTransfer object
        for (let i = 0; i < files.length; i++) {
            newDataTransfer.items.add(files[i]);
        }
        
        // Set the files property of the file input to the new DataTransfer object's files
        fileInput.files = newDataTransfer.files;
    } catch (error) {
        console.error('Error handling file drop:', error);
        // Fallback for browsers that don't support DataTransfer
        alert('Your browser does not fully support drag and drop file uploads. Please use the file selector instead.');
    }
    
    // Update the display
    updateFileDisplay(files);
} 