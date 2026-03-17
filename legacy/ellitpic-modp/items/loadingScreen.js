// loadingScreen.js
// Simple loading screen utility
// Usage: showLoading("Loading geometry...") ... hideLoading()

let loadingOverlay = null;
let loadingText = null;
let progressBar = null;

export function showLoading(message = "Loading...", showProgress = false) {
    // Create overlay
    loadingOverlay = document.createElement('div');
    loadingOverlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.8);
        backdrop-filter: blur(10px);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    `;
    
    // Create spinner
    const spinner = document.createElement('div');
    spinner.style.cssText = `
        width: 50px;
        height: 50px;
        border: 4px solid rgba(255, 255, 255, 0.2);
        border-top-color: white;
        border-radius: 50%;
        animation: spin 1s linear infinite;
        margin-bottom: 20px;
    `;
    
    // Add spinner animation
    const style = document.createElement('style');
    style.textContent = `
        @keyframes spin {
            to { transform: rotate(360deg); }
        }
    `;
    document.head.appendChild(style);
    
    // Create text
    loadingText = document.createElement('div');
    loadingText.textContent = message;
    loadingText.style.cssText = `
        color: white;
        font-size: 18px;
        font-weight: 500;
        margin-bottom: 10px;
    `;
    
    loadingOverlay.appendChild(spinner);
    loadingOverlay.appendChild(loadingText);
    
    // Optional progress bar
    if (showProgress) {
        const progressContainer = document.createElement('div');
        progressContainer.style.cssText = `
            width: 300px;
            height: 4px;
            background: rgba(255, 255, 255, 0.2);
            border-radius: 2px;
            overflow: hidden;
            margin-top: 10px;
        `;
        
        progressBar = document.createElement('div');
        progressBar.style.cssText = `
            width: 0%;
            height: 100%;
            background: white;
            transition: width 0.3s ease;
        `;
        
        progressContainer.appendChild(progressBar);
        loadingOverlay.appendChild(progressContainer);
    }
    
    document.body.appendChild(loadingOverlay);
}

export function updateProgress(percent) {
    if (progressBar) {
        progressBar.style.width = `${Math.min(100, Math.max(0, percent))}%`;
    }
}

export function updateLoadingText(message) {
    if (loadingText) {
        loadingText.textContent = message;
    }
}

export function hideLoading() {
    if (loadingOverlay) {
        loadingOverlay.remove();
        loadingOverlay = null;
        loadingText = null;
        progressBar = null;
    }
}